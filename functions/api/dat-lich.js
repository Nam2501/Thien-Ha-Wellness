/* =========================================================
   NHẬN LỊCH ĐẶT TỪ WEBSITE → LƯU SỔ LỊCH (D1) → GỬI VÀO TELEGRAM CỦA SPA
   Đường dẫn: POST /api/dat-lich  (Cloudflare Pages Functions, miễn phí)
   Biến môi trường (Cloudflare → Settings → Variables and Secrets):
     TELEGRAM_BOT_TOKEN  — mã bot do @BotFather cấp (KHÔNG ghi vào code)
     TELEGRAM_CHAT_ID    — ID người / nhóm nhận lịch (nhiều nơi: cách nhau bằng dấu phẩy)
     Các biến của sổ lịch (DB, SO_KHACH_CUNG_LUC, NGHI_GIUA_KHACH, TURNSTILE_SECRET): xem lib/lich.js
   ========================================================= */
import { ensureSchema, capacity, buffer, makeCode, hhmm, dmy, vnNow, hashIP, chatIds, tg, buttons, bookingText,
  DEFAULT_MIN, MAX_PER_PHONE, MAX_PER_IP, IP_WINDOW_MIN } from "../../lib/lich.js";
import { pushSheet } from "../../lib/sheet.js";

const LIMITS = { ho_ten: 80, so_dien_thoai: 20, lieu_trinh: 160, dv: 80, ngay: 20, gio: 10, ghi_chu: 600 };
const esc = s => String(s ?? "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u0008\u000B-\u001F]/g, "").trim().slice(0, max);

// Trả JSON cho JavaScript; trình duyệt tắt JS (form gửi kiểu cũ) thì chuyển sang trang cảm ơn / quay lại form
function reply(req, status, body) {
  if ((req.headers.get("accept") || "").includes("text/html")) {
    return new Response(null, { status: 303, headers: { Location: status === 200 ? "/dat-lich-thanh-cong/" : "/?loi=dat-lich#dat-lich" } });
  }
  return Response.json(body, { status });
}

async function readBody(req) {
  const type = req.headers.get("content-type") || "";
  if (type.includes("application/json")) return await req.json();
  return Object.fromEntries(new URLSearchParams(await req.text()));
}

// Cloudflare Turnstile: xác minh "không phải robot" (chỉ bật khi có TURNSTILE_SECRET)
async function humanOK(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return true;
  if (!token) return false;
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST", body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip || "" })
  }).then(x => x.json()).catch(() => ({}));
  return !!r.success;
}

