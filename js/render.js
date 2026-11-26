/* =========================================================
   KHUÔN GIAO DIỆN DÙNG CHUNG — trình duyệt (main.js), trang quản trị và build.mjs
   Sửa mẫu thẻ liệu trình / hỏi đáp / ảnh ở đây thì mọi nơi cùng đổi.
   ========================================================= */
(function (root) {
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = n => Number(n) ? Number(n).toLocaleString("vi-VN") + "đ" : "Liên hệ";   // giá 0 / trống = Liên hệ
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

  // Định dạng trong dòng (Markdown của trình soạn thảo): **đậm**, _nghiêng_, [link](url), ![ảnh](url), `mã`
  const safeURL = u => /^(https?:|mailto:|tel:|\/|#)/i.test(u.trim()) ? u.trim() : "#";
  function inlineMD(s) {
    const keep = [];
    let t = String(s).replace(/\\([\\`*_{}\[\]()#+\-.!>|~])/g, (m, c) => `\u0000${keep.push(c) - 1}\u0000`);
    t = esc(t)
      .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (m, a, u) => `<img src="${safeURL(u)}" alt="${a}" loading="lazy">`)
      .replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (m, x, u) => { const h = safeURL(u); return `<a href="${h}"${/^https?:/i.test(h) ? ' target="_blank" rel="noopener"' : ""}>${x}</a>`; })
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*(.+?)\*\*|__(.+?)__/g, (m, a, b) => `<strong>${a || b}</strong>`)
      .replace(/(^|[^\w*])\*(?!\s)(.+?)\*(?!\w)|(^|[^\w_])_(?!\s)(.+?)_(?!\w)/g, (m, p1, a, p2, b) => `${p1 ?? p2 ?? ""}<em>${a ?? b}</em>`);
    return t.replace(/\u0000(\d+)\u0000/g, (m, i) => esc(keep[i]));
  }

  // Nội dung dài: dòng trống ngăn đoạn, "## " tiêu đề phụ, "- " / "1. " danh sách, "> " trích dẫn
  function bodyHTML(text) {
    return String(text || "").replace(/\r/g, "").split(/\n\s*\n/).map(b => b.trim()).filter(Boolean).map(b => {
      const lines = b.split("\n").map(l => l.trim());
      const h = /^(#{1,4})\s+(.*)$/.exec(lines[0]);
      if (h) { const lv = Math.max(2, h[1].length); return `<h${lv}>${inlineMD(h[2])}</h${lv}>` + (lines.length > 1 ? bodyHTML(lines.slice(1).join("\n")) : ""); }
      if (/^(-{3,}|\*{3,})$/.test(b)) return "<hr>";
      if (lines.every(l => /^[-•*+] /.test(l))) return `<ul>${lines.map(l => `<li>${inlineMD(l.slice(2))}</li>`).join("")}</ul>`;
      if (lines.every(l => /^\d+[.)] /.test(l))) return `<ol>${lines.map(l => `<li>${inlineMD(l.replace(/^\d+[.)] /, ""))}</li>`).join("")}</ol>`;
      if (lines.every(l => l.startsWith(">"))) return `<blockquote>${bodyHTML(lines.map(l => l.replace(/^>\s?/, "")).join("\n"))}</blockquote>`;
      if (lines.length === 1 && /^!\[[^\]]*\]\([^)]+\)$/.test(b)) return `<figure>${inlineMD(b)}</figure>`;
      return `<p>${lines.map(inlineMD).join("<br>")}</p>`;
    }).join("\n");
  }

  // Bài viết: chọn "Trình soạn thảo" (Markdown) hoặc "HTML" trong admin
  const cleanHTML = h => String(h || "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<(iframe|object|embed)\b(?![^>]*\bsrc="https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com|player\.vimeo\.com|www\.google\.com\/maps))[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "").replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"');
  const isHTMLPost = p => p && p.mode === "html" && String(p.html || "").trim();
  const postBodyHTML = p => isHTMLPost(p) ? cleanHTML(p.html) : bodyHTML(p && p.content);
  const postText = p => isHTMLPost(p) ? String(p.html).replace(/<(h[1-6])\b[^>]*>/gi, "\n\n## ").replace(/<\/(p|div|h[1-6]|li|ul|ol|blockquote)>|<br\s*\/?>/gi, "\n\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*/g, "\n\n").trim()
    : String((p && p.content) || "").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_`\\]/g, "");

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
  const priceHTML = p => `<span class="price-label">Giá · ${durText(p.min)}</span><span class="price-num">${p.price ? `${money(p.price).replace(/đ$/, "")}<sup>đ</sup>` : "Liên hệ"}</span>`;

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

  // Gom liệu trình theo nhóm (giữ thứ tự xuất hiện)
  function groupsOf(list) {
    const groups = [];
    (list || []).forEach(s => {
      const name = s.group || "Liệu trình khác";
      let g = groups.find(x => x.name === name);
      if (!g) groups.push(g = { name, items: [] });
      g.items.push(s);
    });
    return groups;
  }
  const shortGroup = name => String(name || "").replace(/^dịch vụ\s+/i, "").replace(/^./, c => c.toUpperCase());

  // TRANG CHỦ: mỗi nhóm 1 thẻ liệu trình tiêu biểu (ưu tiên liệu trình có nhãn: Phổ biến, Đặc trưng…), cùng kiểu thẻ trang /bang-gia/
  const featuredHTML = list => `<div class="services">${groupsOf(list).map((g, i) => {
    const s = g.items.find(x => x.tag) || g.items[0];
    return `<div class="svc-slot" id="${groupId(g.name)}"><a class="svc-slot-k" href="/bang-gia/#${groupId(g.name)}">${esc(shortGroup(g.name))} · ${g.items.length} liệu trình</a>${serviceCard(s, i)}</div>`;
  }).join("")}</div>`;

  // TRANG /bang-gia/: thanh chọn nhóm + thẻ liệu trình giống bảng giá trang chủ cũ (chọn thời lượng, đặt lịch)
  function pricingHTML(list) {
    const groups = groupsOf(list);
    const nav = `<nav class="pl-nav" aria-label="Nhóm dịch vụ">${groups.map(g => `<a href="#${groupId(g.name)}">${esc(shortGroup(g.name))}<small>${g.items.length}</small></a>`).join("")}</nav>`;
    return nav + `<div class="svc-groups" id="services">${servicesHTML(list)}</div>`;
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

  /* ---------- Nút liên hệ nổi (Zalo, gọi, mạng xã hội) — bật/tắt trong admin → site.socials ---------- */
  const S_ICON = {
    phone: `<svg viewBox="0 0 24 24" class="st"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/></svg>`,
    messenger: `<svg viewBox="0 0 24 24"><path d="M12 2C6.4 2 2 6.1 2 11.4c0 2.9 1.3 5.4 3.5 7.1V22l3.2-1.8c1 .3 2.1.4 3.3.4 5.6 0 10-4.1 10-9.3S17.6 2 12 2Zm1.1 12.4-2.6-2.8-5 2.8 5.5-5.9 2.7 2.8 4.9-2.8-5.5 5.9Z"/></svg>`,
    facebook: `<svg viewBox="0 0 24 24"><path d="M14 8h3V4h-3c-2.8 0-4.5 1.8-4.5 4.6V11H7v4h2.5v7h4v-7H17l.5-4h-4V8.8c0-.5.2-.8.5-.8Z"/></svg>`,
    tiktok: `<svg viewBox="0 0 24 24"><path d="M16.5 3c.3 2.2 1.7 3.6 3.9 3.8v3.3c-1.4 0-2.7-.4-3.9-1.1v5.9c0 3.5-2.6 5.9-5.8 5.9A5.6 5.6 0 0 1 5 15.2c0-3.3 2.8-5.9 6.3-5.6v3.4c-1.5-.3-3 .8-3 2.3 0 1.3 1.1 2.3 2.4 2.3 1.4 0 2.4-1 2.4-2.6V3h3.4Z"/></svg>`,
    instagram: `<svg viewBox="0 0 24 24" class="st"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.3" cy="6.7" r="1.1" class="dot"/></svg>`,
    youtube: `<svg viewBox="0 0 24 24"><path d="M21.6 7.2a2.6 2.6 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.6 2.6 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8c.2.9.9 1.6 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4c.9-.2 1.6-.9 1.8-1.8.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8ZM10 15V9l5.2 3L10 15Z"/></svg>`,
    whatsapp: `<svg viewBox="0 0 24 24"><path d="M12 2a9.9 9.9 0 0 0-8.6 14.9L2 22l5.3-1.4A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3.1.8.8-3-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>`,
    telegram: `<svg viewBox="0 0 24 24"><path d="M21.5 3.5 2.8 10.8c-.9.4-.9 1.6.1 1.9l4.6 1.5 1.8 5.6c.2.7 1.1.9 1.6.4l2.6-2.5 4.8 3.5c.6.4 1.4.1 1.6-.6l3.3-15.6c.2-.9-.7-1.7-1.6-1.3ZM9.6 14.4l8.3-7.6-6.6 8.6-.3 3.1-1.4-4.1Z"/></svg>`,
    email: `<svg viewBox="0 0 24 24" class="st"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/></svg>`,
    maps: `<svg viewBox="0 0 24 24"><path d="M12 2a7.5 7.5 0 0 0-7.5 7.5C4.5 15 12 22 12 22s7.5-7 7.5-12.5A7.5 7.5 0 0 0 12 2Zm0 10.2a2.7 2.7 0 1 1 0-5.4 2.7 2.7 0 0 1 0 5.4Z"/></svg>`
  };
  const SOCIAL = {
    zalo: { label: "Nhắn Zalo", text: "Zalo" }, phone: { label: "Gọi điện" }, messenger: { label: "Nhắn Messenger" }, facebook: { label: "Facebook" },
    tiktok: { label: "TikTok" }, instagram: { label: "Instagram" }, youtube: { label: "YouTube" }, whatsapp: { label: "Nhắn WhatsApp" },
    telegram: { label: "Nhắn Telegram" }, kakaotalk: { label: "Nhắn KakaoTalk", text: "TALK" }, email: { label: "Gửi email" }, maps: { label: "Chỉ đường Google Maps" }
  };
  // Link mặc định khi để trống: Zalo/gọi/email/bản đồ lấy từ thông tin liên hệ
  const socialURL = (s, site) => {
    const u = String(s.url || "").trim();
    if (u) return s.net === "phone" && !/^tel:/.test(u) ? "tel:" + u.replace(/[^\d+]/g, "") : s.net === "email" && !/^mailto:/.test(u) ? "mailto:" + u : u;
    return { zalo: site.zaloLink || (site.zalo ? "https://zalo.me/" + site.zalo : ""), phone: site.phone ? "tel:" + String(site.phone).replace(/[^\d+]/g, "") : "",
      email: site.email ? "mailto:" + site.email : "", maps: site.mapUrl || "", facebook: site.facebook || "" }[s.net] || "";
  };
  const DEFAULT_SOCIALS = [{ net: "zalo", on: true }, { net: "phone", on: true }];
  const socialsHTML = (site = {}) => (Array.isArray(site.socials) && site.socials.length ? site.socials : DEFAULT_SOCIALS)
    .filter(s => s && s.on !== false && SOCIAL[s.net]).map(s => ({ ...s, href: socialURL(s, site) })).filter(s => s.href)
    .map(s => { const d = SOCIAL[s.net], ext = !/^(tel|mailto):/.test(s.href);
      return `<a class="fc ${s.net}" href="${esc(s.href)}"${ext ? ' target="_blank" rel="noopener"' : ""} aria-label="${esc(d.label)}" title="${esc(d.label)}">${d.text ? `<span>${d.text}</span>` : S_ICON[s.net].replace("<svg", '<svg aria-hidden="true"')}</a>`; }).join("");

  const API = { esc, money, slugify, absPath, SECTIONS, nameOf, assignSlugs, urlFor, titleHTML, bodyHTML, inlineMD, postBodyHTML, postText, ICONS, prices, durText, priceHTML, servicesHTML, needsHTML, serviceCard, featuredHTML, pricingHTML, groupId, faqHTML, galleryHTML, postCard, socialsHTML, socialURL, SOCIAL };
  if (typeof module === "object" && module.exports) module.exports = API; else root.Render = API;
})(typeof window !== "undefined" ? window : globalThis);
