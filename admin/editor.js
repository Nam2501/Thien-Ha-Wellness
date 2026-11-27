/* =========================================================
   Ô SOẠN BÀI KIỂU WORDPRESS cho trang quản trị (Decap CMS)
   - Tab "Trực quan": soạn như Word (in đậm, tiêu đề, danh sách, link, ảnh…)
   - Tab "Mã": sửa thẳng HTML, thanh nút chèn thẻ b, i, link, b-quote, del, ins, img, ul, ol, li, code
   Hai tab dùng CHUNG một nội dung HTML (lưu vào ô "html" của bài).
   Kèm ô "Đường dẫn" hiển thị địa chỉ đầy đủ của bài + nút Chỉnh sửa.
   ========================================================= */
(function () {
  const style = document.createElement("style");
  style.textContent = `
  .wpe { border: 1px solid #dcdcde; border-radius: 6px; background: #fff; overflow: hidden; font: 14px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; }
  .wpe-top { display: flex; justify-content: space-between; align-items: flex-end; gap: 8px; padding: 8px 8px 0; background: #f6f7f7; border-bottom: 1px solid #dcdcde; }
  .wpe-media { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 8px; padding: 6px 12px; border: 1px solid #2271b1; border-radius: 4px; background: #fff; color: #2271b1; font-weight: 600; cursor: pointer; }
  .wpe-media:hover { background: #f0f6fc; }
  .wpe-tabs { display: flex; gap: 2px; }
  .wpe-tab { padding: 6px 12px; border: 1px solid #dcdcde; border-bottom: 0; border-radius: 4px 4px 0 0; background: #ebebeb; color: #50575e; cursor: pointer; font-size: 13px; }
  .wpe-tab.on { background: #fff; color: #1d2327; font-weight: 600; position: relative; top: 1px; }
  .wpe-bar { display: flex; flex-wrap: wrap; gap: 4px; padding: 6px 8px; border-bottom: 1px solid #dcdcde; background: #fff; }
  .wpe-bar button { min-width: 28px; padding: 3px 8px; border: 1px solid #c3c4c7; border-radius: 3px; background: #f6f7f7; color: #2271b1; font: 13px/1.4 system-ui, sans-serif; cursor: pointer; }
  .wpe-bar button:hover { background: #fff; border-color: #2271b1; }
  .wpe-bar .sep { width: 1px; background: #dcdcde; margin: 0 4px; }
  .wpe-visual { min-height: 420px; max-height: 70vh; overflow: auto; padding: 16px 20px; outline: none; color: #1d2327; }
  .wpe-visual h2 { font-size: 1.45em; margin: 1.2em 0 .5em; } .wpe-visual h3 { font-size: 1.2em; margin: 1em 0 .4em; }
  .wpe-visual img { max-width: 100%; height: auto; } .wpe-visual blockquote { margin: 1em 0; padding: 6px 14px; border-left: 4px solid #c3c4c7; color: #50575e; }
  .wpe-visual table { border-collapse: collapse; } .wpe-visual td, .wpe-visual th { border: 1px solid #dcdcde; padding: 4px 8px; }
  .wpe-code { display: block; width: 100%; min-height: 420px; max-height: 70vh; padding: 12px 14px; border: 0; outline: none; resize: vertical; font: 13px/1.6 Consolas, Monaco, monospace; color: #1d2327; white-space: pre-wrap; }
  .wpe-foot { padding: 4px 10px; border-top: 1px solid #dcdcde; background: #f6f7f7; color: #646970; font-size: 12px; }
  .wpe-slug { font: 13px/1.6 system-ui, sans-serif; color: #50575e; padding: 6px 0; }
  .wpe-slug a { color: #2271b1; word-break: break-all; }
  .wpe-slug button { margin-left: 6px; padding: 2px 8px; border: 1px solid #2271b1; border-radius: 3px; background: #fff; color: #2271b1; font-size: 12px; cursor: pointer; }
  .wpe-slug input { font: inherit; padding: 3px 6px; border: 1px solid #8c8f94; border-radius: 3px; min-width: 260px; }
  .wpe-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 10px; }
  .wpe-slug .wpe-preview { margin: 0; padding: 7px 16px; border: 1px solid #2271b1; border-radius: 4px; background: #2271b1; color: #fff; font: 600 13px system-ui, sans-serif; cursor: pointer; }
  .wpe-slug .wpe-preview:hover { background: #135e96; }
  .wpe-slug .wpe-seo { margin: 0; padding: 6px 14px; border: 1px solid; border-radius: 4px; background: #fff; font: 600 13px system-ui, sans-serif; cursor: pointer; }
  .wpe-tip { color: #8c8f94; font-size: 12px; }
  .wpe { position: relative; }
  .wpe-visual figure.th-img { margin: 1em 0; } .wpe-visual figure.th-img img { height: auto; }
  .wpe-visual figure.align-center { text-align: center; } .wpe-visual figure.align-left { float: left; margin: .3em 1.2em 1em 0; max-width: 50%; }
  .wpe-visual figure.align-right { float: right; margin: .3em 0 1em 1.2em; max-width: 50%; } .wpe-visual figcaption { font-size: 13px; color: #646970; text-align: center; }
  .wpe-visual img.wpe-sel { outline: 3px solid #2271b1; }
  .wpe-imgbtn { position: absolute; z-index: 5; padding: 5px 10px; border: 0; border-radius: 4px; background: #1d2327; color: #fff; font: 600 12px system-ui, sans-serif; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,.3); }
  .thi { display: flex; gap: 14px; align-items: flex-start; padding: 10px; border: 1px solid #dcdcde; border-radius: 6px; background: #fff; font: 13px/1.5 system-ui, sans-serif; color: #50575e; }
  .thi img { width: 160px; height: 100px; object-fit: cover; background: #f0f0f1; border: 1px solid #dcdcde; }
  .thi b { color: #1d2327; } .thi .row { display: flex; gap: 8px; margin-top: 8px; }
  .thi button { padding: 5px 12px; border: 1px solid #2271b1; border-radius: 4px; background: #fff; color: #2271b1; font: 600 13px system-ui, sans-serif; cursor: pointer; }
  .thi button.rm { border-color: #b32d2e; color: #b32d2e; }
  .thi .bad { color: #b32d2e; } .thi .ok { color: #00a32a; }
  /* Trang soạn Bài viết: ẩn khung xem trước bên phải, ô soạn rộng hết màn hình (xem trước bằng nút như WordPress) */
  .th-posts .SplitPane > .Pane2, .th-posts .SplitPane > .Resizer, .th-posts button[class*="EditorToggle"] { display: none !important; }
  .th-posts .SplitPane > .Pane1 { width: 100% !important; max-width: none !important; flex: 1 1 auto !important; }`;
  document.head.appendChild(style);
  // Nút "Xem trước" trên thanh trên cùng, xếp NGAY SAU các nút Công bố / Xoá (nằm trong hàng nút của Decap → không đè lên nút nào)
  const topBtn = document.createElement("button");
  topBtn.type = "button"; topBtn.textContent = "👁 Xem trước";
  topBtn.style.cssText = "flex:0 0 auto;align-self:center;margin-left:10px;padding:8px 14px;border:1px solid #2271b1;border-radius:5px;background:#fff;color:#2271b1;font:600 14px system-ui,sans-serif;white-space:nowrap;cursor:pointer";
  topBtn.onclick = () => { const L = window.__TH_LATEST; if (L && L.data && L.hash === location.hash && window.TH_PREVIEW) TH_PREVIEW.article(L.data, L.getAsset, L.file); else alert("Chưa đọc được nội dung bài. Bấm Ctrl + F5 tải lại trang rồi thử lại."); };
  const isPosts = () => /^#\/collections\/posts\/(new|entries\/)/.test(location.hash);
  // Nút Xem trước lấy nội dung từ khung xem trước (đã ẩn). Decap nhớ lần tắt khung đó trong trình duyệt (cms.right-pane = none)
  // → khung không chạy, nút không có nội dung. Luôn bật lại; đổi bài thì xoá nội dung bài cũ để không xem nhầm.
  const keepPane = () => { try { if (localStorage.getItem("cms.right-pane") !== "preview") localStorage.setItem("cms.right-pane", "preview"); } catch {} };
  keepPane();
  addEventListener("hashchange", keepPane, true);
  const placeTop = () => {
    if (!isPosts()) { topBtn.remove(); return; }
    const sec = document.querySelector('[class*="ToolbarSubSectionFirst"]');
    if (sec && topBtn.parentNode !== sec) sec.appendChild(topBtn);   // chưa thấy thanh nút thì thôi — vẫn còn nút Xem trước dưới tiêu đề
  };
  const markPosts = () => { document.documentElement.classList.toggle("th-posts", isPosts()); placeTop(); };
  addEventListener("hashchange", markPosts); markPosts();
  new MutationObserver(placeTop).observe(document.documentElement, { childList: true, subtree: true });

  // Dùng đúng hàm tạo đường dẫn của website (js/render.js) để địa chỉ hiển thị khớp địa chỉ thật
  const slugify = s => window.Render ? Render.slugify(s) : String(s || "").toLowerCase().replace(/đ/g, "d").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const pathOf = p => !p ? "" : /^(https?:)?\//.test(p) ? p : "/" + p;   // ảnh tải lên: images/uploads/x.jpg → /images/uploads/x.jpg
  // Ảnh mới tải chưa có trên web (web đăng lại sau 1–2 phút) → trong ô soạn hiển thị bằng bản trên GitHub, khi lưu đổi về /images/uploads/
  const RAWUP = () => (window.TH_MEDIA ? TH_MEDIA.RAW : "") + "images/uploads/";
  const toEdit = h => window.TH_MEDIA ? String(h).split('src="/images/uploads/').join('src="' + RAWUP()) : h;
  const toSave = h => {
    let x = String(h).replace(/ class="wpe-sel"/g, "").replace(/(class="[^"]*?)\s*\bwpe-sel\b/g, "$1");
    return window.TH_MEDIA ? x.split(RAWUP()).join("/images/uploads/") : x;
  };
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // Thanh nút tab "Mã" (giống WordPress): [nhãn, thẻ mở, thẻ đóng]
  const QUICK = [["b", "<strong>", "</strong>"], ["i", "<em>", "</em>"], ["link", null, null], ["b-quote", "<blockquote>", "</blockquote>"],
    ["del", "<del>", "</del>"], ["ins", "<ins>", "</ins>"], ["img", null, null], ["ul", "<ul>\n", "\n</ul>"], ["ol", "<ol>\n", "\n</ol>"],
    ["li", "\t<li>", "</li>"], ["code", "<code>", "</code>"], ["h2", "<h2>", "</h2>"], ["h3", "<h3>", "</h3>"], ["p", "<p>", "</p>"]];
  // Thanh nút tab "Trực quan": [nhãn, lệnh]
  const VIS = [["B", "bold"], ["I", "italic"], ["H2", "h2"], ["H3", "h3"], ["Đoạn", "p"], ["|"], ["• Danh sách", "insertUnorderedList"], ["1. Danh sách", "insertOrderedList"],
    ["Trích dẫn", "blockquote"], ["|"], ["Link", "link"], ["Bỏ link", "unlink"], ["|"], ["Xóa định dạng", "removeFormat"], ["↶", "undo"], ["↷", "redo"]];

  const WPEditor = createClass({
    getInitialState() { return { tab: "visual" }; },
    html() { return String(this.props.value || ""); },
    set(v) { this.props.onChange(v); },
    componentDidMount() { this.fill(); },
    shouldComponentUpdate(next, nextState) { return next.value !== this.props.value || nextState !== undefined; },
    componentDidUpdate(prev) {
      if (prev.value !== this.props.value && this.vis && document.activeElement !== this.vis) this.fill();
    },
    fill() { if (this.vis && toSave(this.vis.innerHTML) !== this.html()) this.vis.innerHTML = toEdit(this.html()); },
    saveVis() { if (this.vis) this.set(toSave(this.vis.innerHTML)); },
    switchTab(tab) { if (tab === this.state.tab) return; if (this.state.tab === "visual") this.saveVis(); this.setState({ tab, imgBtn: null }, () => this.fill()); },
    // Chèn HTML vào đúng chỗ con trỏ đang đứng (con trỏ được nhớ lại vì mở thư viện ảnh làm mất vùng chọn)
    insertHTML(h) {
      if (this.state.tab === "code" && this.code) return this.wrap(h, "");
      if (!this.vis) return;
      const frag = document.createRange().createContextualFragment(h), r = this._range;
      if (r && this.vis.contains(r.startContainer)) { r.deleteContents(); r.insertNode(frag); }
      else this.vis.appendChild(frag);
      this.saveVis();
    },
    saveRange() {
      const s = window.getSelection();
      if (s && s.rangeCount && this.vis && this.vis.contains(s.getRangeAt(0).startContainer)) this._range = s.getRangeAt(0).cloneRange();
    },
    wrap(open, close) {
      const t = this.code, s = t.selectionStart, e = t.selectionEnd, v = t.value;
      const nv = v.slice(0, s) + open + v.slice(s, e) + close + v.slice(e);
      this.set(nv);
      requestAnimationFrame(() => { t.focus(); t.selectionStart = s + open.length; t.selectionEnd = e + open.length; });
    },
    quick([label, open, close]) {
      if (label === "link") { const u = prompt("Địa chỉ liên kết (vd https://… hoặc /bang-gia/):", "https://"); if (u) this.wrap(`<a href="${esc(u)}">`, "</a>"); return; }
      if (label === "img") return this.openMedia();
      this.wrap(open, close);
    },
    exec(cmd) {
      this.vis.focus();
      if (cmd === "h2" || cmd === "h3" || cmd === "p" || cmd === "blockquote") document.execCommand("formatBlock", false, cmd.toUpperCase());
      else if (cmd === "link") { const u = prompt("Địa chỉ liên kết (vd https://… hoặc /bang-gia/):", "https://"); if (u) document.execCommand("createLink", false, u); }
      else document.execCommand(cmd, false, null);
      this.saveVis();
    },
    // Nút "Thêm tệp" → Thư viện ảnh (admin/media.js): tải ảnh giữ nguyên tên, nhập alt/title/chú thích, chọn kích thước & căn lề
    openMedia() {
      if (!window.TH_MEDIA) return alert("Chưa tải được Thư viện ảnh — bấm Ctrl + F5 rồi thử lại.");
      if (this.state.tab === "code" && this.code) this._codeSel = [this.code.selectionStart, this.code.selectionEnd];
      TH_MEDIA.open({ mode: "insert" }).then(o => {
        if (!o) return;
        if (this.state.tab === "code" && this.code && this._codeSel) { this.code.selectionStart = this._codeSel[0]; this.code.selectionEnd = this._codeSel[1]; }
        this.insertHTML(TH_MEDIA.html(o));
      });
    },
    // Bấm vào ảnh trong tab Trực quan → hiện nút "Sửa ảnh" (sửa alt, title, chú thích, kích thước, căn lề)
    clickVis(e) {
      const img = e.target.closest && e.target.closest("img");
      this.vis.querySelectorAll("img.wpe-sel").forEach(i => { if (i !== img) i.classList.remove("wpe-sel"); });
      if (!img) { if (this.state.imgBtn) this.setState({ imgBtn: null }); return; }
      img.classList.add("wpe-sel"); this._img = img;
      const box = this.root.getBoundingClientRect(), r = img.getBoundingClientRect();
      this.setState({ imgBtn: { top: Math.max(r.top - box.top + 8, 8), left: Math.max(r.left - box.left + 8, 8) } });
    },
    editImg() {
      const img = this._img; if (!img || !window.TH_MEDIA) return;
      const cur = TH_MEDIA.parse(img);
      TH_MEDIA.open({ mode: "insert", current: cur }).then(o => {
        img.classList.remove("wpe-sel"); this.setState({ imgBtn: null });
        if (o) cur.node.replaceWith(document.createRange().createContextualFragment(toEdit(TH_MEDIA.html(o))));
        this.saveVis();
      });
    },
    render() {
      const tab = this.state.tab, words = this.html().replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
      const btn = (label, on) => h("button", { type: "button", key: label, onMouseDown: e => e.preventDefault(), onClick: on }, label);
      return h("div", { className: "wpe", id: this.props.forID, ref: el => { this.root = el; } },
        this.state.imgBtn && tab === "visual" ? h("button", { type: "button", className: "wpe-imgbtn", style: this.state.imgBtn, onMouseDown: e => e.preventDefault(), onClick: () => this.editImg() }, "✎ Sửa ảnh (alt, kích thước…)") : null,
        h("div", { className: "wpe-top" },
          h("button", { type: "button", className: "wpe-media", onClick: this.openMedia }, "🖼 Thêm tệp"),
          h("div", { className: "wpe-tabs" },
            h("button", { type: "button", className: "wpe-tab" + (tab === "visual" ? " on" : ""), onClick: () => this.switchTab("visual") }, "Trực quan"),
            h("button", { type: "button", className: "wpe-tab" + (tab === "code" ? " on" : ""), onClick: () => this.switchTab("code") }, "Mã"))),
        tab === "visual"
          ? h("div", { className: "wpe-bar" }, VIS.map(([l, c], i) => l === "|" ? h("span", { className: "sep", key: "s" + i }) : btn(l, () => this.exec(c))))
          : h("div", { className: "wpe-bar" }, QUICK.map(q => btn(q[0], () => this.quick(q)))),
        tab === "visual"
          ? h("div", { className: "wpe-visual", contentEditable: true, suppressContentEditableWarning: true, ref: el => { this.vis = el; },
              onInput: () => { this.saveRange(); this.saveVis(); }, onKeyUp: () => this.saveRange(), onMouseUp: () => this.saveRange(),
              onClick: e => this.clickVis(e), onScroll: () => { if (this.state.imgBtn) this.setState({ imgBtn: null }); },
              onBlur: () => { this.saveRange(); this.saveVis(); } })
          : h("textarea", { className: "wpe-code", spellCheck: false, ref: el => { this.code = el; }, value: this.html(), onChange: e => this.set(e.target.value) }),
        h("div", { className: "wpe-foot" }, `Số từ: ${words}`));
    }
  });
  CMS.registerWidget("wpeditor", WPEditor);

  // Ô đường dẫn: "Đường dẫn: https://…/bai-viet/<slug>/ [Chỉnh sửa]" (để trống = tự tạo từ tiêu đề)
  const SlugURL = createClass({
    getInitialState() { return { edit: false, title: "" }; },
    // Vẽ lại khi bất kỳ ô nào của bài đổi → điểm SEO trên nút luôn mới, nút Xem trước lấy đúng nội dung đang soạn
    shouldComponentUpdate(next, nextState) { return nextState !== undefined || next.entry !== this.props.entry || next.value !== this.props.value; },
    // Ô tiêu đề nằm ở widget khác → nghe sự kiện gõ trên trang để cập nhật đường dẫn theo tiêu đề ngay khi gõ
    componentDidMount() {
      this._on = e => { if (e.target && /^title-field/.test(e.target.id || "")) this.setState({ title: e.target.value }); };
      this._tick = () => this.setState({ tick: Date.now() });   // nội dung bài vừa đổi (preview.js báo) → cập nhật điểm SEO
      document.addEventListener("input", this._on, true);
      addEventListener("th-post-change", this._tick);
      const t = document.querySelector('input[id^="title-field"]'); if (t) this.setState({ title: t.value });
    },
    componentWillUnmount() { document.removeEventListener("input", this._on, true); removeEventListener("th-post-change", this._tick); },
    latest() { const L = window.__TH_LATEST; return L && L.data && L.hash === location.hash ? L : { data: this.props.entry && this.props.entry.get("data"), file: this.props.entry && this.props.entry.get("slug"), getAsset: this.props.getAsset }; },
    render() {
      const title = this.state.title || (this.latest().data && this.latest().data.get("title")) || (this.props.entry && this.props.entry.getIn(["data", "title"]));
      const slug = this.props.value || slugify(title) || "…";
      const base = (this.props.field.get("prefix") || "/bai-viet/"), url = location.origin + base + slug + "/";
      if (this.state.edit) return h("div", { className: "wpe-slug", id: this.props.forID },
        "Đường dẫn: " + location.origin + base,
        h("input", { value: this.props.value || slugify(title), onChange: e => this.props.onChange(slugify(e.target.value) || e.target.value.toLowerCase()), autoFocus: true }),
        "/", h("button", { type: "button", onClick: () => this.setState({ edit: false }) }, "OK"));
      const P = window.TH_PREVIEW, L = this.latest(), data = L.data, file = L.file;
      let score = null; try { score = P && data ? P.score(data, file) : null; } catch {}
      const tone = score == null ? "#646970" : score >= 80 ? "#2f7d4f" : score >= 50 ? "#a86b00" : "#b3261e";
      return h("div", { className: "wpe-slug", id: this.props.forID },
        h("div", null, "Đường dẫn: ",
          h("a", { href: url, target: "_blank", rel: "noopener" }, url),
          h("button", { type: "button", onClick: () => this.setState({ edit: true }) }, "Chỉnh sửa"),
          this.props.value ? null : h("span", { style: { marginLeft: 8, color: "#8c8f94" } }, "(tự tạo từ tiêu đề)")),
        P ? h("div", { className: "wpe-actions" },
          h("button", { type: "button", className: "wpe-preview", onClick: () => { const x = this.latest(); P.article(x.data, x.getAsset, x.file); } }, "👁 Xem trước"),
          h("button", { type: "button", className: "wpe-seo", style: { color: tone, borderColor: tone }, onClick: () => { const x = this.latest(); P.seo(x.data, x.file); } }, `Điểm SEO: ${score ?? "…"}`),
          h("span", { className: "wpe-tip" }, "Mở trong tab mới — chưa đăng lên web cho tới khi bấm Công bố.")) : null);
    }
  });
  CMS.registerWidget("slugurl", SlugURL);

  // Ô "Ảnh" / "Ảnh đại diện": chọn từ Thư viện ảnh (tên file giữ nguyên, alt lấy từ thư viện)
  const THImage = createClass({
    getInitialState() { return { meta: null }; },
    componentDidMount() { if (window.TH_MEDIA) TH_MEDIA.load().then(() => this.setState({ meta: TH_MEDIA.meta() })).catch(() => {}); },
    choose() {
      if (!window.TH_MEDIA) return alert("Chưa tải được Thư viện ảnh — bấm Ctrl + F5 rồi thử lại.");
      const v = this.props.value;
      TH_MEDIA.open({ mode: "select", current: v ? { name: TH_MEDIA.nameOf(v), src: pathOf(v), alt: "", title: "", caption: "" } : null })
        .then(o => { if (o) { this.props.onChange(o.path); this.setState({ meta: TH_MEDIA.meta() }); } });
    },
    render() {
      const v = this.props.value || "", name = window.TH_MEDIA ? TH_MEDIA.nameOf(v) : "", m = (this.state.meta || {})[name] || {};
      const src = name && window.TH_MEDIA ? TH_MEDIA.rawOf(name) : pathOf(v);
      return h("div", { className: "thi", id: this.props.forID },
        v ? h("img", { src, alt: "" }) : null,
        h("div", null,
          v ? h("div", null, h("b", null, "Tệp: "), name || v) : h("div", null, "Chưa có ảnh."),
          v && name ? h("div", { className: m.alt ? "ok" : "bad" }, m.alt ? `Alt: ${m.alt}` : "Ảnh chưa có alt — bấm Đổi ảnh để thêm alt trong thư viện.") : null,
          h("div", { className: "row" },
            h("button", { type: "button", onClick: () => this.choose() }, v ? "Đổi ảnh / sửa alt" : "Chọn ảnh từ thư viện"),
            v ? h("button", { type: "button", className: "rm", onClick: () => this.props.onChange("") }, "Bỏ ảnh") : null)));
    }
  });
  CMS.registerWidget("thimage", THImage);

  // Mục "Thư viện ảnh" trong cột Bộ sưu tập (ngay dưới Bài viết) — bấm mở Thư viện ảnh
  const addLibItem = () => {
    const posts = document.querySelector('a[href="#/collections/posts"]');
    if (!posts || !posts.parentElement || document.getElementById("th-lib-item")) return;
    const li = posts.closest("li") || posts, item = li.cloneNode(true), a = item.matches("a") ? item : item.querySelector("a");
    item.id = "th-lib-item";
    a.setAttribute("href", "#/thu-vien-anh"); a.removeAttribute("aria-current");
    a.removeAttribute("data-testid");
    // Lấy kiểu chữ của 1 mục KHÔNG đang chọn (mục đang chọn có màu nền xanh)
    const plain = [...li.parentElement.querySelectorAll('a[href^="#/collections/"]')].find(x => !x.classList.contains("sidebar-active"));
    a.className = plain ? plain.className : a.className.split(" ").filter(c => !/active/i.test(c)).join(" ");
    const walk = document.createTreeWalker(a, NodeFilter.SHOW_TEXT); let t; while ((t = walk.nextNode())) if (t.nodeValue.trim()) { t.nodeValue = "Thư viện ảnh"; break; }
    const svg = a.querySelector("svg");
    if (svg) { const ic = document.createElement("span"); ic.textContent = "🖼"; ic.style.cssText = "display:inline-flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:16px;line-height:1"; svg.replaceWith(ic); }
    a.addEventListener("click", e => { e.preventDefault(); if (window.TH_MEDIA) TH_MEDIA.open({ mode: "manage" }); });
    li.parentElement.appendChild(item);
  };
  // Đổi chữ nút "Tập tin" trên thanh đầu thành "Thư viện ảnh" (bấm mở Thư viện ảnh, xem bên dưới)
  const renameHeader = () => document.querySelectorAll('button[class*="AppHeaderButton"]').forEach(b => {
    const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT); let t;
    while ((t = w.nextNode())) if (/^\s*(tập tin|phương tiện|media)\s*$/i.test(t.nodeValue)) t.nodeValue = "Thư viện ảnh";
  });
  new MutationObserver(() => { addLibItem(); renameHeader(); }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  // Nút "Phương tiện" trên đầu trang của Decap tự đổi tên ảnh khi tải → mở Thư viện ảnh của web thay thế
  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest('button[class*="AppHeaderButton"]');
    if (!b || !/phương tiện|media|tập tin|thư viện ảnh/i.test(b.textContent) || !window.TH_MEDIA) return;
    e.preventDefault(); e.stopPropagation(); TH_MEDIA.open({ mode: "manage" });
  }, true);
})();
