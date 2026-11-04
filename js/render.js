/* =========================================================
   KHUÔN GIAO DIỆN DÙNG CHUNG — trình duyệt (main.js), trang quản trị và build.mjs
   Sửa mẫu thẻ liệu trình / hỏi đáp / ảnh ở đây thì mọi nơi cùng đổi.
   ========================================================= */
(function (root) {
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = n => (Number(n) || 0).toLocaleString("vi-VN") + "đ";
  const slugify = s => String(s ?? "").toLowerCase().replace(/đ/g, "d").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/, "");
  const absPath = p => !p ? "" : /^(https?:)?\/\//.test(p) || p.startsWith("/") || p.startsWith("data:") ? p : "/" + p;

  // Mỗi loại nội dung có đường dẫn riêng
  const SECTIONS = {
    services: { path: "/lieu-trinh/", label: "Liệu trình" },
    posts: { path: "/bai-viet/", label: "Bài viết" }
  };
  const nameOf = it => it.title || it.name || it.q || "";
  function assignSlugs(items) {
    const used = new Set();
    return (items || []).map(it => {
      let base = slugify(it.slug) || slugify(nameOf(it)) || slugify(it.id) || "trang", s = base, n = 2;
      while (used.has(s)) s = `${base}-${n++}`;
      used.add(s);
      return { ...it, slug: s };
    });
  }
  const urlFor = (type, it) => SECTIONS[type].path + it.slug + "/";

  // "Thả trôi *như dòng nước* về biển" -> chữ trong dấu * thành nghiêng
  const titleHTML = s => esc(s).replace(/\*([^*]+)\*/g, "<em>$1</em>");

  // Nội dung dài: dòng trống ngăn đoạn, "## " tiêu đề phụ, "- " danh sách
  function bodyHTML(text) {
    return String(text || "").split(/\n\s*\n/).map(b => b.trim()).filter(Boolean).map(b => {
      const lines = b.split("\n").map(l => l.trim());
      if (b.startsWith("### ")) return `<h3>${esc(b.slice(4))}</h3>`;
      if (b.startsWith("## ")) return `<h2>${esc(lines[0].slice(3))}</h2>` + (lines.length > 1 ? bodyHTML(lines.slice(1).join("\n")) : "");
      if (lines.every(l => /^[-•] /.test(l))) return `<ul>${lines.map(l => `<li>${esc(l.slice(2))}</li>`).join("")}</ul>`;
      return `<p>${esc(b).replace(/\n/g, "<br>")}</p>`;
    }).join("\n");
  }

  const ICONS = {
    neck: '<path d="M32 12a7 7 0 1 1 0 14 7 7 0 0 1 0-14Z"/><path d="M14 50c2-11 9-17 18-17s16 6 18 17"/>',
    back: '<path d="M32 12v40"/><path d="M24 18c-4 8-4 20 0 30M40 18c4 8 4 20 0 30"/>',
    head: '<circle cx="32" cy="28" r="12"/><path d="M18 48c4-3 9-4 14-4s10 1 14 4"/>',
    drop: '<path d="M32 10c6 8 10 14 10 20a10 10 0 0 1-20 0c0-6 4-12 10-20Z"/><path d="M14 50c4-3 8-3 12 0s8 3 12 0 8-3 12 0"/>',
    face: '<circle cx="32" cy="30" r="15"/><path d="M26 34c2 2 4 3 6 3s4-1 6-3M26 26h.1M38 26h.1"/>',
    star: '<path d="M32 10l5 12 13 1-10 8 3 13-11-7-11 7 3-13-10-8 13-1z"/>'
  };
  const ARTS = ["", "art-v2", "art-v3", "art-v4"];
  // min = 0 → gói không tính theo thời lượng ("Trọn gói")
  const prices = s => (s.prices || []).filter(p => p && (p.min || p.price)).map(p => ({ min: Number(p.min) || 0, price: Number(p.price) || 0 }));
  const durText = min => min ? `${min} phút` : "Trọn gói";
  const priceHTML = p => `<span class="price-label">Giá · ${durText(p.min)}</span><span class="price-num">${money(p.price).replace(/đ$/, "")}<sup>đ</sup></span>`;

  const groupId = name => "nhom-" + slugify(String(name || "").replace(/^dịch vụ\s+/i, ""));

  // Mục "Hôm nay, cơ thể bạn cần điều gì?" — mỗi thẻ dẫn tới một nhóm dịch vụ trong bảng giá
  const NEED_ICONS = {
    head: '<circle cx="32" cy="28" r="12"/><path d="M20 26c4-4 8-6 12-6s8 2 12 6"/><path d="M18 48c4-3 9-4 14-4s10 1 14 4" class="glow"/><path d="M24 52c2-1 5-2 8-2s6 1 8 2" class="glow"/>',
    drop: '<path d="M32 10c6 8 10 14 10 20a10 10 0 0 1-20 0c0-6 4-12 10-20Z"/><path d="M14 48c4-3 8-3 12 0s8 3 12 0 8-3 12 0" class="glow"/><path d="M18 55c3-2 6-2 9 0s6 2 9 0 6-2 9 0" class="glow"/>',
    body: '<circle cx="32" cy="12" r="5"/><path d="M25 22c2-1.5 4.5-2 7-2s5 .5 7 2"/><path d="M25 22c-2 5-4 10-6 15M39 22c2 5 4 10 6 15"/><path d="M27 24c0 6 1 11 1 16l-2 14M37 24c0 6-1 11-1 16l2 14M32 44v10"/><path d="M13 26c-2 4-2 9 0 13M51 26c2 4 2 9 0 13" class="glow"/>',
    neck: '<path d="M32 14a7 7 0 1 1 0 14 7 7 0 0 1 0-14Z"/><path d="M14 50c2-11 9-17 18-17s16 6 18 17"/><path d="M20 36c3 2 7 3 12 3s9-1 12-3" class="glow"/>',
    back: '<path d="M32 12v40"/><path d="M24 18c-4 8-4 20 0 30M40 18c4 8 4 20 0 30"/><path d="M27 24h10M26 32h12M27 40h10" class="glow"/>',
    face: '<circle cx="32" cy="30" r="14"/><path d="M26 34c2 2 4 3 6 3s4-1 6-3"/><path d="M14 26c-3 3-3 9 0 12M50 26c3 3 3 9 0 12" class="glow"/><path d="M27 26h.1M37 26h.1"/>',
    star: '<path d="M32 10l5 12 13 1-10 8 3 13-11-7-11 7 3-13-10-8 13-1z"/><path d="M14 52c4-3 8-3 12 0s8 3 12 0 8-3 12 0" class="glow"/>'
  };
  const needsHTML = items => (items || []).map((n, i) => {
    const id = n.group ? groupId(n.group) : "bang-gia";
    return `<a class="need" href="#${id}" data-pick="${id}">
            <span class="orb orb-${i % 4 + 1}"><svg viewBox="0 0 64 64" aria-hidden="true">${NEED_ICONS[n.icon] || NEED_ICONS.drop}</svg></span>
            <h3>${esc(n.title)}</h3>
            <p>${esc(n.desc)}</p>
          </a>`;
  }).join("");

  // Bảng giá chia nhóm theo trường "group" (giữ thứ tự xuất hiện)
  function servicesHTML(list) {
    const groups = [];
    (list || []).forEach(s => {
      const name = s.group || "Liệu trình khác";
      let g = groups.find(x => x.name === name);
      if (!g) groups.push(g = { name, items: [] });
      g.items.push(s);
    });
    let i = 0;
    return groups.map(g => `<div class="svc-group" id="${groupId(g.name)}"><h3 class="svc-group-title">${esc(g.name)}</h3>
      <div class="services">${g.items.map(s => serviceCard(s, i++)).join("")}</div></div>`).join("");
  }

  function serviceCard(s, i = 0) {
    const ps = prices(s), first = ps[0] || { min: 0, price: 0 };
    const media = s.img ? `<img src="${esc(absPath(s.img))}" alt="${esc(s.name)}" loading="lazy">` : `<svg viewBox="0 0 64 64" aria-hidden="true">${ICONS[s.icon] || ICONS.drop}</svg>`;
    return `<article class="svc" id="svc-${esc(s.id)}" data-id="${esc(s.id)}">
      <a class="svc-art art ${ARTS[i % ARTS.length]}" href="${urlFor("services", s)}">${s.tag ? `<span class="svc-tag">${esc(s.tag)}</span>` : ""}${media}</a>
      <div class="svc-body">
        <h3><a href="${urlFor("services", s)}">${esc(s.name)}</a></h3>
        <p>${esc(s.desc)}</p>
        <div class="durations" role="group" aria-label="Chọn thời lượng">${ps.map((p, k) => `<button type="button" data-min="${p.min}" class="${k ? "" : "on"}">${durText(p.min)}</button>`).join("")}</div>
        <div class="svc-foot"><span class="price" data-price>${priceHTML(first)}</span>
          <a href="/#dat-lich" class="btn btn-navy btn-sm" data-book="${esc(s.id)}">Đặt lịch</a></div>
      </div></article>`;
  }

  const faqHTML = items => (items || []).map((f, i) => `<details${i ? "" : " open"}><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("");
  const GALLERY_ART = ["g1", "g2", "g3", "g4", "g5"];
  const galleryHTML = items => (items || []).slice(0, 5).map((g, i) =>
    `<figure class="art ${GALLERY_ART[i]}">${g.img ? `<img src="${esc(absPath(g.img))}" alt="${esc(g.caption)}" loading="lazy">` : ""}<figcaption>${esc(g.caption)}</figcaption></figure>`).join("");
  const postCard = (p, i = 0) => `<article class="post"><a class="post-art art ${ARTS[(i + 1) % ARTS.length]}" href="${urlFor("posts", p)}">${p.img ? `<img src="${esc(absPath(p.img))}" alt="${esc(p.title)}" loading="lazy">` : ""}</a>
    <div class="post-body"><span class="post-date">${esc(p.date)}</span><h3><a href="${urlFor("posts", p)}">${esc(p.title)}</a></h3><p>${esc(p.excerpt)}</p>
    <a class="link-more" href="${urlFor("posts", p)}">Đọc tiếp →</a></div></article>`;

  const API = { esc, money, slugify, absPath, SECTIONS, nameOf, assignSlugs, urlFor, titleHTML, bodyHTML, ICONS, prices, durText, priceHTML, servicesHTML, needsHTML, serviceCard, faqHTML, galleryHTML, postCard };
  if (typeof module === "object" && module.exports) module.exports = API; else root.Render = API;
})(typeof window !== "undefined" ? window : globalThis);
