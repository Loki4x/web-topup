const express = require("express");
const { db } = require("../db");
const catalog = require("../catalog");
const orders = require("../orders");
const tripay = require("../services/tripay");
const digiflazz = require("../services/digiflazz");
const nickname = require("../services/nickname");
const auth = require("../auth");
const config = require("../config");
const { HttpError, rateLimit, normalizePhone, isValidPhone, isValidEmail, maskPhone, maskName } = require("../util");

// Express 5 meneruskan error dari handler async ke error handler secara otomatis.
const r = express.Router();

const ORDER_STATUS_ID = {
  WAITING: "Menunggu Pembayaran", PROCESSING: "Diproses", SUCCESS: "Sukses", FAILED: "Gagal", REFUNDED: "Dikembalikan ke Saldo", EXPIRED: "Kedaluwarsa",
};

// ---------- Info toko ----------
r.get("/config", async (req, res) => {
  const s = await db.getSettings();
  res.json({
    storeName: config.storeName,
    whatsappCs: s.whatsapp_cs,
    tabs: catalog.TABS,
    mock: { payment: tripay.isMock, provider: digiflazz.isMock, nickname: nickname.isMock },
    user: req.user,
  });
});

r.get("/games", async (_req, res) => {
  res.set("Cache-Control", "public, max-age=30, s-maxage=60");
  res.json((await catalog.listGames()).map(catalog.publicGame));
});

r.get("/games/:slug", async (req, res) => {
  const g = await catalog.findGame(req.params.slug);
  if (!g) throw new HttpError(404, "Game tidak ditemukan");
  res.json({ ...catalog.publicGame(g), products: await catalog.productsFor(g.brand, req.user?.role || "guest") });
});

r.get("/flash-sale", async (_req, res) => {
  const [games, s, flashes] = await Promise.all([catalog.listGames(), db.getSettings(), catalog.activeFlashSales()]);
  const byBrand = new Map(games.map(g => [g.brand, g]));
  const list = [];
  for (const f of flashes) {
    const g = byBrand.get(f.brand);
    if (!g) continue;
    const p = await db.one("SELECT * FROM products WHERE sku = ?", f.sku);
    list.push({ id: f.id, sku: f.sku, productName: f.product_name, game: catalog.publicGame(g), price: f.price, normalPrice: catalog.sellPrice(p, "guest", s), endAt: f.end_at, stockLeft: f.stock == null ? null : f.stock - f.sold, sold: f.sold });
  }
  res.json(list);
});

r.get("/payment-channels", async (req, res) => {
  const list = await tripay.channels();
  res.json([...(req.user ? [{ code: "SALDO", name: "Saldo Akun", group: "Saldo", feeFlat: 0, feePercent: 0, minAmount: 0, balance: req.user.balance }] : []), ...list]);
});

r.post("/promo/check", rateLimit({ windowMs: 60_000, max: 20 }), async (req, res) => {
  const { discount, promo } = await orders.evaluatePromo(req.body.code, Number(req.body.amount) || 0);
  res.json({ code: promo.code, discount });
});

r.post("/nickname", rateLimit({ windowMs: 60_000, max: 15 }), async (req, res) => {
  const g = await catalog.findGame(req.body.slug);
  if (!g?.nickCode) throw new HttpError(400, "Cek nickname tidak tersedia untuk game ini");
  const name = await nickname.check(g.nickCode, String(req.body.userId || "").trim(), String(req.body.zoneId || "").trim()).catch(() => null);
  if (!name) throw new HttpError(404, "Akun tidak ditemukan. Periksa kembali ID kamu.");
  res.json({ nickname: name });
});

// ---------- Pesanan ----------
r.post("/orders", rateLimit({ windowMs: 60_000, max: 10 }), async (req, res) => {
  const b = req.body;
  const id = await orders.createOrder({ user: req.user, slug: b.slug, sku: b.sku, fields: b.fields, nickname: b.nickname, whatsapp: b.whatsapp, email: b.email, method: b.method, promo: b.promo });
  res.status(201).json({ id });
});

