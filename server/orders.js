// Logika bisnis: pesanan, pembayaran, pengiriman ke Digiflazz, refund, deposit saldo.
// Catatan serverless: semua proses ditunggu (await) sebelum respons dikirim,
// karena Vercel bisa menghentikan fungsi segera setelah respons selesai.
const { db } = require("./db");
const catalog = require("./catalog");
const digiflazz = require("./services/digiflazz");
const tripay = require("./services/tripay");
const { HttpError, newId, normalizePhone, isValidPhone, isValidEmail } = require("./util");
const config = require("./config");

// ---------- Saldo ----------
async function changeBalance(t, userId, amount, note) {
  const u = await t.one("SELECT balance FROM users WHERE id = ? FOR UPDATE", userId);
  if (!u) throw new HttpError(404, "User tidak ditemukan");
  const after = u.balance + amount;
  if (after < 0) throw new HttpError(400, "Saldo tidak mencukupi");
  await t.run("UPDATE users SET balance = ? WHERE id = ?", after, userId);
  await t.run("INSERT INTO balance_logs (user_id, amount, balance_after, note) VALUES (?, ?, ?, ?)", userId, amount, after, note);
  return after;
}

// ---------- Promo ----------
async function evaluatePromo(code, amount) {
  if (!code) return { discount: 0, promo: null };
  const p = await db.one("SELECT *, (expires_at IS NOT NULL AND expires_at < now()) AS expired FROM promos WHERE code = ? AND active", String(code).trim().toUpperCase());
  if (!p) throw new HttpError(400, "Kode promo tidak valid");
  if (p.expired) throw new HttpError(400, "Kode promo sudah kedaluwarsa");
  if (p.quota != null && p.used >= p.quota) throw new HttpError(400, "Kuota kode promo sudah habis");
  if (amount < p.min_purchase) throw new HttpError(400, `Minimal pembelian Rp${p.min_purchase.toLocaleString("id-ID")} untuk promo ini`);
  let discount = p.type === "percent" ? Math.floor((amount * p.value) / 100) : p.value;
  if (p.max_discount) discount = Math.min(discount, p.max_discount);
  discount = Math.min(discount, amount - 1);
  return { discount, promo: p };
}

