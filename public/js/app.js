(() => {
  const C = window.RS_CONTENT;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const app = $("#app");
  const rupiah = n => "Rp" + Math.round(n || 0).toLocaleString("id-ID");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const initials = name => name.split(/[\s:]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  const cover = (g, cls = "") => `<div class="cover ${cls}" style="--c1:${g.colors[0]};--c2:${g.colors[1]}"><span>${esc(initials(g.name))}</span></div>`;
  const utc = s => new Date(s); // tanggal dari server (ISO 8601)
  const fmtDate = s => (s ? utc(s).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "-");
  const ago = s => {
    const m = Math.max(0, Math.round((Date.now() - utc(s)) / 60000));
    return m < 1 ? "baru saja" : m < 60 ? `${m} menit lalu` : m < 1440 ? `${Math.round(m / 60)} jam lalu` : `${Math.round(m / 1440)} hari lalu`;
  };

  let CFG = { user: null, mock: {}, tabs: [], whatsappCs: "" };
  let GAMES = [];
  let timers = [];
  const later = (fn, ms, repeat) => timers.push(repeat ? setInterval(fn, ms) : setTimeout(fn, ms));

  // ---------- API ----------
  async function api(path, body, method) {
    const res = await fetch("/api" + path, {
      method: method || (body ? "POST" : "GET"),
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || "Terjadi kesalahan"), { status: res.status });
    return data;
  }

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove("show"), 3000);
  }
  function openModal(html) {
    $("#modalCard").innerHTML = html;
    $("#modal").hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeModal() {
    $("#modal").hidden = true;
    document.body.style.overflow = "";
  }
  $("#modal").addEventListener("click", e => { if (e.target.closest("[data-close]")) closeModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

  const waLink = text => `https://wa.me/${CFG.whatsappCs}?text=${encodeURIComponent(text || "Halo CS RhineShop, saya butuh bantuan.")}`;
  document.addEventListener("click", e => {
    const a = e.target.closest("[data-wa]");
    if (a) { e.preventDefault(); window.open(waLink(a.dataset.waText), "_blank", "noopener"); }
  });

  const PAY_COLORS = { QRIS: "#e2231a", DANA: "#118eea", OVO: "#4c2a86", SHOPEEPAY: "#ee4d2d", GOPAY: "#00aed6", BCAVA: "#005eb8", BRIVA: "#00529c", BNIVA: "#f15a23", MANDIRIVA: "#003d79", ALFAMART: "#d71920", INDOMARET: "#0c58a8", SALDO: "#6c5cff" };
  const payLogo = c => c.icon ? `<img class="pay-logo img" src="${esc(c.icon)}" alt="${esc(c.name)}" loading="lazy" />`
    : `<span class="pay-logo" style="--pc:${PAY_COLORS[c.code] || "#334"}">${esc(c.code === "SALDO" ? "SALDO" : c.name.split(" ")[0])}</span>`;
  const feeOf = (c, amount) => Math.ceil(c.feeFlat + (amount * c.feePercent) / 100);
  const statusClass = s => ({ SUCCESS: "ok", PAID: "ok", PROCESSING: "info", REFUNDED: "info", FAILED: "bad", EXPIRED: "bad" }[s] || "wait");

  const countdown = (el, endAt, onEnd) => {
    const tick = () => {
      const ms = utc(endAt) - Date.now();
      if (ms <= 0) { el.textContent = "Berakhir"; onEnd?.(); return false; }
      const h = Math.floor(ms / 3600e3), m = Math.floor((ms % 3600e3) / 60e3), s = Math.floor((ms % 60e3) / 1e3);
      el.innerHTML = [h, m, s].map(v => `<span>${String(v).padStart(2, "0")}</span>`).join(":");
      return true;
    };
    if (tick()) later(tick, 1000, true);
  };

  // ---------- Beranda ----------
  async function homePage() {
    const [flash, reviews] = await Promise.all([api("/flash-sale").catch(() => []), api("/reviews").catch(() => ({ list: [] }))]);
    const popular = GAMES.filter(g => g.popular);
    const tabs = ["Semua", ...CFG.tabs.filter(t => GAMES.some(g => g.category === t))];
    const flashEnd = flash.length ? flash.reduce((a, f) => (f.endAt < a ? f.endAt : a), flash[0].endAt) : null;

    app.innerHTML = `
      <section class="container hero">
        <div class="slider" id="slider">
          ${C.banners.map((b, i) => `
            <a href="${b.href || "#/game/" + b.slug}" class="slide ${i === 0 ? "active" : ""}" style="--c1:${b.colors[0]};--c2:${b.colors[1]}">
              <div><h2>${esc(b.title)}</h2><p>${esc(b.text)}</p><span class="btn btn-light">${b.href ? "Daftar Sekarang" : "Top Up Sekarang"}</span></div>
            </a>`).join("")}
          <div class="dots">${C.banners.map((_, i) => `<button data-dot="${i}" class="${i === 0 ? "active" : ""}" aria-label="Slide ${i + 1}"></button>`).join("")}</div>
        </div>
      </section>

      ${flash.length ? `
      <section class="container section">
        <div class="flash-head"><h3>⚡ Flash Sale</h3><div class="countdown" id="flashCd"></div></div>
        <div class="flash-row">
          ${flash.map(f => `
            <a class="flash-card" href="#/game/${f.game.slug}?sku=${encodeURIComponent(f.sku)}">
              ${cover(f.game, "sm")}
              <div class="flash-info">
                <small class="muted">${esc(f.game.name)}</small>
                <b>${esc(f.productName.replace(new RegExp("^" + f.game.name, "i"), "").trim() || f.productName)}</b>
                <div><span class="price-now">${rupiah(f.price)}</span> <s class="muted">${rupiah(f.normalPrice)}</s></div>
                ${f.stockLeft != null ? `<div class="stock"><i style="width:${Math.max(6, (f.stockLeft / (f.stockLeft + f.sold)) * 100)}%"></i></div><small class="muted">Sisa ${f.stockLeft}</small>` : ""}
              </div>
            </a>`).join("")}
        </div>
      </section>` : ""}

      <section class="container section">
        <div class="section-head"><h3>🔥 Populer Sekarang</h3><p class="muted">Game yang paling banyak di-top up</p></div>
        <div class="popular-grid">
          ${popular.map(g => `<a class="popular-card" href="#/game/${g.slug}">${cover(g, "sm")}<div><b>${esc(g.name)}</b><small>${esc(g.publisher)}</small></div></a>`).join("")}
        </div>
      </section>

      <section class="container section">
        <div class="tabs" id="tabs">${tabs.map((c, i) => `<button class="${i === 0 ? "active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}</div>
        <div class="game-grid" id="gameGrid"></div>
      </section>

      <section class="container section features">
        ${[["⚡", "Proses Instan", "Pesanan diproses otomatis dalam hitungan detik."], ["💸", "Harga Termurah", "Harga bersaing, lebih murah lagi untuk member."], ["🛡️", "Aman & Terpercaya", "Pembayaran via payment gateway resmi."], ["🕐", "Buka 24 Jam", "Top up kapan saja, CS siap membantu."]]
          .map(([i, t, d]) => `<div class="feature"><span>${i}</span><b>${t}</b><p class="muted">${d}</p></div>`).join("")}
      </section>

      ${reviews.list.length ? `
      <section class="container section">
        <div class="section-head"><h3>⭐ Kata Mereka</h3><p class="muted">Rating ${reviews.average}/5 dari ${reviews.count} ulasan pembeli</p></div>
        <div class="review-grid">
          ${reviews.list.map(r => `<div class="review"><div class="stars">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</div><p>"${esc(r.comment)}"</p><small class="muted"><b>${esc(r.name)}</b> · ${esc(r.game_name)}</small></div>`).join("")}
        </div>
      </section>` : ""}

      <section class="container section">
        <div class="section-head"><h3>❓ Pertanyaan Umum</h3></div>
        ${faqHtml(C.faq.slice(0, 4))}
        <p class="mt"><a class="link" href="#/faq">Lihat semua FAQ →</a></p>
      </section>`;

    const renderGrid = cat => {
      const list = cat === "Semua" ? GAMES : GAMES.filter(g => g.category === cat);
      $("#gameGrid").innerHTML = list.map(g => `
        <a class="game-card" href="#/game/${g.slug}">${cover(g)}<div class="game-info"><b>${esc(g.name)}</b><small>${esc(g.publisher)}</small></div></a>`).join("")
        || `<p class="muted">Belum ada produk di kategori ini.</p>`;
    };
    renderGrid("Semua");
    $("#tabs").addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      $$("#tabs button").forEach(x => x.classList.toggle("active", x === b));
      renderGrid(b.dataset.cat);
    });
    if (flashEnd) countdown($("#flashCd"), flashEnd, () => setTimeout(router, 1500));

    let idx = 0;
    const slides = $$(".slide"), dots = $$("[data-dot]");
    const go = i => { idx = (i + slides.length) % slides.length; slides.forEach((s, j) => s.classList.toggle("active", j === idx)); dots.forEach((d, j) => d.classList.toggle("active", j === idx)); };
    dots.forEach(d => d.addEventListener("click", e => { e.preventDefault(); go(+d.dataset.dot); }));
    later(() => go(idx + 1), 5000, true);
  }

  const faqHtml = list => `<div class="faq">${list.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${a}</p></details>`).join("")}</div>`;

  // ---------- Halaman game ----------
  async function gamePage(slug, query) {
    const [g, channels] = await Promise.all([api(`/games/${encodeURIComponent(slug)}`), api("/payment-channels")]);
    const state = { product: null, method: null, promo: null, nickname: null };
    const n = (i => () => ++i)(0);
    const groups = [...new Set(channels.map(c => c.group))];
    const LABEL = { best: "🔥 Terlaris", promo: "🏷️ Promo" };

    app.innerHTML = `
      <section class="game-banner" style="--c1:${g.colors[0]};--c2:${g.colors[1]}">
        <div class="container game-banner-inner">${cover(g, "lg")}<div><h1>${esc(g.name)}</h1><p>${esc(g.publisher)}</p>
          <div class="badges"><span>⚡ Proses Instan</span><span>🛡️ Aman</span><span>💬 CS 24 Jam</span></div></div></div>
      </section>
      <div class="container game-layout">
        <aside class="card guide">
          <h4>Cara Top Up</h4>
          <ol>
            ${g.fields.length ? "<li>Masukkan data akun.</li>" : ""}
            <li>Pilih nominal yang diinginkan.</li>
            <li>Pilih metode pembayaran.</li>
            <li>Masukkan nomor WhatsApp.</li>
            <li>Klik <b>Beli Sekarang</b> dan selesaikan pembayaran.</li>
          </ol>
          <p class="muted">${esc(g.guide)}</p>
          ${CFG.user ? `<p class="member-note">Harga ${CFG.user.role === "reseller" ? "reseller" : "member"} aktif ✓</p>` : `<p class="member-note"><a href="#/daftar">Daftar member</a> untuk harga lebih murah.</p>`}
        </aside>
        <form class="steps" id="orderForm" novalidate>
          ${g.fields.length ? `
          <div class="card step"><div class="step-head"><span class="num">${n()}</span><h4>Masukkan Data Akun</h4></div>
            <div class="field-row">
              ${g.fields.map(f => `<label><span>${esc(f.label)}</span><input name="${f.key}" placeholder="${esc(f.placeholder)}" required autocomplete="off" /></label>`).join("")}
            </div>
            ${g.canCheckNickname ? `<div class="nick-row"><button type="button" class="btn btn-ghost btn-sm" id="checkNick">🔍 Cek ID</button><span id="nickResult" class="muted">Pastikan ID benar sebelum membayar.</span></div>` : ""}
          </div>` : ""}
          <div class="card step"><div class="step-head"><span class="num">${n()}</span><h4>Pilih Nominal</h4></div>
            <div class="product-grid">
              ${g.products.map(p => `
                <button type="button" class="product ${p.flash ? "is-flash" : ""}" data-product="${esc(p.sku)}">
                  ${p.flash ? `<em class="tag flash">⚡ Flash Sale</em>` : p.label ? `<em class="tag ${p.label}">${LABEL[p.label]}</em>` : ""}
                  <b>${esc(p.name)}</b>
                  <span>${rupiah(p.price)}</span>
                  ${p.normalPrice && p.normalPrice > p.price ? `<s class="muted">${rupiah(p.normalPrice)}</s>` : ""}
                </button>`).join("") || `<p class="muted">Produk sedang tidak tersedia.</p>`}
            </div>
          </div>
          <div class="card step"><div class="step-head"><span class="num">${n()}</span><h4>Pilih Pembayaran</h4></div>
            ${groups.map((grp, i) => `
              <details class="pay-group" ${i === 0 ? "open" : ""}><summary>${esc(grp)}</summary>
                <div class="pay-methods">
                  ${channels.filter(c => c.group === grp).map(c => `
                    <button type="button" class="pay" data-method="${esc(c.code)}">${payLogo(c)}
                      <span class="pay-name">${esc(c.name)}${c.code === "SALDO" ? `<small class="muted">Saldo: ${rupiah(c.balance)}</small>` : ""}</span>
                      <span class="pay-price" data-price-for="${esc(c.code)}">-</span></button>`).join("")}
                </div>
              </details>`).join("")}
          </div>
          <div class="card step"><div class="step-head"><span class="num">${n()}</span><h4>Detail Kontak</h4></div>
            <label><span>Nomor WhatsApp</span><input name="whatsapp" type="tel" placeholder="08xxxxxxxxxx" value="${esc(CFG.user?.whatsapp || "")}" required /></label>
            <small class="muted">Bukti transaksi dan kode voucher dikirim ke nomor ini.</small>
            <label class="mt"><span>Kode Promo (opsional)</span>
              <div class="inline"><input name="promo" placeholder="Masukkan kode promo" autocomplete="off" /><button type="button" class="btn btn-ghost" id="applyPromo">Pakai</button></div>
            </label>
            <small id="promoMsg" class="muted"></small>
          </div>
          <div class="card summary sticky-buy">
            <div><small class="muted" id="sumProduct">Belum memilih nominal</small><b id="sumTotal">${rupiah(0)}</b></div>
            <button type="submit" class="btn btn-primary" id="buyBtn">🛒 Beli Sekarang</button>
          </div>
        </form>
      </div>`;

    const form = $("#orderForm");
    const amount = () => (state.product ? state.product.price - (state.promo?.discount || 0) : 0);
    const update = () => {
      const a = amount();
      channels.forEach(c => {
        const el = $(`[data-price-for="${CSS.escape(c.code)}"]`);
        const btn = el.closest(".pay");
        const tooLow = c.minAmount && a && a < c.minAmount;
        const noBalance = c.code === "SALDO" && a > c.balance;
        btn.disabled = !!(tooLow || noBalance);
        el.textContent = !a ? "-" : tooLow ? `Min. ${rupiah(c.minAmount)}` : noBalance ? "Saldo kurang" : rupiah(a + feeOf(c, a));
      });
      if (state.method && $(`[data-method="${CSS.escape(state.method.code)}"]`).disabled) {
        state.method = null;
        $$(".pay").forEach(x => x.classList.remove("active"));
      }
      if (!state.product) return;
      $("#sumProduct").textContent = `${state.product.name}${state.method ? " · " + state.method.name : ""}${state.promo ? " · Promo " + state.promo.code : ""}`;
      $("#sumTotal").textContent = rupiah(a + (state.method ? feeOf(state.method, a) : 0));
    };
    const selectProduct = btn => {
      state.product = g.products.find(p => p.sku === btn.dataset.product);
      $$(".product").forEach(x => x.classList.toggle("active", x === btn));
      if (state.promo) { state.promo = null; $("#promoMsg").textContent = "Kode promo perlu dipakai ulang setelah ganti nominal."; }
      update();
    };

    form.addEventListener("click", e => {
      const pb = e.target.closest("[data-product]");
      if (pb) selectProduct(pb);
      const mb = e.target.closest("[data-method]");
      if (mb && !mb.disabled) { state.method = channels.find(c => c.code === mb.dataset.method); $$(".pay").forEach(x => x.classList.toggle("active", x === mb)); update(); }
    });
    if (query.get("sku")) {
      const b = $(`[data-product="${CSS.escape(query.get("sku"))}"]`);
      if (b) { selectProduct(b); b.scrollIntoView({ block: "center" }); }
    }

    // Reset hasil cek nickname bila ID diubah
    g.fields.forEach(f => form[f.key].addEventListener("input", () => {
      state.nickname = null;
      const r = $("#nickResult"); if (r) { r.className = "muted"; r.textContent = "Pastikan ID benar sebelum membayar."; }
    }));
    $("#checkNick")?.addEventListener("click", async () => {
      const r = $("#nickResult");
      const userId = form.userId.value.trim(), zoneId = form.zoneId?.value.trim() || "";
      if (!userId || (form.zoneId && !zoneId)) return toast("Lengkapi data akun terlebih dahulu");
      r.className = "muted"; r.textContent = "Mengecek...";
      try {
        const { nickname } = await api("/nickname", { slug: g.slug, userId, zoneId });
        state.nickname = nickname;
        r.className = "ok-text"; r.innerHTML = `✓ Nickname: <b>${esc(nickname)}</b>`;
      } catch (e) {
        r.className = "bad-text"; r.textContent = e.message;
      }
    });

    $("#applyPromo").addEventListener("click", async () => {
      const code = form.promo.value.trim();
      const msg = $("#promoMsg");
      if (!code) { state.promo = null; msg.textContent = ""; return update(); }
      if (!state.product) return toast("Pilih nominal terlebih dahulu");
      try {
        state.promo = await api("/promo/check", { code, amount: state.product.price });
        msg.className = "ok-text"; msg.textContent = `✓ Hemat ${rupiah(state.promo.discount)}`;
      } catch (e) {
        state.promo = null; msg.className = "bad-text"; msg.textContent = e.message;
      }
      update();
    });

    form.addEventListener("submit", e => {
      e.preventDefault();
      const fields = Object.fromEntries(g.fields.map(f => [f.key, form[f.key].value.trim()]));
      for (const f of g.fields) {
        if (!fields[f.key]) return toast(`${f.label} wajib diisi`);
        if (f.pattern && !new RegExp(f.pattern).test(fields[f.key])) return toast(`${f.label} tidak valid`);
      }
      if (!state.product) return toast("Silakan pilih nominal terlebih dahulu");
      if (!state.method) return toast("Silakan pilih metode pembayaran");
      const whatsapp = form.whatsapp.value.trim();
      if (!/^(08|628|\+628)\d{7,12}$/.test(whatsapp.replace(/[\s-]/g, ""))) return toast("Nomor WhatsApp tidak valid");
      const a = amount(), fee = feeOf(state.method, a);
      const account = g.fields.map(f => `${f.label}: ${fields[f.key]}`).join(" · ") || "Kode dikirim ke WhatsApp";

      openModal(`
        <h3>Konfirmasi Pesanan</h3>
        <p class="muted">Pastikan data akun sudah benar. Item yang terkirim ke ID yang salah tidak dapat dikembalikan.</p>
        <dl class="kv">
          <dt>Game</dt><dd>${esc(g.name)}</dd>
          <dt>Akun</dt><dd>${esc(account)}</dd>
          ${state.nickname ? `<dt>Nickname</dt><dd>${esc(state.nickname)}</dd>` : ""}
          <dt>Item</dt><dd>${esc(state.product.name)}</dd>
          <dt>Pembayaran</dt><dd>${esc(state.method.name)}</dd>
          <dt>Harga</dt><dd>${rupiah(state.product.price)}</dd>
          ${state.promo ? `<dt>Diskon</dt><dd>-${rupiah(state.promo.discount)}</dd>` : ""}
          <dt>Biaya Admin</dt><dd>${rupiah(fee)}</dd>
          <dt class="total">Total</dt><dd class="total">${rupiah(a + fee)}</dd>
        </dl>
        <label class="check"><input type="checkbox" id="agree" /> <span>Saya setuju dengan <a href="#/syarat-ketentuan" target="_blank">Syarat & Ketentuan</a></span></label>
        <div class="modal-actions"><button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" id="confirmBtn">Pesan Sekarang</button></div>`);
      $("#confirmBtn").addEventListener("click", async ev => {
        if (!$("#agree").checked) return toast("Centang persetujuan Syarat & Ketentuan");
        ev.target.disabled = true; ev.target.textContent = "Memproses...";
        try {
          const { id } = await api("/orders", { slug: g.slug, sku: state.product.sku, fields, nickname: state.nickname, whatsapp, method: state.method.code, promo: state.promo?.code });
          closeModal();
          location.hash = `#/invoice/${id}`;
        } catch (err) {
          ev.target.disabled = false; ev.target.textContent = "Pesan Sekarang";
          toast(err.message);
        }
      });
    });
    update();
  }

  // ---------- Invoice ----------
  function paymentBox(x, devPayPath) {
    const qr = x.qrUrl ? `<img class="qr" src="${esc(x.qrUrl)}" alt="QR pembayaran" />` : x.paymentMethod === "QRIS" ? `<div class="qr placeholder">QR (simulasi)</div>` : "";
    return `
      <div class="pay-box">
        <p>Selesaikan pembayaran via <b>${esc(x.paymentName)}</b></p>
        ${qr}
        ${x.payCode ? `<div class="va">Kode Bayar / Nomor VA<br><b>${esc(x.payCode)}</b> <button class="btn btn-ghost btn-sm" data-copy="${esc(x.payCode)}">Salin</button></div>` : ""}
        <div class="va">Total Bayar<br><b>${rupiah(x.total)}</b></div>
        ${x.expiredAt ? `<p class="muted">Bayar sebelum ${fmtDate(x.expiredAt)} · <span class="countdown sm" id="payCd"></span></p>` : ""}
        ${x.checkoutUrl ? `<a class="btn btn-ghost" href="${esc(x.checkoutUrl)}" target="_blank" rel="noopener">Lihat cara bayar</a>` : ""}
        ${CFG.mock.payment ? `<button class="btn btn-primary" id="simulatePay" data-path="${devPayPath}">Simulasi Bayar (mode uji)</button>` : ""}
        <small class="muted">Status akan diperbarui otomatis setelah pembayaran diterima.</small>
      </div>`;
  }
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-copy]");
    if (b) navigator.clipboard?.writeText(b.dataset.copy).then(() => toast("Disalin"));
  });

  async function invoicePage(id) {
    const o = await api(`/orders/${encodeURIComponent(id)}`);
    const steps = ["WAITING", "PROCESSING", "SUCCESS"];
    const stepIdx = o.status === "SUCCESS" ? 2 : o.status === "PROCESSING" ? 1 : 0;
    app.innerHTML = `
      <section class="container narrow section">
        <div class="card invoice">
          <div class="invoice-head">
            <div><small class="muted">Nomor Invoice</small><h2>${esc(o.id)} <button class="btn btn-ghost btn-sm" data-copy="${esc(o.id)}">Salin</button></h2></div>
            <span class="status ${statusClass(o.status)}">${esc(o.statusText)}</span>
          </div>
          ${["WAITING", "PROCESSING", "SUCCESS"].includes(o.status) ? `
          <ol class="progress">${["Pembayaran", "Diproses", "Selesai"].map((t, i) => `<li class="${i <= stepIdx ? "done" : ""}">${t}</li>`).join("")}</ol>` : ""}
          ${o.status === "WAITING" && o.paymentStatus === "UNPAID" ? paymentBox(o, `/dev/pay/${o.id}`) : ""}
          ${o.status === "PROCESSING" ? `<div class="info-box">⏳ Pembayaran diterima. Pesanan sedang dikirim ke akun kamu...</div>` : ""}
          ${o.status === "SUCCESS" ? `<div class="paid-box">✅ Pesanan berhasil dikirim.${o.sn ? `<br><small>SN / Kode: <b>${esc(o.sn)}</b></small>` : ""}</div>` : ""}
          ${["FAILED", "REFUNDED", "EXPIRED"].includes(o.status) ? `<div class="fail-box">${esc(o.message || (o.status === "EXPIRED" ? "Batas waktu pembayaran telah habis." : "Pesanan gagal."))}
            ${o.status === "FAILED" ? `<br><a href="#" class="btn btn-ghost btn-sm mt" data-wa data-wa-text="Halo CS, pesanan saya ${esc(o.id)} gagal. Mohon bantuannya.">Hubungi CS</a>` : ""}</div>` : ""}
          <dl class="kv">
            <dt>Tanggal</dt><dd>${fmtDate(o.createdAt)}</dd>
            <dt>Game</dt><dd>${esc(o.gameName)}</dd>
            <dt>Akun</dt><dd>${esc(o.account)}</dd>
            ${o.nickname ? `<dt>Nickname</dt><dd>${esc(o.nickname)}</dd>` : ""}
            <dt>Item</dt><dd>${esc(o.productName)}</dd>
            <dt>Pembayaran</dt><dd>${esc(o.paymentName)}</dd>
            <dt>WhatsApp</dt><dd>${esc(o.whatsapp)}</dd>
            <dt>Harga</dt><dd>${rupiah(o.price)}</dd>
            ${o.discount ? `<dt>Diskon${o.promoCode ? ` (${esc(o.promoCode)})` : ""}</dt><dd>-${rupiah(o.discount)}</dd>` : ""}
            <dt>Biaya Admin</dt><dd>${rupiah(o.fee)}</dd>
            <dt class="total">Total</dt><dd class="total">${rupiah(o.total)}</dd>
          </dl>
          ${o.status === "SUCCESS" && !o.reviewed ? `
          <form class="review-form" id="reviewForm">
            <h4>Beri Ulasan</h4>
            <div class="star-input" id="starInput">${[1, 2, 3, 4, 5].map(i => `<button type="button" data-star="${i}">★</button>`).join("")}</div>
            <input name="reviewer" placeholder="Nama tampilan" maxlength="40" />
            <textarea name="comment" placeholder="Ceritakan pengalamanmu..." maxlength="300" rows="3"></textarea>
            <input name="whatsapp" placeholder="Nomor WhatsApp saat pemesanan (verifikasi)" />
            <button class="btn btn-primary">Kirim Ulasan</button>
          </form>` : ""}
          <div class="modal-actions"><a class="btn btn-ghost" href="#/game/${esc(o.gameSlug)}">Beli Lagi</a></div>
        </div>
      </section>`;

    if (o.expiredAt && $("#payCd")) countdown($("#payCd"), o.expiredAt);
    $("#simulatePay")?.addEventListener("click", async e => {
      e.target.disabled = true;
      await api(e.target.dataset.path, {});
      invoicePage(id);
    });
    if (["WAITING", "PROCESSING"].includes(o.status) && o.paymentStatus !== "EXPIRED") {
      later(async () => {
        const fresh = await api(`/orders/${encodeURIComponent(id)}`).catch(() => null);
        if (fresh && (fresh.status !== o.status || fresh.paymentStatus !== o.paymentStatus)) { clearTimers(); invoicePage(id); }
      }, 4000, true);
    }

    const rf = $("#reviewForm");
    if (rf) {
      let rating = 0;
      $("#starInput").addEventListener("click", e => {
        const b = e.target.closest("[data-star]"); if (!b) return;
        rating = +b.dataset.star;
        $$("#starInput button").forEach((x, i) => x.classList.toggle("on", i < rating));
      });
      rf.addEventListener("submit", async e => {
        e.preventDefault();
        if (!rating) return toast("Pilih jumlah bintang");
        try {
          await api(`/orders/${o.id}/review`, { rating, name: rf.reviewer.value, comment: rf.comment.value, whatsapp: rf.whatsapp.value });
          toast("Terima kasih atas ulasanmu!");
          invoicePage(id);
        } catch (err) { toast(err.message); }
      });
    }
  }

  async function depositPage(id) {
    if (!CFG.user) return (location.hash = "#/masuk");
    const d = await api(`/deposits/${encodeURIComponent(id)}`);
    app.innerHTML = `
      <section class="container narrow section">
        <div class="card invoice">
          <div class="invoice-head">
            <div><small class="muted">Deposit Saldo</small><h2>${esc(d.id)}</h2></div>
            <span class="status ${statusClass(d.status)}">${{ UNPAID: "Menunggu Pembayaran", PAID: "Berhasil", EXPIRED: "Kedaluwarsa", FAILED: "Gagal" }[d.status]}</span>
          </div>
          ${d.status === "UNPAID" ? paymentBox(d, `/dev/pay/${d.id}`) : d.status === "PAID" ? `<div class="paid-box">✅ Saldo ${rupiah(d.amount)} sudah masuk ke akunmu.</div>` : `<div class="fail-box">Deposit tidak dapat diproses.</div>`}
          <dl class="kv">
            <dt>Nominal</dt><dd>${rupiah(d.amount)}</dd>
            <dt>Biaya Admin</dt><dd>${rupiah(d.fee)}</dd>
            <dt class="total">Total</dt><dd class="total">${rupiah(d.total)}</dd>
          </dl>
          <div class="modal-actions"><a class="btn btn-ghost" href="#/akun">Kembali ke Akun</a></div>
        </div>
      </section>`;
    if (d.expiredAt && $("#payCd")) countdown($("#payCd"), d.expiredAt);
    $("#simulatePay")?.addEventListener("click", async e => { e.target.disabled = true; await api(e.target.dataset.path, {}); await refreshConfig(); depositPage(id); });
    if (d.status === "UNPAID") later(async () => {
      const f = await api(`/deposits/${encodeURIComponent(id)}`).catch(() => null);
      if (f && f.status !== d.status) { clearTimers(); await refreshConfig(); depositPage(id); }
    }, 4000, true);
  }

  // ---------- Cek transaksi ----------
  async function cekPage() {
    app.innerHTML = `
      <section class="container narrow section">
        <h1 class="page-title">Cek Transaksi</h1>
        <p class="muted">Lacak status pesananmu menggunakan nomor invoice.</p>
        <form class="card search-inv" id="cekForm">
          <input name="inv" placeholder="Contoh: RS261117ABCDEF1234" required />
          <button class="btn btn-primary">Cari</button>
        </form>
        ${CFG.user ? `<p class="mt muted">Riwayat lengkap ada di <a class="link" href="#/akun">halaman akun</a>.</p>` : ""}
      </section>`;
    $("#cekForm").addEventListener("submit", async e => {
      e.preventDefault();
      const v = e.target.inv.value.trim().toUpperCase();
      try { await api(`/orders/${encodeURIComponent(v)}`); location.hash = `#/invoice/${v}`; } catch { toast("Invoice tidak ditemukan"); }
    });
  }

  // ---------- Leaderboard ----------
  async function leaderboardPage() {
    const lb = await api("/leaderboard");
    const table = (title, list) => `<div class="card"><h4>${title}</h4>${list.length ? `<ol class="lb">${list.map((r, i) => `<li><span class="rank r${i + 1}">${i + 1}</span><span>${esc(r.who)}<small class="muted"> · ${r.count} trx</small></span><b>${rupiah(r.total)}</b></li>`).join("")}</ol>` : `<p class="muted mt">Belum ada transaksi.</p>`}</div>`;
    app.innerHTML = `
      <section class="container section">
        <h1 class="page-title">Leaderboard Top Spender</h1>
        <p class="muted">Top 10 pembeli dengan total transaksi sukses terbanyak.</p>
        <div class="lb-grid">${table("Hari Ini", lb.today)}${table("7 Hari Terakhir", lb.week)}${table("Bulan Ini", lb.month)}</div>
      </section>`;
  }

  function kalkulatorPage() {
    app.innerHTML = `
      <section class="container narrow section">
        <h1 class="page-title">Kalkulator Win Rate</h1>
        <p class="muted">Hitung berapa kemenangan beruntun yang dibutuhkan untuk mencapai win rate target.</p>
        <form class="card calc" id="calcForm">
          <label><span>Total Pertandingan</span><input type="number" name="total" min="1" required placeholder="Contoh: 250" /></label>
          <label><span>Win Rate Saat Ini (%)</span><input type="number" name="wr" min="0" max="100" step="0.01" required placeholder="Contoh: 52.5" /></label>
          <label><span>Target Win Rate (%)</span><input type="number" name="target" min="0" max="99.99" step="0.01" required placeholder="Contoh: 60" /></label>
          <button class="btn btn-primary">Hitung</button>
          <div id="calcResult" class="calc-result" hidden></div>
        </form>
      </section>`;
    $("#calcForm").addEventListener("submit", e => {
      e.preventDefault();
      const t = +e.target.total.value, wr = +e.target.wr.value / 100, tg = +e.target.target.value / 100;
      const r = $("#calcResult"); r.hidden = false;
      if (tg <= wr) { r.innerHTML = "🎉 Win rate kamu sudah mencapai target!"; return; }
      if (tg >= 1) { r.innerHTML = "Target harus di bawah 100%."; return; }
      const need = Math.ceil((tg * t - wr * t) / (1 - tg));
      r.innerHTML = `Kamu membutuhkan <b>${need.toLocaleString("id-ID")}</b> kemenangan tanpa kalah untuk mencapai win rate <b>${(tg * 100).toFixed(2)}%</b>.`;
    });
  }

  // ---------- Akun ----------
  function authPage(mode) {
    if (CFG.user) return (location.hash = "#/akun");
    const reg = mode === "daftar";
    app.innerHTML = `
      <section class="container auth section">
        <form class="card auth-card" id="authForm">
          <h1 class="page-title">${reg ? "Daftar Member" : "Masuk"}</h1>
          <p class="muted">${reg ? "Dapatkan harga member dan bayar pakai saldo tanpa biaya admin." : "Masuk untuk harga member dan riwayat transaksi."}</p>
          ${reg ? `<label><span>Nama</span><input name="name" required autocomplete="name" /></label>` : ""}
          <label><span>Email</span><input name="email" type="email" required autocomplete="email" /></label>
          ${reg ? `<label><span>Nomor WhatsApp</span><input name="whatsapp" type="tel" placeholder="08xxxxxxxxxx" required /></label>` : ""}
          <label><span>Password</span><input name="password" type="password" minlength="8" required autocomplete="${reg ? "new-password" : "current-password"}" /></label>
          ${reg ? `<label class="check"><input type="checkbox" name="agree" /> <span>Saya setuju dengan <a href="#/syarat-ketentuan" target="_blank">Syarat & Ketentuan</a> dan <a href="#/kebijakan-privasi" target="_blank">Kebijakan Privasi</a></span></label>` : ""}
          <button class="btn btn-primary">${reg ? "Daftar" : "Masuk"}</button>
          <p class="muted center">${reg ? `Sudah punya akun? <a class="link" href="#/masuk">Masuk</a>` : `Belum punya akun? <a class="link" href="#/daftar">Daftar</a>`}</p>
        </form>
      </section>`;
    $("#authForm").addEventListener("submit", async e => {
      e.preventDefault();
      const f = e.target;
      if (reg && !f.agree.checked) return toast("Centang persetujuan terlebih dahulu");
      const body = Object.fromEntries(new FormData(f));
      try {
        await api(reg ? "/auth/register" : "/auth/login", body);
        await refreshConfig();
        toast(reg ? "Pendaftaran berhasil!" : "Berhasil masuk");
        location.hash = "#/akun";
      } catch (err) { toast(err.message); }
    });
  }

  async function accountPage() {
    if (!CFG.user) return (location.hash = "#/masuk");
    const [me, channels] = await Promise.all([api("/me"), api("/payment-channels")]);
    const u = me.user;
    const methods = channels.filter(c => c.code !== "SALDO");
    const roleName = { member: "Member", reseller: "Reseller", admin: "Admin" }[u.role];
    app.innerHTML = `
      <section class="container section">
        <div class="account-head card">
          <div><small class="muted">Halo,</small><h2>${esc(u.name)} <span class="role ${u.role}">${roleName}</span></h2><small class="muted">${esc(u.email)} · ${esc(u.whatsapp)}</small></div>
          <div class="balance"><small class="muted">Saldo</small><b>${rupiah(u.balance)}</b></div>
          <div class="account-actions">
            ${u.role === "admin" ? `<a class="btn btn-ghost" href="/admin">Panel Admin</a>` : ""}
            <button class="btn btn-ghost" id="logout">Keluar</button>
          </div>
        </div>
        <div class="account-grid">
          <form class="card" id="depositForm">
            <h4>Isi Saldo</h4>
            <div class="chips">${[20000, 50000, 100000, 250000, 500000].map(v => `<button type="button" data-amt="${v}">${rupiah(v)}</button>`).join("")}</div>
            <label><span>Nominal</span><input name="amount" type="number" min="10000" step="1000" placeholder="Min. Rp10.000" required /></label>
            <label><span>Metode Pembayaran</span><select name="method" required>${methods.map(c => `<option value="${esc(c.code)}">${esc(c.name)}</option>`).join("")}</select></label>
            <button class="btn btn-primary">Deposit</button>
            ${u.role === "member" ? `<p class="muted mt">Ingin harga lebih murah untuk dijual lagi? <a class="link" href="#" data-wa data-wa-text="Halo, saya ingin upgrade akun ${esc(u.email)} menjadi reseller.">Daftar reseller</a></p>` : ""}
          </form>
          <div class="card">
            <h4>Mutasi Saldo</h4>
            ${me.logs.length ? `<ul class="mutasi">${me.logs.map(l => `<li><span>${esc(l.note)}<small class="muted">${fmtDate(l.created_at)}</small></span><b class="${l.amount < 0 ? "bad-text" : "ok-text"}">${l.amount < 0 ? "-" : "+"}${rupiah(Math.abs(l.amount))}</b></li>`).join("")}</ul>` : `<p class="muted mt">Belum ada mutasi.</p>`}
          </div>
        </div>
        <h3 class="mt">Riwayat Transaksi</h3>
        <div class="card table-wrap">
          ${me.orders.length ? `<table><thead><tr><th>Invoice</th><th>Item</th><th>Total</th><th>Status</th></tr></thead><tbody>
            ${me.orders.map(o => `<tr><td><a href="#/invoice/${o.id}">${esc(o.id)}</a><br><small class="muted">${fmtDate(o.createdAt)}</small></td><td>${esc(o.gameName)}<br><small class="muted">${esc(o.productName)}</small></td><td>${rupiah(o.total)}</td><td><span class="status ${statusClass(o.status)}">${esc(o.statusText)}</span></td></tr>`).join("")}
          </tbody></table>` : `<p class="muted">Belum ada transaksi.</p>`}
        </div>
        ${me.deposits.length ? `
        <h3 class="mt">Riwayat Deposit</h3>
        <div class="card table-wrap"><table><thead><tr><th>ID</th><th>Nominal</th><th>Metode</th><th>Status</th></tr></thead><tbody>
          ${me.deposits.map(d => `<tr><td><a href="#/deposit/${d.id}">${esc(d.id)}</a><br><small class="muted">${fmtDate(d.created_at)}</small></td><td>${rupiah(d.amount)}</td><td>${esc(d.payment_name)}</td><td><span class="status ${statusClass(d.status)}">${esc(d.status === "PAID" ? "Berhasil" : d.status === "UNPAID" ? "Menunggu" : "Gagal/Kedaluwarsa")}</span></td></tr>`).join("")}
        </tbody></table></div>` : ""}
      </section>`;
    $("#logout").addEventListener("click", async () => { await api("/auth/logout", {}); await refreshConfig(); location.hash = "#/"; });
    const df = $("#depositForm");
    $$("[data-amt]", df).forEach(b => b.addEventListener("click", () => (df.amount.value = b.dataset.amt)));
    df.addEventListener("submit", async e => {
      e.preventDefault();
      try {
        const { id } = await api("/me/deposit", { amount: +df.amount.value, method: df.method.value });
        location.hash = `#/deposit/${id}`;
      } catch (err) { toast(err.message); }
    });
  }

  // ---------- Halaman statis ----------
  const docPage = (title, html) => {
    app.innerHTML = `<section class="container narrow section"><article class="card doc"><h1 class="page-title">${title}</h1><p class="muted">Terakhir diperbarui: ${C.updatedAt}</p>${html}</article></section>`;
  };
  const faqPage = () => {
    app.innerHTML = `<section class="container narrow section"><h1 class="page-title">FAQ</h1><p class="muted">Pertanyaan yang sering ditanyakan.</p>${faqHtml(C.faq)}
      <div class="card mt center"><p>Masih ada pertanyaan?</p><a href="#" class="btn btn-primary mt" data-wa>Chat CS via WhatsApp</a></div></section>`;
  };

  function notFound(msg = "Halaman tidak ditemukan") {
    app.innerHTML = `<section class="container narrow section center"><h1 class="page-title">404</h1><p class="muted">${esc(msg)}</p><a class="btn btn-primary mt" href="#/">Kembali ke Beranda</a></section>`;
  }

  // ---------- Notifikasi transaksi live ----------
  async function startLiveFeed() {
    const list = await api("/recent").catch(() => []);
    if (!list.length) return;
    let i = 0;
    const el = $("#liveToast");
    const show = () => {
      const r = list[i++ % list.length];
      el.innerHTML = `<span class="dot"></span><div><b>${esc(r.who)}</b> membeli <b>${esc(r.product)}</b><small class="muted">${esc(r.game)} · ${ago(r.at)}</small></div>`;
      el.classList.add("show");
      setTimeout(() => el.classList.remove("show"), 5000);
    };
    setTimeout(show, 4000);
    setInterval(show, 20000);
  }

  // ---------- Router ----------
  function clearTimers() {
    timers.forEach(t => { clearInterval(t); clearTimeout(t); });
    timers = [];
  }
  async function router() {
    clearTimers();
    closeModal();
    const [path, qs] = location.hash.replace(/^#/, "").split("?");
    const [, page = "", param] = (path || "/").split("/");
    const query = new URLSearchParams(qs || "");
    $$("#nav a").forEach(a => a.classList.toggle("active", a.getAttribute("href") === `#/${page}`));
    $("#nav").classList.remove("open");
    window.scrollTo(0, 0);
    try {
      switch (page) {
        case "": return await homePage();
        case "game": return await gamePage(decodeURIComponent(param || ""), query);
        case "invoice": return await invoicePage(decodeURIComponent(param || ""));
        case "deposit": return await depositPage(decodeURIComponent(param || ""));
        case "cek-transaksi": return await cekPage();
        case "leaderboard": return await leaderboardPage();
        case "kalkulator": return kalkulatorPage();
        case "masuk": return authPage("masuk");
        case "daftar": return authPage("daftar");
        case "akun": return await accountPage();
        case "faq": return faqPage();
        case "syarat-ketentuan": return docPage("Syarat & Ketentuan", C.terms);
        case "kebijakan-privasi": return docPage("Kebijakan Privasi", C.privacy);
        default: return notFound();
      }
    } catch (e) {
      notFound(e.status === 404 ? e.message : "Gagal memuat halaman. Periksa koneksi lalu coba lagi.");
    }
  }

  async function refreshConfig() {
    CFG = await api("/config");
    const btn = $("#accountBtn");
    btn.textContent = CFG.user ? "Akun" : "Masuk";
    btn.href = CFG.user ? "#/akun" : "#/masuk";
    const m = [CFG.mock.payment && "pembayaran", CFG.mock.provider && "Digiflazz", CFG.mock.nickname && "cek nickname"].filter(Boolean);
    $("#mockBanner").hidden = !m.length;
    $("#mockBanner").textContent = `Mode uji coba: ${m.join(", ")} masih simulasi. Isi kredensial di file .env untuk transaksi asli.`;
  }

  // Pencarian & menu
  const search = $("#globalSearch"), results = $("#searchResults");
  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    if (!q) { results.classList.remove("show"); return; }
    const found = GAMES.filter(g => g.name.toLowerCase().includes(q) || g.publisher.toLowerCase().includes(q)).slice(0, 8);
    results.innerHTML = found.length ? found.map(g => `<a href="#/game/${g.slug}">${cover(g, "xs")}<span>${esc(g.name)}</span></a>`).join("") : `<p class="muted">Tidak ditemukan</p>`;
    results.classList.add("show");
  });
  results.addEventListener("click", () => { search.value = ""; results.classList.remove("show"); });
  document.addEventListener("click", e => { if (!e.target.closest(".search-wrap")) results.classList.remove("show"); });
  $("#menuBtn").addEventListener("click", () => $("#nav").classList.toggle("open"));
  $("#year").textContent = new Date().getFullYear();

  (async () => {
    try {
      [, GAMES] = await Promise.all([refreshConfig(), api("/games")]);
    } catch {
      app.innerHTML = `<section class="container section center"><p class="muted">Server tidak dapat dihubungi. Pastikan backend berjalan (npm start).</p></section>`;
      return;
    }
    window.addEventListener("hashchange", router);
    router();
    startLiveFeed();
  })();
})();
