/* =========================================================
   SỔ LỊCH ĐẶT — lưu trong Cloudflare D1 (cơ sở dữ liệu miễn phí của Cloudflare)
   Dùng chung cho: /api/dat-lich (nhận lịch), /api/lich-trong (giờ còn trống),
   /api/quan-ly-lich (trang quản lý), /api/telegram (nút Xác nhận/Hủy trong Telegram).

   Biến trên Cloudflare (Settings → Variables and Secrets / Bindings):
     DB                    — D1 database (Bindings → D1). Chưa gắn: web vẫn nhận lịch + gửi Telegram, chỉ chưa chặn trùng.
     SO_KHACH_CUNG_LUC     — số khách nhận cùng lúc (mặc định 1)
     NGHI_GIUA_KHACH       — số phút dọn phòng giữa 2 khách (mặc định 15)
     TURNSTILE_SECRET      — khóa bí mật Cloudflare Turnstile (chống bot đặt lịch giả)
     CF_ACCESS_TEAM, CF_ACCESS_AUD — Cloudflare Access bảo vệ trang quản lý lịch
   ========================================================= */

export const DEFAULT_MIN = 60;                       // khách không chọn liệu trình: giữ chỗ 60 phút
export const MAX_PER_PHONE = 2;                      // 1 số điện thoại giữ tối đa 2 lịch sắp tới
export const MAX_PER_IP = 3, IP_WINDOW_MIN = 10;     // 1 thiết bị/mạng gửi tối đa 3 lịch / 10 phút
export const KEEP_DAYS = 365;                        // sau 12 tháng: ẩn tên + số điện thoại (Nghị định 13/2023)

export const capacity = env => Math.max(1, parseInt(env.SO_KHACH_CUNG_LUC, 10) || 1);
export const buffer = env => { const n = parseInt(env.NGHI_GIUA_KHACH, 10); return Number.isFinite(n) && n >= 0 ? n : 15; };
export const hhmm = m => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const dmy = iso => iso ? iso.split("-").reverse().join("/") : "";
const vnDate = (ms = Date.now()) => new Date(ms + 7 * 3600e3);
export const vnNow = (ms = Date.now()) => {
  const d = vnDate(ms);
  return { date: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes(), stamp: d.toISOString().slice(0, 16).replace("T", " ") };
};
export const STATUS = { moi: "Mới đặt", xac_nhan: "Đã xác nhận", da_den: "Đã đến", huy: "Đã hủy" };

let ready = false;
export async function ensureSchema(db) {
  if (ready) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE, name TEXT, phone TEXT, service TEXT, dv TEXT, min INTEGER,
      date TEXT, start INTEGER, end INTEGER, note TEXT,
      status TEXT NOT NULL DEFAULT 'moi', created TEXT, updated TEXT, by TEXT, ip TEXT, tg TEXT)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date, status)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_bookings_phone ON bookings(phone)`)
  ]);
  ready = true;
}

/* Các lịch còn giữ chỗ trong 1 ngày — chỉ khoảng giờ, không có tên / số điện thoại */
export async function busyOn(db, date) {
  const { results } = await db.prepare(`SELECT start, end FROM bookings WHERE date = ? AND status != 'huy' AND start IS NOT NULL ORDER BY start`).bind(date).all();
  return results.map(r => [r.start, r.end]);
}

/* Mã lịch đọc được qua điện thoại: TH2811-K7Q3 (ngày + 4 ký tự, bỏ chữ dễ nhầm O/0/I/1) */
export const makeCode = date => {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", r = crypto.getRandomValues(new Uint8Array(4));
  return `TH${date ? date.slice(8, 10) + date.slice(5, 7) : "0000"}-${[...r].map(x => abc[x % abc.length]).join("")}`;
};

/* Không lưu IP thật: chỉ lưu dấu băm (đủ để giới hạn số lần gửi) */
export async function hashIP(ip, salt = "") {
  if (!ip) return "";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + "|" + ip));
  return [...new Uint8Array(buf)].slice(0, 12).map(b => b.toString(16).padStart(2, "0")).join("");
}

/* Mã bí mật cho webhook Telegram — suy ra từ token bot, không cần thêm biến */
export async function webhookSecret(env) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("thienha-webhook|" + (env.TELEGRAM_BOT_TOKEN || "")));
  return [...new Uint8Array(buf)].slice(0, 24).map(b => b.toString(16).padStart(2, "0")).join("");
}
export const chatIds = env => String(env.TELEGRAM_CHAT_ID || "").split(",").map(s => s.trim()).filter(Boolean);
export const tg = (env, method, body) => fetch(`${env.TELEGRAM_API || "https://api.telegram.org"}/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
});

