/* =========================================================
   THIÊN HÀ WELLNESS — tương tác trên trang
   Nội dung (thông tin spa, liệu trình, hỏi đáp…) nằm trong data/*.json,
   sửa tại trang quản trị /admin. build.mjs nhúng sẵn dữ liệu vào trang.
   ========================================================= */
(async function () {
  const { esc, money, prices, durText, priceHTML, servicesHTML, needsHTML, faqHTML, galleryHTML, postCard, titleHTML, assignSlugs } = Render;
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
    fill("#needs", needsHTML(CFG.needs));
    fill("#services", servicesHTML(SERVICES));
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
      $("[data-price]", card).innerHTML = priceHTML(p);
    }
    const book = e.target.closest("[data-book]");
    if (book && $("#f-service")) {
      e.preventDefault();
      const card = book.closest(".svc"), m = $("[data-min].on", card)?.dataset.min;
      $("#f-service").value = `${book.dataset.book}|${m}`;
      $("#dat-lich").scrollIntoView({ behavior: "smooth" });
    }
  });

  // Thẻ "Cơ thể bạn cần gì" -> cuộn tới nhóm dịch vụ và làm nổi các liệu trình trong nhóm
  $$("[data-pick]").forEach(a => a.addEventListener("click", () => {
    $$(".svc").forEach(c => c.classList.remove("pick"));
    const target = $("#" + a.dataset.pick) || $("#svc-" + a.dataset.pick);
    if (!target) return;
    const cards = target.classList.contains("svc") ? [target] : $$(".svc", target);
    cards.forEach(c => c.classList.add("reveal", "in", "pick"));
    setTimeout(() => cards.forEach(c => c.classList.remove("pick")), 3500);
  }));

  /* ---------- Form đặt lịch ---------- */
  const form = $("#booking-form");
  if (form) {
    const groups = [...new Set(SERVICES.map(s => s.group || "Liệu trình khác"))];
    $("#f-service").innerHTML = `<option value="">— Chưa chọn, cần tư vấn —</option>` + groups.map(g =>
      `<optgroup label="${esc(g)}">${SERVICES.filter(s => (s.group || "Liệu trình khác") === g).map(s => prices(s).map(p =>
        `<option value="${esc(s.id)}|${p.min}">${esc(s.name)} · ${durText(p.min)} · ${money(p.price)}</option>`).join("")).join("")}</optgroup>`).join("");
    const times = []; for (let h = 9; h <= 20; h++) for (const mm of ["00", "30"]) if (!(h === 20 && mm === "30")) times.push(`${String(h).padStart(2, "0")}:${mm}`);
    $("#f-time").innerHTML = `<option value="">Giờ bất kỳ</option>` + times.map(t => `<option>${t}</option>`).join("");
    const today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    $("#f-date").min = today.toISOString().slice(0, 10);
    // Từ trang liệu trình: /?dv=co-vai-gay|60#dat-lich
    const dv = new URLSearchParams(location.search).get("dv");
    if (dv && [...$("#f-service").options].some(o => o.value === dv)) $("#f-service").value = dv;

    const done = $("#booking-done"), btn = $("#f-submit");
    $("#f-opened").value = Date.now();   // chống bot: gửi quá nhanh sau khi mở trang sẽ bị bỏ qua
    if (new URLSearchParams(location.search).get("loi") === "dat-lich") $("#form-msg").textContent = "Chưa gửi được lịch, vui lòng thử lại hoặc gọi hotline.";
    const contactBtns = `<span class="form-actions"><a class="btn btn-pearl btn-sm" href="${esc(LINKS.tel)}">Gọi ${esc(CFG.phone || "")}</a><a class="btn btn-ghost btn-sm" href="${esc(LINKS.zalo)}" target="_blank" rel="noopener">Nhắn Zalo</a></span>`;

    form.addEventListener("submit", async e => {
      e.preventDefault();
      const name = $("#f-name").value.trim(), phone = $("#f-phone").value.trim();
      const phoneOk = /^(\+?84|0)\d{9,10}$/.test(phone.replace(/[\s.-]/g, ""));
      $("#f-name").classList.toggle("invalid", !name);
      $("#f-phone").classList.toggle("invalid", !phoneOk);
      if (!name || !phoneOk) { $("#form-msg").textContent = "Vui lòng nhập họ tên và số điện thoại hợp lệ."; (name ? $("#f-phone") : $("#f-name")).focus(); return; }

      // Ghi liệu trình dạng chữ dễ đọc để spa thấy ngay trong email / Netlify
      const sel = $("#f-service"), service = sel.value ? sel.selectedOptions[0].text : "Chưa chọn — cần tư vấn";
      $("#f-service-text").value = service;
      const date = $("#f-date").value ? $("#f-date").value.split("-").reverse().join("/") : "Linh hoạt";
      const when = `${date}${$("#f-time").value ? " · " + $("#f-time").value : ""}`;

      btn.disabled = true; btn.textContent = "Đang gửi…"; $("#form-msg").textContent = "";
      try {
        // Gửi thẳng tới /api/dat-lich → Telegram của spa — khách không phải nhắn lại ở đâu khác
        const res = await fetch("/api/dat-lich", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
        const out = await res.json().catch(() => ({}));
        if (!res.ok || !out.ok) throw new Error(out.error || res.status);
        done.innerHTML = `<span class="done-ic" aria-hidden="true">✓</span>
          <h3>Thiên Hà đã nhận lịch của bạn</h3>
          <p>Cảm ơn <b>${esc(name)}</b>! Chúng tôi sẽ gọi tới <b>${esc(phone)}</b> để xác nhận lịch trong giờ làm việc.</p>
          <dl class="done-sum"><dt>Liệu trình</dt><dd>${esc(service)}</dd><dt>Thời gian</dt><dd>${esc(when)}</dd></dl>
          <p class="done-note">Cần đổi lịch hoặc muốn trao đổi ngay?</p>${contactBtns}
          <button type="button" class="link-again" id="book-again">Đặt thêm lịch khác</button>`;
        form.hidden = true; done.hidden = false; done.focus();
        $("#book-again").onclick = () => { form.reset(); $("#f-opened").value = Date.now(); form.hidden = false; done.hidden = true; $("#f-name").focus(); };
        toast("Đã gửi lịch thành công!");
      } catch (_) {
        // Mất mạng / máy chủ lỗi: giữ nguyên thông tin khách đã nhập, đưa cách liên hệ trực tiếp
        $("#form-msg").innerHTML = `Chưa gửi được do lỗi kết nối. Vui lòng bấm gửi lại, hoặc liên hệ trực tiếp:${contactBtns}`;
      } finally {
        btn.disabled = false; btn.textContent = "Gửi yêu cầu đặt lịch";
      }
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
