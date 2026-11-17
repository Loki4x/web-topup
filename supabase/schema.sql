-- Skema database RhineShop (PostgreSQL / Supabase).
-- Dijalankan otomatis oleh server saat pertama kali terhubung, atau jalankan manual di
-- Supabase Dashboard -> SQL Editor. Aman dijalankan berulang kali.

CREATE TABLE IF NOT EXISTS users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  whatsapp TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'reseller', 'admin')),
  balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  sku TEXT PRIMARY KEY,                          -- buyer_sku_code Digiflazz
  brand TEXT NOT NULL,
  category TEXT NOT NULL,
  type TEXT,
  name TEXT NOT NULL,
  base_price BIGINT NOT NULL,                    -- harga modal dari Digiflazz
  available BOOLEAN NOT NULL DEFAULT true,       -- status dari Digiflazz
  enabled BOOLEAN NOT NULL DEFAULT true,         -- diatur admin
  label TEXT,                                    -- 'best' | 'promo' | null
  custom_price BIGINT,                           -- harga jual manual (opsional)
  synced_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,                           -- nomor invoice
  user_id BIGINT REFERENCES users(id),
  game_slug TEXT NOT NULL,
  game_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  customer_no TEXT NOT NULL,
  account_label TEXT NOT NULL,
  nickname TEXT,
  whatsapp TEXT NOT NULL,
  email TEXT,
  base_price BIGINT NOT NULL,
  price BIGINT NOT NULL,
  discount BIGINT NOT NULL DEFAULT 0,
  fee BIGINT NOT NULL DEFAULT 0,
  total BIGINT NOT NULL,
  promo_code TEXT,
  flash_id BIGINT,
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
  expired_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_provider_ref ON orders(provider_ref);

CREATE TABLE IF NOT EXISTS deposits (
  id TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  amount BIGINT NOT NULL,
  fee BIGINT NOT NULL DEFAULT 0,
  total BIGINT NOT NULL,
  payment_method TEXT NOT NULL,
  payment_name TEXT NOT NULL,
  payment_ref TEXT,
  pay_code TEXT,
  qr_url TEXT,
  checkout_url TEXT,
  status TEXT NOT NULL DEFAULT 'UNPAID',          -- UNPAID | PAID | EXPIRED | FAILED
  expired_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS balance_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  amount BIGINT NOT NULL,
  balance_after BIGINT NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_balance_logs_user ON balance_logs(user_id);

CREATE TABLE IF NOT EXISTS promos (
  code TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('percent', 'flat')),
  value BIGINT NOT NULL,
  max_discount BIGINT,
  min_purchase BIGINT NOT NULL DEFAULT 0,
  quota INTEGER,
  used INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flash_sales (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sku TEXT NOT NULL REFERENCES products(sku),
  price BIGINT NOT NULL,
  stock INTEGER,                                  -- null = tanpa batas
  sold INTEGER NOT NULL DEFAULT 0,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
  name TEXT NOT NULL,
  game_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO settings (key, value) VALUES
  ('margin_public', '8'),
  ('margin_member', '6'),
  ('margin_reseller', '3'),
  ('round_to', '100'),
  ('order_expiry_minutes', '60'),
  ('whatsapp_cs', '6281234567890'),
  ('last_sync', '')
ON CONFLICT (key) DO NOTHING;

-- Keamanan Supabase: aktifkan RLS tanpa policy agar tabel TIDAK bisa diakses lewat
-- REST API publik Supabase (anon key). Server terhubung langsung via Postgres sehingga tetap bisa akses.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE promos ENABLE ROW LEVEL SECURITY;
ALTER TABLE flash_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
