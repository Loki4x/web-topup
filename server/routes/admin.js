const express = require("express");
const { db } = require("../db");
const orders = require("../orders");
const digiflazz = require("../services/digiflazz");
const jobs = require("../jobs");
const auth = require("../auth");
const { HttpError } = require("../util");

const r = express.Router();
r.use(auth.requireUser, auth.requireAdmin);

const int = (v, d = null) => (v === "" || v == null ? d : Math.floor(Number(v)));
const like = q => `%${String(q || "").trim()}%`;
const date = v => (v ? new Date(v) : null);

const SUMMARY = `SELECT COUNT(*) AS orders, COALESCE(SUM(price - discount), 0) AS revenue, COALESCE(SUM(price - discount - base_price), 0) AS profit FROM orders WHERE status = 'SUCCESS' AND created_at >= `;

r.get("/stats", async (_req, res) => {
  const [day, month, counts, users, settings] = await Promise.all([
    db.one(SUMMARY + "date_trunc('day', now())"),
    db.one(SUMMARY + "date_trunc('month', now())"),
    db.all("SELECT status, COUNT(*) AS n FROM orders GROUP BY status"),
    db.one("SELECT COUNT(*) AS n, COALESCE(SUM(balance), 0) AS balance FROM users"),
    db.getSettings(),
  ]);
  let providerBalance = null;
  try { providerBalance = await digiflazz.balance(); } catch (e) { providerBalance = { error: e.message }; }
  res.json({ day, month, counts: Object.fromEntries(counts.map(x => [x.status, x.n])), users, providerBalance, lastSync: settings.last_sync || null });
});

// ---- Pesanan ----
r.get("/orders", async (req, res) => {
  const { status = "", q = "" } = req.query;
  res.json(await db.all(`SELECT * FROM orders WHERE (? = '' OR status = ?) AND (id ILIKE ? OR customer_no ILIKE ? OR whatsapp ILIKE ? OR product_name ILIKE ?)
    ORDER BY created_at DESC LIMIT 200`, status, status, like(q), like(q), like(q), like(q)));
});
r.post("/orders/:id/retry", async (req, res) => {
  await orders.retryOrder(req.params.id);
  res.json({ ok: true });
});
r.post("/orders/:id/refresh", async (req, res) => {
  const o = await db.one("SELECT * FROM orders WHERE id = ?", req.params.id);
  if (o) await orders.refreshOrder(o, 0);
  res.json({ ok: true });
});
r.post("/orders/:id/mark", async (req, res) => {
  const { status, sn = null, note = null } = req.body;
  if (!["SUCCESS", "FAILED", "REFUNDED"].includes(status)) throw new HttpError(400, "Status tidak valid");
  await db.run("UPDATE orders SET status = ?, sn = COALESCE(?, sn), provider_message = COALESCE(?, provider_message), updated_at = now() WHERE id = ?", status, sn, note, req.params.id);
  res.json({ ok: true });
});

// ---- Produk ----
r.get("/products", async (req, res) => {
  const q = like(req.query.q);
  res.json(await db.all("SELECT * FROM products WHERE brand ILIKE ? OR name ILIKE ? OR sku ILIKE ? ORDER BY brand, base_price LIMIT 500", q, q, q));
});
r.patch("/products/:sku", async (req, res) => {
  const p = await db.one("SELECT * FROM products WHERE sku = ?", req.params.sku);
  if (!p) throw new HttpError(404, "Produk tidak ditemukan");
  const b = req.body;
  await db.run("UPDATE products SET enabled = ?, label = ?, custom_price = ? WHERE sku = ?",
    b.enabled === undefined ? p.enabled : !!b.enabled,
    b.label === undefined ? p.label : ["best", "promo"].includes(b.label) ? b.label : null,
    b.custom_price === undefined ? p.custom_price : int(b.custom_price),
    p.sku);
  res.json({ ok: true });
});
r.post("/products/brand-toggle", async (req, res) => {
  await db.run("UPDATE products SET enabled = ? WHERE brand = ?", !!req.body.enabled, String(req.body.brand));
  res.json({ ok: true });
});
r.post("/sync", async (_req, res) => res.json({ count: await jobs.syncPriceList() }));

