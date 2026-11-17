(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const app = $("#app");
  const rupiah = n => "Rp" + Math.round(n).toLocaleString("id-ID");
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const initials = name => name.split(/[\s:]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  const cover = (g, cls = "") => `<div class="cover ${cls}" style="--c1:${g.colors[0]};--c2:${g.colors[1]}"><span>${initials(g.name)}</span></div>`;
  const allMethods = PAYMENTS.flatMap(p => p.methods);
  const calcFee = (m, price) => (m.fee < 1 ? price * m.fee : m.fee);

  const store = {
    get: () => JSON.parse(localStorage.getItem("nexa_orders") || "[]"),
    save: o => localStorage.setItem("nexa_orders", JSON.stringify([o, ...store.get()].slice(0, 200))),
    find: id => store.get().find(o => o.invoice === id.trim().toUpperCase()),
  };

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove("show"), 2600);
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

  // ---------- Pages ----------
  function homePage() {
    const popular = GAMES.filter(g => g.popular);
    app.innerHTML = `
      <section class="container hero">
        <div class="slider" id="slider">
          ${BANNERS.map((b, i) => `
            <a href="#/game/${b.slug}" class="slide ${i === 0 ? "active" : ""}" style="--c1:${b.colors[0]};--c2:${b.colors[1]}">
              <div><h2>${esc(b.title)}</h2><p>${esc(b.text)}</p><span class="btn btn-light">Top Up Sekarang</span></div>
            </a>`).join("")}
          <div class="dots">${BANNERS.map((_, i) => `<button data-dot="${i}" class="${i === 0 ? "active" : ""}" aria-label="Slide ${i + 1}"></button>`).join("")}</div>
        </div>
      </section>

      <section class="container section">
        <div class="section-head"><h3>🔥 Populer Sekarang</h3><p class="muted">Game yang paling banyak di-top up hari ini</p></div>
        <div class="popular-grid">
          ${popular.map(g => `<a class="popular-card" href="#/game/${g.slug}">${cover(g, "sm")}<div><b>${esc(g.name)}</b><small>${esc(g.publisher)}</small></div></a>`).join("")}
        </div>
      </section>

      <section class="container section">
        <div class="tabs" id="tabs">${CATEGORIES.map((c, i) => `<button class="${i === 0 ? "active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}</div>
        <div class="game-grid" id="gameGrid"></div>
      </section>

      <section class="container section features">
        ${[["⚡", "Proses Instan", "Pesanan diproses otomatis dalam hitungan detik."], ["💸", "Harga Termurah", "Harga bersaing langsung dari distributor resmi."], ["🛡️", "Aman & Terpercaya", "Transaksi terenkripsi dan bergaransi."], ["🕐", "Buka 24 Jam", "Top up kapan saja, CS siap membantu."]]
          .map(([i, t, d]) => `<div class="feature"><span>${i}</span><b>${t}</b><p class="muted">${d}</p></div>`).join("")}
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

    // slider
    let idx = 0;
    const slides = $$(".slide"), dots = $$("[data-dot]");
    const go = i => { idx = (i + slides.length) % slides.length; slides.forEach((s, j) => s.classList.toggle("active", j === idx)); dots.forEach((d, j) => d.classList.toggle("active", j === idx)); };
    dots.forEach(d => d.addEventListener("click", e => { e.preventDefault(); go(+d.dataset.dot); }));
    clearInterval(homePage.timer);
    homePage.timer = setInterval(() => { if (!$("#slider")) return clearInterval(homePage.timer); go(idx + 1); }, 5000);
  }

  function gamePage(slug) {
    const g = GAMES.find(x => x.slug === slug);
    if (!g) return notFound();
    const state = { product: null, method: null };

    app.innerHTML = `
      <section class="game-banner" style="--c1:${g.colors[0]};--c2:${g.colors[1]}">
        <div class="container game-banner-inner">${cover(g, "lg")}<div><h1>${esc(g.name)}</h1><p>${esc(g.publisher)}</p>
          <div class="badges"><span>⚡ Proses Instan</span><span>🛡️ Aman</span><span>💬 CS 24 Jam</span></div></div></div>
      </section>
      <div class="container game-layout">
        <aside class="card guide">
          <h4>Cara Top Up</h4>
          <ol>
            ${g.voucher ? "" : "<li>Masukkan data akun.</li>"}
            <li>Pilih nominal yang diinginkan.</li>
            <li>Pilih metode pembayaran.</li>
            <li>Masukkan nomor WhatsApp.</li>
            <li>Klik <b>Beli Sekarang</b> dan selesaikan pembayaran.</li>
          </ol>
          <p class="muted">${esc(g.guide)}</p>
        </aside>
        <form class="steps" id="orderForm" novalidate>
          ${g.fields.length ? `
          <div class="card step"><div class="step-head"><span class="num">1</span><h4>Masukkan Data Akun</h4></div>
            <div class="field-row">
              ${g.fields.map(f => f.type === "select"
                ? `<label><span>${esc(f.label)}</span><select name="${f.key}" required><option value="">Pilih ${esc(f.label)}</option>${f.options.map(o => `<option>${esc(o)}</option>`).join("")}</select></label>`
                : `<label><span>${esc(f.label)}</span><input name="${f.key}" placeholder="${esc(f.placeholder)}" required /></label>`).join("")}
            </div>
          </div>` : ""}
          <div class="card step"><div class="step-head"><span class="num">${g.fields.length ? 2 : 1}</span><h4>Pilih Nominal</h4></div>
            <div class="product-grid">
              ${g.products.map(p => `<button type="button" class="product" data-product="${p.id}"><b>${esc(p.name)}</b><span>${rupiah(p.price)}</span></button>`).join("")}
            </div>
          </div>
          <div class="card step"><div class="step-head"><span class="num">${g.fields.length ? 3 : 2}</span><h4>Pilih Pembayaran</h4></div>
            <div id="payList">
              ${PAYMENTS.map((grp, i) => `
                <details class="pay-group" ${i === 0 ? "open" : ""}><summary>${esc(grp.group)}</summary>
                  <div class="pay-methods">
                    ${grp.methods.map(m => `<button type="button" class="pay" data-method="${m.id}"><span class="pay-logo">${esc(m.name.split(" ")[0])}</span><span class="pay-name">${esc(m.name)}</span><span class="pay-price" data-price-for="${m.id}">Pilih nominal</span></button>`).join("")}
                  </div>
                </details>`).join("")}
            </div>
          </div>
          <div class="card step"><div class="step-head"><span class="num">${g.fields.length ? 4 : 3}</span><h4>Detail Kontak</h4></div>
            <label><span>Nomor WhatsApp</span><input name="whatsapp" type="tel" placeholder="08xxxxxxxxxx" required /></label>
            <small class="muted">Bukti transaksi akan dikirim ke nomor ini.</small>
            <label class="mt"><span>Kode Promo (opsional)</span><input name="promo" placeholder="Contoh: HEMAT10" /></label>
          </div>
          <div class="card summary sticky-buy">
            <div><small class="muted" id="sumProduct">Belum memilih nominal</small><b id="sumTotal">${rupiah(0)}</b></div>
            <button type="submit" class="btn btn-primary">🛒 Beli Sekarang</button>
          </div>
        </form>
      </div>`;

    const form = $("#orderForm");
    const promoDisc = () => (form.promo.value.trim().toUpperCase() === "HEMAT10" ? 0.1 : 0);
    const update = () => {
      const p = state.product;
      allMethods.forEach(m => { const el = $(`[data-price-for="${m.id}"]`); if (el) el.textContent = p ? rupiah(p.price + calcFee(m, p.price)) : "Pilih nominal"; });
      if (!p) return;
      const sub = p.price * (1 - promoDisc());
      const total = sub + (state.method ? calcFee(state.method, sub) : 0);
      $("#sumProduct").textContent = `${p.name}${state.method ? " · " + state.method.name : ""}`;
      $("#sumTotal").textContent = rupiah(total);
    };

    form.addEventListener("click", e => {
      const pb = e.target.closest("[data-product]");
      if (pb) { state.product = g.products.find(p => p.id === pb.dataset.product); $$(".product").forEach(x => x.classList.toggle("active", x === pb)); update(); }
      const mb = e.target.closest("[data-method]");
      if (mb) { state.method = allMethods.find(m => m.id === mb.dataset.method); $$(".pay").forEach(x => x.classList.toggle("active", x === mb)); update(); }
    });
    form.promo.addEventListener("input", update);

    form.addEventListener("submit", e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      for (const f of g.fields) if (!String(data[f.key] || "").trim()) return toast(`${f.label} wajib diisi`);
      if (!state.product) return toast("Silakan pilih nominal terlebih dahulu");
      if (!state.method) return toast("Silakan pilih metode pembayaran");
      if (!/^(08|628)\d{7,12}$/.test(data.whatsapp.replace(/\D/g, ""))) return toast("Nomor WhatsApp tidak valid");

      const disc = state.product.price * promoDisc();
      const sub = state.product.price - disc;
      const fee = calcFee(state.method, sub);
      const order = {
        game: g.name, slug: g.slug, product: state.product.name, price: state.product.price,
        discount: disc, fee, total: Math.round(sub + fee), method: state.method.name,
        account: g.fields.map(f => `${f.label}: ${data[f.key]}`).join(" · ") || "-", whatsapp: data.whatsapp,
      };
      openModal(`
        <h3>Konfirmasi Pesanan</h3>
        <p class="muted">Pastikan data akun sudah benar. Kesalahan input bukan tanggung jawab kami.</p>
        <dl class="kv">
          <dt>Game</dt><dd>${esc(order.game)}</dd>
          <dt>Akun</dt><dd>${esc(order.account)}</dd>
          <dt>Item</dt><dd>${esc(order.product)}</dd>
          <dt>Pembayaran</dt><dd>${esc(order.method)}</dd>
          <dt>Harga</dt><dd>${rupiah(order.price)}</dd>
          ${disc ? `<dt>Diskon</dt><dd>-${rupiah(disc)}</dd>` : ""}
          <dt>Biaya Admin</dt><dd>${rupiah(fee)}</dd>
          <dt class="total">Total</dt><dd class="total">${rupiah(order.total)}</dd>
        </dl>
        <div class="modal-actions"><button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-primary" id="confirmBtn">Pesan Sekarang</button></div>`);
      $("#confirmBtn").addEventListener("click", () => {
        order.invoice = "NXT" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
        order.createdAt = new Date().toISOString();
        order.status = "Menunggu Pembayaran";
        store.save(order);
        closeModal();
        location.hash = `#/invoice/${order.invoice}`;
      });
    });
  }

  function invoicePage(id) {
    const o = store.find(id);
    if (!o) return notFound("Invoice tidak ditemukan");
    const paid = o.status !== "Menunggu Pembayaran";
    app.innerHTML = `
      <section class="container narrow section">
        <div class="card invoice">
          <div class="invoice-head">
            <div><small class="muted">Nomor Invoice</small><h2>${esc(o.invoice)}</h2></div>
            <span class="status ${paid ? "ok" : "wait"}">${esc(o.status)}</span>
          </div>
          ${paid ? `<div class="paid-box">✅ Pembayaran diterima. Item telah dikirim ke akun Anda.</div>` : `
          <div class="pay-box">
            <p>Selesaikan pembayaran via <b>${esc(o.method)}</b></p>
            ${o.method.startsWith("QRIS") ? `<div class="qr">${qrSvg(o.invoice)}</div>` : `<div class="va">Kode Bayar<br><b>${(8800 + parseInt(o.invoice.slice(3, 9), 36)).toString().padStart(14, "0").slice(0, 14)}</b></div>`}
            <p class="muted">Batas pembayaran: ${new Date(new Date(o.createdAt).getTime() + 3600e3).toLocaleString("id-ID")}</p>
            <button class="btn btn-primary" id="simulatePay">Saya Sudah Bayar (Simulasi)</button>
          </div>`}
          <dl class="kv">
            <dt>Tanggal</dt><dd>${new Date(o.createdAt).toLocaleString("id-ID")}</dd>
            <dt>Game</dt><dd>${esc(o.game)}</dd>
            <dt>Akun</dt><dd>${esc(o.account)}</dd>
            <dt>Item</dt><dd>${esc(o.product)}</dd>
            <dt>WhatsApp</dt><dd>${esc(o.whatsapp)}</dd>
            <dt>Biaya Admin</dt><dd>${rupiah(o.fee)}</dd>
            <dt class="total">Total Bayar</dt><dd class="total">${rupiah(o.total)}</dd>
          </dl>
          <div class="modal-actions"><button class="btn btn-ghost" id="copyInv">Salin Invoice</button><a class="btn btn-ghost" href="#/game/${o.slug}">Beli Lagi</a></div>
        </div>
      </section>`;
    $("#copyInv").addEventListener("click", () => navigator.clipboard?.writeText(o.invoice).then(() => toast("Nomor invoice disalin")));
    $("#simulatePay")?.addEventListener("click", () => {
      const orders = store.get().map(x => (x.invoice === o.invoice ? { ...x, status: "Sukses" } : x));
      localStorage.setItem("nexa_orders", JSON.stringify(orders));
      toast("Pembayaran berhasil!");
      invoicePage(id);
    });
  }

  // QR dekoratif (bukan QR asli) — ganti dengan QR dari payment gateway.
  function qrSvg(seed) {
    let h = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
    const n = 25, cells = [];
    const finder = (x, y) => [[0, 0], [n - 7, 0], [0, n - 7]].some(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (finder(x, y)) continue;
      h = (h * 1103515245 + 12345) >>> 0;
      if (h & 0x10000) cells.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`);
    }
    const f = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3"/>`;
    return `<svg viewBox="-1 -1 ${n + 2} ${n + 2}" shape-rendering="crispEdges"><rect x="-1" y="-1" width="${n + 2}" height="${n + 2}" fill="#fff"/>${f(0, 0)}${f(n - 7, 0)}${f(0, n - 7)}${cells.join("")}</svg>`;
  }

  function cekPage() {
    const recent = store.get().slice(0, 10);
    app.innerHTML = `
      <section class="container narrow section">
        <h1 class="page-title">Cek Transaksi</h1>
        <p class="muted">Lacak status pesananmu menggunakan nomor invoice.</p>
        <form class="card search-inv" id="cekForm">
          <input name="inv" placeholder="Contoh: NXT..." required />
          <button class="btn btn-primary">Cari</button>
        </form>
        <h3 class="mt">Transaksi Terakhir</h3>
        <div class="card table-wrap">
          ${recent.length ? `<table><thead><tr><th>Invoice</th><th>Item</th><th>Total</th><th>Status</th></tr></thead><tbody>
            ${recent.map(o => `<tr><td><a href="#/invoice/${o.invoice}">${esc(o.invoice)}</a></td><td>${esc(o.game)}<br><small class="muted">${esc(o.product)}</small></td><td>${rupiah(o.total)}</td><td><span class="status ${o.status === "Sukses" ? "ok" : "wait"}">${esc(o.status)}</span></td></tr>`).join("")}
          </tbody></table>` : `<p class="muted">Belum ada transaksi di perangkat ini.</p>`}
        </div>
      </section>`;
    $("#cekForm").addEventListener("submit", e => {
      e.preventDefault();
      const v = e.target.inv.value.trim().toUpperCase();
      store.find(v) ? (location.hash = `#/invoice/${v}`) : toast("Invoice tidak ditemukan");
    });
  }

  function leaderboardPage() {
    const names = ["Rizky", "Aldi", "Nadia", "Bima", "Sari", "Fajar", "Dewi", "Rendi", "Putri", "Yoga"];
    const rows = (mult) => names.map((n, i) => ({ n: n + "***" + (i * 7 + 13), v: Math.round((10 - i) * mult * (1 + ((i * 37) % 10) / 20)) }))
      .sort((a, b) => b.v - a.v);
    const table = (title, list) => `<div class="card"><h4>${title}</h4><ol class="lb">${list.map((r, i) => `<li><span class="rank r${i + 1}">${i + 1}</span><span>${esc(r.n)}</span><b>${rupiah(r.v)}</b></li>`).join("")}</ol></div>`;
    app.innerHTML = `
      <section class="container section">
        <h1 class="page-title">Leaderboard Top Spender</h1>
        <p class="muted">Top 10 pembeli dengan total transaksi terbanyak.</p>
        <div class="lb-grid">${table("Hari Ini", rows(85000))}${table("Minggu Ini", rows(520000))}${table("Bulan Ini", rows(2100000))}</div>
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

  function notFound(msg = "Halaman tidak ditemukan") {
    app.innerHTML = `<section class="container narrow section center"><h1 class="page-title">404</h1><p class="muted">${esc(msg)}</p><a class="btn btn-primary" href="#/">Kembali ke Beranda</a></section>`;
  }

  // ---------- Router ----------
  function router() {
    const [, page, param] = (location.hash.replace(/^#/, "") || "/").split("/");
    $$("#nav a").forEach(a => a.classList.toggle("active", a.getAttribute("href") === `#/${page || ""}`));
    $("#nav").classList.remove("open");
    window.scrollTo(0, 0);
    switch (page || "") {
      case "": return homePage();
      case "game": return gamePage(param);
      case "invoice": return invoicePage(decodeURIComponent(param || ""));
      case "cek-transaksi": return cekPage();
      case "leaderboard": return leaderboardPage();
      case "kalkulator": return kalkulatorPage();
      default: return notFound();
    }
  }
  window.addEventListener("hashchange", router);

  // ---------- Global search & menu ----------
  const search = $("#globalSearch"), results = $("#searchResults");
  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    if (!q) { results.classList.remove("show"); return; }
    const found = GAMES.filter(g => g.name.toLowerCase().includes(q) || g.publisher.toLowerCase().includes(q));
    results.innerHTML = found.length ? found.map(g => `<a href="#/game/${g.slug}">${cover(g, "xs")}<span>${esc(g.name)}</span></a>`).join("") : `<p class="muted">Tidak ditemukan</p>`;
    results.classList.add("show");
  });
  results.addEventListener("click", () => { search.value = ""; results.classList.remove("show"); });
  document.addEventListener("click", e => { if (!e.target.closest(".search-wrap")) results.classList.remove("show"); });
  $("#menuBtn").addEventListener("click", () => $("#nav").classList.toggle("open"));
  $("#year").textContent = new Date().getFullYear();

  router();
})();
