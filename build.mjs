/* =========================================================
   BUILD WEBSITE THIÊN HÀ WELLNESS — chạy: node build.mjs  (kết quả ở dist/)
   Cloudflare Pages tự chạy mỗi khi nội dung thay đổi trong /admin.
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
// Thư viện ảnh (admin/media.js): alt, title, kích thước thật của từng ảnh trong images/uploads
const MEDIA = read("media").items || {};
const mediaOf = p => { const m = String(p || "").match(/images\/uploads\/(.+)$/); if (!m) return {}; let n = m[1]; try { n = decodeURI(n); } catch {} return MEDIA[n] || {}; };
const figImg = (p, alt) => { const m = mediaOf(p); return `<figure><img src="${esc(absPath(p))}" alt="${esc(m.alt || alt)}"${m.title ? ` title="${esc(m.title)}"` : ""} width="${m.w || 1200}" height="${m.h || 675}"></figure>`; };
// Giao diện (admin → Giao diện): chữ, ảnh, nút, bật/tắt từng khu của từng trang — data/layout/<trang>.json
const readLayout = f => read("layout/" + f);
const LAYOUT = { home: readLayout("home"), pricing: readLayout("pricing"), blog: readLayout("blog"), service: readLayout("service"), post: readLayout("post"), chrome: readLayout("chrome") };
const L = LAYOUT;
const pick = k => k.split(".").reduce((o, x) => (o == null ? undefined : o[x]), LAYOUT);
const has = v => v != null && String(v).trim() !== "";
const T = (v, d) => has(v) ? v : d;   // chữ trong Giao diện, để trống = dùng chữ mặc định
const NEEDS = L.home.needs?.items?.length ? L.home.needs.items : (SITE.needs || []);   // thẻ "Cơ thể bạn cần gì"
const SITE_URL = String(SEO.siteUrl || process.env.URL || "").replace(/\/+$/, "");
// Bài viết: mỗi bài 1 file data/posts/<tên>.json (mỗi bài 1 trang sửa riêng trong /admin). Gộp lại khi build,
// sắp ngày đăng mới nhất trước; _file = tên file để Bảng điều khiển SEO mở đúng bài. Chưa có thư mục thì đọc data/posts.json cũ.
const dateKey = d => { const m = String(d || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? +`${m[3]}${m[2].padStart(2, "0")}${m[1].padStart(2, "0")}` : 0; };
function readPosts() {
  const dir = path.join(ROOT, "data", "posts");
  if (!fs.existsSync(dir)) return read("posts").items || [];
  return fs.readdirSync(dir).filter(f => f.endsWith(".json")).map(f => {
    try { const o = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8").replace(/^﻿/, "")); return { ...o, id: o.id || f.slice(0, -5), _file: f.slice(0, -5) }; }
    catch (e) { throw new Error(`Bài viết data/posts/${f} bị lỗi định dạng: ${e.message}`); }
  }).sort((a, b) => dateKey(b.date) - dateKey(a.date) || String(a.title || "").localeCompare(String(b.title || ""), "vi"));
}
const SERVICES = assignSlugs(read("services").items), POSTS = assignSlugs(readPosts());
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
  hasMap: SITE.mapUrl || undefined, sameAs: (() => { const a = [...new Set([SITE.facebook, ...(SITE.socials || []).filter(s => s.on !== false && ["facebook", "tiktok", "instagram", "youtube"].includes(s.net)).map(s => s.url)].filter(u => /^https?:/.test(u || "")))]; return a.length ? a : undefined; })()
};
const crumbs = list => ({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: list.map(([name, p], i) => ({ "@type": "ListItem", position: i + 1, name, item: full(p) })) });

/* ---------- Dữ liệu nhúng cho main.js ---------- */
const EMBED = `<script id="site-data" type="application/json">${JSON.stringify({ site: { ...SITE, needs: NEEDS }, services: SERVICES, faq: [], gallery: [], posts: [] }).replace(/</g, "\\u003c")}</script>`;

