/* =========================================================
   THIÊN HÀ WELLNESS — tương tác trên trang
   Nội dung (thông tin spa, liệu trình, hỏi đáp…) nằm trong data/*.json,
   sửa tại trang quản trị /admin. build.mjs nhúng sẵn dữ liệu vào trang.
   ========================================================= */
(async function () {
  const { esc, money, prices, durText, priceHTML, servicesHTML, priceSummaryHTML, needsHTML, faqHTML, galleryHTML, postCard, titleHTML, assignSlugs } = Render;
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
    fill("#price-summary", priceSummaryHTML(SERVICES));
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
    const inner = $$(".svc", target), cards = target.classList.contains("svc") || !inner.length ? [target] : inner;
    cards.forEach(c => c.classList.add("reveal", "in", "pick"));
    setTimeout(() => cards.forEach(c => c.classList.remove("pick")), 3500);
  }));

  // Trang bảng giá: mở bằng /bang-gia/#nhom-... thì làm nổi nhóm đó vài giây
  const pickHash = () => {
    const g = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (!g || !g.classList.contains("pl-group")) return;
    g.classList.add("pick"); setTimeout(() => g.classList.remove("pick"), 2500);
  };
  if ($(".pl-group")) { pickHash(); addEventListener("hashchange", pickHash); }

  /* ---------- Form đặt lịch ---------- */
  const form = $("#booking-form");
  if (form) {
    const groups = [...new Set(SERVICES.map(s => s.group || "Liệu trình khác"))];
    $("#f-service").innerHTML = `<option value="">— Chưa chọn, cần tư vấn —</option>` + groups.map(g =>
      `<optgroup label="${esc(g)}">${SERVICES.filter(s => (s.group || "Liệu trình khác") === g).map(s => prices(s).map(p =>
        `<option value="${esc(s.id)}|${p.min}">${esc(s.name)} · ${durText(p.min)} · ${money(p.price)}</option>`).join("")).join("")}</optgroup>`).join("");
    /* Ngày & giờ đặt lịch — luôn tính theo giờ Việt Nam (khách ở múi giờ khác vẫn đúng)
       - Chỉ đặt từ hôm nay tới MAX_DAYS ngày tới; giờ nhận khách 09:00–20:00, mỗi 30 phút
       - Hôm nay: ẩn các giờ đã qua (cần báo trước ít nhất LEAD_MIN phút); hết giờ thì tự chuyển sang ngày mai */
    const MAX_DAYS = 60, LEAD_MIN = 30;
    const times = []; for (let h = 9; h <= 20; h++) for (const mm of ["00", "30"]) if (!(h === 20 && mm === "30")) times.push(`${String(h).padStart(2, "0")}:${mm}`);
    const vnNow = () => { const d = new Date(Date.now() + 7 * 3600e3); return { date: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes() }; };
    const addDays = (iso, n) => new Date(Date.parse(iso) + n * 864e5).toISOString().slice(0, 10);
    const toMin = t => +t.slice(0, 2) * 60 + +t.slice(3);
    const fDate = $("#f-date"), fTime = $("#f-time");
    const slotsFor = date => { const now = vnNow(); return date === now.date ? times.filter(t => toMin(t) >= now.min + LEAD_MIN) : times; };
    const firstDay = () => { const now = vnNow(); return slotsFor(now.date).length ? now.date : addDays(now.date, 1); };
    // Danh sách ngày hiển thị cố định dd/mm/yyyy (ô lịch của trình duyệt đổi định dạng theo ngôn ngữ máy → dễ nhầm)
    const THU = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
    const dmy = iso => iso.split("-").reverse().join("/");
    const renderDates = () => {
      const keep = fDate.value, today = vnNow().date, start = firstDay(), opts = [];
      for (let i = 0; i <= MAX_DAYS; i++) {
        const iso = addDays(today, i); if (iso < start) continue;
        const name = i === 0 ? "Hôm nay" : i === 1 ? "Ngày mai" : THU[new Date(iso).getUTCDay()];
        opts.push(`<option value="${iso}"${iso === keep ? " selected" : ""}>${name} · ${dmy(iso)}</option>`);
      }
      fDate.innerHTML = `<option value="">Linh hoạt — spa gọi tư vấn</option>` + opts.join("");
    };
    const renderTimes = () => {
      const keep = fTime.value, list = slotsFor(fDate.value || firstDay());
      fTime.innerHTML = `<option value="">Giờ bất kỳ</option>` + list.map(t => `<option${t === keep ? " selected" : ""}>${t}</option>`).join("");
    };
    // Kiểm tra ngày/giờ: trả về câu báo lỗi, hoặc "" nếu hợp lệ
    const checkWhen = () => {
      const d = fDate.value, min = firstDay(), max = addDays(vnNow().date, MAX_DAYS);
      if (d && d < min) return "Ngày đã qua, vui lòng chọn từ " + dmy(min) + " trở đi.";
      if (d && d > max) return `Chỉ nhận đặt lịch trong vòng ${MAX_DAYS} ngày tới.`;
      if (fTime.value && !slotsFor(d || min).includes(fTime.value)) return "Giờ này đã qua, vui lòng chọn giờ khác.";
      return "";
    };
    const syncLimits = renderDates;
    syncLimits(); renderTimes();
    fDate.addEventListener("change", () => { renderTimes(); const m = checkWhen(); fDate.classList.toggle("invalid", !!m); $("#form-msg").textContent = m; });
    fDate.addEventListener("focus", syncLimits);   // trang mở qua nửa đêm: cập nhật lại danh sách ngày
    fTime.addEventListener("focus", renderTimes);   // trang mở lâu: cập nhật lại các giờ đã qua
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
      const pickedDate = fDate.value;
      syncLimits(); renderTimes();
      const whenErr = pickedDate && fDate.value !== pickedDate ? "Ngày đã qua, vui lòng chọn lại ngày." : checkWhen();
      fDate.classList.toggle("invalid", !!whenErr && (!fDate.value && !!pickedDate || /Ngày|ngày/.test(whenErr)));
      fTime.classList.toggle("invalid", !!whenErr && !fDate.classList.contains("invalid"));
      if (whenErr) { $("#form-msg").textContent = whenErr; (fDate.classList.contains("invalid") ? fDate : fTime).focus(); return; }

      // Ghi liệu trình dạng chữ dễ đọc để spa thấy ngay trong tin Telegram
      const sel = $("#f-service"), service = sel.value ? sel.selectedOptions[0].text : "Chưa chọn — cần tư vấn";
      $("#f-service-text").value = service;
      const date = fDate.value ? fDate.selectedOptions[0].text : "Linh hoạt";
      const when = `${date}${$("#f-time").value ? " · " + $("#f-time").value : ""}`;

      btn.disabled = true; btn.textContent = "Đang gửi…"; $("#form-msg").textContent = "";
      try {
        // Gửi thẳng tới /api/dat-lich → Telegram của spa — khách không phải nhắn lại ở đâu khác
        const res = await fetch("/api/dat-lich", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
        const out = await res.json().catch(() => ({}));
        if (res.status === 422 && out.error) { $("#form-msg").textContent = out.error; return; }   // dữ liệu chưa hợp lệ (vd giờ vừa trôi qua)
        if (!res.ok || !out.ok) throw new Error(out.error || res.status);
        done.innerHTML = `<span class="done-ic" aria-hidden="true">✓</span>
          <h3>Thiên Hà đã nhận lịch của bạn</h3>
          <p>Cảm ơn <b>${esc(name)}</b>! Chúng tôi sẽ gọi tới <b>${esc(phone)}</b> để xác nhận lịch trong giờ làm việc.</p>
          <dl class="done-sum"><dt>Liệu trình</dt><dd>${esc(service)}</dd><dt>Thời gian</dt><dd>${esc(when)}</dd></dl>
          <p class="done-note">Cần đổi lịch hoặc muốn trao đổi ngay?</p>${contactBtns}
          <button type="button" class="link-again" id="book-again">Đặt thêm lịch khác</button>`;
        form.hidden = true; done.hidden = false; done.focus();
        $("#book-again").onclick = () => { form.reset(); syncLimits(); renderTimes(); $("#f-opened").value = Date.now(); form.hidden = false; done.hidden = true; $("#f-name").focus(); };
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
