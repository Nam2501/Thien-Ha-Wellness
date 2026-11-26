/* =========================================================
   ĐỒNG BỘ SỔ LỊCH → GOOGLE SHEET (thống kê tự động)
   Mỗi lịch mới / mỗi lần đổi trạng thái → gửi sang Google Apps Script (web app) để ghi 1 dòng.
   Biến trên Cloudflare:
     SHEET_WEBHOOK_URL — địa chỉ Web app của Apps Script (…/exec)
     SHEET_SECRET      — mã bí mật, phải giống hệt dòng SECRET trong Apps Script
   Chưa có 2 biến này: bỏ qua, không ảnh hưởng đặt lịch.
   ========================================================= */
import { STATUS, hhmm } from "./lich.js";

const THU = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

// "Gội Tâm An · 90 phút · 259.000đ" → 259000
const priceOf = s => { const m = /([\d.]+)\s*đ/.exec(String(s || "")); return m ? +m[1].replace(/\./g, "") || 0 : 0; };
const nameOf = s => String(s || "").split(" · ")[0] || "Chưa chọn — cần tư vấn";

export const sheetRow = b => ({
  code: b.code, date: b.date || "", time: b.start != null ? hhmm(b.start) : "Linh hoạt", end: b.end != null ? hhmm(b.end) : "",
  weekday: b.date ? THU[new Date(b.date).getUTCDay()] : "", name: b.name, phone: b.phone,
  service: nameOf(b.service), min: b.min || "", price: priceOf(b.service), note: b.note || "",
  status: STATUS[b.status] || b.status, by: b.by || "", created: b.created || "", updated: b.updated || ""
});

export async function pushSheet(env, bookings) {
  if (!env.SHEET_WEBHOOK_URL || !env.SHEET_SECRET || !bookings.length) return { ok: false, skipped: true };
  try {
    const r = await fetch(env.SHEET_WEBHOOK_URL, {
      method: "POST", headers: { "Content-Type": "application/json" }, redirect: "follow",
      body: JSON.stringify({ secret: env.SHEET_SECRET, items: bookings.map(sheetRow) })
    });
    const t = await r.text();
    return { ok: r.ok && /"ok"\s*:\s*true/.test(t), status: r.status, body: t.slice(0, 200) };
  } catch (e) { console.error("Đồng bộ Google Sheet lỗi:", e); return { ok: false, error: String(e) }; }
}