export async function onRequestPost({ request: req, env, waitUntil }) {

  // Chỉ nhận lịch gửi từ chính website (chặn trang khác lợi dụng để spam Telegram)
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(req.url).host) return reply(req, 403, { ok: false, error: "Nguồn gửi không hợp lệ" });

  let raw;
  try { raw = await readBody(req); } catch { return reply(req, 400, { ok: false, error: "Dữ liệu không đọc được" }); }

  // Bẫy bot: ô ẩn có chữ, hoặc gửi quá nhanh sau khi mở trang (< 3 giây) → bỏ qua nhưng vẫn báo "ok" để bot không thử lại
  const openedAt = Number(raw.t || 0);
  if (raw["bot-field"] || (openedAt && Date.now() - openedAt < 3000)) return reply(req, 200, { ok: true });

  const d = Object.fromEntries(Object.entries(LIMITS).map(([k, max]) => [k, clean(raw[k], max)]));
  const phone = d.so_dien_thoai.replace(/[\s.-]/g, "");
  if (!d.ho_ten || !/^(\+?84|0)\d{9,10}$/.test(phone)) return reply(req, 422, { ok: false, error: "Vui lòng nhập họ tên và số điện thoại hợp lệ." });

  const chats = chatIds(env);
  if (!env.TELEGRAM_BOT_TOKEN || !chats.length) { console.error("Thiếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID"); return reply(req, 500, { ok: false, error: "Hệ thống đặt lịch chưa được cấu hình." }); }

  // Ngày/giờ: chặn ngày đã qua, giờ đã qua (theo giờ Việt Nam), ngoài giờ nhận khách 09:00–20:00, quá 60 ngày
  const { date: today, min: nowMin, stamp } = vnNow();
  const maxDay = new Date(Date.parse(today) + 60 * 864e5).toISOString().slice(0, 10);
  if (d.ngay && (!/^\d{4}-\d{2}-\d{2}$/.test(d.ngay) || isNaN(Date.parse(d.ngay)))) return reply(req, 422, { ok: false, error: "Ngày không hợp lệ." });
  if (d.ngay && d.ngay < today) return reply(req, 422, { ok: false, error: "Ngày đã qua, vui lòng chọn ngày khác." });
  if (d.ngay && d.ngay > maxDay) return reply(req, 422, { ok: false, error: "Chỉ nhận đặt lịch trong vòng 60 ngày tới." });
  let start = null;
  if (d.gio) {
    const m = /^(\d{2}):(\d{2})$/.exec(d.gio), t = m ? +m[1] * 60 + +m[2] : -1;
    if (t < 9 * 60 || t > 20 * 60 || t % 30) return reply(req, 422, { ok: false, error: "Giờ nhận khách từ 09:00 đến 20:00." });
    if ((d.ngay || today) === today && t < nowMin) return reply(req, 422, { ok: false, error: "Giờ này đã qua, vui lòng chọn giờ khác." });
    if (d.ngay) start = t;
  }

  // Chống bot đặt lịch giả chiếm hết giờ
  const ip = req.headers.get("cf-connecting-ip") || "";
  if (!(await humanOK(env, raw["cf-turnstile-response"], ip))) return reply(req, 422, { ok: false, error: "Vui lòng xác minh bạn không phải robot rồi gửi lại.", captcha: true });

  // Thời lượng lấy từ lựa chọn "mã|phút" (vd goi-dau|60); không chọn liệu trình thì giữ chỗ 60 phút
  const pick = +String(d.dv).split("|")[1];
  const dur = [30, 60, 90].includes(pick) ? pick : DEFAULT_MIN, end = start != null ? start + dur : null;

  /* ---------- Sổ lịch (D1): lưu lịch + chặn trùng giờ giữa các khách ---------- */
  let code = "", rowId = null;
  if (env.DB) {
    try {
      const db = env.DB;
      await ensureSchema(db);
      const ipHash = await hashIP(ip, env.TELEGRAM_BOT_TOKEN?.slice(-8));
      const since = vnNow(Date.now() - IP_WINDOW_MIN * 60e3).stamp;
      const [ipN, phoneN] = await Promise.all([
        ipHash ? db.prepare(`SELECT COUNT(*) AS n FROM bookings WHERE ip = ? AND created >= ?`).bind(ipHash, since).first() : { n: 0 },
        db.prepare(`SELECT COUNT(*) AS n FROM bookings WHERE phone = ? AND status IN ('moi','xac_nhan') AND (date IS NULL OR date >= ?)`).bind(phone, today).first()
      ]);
      if (ipN.n >= MAX_PER_IP) return reply(req, 429, { ok: false, error: "Bạn vừa gửi nhiều lịch liên tiếp. Vui lòng thử lại sau ít phút hoặc gọi hotline." });

      if (start != null) {
        // Cùng số điện thoại đã giữ đúng giờ này → không tạo lịch thứ 2
        const dup = await db.prepare(`SELECT code FROM bookings WHERE phone = ? AND date = ? AND start = ? AND status != 'huy' LIMIT 1`).bind(phone, d.ngay, start).first();
        if (dup) return reply(req, 409, { ok: false, conflict: true, error: `Bạn đã đặt lịch ${hhmm(start)} ngày ${dmy(d.ngay)} rồi (mã ${dup.code}). Spa sẽ gọi xác nhận, bạn không cần đặt lại.` });
      }
      if (phoneN.n >= MAX_PER_PHONE) return reply(req, 429, { ok: false, error: `Số điện thoại này đã có ${MAX_PER_PHONE} lịch sắp tới. Vui lòng gọi hotline nếu cần đặt thêm hoặc đổi lịch.` });

      code = makeCode(d.ngay);
      const cols = `code, name, phone, service, dv, min, date, start, end, note, status, created, updated, ip`;
      const vals = [code, d.ho_ten, phone, d.lieu_trinh, d.dv, dur, d.ngay || null, start, end, d.ghi_chu, "moi", stamp, stamp, ipHash];
      let r;
      if (start != null) {
        // Chỉ ghi khi khung giờ (kể cả 15 phút dọn phòng) còn chỗ — kiểm tra + ghi trong 1 lệnh nên 2 khách bấm cùng lúc cũng không lọt
        const buf = buffer(env);
        r = await db.prepare(`INSERT INTO bookings (${cols}) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
          WHERE (SELECT COUNT(*) FROM bookings WHERE date = ? AND status != 'huy' AND start IS NOT NULL AND start < ? AND end + ? > ?) < ?`)
          .bind(...vals, d.ngay, end + buf, buf, start, capacity(env)).run();
        if (!r.meta.changes) return reply(req, 409, { ok: false, conflict: true, error: `Khung giờ ${hhmm(start)} ngày ${dmy(d.ngay)} vừa có khách đặt. Vui lòng chọn giờ khác hoặc gọi hotline để được xếp lịch.` });
      } else {
        // Ngày/giờ linh hoạt: vẫn lưu để ghi nhận, không giữ chỗ
        r = await db.prepare(`INSERT INTO bookings (${cols}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(...vals).run();
      }
      rowId = r.meta.last_row_id;
    } catch (e) { console.error("Lỗi sổ lịch D1:", e); code = ""; rowId = null; }   // lỗi CSDL không được làm mất lịch: vẫn gửi Telegram
  }

  const note = !d.ngay && d.gio ? [`Giờ mong muốn: ${d.gio}`, d.ghi_chu].filter(Boolean).join(" · ") : d.ghi_chu;
  const text = bookingText({ code, name: d.ho_ten, phone, service: d.lieu_trinh, date: d.ngay, start, end, note, status: "moi", created: stamp });
  const markup = code ? buttons(code, "moi") : undefined;
  const sent = await Promise.all(chats.map(chat_id => tg(env, "sendMessage", { chat_id, text, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: markup })
    .then(r => r.json()).then(j => j.ok ? [chat_id, j.result.message_id] : null).catch(() => null)));
  const results = sent.filter(Boolean);
  // Nhớ tin nào đã gửi để khi đổi trạng thái trên trang quản lý thì sửa luôn tin Telegram
  if (rowId != null && results.length) await env.DB.prepare(`UPDATE bookings SET tg = ? WHERE id = ?`).bind(JSON.stringify(results), rowId).run().catch(() => {});

  if (!results.length) {
    console.error("Telegram từ chối tin nhắn — kiểm tra token / chat id");
    // Spa không nhận được tin → trả lại chỗ, tránh giữ giờ "ma"
    if (rowId != null) await env.DB.prepare(`DELETE FROM bookings WHERE id = ?`).bind(rowId).run().catch(() => {});
    return reply(req, 502, { ok: false, error: "Chưa gửi được lịch, vui lòng gọi hotline." });
  }
  // Ghi sang Google Sheet để thống kê (chạy nền, không làm chậm khách)
  if (code) waitUntil(pushSheet(env, [{ code, name: d.ho_ten, phone, service: d.lieu_trinh, min: dur, date: d.ngay, start, end, note, status: "moi", created: stamp, updated: stamp }]));
  return reply(req, 200, { ok: true, code });
}

// Các phương thức khác (GET…) → 405
export const onRequest = () => Response.json({ ok: false, error: "Chỉ nhận POST" }, { status: 405 });
