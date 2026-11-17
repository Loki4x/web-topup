const express = require("express");
const { db, getSettings, setSetting, tx } = require("../db");
const orders = require("../orders");
const digiflazz = require("../services/digiflazz");
const jobs = require("../jobs");
const auth = require("../auth");
const { HttpError, asyncH } = require("../util");

const r = express.Router();
r.use(auth.requireUser, auth.requireAdmin);

const int = (v, d = null) => (v === "" || v == null ? d : Math.floor(Number(v)));
const like = q => `%${String(q || "").trim()}%`;

r.get("/stats", asyncH(async (_req, res) => {
  const day = db.prepare(`SELECT COUNT(*) AS orders, COALESCE(SUM(price - discount), 0) AS revenue, COALESCE(SUM(price - discount - base_price), 0) AS profit
    FROM orders WHERE status = 'SUCCESS' AND created_at >= date('now')`).get();
  const month = db.prepare(`SELECT COUNT(*) AS orders, COALESCE(SUM(price - discount), 0) AS revenue, COALESCE(SUM(price - discount - base_price), 0) AS profit
    FROM orders WHERE status = 'SUCCESS' AND created_at >= date('now', 'start of month')`).get();
  const counts = Object.fromEntries(db.prepare("SELECT status, COUNT(*) AS n FROM orders GROUP BY status").all().map(x => [x.status, x.n]));
  const users = db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(balance), 0) AS balance FROM users").get();
  let providerBalance = null;
  try { providerBalance = await digiflazz.balance(); } catch (e) { providerBalance = { error: e.message }; }
  res.json({ day, month, counts, users, providerBalance, lastSync: jobs.lastSync });
}));

// ---- Pesanan ----
r.get("/orders", (req, res) => {
  const { status = "", q = "" } = req.query;
  res.json(db.prepare(`SELECT * FROM orders WHERE (? = '' OR status = ?) AND (id LIKE ? OR customer_no LIKE ? OR whatsapp LIKE ? OR product_name LIKE ?)
    ORDER BY created_at DESC LIMIT 200`).all(status, status, like(q), like(q), like(q), like(q)));
});

// Kirim ulang pesanan lunas yang gagal ke Digiflazz.
r.post("/orders/:id/retry", (req, res) => {
  orders.retryOrder(req.params.id);
  res.json({ ok: true });
});

r.post("/orders/:id/mark", (req, res) => {
  const { status, sn = null, note = null } = req.body;
  if (!["SUCCESS", "FAILED", "REFUNDED"].includes(status)) throw new HttpError(400, "Status tidak valid");
  db.prepare("UPDATE orders SET status = ?, sn = COALESCE(?, sn), provider_message = COALESCE(?, provider_message), updated_at = datetime('now') WHERE id = ?").run(status, sn, note, req.params.id);
  res.json({ ok: true });
});

// ---- Produk ----
r.get("/products", (req, res) => {
  res.json(db.prepare("SELECT * FROM products WHERE brand LIKE ? OR name LIKE ? OR sku LIKE ? ORDER BY brand, base_price LIMIT 500").all(like(req.query.q), like(req.query.q), like(req.query.q)));
});
r.patch("/products/:sku", (req, res) => {
  const p = db.prepare("SELECT * FROM products WHERE sku = ?").get(req.params.sku);
  if (!p) throw new HttpError(404, "Produk tidak ditemukan");
  const b = req.body;
  db.prepare("UPDATE products SET enabled = ?, label = ?, custom_price = ? WHERE sku = ?").run(
    b.enabled === undefined ? p.enabled : b.enabled ? 1 : 0,
    b.label === undefined ? p.label : ["best", "promo"].includes(b.label) ? b.label : null,
    b.custom_price === undefined ? p.custom_price : int(b.custom_price),
    p.sku);
  res.json({ ok: true });
});
r.post("/products/brand-toggle", (req, res) => {
  db.prepare("UPDATE products SET enabled = ? WHERE brand = ?").run(req.body.enabled ? 1 : 0, String(req.body.brand));
  res.json({ ok: true });
});
r.post("/sync", asyncH(async (_req, res) => res.json({ count: await jobs.syncPriceList() })));