// ---------- Pesanan ----------
async function createOrder({ user, slug, sku, fields = {}, nickname, whatsapp, email, method, promo }) {
  const game = await catalog.findGame(slug);
  if (!game) throw new HttpError(404, "Game tidak ditemukan");
  const product = (await catalog.productsFor(game.brand, user?.role || "guest")).find(p => p.sku === sku);
  if (!product) throw new HttpError(400, "Produk tidak tersedia");

  const clean = {};
  for (const f of game.fields) {
    const v = String(fields[f.key] ?? "").trim();
    if (!v) throw new HttpError(400, `${f.label} wajib diisi`);
    if (f.pattern && !new RegExp(f.pattern).test(v)) throw new HttpError(400, `${f.label} tidak valid`);
    clean[f.key] = v;
  }
  whatsapp = normalizePhone(whatsapp);
  if (!isValidPhone(whatsapp)) throw new HttpError(400, "Nomor WhatsApp tidak valid");
  if (email && !isValidEmail(email)) throw new HttpError(400, "Email tidak valid");

  const customerNo = game.fields.length ? (game.customerNo ? game.customerNo(clean) : clean.userId) : whatsapp;
  const accountLabel = game.fields.map(f => `${f.label}: ${clean[f.key]}`).join(" · ") || `Dikirim ke ${whatsapp}`;
  const { discount, promo: p } = await evaluatePromo(promo, product.price);
  const amount = product.price - discount;
  const base = (await db.one("SELECT base_price FROM products WHERE sku = ?", sku)).base_price;
  const id = newId("RS");
  const expiryMin = Number((await db.getSettings()).order_expiry_minutes) || 60;

  const row = {
    id, user_id: user?.id ?? null, game_slug: game.slug, game_name: game.name, sku, product_name: product.name,
    customer_no: customerNo, account_label: accountLabel, nickname: nickname ? String(nickname).slice(0, 60) : null,
    whatsapp, email: email || user?.email || null, base_price: base, price: product.price, discount,
    promo_code: p?.code ?? null, flash_id: product.flash?.id ?? null,
  };
  const insert = (t, extra) => {
    const r = { ...row, ...extra };
    const cols = Object.keys(r);
    return t.run(`INSERT INTO orders (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`, ...cols.map(c => r[c]));
  };

  if (method === "SALDO") {
    if (!user) throw new HttpError(401, "Login untuk membayar dengan saldo");
    await db.tx(async t => {
      await changeBalance(t, user.id, -amount, `Pembelian ${product.name} (${id})`);
      await insert(t, { fee: 0, total: amount, payment_method: "SALDO", payment_name: "Saldo Akun", payment_status: "PAID", paid_at: new Date() });
      await bumpUsage(t, row);
    });
    await processOrder(id);
    return id;
  }

  const channel = (await tripay.channels()).find(c => c.code === method);
  if (!channel) throw new HttpError(400, "Metode pembayaran tidak tersedia");
  if (channel.minAmount && amount < channel.minAmount) throw new HttpError(400, `Minimal transaksi ${channel.name} Rp${channel.minAmount.toLocaleString("id-ID")}`);

  await insert(db, { fee: 0, total: amount, payment_method: channel.code, payment_name: channel.name });
  try {
    const t = await tripay.createTransaction({
      method: channel.code, merchantRef: id, amount, itemName: `${game.name} - ${product.name}`, sku,
      customerName: user?.name || "Pelanggan " + config.storeName, customerEmail: row.email || config.storeEmail, customerPhone: whatsapp,
      returnPath: `#/invoice/${id}`, expirySeconds: expiryMin * 60,
    });
    await db.run(`UPDATE orders SET payment_ref = ?, pay_code = ?, qr_url = ?, checkout_url = ?, fee = ?, total = ?, expired_at = ?, updated_at = now() WHERE id = ?`,
      t.reference, t.payCode, t.qrUrl, t.checkoutUrl, t.fee, t.total, t.expiredAt, id);
  } catch (e) {
    await db.run("UPDATE orders SET payment_status = 'FAILED', status = 'FAILED', provider_message = ? WHERE id = ?", "Gagal membuat tagihan", id);
    console.error("[tripay]", e.message);
    throw new HttpError(502, "Gagal membuat tagihan pembayaran, coba metode lain.");
  }
  return id;
}

async function bumpUsage(t, order) {
  if (order.promo_code) await t.run("UPDATE promos SET used = used + 1 WHERE code = ?", order.promo_code);
  if (order.flash_id) await t.run("UPDATE flash_sales SET sold = sold + 1 WHERE id = ?", order.flash_id);
}

/** Tandai pesanan lunas (idempotent) lalu kirim ke Digiflazz. */
async function markOrderPaid(id) {
  const ok = await db.tx(async t => {
    const o = await t.one("SELECT * FROM orders WHERE id = ? FOR UPDATE", id);
    if (!o || o.payment_status !== "UNPAID") return false;
    await t.run("UPDATE orders SET payment_status = 'PAID', paid_at = now(), updated_at = now() WHERE id = ?", id);
    await bumpUsage(t, o);
    return true;
  });
  if (ok) await processOrder(id);
  return ok;
}

async function processOrder(id) {
  const claimed = await db.run("UPDATE orders SET status = 'PROCESSING', updated_at = now() WHERE id = ? AND status = 'WAITING' AND payment_status = 'PAID'", id);
  if (!claimed) return;
  const o = await db.one("SELECT * FROM orders WHERE id = ?", id);
  try {
    const refId = o.provider_ref || o.id;
    const r = await digiflazz.transaction({ sku: o.sku, customerNo: o.customer_no, refId });
    await applyProviderResult(refId, r);
  } catch (e) {
    // Biarkan PROCESSING; status dicek ulang saat invoice dibuka, oleh webhook, atau cron.
    console.error("[digiflazz]", id, e.message);
  }
}

