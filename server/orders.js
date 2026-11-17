// Logika bisnis: pesanan, pembayaran, pengiriman ke Digiflazz, refund, deposit saldo.
const { db, tx, getSettings } = require("./db");
const catalog = require("./catalog");
const digiflazz = require("./services/digiflazz");
const tripay = require("./services/tripay");
const { HttpError, newId, nowSql, normalizePhone, isValidPhone, isValidEmail } = require("./util");
const config = require("./config");

const sqlDate = d => d.toISOString().replace("T", " ").slice(0, 19);

// ---------- Saldo ----------
function changeBalance(userId, amount, note) {
  const u = db.prepare("SELECT balance FROM users WHERE id = ?").get(userId);
  if (!u) throw new HttpError(404, "User tidak ditemukan");
  const after = u.balance + amount;
  if (after < 0) throw new HttpError(400, "Saldo tidak mencukupi");
  db.prepare("UPDATE users SET balance = ? WHERE id = ?").run(after, userId);
  db.prepare("INSERT INTO balance_logs (user_id, amount, balance_after, note) VALUES (?, ?, ?, ?)").run(userId, amount, after, note);
  return after;
}

// ---------- Promo ----------
function evaluatePromo(code, amount) {
  if (!code) return { discount: 0, promo: null };
  const p = db.prepare("SELECT * FROM promos WHERE code = ? AND active = 1").get(String(code).trim().toUpperCase());
  if (!p) throw new HttpError(400, "Kode promo tidak valid");
  if (p.expires_at && p.expires_at < nowSql()) throw new HttpError(400, "Kode promo sudah kedaluwarsa");
  if (p.quota != null && p.used >= p.quota) throw new HttpError(400, "Kuota kode promo sudah habis");
  if (amount < p.min_purchase) throw new HttpError(400, `Minimal pembelian Rp${p.min_purchase.toLocaleString("id-ID")} untuk promo ini`);
  let discount = p.type === "percent" ? Math.floor((amount * p.value) / 100) : p.value;
  if (p.max_discount) discount = Math.min(discount, p.max_discount);
  discount = Math.min(discount, amount - 1);
  return { discount, promo: p };
}

