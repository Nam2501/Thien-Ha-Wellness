/* =========================================================
   ĐĂNG NHẬP /admin — Bước 2: GitHub gọi lại, đổi "code" lấy token rồi trao cho Decap CMS.
   Đường dẫn: /api/callback
   Tùy chọn: SITE_ORIGINS — các tên miền khác được phép mở /admin (cách nhau bằng dấu phẩy),
   ví dụ: https://thienhawellness.vn,https://www.thienhawellness.vn
   ========================================================= */
const page = (status, content, allowed) => new Response(`<!doctype html><meta charset="utf-8"><title>Đăng nhập</title>
<body style="font-family:system-ui;padding:24px">Đang hoàn tất đăng nhập…
<script>
(function () {
  var allowed = ${JSON.stringify(allowed)};
  var msg = "authorization:github:${status}:" + ${JSON.stringify(JSON.stringify(content))};
  function receive(e) {
    if (allowed.indexOf(e.origin) === -1) return;   // chỉ trao token cho trang quản trị của chính website
    window.opener.postMessage(msg, e.origin);
    window.removeEventListener("message", receive, false);
  }
  window.addEventListener("message", receive, false);
  if (window.opener) window.opener.postMessage("authorizing:github", "*");
  else document.body.textContent = "Hãy mở trang /admin rồi bấm đăng nhập lại.";
})();
</script>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const allowed = [url.origin, ...String(env.SITE_ORIGINS || "").split(",").map(s => s.trim().replace(/\/+$/, "")).filter(Boolean)];
  const cookieState = (request.headers.get("Cookie") || "").match(/(?:^|;\s*)oauth_state=([^;]+)/)?.[1];
  if (!url.searchParams.get("code") || !cookieState || cookieState !== url.searchParams.get("state"))
    return page("error", { message: "Phiên đăng nhập không hợp lệ, hãy thử lại." }, allowed);

  const r = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": "thien-ha-wellness-cms" },
    body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code: url.searchParams.get("code") })
  });
  const data = await r.json().catch(() => ({}));
  if (!data.access_token) return page("error", { message: data.error_description || "GitHub không cấp quyền." }, allowed);
  return page("success", { token: data.access_token, provider: "github" }, allowed);
}