const publicOrder = (o, viewer, reviewed) => ({
  id: o.id, gameSlug: o.game_slug, gameName: o.game_name, productName: o.product_name,
  account: o.account_label, nickname: o.nickname, whatsapp: viewer ? o.whatsapp : maskPhone(o.whatsapp),
  price: o.price, discount: o.discount, fee: o.fee, total: o.total, promoCode: o.promo_code,
  paymentMethod: o.payment_method, paymentName: o.payment_name, payCode: o.pay_code, qrUrl: o.qr_url, checkoutUrl: o.checkout_url,
  paymentStatus: o.payment_status, status: o.status, statusText: ORDER_STATUS_ID[o.status] || o.status,
  sn: o.sn, message: o.provider_message, expiredAt: o.expired_at, paidAt: o.paid_at, createdAt: o.created_at,
  reviewed: !!reviewed,
});

r.get("/orders/:id", async (req, res) => {
  const id = String(req.params.id).trim().toUpperCase();
  let o = await db.one("SELECT * FROM orders WHERE id = ?", id);
  if (!o) throw new HttpError(404, "Invoice tidak ditemukan");
  // Serverless tidak punya proses latar belakang: cek status ke Digiflazz saat invoice dibuka.
  if (o.status === "PROCESSING" && (await orders.refreshOrder(o, digiflazz.isMock ? 3 : 15))) o = await db.one("SELECT * FROM orders WHERE id = ?", id);
  if (o.payment_status === "UNPAID" && o.expired_at && new Date(o.expired_at) < new Date()) {
    await orders.handlePaymentStatus(o.id, "EXPIRED");
    o = await db.one("SELECT * FROM orders WHERE id = ?", id);
  }
  const reviewed = await db.one("SELECT 1 AS x FROM reviews WHERE order_id = ?", o.id);
  res.json(publicOrder(o, req.user && (req.user.id === o.user_id || req.user.role === "admin"), reviewed));
});

r.post("/orders/:id/review", rateLimit({ windowMs: 60_000, max: 5 }), async (req, res) => {
  const o = await db.one("SELECT * FROM orders WHERE id = ?", req.params.id);
  if (!o || o.status !== "SUCCESS") throw new HttpError(400, "Ulasan hanya untuk transaksi sukses");
  if (normalizePhone(req.body.whatsapp) !== o.whatsapp) throw new HttpError(403, "Nomor WhatsApp tidak cocok dengan pesanan");
  const rating = Math.round(Number(req.body.rating));
  const comment = String(req.body.comment || "").trim().slice(0, 300);
  const name = String(req.body.name || "").trim().slice(0, 40) || "Pelanggan";
  if (!(rating >= 1 && rating <= 5) || comment.length < 3) throw new HttpError(400, "Isi rating dan komentar");
  const n = await db.run("INSERT INTO reviews (order_id, name, game_name, rating, comment) VALUES (?, ?, ?, ?, ?) ON CONFLICT (order_id) DO NOTHING", o.id, name, o.game_name, rating, comment);
  if (!n) throw new HttpError(409, "Pesanan ini sudah diulas");
  res.status(201).json({ ok: true });
});

// Simulasi pembayaran (hanya saat Tripay belum dikonfigurasi)
if (tripay.isMock) {
  r.post("/dev/pay/:id", async (req, res) => {
    await orders.handlePaymentStatus(req.params.id, "PAID");
    res.json({ ok: true });
  });
}

// ---------- Social proof ----------
r.get("/recent", async (_req, res) => {
  const rows = await db.all("SELECT game_name, product_name, whatsapp, updated_at FROM orders WHERE status = 'SUCCESS' ORDER BY updated_at DESC LIMIT 15");
  res.json(rows.map(o => ({ who: maskPhone(o.whatsapp), game: o.game_name, product: o.product_name, at: o.updated_at })));
});

r.get("/reviews", async (_req, res) => {
  const stats = await db.one("SELECT COUNT(*) AS n, AVG(rating) AS avg FROM reviews WHERE visible");
  const list = await db.all("SELECT name, game_name, rating, comment, created_at FROM reviews WHERE visible ORDER BY id DESC LIMIT 12");
  res.json({ count: stats.n, average: stats.avg ? Math.round(stats.avg * 10) / 10 : null, list: list.map(x => ({ ...x, name: maskName(x.name) })) });
});

