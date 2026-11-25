/* =========================================================
   ĐĂNG NHẬP TRANG QUẢN TRỊ /admin BẰNG GITHUB (thay cho dịch vụ đăng nhập của Netlify)
   Bước 1: chuyển người dùng sang GitHub để cấp quyền.  Đường dẫn: /api/auth
   Cần biến môi trường (Cloudflare → Settings → Variables and Secrets):
     GITHUB_CLIENT_ID      — Client ID của GitHub OAuth App
     GITHUB_CLIENT_SECRET  — Client secret (chọn loại "Secret")
   ========================================================= */
export async function onRequestGet({ request, env }) {
  if (!env.GITHUB_CLIENT_ID) return new Response("Chưa cấu hình GITHUB_CLIENT_ID", { status: 500 });
  const state = crypto.randomUUID();
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  url.searchParams.set("redirect_uri", new URL("/api/callback", request.url).toString());
  url.searchParams.set("scope", "repo,user");
  url.searchParams.set("state", state);
  return new Response(null, {
    status: 302,
    headers: {
      Location: url.toString(),
      // chống giả mạo yêu cầu: so khớp state khi GitHub gọi lại
      "Set-Cookie": `oauth_state=${state}; Path=/api/callback; Max-Age=600; HttpOnly; Secure; SameSite=Lax`
    }
  });
}