/* ---------- Giao diện: thay chữ/ảnh/nút theo data/layout ---------- */
// Tìm thẻ có thuộc tính đánh dấu (vd data-t="home.hero.title") và thay phần bên trong (tính cả thẻ lồng nhau cùng tên)
function replaceMarked(html, attr, fn) {
  const re = new RegExp(`<(\\w+)\\b[^>]*\\s${attr}="([\\w.]+)"[^>]*>`, "g");
  let out = "", last = 0, m;
  while ((m = re.exec(html))) {
    const [open, tag, key] = m, start = m.index + open.length;
    const tr = new RegExp(`<(/?)${tag}\\b[^>]*>`, "g"); tr.lastIndex = start;
    let depth = 1, t, end = -1;
    while ((t = tr.exec(html))) { if (t[1]) { if (--depth === 0) { end = t.index; break; } } else if (!t[0].endsWith("/>")) depth++; }
    if (end < 0) continue;
    const v = fn(key, html.slice(start, end));
    if (v == null) continue;
    out += html.slice(last, start) + v; last = end; re.lastIndex = end;
  }
  return out + html.slice(last);
}
const pad2 = i => String(i + 1).padStart(2, "0");
const LISTS = {
  "chrome.menu": a => a.filter(x => has(x.label)).map(x => `<a href="${esc(x.link || "/")}">${esc(x.label)}</a>`).join("\n        ") + `\n        <a href="#dat-lich" class="nav-cta-mobile">${esc(T(L.chrome.headerBtn, "Đặt lịch"))}</a>\n      `,
  "chrome.links": a => a.filter(x => has(x.label)).map(x => `<li><a href="${esc(x.link || "/")}">${esc(x.label)}</a></li>`).join(""),
  "home.about.ticks": a => a.filter(has).map(x => `\n            <li>${esc(typeof x === "string" ? x : x.text)}</li>`).join("") + "\n          ",
  "home.values.items": a => a.filter(x => has(x.title)).map((x, i) => `\n          <div class="value"><span class="num">${pad2(i)}</span><h3>${esc(x.title)}</h3><p>${esc(x.desc || "")}</p></div>`).join("") + "\n        ",
  "home.journey.items": a => a.filter(x => has(x.title)).map(x => `\n          <li><span class="dot"></span><b>${esc(x.title)}</b><p>${esc(x.desc || "")}</p></li>`).join("") + "\n        "
};
function applyLayout(html) {
  // Khu bị tắt (on = false) → bỏ khỏi trang
  html = html.replace(/[ \t]*<!--b:([\w.]+)-->\r?\n?([\s\S]*?)[ \t]*<!--\/b:\1-->\r?\n?/g, (_, k, inner) => pick(k + ".on") === false ? "" : inner);
  html = replaceMarked(html, "data-t", k => has(pick(k)) ? titleHTML(String(pick(k)).trim()).replace(/\r?\n/g, "<br>") : null);   // xuống dòng trong ô = <br>
  html = replaceMarked(html, "data-p", k => has(pick(k)) ? String(pick(k)).split(/\n\s*\n/).map(x => x.trim()).filter(Boolean).map(x => `<p>${titleHTML(x)}</p>`).join("\n          ") : null);
  html = replaceMarked(html, "data-l", k => Array.isArray(pick(k)) && pick(k).length && LISTS[k] ? LISTS[k](pick(k)) : null);
  html = html.replace(/<a\b([^>]*?)\shref="[^"]*"([^>]*\sdata-h="([\w.]+)"[^>]*)>/g, (m, a, b, k) => has(pick(k)) ? `<a${a} href="${esc(pick(k))}"${b}>` : m);
  // Ảnh "Về chúng tôi"
  html = html.replace(/(<div class="art art-tall" data-art="([\w.]+)">)/, (m, open, k) => has(pick(k))
    ? `${open}<img class="art-photo" src="${esc(absPath(pick(k)))}" alt="${esc(mediaOf(pick(k)).alt || SITE.name)}"${mediaOf(pick(k)).w ? ` width="${mediaOf(pick(k)).w}" height="${mediaOf(pick(k)).h}"` : ""} loading="lazy">` : m);
  return html;
}

