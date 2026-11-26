/* =========================================================
   API TRANG QUẢN LÝ LỊCH (/admin/lich-dat/) — chỉ người đăng nhập Cloudflare Access
   GET  /api/quan-ly-lich?tu=YYYY-MM-DD&den=YYYY-MM-DD   → danh sách lịch
   GET  /api/quan-ly-lich?tu=…&den=…&xuat=csv            → tải file Excel (CSV)
   POST /api/quan-ly-lich { code, status }               → đổi trạng thái (moi | xac_nhan | da_den | huy)
   POST /api/quan-ly-lich { action: "telegram" }         → bật nút Xác nhận/Hủy trong Telegram (đăng ký webhook)
   ========================================================= */
import { ensureSchema, setStatus, purgeOld, vnNow, STATUS, capacity, buffer, webhookSecret, tg, hhmm, dmy, editTelegram } from "../../lib/lich.js";
import { accessUser } from "../../lib/access.js";

const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || "");

async function guard(request, env) {
  const u = await accessUser(request, env);
  if (!u.ok) return { res: json({ ok: false, error: u.error }, u.status) };
  if (!env.DB) return { res: json({ ok: false, error: "Chưa gắn cơ sở dữ liệu D1 (biến DB) cho project." }, 503) };
  await ensureSchema(env.DB);
  return { user: u.email };
}

export async function onRequestGet({ request, env }) {
  const g = await guard(request, env); if (g.res) return g.res;
  const q = new URL(request.url).searchParams, today = vnNow().date;
  const tu = isDate(q.get("tu")) ? q.get("tu") : today, den = isDate(q.get("den")) ? q.get("den") : tu;
  await purgeOld(env.DB).catch(() => {});
  const { results } = await env.DB.prepare(`SELECT code, name, phone, service, min, date, start, end, note, status, created, updated, by FROM bookings
    WHERE (date BETWEEN ? AND ?) OR (date IS NULL AND substr(created, 1, 10) BETWEEN ? AND ?)
    ORDER BY date IS NULL, date, start IS NULL, start, created`).bind(tu, den, tu, den).all();

  if (q.get("xuat") === "csv") {
    const cell = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [["Mã", "Ngày", "Giờ", "Đến", "Khách", "Điện thoại", "Liệu trình", "Phút", "Ghi chú", "Trạng thái", "Đặt lúc", "Cập nhật", "Người cập nhật"]]
      .concat(results.map(b => [b.code, dmy(b.date), b.start != null ? hhmm(b.start) : "Linh hoạt", b.end != null ? hhmm(b.end) : "", b.name, b.phone, b.service, b.min, b.note, STATUS[b.status] || b.status, b.created, b.updated, b.by]));
    return new Response("﻿" + rows.map(r => r.map(cell).join(",")).join("\r\n"), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="lich-dat-${tu}_${den}.csv"`, "Cache-Control": "no-store" }
    });
  }
  return json({ ok: true, user: g.user, tu, den, cap: capacity(env), buffer: buffer(env), status: STATUS, items: results });
}

export async function onRequestPost({ request, env }) {
  const g = await guard(request, env); if (g.res) return g.res;
  let body = {}; try { body = await request.json(); } catch {}

  if (body.action === "telegram") {
    const url = new URL("/api/telegram", request.url).toString();
    const r = await tg(env, "setWebhook", { url, secret_token: await webhookSecret(env), allowed_updates: ["callback_query"], drop_pending_updates: true }).then(x => x.json()).catch(e => ({ ok: false, description: String(e) }));
    return json({ ok: !!r.ok, error: r.ok ? "" : "Telegram báo: " + (r.description || "lỗi"), url });
  }

  const code = String(body.code || "").trim(), status = String(body.status || "");
  if (!code || !STATUS[status]) return json({ ok: false, error: "Thiếu mã lịch hoặc trạng thái không hợp lệ." }, 400);
  const r = await setStatus(env, code, status, g.user);
  if (!r.ok) return json(r, 409);
  await editTelegram(env, r.booking).catch(() => {});   // cập nhật luôn tin Telegram nếu biết tin nào
  return json({ ok: true, booking: r.booking });
}
