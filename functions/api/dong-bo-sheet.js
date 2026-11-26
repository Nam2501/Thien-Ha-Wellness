/* =========================================================
   ĐỒNG BỘ LẠI TOÀN BỘ SỔ LỊCH SANG GOOGLE SHEET
   Mở https://<tên-miền>/api/dong-bo-sheet → dán mã SHEET_SECRET → Đồng bộ.
   Dùng lần đầu (đưa các lịch đã có sang Sheet) hoặc để kiểm tra kết nối. Chạy lại bao nhiêu lần cũng được
   (Sheet cập nhật theo mã lịch, không tạo dòng trùng).
   ========================================================= */
import { ensureSchema } from "../../lib/lich.js";
import { pushSheet } from "../../lib/sheet.js";

const page = (body, status = 200) => new Response(`<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>Đồng bộ Google Sheet · Thiên Hà Wellness</title>
<style>body{margin:0;font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;background:#f3f6f8;color:#0e1c2b}
main{max-width:560px;margin:40px auto;padding:28px;background:#fff;border-radius:16px;box-shadow:0 8px 30px rgba(7,20,38,.08)}
h1{font-size:20px;margin:0 0 12px;color:#0d2440}input{width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid #c7d2db;border-radius:10px;font:inherit}
button{margin-top:12px;padding:12px 18px;border:0;border-radius:10px;background:#0d2440;color:#fff;font:inherit;font-weight:600;cursor:pointer}
.ok{padding:14px;border-radius:10px;background:#e2efda;color:#376e22}.err{padding:14px;border-radius:10px;background:#fbe3e3;color:#9c0006}</style>
</head><body><main>${body}</main></body></html>`, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

const FORM = (msg = "") => `<h1>Đồng bộ sổ lịch sang Google Sheet</h1>${msg}
<p>Dán <b>mã bí mật SHEET_SECRET</b> (giống dòng <code>SECRET</code> trong Apps Script) rồi bấm Đồng bộ. Mọi lịch đã có sẽ được ghi / cập nhật vào Sheet.</p>
<form method="POST"><input name="key" type="password" autocomplete="off" required><button type="submit">Đồng bộ</button></form>`;

async function same(a, b) {
  const h = async s => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s))));
  const [x, y] = await Promise.all([h(a), h(b)]); let d = 0; for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i]; return d === 0;
}

export async function onRequestGet({ env }) {
  if (!env.SHEET_WEBHOOK_URL || !env.SHEET_SECRET) return page(`<div class="err">Chưa có biến SHEET_WEBHOOK_URL và SHEET_SECRET trên Cloudflare.</div>`, 503);
  return page(FORM());
}

export async function onRequestPost({ request, env }) {
  if (!env.SHEET_WEBHOOK_URL || !env.SHEET_SECRET) return page(`<div class="err">Chưa có biến SHEET_WEBHOOK_URL và SHEET_SECRET trên Cloudflare.</div>`, 503);
  if (!env.DB) return page(`<div class="err">Chưa gắn cơ sở dữ liệu D1 (biến DB).</div>`, 503);
  const key = String((await request.formData().catch(() => null))?.get("key") || "");
  if (!key || !(await same(key, env.SHEET_SECRET))) { await new Promise(r => setTimeout(r, 1500)); return page(FORM(`<div class="err">Mã bí mật không đúng.</div>`), 403); }
  await ensureSchema(env.DB);
  const { results } = await env.DB.prepare(`SELECT * FROM bookings ORDER BY id`).all();
  let sent = 0, fail = "";
  for (let i = 0; i < results.length; i += 200) {
    const r = await pushSheet(env, results.slice(i, i + 200));
    if (!r.ok) { fail = r.error || `Google trả về ${r.status}: ${r.body || ""}`; break; }
    sent += Math.min(200, results.length - i);
  }
  if (fail) return page(FORM(`<div class="err">Đã ghi ${sent}/${results.length} lịch, sau đó lỗi: ${fail.replace(/[<>&]/g, "")}</div>`), 502);
  return page(`<h1>Đồng bộ xong ✓</h1><div class="ok">Đã ghi ${results.length} lịch sang Google Sheet. Từ giờ lịch mới và mọi thay đổi trạng thái sẽ tự cập nhật.</div>`);
}
