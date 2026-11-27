/* =========================================================
   THƯ VIỆN ẢNH kiểu WordPress cho trang quản trị Thiên Hà Wellness
   - Ảnh lưu trong kho GitHub: images/uploads/<tên file GIỮ NGUYÊN như lúc tải lên>
     (Decap tự đổi tên ảnh — chữ thường, thay dấu cách… — nên thư viện này tải thẳng lên GitHub)
   - Thông tin SEO của từng ảnh (alt, title, chú thích, kích thước) lưu ở data/media.json
   - Dùng: TH_MEDIA.open({ mode: "insert" | "select" | "manage", current }) → Promise<ảnh đã chọn | null>
           TH_MEDIA.html(ảnh) → mã HTML <figure><img …></figure> để chèn vào bài
   Đăng nhập: dùng token GitHub mà trang quản trị (Decap) đã lưu trong trình duyệt.
   ========================================================= */
(function () {
  const REPO = "Nam2501/Thien-Ha-Wellness", BRANCH = "main", DIR = "images/uploads", META = "data/media.json";
  const RAW = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/`;
  const MAX_W = 1600, HEAVY_KB = 300;

  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const token = () => { try { return JSON.parse(localStorage.getItem("decap-cms-user") || "{}").token || ""; } catch { return ""; } };
  const gh = (p, o = {}) => fetch(`https://api.github.com/repos/${REPO}/${p}`, { cache: "no-store", ...o,
    headers: { Accept: "application/vnd.github+json", Authorization: `token ${token()}`, ...(o.headers || {}) } });
  const enc = name => encodeURIComponent(name);
  const srcOf = name => `/${DIR}/${enc(name)}`;                 // đường dẫn ảnh trên website
  const pathOf = name => `${DIR}/${name}`;                      // giá trị lưu ở ô "Ảnh đại diện"
  const rawOf = name => `${RAW}${DIR}/${enc(name)}`;            // xem ngay sau khi tải (web chưa kịp đăng lại)
  const nameOf = src => { const m = String(src || "").match(/images\/uploads\/([^?#"]+)/); if (!m) return ""; try { return decodeURIComponent(m[1]); } catch { return m[1]; } };
  const kb = n => n >= 1048576 ? (n / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
  const b64utf8 = s => btoa(unescape(encodeURIComponent(s)));
  const unb64utf8 = s => decodeURIComponent(escape(atob(String(s).replace(/\n/g, ""))));
  const fileB64 = blob => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = no; r.readAsDataURL(blob); });
  const dims = url => new Promise(ok => { const i = new Image(); i.onload = () => ok({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => ok(null); i.src = url; });
  const BLOB = {};                                              // ảnh vừa tải trong phiên này → xem bằng bản trên máy
  const thumb = name => BLOB[name] || rawOf(name);
  const badName = n => !n ? "Chưa có tên file." : /[\/\\?#%]/.test(n) ? "Tên file không được có các ký tự / \\ ? # %." :
    !/\.(jpe?g|png|webp|gif|svg|avif)$/i.test(n) ? "Tên file cần giữ đuôi ảnh (.jpg, .png, .webp…)." : "";

  /* ---------- Dữ liệu: danh sách ảnh + thông tin SEO ---------- */
  let FILES = null, META_DATA = null;
  async function load(force) {
    if (FILES && !force) return;
    const [r1, r2] = await Promise.all([gh(`contents/${DIR}?ref=${BRANCH}`), gh(`contents/${META}?ref=${BRANCH}`)]);
    if (r1.status === 401 || r2.status === 401) throw new Error("login");
    FILES = r1.ok ? (await r1.json()).filter(f => f.type === "file" && /\.(jpe?g|png|webp|gif|svg|avif)$/i.test(f.name)).map(f => ({ name: f.name, size: f.size, sha: f.sha })) : [];
    META_DATA = r2.ok ? (JSON.parse(unb64utf8((await r2.json()).content || "")).items || {}) : {};
  }
  // Ghi thông tin ảnh vào data/media.json (đọc lại bản mới nhất trước khi ghi để không đè thay đổi khác)
  async function saveMeta(patch, msg) {
    for (let i = 0; i < 2; i++) {
      const r = await gh(`contents/${META}?ref=${BRANCH}`);
      let sha, items = {};
      if (r.ok) { const j = await r.json(); sha = j.sha; items = JSON.parse(unb64utf8(j.content || "")).items || {}; }
      for (const [k, v] of Object.entries(patch)) { if (v === null) delete items[k]; else items[k] = { ...(items[k] || {}), ...v }; }
      const sorted = Object.fromEntries(Object.keys(items).sort((a, b) => a.localeCompare(b, "vi")).map(k => [k, items[k]]));
      const w = await gh(`contents/${META}`, { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg || "Cập nhật thông tin ảnh", content: b64utf8(JSON.stringify({ items: sorted }, null, 2) + "\n"), branch: BRANCH, ...(sha ? { sha } : {}) }) });
      if (w.ok) { META_DATA = sorted; return; }
      if (w.status !== 409 && w.status !== 422) throw new Error("meta " + w.status);
    }
    throw new Error("meta conflict");
  }
  async function upload(blob, name, sha) {
    const r = await gh(`contents/${DIR}/${enc(name)}`, { method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: `Tải ảnh “${name}”`, content: await fileB64(blob), branch: BRANCH, ...(sha ? { sha } : {}) }) });
    if (!r.ok) throw new Error("upload " + r.status);
    return (await r.json()).content;
  }
  async function remove(f) {
    const r = await gh(`contents/${DIR}/${enc(f.name)}`, { method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: `Xoá ảnh “${f.name}”`, sha: f.sha, branch: BRANCH }) });
    if (!r.ok) throw new Error("delete " + r.status);
  }
  // Thu nhỏ ảnh (giữ nguyên định dạng và TÊN file) — chỉ khi người dùng tick chọn
  async function shrink(file, maxW) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
    const url = URL.createObjectURL(file), d = await dims(url);
    if (!d || d.w <= maxW) return file;
    const img = new Image(); img.src = url; await img.decode();
    const c = document.createElement("canvas"); c.width = maxW; c.height = Math.round(d.h * maxW / d.w);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    const out = await new Promise(ok => c.toBlob(ok, file.type, .86));
    return out && out.size < file.size ? out : file;
  }

  /* ---------- Mã HTML chèn vào bài ---------- */
  function html(o) {
    const src = o.src || srcOf(o.name), w = +o.width || 0, hgt = w && o.natW ? Math.round(o.natH * w / o.natW) : +o.height || 0;
    const img = `<img src="${esc(src)}" alt="${esc(o.alt || "")}"${o.title ? ` title="${esc(o.title)}"` : ""}${w ? ` width="${w}"` : ""}${hgt ? ` height="${hgt}"` : ""} loading="lazy" decoding="async">`;
    return `<figure class="th-img align-${o.align || "none"}">${o.link ? `<a href="${esc(src)}">${img}</a>` : img}${o.caption ? `<figcaption>${esc(o.caption)}</figcaption>` : ""}</figure>`;
  }
  // Đọc lại thông số của ảnh đã chèn (để sửa)
  function parse(img) {
    const fig = img.closest("figure"), a = img.closest("a"), cap = fig && fig.querySelector("figcaption");
    const al = fig && (fig.className.match(/align-(left|center|right|none)/) || [])[1];
    return { src: img.getAttribute("src"), name: nameOf(img.getAttribute("src")), alt: img.getAttribute("alt") || "", title: img.getAttribute("title") || "",
      caption: cap ? cap.textContent : "", width: +img.getAttribute("width") || 0, align: al || "none", link: !!(a && a.getAttribute("href") === img.getAttribute("src")),
      node: fig || a || img };
  }

  /* ---------- Giao diện ---------- */
  const css = document.createElement("style");
  css.textContent = `
  .thm-ov { position: fixed; inset: 0; z-index: 100000; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1d2327; }
  .thm-ov.inline { position: static; background: none; display: block; }
  .thm { width: min(1240px, 96vw); height: min(820px, 92vh); background: #fff; border-radius: 6px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,.35); }
  .inline .thm { width: auto; height: calc(100vh - 70px); box-shadow: none; border: 1px solid #dcdcde; }
  .thm-h { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid #dcdcde; }
  .thm-h b { font-size: 20px; } .thm-x { border: 0; background: none; font-size: 26px; line-height: 1; cursor: pointer; color: #50575e; }
  .thm-tabs { display: flex; gap: 4px; padding: 0 18px; border-bottom: 1px solid #dcdcde; }
  .thm-tabs button { padding: 10px 14px; border: 0; border-bottom: 3px solid transparent; background: none; font: 600 14px system-ui, sans-serif; color: #50575e; cursor: pointer; }
  .thm-tabs button.on { color: #1d2327; border-bottom-color: #2271b1; }
  .thm-b { flex: 1; display: flex; min-height: 0; }
  .thm-main { flex: 1; overflow: auto; padding: 16px 18px; min-width: 0; }
  .thm-side { width: 330px; flex: 0 0 330px; overflow: auto; padding: 16px; background: #f6f7f7; border-left: 1px solid #dcdcde; }
  .thm-f { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 18px; border-top: 1px solid #dcdcde; }
  .thm-msg { color: #50575e; font-size: 13px; } .thm-msg.err { color: #b32d2e; font-weight: 600; }
  .thm-btn { padding: 8px 16px; border: 1px solid #2271b1; border-radius: 4px; background: #2271b1; color: #fff; font: 600 14px system-ui, sans-serif; cursor: pointer; }
  .thm-btn:disabled { opacity: .45; cursor: default; } .thm-btn.ghost { background: #fff; color: #2271b1; }
  .thm-btn.danger { background: #fff; color: #b32d2e; border-color: #b32d2e; }
  .thm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; }
  .thm-it { position: relative; aspect-ratio: 1; border: 1px solid #dcdcde; background: #f0f0f1; cursor: pointer; overflow: hidden; padding: 0; }
  .thm-it img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .thm-it span { position: absolute; left: 0; right: 0; bottom: 0; padding: 2px 6px; background: rgba(255,255,255,.92); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left; }
  .thm-it.on { outline: 4px solid #2271b1; outline-offset: -4px; }
  .thm-it i { position: absolute; top: 5px; right: 5px; width: 10px; height: 10px; border-radius: 50%; background: #d63638; box-shadow: 0 0 0 2px #fff; }
  .thm-top { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .thm-top input { padding: 6px 10px; border: 1px solid #8c8f94; border-radius: 4px; min-width: 220px; font: inherit; }
  .thm-drop { border: 2px dashed #c3c4c7; border-radius: 6px; padding: 40px 20px; text-align: center; color: #50575e; }
  .thm-drop.over { border-color: #2271b1; background: #f0f6fc; }
  .thm-row { display: grid; grid-template-columns: 110px 1fr; gap: 14px; padding: 12px; margin-top: 12px; border: 1px solid #dcdcde; border-radius: 6px; }
  .thm-row img { width: 110px; height: 110px; object-fit: cover; background: #f0f0f1; }
  .thm-lab { display: block; margin-top: 8px; font-size: 12px; font-weight: 600; color: #50575e; }
  .thm-lab input, .thm-lab textarea, .thm-lab select { display: block; width: 100%; box-sizing: border-box; margin-top: 3px; padding: 6px 8px; border: 1px solid #8c8f94; border-radius: 4px; font: 400 13px system-ui, sans-serif; color: #1d2327; background: #fff; }
  .thm-lab textarea { min-height: 56px; resize: vertical; }
  .thm-hint { font-weight: 400; color: #8c8f94; font-size: 12px; }
  .thm-warn { margin-top: 6px; padding: 6px 8px; border-left: 3px solid #dba617; background: #fcf9e8; font-size: 12px; }
  .thm-err { margin-top: 6px; padding: 6px 8px; border-left: 3px solid #d63638; background: #fcf0f1; font-size: 12px; }
  .thm-ok { margin-top: 6px; padding: 6px 8px; border-left: 3px solid #00a32a; background: #edfaef; font-size: 12px; }
  .thm-side h4 { margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #50575e; }
  .thm-side .pv { width: 100%; max-height: 200px; object-fit: contain; background: #fff; border: 1px solid #dcdcde; }
  .thm-info { font-size: 12px; color: #50575e; margin: 8px 0; word-break: break-all; } .thm-info b { color: #1d2327; }
  .thm-sec { margin-top: 14px; padding-top: 12px; border-top: 1px solid #dcdcde; }
  .thm-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .thm-link { border: 0; background: none; padding: 0; color: #2271b1; cursor: pointer; font-size: 12px; text-decoration: underline; }
  .thm-del { margin-top: 12px; border: 0; background: none; padding: 0; color: #b32d2e; cursor: pointer; font-size: 12px; text-decoration: underline; }`;
  document.head.appendChild(css);

  function el(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k.startsWith("on")) e[k.toLowerCase()] = v; else if (k === "html") e.innerHTML = v; else e.setAttribute(k, v === true ? "" : v); }
    for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
    return e;
  }

  function open(opt = {}) {
    const mode = opt.mode || "manage", cur = opt.current || null;
    return new Promise(resolve => {
      const st = { tab: opt.tab || "lib", sel: null, q: "", queue: [], busy: false, view: { align: cur ? cur.align : "none", size: cur && cur.width ? "custom" : "full", width: cur ? cur.width : 0, link: cur ? cur.link : false } };
      const ov = el("div", { class: "thm-ov" + (opt.inline ? " inline" : "") });
      const box = el("div", { class: "thm" }); ov.append(box);
      const done = v => { if (opt.inline) return; ov.remove(); document.removeEventListener("keydown", onKey, true); resolve(v); };
      const onKey = e => { if (e.key === "Escape" && !opt.inline) { e.stopPropagation(); done(null); } };
      document.addEventListener("keydown", onKey, true);
      if (!opt.inline) ov.addEventListener("mousedown", e => { if (e.target === ov) done(null); });
      (opt.inline || document.body).append(ov);
      let msg = "";
      const setMsg = (m, err) => { msg = m; const n = box.querySelector(".thm-msg"); if (n) { n.textContent = m; n.className = "thm-msg" + (err ? " err" : ""); } };

      const draw = () => {
        box.innerHTML = "";
        const title = mode === "insert" ? (cur ? "Sửa ảnh trong bài" : "Thêm ảnh vào bài") : mode === "select" ? "Chọn ảnh" : "Thư viện ảnh";
        box.append(el("div", { class: "thm-h" }, el("b", {}, title), opt.inline ? null : el("button", { class: "thm-x", type: "button", title: "Đóng", onClick: () => done(null) }, "×")));
        box.append(el("div", { class: "thm-tabs" },
          el("button", { type: "button", class: st.tab === "up" ? "on" : null, onClick: () => { st.tab = "up"; draw(); } }, "Tải tệp lên"),
          el("button", { type: "button", class: st.tab === "lib" ? "on" : null, onClick: () => { st.tab = "lib"; draw(); } }, `Thư viện ảnh${FILES ? ` (${FILES.length})` : ""}`)));
        const body = el("div", { class: "thm-b" }); box.append(body);
        if (!token()) { body.append(el("div", { class: "thm-main" }, el("div", { class: "thm-err" }, "Chưa đăng nhập. Hãy mở ", el("a", { href: "/admin/" }, "trang quản trị"), ", đăng nhập GitHub rồi mở lại thư viện ảnh."))); return foot(); }
        if (st.tab === "up") drawUpload(body); else drawLib(body);
        foot();
      };
      const foot = () => {
        const s = st.sel, can = s && !st.busy;
        const btn = mode === "insert" ? el("button", { class: "thm-btn", type: "button", disabled: !can, onClick: pick }, cur ? "Cập nhật ảnh" : "Chèn vào bài")
          : mode === "select" ? el("button", { class: "thm-btn", type: "button", disabled: !can, onClick: pick }, "Chọn ảnh này") : null;
        box.append(el("div", { class: "thm-f" }, el("span", { class: "thm-msg" }, msg), btn));
      };

      /* --- Tab Thư viện --- */
      const drawLib = body => {
        const main = el("div", { class: "thm-main" }); body.append(main);
        if (!FILES) { main.append(el("p", {}, "Đang tải thư viện…")); return; }
        const list = FILES.filter(f => !st.q || (f.name + " " + ((META_DATA[f.name] || {}).alt || "")).toLowerCase().includes(st.q.toLowerCase()));
        const q = el("input", { type: "search", placeholder: "Tìm theo tên file hoặc alt…", value: st.q });
        q.oninput = () => { st.q = q.value; const p = q.selectionStart; draw(); const n = box.querySelector(".thm-top input"); n.focus(); n.selectionStart = n.selectionEnd = p; };
        main.append(el("div", { class: "thm-top" }, q, el("span", { class: "thm-hint" }, `${FILES.length} ảnh · chấm đỏ = chưa có alt`)));
        if (!FILES.length) main.append(el("div", { class: "thm-drop" }, "Thư viện chưa có ảnh. ", el("button", { class: "thm-link", type: "button", onClick: () => { st.tab = "up"; draw(); } }, "Tải ảnh lên")));
        main.append(el("div", { class: "thm-grid" }, list.map(f => el("button", { type: "button", class: "thm-it" + (st.sel && st.sel.name === f.name ? " on" : ""), title: f.name,
          onClick: () => { select(f.name); } }, el("img", { src: thumb(f.name), alt: "", loading: "lazy" }), (META_DATA[f.name] || {}).alt ? null : el("i", { title: "Chưa có alt" }), el("span", {}, f.name)))));
        if (st.sel) body.append(side());
      };
      const select = name => {
        const f = FILES.find(x => x.name === name), m = META_DATA[name] || {};
        st.sel = { name, size: f ? f.size : 0, sha: f && f.sha, natW: m.w, natH: m.h, alt: m.alt || "", title: m.title || "", caption: m.caption || "" };
        if (cur && cur.name === name) Object.assign(st.sel, { alt: cur.alt, title: cur.title, caption: cur.caption });
        draw();
        if (!st.sel.natW) dims(thumb(name)).then(d => { if (d && st.sel && st.sel.name === name) { st.sel.natW = d.w; st.sel.natH = d.h; draw(); } });
      };

      /* --- Cột phải: chi tiết ảnh + cài đặt hiển thị --- */
      const side = () => {
        const s = st.sel, m = META_DATA[s.name] || {}, wrap = el("div", { class: "thm-side" });
        wrap.append(el("h4", {}, "Chi tiết ảnh"), el("img", { class: "pv", src: s.name ? thumb(s.name) : s.src, alt: "" }));
        const url = location.origin + (s.name ? srcOf(s.name) : s.src);
        wrap.append(el("div", { class: "thm-info" },
          el("div", {}, el("b", {}, "Tên file: "), s.name || "(ảnh ngoài thư viện)"),
          s.size ? el("div", {}, el("b", {}, "Dung lượng: "), kb(s.size)) : null,
          s.natW ? el("div", {}, el("b", {}, "Kích thước: "), `${s.natW} × ${s.natH} px`) : null,
          el("div", {}, el("b", {}, "Đường dẫn: "), url, " ", el("button", { class: "thm-link", type: "button", onClick: () => { navigator.clipboard && navigator.clipboard.writeText(url); setMsg("Đã chép đường dẫn ảnh."); } }, "Chép"))));
        if (s.size > HEAVY_KB * 1024) wrap.append(el("div", { class: "thm-warn" }, `Ảnh nặng ${kb(s.size)} — nên dưới ${HEAVY_KB} KB để trang tải nhanh (nén ảnh rồi tải lại).`));
        if (s.natW > 2000) wrap.append(el("div", { class: "thm-warn" }, `Ảnh rộng ${s.natW}px — rộng hơn mức cần (khoảng ${MAX_W}px).`));
        if (s.name && /[A-ZÀ-Ỹà-ỹđĐ\s_]/.test(s.name)) wrap.append(el("div", { class: "thm-warn" }, "Gợi ý SEO: tên file nên viết thường, không dấu, nối bằng gạch ngang (vd: massage-co-vai-gay.jpg). Thư viện KHÔNG tự đổi — muốn đổi thì tải lại với tên mới."));
        const field = (label, key, hint, area) => {
          const inp = el(area ? "textarea" : "input", { value: area ? null : s[key] || "" }); if (area) inp.value = s[key] || "";
          inp.oninput = () => { s[key] = inp.value; const w = wrap.querySelector(".alt-st"); if (key === "alt" && w) w.replaceWith(altState()); };
          return el("label", { class: "thm-lab" }, label, hint ? el("span", { class: "thm-hint" }, " — " + hint) : null, inp);
        };
        const altState = () => el("div", { class: "alt-st " + (s.alt.trim() ? (s.alt.length > 125 ? "thm-warn" : "thm-ok") : "thm-err") },
          !s.alt.trim() ? "Chưa có alt: Google không hiểu ảnh nói gì, người khiếm thị cũng không nghe được." : s.alt.length > 125 ? `Alt dài ${s.alt.length} ký tự — nên dưới 125.` : `Alt ${s.alt.length} ký tự — tốt.`);
        wrap.append(el("div", { class: "thm-sec" },
          field("Văn bản thay thế (alt)", "alt", "mô tả đúng nội dung ảnh, có từ khóa nếu tự nhiên", true), altState(),
          field("Tiêu đề (title)", "title", "hiện khi rê chuột, không bắt buộc"),
          field("Chú thích", "caption", "hiện dưới ảnh trong bài", true)));
        if (s.name) {
          const changed = () => (s.alt || "") !== (m.alt || "") || (s.title || "") !== (m.title || "") || (s.caption || "") !== (m.caption || "");
          wrap.append(el("div", { style: "margin-top:10px;display:flex;gap:8px;align-items:center" },
            el("button", { class: "thm-btn ghost", type: "button", disabled: st.busy, onClick: async () => {
              if (!changed()) return setMsg("Thông tin ảnh chưa thay đổi.");
              st.busy = true; setMsg("Đang lưu thông tin ảnh…");
              try { await saveMeta({ [s.name]: { alt: s.alt.trim(), title: s.title.trim(), caption: s.caption.trim(), ...(s.natW ? { w: s.natW, h: s.natH } : {}) } }, `Cập nhật thông tin ảnh “${s.name}”`); st.busy = false; draw(); setMsg("Đã lưu thông tin ảnh vào thư viện."); }
              catch { st.busy = false; setMsg("Chưa lưu được — thử lại sau ít phút.", true); } } }, "Lưu vào thư viện"),
            el("span", { class: "thm-hint" }, "lần sau chọn ảnh này sẽ tự điền")));
        }
        if (mode === "insert") {
          const v = st.view, sel = (label, key, opts) => { const x = el("select", {}, opts.map(([val, t]) => el("option", { value: val, selected: String(v[key]) === String(val) }, t))); x.onchange = () => { v[key] = x.value === "true" ? true : x.value === "false" ? false : x.value; draw(); }; return el("label", { class: "thm-lab" }, label, x); };
          const wIn = el("input", { type: "number", min: 50, step: 10, value: v.width || (s.natW ? Math.min(s.natW, 800) : 800) }); wIn.oninput = () => { v.width = +wIn.value; };
          wrap.append(el("div", { class: "thm-sec" }, el("h4", {}, "Cài đặt hiển thị"),
            el("div", { class: "thm-2" }, sel("Căn lề", "align", [["none", "Không"], ["left", "Trái"], ["center", "Giữa"], ["right", "Phải"]]),
              sel("Liên kết", "link", [[false, "Không"], [true, "Tới ảnh gốc"]])),
            sel("Kích thước", "size", [["full", `Đầy đủ${s.natW ? ` – ${s.natW} × ${s.natH}` : ""}`], ["1200", "Lớn – rộng 1200px"], ["800", "Vừa – rộng 800px"], ["400", "Nhỏ – rộng 400px"], ["custom", "Tùy chỉnh…"]]),
            v.size === "custom" ? el("label", { class: "thm-lab" }, "Chiều rộng (px)", el("span", { class: "thm-hint" }, " — chiều cao tự tính theo tỉ lệ ảnh"), wIn) : null));
        }
        if (s.name && mode === "manage") wrap.append(el("button", { class: "thm-del", type: "button", onClick: async () => {
          if (!confirm(`Xoá vĩnh viễn ảnh “${s.name}”?\nBài viết nào đang dùng ảnh này sẽ bị mất ảnh.`)) return;
          st.busy = true; setMsg("Đang xoá…");
          try { await remove(FILES.find(f => f.name === s.name)); FILES = FILES.filter(f => f.name !== s.name); if (META_DATA[s.name]) await saveMeta({ [s.name]: null }, `Xoá thông tin ảnh “${s.name}”`); st.sel = null; st.busy = false; draw(); setMsg("Đã xoá ảnh."); }
          catch { st.busy = false; setMsg("Chưa xoá được — thử tải lại trang.", true); } } }, "Xoá ảnh vĩnh viễn"));
        return wrap;
      };

      /* --- Tab Tải lên: giữ nguyên tên file --- */
      const drawUpload = body => {
        const main = el("div", { class: "thm-main" }); body.append(main);
        const input = el("input", { type: "file", accept: "image/*", multiple: true, style: "display:none" });
        input.onchange = () => addFiles(input.files);
        const drop = el("div", { class: "thm-drop" }, el("p", { style: "font-size:18px;margin:0 0 8px" }, "Kéo thả ảnh vào đây"), el("p", { style: "margin:0 0 12px" }, "hoặc"),
          el("button", { class: "thm-btn ghost", type: "button", onClick: () => input.click() }, "Chọn ảnh từ máy"),
          el("p", { class: "thm-hint", style: "margin:12px 0 0" }, "Tên file được GIỮ NGUYÊN như trên máy bạn (có thể tự sửa ở ô Tên file trước khi tải)."), input);
        drop.ondragover = e => { e.preventDefault(); drop.classList.add("over"); }; drop.ondragleave = () => drop.classList.remove("over");
        drop.ondrop = e => { e.preventDefault(); drop.classList.remove("over"); addFiles(e.dataTransfer.files); };
        main.append(drop);
        st.queue.forEach((q, i) => {
          const n = el("input", { value: q.name }); n.oninput = () => { q.name = n.value; const e = row.querySelector(".nm-st"); e.replaceWith(nameState()); };
          const a = el("textarea", {}); a.value = q.alt; a.oninput = () => { q.alt = a.value; };
          const t = el("input", { value: q.title }); t.oninput = () => { q.title = t.value; };
          const shr = el("input", { type: "checkbox", checked: q.shrink }); shr.onchange = () => { q.shrink = shr.checked; };
          const nameState = () => { const b = badName(q.name.trim()), dup = FILES && FILES.some(f => f.name === q.name.trim());
            return el("div", { class: "nm-st " + (b ? "thm-err" : dup ? "thm-warn" : "thm-ok") }, b || (dup ? "Đã có ảnh trùng tên trong thư viện — tải lên sẽ hỏi có ghi đè không." : "Tên file hợp lệ, sẽ giữ nguyên khi tải lên.")); };
          const row = el("div", { class: "thm-row" }, el("img", { src: q.url, alt: "" }), el("div", {},
            el("div", { class: "thm-info" }, el("b", {}, "Ảnh gốc: "), `${q.file.name} · ${kb(q.file.size)}${q.w ? ` · ${q.w} × ${q.h} px` : ""} `,
              el("button", { class: "thm-link", type: "button", onClick: () => { st.queue.splice(i, 1); draw(); } }, "Bỏ ảnh này")),
            el("label", { class: "thm-lab" }, "Tên file", n), nameState(),
            el("label", { class: "thm-lab" }, "Văn bản thay thế (alt)", el("span", { class: "thm-hint" }, " — mô tả đúng nội dung ảnh"), a),
            el("label", { class: "thm-lab" }, "Tiêu đề (title)", el("span", { class: "thm-hint" }, " — không bắt buộc"), t),
            q.file.size > HEAVY_KB * 1024 ? el("div", { class: "thm-warn" }, `Ảnh nặng ${kb(q.file.size)} — nên dưới ${HEAVY_KB} KB.`) : null,
            q.w > MAX_W && /^image\/(jpeg|png|webp)$/.test(q.file.type) ? el("label", { class: "thm-lab", style: "font-weight:400" }, shr, ` Thu nhỏ còn rộng ${MAX_W}px (giữ nguyên tên và định dạng, ảnh nhẹ hơn)`) : null));
          main.append(row);
        });
        if (st.queue.length) main.append(el("div", { style: "margin-top:14px" }, el("button", { class: "thm-btn", type: "button", disabled: st.busy, onClick: doUpload }, `Tải lên ${st.queue.length} ảnh`)));
      };
      const addFiles = async list => {
        for (const file of [...list]) {
          if (!/^image\//.test(file.type)) continue;
          const url = URL.createObjectURL(file), d = await dims(url);
          st.queue.push({ file, url, name: file.name, alt: "", title: "", w: d && d.w, h: d && d.h, shrink: false });
        }
        draw();
      };
      const doUpload = async () => {
        for (const q of st.queue) { const b = badName(q.name.trim()); if (b) return setMsg(`“${q.name}”: ${b}`, true); }
        const names = st.queue.map(q => q.name.trim());
        if (new Set(names).size !== names.length) return setMsg("Có 2 ảnh trùng tên file — sửa lại một tên.", true);
        st.busy = true; draw();
        const meta = {}, okNames = [];
        try {
          await load();
          for (const q of [...st.queue]) {
            const name = q.name.trim(), old = FILES.find(f => f.name === name);
            if (old && !confirm(`Thư viện đã có ảnh “${name}”.\nGhi đè bằng ảnh mới? (Bài đang dùng ảnh cũ sẽ hiện ảnh mới)`)) continue;
            setMsg(`Đang tải “${name}”…`);
            const blob = q.shrink ? await shrink(q.file, MAX_W) : q.file, d = blob === q.file ? { w: q.w, h: q.h } : await dims(URL.createObjectURL(blob));
            const c = await upload(blob, name, old && old.sha);
            BLOB[name] = URL.createObjectURL(blob);
            FILES = FILES.filter(f => f.name !== name).concat({ name, size: c.size || blob.size, sha: c.sha }).sort((a, b) => a.name.localeCompare(b.name, "vi"));
            meta[name] = { alt: q.alt.trim(), title: q.title.trim(), ...(d && d.w ? { w: d.w, h: d.h } : {}), uploaded: new Date().toISOString().slice(0, 10) };
            okNames.push(name); st.queue = st.queue.filter(x => x !== q);
          }
          if (okNames.length) await saveMeta(meta, okNames.length === 1 ? `Thông tin ảnh “${okNames[0]}”` : `Thông tin ${okNames.length} ảnh mới`);
          st.busy = false; st.tab = "lib";
          if (okNames.length) { select(okNames[0]); setMsg(`Đã tải ${okNames.length} ảnh. Ảnh hiện trên website sau 1–2 phút.`); } else draw();
        } catch (e) { st.busy = false; draw(); setMsg(`Tải lên bị lỗi (${e.message}). Ảnh đã tải xong: ${okNames.join(", ") || "chưa có"}.`, true); }
      };

      /* --- Chọn ảnh --- */
      const pick = async () => {
        const s = st.sel, m = META_DATA[s.name] || {}, v = st.view;
        if (s.name && ((s.alt || "") !== (m.alt || "") || (s.title || "") !== (m.title || "") || (s.caption || "") !== (m.caption || "")) && !m.alt && s.alt.trim()) {
          try { await saveMeta({ [s.name]: { alt: s.alt.trim(), title: s.title.trim(), caption: s.caption.trim(), ...(s.natW ? { w: s.natW, h: s.natH } : {}) } }, `Cập nhật thông tin ảnh “${s.name}”`); } catch {}
        }
        const width = v.size === "full" ? s.natW || 0 : v.size === "custom" ? +v.width || 0 : +v.size;
        done({ name: s.name, src: s.name ? srcOf(s.name) : s.src, path: s.name ? pathOf(s.name) : s.src, alt: s.alt.trim(), title: s.title.trim(), caption: s.caption.trim(),
          natW: s.natW, natH: s.natH, width: s.natW && width > s.natW ? s.natW : width, align: v.align, link: v.link });
      };

      draw();
      load().then(() => {
        if (cur && cur.name && FILES.some(f => f.name === cur.name)) select(cur.name);
        else if (cur && cur.src) { st.sel = { name: "", src: cur.src, alt: cur.alt, title: cur.title, caption: cur.caption }; draw(); dims(cur.src).then(d => { if (d && st.sel) { st.sel.natW = d.w; st.sel.natH = d.h; draw(); } }); }
        else { if (!FILES.length && !opt.tab) st.tab = "up"; draw(); }
      }).catch(e => { FILES = []; META_DATA = {}; draw(); setMsg(e.message === "login" ? "Phiên đăng nhập đã hết — đăng nhập lại trang quản trị." : "Chưa đọc được thư viện ảnh (lỗi mạng?).", true); });
    });
  }

  window.TH_MEDIA = { open, html, parse, nameOf, rawOf, srcOf, RAW, meta: () => META_DATA, load };
})();
