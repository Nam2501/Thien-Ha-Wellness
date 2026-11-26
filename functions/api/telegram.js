/* =========================================================
   NÚT XÁC NHẬN / HỦY NGAY TRONG TIN TELEGRAM
   Telegram gọi POST /api/telegram mỗi khi nhân viên bấm nút dưới tin lịch.
   Bật 1 lần trên trang /admin/lich-dat/ → "Kết nối nút Telegram".
   Bảo mật: chỉ nhận yêu cầu có mã bí mật đúng (suy ra từ token bot) và từ nhóm / người trong TELEGRAM_CHAT_ID.
   ========================================================= */
import { ensureSchema, setStatus, webhookSecret, chatIds, tg, editTelegram, bookingText, buttons } from "../../lib/lich.js";

const ACTION = { xn: "xac_nhan", den: "da_den", huy: "huy", kp: "moi" };
const DONE = { xac_nhan: "Đã xác nhận lịch", da_den: "Đã ghi nhận khách đến", huy: "Đã hủy lịch — giờ này trống lại cho khách khác", moi: "Đã khôi phục lịch" };

export async function onRequestPost({ request, env }) {
  if (!env.TELEGRAM_BOT_TOKEN || request.headers.get("x-telegram-bot-api-secret-token") !== await webhookSecret(env)) return new Response("forbidden", { status: 403 });
  const up = await request.json().catch(() => ({})), cq = up.callback_query;
  if (!cq) return new Response("ok");
  const answer = (text, alert = false) => tg(env, "answerCallbackQuery", { callback_query_id: cq.id, text, show_alert: alert }).catch(() => {});

  const chatId = String(cq.message?.chat?.id ?? "");
  if (!chatIds(env).includes(chatId)) { await answer("Nhóm này không có quyền quản lý lịch.", true); return new Response("ok"); }
  if (!env.DB) { await answer("Chưa gắn cơ sở dữ liệu lịch (D1).", true); return new Response("ok"); }

  const [act, code] = String(cq.data || "").split(":"), status = ACTION[act];
  if (!status || !code) { await answer("Nút không hợp lệ."); return new Response("ok"); }

  await ensureSchema(env.DB);
  const who = [cq.from?.first_name, cq.from?.last_name].filter(Boolean).join(" ") || cq.from?.username || "Telegram";
  const r = await setStatus(env, code, status, who);
  if (!r.ok) { await answer(r.error, true); return new Response("ok"); }

  await editTelegram(env, r.booking);   // sửa tất cả tin của lịch này (group + cá nhân)
  // Tin không lưu trong sổ (gửi trước khi có sổ lịch): sửa riêng tin vừa bấm
  if (!r.booking.tg) await tg(env, "editMessageText", { chat_id: chatId, message_id: cq.message.message_id, text: bookingText(r.booking), parse_mode: "HTML", reply_markup: buttons(code, status) }).catch(() => {});
  await answer(DONE[status]);
  return new Response("ok");
}

export const onRequest = () => new Response("Chỉ nhận POST từ Telegram", { status: 405 });