/* ---------- Trang chủ ---------- */
let home = applyLayout(fs.readFileSync(path.join(ROOT, "index.html"), "utf8"));
home = home
  .replace(/(<(\w+)\b[^>]*\bdata-cfg="(\w+)"[^>]*>)[\s\S]*?(<\/\2>)/g, (all, open, tag, key, close) => SITE[key] != null ? open + esc(SITE[key]) + close : all)
  .replace(/(<(\w+)\b[^>]*\bdata-cfg-html="(\w+)"[^>]*>)[\s\S]*?(<\/\2>)/g, (all, open, tag, key, close) => SITE[key] ? open + titleHTML(SITE[key]) + close : all)
  .replace(/data-cfg-href="(\w+)" href="#"/g, (all, k) => `data-cfg-href="${k}" href="${esc(LINKS[k] || "#")}"`)
  .replace('<div class="float-contact" id="float-contact" aria-label="Liên hệ nhanh"></div>', `<div class="float-contact" id="float-contact" aria-label="Liên hệ nhanh">${R.socialsHTML(SITE)}</div>`)
  .replace('<div class="svc-groups" id="services"></div>', `<div class="svc-groups" id="services">${R.featuredHTML(SERVICES)}</div>`)
  .replace('<div class="needs" id="needs"></div>', `<div class="needs" id="needs">${R.needsHTML(NEEDS)}</div>`)
  .replace('<div class="faq" id="faq"></div>', `<div class="faq" id="faq">${R.faqHTML(FAQ)}</div>`)
  .replace('<div class="gallery" id="gallery"></div>', `<div class="gallery" id="gallery">${R.galleryHTML(GALLERY)}</div>`)
  .replace('<div class="posts" id="home-posts"></div>', `<div class="posts" id="home-posts">${POSTS.slice(0, Math.max(1, Math.min(12, parseInt(L.home.posts?.count, 10) || 3))).map(R.postCard).join("")}</div>`);

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
  const list = [["Trang chủ", "/"], ["Bảng giá", "/bang-gia/"], [s.name, url]];
  const schemas = [crumbs([["Trang chủ", "/"], [s.name, url]]), { "@context": "https://schema.org", "@type": "Service", name: s.name, description: m.description, serviceType: "Spa & massage",
    image: s.img ? img(s.img) : undefined, provider: { "@id": full("/#spa"), ...SPA }, areaServed: B.city || undefined,
    offers: ps.length ? { "@type": "AggregateOffer", priceCurrency: "VND", lowPrice: Math.min(...ps.map(p => p.price)), highPrice: Math.max(...ps.map(p => p.price)), offerCount: ps.length } : undefined }];
  const others = [...SERVICES.filter(x => x !== s && x.group === s.group), ...SERVICES.filter(x => x.group !== s.group)].slice(0, 5);
  return page({ meta: m, schemas,
    hero: `${crumbHTML(list)}${s.tag ? `<p class="eyebrow light">${esc(s.tag)}</p>` : ""}<h1>${esc(s.name)}</h1><p class="lead">${esc(s.desc)}</p>`,
    body: `<div class="detail"><article class="prose">${s.img ? figImg(s.img, s.name) : ""}${bodyHTML(s.content || s.desc)}
      <div class="disclaimer">${esc(T(L.service.disclaimer, "Liệu trình mang tính thư giãn, chăm sóc cơ thể; không thay thế chẩn đoán hay điều trị y khoa. Vui lòng báo trước nếu bạn đang mang thai hoặc có bệnh lý."))}</div></article>
      <aside class="side"><div class="side-card"><h3>${esc(T(L.service.priceTitle, "Bảng giá"))}</h3><table class="price-table">${ps.map(p => `<tr><td>${R.durText(p.min)}</td><td>${money(p.price)}</td></tr>`).join("")}</table>
        <a class="btn btn-navy" href="/?dv=${encodeURIComponent(s.id + "|" + (ps[0]?.min || ""))}#dat-lich">${esc(T(L.service.bookBtn, "Đặt lịch liệu trình này"))}</a><a class="btn btn-line" href="${esc(LINKS.tel)}">Gọi ${esc(SITE.phone)}</a></div>
        <div class="side-card"><h3>${esc(T(L.service.otherTitle, "Liệu trình khác"))}</h3><ul class="side-list">${others.map(x => `<li><a href="${urlFor("services", x)}">${esc(x.name)}</a></li>`).join("")}</ul></div></aside></div>` });
}

