/* =========================================================
   BUILD WEBSITE THIÊN HÀ WELLNESS — chạy: node build.mjs  (kết quả ở dist/)
   Netlify tự chạy mỗi khi nội dung thay đổi trong /admin.
   - Ghép dữ liệu data/*.json vào trang chủ (Google đọc được ngay, không cần JavaScript)
   - Tạo trang riêng cho từng liệu trình và bài viết
   - Thẻ meta, Open Graph, schema DaySpa / FAQ / Service / Article, sitemap.xml, robots.txt
   Không cần cài thêm thư viện (Node 18+).
   ========================================================= */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const R = require("./js/render.js");
const Check = require("./admin/seo-check.js");
const { esc, money, absPath, assignSlugs, urlFor, prices, titleHTML, bodyHTML } = R;

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, "dist");
const COPY = ["css", "js", "images", "admin", "data"];
// Đọc data/*.json (bỏ ký tự BOM nếu file được lưu bằng Notepad cũ); file hỏng thì dừng build, không âm thầm bỏ qua
const read = f => {
  const p = path.join(ROOT, "data", f + ".json");
  if (!fs.existsSync(p)) return {};
  try { return JSON.parse(fs.readFileSync(p, "utf8").replace(/^﻿/, "")); }
  catch (e) { throw new Error(`File data/${f}.json bị lỗi định dạng: ${e.message}`); }
};

