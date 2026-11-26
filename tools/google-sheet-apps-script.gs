/* =========================================================
   SỔ LỊCH ĐẶT THIÊN HÀ WELLNESS — nhận lịch từ website, ghi vào tab "Lịch đặt"
   Cách cài (1 lần):
   1. Mở Google Sheet "Sổ lịch đặt · Thiên Hà Wellness" → Tiện ích mở rộng → Apps Script.
   2. Xóa hết mã có sẵn, dán toàn bộ file này vào.
   3. Thay DAN_MA_BI_MAT_VAO_DAY bằng 1 chuỗi bí mật tự đặt (≥ 20 ký tự chữ + số, không dấu),
      bấm Lưu (biểu tượng đĩa mềm).
   4. Bấm Triển khai → Tùy chọn triển khai mới → bánh răng chọn "Ứng dụng web":
        - Thực thi với tư cách: Tôi
        - Người có quyền truy cập: Bất kỳ ai
      → Triển khai → Cấp quyền (chọn tài khoản Google → Nâng cao → Đi tới … → Cho phép).
   5. Sao chép "URL ứng dụng web" (kết thúc bằng /exec) → Cloudflare biến SHEET_WEBHOOK_URL.
   6. Cloudflare biến SHEET_SECRET (loại Secret) = đúng chuỗi bí mật ở bước 3.
   "Bất kỳ ai" chỉ có nghĩa là website gọi được vào; không có mã bí mật đúng thì không ghi được gì,
   và không ai đọc được dữ liệu trong Sheet qua đường này.
   KHÔNG lưu mã bí mật thật vào file này trong kho code.
   ========================================================= */
const SECRET = 'DAN_MA_BI_MAT_VAO_DAY';
const SHEET_NAME = 'Lịch đặt';
// Thứ tự cột A → O trong tab "Lịch đặt"
const FIELDS = ['code', 'date', 'time', 'end', 'weekday', 'name', 'phone', 'service', 'min', 'price', 'note', 'status', 'by', 'created', 'updated'];

function doPost(e) {
  let data;
  try { data = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'bad json' }); }
  if (SECRET === 'DAN_MA_BI_MAT_VAO_DAY' || data.secret !== SECRET) return out({ ok: false, error: 'forbidden' });
  const items = (data.items || []).filter(it => it && it.code);
  if (!items.length) return out({ ok: true, written: 0 });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);   // nhiều lịch cùng lúc: ghi lần lượt, không đè nhau
  try {
    const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
    const last = sh.getLastRow();
    const codes = last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues().map(r => String(r[0])) : [];
    const index = {}; codes.forEach((c, i) => { if (c) index[c] = i + 2; });
    let next = last + 1;
    items.forEach(it => {
      const row = FIELDS.map(f => toCell(f, it[f]));
      const r = index[it.code] || next++;
      sh.getRange(r, 1, 1, row.length).setValues([row]);
      index[it.code] = r;
    });
    return out({ ok: true, written: items.length });
  } finally {
    lock.releaseLock();
  }
}

// Ngày "2026-11-28" → ô ngày thật (lọc / biểu đồ được); giờ giữ dạng chữ "15:00"
function toCell(field, v) {
  if (v === undefined || v === null) return '';
  if (field === 'date') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : '';
  }
  if (field === 'created' || field === 'updated') {
    const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(String(v));
    return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : String(v);
  }
  if (field === 'min' || field === 'price') return Number(v) || '';
  return String(v);
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Chọn hàm "thuGhi" rồi bấm Chạy để thử: tab Lịch đặt phải có 1 dòng "TEST-…" (xóa dòng đó sau khi thử)
function thuGhi() {
  const now = new Date(), tz = 'Asia/Ho_Chi_Minh';
  const iso = Utilities.formatDate(now, tz, 'yyyy-MM-dd'), stamp = Utilities.formatDate(now, tz, 'yyyy-MM-dd HH:mm');
  const res = doPost({ postData: { contents: JSON.stringify({ secret: SECRET, items: [{
    code: 'TEST-' + Utilities.formatDate(now, tz, 'HHmmss'), date: iso, time: '15:00', end: '16:00', weekday: 'Thử', name: 'Khách thử',
    phone: '0900000000', service: 'Gội Tâm An', min: 60, price: 199000, note: 'Dòng thử — xóa được', status: 'Mới đặt', by: '', created: stamp, updated: stamp }] }) } });
  Logger.log(res.getContent());
}
