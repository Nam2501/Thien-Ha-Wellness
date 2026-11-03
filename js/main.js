/* =========================================================
   THIÊN HÀ WELLNESS — tương tác trên trang
   Nội dung (thông tin spa, liệu trình, hỏi đáp…) nằm trong data/*.json,
   sửa tại trang quản trị /admin. build.mjs nhúng sẵn dữ liệu vào trang.
   ========================================================= */
(async function () {
  const { esc, money, prices, serviceCard, faqHTML, galleryHTML, postCard, titleHTML, assignSlugs } = Render;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const toast = msg => { const t = $("#toast"); if (!t) return; t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 4200); };

  /* ---------- Dữ liệu: ưu tiên bản build nhúng sẵn, không có thì tải data/*.json ---------- */
  let DATA;
  const embedded = $("#site-data");
  if (embedded) DATA = JSON.parse(embedded.textContent);
  else {
    const get = f => fetch(`/data/${f}.json`, { cache: "no-cache" }).then(r => r.ok ? r.json() : {}).catch(() => ({}));
    const [site, services, faq, gallery, posts] = await Promise.all(["site", "services", "faq", "gallery", "posts"].map(get));
    DATA = { site, services: assignSlugs(services.items), faq: faq.items || [], gallery: gallery.items || [], posts: assignSlugs(posts.items) };
  }
  const CFG = DATA.site || {}, SERVICES = DATA.services || [];
  // Ưu tiên link Zalo đầy đủ (link chia sẻ trang cá nhân / Zalo OA) vì zalo.me/<số> chỉ mở được khi tài khoản cho phép tìm bằng số điện thoại
  const LINKS = { tel: "tel:" + String(CFG.phone || "").replace(/[^\d+]/g, ""), zalo: CFG.zaloLink || "https://zalo.me/" + (CFG.zalo || ""), map: CFG.mapUrl, review: CFG.reviewUrl };

  /* ---------- Điền thông tin (khi chưa build) ---------- */
  if (!embedded) {
    $$("[data-cfg]").forEach(el => { if (CFG[el.dataset.cfg]) el.textContent = CFG[el.dataset.cfg]; });
    $$("[data-cfg-html]").forEach(el => { if (CFG[el.dataset.cfgHtml]) el.innerHTML = titleHTML(CFG[el.dataset.cfgHtml]); });
    $$("[data-cfg-href]").forEach(el => { el.href = LINKS[el.dataset.cfgHref] || "#"; });
    const fill = (id, html) => { const el = $(id); if (el && !el.children.length) el.innerHTML = html; };
    fill("#services", SERVICES.map(serviceCard).join(""));
    fill("#faq", faqHTML(DATA.faq));
    fill("#gallery", galleryHTML(DATA.gallery));
    fill("#home-posts", (DATA.posts || []).slice(0, 3).map(postCard).join(""));
  }
  const year = $("#year"); if (year) year.textContent = new Date().getFullYear();

  /* ---------- Bảng giá: đổi thời lượng ---------- */
  const svcBox = $("#services");
  svcBox && svcBox.addEventListener("click", e => {
    const b = e.target.closest("[data-min]");
    if (b) {
      const card = b.closest(".svc"), s = SERVICES.find(x => x.id === card.dataset.id), p = prices(s).find(x => String(x.min) === b.dataset.min);
      $$("[data-min]", card).forEach(x => x.classList.toggle("on", x === b));
      $("[data-price]", card).innerHTML = `${money(p.price)}<small>/ ${p.min}'</small>`;
    }
    const book = e.target.closest("[data-book]");
    if (book && $("#f-service")) {
      e.preventDefault();
      const card = book.closest(".svc"), m = $("[data-min].on", card)?.dataset.min;
      $("#f-service").value = `${book.dataset.book}|${m}`;
      $("#dat-lich").scrollIntoView({ behavior: "smooth" });
    }
  });

  // Thẻ "Cơ thể bạn cần gì" -> làm nổi liệu trình tương ứng
  $$("[data-pick]").forEach(a => a.addEventListener("click", () => {
    $$(".svc").forEach(c => c.classList.remove("pick"));
    const card = $("#svc-" + a.dataset.pick);
    if (card) { card.classList.add("pick"); setTimeout(() => card.classList.remove("pick"), 3500); }
  }));

  /* ---------- Form đặt lịch ---------- */
  const form = $("#booking-form");
  if (form) {
    $("#f-service").innerHTML = `<option value="">— Chưa chọn, cần tư vấn —</option>` + SERVICES.map(s =>
      `<optgroup label="${esc(s.name)}">${prices(s).map(p => `<option value="${esc(s.id)}|${p.min}">${esc(s.name)} · ${p.min} phút · ${money(p.price)}</option>`).join("")}</optgroup>`).join("");
    const times = []; for (let h = 9; h <= 20; h++) for (const mm of ["00", "30"]) if (!(h === 20 && mm === "30")) times.push(`${String(h).padStart(2, "0")}:${mm}`);
    $("#f-time").innerHTML = `<option value="">Giờ bất kỳ</option>` + times.map(t => `<option>${t}</option>`).join("");
    const today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    $("#f-date").min = today.toISOString().slice(0, 10);
    // Từ trang liệu trình: /?dv=co-vai-gay|60#dat-lich
    const dv = new URLSearchParams(location.search).get("dv");
    if (dv && [...$("#f-service").options].some(o => o.value === dv)) $("#f-service").value = dv;

    form.addEventListener("submit", async e => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(form));
      const phoneOk = /^(\+?84|0)\d{9,10}$/.test(d.phone.replace(/[\s.-]/g, ""));
      form.name.classList.toggle("invalid", !d.name.trim());
      form.phone.classList.toggle("invalid", !phoneOk);
      if (!d.name.trim() || !phoneOk) { $("#form-msg").textContent = "Vui lòng nhập họ tên và số điện thoại hợp lệ."; return; }
      const [sid, mins] = (d.service || "").split("|"), s = SERVICES.find(x => x.id === sid);
      const msg = [`ĐẶT LỊCH — ${CFG.name || "Thiên Hà Wellness"}`, `Khách: ${d.name}`, `SĐT: ${d.phone}`,
        `Liệu trình: ${s ? `${s.name} (${mins} phút)` : "Cần tư vấn"}`,
        `Thời gian: ${d.date ? d.date.split("-").reverse().join("/") : "Linh hoạt"} ${d.time || ""}`.trim(),
        d.note ? `Ghi chú: ${d.note}` : ""].filter(Boolean).join("\n");
      // Website tĩnh chưa có máy chủ: sao chép nội dung và mở Zalo để khách gửi cho spa
      let copied = false;
      try { await navigator.clipboard.writeText(msg); copied = true; } catch (_) {}
      window.open(LINKS.zalo, "_blank", "noopener");
      // Luôn có nút dự phòng: Zalo không mở được (chặn popup, tài khoản ẩn số) thì khách vẫn gọi được
      $("#form-msg").innerHTML = (copied ? "Đã sao chép thông tin đặt lịch — dán vào Zalo và gửi cho Thiên Hà." : "Vui lòng gửi thông tin đặt lịch cho Thiên Hà qua Zalo hoặc gọi hotline.") +
        `<span class="form-actions"><a class="btn btn-pearl btn-sm" href="${esc(LINKS.zalo)}" target="_blank" rel="noopener">Mở Zalo</a><a class="btn btn-ghost btn-sm" href="${esc(LINKS.tel)}">Gọi ${esc(CFG.phone || "")}</a></span>`;
      toast("Cảm ơn bạn! Thiên Hà sẽ liên hệ xác nhận lịch sớm.");
      form.reset();
    });
  }

  /* ---------- Header & menu ---------- */
  const header = $("#header"), menuBtn = $("#menu-btn"), nav = $("#nav");
  const solid = document.body.classList.contains("subpage");
  const onScroll = () => header.classList.toggle("scrolled", solid || scrollY > 30);
  addEventListener("scroll", onScroll, { passive: true }); onScroll();
  menuBtn.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", open); header.classList.toggle("menu-open", open);
  });
  $$("#nav a").forEach(a => a.addEventListener("click", () => { nav.classList.remove("open"); menuBtn.setAttribute("aria-expanded", false); header.classList.remove("menu-open"); }));

  /* ---------- Hiệu ứng xuất hiện khi cuộn ---------- */
  $$(".head-center, .head-split, .need, .svc, .about-copy, .about-art, .value, .journey li, .gallery figure, .reviews > *, .faq details, .booking > *, .post").forEach(el => el.classList.add("reveal"));
  const io = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }), { rootMargin: "0px 0px -8% 0px" }) : null;
  $$(".reveal").forEach(el => io ? io.observe(el) : el.classList.add("in"));

  /* ---------- Bầu trời sao (Thiên Hà) ---------- */
  const c = $("#stars");
  if (c) {
    const ctx = c.getContext("2d"), still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w, h, pts = [];
    const size = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = c.clientWidth; h = c.clientHeight; c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      pts = Array.from({ length: Math.round(w * h / 5200) }, () => {
        // dồn mật độ sao theo một dải chéo như dải ngân hà
        const t = Math.random(), band = (Math.random() - .5) * h * .45 * Math.random();
        return { x: t * w, y: h * .15 + t * h * .45 + band, r: Math.random() * 1.3 + .2, a: Math.random(), s: Math.random() * .015 + .004, v: Math.random() * .08 + .02 };
      });
    };
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        p.a += p.s; const o = .35 + Math.abs(Math.sin(p.a)) * .65;
        if (!still) { p.x += p.v; if (p.x > w) p.x = 0; }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fillStyle = `rgba(217,235,243,${o})`; ctx.fill();
      }
      if (!still) requestAnimationFrame(draw);
    };
    size(); draw(); addEventListener("resize", () => { size(); if (still) draw(); });
  }
})();