/** Terapkan status dari Digiflazz (respons langsung, webhook, atau cek status). refId = ref_id Digiflazz. */
async function applyProviderResult(refId, r) {
  const row = await db.one("SELECT id FROM orders WHERE provider_ref = ? OR (provider_ref IS NULL AND id = ?)", refId, refId);
  if (!row) return;
  const id = row.id;
  const status = String(r?.status || "");
  if (status === "Sukses") {
    await db.run("UPDATE orders SET status = 'SUCCESS', sn = ?, provider_message = ?, updated_at = now() WHERE id = ? AND status = 'PROCESSING'", r.sn || null, r.message || null, id);
  } else if (status === "Gagal") {
    await refundOrder(id, r.message || "Transaksi gagal");
  } else if (r?.message) {
    await db.run("UPDATE orders SET provider_message = ? WHERE id = ? AND status = 'PROCESSING'", r.message, id);
  }
}

/** Cek ulang status satu pesanan PROCESSING ke Digiflazz. Dibatasi agar tidak terlalu sering. */
async function refreshOrder(o, minAgeSeconds = 15) {
  if (o.status !== "PROCESSING") return false;
  // Tandai waktu pengecekan agar request paralel tidak mengecek bersamaan.
  const claimed = await db.run("UPDATE orders SET updated_at = now() WHERE id = ? AND status = 'PROCESSING' AND updated_at < now() - make_interval(secs => ?)", o.id, minAgeSeconds);
  if (!claimed) return false;
  try {
    const refId = o.provider_ref || o.id;
    await applyProviderResult(refId, await digiflazz.status({ sku: o.sku, customerNo: o.customer_no, refId, since: o.paid_at }));
  } catch (e) {
    console.error("[refresh]", o.id, e.message);
  }
  return true;
}

/** Gagal: member/reseller → saldo dikembalikan otomatis. Tamu → status FAILED, refund manual via CS. */
async function refundOrder(id, reason) {
  await db.tx(async t => {
    const o = await t.one("SELECT * FROM orders WHERE id = ? FOR UPDATE", id);
    if (!o || !["PROCESSING", "WAITING"].includes(o.status) || o.payment_status !== "PAID") return;
    if (o.user_id) {
      await changeBalance(t, o.user_id, o.total, `Refund ${o.product_name} (${o.id})`);
      await t.run("UPDATE orders SET status = 'REFUNDED', provider_message = ?, updated_at = now() WHERE id = ?", `${reason}. Dana dikembalikan ke saldo akun.`, id);
    } else {
      await t.run("UPDATE orders SET status = 'FAILED', provider_message = ?, updated_at = now() WHERE id = ?", `${reason}. Hubungi CS untuk pengembalian dana.`, id);
    }
  });
}

/** Admin: kirim ulang pesanan lunas yang gagal dengan ref_id baru (Digiflazz menolak ref_id lama). */
async function retryOrder(id) {
  const o = await db.one("SELECT * FROM orders WHERE id = ?", id);
  if (!o || o.payment_status !== "PAID" || o.status !== "FAILED") throw new HttpError(400, "Hanya pesanan lunas berstatus Gagal yang bisa dikirim ulang");
  const n = Number((o.provider_ref || "").match(/-R(\d+)$/)?.[1] || 0) + 1;
  await db.run("UPDATE orders SET provider_ref = ?, status = 'WAITING', sn = NULL, provider_message = 'Dikirim ulang oleh admin', updated_at = now() WHERE id = ?", `${o.id}-R${n}`, id);
  await processOrder(id);
}

