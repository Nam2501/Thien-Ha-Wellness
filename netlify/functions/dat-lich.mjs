/* =========================================================
   NHẬN LỊCH ĐẶT TỪ WEBSITE → GỬI VÀO TELEGRAM CỦA SPA
   Đường dẫn: POST /api/dat-lich  (Netlify Functions, miễn phí)
   Cần 2 biến môi trường trong Netlify → Site configuration → Environment variables:
     TELEGRAM_BOT_TOKEN  — mã bot do @BotFather cấp (KHÔNG ghi vào code)
     TELEGRAM_CHAT_ID    — ID người / nhóm nhận lịch (nhiều nơi: cách nhau bằng dấu phẩy)
   ========================================================= */

const LIMITS = { ho_ten: 80, so_dien_thoai: 20, lieu_trinh: 160, ngay: 20, gio: 10, ghi_chu: 600 };
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

export default async (req) => {
  if (req.method !== "POST") return Response.json({ ok: false, error: "Chỉ nhận POST" }, { status: 405 });

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

  const token = process.env.TELEGRAM_BOT_TOKEN, chats = String(process.env.TELEGRAM_CHAT_ID || "").split(",").map(s => s.trim()).filter(Boolean);
  if (!token || !chats.length) { console.error("Thiếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID"); return reply(req, 500, { ok: false, error: "Hệ thống đặt lịch chưa được cấu hình." }); }

  const date = /^\d{4}-\d{2}-\d{2}$/.test(d.ngay) ? d.ngay.split("-").reverse().join("/") : (d.ngay || "Linh hoạt");
  const text = [
    "🌊 <b>LỊCH MỚI — Thiên Hà Wellness</b>",
    `👤 ${esc(d.ho_ten)}`,
    `📞 ${esc(phone)}`,   // Telegram tự biến số thành nút gọi (không dùng link tel:, Telegram từ chối)
    `💆 ${esc(d.lieu_trinh || "Chưa chọn — cần tư vấn")}`,
    `🗓 ${esc(date)}${d.gio ? " · " + esc(d.gio) : ""}`,
    d.ghi_chu ? `📝 ${esc(d.ghi_chu)}` : "",
    `<i>Nhận lúc ${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</i>`
  ].filter(Boolean).join("\n");

  const results = await Promise.all(chats.map(chat_id => fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id, text, parse_mode: "HTML", disable_web_page_preview: true })
  }).then(r => r.ok).catch(() => false)));

  if (!results.some(Boolean)) { console.error("Telegram từ chối tin nhắn — kiểm tra token / chat id"); return reply(req, 502, { ok: false, error: "Chưa gửi được lịch, vui lòng gọi hotline." }); }
  return reply(req, 200, { ok: true });
};

export const config = { path: "/api/dat-lich" };