r.get("/leaderboard", async (_req, res) => {
  const q = since => db.all(`
    SELECT MAX(u.name) AS name, MAX(o.whatsapp) AS whatsapp, BOOL_OR(u.id IS NOT NULL) AS is_user, SUM(o.total) AS total, COUNT(*) AS n
    FROM orders o LEFT JOIN users u ON u.id = o.user_id
    WHERE o.status = 'SUCCESS' AND o.created_at >= ${since}
    GROUP BY COALESCE(o.user_id::text, o.whatsapp) ORDER BY total DESC LIMIT 10`);
  const fmt = rows => rows.map(x => ({ who: x.is_user ? maskName(x.name) : maskPhone(x.whatsapp), total: x.total, count: x.n }));
  const [today, week, month] = await Promise.all([q("date_trunc('day', now())"), q("now() - interval '7 days'"), q("date_trunc('month', now())")]);
  res.json({ today: fmt(today), week: fmt(week), month: fmt(month) });
});

// ---------- Akun ----------
r.post("/auth/register", rateLimit({ windowMs: 10 * 60_000, max: 5 }), async (req, res) => {
  const name = String(req.body.name || "").trim().slice(0, 60);
  const email = String(req.body.email || "").trim().toLowerCase();
  const whatsapp = normalizePhone(req.body.whatsapp);
  const password = String(req.body.password || "");
  if (name.length < 2) throw new HttpError(400, "Nama minimal 2 karakter");
  if (!isValidEmail(email)) throw new HttpError(400, "Email tidak valid");
  if (!isValidPhone(whatsapp)) throw new HttpError(400, "Nomor WhatsApp tidak valid");
  if (password.length < 8) throw new HttpError(400, "Password minimal 8 karakter");
  const u = await db.one("INSERT INTO users (name, email, whatsapp, password_hash) VALUES (?, ?, ?, ?) ON CONFLICT (email) DO NOTHING RETURNING id", name, email, whatsapp, auth.hashPassword(password));
  if (!u) throw new HttpError(409, "Email sudah terdaftar");
  auth.setSession(res, u.id);
  res.status(201).json({ ok: true });
});

r.post("/auth/login", rateLimit({ windowMs: 10 * 60_000, max: 10 }), async (req, res) => {
  const u = await db.one("SELECT * FROM users WHERE email = ?", String(req.body.email || "").trim().toLowerCase());
  if (!u || !auth.verifyPassword(String(req.body.password || ""), u.password_hash)) throw new HttpError(401, "Email atau password salah");
  auth.setSession(res, u.id);
  res.json({ ok: true });
});

r.post("/auth/logout", (_req, res) => {
  auth.clearSession(res);
  res.json({ ok: true });
});

r.get("/me", auth.requireUser, async (req, res) => {
  const [ord, reviewed, deposits, logs] = await Promise.all([
    db.all("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50", req.user.id),
    db.all("SELECT r.order_id FROM reviews r JOIN orders o ON o.id = r.order_id WHERE o.user_id = ?", req.user.id),
    db.all("SELECT id, amount, total, payment_name, status, created_at FROM deposits WHERE user_id = ? ORDER BY created_at DESC LIMIT 20", req.user.id),
    db.all("SELECT amount, balance_after, note, created_at FROM balance_logs WHERE user_id = ? ORDER BY id DESC LIMIT 30", req.user.id),
  ]);
  const rv = new Set(reviewed.map(x => x.order_id));
  res.json({ user: req.user, orders: ord.map(o => publicOrder(o, true, rv.has(o.id))), deposits, logs });
});

r.post("/me/deposit", auth.requireUser, rateLimit({ windowMs: 60_000, max: 5 }), async (req, res) => {
  res.status(201).json({ id: await orders.createDeposit(req.user, req.body.amount, req.body.method) });
});

r.get("/deposits/:id", auth.requireUser, async (req, res) => {
  let d = await db.one("SELECT * FROM deposits WHERE id = ? AND user_id = ?", req.params.id, req.user.id);
  if (!d) throw new HttpError(404, "Deposit tidak ditemukan");
  if (d.status === "UNPAID" && d.expired_at && new Date(d.expired_at) < new Date()) {
    await orders.handlePaymentStatus(d.id, "EXPIRED");
    d = await db.one("SELECT * FROM deposits WHERE id = ?", d.id);
  }
  res.json({ id: d.id, amount: d.amount, fee: d.fee, total: d.total, paymentMethod: d.payment_method, paymentName: d.payment_name, payCode: d.pay_code, qrUrl: d.qr_url, checkoutUrl: d.checkout_url, status: d.status, expiredAt: d.expired_at, createdAt: d.created_at });
});

module.exports = r;