// ---------- Deposit saldo ----------
async function createDeposit(user, amount, method) {
  amount = Math.floor(Number(amount));
  if (!Number.isFinite(amount) || amount < 10000 || amount > 10_000_000) throw new HttpError(400, "Nominal deposit Rp10.000 – Rp10.000.000");
  const channel = (await tripay.channels()).find(c => c.code === method);
  if (!channel) throw new HttpError(400, "Metode pembayaran tidak tersedia");
  const id = newId("DP");
  await db.run("INSERT INTO deposits (id, user_id, amount, total, payment_method, payment_name) VALUES (?, ?, ?, ?, ?, ?)", id, user.id, amount, amount, channel.code, channel.name);
  try {
    const t = await tripay.createTransaction({
      method: channel.code, merchantRef: id, amount, itemName: `Deposit saldo ${config.storeName}`, sku: "DEPOSIT",
      customerName: user.name, customerEmail: user.email, customerPhone: user.whatsapp, returnPath: `#/deposit/${id}`,
      expirySeconds: (Number((await db.getSettings()).order_expiry_minutes) || 60) * 60,
    });
    await db.run("UPDATE deposits SET payment_ref = ?, pay_code = ?, qr_url = ?, checkout_url = ?, fee = ?, total = ?, expired_at = ? WHERE id = ?",
      t.reference, t.payCode, t.qrUrl, t.checkoutUrl, t.fee, t.total, t.expiredAt, id);
  } catch (e) {
    await db.run("UPDATE deposits SET status = 'FAILED' WHERE id = ?", id);
    console.error("[tripay]", e.message);
    throw new HttpError(502, "Gagal membuat tagihan pembayaran, coba metode lain.");
  }
  return id;
}

function markDepositPaid(id) {
  return db.tx(async t => {
    const d = await t.one("SELECT * FROM deposits WHERE id = ? FOR UPDATE", id);
    if (!d || d.status !== "UNPAID") return false;
    await t.run("UPDATE deposits SET status = 'PAID', paid_at = now() WHERE id = ?", id);
    await changeBalance(t, d.user_id, d.amount, `Deposit ${d.id}`);
    return true;
  });
}

// ---------- Callback ----------
async function handlePaymentStatus(merchantRef, status) {
  const isDeposit = merchantRef.startsWith("DP");
  if (status === "PAID") return isDeposit ? markDepositPaid(merchantRef) : markOrderPaid(merchantRef);
  if (["EXPIRED", "FAILED"].includes(status)) {
    if (isDeposit) await db.run("UPDATE deposits SET status = ? WHERE id = ? AND status = 'UNPAID'", status, merchantRef);
    else await db.run("UPDATE orders SET payment_status = ?, status = 'EXPIRED', updated_at = now() WHERE id = ? AND payment_status = 'UNPAID'", status, merchantRef);
  }
  return true;
}

// ---------- Pemeliharaan (dipanggil cron / server lokal) ----------
async function maintenance() {
  await db.run("UPDATE orders SET payment_status = 'EXPIRED', status = 'EXPIRED', updated_at = now() WHERE payment_status = 'UNPAID' AND expired_at < now()");
  await db.run("UPDATE deposits SET status = 'EXPIRED' WHERE status = 'UNPAID' AND expired_at < now()");
  // Pesanan lunas yang belum terkirim (mis. fungsi sempat terhenti) diproses ulang.
  for (const o of await db.all("SELECT id FROM orders WHERE status = 'WAITING' AND payment_status = 'PAID' AND paid_at < now() - interval '1 minute' LIMIT 20")) {
    await processOrder(o.id);
  }
  for (const o of await db.all("SELECT * FROM orders WHERE status = 'PROCESSING' ORDER BY updated_at LIMIT 30")) {
    await refreshOrder(o, 30);
  }
}

module.exports = { createOrder, evaluatePromo, markOrderPaid, processOrder, applyProviderResult, refreshOrder, refundOrder, retryOrder, createDeposit, markDepositPaid, handlePaymentStatus, changeBalance, maintenance };