/* Nút dưới tin lịch trong Telegram, theo trạng thái */
export const buttons = (code, status) => {
  const row = [];
  if (status === "moi") row.push({ text: "✅ Xác nhận", callback_data: `xn:${code}` });
  if (status === "xac_nhan") row.push({ text: "🟢 Khách đã đến", callback_data: `den:${code}` });
  if (status !== "huy" && status !== "da_den") row.push({ text: "❌ Hủy lịch", callback_data: `huy:${code}` });
  if (status === "huy") row.push({ text: "↩️ Khôi phục", callback_data: `kp:${code}` });
  return { inline_keyboard: row.length ? [row] : [] };
};

/* Đổi trạng thái 1 lịch. Khôi phục lịch đã hủy: chỉ được khi khung giờ vẫn còn trống. */
export async function setStatus(env, code, status, by) {
  const db = env.DB, now = vnNow().stamp;
  const b = await db.prepare(`SELECT * FROM bookings WHERE code = ?`).bind(code).first();
  if (!b) return { ok: false, error: "Không tìm thấy lịch " + code };
  if (!STATUS[status]) return { ok: false, error: "Trạng thái không hợp lệ" };
  if (b.status === "huy" && status !== "huy" && b.start != null) {
    const buf = buffer(env);
    const n = await db.prepare(`SELECT COUNT(*) AS n FROM bookings WHERE date = ? AND status != 'huy' AND start IS NOT NULL AND id != ? AND start < ? AND end + ? > ?`)
      .bind(b.date, b.id, b.end + buf, buf, b.start).first();
    if (n.n >= capacity(env)) return { ok: false, error: `Khung ${hhmm(b.start)} ngày ${dmy(b.date)} đã có khách khác, không khôi phục được.` };
  }
  await db.prepare(`UPDATE bookings SET status = ?, updated = ?, by = ? WHERE id = ?`).bind(status, now, String(by || "").slice(0, 60), b.id).run();
  return { ok: true, booking: { ...b, status, updated: now, by } };
}

/* Nội dung tin Telegram của 1 lịch (dùng khi gửi mới và khi cập nhật trạng thái) */
const escH = s => String(s ?? "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const THU = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
const BADGE = { moi: "", xac_nhan: "✅ ĐÃ XÁC NHẬN", da_den: "🟢 KHÁCH ĐÃ ĐẾN", huy: "❌ ĐÃ HỦY" };
export function bookingText(b) {
  const when = b.date ? `${THU[new Date(b.date).getUTCDay()]}, ${dmy(b.date)}` : "Linh hoạt";
  const time = b.start != null ? ` · ${hhmm(b.start)}–${hhmm(b.end)}` : "";
  const badge = BADGE[b.status] ? `<b>${BADGE[b.status]}</b>${b.by ? ` — ${escH(b.by)}` : ""}${b.updated ? ` · ${escH(b.updated.slice(11))}` : ""}` : "";
  const strike = s => b.status === "huy" ? `<s>${s}</s>` : s;
  return [
    "🌊 <b>LỊCH MỚI — Thiên Hà Wellness</b>",
    b.code ? `🔖 Mã lịch: <b>${escH(b.code)}</b>` : "",
    `👤 ${escH(b.name)}`,
    `📞 ${escH(b.phone)}`,   // Telegram tự biến số thành nút gọi (không dùng link tel:, Telegram từ chối)
    `💆 ${escH(b.service || "Chưa chọn — cần tư vấn")}`,
    strike(`🗓 ${escH(when)}${time}`),
    b.note ? `📝 ${escH(b.note)}` : "",
    `<i>Nhận lúc ${escH((b.created || "").slice(11))} ${escH(dmy((b.created || "").slice(0, 10)))}</i>`,
    badge
  ].filter(Boolean).join("\n");
}

/* Sửa lại các tin Telegram đã gửi của 1 lịch (khi đổi trạng thái trên trang quản lý) */
export async function editTelegram(env, b) {
  let msgs = []; try { msgs = JSON.parse(b.tg || "[]"); } catch {}
  await Promise.all(msgs.map(([chat_id, message_id]) => tg(env, "editMessageText", {
    chat_id, message_id, text: bookingText(b), parse_mode: "HTML", disable_web_page_preview: true, reply_markup: buttons(b.code, b.status)
  }).catch(() => {})));
}

/* Ẩn thông tin cá nhân của lịch cũ hơn 12 tháng */
export const purgeOld = db => db.prepare(`UPDATE bookings SET name = '(đã ẩn)', phone = '', note = '', ip = '' WHERE phone != '' AND COALESCE(date, substr(created, 1, 10)) < date('now', '-${KEEP_DAYS} days')`).run();