// ---- Pengaturan ----
r.get("/settings", async (_req, res) => res.json(await db.getSettings()));
r.put("/settings", async (req, res) => {
  const allowed = ["margin_public", "margin_member", "margin_reseller", "round_to", "order_expiry_minutes", "whatsapp_cs"];
  for (const k of allowed) if (req.body[k] !== undefined) await db.setSetting(k, String(req.body[k]).trim());
  res.json(await db.getSettings());
});

// ---- Promo ----
r.get("/promos", async (_req, res) => res.json(await db.all("SELECT * FROM promos ORDER BY created_at DESC")));
r.post("/promos", async (req, res) => {
  const b = req.body;
  const code = String(b.code || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{3,20}$/.test(code)) throw new HttpError(400, "Kode 3-20 huruf/angka");
  if (!["percent", "flat"].includes(b.type) || !(int(b.value) > 0)) throw new HttpError(400, "Tipe/nilai tidak valid");
  await db.run(`INSERT INTO promos (code, type, value, max_discount, min_purchase, quota, expires_at, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (code) DO UPDATE SET type = excluded.type, value = excluded.value, max_discount = excluded.max_discount, min_purchase = excluded.min_purchase,
    quota = excluded.quota, expires_at = excluded.expires_at, active = excluded.active`,
    code, b.type, int(b.value), int(b.max_discount), int(b.min_purchase, 0), int(b.quota), date(b.expires_at), b.active !== false);
  res.json({ ok: true });
});
r.delete("/promos/:code", async (req, res) => {
  await db.run("DELETE FROM promos WHERE code = ?", req.params.code);
  res.json({ ok: true });
});

// ---- Flash sale ----
r.get("/flash-sales", async (_req, res) => res.json(await db.all("SELECT f.*, p.name AS product_name, p.brand FROM flash_sales f JOIN products p ON p.sku = f.sku ORDER BY f.end_at DESC LIMIT 100")));
r.post("/flash-sales", async (req, res) => {
  const b = req.body;
  const prod = await db.one("SELECT base_price FROM products WHERE sku = ?", b.sku);
  if (!prod) throw new HttpError(400, "SKU tidak ditemukan");
  const start = date(b.start_at), end = date(b.end_at);
  if (!(int(b.price) > 0) || !start || !end || isNaN(start) || isNaN(end) || end <= start) throw new HttpError(400, "Data flash sale tidak valid");
  if (int(b.price) < prod.base_price) throw new HttpError(400, `Harga flash di bawah harga modal (Rp${prod.base_price.toLocaleString("id-ID")})`);
  await db.run("INSERT INTO flash_sales (sku, price, stock, start_at, end_at) VALUES (?, ?, ?, ?, ?)", b.sku, int(b.price), int(b.stock), start, end);
  res.json({ ok: true });
});
r.delete("/flash-sales/:id", async (req, res) => {
  await db.run("DELETE FROM flash_sales WHERE id = ?", int(req.params.id));
  res.json({ ok: true });
});

// ---- Pengguna ----
r.get("/users", async (req, res) => {
  const q = like(req.query.q);
  res.json(await db.all("SELECT id, name, email, whatsapp, role, balance, created_at FROM users WHERE name ILIKE ? OR email ILIKE ? OR whatsapp ILIKE ? ORDER BY id DESC LIMIT 200", q, q, q));
});
r.patch("/users/:id", async (req, res) => {
  const u = await db.one("SELECT * FROM users WHERE id = ?", int(req.params.id));
  if (!u) throw new HttpError(404, "User tidak ditemukan");
  if (req.body.role) {
    if (!["member", "reseller", "admin"].includes(req.body.role)) throw new HttpError(400, "Role tidak valid");
    if (u.id === req.user.id && req.body.role !== "admin") throw new HttpError(400, "Tidak bisa menurunkan role akun sendiri");
    await db.run("UPDATE users SET role = ? WHERE id = ?", req.body.role, u.id);
  }
  if (req.body.balanceAdjust) {
    const amt = int(req.body.balanceAdjust, 0);
    await db.tx(t => orders.changeBalance(t, u.id, amt, String(req.body.note || "Penyesuaian oleh admin").slice(0, 120)));
  }
  res.json({ ok: true });
});

// ---- Ulasan ----
r.get("/reviews", async (_req, res) => res.json(await db.all("SELECT * FROM reviews ORDER BY id DESC LIMIT 200")));
r.patch("/reviews/:id", async (req, res) => {
  await db.run("UPDATE reviews SET visible = ? WHERE id = ?", !!req.body.visible, int(req.params.id));
  res.json({ ok: true });
});

module.exports = r;
