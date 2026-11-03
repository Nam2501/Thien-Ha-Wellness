/* =========================================================
   BỘ CHẤM ĐIỂM SEO — dùng chung cho khung xem trước trong admin,
   bảng điều khiển /admin/seo.html và build.mjs.
   ========================================================= */
(function (root) {
  const R = typeof module === "object" && module.exports ? require("../js/render.js") : root.Render;
  const { nameOf, urlFor, slugify } = R;

  const norm = s => String(s ?? "").toLowerCase().normalize("NFC").replace(/\s+/g, " ").trim();
  const words = s => norm(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const count = (hay, needle) => { if (!needle) return 0; let n = 0, i = 0; while ((i = hay.indexOf(needle, i)) !== -1) { n++; i += needle.length; } return n; };
  const paras = s => String(s ?? "").split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

  // Spa không được quảng cáo như cơ sở khám chữa bệnh — các cụm từ dưới đây dễ vi phạm và bị Google đánh giá thấp
  const CLAIMS_BAD = ["chữa khỏi", "khỏi hẳn", "khỏi hoàn toàn", "dứt điểm", "đặc trị", "trị tận gốc", "thần dược", "cam kết khỏi", "hiệu quả 100%", "không tác dụng phụ", "thay thế thuốc", "trị thoát vị", "chữa thoát vị"];
  const CLAIMS_SOFT = ["điều trị", "chữa bệnh", "chữa trị", "trị bệnh", "giảm cân cấp tốc", "trẻ hóa 10 tuổi"];
  const MIN_WORDS = { services: [250, 100], posts: [700, 350] };

  /* ---------- Meta hiệu lực (giống hệt cách build.mjs ghi ra trang) ---------- */
  function meta(type, it, seo = {}) {
    const s = it.seo || {}, page = type === "page";
    const base = norm(s.title) ? s.title.trim() : page ? it.title : nameOf(it);
    const title = page && it.key === "home" ? base : (seo.titleTemplate || "%s").replace("%s", base);
    const auto = String(it.excerpt || it.desc || "").replace(/\s+/g, " ").trim();
    const description = norm(s.description) ? s.description.trim() : page ? (it.description || "") : auto.slice(0, 158);
    const path = page ? it.path : urlFor(type, it);
    return { title, description, descAuto: !page && !norm(s.description), keyword: norm(page ? it.keyword : s.keyword),
      image: s.image || it.image || it.img || "", path, url: String(seo.siteUrl || "").replace(/\/+$/, "") + path, noindex: !!(s.noindex || seo.noindexAll) };
  }
  const bodyText = (type, it) => type === "page" ? (it.description || "") : [it.desc, it.content].filter(Boolean).join("\n\n");

  /* ---------- Chấm 1 trang ---------- */
  function analyze(type, it, ctx = {}) {
    const seo = ctx.seo || {}, m = meta(type, it, seo), checks = [], isPage = type === "page";
    const add = (id, label, status, msg, weight = 10) => checks.push({ id, label, status, msg, weight });
    const kw = m.keyword, text = bodyText(type, it), all = norm([m.title, m.description, text].join(" "));
    const wc = words(text).length, first = norm(paras(type === "services" ? it.content : text)[0] || "");

    const tl = m.title.length;
    add("title", "Độ dài tiêu đề", tl >= 30 && tl <= 65 ? "good" : tl && tl <= 75 ? "warn" : "bad", tl ? `${tl} ký tự — nên 30–65.` : "Chưa có tiêu đề.");
    const dl = m.description.length;
    add("desc", "Mô tả meta", dl >= 110 && dl <= 160 && !m.descAuto ? "good" : dl >= 50 ? "warn" : "bad",
      !dl ? "Chưa có mô tả." : m.descAuto ? `Đang dùng mô tả tự động (${dl} ký tự). Nên viết riêng 110–160 ký tự, có từ khóa và lời mời đặt lịch.` : `${dl} ký tự — nên 110–160.`);

    if (!kw) add("kw", "Từ khóa chính", "bad", "Chưa đặt từ khóa chính.");
    else {
      add("kw", "Từ khóa chính", "good", `“${kw}”`);
      add("kw-title", "Từ khóa trong tiêu đề", norm(m.title).includes(kw) ? "good" : "bad", norm(m.title).includes(kw) ? "Có." : "Tiêu đề chưa chứa từ khóa.");
      add("kw-desc", "Từ khóa trong mô tả", norm(m.description).includes(kw) ? "good" : "warn", norm(m.description).includes(kw) ? "Có." : "Mô tả chưa chứa từ khóa.", 5);
      if (!isPage) {
        const ok = it.slug.includes(slugify(kw));
        add("kw-slug", "Từ khóa trong URL", ok ? "good" : "warn", ok ? m.path : `URL ${m.path} chưa chứa “${slugify(kw)}”.`, 5);
        add("kw-first", "Từ khóa ở đoạn mở đầu", first.includes(kw) ? "good" : "warn", first.includes(kw) ? "Có." : "Nên nhắc từ khóa trong 1–2 câu đầu.", 5);
        const n = count(norm(text), kw), dens = wc ? n * words(kw).length / wc * 100 : 0;
        add("kw-density", "Mật độ từ khóa", !n ? "bad" : dens > 3 ? "bad" : dens >= .5 ? "good" : "warn",
          !n ? "Từ khóa chưa xuất hiện trong nội dung." : dens > 3 ? `${dens.toFixed(1)}% — quá dày, dễ bị coi là nhồi từ khóa.` : `${n} lần, ${dens.toFixed(1)}%${dens < .5 ? " — hơi ít, nên 0,5–2,5%." : "."}`, 5);
      }
    }
    if (!isPage) {
      const [good, min] = MIN_WORDS[type];
      add("words", "Độ dài nội dung", wc >= good ? "good" : wc >= min ? "warn" : "bad", `${wc} chữ — nên từ ${good} chữ trở lên.`);
      add("img", "Ảnh đại diện", m.image ? "good" : "warn", m.image ? "Có ảnh." : "Chưa có ảnh — nên dùng ảnh thật chụp tại spa.", 5);
      const hasH2 = /(^|\n)## /.test(it.content || "");
      add("h2", "Tiêu đề phụ (##)", hasH2 ? "good" : "warn", hasH2 ? "Nội dung có chia mục." : "Nên chia nội dung bằng tiêu đề phụ (dòng bắt đầu bằng ## ).", 5);
    }
    if (type === "services") {
      const ps = R.prices(it);
      add("price", "Bảng giá", ps.length ? "good" : "warn", ps.length ? `${ps.length} mức thời lượng.` : "Chưa có giá — khách và Google đều cần thông tin giá.", 5);
    }
    const dupT = (ctx.titles?.get(norm(m.title)) || 0) > 1, dupD = m.description && (ctx.descs?.get(norm(m.description)) || 0) > 1;
    if (ctx.titles) add("dup", "Không trùng trang khác", dupT || dupD ? "bad" : "good", dupT ? "Tiêu đề trùng trang khác." : dupD ? "Mô tả trùng trang khác." : "Tiêu đề và mô tả là duy nhất.", 5);

    const bad = CLAIMS_BAD.filter(w => all.includes(w)), soft = CLAIMS_SOFT.filter(w => all.includes(w));
    add("claims", "Ngôn từ an toàn", bad.length ? "bad" : soft.length ? "warn" : "good",
      bad.length ? `Có cụm từ cam kết chữa bệnh: “${bad.join("”, “")}”. Spa không được quảng cáo chữa bệnh — nên bỏ.` :
      soft.length ? `Có “${soft.join("”, “")}” — kiểm tra lại, tránh ngụ ý spa chữa được bệnh.` : "Không có cụm từ cam kết chữa bệnh.");
    if (type === "posts") {
      const src = (it.sources || []).filter(x => norm(x)).length;
      add("eeat", "Tác giả & nguồn", norm(it.author) && (src || norm(it.reviewer)) ? "good" : norm(it.author) ? "warn" : "bad",
        `${norm(it.author) ? "Tác giả: " + it.author : "Chưa có tác giả"} · ${src ? src + " nguồn tham khảo" : "chưa có nguồn tham khảo"}${it.reviewer ? " · Người duyệt: " + it.reviewer : ""}.`);
    }
    if (m.noindex) add("index", "Cho phép Google lập chỉ mục", "bad", seo.noindexAll ? "Đang chặn Google TOÀN website." : "Trang đang bật noindex.");

    const total = checks.reduce((s, c) => s + c.weight, 0), got = checks.reduce((s, c) => s + c.weight * (c.status === "good" ? 1 : c.status === "warn" ? .5 : 0), 0);
    return { type, item: it, meta: m, checks, words: wc, score: total ? Math.round(got / total * 100) : 0 };
  }

  /* ---------- Chấm toàn site ---------- */
  const PAGES = [["home", "/", "Trang chủ"], ["blog", "/bai-viet/", "Danh sách bài viết"]];
  function analyzeSite(data) {
    const seo = data.seo || {}, entries = [];
    for (const [key, path, label] of PAGES) entries.push(["page", { key, path, label, title: label, ...(seo.pages?.[key] || {}) }]);
    for (const it of R.assignSlugs(data.services)) entries.push(["services", it]);
    for (const it of R.assignSlugs(data.posts)) entries.push(["posts", it]);
    const titles = new Map(), descs = new Map();
    for (const [t, it] of entries) { const m = meta(t, it, seo); [[titles, m.title], [descs, m.description]].forEach(([map, v]) => v && map.set(norm(v), (map.get(norm(v)) || 0) + 1)); }
    return entries.map(([t, it]) => analyze(t, it, { seo, titles, descs }));
  }

  /* ---------- HTML dùng chung ---------- */
  const { esc } = R;
  const grade = s => s >= 80 ? "good" : s >= 50 ? "warn" : "bad";
  const gradeLabel = s => s >= 80 ? "Tốt" : s >= 50 ? "Cần cải thiện" : "Yếu";
  const cut = (s, n) => s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
  function snippetHTML(m) {
    const u = (m.url || "https://ten-mien-cua-ban" + m.path).replace(/^https?:\/\//, "").replace(/\/$/, "").split("/");
    return `<div class="sx-snippet"><div class="sx-site"><span class="sx-fav">T</span><span><b>${esc(u[0])}</b><small>${esc(u.join(" › "))}</small></span></div>
      <div class="sx-title">${esc(cut(m.title, 62))}</div><div class="sx-desc">${esc(cut(m.description || "(Google sẽ tự trích một đoạn trong trang)", 160))}</div></div>`;
  }
  const ICON = { good: "✓", warn: "!", bad: "✕" }, ORDER = { bad: 0, warn: 1, good: 2 };
  const checksHTML = r => `<ul class="sx-checks">${[...r.checks].sort((a, b) => ORDER[a.status] - ORDER[b.status]).map(c =>
    `<li class="${c.status}"><span class="sx-ic">${ICON[c.status]}</span><div><b>${esc(c.label)}</b><p>${esc(c.msg)}</p></div></li>`).join("")}</ul>`;
  const scoreHTML = s => `<span class="sx-score ${grade(s)}" title="${gradeLabel(s)}">${s}</span>`;

  const API = { analyze, analyzeSite, meta, snippetHTML, checksHTML, scoreHTML, grade, gradeLabel, esc, norm, PAGES };
  if (typeof module === "object" && module.exports) module.exports = API; else root.SEOCheck = API;
})(typeof window !== "undefined" ? window : globalThis);
