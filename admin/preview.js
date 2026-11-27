/* =========================================================
   KHUNG XEM TRƯỚC SEO TRONG DECAP CMS — điểm SEO, bản xem trước Google
   và việc cần sửa, cập nhật ngay khi gõ.
   ========================================================= */
(function () {
  const { analyze, snippetHTML, checksHTML, scoreHTML, esc, norm, PAGES } = SEOCheck;
  const toJS = v => (v && v.toJS ? v.toJS() : v) || {};
  const LABEL = { services: "liệu trình", posts: "bài viết" };
  let SETTINGS = {};
  fetch("/data/seo.json", { cache: "no-cache" }).then(r => r.ok ? r.json() : {}).then(s => { SETTINGS = s; }).catch(() => {});

  const dupMaps = rs => {
    const titles = new Map(), descs = new Map();
    rs.forEach(r => [[titles, r.meta.title], [descs, r.meta.description]].forEach(([m, v]) => v && m.set(norm(v), (m.get(norm(v)) || 0) + 1)));
    return { titles, descs };
  };
  const block = (r, name, open) => `<details class="sx-item"${open ? " open" : ""}><summary>${scoreHTML(r.score)}<span class="sx-name">${esc(name || "(chưa đặt tên)")}</span><small>${esc(r.meta.path)}</small></summary>
    <div class="sx-body">${snippetHTML(r.meta)}${checksHTML(r)}</div></details>`;
  const box = html => h("div", { className: "sx-preview", dangerouslySetInnerHTML: { __html: html } });

  const listPreview = type => createClass({
    render() {
      const items = Render.assignSlugs(toJS(this.props.entry.get("data")).items || []);
      const first = items.map(it => analyze(type, it, { seo: SETTINGS }));
      const rs = items.map(it => analyze(type, it, { seo: SETTINGS, ...dupMaps(first) }));
      const avg = rs.length ? Math.round(rs.reduce((s, r) => s + r.score, 0) / rs.length) : 0;
      return box(`<h2>Điểm SEO — ${rs.length} ${LABEL[type]} · trung bình ${scoreHTML(avg)}</h2>
        <p class="sx-lead">Bấm vào từng mục để xem bản xem trước trên Google và việc cần sửa.</p>
        ${rs.map((r, i) => block(r, r.item.name || r.item.title, rs.length === 1 || i === rs.length - 1)).join("")}`);
    }
  });

  const SettingsPreview = createClass({
    render() {
      const seo = toJS(this.props.entry.get("data")); SETTINGS = seo;
      const pages = PAGES.map(([key, path, label]) => ({ key, path, label, title: label, ...(seo.pages?.[key] || {}) }));
      const rs = pages.map(p => analyze("page", p, { seo }));
      return box(`<h2>Trang chủ & trang bài viết</h2><p class="sx-lead">Tiêu đề và mô tả hiển thị trên Google.</p>${rs.map(r => block(r, r.item.label)).join("")}`);
    }
  });

  CMS.registerPreviewStyle("/admin/seo-admin.css");
  CMS.registerPreviewTemplate("services", listPreview("services"));
  // Bài viết: mỗi bài 1 trang sửa riêng → chấm điểm riêng bài đang sửa (so trùng với các bài đã đăng)
  let PUBLISHED = [];
  fetch("/data/posts.json", { cache: "no-cache" }).then(r => r.ok ? r.json() : {}).then(d => { PUBLISHED = d.items || []; }).catch(() => {});
  /* ---------- Xem trước bài viết đúng giao diện website (trước khi bấm Công bố) ----------
     Lấy khung trang (đầu trang, menu, chân trang, CSS) từ 1 trang bài viết đang chạy, thay phần nội dung bằng bài đang soạn. */
  let FRAME = null;
  const loadFrame = () => FRAME || (FRAME = fetch("/bai-viet/", { cache: "no-cache" }).then(r => r.text()).then(t => {
    const head = t.slice(0, t.indexOf('<main id="top">')), foot = t.slice(t.indexOf("</main>") + 7);
    // Bỏ script của trang (không cần trong bản xem trước) nên tự gắn lớp "scrolled" cho đầu trang như main.js vẫn làm ở trang con
    return { head: head.replace(/<title>[\s\S]*?<\/title>/, "").replace("<head>", `<head><base href="${location.origin}/">`).replace(/class="header"/, 'class="header scrolled"'), foot: foot.replace(/<script[\s\S]*?<\/script>/g, "") };
  }).catch(() => ({ head: `<!DOCTYPE html><html lang="vi"><head><base href="${location.origin}/"><link rel="stylesheet" href="/css/style.css"></head><body class="subpage">`, foot: "</body></html>" })));
  loadFrame();
  const e2 = s => esc(String(s ?? ""));
  function articleDoc(p, frame, asset) {
    const img = p.img ? asset(p.img) : "", src = (p.sources || []).filter(Boolean);
    const body = Render.postBodyHTML(p).replace(/(<img\b[^>]*\bsrc=")([^"]+)"/g, (m, a, s) => a + asset(s) + '"');
    const main = `<main id="top">
      <section class="page-hero"><div class="galaxy" aria-hidden="true"></div><div class="wrap">
        <nav class="crumb" aria-label="breadcrumb"><a href="/">Trang chủ</a> / <a href="/bai-viet/">Bài viết</a> / <span>${e2(p.title || "(Chưa có tiêu đề)")}</span></nav>
        <h1>${e2(p.title || "(Chưa có tiêu đề)")}</h1>
        <div class="meta"><span>${e2(p.author || "Thiên Hà Wellness")}</span>${p.date ? `<span>Đăng ${e2(p.date)}</span>` : ""}${p.updated ? `<span>Cập nhật ${e2(p.updated)}</span>` : ""}${p.category ? `<span>${e2(p.category)}</span>` : ""}</div>
      </div></section>
      <section class="section"><div class="wrap"><div class="detail"><article class="prose">
        ${img ? `<figure><img src="${e2(img)}" alt="${e2(p.title)}" width="1200" height="675"></figure>` : ""}${body || "<p><em>Chưa có nội dung.</em></p>"}
        ${p.reviewer ? `<p><em>Nội dung được tham vấn bởi ${e2(p.reviewer)}.</em></p>` : ""}
        ${src.length ? `<h2>Nguồn tham khảo</h2><ol>${src.map(x => `<li>${e2(x)}</li>`).join("")}</ol>` : ""}
        <div class="disclaimer">Thông tin mang tính tham khảo, không thay thế tư vấn y khoa.</div></article>
        <aside class="side"><div class="side-card"><h3>Đặt lịch thư giãn</h3><p>Dành một chút thời gian cho cơ thể bạn tại Thiên Hà Wellness.</p><a class="btn btn-navy" href="/#dat-lich">Đặt lịch</a></div></aside>
      </div></div></section></main>`;
    return `${frame.head.replace("<head>", `<head><title>Xem trước: ${e2(p.title)}</title>`)}${main}
      <div style="position:fixed;left:12px;bottom:12px;z-index:999;padding:7px 14px;border-radius:999px;background:#b8913a;color:#fff;font:600 12px system-ui;box-shadow:0 4px 14px rgba(0,0,0,.25)">BẢN XEM TRƯỚC · chưa đăng lên website</div>
      <style>.reveal{opacity:1!important;transform:none!important}</style>${frame.foot}`;
  }

  /* Nút "Xem trước" / "Điểm SEO" kiểu WordPress (admin/editor.js gọi): mở tab mới, không chiếm chỗ màn hình soạn */
  const toAsset = getAsset => path => {
    if (!path || /^(https?:|data:|blob:)/.test(path)) return path || "";
    try { const a = getAsset && getAsset(path); const u = a && a.toString(); if (u && u !== "[object Object]") return u; } catch {}
    return Render.absPath(path);
  };
  const curPost = (data, file) => {
    const others = Render.assignSlugs(PUBLISHED.filter(o => o._file !== file));
    const [cur] = Render.assignSlugs([{ ...data, id: data.id || file || "moi" }]);
    return { cur, r: analyze("posts", cur, { seo: SETTINGS, ...dupMaps([...others, cur].map(x => analyze("posts", x, { seo: SETTINGS }))) }) };
  };
  const openDoc = html => { const w = window.open("", "_blank"); if (!w) { alert("Trình duyệt đang chặn cửa sổ mới. Hãy cho phép cửa sổ bật lên (pop-up) cho trang quản trị."); return; } w.document.open(); w.document.write(html); w.document.close(); };
  window.TH_PREVIEW = {
    score: (data, file) => curPost(toJS(data), file).r.score,
    async article(data, getAsset, file) {
      const w = window.open("", "_blank");
      if (!w) { alert("Trình duyệt đang chặn cửa sổ mới. Hãy cho phép cửa sổ bật lên (pop-up) cho trang quản trị."); return; }
      w.document.write("<p style='font:16px system-ui;padding:30px'>Đang tạo bản xem trước…</p>");
      const frame = await loadFrame();
      w.document.open(); w.document.write(articleDoc(curPost(toJS(data), file).cur, frame, toAsset(getAsset))); w.document.close();
    },
    seo(data, file) {
      const { cur, r } = curPost(toJS(data), file);
      openDoc(`<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>Điểm SEO: ${e2(cur.title)}</title><link rel="stylesheet" href="${location.origin}/admin/seo-admin.css">
        <style>body{margin:0;background:#f3f6f8;font-family:system-ui,sans-serif}.sx-preview{max-width:860px;margin:0 auto;padding:24px}</style></head>
        <body><div class="sx-preview"><h2>Điểm SEO của bài này ${scoreHTML(r.score)}</h2><p class="sx-lead">Tính theo nội dung đang soạn (chưa cần bấm Công bố). Sửa xong bấm lại nút “Điểm SEO” để chấm lại.</p>${block(r, cur.title, true)}</div></body></html>`);
    }
  };

  // Khung xem trước của Bài viết được ẩn (admin/editor.js) — chỉ dùng để luôn nắm nội dung MỚI NHẤT đang soạn
  // cho nút "Xem trước" và "Điểm SEO" kiểu WordPress ở dưới tiêu đề.
  const PostLatest = createClass({
    render() {
      window.__TH_LATEST = { data: this.props.entry.get("data"), file: this.props.entry.get("slug"), getAsset: this.props.getAsset };
      setTimeout(() => window.dispatchEvent(new Event("th-post-change")), 0);
      return h("div", null);
    }
  });

  const PostPreview = createClass({
    getInitialState() { return { tab: "view", frame: null }; },
    componentDidMount() { loadFrame().then(frame => this.setState({ frame })); },
    asset(path) {
      if (!path || /^(https?:|data:|blob:)/.test(path)) return path || "";
      try { const a = this.props.getAsset && this.props.getAsset(path); const u = a && a.toString(); if (u && u !== "[object Object]") return u; } catch {}
      return Render.absPath(path);
    },
    openFull(doc) { const w = window.open("", "_blank"); if (w) { w.document.open(); w.document.write(doc); w.document.close(); } },
    render() {
      const it = toJS(this.props.entry.get("data")), self = this.props.entry.get("slug");
      const others = Render.assignSlugs(PUBLISHED.filter(o => o._file !== self));
      const [cur] = Render.assignSlugs([{ ...it, id: it.id || self || "moi" }]);
      const r = analyze("posts", cur, { seo: SETTINGS, ...dupMaps([...others, cur].map(x => analyze("posts", x, { seo: SETTINGS }))) });
      const tab = this.state.tab, doc = this.state.frame ? articleDoc(cur, this.state.frame, p => this.asset(p)) : "";
      const tabBtn = (k, label) => h("button", { type: "button", onClick: () => this.setState({ tab: k }),
        style: { padding: "7px 14px", border: "1px solid #c7d2db", borderBottom: tab === k ? "2px solid #0d2440" : "1px solid #c7d2db", borderRadius: "6px 6px 0 0", background: tab === k ? "#fff" : "#eef3f6", fontWeight: tab === k ? 700 : 500, color: "#0d2440", cursor: "pointer", font: "inherit" } }, label);
      return h("div", { style: { fontFamily: "system-ui, sans-serif" } },
        h("div", { style: { display: "flex", gap: 6, alignItems: "flex-end", padding: "10px 12px 0", borderBottom: "1px solid #c7d2db", background: "#f3f6f8", position: "sticky", top: 0, zIndex: 5 } },
          tabBtn("view", "👁 Xem trước bài viết"), tabBtn("seo", `Điểm SEO · ${r.score}`),
          h("span", { style: { flex: 1 } }),
          tab === "view" && doc ? h("button", { type: "button", onClick: () => this.openFull(doc), style: { marginBottom: 6, marginRight: 64, padding: "6px 12px", border: 0, borderRadius: 6, background: "#0d2440", color: "#fff", cursor: "pointer", font: "inherit", fontWeight: 600 } }, "Mở toàn màn hình ↗") : null),
        tab === "view"
          ? (doc ? h("iframe", { title: "Xem trước bài viết", srcDoc: doc, style: { width: "100%", height: "calc(100vh - 120px)", border: 0, display: "block", background: "#fff" } })
                 : h("p", { style: { padding: 20 } }, "Đang tải giao diện website…"))
          : box(`<h2>Điểm SEO của bài này ${scoreHTML(r.score)}</h2><p class="sx-lead">Điểm cập nhật ngay khi bạn gõ.</p>${block(r, cur.title, true)}`));
    }
  });
  CMS.registerPreviewTemplate("posts", PostLatest);
  CMS.registerPreviewTemplate("seo", SettingsPreview);
})();