/* ---------- Dữ liệu ---------- */
const SITE = read("site"), SEO = read("seo");
const SITE_URL = String(SEO.siteUrl || process.env.URL || "").replace(/\/+$/, "");
const SERVICES = assignSlugs(read("services").items), POSTS = assignSlugs(read("posts").items);
const FAQ = read("faq").items || [], GALLERY = read("gallery").items || [];
const ctx = { ...SEO, siteUrl: SITE_URL };
const full = p => SITE_URL + p;
const img = p => p ? (/^https?:/.test(p) ? p : full(absPath(p))) : "";
const LINKS = { tel: "tel:" + String(SITE.phone || "").replace(/[^\d+]/g, ""), zalo: SITE.zaloLink || "https://zalo.me/" + (SITE.zalo || ""), map: SITE.mapUrl || "#", review: SITE.reviewUrl || "#" };
const isoDate = d => { const m = String(d || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : ""; };
const ld = o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;

/* ---------- Thẻ <head> ---------- */
function headTags(m, schemas = []) {
  const image = img(m.image || SEO.defaultImage), ga = /^G-[A-Z0-9]+$/.test(SEO.ga4Id || "") ? SEO.ga4Id : "";
  return [
    `<title>${esc(m.title)}</title>`,
    `<meta name="description" content="${esc(m.description)}">`,
    SITE_URL && `<link rel="canonical" href="${esc(m.url)}">`,
    `<meta name="robots" content="${m.noindex ? "noindex, follow" : "index, follow, max-image-preview:large"}">`,
    `<meta property="og:type" content="${m.ogType || "website"}">`,
    `<meta property="og:site_name" content="${esc(SITE.name)}">`,
    `<meta property="og:locale" content="vi_VN">`,
    `<meta property="og:title" content="${esc(m.title)}">`,
    `<meta property="og:description" content="${esc(m.description)}">`,
    SITE_URL && `<meta property="og:url" content="${esc(m.url)}">`,
    image && `<meta property="og:image" content="${esc(image)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    SEO.gscVerification && `<meta name="google-site-verification" content="${esc(SEO.gscVerification)}">`,
    ...schemas.map(ld),
    ga && `<script async src="https://www.googletagmanager.com/gtag/js?id=${ga}"></script>\n  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config","${ga}");</script>`
  ].filter(Boolean).map(t => "  " + t).join("\n");
}

// Doanh nghiệp spa cho Google (tên, địa chỉ, điện thoại, giờ mở cửa…)
const B = SEO.business || {};
const SPA = {
  "@type": "DaySpa", "@id": full("/#spa"), name: SITE.name, url: full("/"), telephone: SITE.phone, email: SITE.email || undefined,
  image: img(SEO.defaultImage) || undefined, priceRange: B.priceRange || undefined, openingHours: B.openingHours || undefined,
  address: { "@type": "PostalAddress", streetAddress: SITE.address, addressLocality: B.city || undefined, addressCountry: "VN" },
  geo: B.latitude && B.longitude ? { "@type": "GeoCoordinates", latitude: Number(B.latitude), longitude: Number(B.longitude) } : undefined,
  hasMap: SITE.mapUrl || undefined, sameAs: /^https?:/.test(SITE.facebook || "") ? [SITE.facebook] : undefined
};
const crumbs = list => ({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: list.map(([name, p], i) => ({ "@type": "ListItem", position: i + 1, name, item: full(p) })) });

/* ---------- Dữ liệu nhúng cho main.js ---------- */
const EMBED = `<script id="site-data" type="application/json">${JSON.stringify({ site: SITE, services: SERVICES, faq: [], gallery: [], posts: [] }).replace(/</g, "\\u003c")}</script>`;

/* ---------- Trang chủ ---------- */
let home = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
home = home
  .replace(/(<(\w+)\b[^>]*\bdata-cfg="(\w+)"[^>]*>)[\s\S]*?(<\/\2>)/g, (all, open, tag, key, close) => SITE[key] != null ? open + esc(SITE[key]) + close : all)
  .replace(/(<(\w+)\b[^>]*\bdata-cfg-html="(\w+)"[^>]*>)[\s\S]*?(<\/\2>)/g, (all, open, tag, key, close) => SITE[key] ? open + titleHTML(SITE[key]) + close : all)
  .replace(/data-cfg-href="(\w+)" href="#"/g, (all, k) => `data-cfg-href="${k}" href="${esc(LINKS[k] || "#")}"`)
  .replace('<div class="svc-groups" id="services"></div>', `<div class="svc-groups" id="services">${R.servicesHTML(SERVICES)}</div>`)
  .replace('<div class="needs" id="needs"></div>', `<div class="needs" id="needs">${R.needsHTML(SITE.needs)}</div>`)
  .replace('<div class="faq" id="faq"></div>', `<div class="faq" id="faq">${R.faqHTML(FAQ)}</div>`)
  .replace('<div class="gallery" id="gallery"></div>', `<div class="gallery" id="gallery">${R.galleryHTML(GALLERY)}</div>`)
  .replace('<div class="posts" id="home-posts"></div>', `<div class="posts" id="home-posts">${POSTS.slice(0, 3).map(R.postCard).join("")}</div>`);

const homeMeta = Check.meta("page", { key: "home", path: "/", title: SITE.name, ...(SEO.pages?.home || {}) }, ctx);
const homeLd = [{ "@context": "https://schema.org", "@graph": [SPA, { "@type": "WebSite", "@id": full("/#web"), name: SITE.name, url: full("/"), inLanguage: "vi" }] }];
if (FAQ.length) homeLd.push({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) });
home = home.replace(/\s*<title>[\s\S]*?<\/title>/, "").replace(/\s*<meta name="description"[^>]*>/, "").replace(/\s*<meta property="og:[^>]*>/g, "")
  .replace("</head>", headTags(homeMeta, homeLd) + "\n</head>")
  .replace('<script src="/js/render.js"></script>', EMBED + '\n  <script src="/js/render.js"></script>');

/* ---------- Khung chung cho trang con ---------- */
const toRoot = s => s.replace(/href="#top"/g, 'href="/"').replace(/href="#([\w-]+)"/g, 'href="/#$1"');
const HEADER = toRoot(home.match(/<header class="header"[\s\S]*?<\/header>/)[0]);
const AFTER = toRoot(home.match(/<footer class="footer">[\s\S]*?(?=\n\s*<script id="site-data")/)[0]);
const FONTS = home.match(/<link rel="preconnect"[\s\S]*?<link rel="stylesheet" href="\/css\/style.css">/)[0];

function page({ meta, schemas, hero, body }) {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
${headTags(meta, schemas)}
  <meta name="theme-color" content="#071426">
  <link rel="icon" href="/images/favicon-48.png" sizes="48x48" type="image/png">
  <link rel="icon" href="/images/favicon-192.png" sizes="192x192" type="image/png">
  <link rel="apple-touch-icon" href="/images/apple-touch-icon.png">
  ${FONTS}
</head>
<body class="subpage">
  ${HEADER}
  <main id="top">
    <section class="page-hero"><div class="galaxy" aria-hidden="true"></div><div class="wrap">${hero}</div></section>
    <section class="section"><div class="wrap">${body}</div></section>
  </main>
  ${AFTER}
  ${EMBED}
  <script src="/js/render.js"></script>
  <script src="/js/main.js"></script>
</body>
</html>
`;
}
const crumbHTML = list => `<nav class="crumb" aria-label="breadcrumb">${list.slice(0, -1).map(([n, p]) => `<a href="${p}">${esc(n)}</a>`).join(" / ")} / <span>${esc(list.at(-1)[0])}</span></nav>`;

/* ---------- Trang liệu trình ---------- */
function servicePage(s) {
  const url = urlFor("services", s), m = { ...Check.meta("services", s, ctx), ogType: "website" }, ps = prices(s);
  const list = [["Trang chủ", "/"], ["Liệu trình", "/#bang-gia"], [s.name, url]];
  const schemas = [crumbs([["Trang chủ", "/"], [s.name, url]]), { "@context": "https://schema.org", "@type": "Service", name: s.name, description: m.description, serviceType: "Spa & massage",
    image: s.img ? img(s.img) : undefined, provider: { "@id": full("/#spa"), ...SPA }, areaServed: B.city || undefined,
    offers: ps.length ? { "@type": "AggregateOffer", priceCurrency: "VND", lowPrice: Math.min(...ps.map(p => p.price)), highPrice: Math.max(...ps.map(p => p.price)), offerCount: ps.length } : undefined }];
  const others = [...SERVICES.filter(x => x !== s && x.group === s.group), ...SERVICES.filter(x => x.group !== s.group)].slice(0, 5);
  return page({ meta: m, schemas,
    hero: `${crumbHTML(list)}${s.tag ? `<p class="eyebrow light">${esc(s.tag)}</p>` : ""}<h1>${esc(s.name)}</h1><p class="lead">${esc(s.desc)}</p>`,
    body: `<div class="detail"><article class="prose">${s.img ? `<figure><img src="${esc(absPath(s.img))}" alt="${esc(s.name)}" width="1200" height="675"></figure>` : ""}${bodyHTML(s.content || s.desc)}
      <div class="disclaimer">Liệu trình mang tính thư giãn, chăm sóc cơ thể; không thay thế chẩn đoán hay điều trị y khoa. Vui lòng báo trước nếu bạn đang mang thai hoặc có bệnh lý.</div></article>
      <aside class="side"><div class="side-card"><h3>Bảng giá</h3><table class="price-table">${ps.map(p => `<tr><td>${R.durText(p.min)}</td><td>${money(p.price)}</td></tr>`).join("")}</table>
        <a class="btn btn-navy" href="/?dv=${encodeURIComponent(s.id + "|" + (ps[0]?.min || ""))}#dat-lich">Đặt lịch liệu trình này</a><a class="btn btn-line" href="${esc(LINKS.tel)}">Gọi ${esc(SITE.phone)}</a></div>
        <div class="side-card"><h3>Liệu trình khác</h3><ul class="side-list">${others.map(x => `<li><a href="${urlFor("services", x)}">${esc(x.name)}</a></li>`).join("")}</ul></div></aside></div>` });
}

/* ---------- Bài viết ---------- */
function postPage(p) {
  const url = urlFor("posts", p), m = { ...Check.meta("posts", p, ctx), ogType: "article" };
  const list = [["Trang chủ", "/"], ["Bài viết", "/bai-viet/"], [p.title, url]];
  const schemas = [crumbs(list), { "@context": "https://schema.org", "@type": "Article", headline: p.title, description: m.description, image: p.img ? [img(p.img)] : undefined,
    datePublished: isoDate(p.date) || undefined, dateModified: isoDate(p.updated || p.date) || undefined, mainEntityOfPage: m.url, inLanguage: "vi",
    author: { "@type": p.author && p.author !== SITE.name ? "Person" : "Organization", name: p.author || SITE.name }, publisher: { "@id": full("/#spa"), "@type": "Organization", name: SITE.name } }];
  const src = (p.sources || []).filter(Boolean);
  return page({ meta: m, schemas,
    hero: `${crumbHTML(list)}<h1>${esc(p.title)}</h1><div class="meta"><span>${esc(p.author || SITE.name)}</span>${p.date ? `<span>Đăng ${esc(p.date)}</span>` : ""}${p.updated ? `<span>Cập nhật ${esc(p.updated)}</span>` : ""}</div>`,
    body: `<div class="detail"><article class="prose">${p.img ? `<figure><img src="${esc(absPath(p.img))}" alt="${esc(p.title)}" width="1200" height="675"></figure>` : ""}${bodyHTML(p.content)}
      ${p.reviewer ? `<p><em>Nội dung được tham vấn bởi ${esc(p.reviewer)}.</em></p>` : ""}
      ${src.length ? `<h2>Nguồn tham khảo</h2><ol>${src.map(x => `<li>${/^https?:/.test(x) ? `<a href="${esc(x)}" rel="nofollow noopener" target="_blank">${esc(x)}</a>` : esc(x)}</li>`).join("")}</ol>` : ""}
      <div class="disclaimer">Thông tin mang tính tham khảo, không thay thế tư vấn y khoa.</div></article>
      <aside class="side"><div class="side-card"><h3>Đặt lịch thư giãn</h3><p>Dành một chút thời gian cho cơ thể bạn tại ${esc(SITE.name)}.</p><a class="btn btn-navy" href="/#dat-lich">Đặt lịch</a></div>
        <div class="side-card"><h3>Liệu trình</h3><ul class="side-list">${SERVICES.slice(0, 6).map(x => `<li><a href="${urlFor("services", x)}">${esc(x.name)}</a></li>`).join("")}</ul></div></aside></div>` });
}
function blogPage() {
  const pg = SEO.pages?.blog || {}, m = Check.meta("page", { key: "blog", path: "/bai-viet/", title: "Bài viết", ...pg }, ctx);
  return page({ meta: m, schemas: [crumbs([["Trang chủ", "/"], ["Bài viết", "/bai-viet/"]])],
    hero: `${crumbHTML([["Trang chủ", "/"], ["Bài viết", "/bai-viet/"]])}<p class="eyebrow light">Góc chăm sóc cơ thể</p><h1>${esc(pg.title || "Bài viết")}</h1>${pg.description ? `<p class="lead">${esc(pg.description)}</p>` : ""}`,
    body: POSTS.length ? `<div class="blog-list">${POSTS.map(R.postCard).join("")}</div>` : `<p class="sub">Chưa có bài viết.</p>` });
}

/* ---------- Ghi file ---------- */
const write = (rel, s) => { const p = path.join(DIST, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
if (!DIST.startsWith(ROOT)) throw new Error("Sai thư mục dist");
fs.rmSync(DIST, { recursive: true, force: true });
for (const d of COPY) if (fs.existsSync(path.join(ROOT, d))) fs.cpSync(path.join(ROOT, d), path.join(DIST, d), { recursive: true });

write("index.html", home);
const urls = [{ u: "/", noindex: homeMeta.noindex }];
SERVICES.forEach(s => { write(path.join("lieu-trinh", s.slug, "index.html"), servicePage(s)); urls.push({ u: urlFor("services", s), noindex: !!s.seo?.noindex }); });
write(path.join("bai-viet", "index.html"), blogPage()); urls.push({ u: "/bai-viet/" });
// Trang cảm ơn khi trình duyệt tắt JavaScript (form gửi kiểu truyền thống) — không đưa vào sitemap
write(path.join("dat-lich-thanh-cong", "index.html"), page({
  meta: { title: `Đã nhận lịch | ${SITE.name}`, description: "Thiên Hà Wellness đã nhận yêu cầu đặt lịch của bạn.", url: full("/dat-lich-thanh-cong/"), noindex: true },
  schemas: [],
  hero: `<p class="eyebrow light">Đặt lịch</p><h1>Thiên Hà đã nhận lịch của bạn</h1><p class="lead">Cảm ơn bạn! Chúng tôi sẽ gọi điện xác nhận lịch trong giờ làm việc.</p>`,
  body: `<div class="prose"><p>Cần đổi lịch hoặc muốn trao đổi ngay, vui lòng gọi <a href="${esc(LINKS.tel)}">${esc(SITE.phone)}</a> hoặc <a href="${esc(LINKS.zalo)}" target="_blank" rel="noopener">nhắn Zalo</a>.</p><p><a class="btn btn-navy" href="/">Về trang chủ</a></p></div>`
}));
POSTS.forEach(p => { write(path.join("bai-viet", p.slug, "index.html"), postPage(p)); urls.push({ u: urlFor("posts", p), lastmod: isoDate(p.updated || p.date), noindex: !!p.seo?.noindex }); });

const sm = urls.filter(x => !x.noindex && !SEO.noindexAll).map(x => `  <url><loc>${esc(full(x.u))}</loc>${x.lastmod ? `<lastmod>${x.lastmod}</lastmod>` : ""}</url>`);
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sm.join("\n")}\n</urlset>\n`);
write("robots.txt", `User-agent: *\n${SEO.noindexAll ? "Disallow: /\n" : "Allow: /\nDisallow: /admin/\n"}${SITE_URL ? `\nSitemap: ${full("/sitemap.xml")}\n` : ""}`);

/* ---------- Báo cáo ---------- */
const res = Check.analyzeSite({ seo: ctx, services: SERVICES, posts: POSTS });
console.log(`✔ Build xong: ${urls.length} trang, sitemap ${sm.length} URL, điểm SEO trung bình ${Math.round(res.reduce((a, r) => a + r.score, 0) / res.length)}/100`);
if (!SITE_URL) console.warn("⚠ Chưa đặt tên miền (SEO toàn website → Tên miền chính): canonical và sitemap sẽ thiếu tên miền.");
if (/cập nhật/i.test(SITE.address || "") || /0900 000 000/.test(SITE.phone || "")) console.warn("⚠ Địa chỉ / hotline đang là thông tin mẫu — sửa trong admin → Thông tin spa.");