// ---------- Pesanan ----------
async function createOrder({ user, slug, sku, fields = {}, nickname, whatsapp, email, method, promo }) {
  const game = catalog.findGame(slug);
  if (!game) throw new HttpError(404, "Game tidak ditemukan");
  const product = catalog.productsFor(game.brand, user?.role || "guest").find(p => p.sku === sku);
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
  const { discount, promo: p } = evaluatePromo(promo, product.price);
  const amount = product.price - discount;
  const base = db.prepare("SELECT base_price FROM products WHERE sku = ?").get(sku).base_price;
  const id = newId("RS");
  const s = getSettings();
  const expiryMin = Number(s.order_expiry_minutes) || 60;

  const row = {
    id, user_id: user?.id ?? null, game_slug: game.slug, game_name: game.name, sku, product_name: product.name,
    customer_no: customerNo, account_label: accountLabel, nickname: nickname ? String(nickname).slice(0, 60) : null,
    whatsapp, email: email || user?.email || null, base_price: base, price: product.price, discount,
    promo_code: p?.code ?? null, flash_id: product.flash?.id ?? null,
  };
  const insert = extra => {
    const r = { ...row, ...extra };
    const cols = Object.keys(r);
    db.prepare(`INSERT INTO orders (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`).run(...cols.map(c => r[c]));
  };

  if (method === "SALDO") {
    if (!user) throw new HttpError(401, "Login untuk membayar dengan saldo");
    tx(() => {
      changeBalance(user.id, -amount, `Pembelian ${product.name} (${id})`);
      insert({ fee: 0, total: amount, payment_method: "SALDO", payment_name: "Saldo Akun", payment_status: "PAID", paid_at: nowSql() });
      bumpUsage(row);
    });
    processOrder(id).catch(e => console.error("[order]", id, e.message));
    return id;
  }

  const channel = (await tripay.channels()).find(c => c.code === method);
  if (!channel) throw new HttpError(400, "Metode pembayaran tidak tersedia");
  if (channel.minAmount && amount < channel.minAmount) throw new HttpError(400, `Minimal transaksi ${channel.name} Rp${channel.minAmount.toLocaleString("id-ID")}`);

  insert({ fee: 0, total: amount, payment_method: channel.code, payment_name: channel.name });
  try {
    const t = await tripay.createTransaction({
      method: channel.code, merchantRef: id, amount, itemName: `${game.name} - ${product.name}`, sku,
      customerName: user?.name || "Pelanggan " + config.storeName, customerEmail: row.email || config.storeEmail, customerPhone: whatsapp,
      returnPath: `#/invoice/${id}`, expirySeconds: expiryMin * 60,
    });
    db.prepare(`UPDATE orders SET payment_ref = ?, pay_code = ?, qr_url = ?, checkout_url = ?, fee = ?, total = ?, expired_at = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(t.reference, t.payCode, t.qrUrl, t.checkoutUrl, t.fee, t.total, sqlDate(t.expiredAt), id);
  } catch (e) {
    db.prepare("UPDATE orders SET payment_status = 'FAILED', status = 'FAILED', provider_message = ? WHERE id = ?").run("Gagal membuat tagihan", id);
    console.error("[tripay]", e.message);
    throw new HttpError(502, "Gagal membuat tagihan pembayaran, coba metode lain.");
  }
  return id;
}

function bumpUsage(order) {
  if (order.promo_code) db.prepare("UPDATE promos SET used = used + 1 WHERE code = ?").run(order.promo_code);
  if (order.flash_id) db.prepare("UPDATE flash_sales SET sold = sold + 1 WHERE id = ?").run(order.flash_id);
}

/** Tandai pesanan lunas (idempotent) lalu kirim ke Digiflazz. */
function markOrderPaid(id) {
  const ok = tx(() => {
    const o = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
    if (!o || o.payment_status !== "UNPAID") return false;
    db.prepare("UPDATE orders SET payment_status = 'PAID', paid_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(id);
    bumpUsage(o);
    return true;
  });
  if (ok) processOrder(id).catch(e => console.error("[order]", id, e.message));
  return ok;
}

async function processOrder(id) {
  const claimed = db.prepare("UPDATE orders SET status = 'PROCESSING', updated_at = datetime('now') WHERE id = ? AND status = 'WAITING' AND payment_status = 'PAID'").run(id);
  if (!claimed.changes) return;
  const o = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
  try {
    const refId = o.provider_ref || o.id;
    const r = await digiflazz.transaction({ sku: o.sku, customerNo: o.customer_no, refId });
    applyProviderResult(refId, r);
  } catch (e) {
    // Biarkan PROCESSING; job polling akan cek ulang status dengan ref_id yang sama.
    console.error("[digiflazz]", id, e.message);
  }
}

/** Terapkan status dari Digiflazz (respons langsung, webhook, atau polling). refId = ref_id Digiflazz. */
function applyProviderResult(refId, r) {
  const id = db.prepare("SELECT id FROM orders WHERE provider_ref = ? OR (provider_ref IS NULL AND id = ?)").get(refId, refId)?.id;
  if (!id) return;
  const status = String(r?.status || "");
  if (status === "Sukses") {
    db.prepare("UPDATE orders SET status = 'SUCCESS', sn = ?, provider_message = ?, updated_at = datetime('now') WHERE id = ? AND status = 'PROCESSING'")
      .run(r.sn || null, r.message || null, id);
  } else if (status === "Gagal") {
    refundOrder(id, r.message || "Transaksi gagal");
  } else if (r?.message) {
    db.prepare("UPDATE orders SET provider_message = ?, updated_at = datetime('now') WHERE id = ? AND status = 'PROCESSING'").run(r.message, id);
  }
}

/** Gagal: member/reseller → saldo dikembalikan otomatis. Tamu → status FAILED, refund manual via CS. */
function refundOrder(id, reason) {
  tx(() => {
    const o = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
    if (!o || !["PROCESSING", "WAITING"].includes(o.status) || o.payment_status !== "PAID") return;
    if (o.user_id) {
      changeBalance(o.user_id, o.total, `Refund ${o.product_name} (${o.id})`);
      db.prepare("UPDATE orders SET status = 'REFUNDED', provider_message = ?, updated_at = datetime('now') WHERE id = ?").run(`${reason}. Dana dikembalikan ke saldo akun.`, id);
    } else {
      db.prepare("UPDATE orders SET status = 'FAILED', provider_message = ?, updated_at = datetime('now') WHERE id = ?").run(`${reason}. Hubungi CS untuk pengembalian dana.`, id);
    }
  });
}

/** Admin: kirim ulang pesanan lunas yang gagal dengan ref_id baru (Digiflazz menolak ref_id lama). */
function retryOrder(id) {
  const o = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
  if (!o || o.payment_status !== "PAID" || o.status !== "FAILED") throw new HttpError(400, "Hanya pesanan lunas berstatus Gagal yang bisa dikirim ulang");
  const n = Number((o.provider_ref || "").match(/-R(\d+)$/)?.[1] || 0) + 1;
  db.prepare("UPDATE orders SET provider_ref = ?, status = 'WAITING', sn = NULL, provider_message = 'Dikirim ulang oleh admin', updated_at = datetime('now') WHERE id = ?").run(`${o.id}-R${n}`, id);
  processOrder(id).catch(e => console.error("[order]", id, e.message));
}

// ---------- Deposit saldo ----------
async function createDeposit(user, amount, method) {
  amount = Math.floor(Number(amount));
  if (!Number.isFinite(amount) || amount < 10000 || amount > 10_000_000) throw new HttpError(400, "Nominal deposit Rp10.000 – Rp10.000.000");
  const channel = (await tripay.channels()).find(c => c.code === method);
  if (!channel) throw new HttpError(400, "Metode pembayaran tidak tersedia");
  const id = newId("DP");
  db.prepare("INSERT INTO deposits (id, user_id, amount, total, payment_method, payment_name) VALUES (?, ?, ?, ?, ?, ?)").run(id, user.id, amount, amount, channel.code, channel.name);
  try {
    const t = await tripay.createTransaction({
      method: channel.code, merchantRef: id, amount, itemName: `Deposit saldo ${config.storeName}`, sku: "DEPOSIT",
      customerName: user.name, customerEmail: user.email, customerPhone: user.whatsapp, returnPath: `#/deposit/${id}`,
      expirySeconds: (Number(getSettings().order_expiry_minutes) || 60) * 60,
    });
    db.prepare("UPDATE deposits SET payment_ref = ?, pay_code = ?, qr_url = ?, checkout_url = ?, fee = ?, total = ?, expired_at = ? WHERE id = ?")
      .run(t.reference, t.payCode, t.qrUrl, t.checkoutUrl, t.fee, t.total, sqlDate(t.expiredAt), id);
  } catch (e) {
    db.prepare("UPDATE deposits SET status = 'FAILED' WHERE id = ?").run(id);
    console.error("[tripay]", e.message);
    throw new HttpError(502, "Gagal membuat tagihan pembayaran, coba metode lain.");
  }
  return id;
}

