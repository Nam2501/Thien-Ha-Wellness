/* =========================================================
   GIỜ ĐÃ KÍN TRONG 1 NGÀY — form đặt lịch dùng để làm mờ các giờ không còn chỗ
   GET /api/lich-trong?ngay=YYYY-MM-DD
   Chỉ trả khoảng giờ bận (phút trong ngày), KHÔNG có tên / số điện thoại khách.
   ========================================================= */
import { ensureSchema, busyOn, capacity, buffer } from "../../lib/lich.js";

export async function onRequestGet({ request, env }) {
  const ngay = new URL(request.url).searchParams.get("ngay") || "";
  const headers = { "Cache-Control": "no-store" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay)) return Response.json({ ok: false, error: "Ngày không hợp lệ" }, { status: 400, headers });
  if (!env.DB) return Response.json({ ok: true, enabled: false, busy: [] }, { headers });   // chưa gắn sổ lịch: không chặn
  try {
    await ensureSchema(env.DB);
    return Response.json({ ok: true, enabled: true, cap: capacity(env), buffer: buffer(env), busy: await busyOn(env.DB, ngay) }, { headers });
  } catch (e) {
    console.error("lich-trong:", e);
    return Response.json({ ok: true, enabled: false, busy: [] }, { headers });
  }
}
