/* =========================================================
   KIỂM TRA ĐĂNG NHẬP CLOUDFLARE ACCESS cho trang quản lý lịch
   Cloudflare Access đứng trước /admin/lich-dat và /api/quan-ly-lich: chỉ email được phép mới qua.
   Ở đây kiểm tra lại "vé" (JWT) Access gửi kèm — phòng khi Access bị tắt nhầm thì API vẫn khóa.
   Biến: CF_ACCESS_TEAM (vd thienha → thienha.cloudflareaccess.com), CF_ACCESS_AUD (Application Audience tag)
   ========================================================= */
const b64url = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0));
let certCache = { at: 0, keys: [] };

export async function accessUser(request, env) {
  const team = String(env.CF_ACCESS_TEAM || "").replace(/^https?:\/\//, "").replace(/\.cloudflareaccess\.com.*$/, "");
  if (!team || !env.CF_ACCESS_AUD) return { ok: false, status: 503, error: "Chưa bật Cloudflare Access cho trang quản lý lịch (thiếu CF_ACCESS_TEAM / CF_ACCESS_AUD)." };
  const jwt = request.headers.get("cf-access-jwt-assertion");
  if (!jwt) return { ok: false, status: 401, error: "Chưa đăng nhập Cloudflare Access." };
  try {
    const [h, p, s] = jwt.split(".");
    const head = JSON.parse(new TextDecoder().decode(b64url(h))), body = JSON.parse(new TextDecoder().decode(b64url(p)));
    const iss = `https://${team}.cloudflareaccess.com`;
    if (Date.now() - certCache.at > 3600e3 || !certCache.keys.some(k => k.kid === head.kid)) {
      certCache = { at: Date.now(), keys: (await fetch(`${iss}/cdn-cgi/access/certs`).then(r => r.json())).keys || [] };
    }
    const jwk = certCache.keys.find(k => k.kid === head.kid);
    if (!jwk) throw new Error("kid");
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64url(s), new TextEncoder().encode(`${h}.${p}`));
    const aud = [].concat(body.aud || []);
    if (!valid || body.iss !== iss || !aud.includes(env.CF_ACCESS_AUD) || body.exp * 1000 < Date.now()) throw new Error("invalid");
    return { ok: true, email: body.email || body.sub || "" };
  } catch {
    return { ok: false, status: 401, error: "Phiên đăng nhập không hợp lệ, vui lòng tải lại trang." };
  }
}