/* ---------- Trang bảng giá /bang-gia/ ---------- */
function pricingPage() {
  const pg = SEO.pages?.pricing || {};
  const m = Check.meta("page", { key: "pricing", path: "/bang-gia/", title: "Bảng giá", ...pg }, ctx);
  const all = SERVICES.flatMap(s => prices(s).map(p => p.price)).filter(Boolean);
  const list = [["Trang chủ", "/"], ["Bảng giá", "/bang-gia/"]];
  const catalog = { "@context": "https://schema.org", "@type": "OfferCatalog", name: `Bảng giá ${SITE.name}`, url: m.url,
    itemListElement: SERVICES.map(s => ({ "@type": "Offer", priceCurrency: "VND", price: prices(s)[0]?.price || undefined,
      itemOffered: { "@type": "Service", name: s.name, url: full(urlFor("services", s)), provider: { "@id": full("/#spa") } } })) };
  return page({ meta: m, schemas: [crumbs(list), catalog],
    hero: `${crumbHTML(list)}<p class="eyebrow light">${esc(T(L.pricing.eyebrow, "Liệu trình & bảng giá"))}</p><h1>${esc(T(L.pricing.h1, pg.h1 || "Bảng giá dịch vụ"))}</h1>
      <p class="lead">${esc(T(L.pricing.lead, pg.lead || `${SERVICES.length} liệu trình, giá từ ${money(Math.min(...all))}. Chọn thời lượng để xem giá, bấm Đặt lịch để giữ chỗ.`))}</p>`,
    body: `<div class="pricing">${R.pricingHTML(SERVICES)}
      <div class="pl-help"><div><h3>${esc(T(L.pricing.helpTitle, "Chưa biết chọn liệu trình nào?"))}</h3><p>${esc(T(L.pricing.helpText, "Để lại số điện thoại hoặc gọi cho chúng tôi, kỹ thuật viên sẽ tư vấn theo thể trạng của bạn, miễn phí."))}</p></div>
        <div class="pl-help-act"><a class="btn btn-navy" href="/#dat-lich">${esc(T(L.pricing.helpBtn, "Đặt lịch tư vấn"))}</a><a class="btn btn-line" href="${esc(LINKS.tel)}">Gọi ${esc(SITE.phone)}</a></div></div>
      <p class="note">${esc(T(L.pricing.note, "Bảng giá tham khảo, có thể thay đổi theo chương trình. Liệu trình mang tính thư giãn, chăm sóc cơ thể; không thay thế chẩn đoán hay điều trị y khoa."))}</p></div>` });
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
    body: `<div class="detail"><article class="prose">${p.img ? figImg(p.img, p.title) : ""}${R.postBodyHTML(p)}
      ${p.reviewer ? `<p><em>Nội dung được tham vấn bởi ${esc(p.reviewer)}.</em></p>` : ""}
      ${src.length ? `<h2>Nguồn tham khảo</h2><ol>${src.map(x => `<li>${/^https?:/.test(x) ? `<a href="${esc(x)}" rel="nofollow noopener" target="_blank">${esc(x)}</a>` : esc(x)}</li>`).join("")}</ol>` : ""}
      <div class="disclaimer">${esc(T(L.post.disclaimer, "Thông tin mang tính tham khảo, không thay thế tư vấn y khoa."))}</div></article>
      <aside class="side"><div class="side-card"><h3>${esc(T(L.post.sideTitle, "Đặt lịch thư giãn"))}</h3><p>${esc(T(L.post.sideText, `Dành một chút thời gian cho cơ thể bạn tại ${SITE.name}.`))}</p><a class="btn btn-navy" href="/#dat-lich">${esc(T(L.post.sideBtn, "Đặt lịch"))}</a></div>
        <div class="side-card"><h3>${esc(T(L.post.servicesTitle, "Liệu trình"))}</h3><ul class="side-list">${SERVICES.slice(0, 6).map(x => `<li><a href="${urlFor("services", x)}">${esc(x.name)}</a></li>`).join("")}</ul></div></aside></div>
      <script>/* Đếm lượt xem: mỗi trình duyệt tối đa 1 lần/ngày cho mỗi bài */(function(s){try{var k="xem:"+s,d=new Date().toISOString().slice(0,10);if(localStorage.getItem(k)===d)return;localStorage.setItem(k,d);}catch(e){}try{navigator.sendBeacon("/api/luot-xem",new Blob([JSON.stringify({slug:s})],{type:"application/json"}));}catch(e){}})(${JSON.stringify(p.slug)});</script>` });
}
function blogPage() {
  const pg = SEO.pages?.blog || {}, m = Check.meta("page", { key: "blog", path: "/bai-viet/", title: "Bài viết", ...pg }, ctx);
  return page({ meta: m, schemas: [crumbs([["Trang chủ", "/"], ["Bài viết", "/bai-viet/"]])],
    hero: `${crumbHTML([["Trang chủ", "/"], ["Bài viết", "/bai-viet/"]])}<p class="eyebrow light">${esc(T(L.blog.eyebrow, "Góc chăm sóc cơ thể"))}</p><h1>${esc(T(L.blog.h1, pg.title || "Bài viết"))}</h1>${T(L.blog.lead, pg.description) ? `<p class="lead">${esc(T(L.blog.lead, pg.description))}</p>` : ""}`,
    body: POSTS.length ? `<div class="blog-list">${POSTS.map(R.postCard).join("")}</div>` : `<p class="sub">Chưa có bài viết.</p>` });
}

