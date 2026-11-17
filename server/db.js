const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const config = require("./config");

fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });
const db = new DatabaseSync(config.dbFile);
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  whatsapp TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',          -- member | reseller | admin
  balance INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  sku TEXT PRIMARY KEY,                          -- buyer_sku_code Digiflazz
  brand TEXT NOT NULL,
  category TEXT NOT NULL,
  type TEXT,
  name TEXT NOT NULL,
  base_price INTEGER NOT NULL,                   -- harga modal dari Digiflazz
  available INTEGER NOT NULL DEFAULT 1,          -- status dari Digiflazz
  enabled INTEGER NOT NULL DEFAULT 1,            -- diatur admin
  label TEXT,                                    -- 'best' | 'promo' | null
  custom_price INTEGER,                          -- harga jual manual (opsional)
  synced_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,                           -- nomor invoice
  user_id INTEGER REFERENCES users(id),
  game_slug TEXT NOT NULL,
  game_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  customer_no TEXT NOT NULL,
  account_label TEXT NOT NULL,
  nickname TEXT,
  whatsapp TEXT NOT NULL,
  email TEXT,
  base_price INTEGER NOT NULL,
  price INTEGER NOT NULL,
  discount INTEGER NOT NULL DEFAULT 0,
  fee INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  promo_code TEXT,
  flash_id INTEGER,
  payment_method TEXT NOT NULL,
  payment_name TEXT NOT NULL,
  payment_ref TEXT,
  pay_code TEXT,
  qr_url TEXT,
  checkout_url TEXT,
  payment_status TEXT NOT NULL DEFAULT 'UNPAID', -- UNPAID | PAID | EXPIRED | FAILED
  status TEXT NOT NULL DEFAULT 'WAITING',        -- WAITING | PROCESSING | SUCCESS | FAILED | REFUNDED | EXPIRED
  provider_ref TEXT,                             -- ref_id yang dikirim ke Digiflazz (berubah saat kirim ulang)
  sn TEXT,
  provider_message TEXT,
  expired_at TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);

CREATE TABLE IF NOT EXISTS deposits (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,
  fee INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  payment_method TEXT NOT NULL,
  payment_name TEXT NOT NULL,
  payment_ref TEXT,
  pay_code TEXT,
  qr_url TEXT,
  checkout_url TEXT,
  status TEXT NOT NULL DEFAULT 'UNPAID',          -- UNPAID | PAID | EXPIRED | FAILED
  expired_at TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS balance_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS promos (
  code TEXT PRIMARY KEY,
  type TEXT NOT NULL,                             -- percent | flat
  value INTEGER NOT NULL,
  max_discount INTEGER,
  min_purchase INTEGER NOT NULL DEFAULT 0,
  quota INTEGER,
  used INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS flash_sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT NOT NULL REFERENCES products(sku),
  price INTEGER NOT NULL,
  stock INTEGER,                                  -- null = tanpa batas
  sold INTEGER NOT NULL DEFAULT 0,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
  name TEXT NOT NULL,
  game_name TEXT NOT NULL,
  rating INTEGER NOT NULL,
  comment TEXT NOT NULL,
  visible INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

const DEFAULT_SETTINGS = {
  margin_public: "8",       // % keuntungan untuk pembeli umum
  margin_member: "6",       // % untuk member terdaftar
  margin_reseller: "3",     // % untuk reseller
  round_to: "100",          // pembulatan harga ke atas
  order_expiry_minutes: "60",
  whatsapp_cs: "6281234567890",
};
const insertSetting = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insertSetting.run(k, v);

function getSettings() {
  return Object.fromEntries(db.prepare("SELECT key, value FROM settings").all().map(r => [r.key, r.value]));
}
function setSetting(key, value) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, String(value));
}

// Jalankan fn di dalam transaksi SQLite (BEGIN IMMEDIATE agar aman untuk saldo).
function tx(fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const r = fn();
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

module.exports = { db, tx, getSettings, setSetting };
