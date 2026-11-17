const express = require("express");
const { db, getSettings } = require("../db");
const catalog = require("../catalog");
const orders = require("../orders");
const tripay = require("../services/tripay");
const nickname = require("../services/nickname");
const auth = require("../auth");
const config = require("../config");
const { HttpError, rateLimit, asyncH, normalizePhone, isValidPhone, isValidEmail, maskPhone, maskName } = require("../util");

const r = express.Router();

const ORDER_STATUS_ID = {
  WAITING: "Menunggu Pembayaran", PROCESSING: "Diproses", SUCCESS: "Sukses", FAILED: "Gagal", REFUNDED: "Dikembalikan ke Saldo", EXPIRED: "Kedaluwarsa",
};

// ---------- Info toko ----------
r.get("/config", (req, res) => {
  const s = getSettings();
  res.json({
    storeName: config.storeName,
    whatsappCs: s.whatsapp_cs,
    tabs: catalog.TABS,
    mock: { payment: tripay.isMock, provider: require("../services/digiflazz").isMock, nickname: nickname.isMock },
    user: req.user,
  });
});

r.get("/games", (_req, res) => res.json(catalog.listGames().map(catalog.publicGame)));

r.get("/games/:slug", (req, res) => {
  const g = catalog.findGame(req.params.slug);
  if (!g) throw new HttpError(404, "Game tidak ditemukan");
  res.json({ ...catalog.publicGame(g), products: catalog.productsFor(g.brand, req.user?.role || "guest") });
});

r.get("/flash-sale", (req, res) => {
  const games = new Map(catalog.listGames().map(g => [g.brand, g]));
  const s = getSettings();
  res.json(catalog.activeFlashSales().filter(f => games.has(f.brand)).map(f => {
    const g = games.get(f.brand);
    const p = db.prepare("SELECT * FROM products WHERE sku = ?").get(f.sku);
    return { id: f.id, sku: f.sku, productName: f.product_name, game: catalog.publicGame(g), price: f.price, normalPrice: catalog.sellPrice(p, "guest", s), endAt: f.end_at, stockLeft: f.stock == null ? null : f.stock - f.sold, sold: f.sold };
  }));
});

r.get("/payment-channels", asyncH(async (req, res) => {
  const list = await tripay.channels();
  res.json([...(req.user ? [{ code: "SALDO", name: "Saldo Akun", group: "Saldo", feeFlat: 0, feePercent: 0, minAmount: 0, balance: req.user.balance }] : []), ...list]);
}));

r.post("/promo/check", rateLimit({ windowMs: 60_000, max: 20 }), (req, res) => {
  const { discount, promo } = orders.evaluatePromo(req.body.code, Number(req.body.amount) || 0);
  res.json({ code: promo.code, discount });
});

r.post("/nickname", rateLimit({ windowMs: 60_000, max: 15 }), asyncH(async (req, res) => {
  const g = catalog.findGame(req.body.slug);
  if (!g?.nickCode) throw new HttpError(400, "Cek nickname tidak tersedia untuk game ini");
  const name = await nickname.check(g.nickCode, String(req.body.userId || "").trim(), String(req.body.zoneId || "").trim()).catch(() => null);
  if (!name) throw new HttpError(404, "Akun tidak ditemukan. Periksa kembali ID kamu.");
  res.json({ nickname: name });
}));

// ---------- Pesanan ----------
r.post("/orders", rateLimit({ windowMs: 60_000, max: 10 }), asyncH(async (req, res) => {
  const b = req.body;
  const id = await orders.createOrder({ user: req.user, slug: b.slug, sku: b.sku, fields: b.fields, nickname: b.nickname, whatsapp: b.whatsapp, email: b.email, method: b.method, promo: b.promo });
  res.status(201).json({ id });
}));

const publicOrder = (o, viewer) => ({
  id: o.id, gameSlug: o.game_slug, gameName: o.game_name, productName: o.product_name,
  account: o.account_label, nickname: o.nickname, whatsapp: viewer ? o.whatsapp : maskPhone(o.whatsapp),
  price: o.price, discount: o.discount, fee: o.fee, total: o.total, promoCode: o.promo_code,
  paymentMethod: o.payment_method, paymentName: o.payment_name, payCode: o.pay_code, qrUrl: o.qr_url, checkoutUrl: o.checkout_url,
  paymentStatus: o.payment_status, status: o.status, statusText: ORDER_STATUS_ID[o.status] || o.status,
  sn: o.sn, message: o.provider_message, expiredAt: o.expired_at, paidAt: o.paid_at, createdAt: o.created_at,
  reviewed: !!db.prepare("SELECT 1 FROM reviews WHERE order_id = ?").get(o.id),
});

r.get("/orders/:id", (req, res) => {
  const o = db.prepare("SELECT * FROM orders WHERE id = ?").get(String(req.params.id).trim().toUpperCase());
  if (!o) throw new HttpError(404, "Invoice tidak ditemukan");
  res.json(publicOrder(o, req.user && (req.user.id === o.user_id || req.user.role === "admin")));
});

r.post("/orders/:id/review", rateLimit({ windowMs: 60_000, max: 5 }), (req, res) => {
  const o = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!o || o.status !== "SUCCESS") throw new HttpError(400, "Ulasan hanya untuk transaksi sukses");
  if (normalizePhone(req.body.whatsapp) !== o.whatsapp) throw new HttpError(403, "Nomor WhatsApp tidak cocok dengan pesanan");
  const rating = Math.round(Number(req.body.rating));
  const comment = String(req.body.comment || "").trim().slice(0, 300);
  const name = String(req.body.name || "").trim().slice(0, 40) || "Pelanggan";
  if (!(rating >= 1 && rating <= 5) || comment.length < 3) throw new HttpError(400, "Isi rating dan komentar");
  try {
    db.prepare("INSERT INTO reviews (order_id, name, game_name, rating, comment) VALUES (?, ?, ?, ?, ?)").run(o.id, name, o.game_name, rating, comment);
  } catch {
    throw new HttpError(409, "Pesanan ini sudah diulas");
  }
  res.status(201).json({ ok: true });
});