// ---- Pengaturan ----
r.get("/settings", (_req, res) => res.json(getSettings()));
r.put("/settings", (req, res) => {
  const allowed = ["margin_public", "margin_member", "margin_reseller", "round_to", "order_expiry_minutes", "whatsapp_cs"];
  for (const k of allowed) if (req.body[k] !== undefined) setSetting(k, String(req.body[k]).trim());
  res.json(getSettings());
});

// ---- Promo ----
r.get("/promos", (_req, res) => res.json(db.prepare("SELECT * FROM promos ORDER BY rowid DESC").all()));
r.post("/promos", (req, res) => {
  const b = req.body;
  const code = String(b.code || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{3,20}$/.test(code)) throw new HttpError(400, "Kode 3-20 huruf/angka");
  if (!["percent", "flat"].includes(b.type) || !(int(b.value) > 0)) throw new HttpError(400, "Tipe/nilai tidak valid");
  db.prepare(`INSERT INTO promos (code, type, value, max_discount, min_purchase, quota, expires_at, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET type = excluded.type, value = excluded.value, max_discount = excluded.max_discount, min_purchase = excluded.min_purchase,
    quota = excluded.quota, expires_at = excluded.expires_at, active = excluded.active`)
    .run(code, b.type, int(b.value), int(b.max_discount), int(b.min_purchase, 0), int(b.quota), b.expires_at ? String(b.expires_at).replace("T", " ") : null, b.active === false ? 0 : 1);
  res.json({ ok: true });
});
r.delete("/promos/:code", (req, res) => {
  db.prepare("DELETE FROM promos WHERE code = ?").run(req.params.code);
  res.json({ ok: true });
});

// ---- Flash sale ----
// Waktu disimpan dalam UTC (format SQLite). Frontend admin mengonversi dari waktu lokal.
r.get("/flash-sales", (_req, res) => res.json(db.prepare("SELECT f.*, p.name AS product_name, p.brand FROM flash_sales f JOIN products p ON p.sku = f.sku ORDER BY f.end_at DESC LIMIT 100").all()));
r.post("/flash-sales", (req, res) => {
  const b = req.body;
  const prod = db.prepare("SELECT base_price FROM products WHERE sku = ?").get(b.sku);
  if (!prod) throw new HttpError(400, "SKU tidak ditemukan");
  if (int(b.price) < prod.base_price) throw new HttpError(400, `Harga flash di bawah harga modal (Rp${prod.base_price.toLocaleString("id-ID")})`);
  if (!(int(b.price) > 0) || !b.start_at || !b.end_at || b.end_at <= b.start_at) throw new HttpError(400, "Data flash sale tidak valid");
  db.prepare("INSERT INTO flash_sales (sku, price, stock, start_at, end_at) VALUES (?, ?, ?, ?, ?)").run(b.sku, int(b.price), int(b.stock), b.start_at, b.end_at);
  res.json({ ok: true });
});
r.delete("/flash-sales/:id", (req, res) => {
  db.prepare("DELETE FROM flash_sales WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ---- Pengguna ----
r.get("/users", (req, res) => {
  res.json(db.prepare("SELECT id, name, email, whatsapp, role, balance, created_at FROM users WHERE name LIKE ? OR email LIKE ? OR whatsapp LIKE ? ORDER BY id DESC LIMIT 200").all(like(req.query.q), like(req.query.q), like(req.query.q)));
});
r.patch("/users/:id", (req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!u) throw new HttpError(404, "User tidak ditemukan");
  if (req.body.role) {
    if (!["member", "reseller", "admin"].includes(req.body.role)) throw new HttpError(400, "Role tidak valid");
    if (u.id === req.user.id && req.body.role !== "admin") throw new HttpError(400, "Tidak bisa menurunkan role akun sendiri");
    db.prepare("UPDATE users SET role = ? WHERE id = ?").run(req.body.role, u.id);
  }
  if (req.body.balanceAdjust) {
    const amt = int(req.body.balanceAdjust, 0);
    tx(() => orders.changeBalance(u.id, amt, String(req.body.note || "Penyesuaian oleh admin").slice(0, 120)));
  }
  res.json({ ok: true });
});

// ---- Ulasan ----
r.get("/reviews", (_req, res) => res.json(db.prepare("SELECT * FROM reviews ORDER BY id DESC LIMIT 200").all()));
r.patch("/reviews/:id", (req, res) => {
  db.prepare("UPDATE reviews SET visible = ? WHERE id = ?").run(req.body.visible ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

module.exports = r;