/* ---------- Ghi file ---------- */
const write = (rel, s) => { const p = path.join(DIST, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
if (!DIST.startsWith(ROOT)) throw new Error("Sai thư mục dist");
fs.rmSync(DIST, { recursive: true, force: true });
for (const d of COPY) if (fs.existsSync(path.join(ROOT, d))) fs.cpSync(path.join(ROOT, d), path.join(DIST, d), { recursive: true });
// File gộp các bài viết cho giao diện (main.js) và Bảng điều khiển SEO
fs.writeFileSync(path.join(DIST, "data", "posts.json"), JSON.stringify({ items: POSTS }, null, 2));
// Cloudflare Pages: header (noindex /admin) và chuyển hướng 301 phải nằm trong dist
for (const f of ["_headers", "_redirects"]) if (fs.existsSync(path.join(ROOT, f))) fs.copyFileSync(path.join(ROOT, f), path.join(DIST, f));

write("index.html", home);
const urls = [{ u: "/", noindex: homeMeta.noindex }];
SERVICES.forEach(s => { write(path.join("lieu-trinh", s.slug, "index.html"), servicePage(s)); urls.push({ u: urlFor("services", s), noindex: !!s.seo?.noindex }); });
write(path.join("bang-gia", "index.html"), pricingPage()); urls.push({ u: "/bang-gia/", noindex: !!SEO.pages?.pricing?.noindex });
write(path.join("bai-viet", "index.html"), blogPage()); urls.push({ u: "/bai-viet/" });
// Trang cảm ơn khi trình duyệt tắt JavaScript (form gửi kiểu truyền thống) — không đưa vào sitemap
write(path.join("dat-lich-thanh-cong", "index.html"), page({
  meta: { title: `Đã nhận lịch | ${SITE.name}`, description: "Thiên Hà Wellness đã nhận yêu cầu đặt lịch của bạn.", url: full("/dat-lich-thanh-cong/"), noindex: true },
  schemas: [],
  hero: `<p class="eyebrow light">Đặt lịch</p><h1>Thiên Hà đã nhận lịch của bạn</h1><p class="lead">Cảm ơn bạn! Chúng tôi sẽ gọi điện xác nhận lịch trong giờ làm việc.</p>`,
  body: `<div class="prose"><p>Cần đổi lịch hoặc muốn trao đổi ngay, vui lòng gọi <a href="${esc(LINKS.tel)}">${esc(SITE.phone)}</a> hoặc <a href="${esc(LINKS.zalo)}" target="_blank" rel="noopener">nhắn Zalo</a>.</p><p><a class="btn btn-navy" href="/">Về trang chủ</a></p></div>`
}));
// Chính sách bảo mật thông tin khách đặt lịch (Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân)
write(path.join("chinh-sach-bao-mat", "index.html"), page({
  meta: { title: `Chính sách bảo mật | ${SITE.name}`, description: `Cách ${SITE.name} thu thập, sử dụng và bảo vệ thông tin khách hàng khi đặt lịch trên website.`, url: full("/chinh-sach-bao-mat/") },
  schemas: [],
  hero: `<p class="eyebrow light">Thông tin khách hàng</p><h1>Chính sách bảo mật</h1>`,
  body: `<div class="prose">
    <h2>Thông tin chúng tôi thu thập</h2>
    <p>Khi bạn đặt lịch trên website, ${esc(SITE.name)} nhận: họ tên, số điện thoại, liệu trình, ngày giờ mong muốn và ghi chú (nếu có).</p>
    <h2>Mục đích sử dụng</h2>
    <ul><li>Gọi điện hoặc nhắn tin xác nhận, đổi, hủy lịch hẹn.</li><li>Sắp xếp kỹ thuật viên, phòng, tránh trùng giờ giữa các khách.</li></ul>
    <p>Chúng tôi <b>không</b> bán, cho thuê hay chia sẻ thông tin của bạn cho bên thứ ba vì mục đích quảng cáo.</p>
    <h2>Nơi lưu và thời gian lưu</h2>
    <p>Thông tin được lưu trên máy chủ Cloudflare (có mã hóa) và gửi vào nhóm Telegram nội bộ của nhân viên lễ tân. Sau 12 tháng kể từ ngày hẹn, họ tên và số điện thoại được tự động xóa khỏi sổ lịch.</p>
    <h2>Quyền của bạn</h2>
    <p>Bạn có thể yêu cầu xem, sửa hoặc xóa thông tin của mình bất cứ lúc nào bằng cách gọi <a href="${esc(LINKS.tel)}">${esc(SITE.phone)}</a>${SITE.email ? ` hoặc gửi email tới <a href="mailto:${esc(SITE.email)}">${esc(SITE.email)}</a>` : ""}. Khi yêu cầu, vui lòng cho biết mã lịch hoặc số điện thoại đã đặt.</p>
    <p><a class="btn btn-navy" href="/#dat-lich">Quay lại đặt lịch</a></p></div>`
}));
urls.push({ u: "/chinh-sach-bao-mat/" });
// Trang 404 (Cloudflare Pages tự trả mã 404 khi có file 404.html; thiếu file này mọi đường dẫn sai sẽ ra trang chủ – lỗi "soft 404")
write("404.html", page({
  meta: { title: `Không tìm thấy trang | ${SITE.name}`, description: "Trang bạn tìm không tồn tại hoặc đã được chuyển.", url: full("/404.html"), noindex: true },
  schemas: [],
  hero: `<p class="eyebrow light">Lỗi 404</p><h1>Không tìm thấy trang</h1><p class="lead">Trang bạn tìm không tồn tại hoặc đã được chuyển sang địa chỉ khác.</p>`,
  body: `<div class="prose"><p><a class="btn btn-navy" href="/">Về trang chủ</a> &nbsp; <a href="/bang-gia/">Xem bảng giá</a> · <a href="/#dat-lich">Đặt lịch</a></p></div>`
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