// Simulasi pembayaran (hanya saat Tripay belum dikonfigurasi)
if (tripay.isMock) {
  r.post("/dev/pay/:id", (req, res) => {
    orders.handlePaymentStatus(req.params.id, "PAID");
    res.json({ ok: true });
  });
}

// ---------- Sosial proof ----------
r.get("/recent", (_req, res) => {
  const rows = db.prepare("SELECT game_name, product_name, whatsapp, updated_at FROM orders WHERE status = 'SUCCESS' ORDER BY updated_at DESC LIMIT 15").all();
  res.json(rows.map(o => ({ who: maskPhone(o.whatsapp), game: o.game_name, product: o.product_name, at: o.updated_at })));
});

r.get("/reviews", (_req, res) => {
  const stats = db.prepare("SELECT COUNT(*) AS n, AVG(rating) AS avg FROM reviews WHERE visible = 1").get();
  const list = db.prepare("SELECT name, game_name, rating, comment, created_at FROM reviews WHERE visible = 1 ORDER BY id DESC LIMIT 12").all();
  res.json({ count: stats.n, average: stats.avg ? Math.round(stats.avg * 10) / 10 : null, list: list.map(x => ({ ...x, name: maskName(x.name) })) });
});

r.get("/leaderboard", (_req, res) => {
  const q = since => db.prepare(`
    SELECT COALESCE(u.name, o.whatsapp) AS who, u.id IS NOT NULL AS isUser, SUM(o.total) AS total, COUNT(*) AS n
    FROM orders o LEFT JOIN users u ON u.id = o.user_id
    WHERE o.status = 'SUCCESS' AND o.created_at >= ${since}
    GROUP BY COALESCE(CAST(o.user_id AS TEXT), o.whatsapp) ORDER BY total DESC LIMIT 10`).all()
    .map(x => ({ who: x.isUser ? maskName(x.who) : maskPhone(x.who), total: x.total, count: x.n }));
  res.json({ today: q("date('now')"), week: q("date('now', '-6 days')"), month: q("date('now', 'start of month')") });
});

// ---------- Akun ----------
r.post("/auth/register", rateLimit({ windowMs: 10 * 60_000, max: 5 }), (req, res) => {
  const name = String(req.body.name || "").trim().slice(0, 60);
  const email = String(req.body.email || "").trim().toLowerCase();
  const whatsapp = normalizePhone(req.body.whatsapp);
  const password = String(req.body.password || "");
  if (name.length < 2) throw new HttpError(400, "Nama minimal 2 karakter");
  if (!isValidEmail(email)) throw new HttpError(400, "Email tidak valid");
  if (!isValidPhone(whatsapp)) throw new HttpError(400, "Nomor WhatsApp tidak valid");
  if (password.length < 8) throw new HttpError(400, "Password minimal 8 karakter");
  if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) throw new HttpError(409, "Email sudah terdaftar");
  const { lastInsertRowid } = db.prepare("INSERT INTO users (name, email, whatsapp, password_hash) VALUES (?, ?, ?, ?)").run(name, email, whatsapp, auth.hashPassword(password));
  auth.setSession(res, Number(lastInsertRowid));
  res.status(201).json({ ok: true });
});

r.post("/auth/login", rateLimit({ windowMs: 10 * 60_000, max: 10 }), (req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE email = ?").get(String(req.body.email || "").trim().toLowerCase());
  if (!u || !auth.verifyPassword(String(req.body.password || ""), u.password_hash)) throw new HttpError(401, "Email atau password salah");
  auth.setSession(res, u.id);
  res.json({ ok: true });
});

r.post("/auth/logout", (_req, res) => {
  auth.clearSession(res);
  res.json({ ok: true });
});

r.get("/me", auth.requireUser, (req, res) => {
  const ord = db.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50").all(req.user.id).map(o => publicOrder(o, true));
  const deposits = db.prepare("SELECT id, amount, total, payment_name, status, created_at FROM deposits WHERE user_id = ? ORDER BY created_at DESC LIMIT 20").all(req.user.id);
  const logs = db.prepare("SELECT amount, balance_after, note, created_at FROM balance_logs WHERE user_id = ? ORDER BY id DESC LIMIT 30").all(req.user.id);
  res.json({ user: req.user, orders: ord, deposits, logs });
});

r.post("/me/deposit", auth.requireUser, rateLimit({ windowMs: 60_000, max: 5 }), asyncH(async (req, res) => {
  res.status(201).json({ id: await orders.createDeposit(req.user, req.body.amount, req.body.method) });
}));

r.get("/deposits/:id", auth.requireUser, (req, res) => {
  const d = db.prepare("SELECT * FROM deposits WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id);
  if (!d) throw new HttpError(404, "Deposit tidak ditemukan");
  res.json({ id: d.id, amount: d.amount, fee: d.fee, total: d.total, paymentMethod: d.payment_method, paymentName: d.payment_name, payCode: d.pay_code, qrUrl: d.qr_url, checkoutUrl: d.checkout_url, status: d.status, expiredAt: d.expired_at, createdAt: d.created_at });
});

module.exports = r;
