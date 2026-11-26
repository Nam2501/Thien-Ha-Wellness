/* =========================================================
   KẾT NỐI NÚT XÁC NHẬN / HỦY TRONG TELEGRAM (làm 1 lần)
   Mở https://<tên-miền>/api/ket-noi-telegram → dán token bot → Kết nối.
   Web chỉ kết nối khi token dán vào TRÙNG với TELEGRAM_BOT_TOKEN đã lưu trên Cloudflare,
   nên người ngoài không biết token thì không làm gì được. Token không bị lưu ở đâu khác.
   ========================================================= */
import { webhookSecret, tg } from "../../lib/lich.js";

const page = (body, status = 200) => new Response(`<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>Kết nối nút Telegram · Thiên Hà Wellness</title>
<style>body{margin:0;font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;background:#f3f6f8;color:#0e1c2b}
main{max-width:560px;margin:40px auto;padding:28px;background:#fff;border-radius:16px;box-shadow:0 8px 30px rgba(7,20,38,.08)}
h1{font-size:20px;margin:0 0 12px;color:#0d2440}input{width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid #c7d2db;border-radius:10px;font:inherit}
button{margin-top:12px;padding:12px 18px;border:0;border-radius:10px;background:#0d2440;color:#fff;font:inherit;font-weight:600;cursor:pointer}
.ok{padding:14px;border-radius:10px;background:#e2efda;color:#376e22}.err{padding:14px;border-radius:10px;background:#fbe3e3;color:#9c0006}
small{color:#5b6b7a}</style></head><body><main>${body}</main></body></html>`, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

const FORM = (msg = "") => `<h1>Kết nối nút ✅ Xác nhận / ❌ Hủy trong Telegram</h1>
${msg}
<p>Dán <b>token của bot đặt lịch</b> (lấy trong @BotFather → /mybots → chọn bot → API Token) rồi bấm Kết nối. Chỉ cần làm 1 lần.</p>
<form method="POST"><input name="token" type="password" autocomplete="off" placeholder="Ví dụ 7712345678:AAH..." required>
<button type="submit">Kết nối</button></form>
<p><small>Token chỉ dùng để đối chiếu với token đã lưu trên Cloudflare, không được lưu lại. Nếu sau này đổi token bot (Revoke), hãy cập nhật TELEGRAM_BOT_TOKEN trên Cloudflare rồi kết nối lại tại trang này.</small></p>`;

// So sánh không lộ độ dài khớp (tránh đoán token qua thời gian phản hồi)
async function same(a, b) {
  const h = async s => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s))));
  const [x, y] = await Promise.all([h(a), h(b)]);
  let d = 0; for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

export async function onRequestGet({ env }) {
  if (!env.TELEGRAM_BOT_TOKEN) return page(`<div class="err">Chưa có biến TELEGRAM_BOT_TOKEN trên Cloudflare.</div>`, 500);
  // Cho biết đã kết nối chưa (không lộ thông tin nhạy cảm)
  const info = await tg(env, "getWebhookInfo", {}).then(r => r.json()).catch(() => ({}));
  const url = info.result?.url || "";
  const status = url.endsWith("/api/telegram")
    ? `<div class="ok">Đang kết nối ✓ — các nút trong Telegram đang hoạt động.${info.result.last_error_message ? `<br><small>Lỗi gần nhất: ${String(info.result.last_error_message).replace(/[<>&]/g, "")}</small>` : ""}</div>`
    : "";
  return page(FORM(status));
}

export async function onRequestPost({ request, env }) {
  if (!env.TELEGRAM_BOT_TOKEN) return page(`<div class="err">Chưa có biến TELEGRAM_BOT_TOKEN trên Cloudflare.</div>`, 500);
  const form = await request.formData().catch(() => null);
  const token = String(form?.get("token") || "").trim();
  if (!token || !(await same(token, env.TELEGRAM_BOT_TOKEN))) {
    await new Promise(r => setTimeout(r, 1500));   // làm chậm việc dò token
    return page(FORM(`<div class="err">Token không đúng với token bot đang dùng trên website.</div>`), 403);
  }
  const hook = new URL("/api/telegram", request.url).toString();
  const r = await tg(env, "setWebhook", { url: hook, secret_token: await webhookSecret(env), allowed_updates: ["callback_query"], drop_pending_updates: true })
    .then(x => x.json()).catch(e => ({ ok: false, description: String(e) }));
  if (!r.ok) return page(FORM(`<div class="err">Telegram báo lỗi: ${String(r.description || "không rõ").replace(/[<>&]/g, "")}</div>`), 502);
  return page(`<h1>Đã kết nối ✓</h1><div class="ok">Từ giờ lễ tân bấm <b>✅ Xác nhận</b>, <b>🟢 Khách đã đến</b>, <b>❌ Hủy lịch</b> ngay dưới tin lịch trong group Telegram. Hủy lịch thì giờ đó trống lại trên website.</div>
  <p><small>Lưu ý: các tin lịch gửi <b>trước khi gắn sổ lịch (D1)</b> không có mã lịch nên không có nút. Lịch mới từ bây giờ đều có nút.</small></p>`);
}