function markDepositPaid(id) {
  return tx(() => {
    const d = db.prepare("SELECT * FROM deposits WHERE id = ?").get(id);
    if (!d || d.status !== "UNPAID") return false;
    db.prepare("UPDATE deposits SET status = 'PAID', paid_at = datetime('now') WHERE id = ?").run(id);
    changeBalance(d.user_id, d.amount, `Deposit ${d.id}`);
    return true;
  });
}

// ---------- Callback ----------
function handlePaymentStatus(merchantRef, status) {
  const isDeposit = merchantRef.startsWith("DP");
  if (status === "PAID") return isDeposit ? markDepositPaid(merchantRef) : markOrderPaid(merchantRef);
  if (["EXPIRED", "FAILED"].includes(status)) {
    if (isDeposit) db.prepare("UPDATE deposits SET status = ? WHERE id = ? AND status = 'UNPAID'").run(status, merchantRef);
    else db.prepare("UPDATE orders SET payment_status = ?, status = 'EXPIRED', updated_at = datetime('now') WHERE id = ? AND payment_status = 'UNPAID'").run(status, merchantRef);
  }
  return true;
}

// ---------- Jobs ----------
async function pollProcessing() {
  const rows = db.prepare("SELECT * FROM orders WHERE status = 'PROCESSING' AND updated_at < datetime('now', '-5 seconds') LIMIT 20").all();
  for (const o of rows) {
    try {
      const refId = o.provider_ref || o.id;
      applyProviderResult(refId, await digiflazz.status({ sku: o.sku, customerNo: o.customer_no, refId }));
    } catch (e) {
      console.error("[poll]", o.id, e.message);
    }
  }
  // Pesanan lunas yang belum terkirim (mis. server sempat mati) diproses ulang.
  for (const o of db.prepare("SELECT id FROM orders WHERE status = 'WAITING' AND payment_status = 'PAID' LIMIT 20").all()) {
    processOrder(o.id).catch(e => console.error("[order]", o.id, e.message));
  }
}

function expireUnpaid() {
  const now = nowSql();
  db.prepare("UPDATE orders SET payment_status = 'EXPIRED', status = 'EXPIRED', updated_at = datetime('now') WHERE payment_status = 'UNPAID' AND expired_at IS NOT NULL AND expired_at < ?").run(now);
  db.prepare("UPDATE deposits SET status = 'EXPIRED' WHERE status = 'UNPAID' AND expired_at IS NOT NULL AND expired_at < ?").run(now);
}

module.exports = { createOrder, evaluatePromo, markOrderPaid, processOrder, applyProviderResult, refundOrder, retryOrder, createDeposit, markDepositPaid, handlePaymentStatus, changeBalance, pollProcessing, expireUnpaid };
