(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const view = $("#view");
  const rupiah = n => "Rp" + Math.round(n || 0).toLocaleString("id-ID");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = s => (s ? new Date(s).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" }) : "-");
  // datetime-local (waktu lokal browser) -> ISO 8601 UTC untuk server
  const toUtc = v => (v ? new Date(v).toISOString() : null);
  const STATUS = { WAITING: "Menunggu", PROCESSING: "Diproses", SUCCESS: "Sukses", FAILED: "Gagal", REFUNDED: "Refund", EXPIRED: "Kedaluwarsa" };
  const cls = s => ({ SUCCESS: "ok", PROCESSING: "info", REFUNDED: "info", FAILED: "bad", EXPIRED: "bad" }[s] || "wait");

  async function api(path, body, method) {
    const res = await fetch("/api/admin" + path, {
      method: method || (body ? "POST" : "GET"),
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || "Gagal"), { status: res.status });
    return data;
  }
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove("show"), 2600);
  }
  const act = async (fn, okMsg) => {
    try { await fn(); if (okMsg) toast(okMsg); render(); } catch (e) { toast(e.message); }
  };

  // ---------- Dashboard ----------
  async function dashboard() {
    const s = await api("/stats");
    const pb = typeof s.providerBalance === "number" ? rupiah(s.providerBalance) : `<span class="bad-text" title="${esc(s.providerBalance?.error)}">Gagal cek</span>`;
    view.innerHTML = `
      <h1>Dashboard</h1>
      <div class="stats">
        <div class="stat"><small>Saldo Digiflazz</small><b>${pb}</b></div>
        <div class="stat"><small>Penjualan hari ini</small><b>${rupiah(s.day.revenue)}</b><small>${s.day.orders} transaksi sukses</small></div>
        <div class="stat"><small>Laba kotor hari ini</small><b class="ok-text">${rupiah(s.day.profit)}</b></div>
        <div class="stat"><small>Penjualan bulan ini</small><b>${rupiah(s.month.revenue)}</b><small>${s.month.orders} transaksi</small></div>
        <div class="stat"><small>Laba kotor bulan ini</small><b class="ok-text">${rupiah(s.month.profit)}</b></div>
        <div class="stat"><small>Pengguna terdaftar</small><b>${s.users.n}</b><small>Total saldo user ${rupiah(s.users.balance)}</small></div>
      </div>
      <div class="stats">${Object.entries(STATUS).map(([k, v]) => `<a class="stat" href="#orders?status=${k}"><small>${v}</small><b>${s.counts[k] || 0}</b></a>`).join("")}</div>
      <p class="muted">Sinkron harga terakhir: ${s.lastSync ? new Date(s.lastSync).toLocaleString("id-ID") : "-"} · <button class="btn btn-ghost btn-xs" id="sync">Sinkronkan sekarang</button></p>
      <p class="muted mt">Laba kotor = harga jual − diskon − harga modal Digiflazz (belum termasuk potongan payment gateway).</p>`;
    $("#sync").onclick = () => act(async () => toast(`${(await api("/sync", {})).count} produk disinkronkan`));
  }

  // ---------- Pesanan ----------
  async function orders(q) {
    const status = q.get("status") || "", search = q.get("q") || "";
    const list = await api(`/orders?status=${status}&q=${encodeURIComponent(search)}`);
    view.innerHTML = `
      <h1>Pesanan</h1>
      <form class="toolbar" id="f">
        <select name="status"><option value="">Semua status</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${k === status ? "selected" : ""}>${v}</option>`).join("")}</select>
        <input name="q" placeholder="Cari invoice / ID / WA / produk" value="${esc(search)}" />
        <button class="btn btn-primary btn-sm">Filter</button>
      </form>
      <div class="card table-wrap"><table>
        <thead><tr><th>Invoice</th><th>Produk</th><th>Tujuan</th><th>Bayar</th><th>Total / Laba</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody>${list.map(o => `
          <tr>
            <td><a class="link" href="/#/invoice/${o.id}" target="_blank">${esc(o.id)}</a><br><small class="muted">${fmt(o.created_at)}</small></td>
            <td>${esc(o.game_name)}<br><small class="muted">${esc(o.product_name)} · ${esc(o.sku)}</small></td>
            <td>${esc(o.customer_no)}${o.nickname ? `<br><small class="muted">${esc(o.nickname)}</small>` : ""}<br><small class="muted">WA ${esc(o.whatsapp)}</small></td>
            <td>${esc(o.payment_name)}<br><span class="pill">${esc(o.payment_status)}</span></td>
            <td>${rupiah(o.total)}<br><small class="ok-text">+${rupiah(o.price - o.discount - o.base_price)}</small></td>
            <td><span class="status ${cls(o.status)}">${STATUS[o.status] || o.status}</span>${o.sn ? `<br><small class="muted">SN: ${esc(o.sn)}</small>` : ""}${o.provider_message ? `<br><small class="muted">${esc(o.provider_message)}</small>` : ""}</td>
            <td class="actions">
              ${o.status === "FAILED" && o.payment_status === "PAID" ? `<button class="btn btn-ghost btn-xs" data-retry="${o.id}">Kirim ulang</button><button class="btn btn-ghost btn-xs" data-mark="${o.id}" data-s="REFUNDED">Tandai sudah refund</button>` : ""}
              ${o.status === "PROCESSING" ? `<button class="btn btn-ghost btn-xs" data-mark="${o.id}" data-s="SUCCESS">Tandai sukses</button>` : ""}
            </td>
          </tr>`).join("") || `<tr><td colspan="7" class="muted">Tidak ada pesanan.</td></tr>`}</tbody>
      </table></div>`;
    $("#f").onsubmit = e => { e.preventDefault(); location.hash = `orders?status=${e.target.status.value}&q=${encodeURIComponent(e.target.q.value)}`; };
    $$("[data-retry]").forEach(b => (b.onclick = () => confirm("Kirim ulang pesanan ini ke Digiflazz?") && act(() => api(`/orders/${b.dataset.retry}/retry`, {}), "Dikirim ulang")));
    $$("[data-mark]").forEach(b => (b.onclick = () => {
      const note = prompt(b.dataset.s === "SUCCESS" ? "SN / catatan (opsional):" : "Catatan refund (mis. ditransfer ke DANA 08xx):");
      if (note === null) return;
      act(() => api(`/orders/${b.dataset.mark}/mark`, { status: b.dataset.s, sn: b.dataset.s === "SUCCESS" ? note || null : null, note: note || null }), "Status diperbarui");
    }));
  }

  // ---------- Produk ----------
  async function products(q) {
    const search = q.get("q") || "";
    const list = await api(`/products?q=${encodeURIComponent(search)}`);
    const brands = [...new Set(list.map(p => p.brand))];
    view.innerHTML = `
      <h1>Produk</h1>
      <form class="toolbar" id="f"><input name="q" placeholder="Cari brand / nama / SKU" value="${esc(search)}" /><button class="btn btn-primary btn-sm">Cari</button>
        <button type="button" class="btn btn-ghost btn-sm" id="sync">Sinkron dari Digiflazz</button></form>
      <p class="muted">Harga jual dihitung otomatis dari harga modal + margin (menu Pengaturan). Isi "Harga manual" untuk menetapkan harga umum sendiri. ${search && brands.length === 1 ? `<button class="btn btn-ghost btn-xs" data-brand="${esc(brands[0])}" data-on="0">Nonaktifkan semua ${esc(brands[0])}</button> <button class="btn btn-ghost btn-xs" data-brand="${esc(brands[0])}" data-on="1">Aktifkan semua</button>` : ""}</p>
      <div class="card table-wrap mt"><table>
        <thead><tr><th>Produk</th><th>Kategori</th><th>Modal</th><th>Harga manual</th><th>Label</th><th>Status</th><th></th></tr></thead>
        <tbody>${list.map(p => `
          <tr data-sku="${esc(p.sku)}">
            <td>${esc(p.name)}<br><small class="muted">${esc(p.brand)} · ${esc(p.sku)}</small></td>
            <td>${esc(p.category)}</td>
            <td>${rupiah(p.base_price)}</td>
            <td><input type="number" name="custom_price" value="${p.custom_price ?? ""}" placeholder="otomatis" /></td>
            <td><select name="label"><option value="">-</option><option value="best" ${p.label === "best" ? "selected" : ""}>Terlaris</option><option value="promo" ${p.label === "promo" ? "selected" : ""}>Promo</option></select></td>
            <td><label class="check"><input type="checkbox" name="enabled" ${p.enabled ? "checked" : ""} /> <span>Tampil</span></label>${p.available ? "" : `<span class="pill bad-text">Gangguan supplier</span>`}</td>
            <td><button class="btn btn-ghost btn-xs" data-save>Simpan</button></td>
          </tr>`).join("") || `<tr><td colspan="7" class="muted">Tidak ada produk. Klik "Sinkron dari Digiflazz".</td></tr>`}</tbody>
      </table></div>`;
    $("#f").onsubmit = e => { e.preventDefault(); location.hash = `products?q=${encodeURIComponent(e.target.q.value)}`; };
    $("#sync").onclick = () => act(async () => toast(`${(await api("/sync", {})).count} produk disinkronkan`));
    $$("[data-brand]").forEach(b => (b.onclick = () => act(() => api("/products/brand-toggle", { brand: b.dataset.brand, enabled: b.dataset.on === "1" }), "Disimpan")));
    $$("[data-save]").forEach(b => (b.onclick = () => {
      const tr = b.closest("tr");
      act(() => api(`/products/${encodeURIComponent(tr.dataset.sku)}`, { custom_price: $("[name=custom_price]", tr).value, label: $("[name=label]", tr).value || null, enabled: $("[name=enabled]", tr).checked }, "PATCH"), "Produk disimpan");
    }));
  }

  // ---------- Flash sale ----------
  async function flash() {
    const list = await api("/flash-sales");
    const now = new Date(), pad = d => new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    view.innerHTML = `
      <h1>Flash Sale</h1>
      <form class="card grid-form" id="f">
        <label><span>SKU produk</span><input name="sku" required placeholder="mis. ML86" /></label>
        <label><span>Harga flash</span><input name="price" type="number" required /></label>
        <label><span>Stok (kosong = tak terbatas)</span><input name="stock" type="number" /></label>
        <label><span>Mulai</span><input name="start_at" type="datetime-local" value="${pad(now)}" required /></label>
        <label><span>Berakhir</span><input name="end_at" type="datetime-local" value="${pad(new Date(+now + 6 * 3600e3))}" required /></label>
        <button class="btn btn-primary">Tambah</button>
      </form>
      <p class="muted">Cari SKU di menu Produk. Pastikan harga flash tidak di bawah harga modal.</p>
      <div class="card table-wrap mt"><table>
        <thead><tr><th>Produk</th><th>Harga</th><th>Terjual / Stok</th><th>Periode</th><th></th></tr></thead>
        <tbody>${list.map(f => `<tr><td>${esc(f.product_name)}<br><small class="muted">${esc(f.sku)}</small></td><td>${rupiah(f.price)}</td><td>${f.sold} / ${f.stock ?? "∞"}</td><td>${fmt(f.start_at)} – ${fmt(f.end_at)}</td>
          <td><button class="btn btn-danger btn-xs" data-del="${f.id}">Hapus</button></td></tr>`).join("") || `<tr><td colspan="5" class="muted">Belum ada flash sale.</td></tr>`}</tbody>
      </table></div>`;
    $("#f").onsubmit = e => {
      e.preventDefault();
      const f = e.target;
      act(() => api("/flash-sales", { sku: f.sku.value.trim(), price: f.price.value, stock: f.stock.value, start_at: toUtc(f.start_at.value), end_at: toUtc(f.end_at.value) }), "Flash sale ditambahkan");
    };
    $$("[data-del]").forEach(b => (b.onclick = () => confirm("Hapus flash sale?") && act(() => api(`/flash-sales/${b.dataset.del}`, null, "DELETE"), "Dihapus")));
  }

  // ---------- Promo ----------
  async function promos() {
    const list = await api("/promos");
    view.innerHTML = `
      <h1>Kode Promo</h1>
      <form class="card grid-form" id="f">
        <label><span>Kode</span><input name="code" required placeholder="HEMAT10" /></label>
        <label><span>Tipe</span><select name="type"><option value="percent">Persen (%)</option><option value="flat">Potongan (Rp)</option></select></label>
        <label><span>Nilai</span><input name="value" type="number" required /></label>
        <label><span>Maks. diskon (Rp)</span><input name="max_discount" type="number" /></label>
        <label><span>Min. pembelian (Rp)</span><input name="min_purchase" type="number" value="0" /></label>
        <label><span>Kuota</span><input name="quota" type="number" placeholder="tak terbatas" /></label>
        <label><span>Kedaluwarsa</span><input name="expires_at" type="datetime-local" /></label>
        <button class="btn btn-primary">Simpan</button>
      </form>
      <div class="card table-wrap"><table>
        <thead><tr><th>Kode</th><th>Diskon</th><th>Syarat</th><th>Dipakai</th><th>Kedaluwarsa</th><th>Status</th><th></th></tr></thead>
        <tbody>${list.map(p => `<tr><td><b>${esc(p.code)}</b></td><td>${p.type === "percent" ? p.value + "%" : rupiah(p.value)}${p.max_discount ? `<br><small class="muted">maks ${rupiah(p.max_discount)}</small>` : ""}</td>
          <td>Min. ${rupiah(p.min_purchase)}</td><td>${p.used} / ${p.quota ?? "∞"}</td><td>${fmt(p.expires_at)}</td><td>${p.active ? "Aktif" : "Nonaktif"}</td>
          <td class="actions"><button class="btn btn-ghost btn-xs" data-toggle='${esc(JSON.stringify(p))}'>${p.active ? "Nonaktifkan" : "Aktifkan"}</button><button class="btn btn-danger btn-xs" data-del="${esc(p.code)}">Hapus</button></td></tr>`).join("") || `<tr><td colspan="7" class="muted">Belum ada kode promo.</td></tr>`}</tbody>
      </table></div>`;
    $("#f").onsubmit = e => {
      e.preventDefault();
      const b = Object.fromEntries(new FormData(e.target));
      b.expires_at = toUtc(b.expires_at);
      act(() => api("/promos", b), "Promo disimpan");
    };
    $$("[data-toggle]").forEach(b => (b.onclick = () => {
      const p = JSON.parse(b.dataset.toggle);
      act(() => api("/promos", { ...p, active: !p.active }), "Disimpan");
    }));
    $$("[data-del]").forEach(b => (b.onclick = () => confirm("Hapus promo?") && act(() => api(`/promos/${encodeURIComponent(b.dataset.del)}`, null, "DELETE"), "Dihapus")));
  }

  // ---------- Pengguna ----------
  async function users(q) {
    const search = q.get("q") || "";
    const list = await api(`/users?q=${encodeURIComponent(search)}`);
    view.innerHTML = `
      <h1>Pengguna</h1>
      <form class="toolbar" id="f"><input name="q" placeholder="Cari nama / email / WA" value="${esc(search)}" /><button class="btn btn-primary btn-sm">Cari</button></form>
      <div class="card table-wrap"><table>
        <thead><tr><th>Nama</th><th>Kontak</th><th>Role</th><th>Saldo</th><th>Ubah saldo</th></tr></thead>
        <tbody>${list.map(u => `<tr data-id="${u.id}"><td>${esc(u.name)}<br><small class="muted">Sejak ${fmt(u.created_at)}</small></td><td>${esc(u.email)}<br><small class="muted">${esc(u.whatsapp)}</small></td>
          <td><select data-role>${["member", "reseller", "admin"].map(r => `<option ${u.role === r ? "selected" : ""}>${r}</option>`).join("")}</select></td>
          <td>${rupiah(u.balance)}</td>
          <td class="actions"><input type="number" placeholder="+/- nominal" data-amt /><button class="btn btn-ghost btn-xs" data-adjust>Terapkan</button></td></tr>`).join("") || `<tr><td colspan="5" class="muted">Tidak ada pengguna.</td></tr>`}</tbody>
      </table></div>`;
    $("#f").onsubmit = e => { e.preventDefault(); location.hash = `users?q=${encodeURIComponent(e.target.q.value)}`; };
    $$("[data-role]").forEach(s => (s.onchange = () => act(() => api(`/users/${s.closest("tr").dataset.id}`, { role: s.value }, "PATCH"), "Role diperbarui")));
    $$("[data-adjust]").forEach(b => (b.onclick = () => {
      const tr = b.closest("tr"), amt = Number($("[data-amt]", tr).value);
      if (!amt) return toast("Isi nominal, contoh 50000 atau -50000");
      const note = prompt("Keterangan:", amt > 0 ? "Top up saldo manual" : "Koreksi saldo");
      if (note === null) return;
      act(() => api(`/users/${tr.dataset.id}`, { balanceAdjust: amt, note }, "PATCH"), "Saldo diperbarui");
    }));
  }

  // ---------- Ulasan ----------
  async function reviews() {
    const list = await api("/reviews");
    view.innerHTML = `
      <h1>Ulasan</h1>
      <div class="card table-wrap"><table>
        <thead><tr><th>Pembeli</th><th>Rating</th><th>Komentar</th><th>Tampil</th></tr></thead>
        <tbody>${list.map(r => `<tr><td>${esc(r.name)}<br><small class="muted">${esc(r.game_name)} · ${esc(r.order_id)}</small></td><td class="stars">${"★".repeat(r.rating)}</td><td>${esc(r.comment)}</td>
          <td><label class="check"><input type="checkbox" data-vis="${r.id}" ${r.visible ? "checked" : ""} /> <span>Tampil</span></label></td></tr>`).join("") || `<tr><td colspan="4" class="muted">Belum ada ulasan.</td></tr>`}</tbody>
      </table></div>`;
    $$("[data-vis]").forEach(c => (c.onchange = () => act(() => api(`/reviews/${c.dataset.vis}`, { visible: c.checked }, "PATCH"), "Disimpan")));
  }

  // ---------- Pengaturan ----------
  async function settings() {
    const s = await api("/settings");
    view.innerHTML = `
      <h1>Pengaturan</h1>
      <form class="card grid-form" id="f">
        <label><span>Margin umum (%)</span><input name="margin_public" type="number" step="0.1" value="${esc(s.margin_public)}" /></label>
        <label><span>Margin member (%)</span><input name="margin_member" type="number" step="0.1" value="${esc(s.margin_member)}" /></label>
        <label><span>Margin reseller (%)</span><input name="margin_reseller" type="number" step="0.1" value="${esc(s.margin_reseller)}" /></label>
        <label><span>Pembulatan harga (Rp)</span><input name="round_to" type="number" value="${esc(s.round_to)}" /></label>
        <label><span>Batas waktu bayar (menit)</span><input name="order_expiry_minutes" type="number" value="${esc(s.order_expiry_minutes)}" /></label>
        <label><span>WhatsApp CS (format 62…)</span><input name="whatsapp_cs" value="${esc(s.whatsapp_cs)}" /></label>
        <button class="btn btn-primary">Simpan</button>
      </form>
      <p class="muted">Harga jual = harga modal Digiflazz × (1 + margin%), dibulatkan ke atas. Contoh modal Rp21.300 dengan margin 8% → ${rupiah(Math.ceil(21300 * (1 + s.margin_public / 100) / s.round_to) * s.round_to)}.</p>`;
    $("#f").onsubmit = e => { e.preventDefault(); act(() => api("/settings", Object.fromEntries(new FormData(e.target)), "PUT"), "Pengaturan disimpan"); };
  }

  const PAGES = { dashboard, orders, products, flash, promos, users, reviews, settings };
  async function render() {
    const [page, qs] = (location.hash.slice(1) || "dashboard").split("?");
    $$("#adminNav a").forEach(a => a.classList.toggle("active", a.getAttribute("href") === "#" + page));
    try {
      await (PAGES[page] || dashboard)(new URLSearchParams(qs || ""));
    } catch (e) {
      if (e.status === 401 || e.status === 403) {
        view.innerHTML = `<div class="card denied"><h2>Akses ditolak</h2><p class="muted mt">Halaman ini khusus admin. Masuk dengan akun admin terlebih dahulu.</p><a class="btn btn-primary mt" href="/#/masuk">Masuk</a></div>`;
      } else view.innerHTML = `<p class="bad-text">${esc(e.message)}</p>`;
    }
  }
  window.addEventListener("hashchange", render);
  render();
})();
