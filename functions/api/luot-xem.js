/* =========================================================
   LƯỢT XEM BÀI VIẾT — lưu trong D1 (biến DB)
   POST /api/luot-xem   body: { slug }  → +1 (trang bài viết tự gửi, mỗi trình duyệt tối đa 1 lần/ngày/bài)
   GET  /api/luot-xem   → { "<slug>": số lượt, ... } cho trang /admin/bai-viet.html
   Chỉ đếm số, không lưu IP hay thông tin người xem.
   ========================================================= */
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|zalo|headless|lighthouse/i;

async function ensure(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS post_views (slug TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0, updated TEXT)`).run();
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return new Response(null, { status: 204 });
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) return new Response(null, { status: 403 });
  if (BOT.test(request.headers.get("user-agent") || "")) return new Response(null, { status: 204 });
  let slug = "";
  try { slug = String((await request.json()).slug || ""); } catch { slug = (await request.text().catch(() => "")).trim(); }
  if (!/^[a-z0-9-]{1,160}$/.test(slug)) return new Response(null, { status: 400 });
  await ensure(env.DB);
  await env.DB.prepare(`INSERT INTO post_views (slug, n, updated) VALUES (?, 1, datetime('now'))
    ON CONFLICT(slug) DO UPDATE SET n = n + 1, updated = datetime('now')`).bind(slug).run();
  return new Response(null, { status: 204 });
}

export async function onRequestGet({ env }) {
  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
  if (!env.DB) return Response.json({}, { headers });
  await ensure(env.DB);
  const { results } = await env.DB.prepare(`SELECT slug, n FROM post_views`).all();
  return Response.json(Object.fromEntries(results.map(r => [r.slug, r.n])), { headers });
}
