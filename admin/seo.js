/* ===== Bảng điều khiển SEO — đọc data/*.json đang đăng và chấm điểm toàn website ===== */
(async function () {
  const { analyzeSite, snippetHTML, checksHTML, scoreHTML, grade, gradeLabel, esc, norm } = SEOCheck;
  const $ = s => document.querySelector(s);
  const get = f => fetch(`/data/${f}.json`, { cache: "no-cache" }).then(r => r.ok ? r.json() : {}).catch(() => ({}));
  const [seo, site, services, posts, faq, gallery] = await Promise.all(["seo", "site", "services", "posts", "faq", "gallery"].map(get));
  const results = analyzeSite({ seo, services: services.items || [], posts: posts.items || [] });

  const TYPE = { page: "Trang chính", services: "Liệu trình", posts: "Bài viết" };
  const EDIT = { page: "seo/entries/seo", services: "content/entries/services", posts: "content/entries/posts" };
  const nameOf = r => r.item.label || r.item.name || r.item.title;

  /* ---------- Tổng quan ---------- */
  const avg = Math.round(results.reduce((s, r) => s + r.score, 0) / (results.length || 1));
  const C = 2 * Math.PI * 70, color = { good: "#2f7d4f", warn: "#a86b00", bad: "#b3261e" }[grade(avg)];
  $("#ring").innerHTML = `<svg viewBox="0 0 170 170"><circle cx="85" cy="85" r="70" fill="none" stroke="#e3edf2" stroke-width="14"/>
    <circle cx="85" cy="85" r="70" fill="none" stroke="${color}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${C * avg / 100} ${C}"/></svg>
    <div class="sx-ring-txt"><b>${avg}</b><span>Điểm SEO trung bình<br>${gradeLabel(avg)}</span></div>`;
  const by = g => results.filter(r => grade(r.score) === g).length;
  $("#kpis").innerHTML = [["", results.length, "Trang được chấm"], ["good", by("good"), "Tốt (từ 80)"], ["warn", by("warn"), "Cần cải thiện"], ["bad", by("bad"), "Yếu (dưới 50)"]]
    .map(([c, n, l]) => `<div class="sx-kpi ${c}"><b>${n}</b><span>${l}</span></div>`).join("");
  const agg = {};
  results.forEach(r => r.checks.forEach(c => { if (c.status === "good") return; const a = agg[c.id] ||= { label: c.label, n: 0, w: 0, bad: 0 }; a.n++; a.w += c.weight * (c.status === "bad" ? 2 : 1); if (c.status === "bad") a.bad++; }));
  const top = Object.values(agg).sort((a, b) => b.w - a.w).slice(0, 5);
  $("#todo").innerHTML = top.length ? `<b style="color:var(--sx-green)">Việc nên làm trước</b>` + top.map(a =>
    `<div class="sx-todo-row"><div><b>${esc(a.label)}</b><div class="sx-bar"><i style="width:${Math.round(a.n / results.length * 100)}%"></i></div></div><span>${a.n}/${results.length} trang${a.bad ? ` · ${a.bad} lỗi nặng` : ""}</span></div>`).join("")
    : `<p class="sx-note">Không còn lỗi nào.</p>`;

  /* ---------- Từ khóa ---------- */
  const kwMap = new Map();
  results.forEach(r => r.meta.keyword && kwMap.set(r.meta.keyword, [...(kwMap.get(r.meta.keyword) || []), r]));
  const noKw = results.filter(r => !r.meta.keyword).length;
  $("#kw").innerHTML = (kwMap.size ? [...kwMap].sort((a, b) => b[1].length - a[1].length).map(([k, rs]) =>
    `<div class="sx-kwrow ${rs.length > 1 ? "dup" : ""}"><b>${esc(k)}</b><small>${rs.map(r => esc(nameOf(r))).join(", ")}${rs.length > 1 ? " — trùng, các trang sẽ tranh nhau thứ hạng" : ""}</small></div>`).join("")
    : `<p class="sx-note">Chưa trang nào đặt từ khóa chính.</p>`) + (noKw ? `<p class="sx-note">${noKw} trang chưa có từ khóa chính.</p>` : "");

  /* ---------- SEO địa phương & kỹ thuật ---------- */
  const tech = [], push = (status, label, msg) => tech.push({ status, label, msg, id: tech.length, weight: 0 });
  const fetchTxt = async u => { try { const r = await fetch(u, { cache: "no-cache" }); return { ok: r.ok, text: r.ok ? await r.text() : "", type: r.headers.get("content-type") || "" }; } catch { return { ok: false, text: "" }; } };
  // Thông tin NAP (tên – địa chỉ – điện thoại) phải là thông tin thật, khớp Google Business Profile
  const fakePhone = /0900 ?000 ?000/.test(site.phone || ""), fakeAddr = !site.address || /cập nhật/i.test(site.address);
  push(fakePhone ? "bad" : "good", "Hotline", fakePhone ? "Đang là số mẫu 0900 000 000 — thay bằng hotline thật." : site.phone);
  push(fakeAddr ? "bad" : "good", "Địa chỉ", fakeAddr ? "Chưa có địa chỉ thật. Địa chỉ phải giống hệt trên Google Business Profile." : site.address);
  push(/maps/.test(site.mapUrl || "") && !/search\/\?api=1/.test(site.mapUrl || "") ? "good" : "warn", "Link Google Maps", /search\/\?api=1/.test(site.mapUrl || "") ? "Đang là link tìm kiếm chung — thay bằng link hồ sơ Google Maps của spa." : site.mapUrl ? "Đã có." : "Chưa có.");
  const B = seo.business || {};
  push(B.city ? "good" : "warn", "Tỉnh / thành phố (schema)", B.city || "Chưa điền — Google cần biết spa ở khu vực nào.");
  push(B.latitude && B.longitude ? "good" : "warn", "Tọa độ bản đồ (schema)", B.latitude && B.longitude ? `${B.latitude}, ${B.longitude}` : "Chưa có vĩ độ / kinh độ.");
  const [sm, rb] = await Promise.all([fetchTxt("/sitemap.xml"), fetchTxt("/robots.txt")]);
  const nUrl = (sm.text.match(/<url>/g) || []).length;
  sm.ok && /xml/.test(sm.type) ? push(nUrl && /<loc>https?:/.test(sm.text) ? "good" : "warn", "Sitemap", /<loc>https?:/.test(sm.text) ? `${nUrl} đường dẫn.` : `${nUrl} đường dẫn nhưng thiếu tên miền — điền Tên miền chính.`) : push("bad", "Sitemap", "Chưa có /sitemap.xml — website chưa chạy bản build.");
  rb.ok ? push(/Disallow:\s*\/\s*$/m.test(rb.text) ? "bad" : "good", "robots.txt", /Disallow:\s*\/\s*$/m.test(rb.text) ? "Đang chặn Google toàn website." : "Cho phép Google.") : push("bad", "robots.txt", "Chưa có.");
  push(seo.siteUrl ? "good" : "bad", "Tên miền chính", seo.siteUrl || "Chưa điền — canonical và sitemap thiếu tên miền.");
  push(seo.gscVerification ? "good" : "warn", "Google Search Console", seo.gscVerification ? "Đã có mã xác minh." : "Chưa có mã xác minh.");
  push(/^G-/.test(seo.ga4Id || "") ? "good" : "warn", "Google Analytics 4", seo.ga4Id || "Chưa gắn mã GA4.");
  push(seo.defaultImage ? "good" : "warn", "Ảnh chia sẻ mặc định", seo.defaultImage ? "Đã có." : "Chưa có ảnh 1200×630 khi chia sẻ link lên Facebook/Zalo.");
  const noImg = (gallery.items || []).filter(g => !g.img).length;
  push(noImg ? "warn" : "good", "Ảnh không gian", noImg ? `${noImg}/5 ô chưa có ảnh thật.` : "Đủ ảnh.");
  push((faq.items || []).length >= 4 ? "good" : "warn", "Hỏi đáp (schema FAQ)", `${(faq.items || []).length} câu hỏi.`);
  $("#tech").innerHTML = checksHTML({ checks: tech });

  /* ---------- Bảng ---------- */
  let type = "all";
  $("#types").innerHTML = [["all", "Tất cả"], ...Object.entries(TYPE)].map(([k, l]) => `<button class="sx-chip ${k === type ? "on" : ""}" data-t="${k}">${l}</button>`).join("");
  Object.assign($("#types").style, { display: "flex", gap: "6px", flexWrap: "wrap" });
  const lenCls = (n, lo, hi) => n >= lo && n <= hi ? "good" : n ? "warn" : "bad";
  function draw() {
    const q = norm($("#q").value), s = $("#sort").value;
    const rs = results.filter(r => (type === "all" || r.type === type) && (!q || norm([nameOf(r), r.meta.path, r.meta.keyword].join(" ")).includes(q)))
      .sort(s === "asc" ? (a, b) => a.score - b.score : s === "desc" ? (a, b) => b.score - a.score : (a, b) => nameOf(a).localeCompare(nameOf(b), "vi"));
    $("#count").textContent = `${rs.length} trang`;
    $("#rows").innerHTML = rs.length ? rs.map(r => `<tr data-i="${results.indexOf(r)}">
      <td class="sx-pg"><b>${esc(nameOf(r))}</b><small>${esc(r.meta.path)}</small></td><td><span class="sx-tag">${TYPE[r.type]}</span></td>
      <td>${r.meta.keyword ? esc(r.meta.keyword) : `<span class="sx-kw-empty">Chưa có</span>`}</td>
      <td class="sx-hide-sm"><span class="sx-len ${lenCls(r.meta.title.length, 30, 65)}">${r.meta.title.length}</span></td>
      <td class="sx-hide-sm"><span class="sx-len ${r.meta.descAuto ? "warn" : lenCls(r.meta.description.length, 110, 160)}">${r.meta.description.length}${r.meta.descAuto ? " (tự động)" : ""}</span></td>
      <td class="sx-hide-sm">${r.type === "page" ? "–" : r.words}</td><td>${scoreHTML(r.score)}</td></tr>`).join("") : `<tr><td colspan="7" class="sx-empty">Không có trang phù hợp.</td></tr>`;
  }
  $("#types").onclick = e => { const b = e.target.closest("[data-t]"); if (!b) return; type = b.dataset.t; document.querySelectorAll(".sx-chip").forEach(c => c.classList.toggle("on", c === b)); draw(); };
  $("#q").oninput = draw; $("#sort").onchange = draw; draw();

  /* ---------- Chi tiết ---------- */
  const close = () => document.body.classList.remove("sx-open");
  $("#rows").onclick = e => {
    const tr = e.target.closest("tr[data-i]"); if (!tr) return;
    const r = results[tr.dataset.i];
    $("#d-score").innerHTML = scoreHTML(r.score); $("#d-title").textContent = nameOf(r);
    $("#d-body").innerHTML = `<div class="sx-actions"><a class="sx-btn gold" href="/admin/#/collections/${EDIT[r.type]}">Sửa trong trang quản trị</a><a class="sx-btn line" href="${esc(r.meta.path)}" target="_blank">Xem trang</a></div>
      <div><b style="color:var(--sx-green)">Xem trước trên Google</b>${snippetHTML(r.meta)}</div>
      <div><b style="color:var(--sx-green)">Kiểm tra (${r.checks.filter(c => c.status === "good").length}/${r.checks.length} đạt)</b>${checksHTML(r)}</div>
      ${r.type !== "page" ? `<p class="sx-note">Trong trang quản trị: mở “${TYPE[r.type]}”, tìm “${esc(nameOf(r))}”, bấm mở nhóm <b>SEO</b>.</p>` : ""}`;
    document.body.classList.add("sx-open");
  };
  $("#d-close").onclick = close; $("#shade").onclick = close;
  document.addEventListener("keydown", e => e.key === "Escape" && close());
})();
