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
  CMS.registerPreviewTemplate("posts", listPreview("posts"));
  CMS.registerPreviewTemplate("seo", SettingsPreview);
})();
