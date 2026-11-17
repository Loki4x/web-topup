// Katalog: tampilan per brand Digiflazz + perhitungan harga jual.
const { db } = require("./db");

const key = s => String(s).toUpperCase().replace(/[^A-Z0-9]/g, "");

const ID_FIELD = { key: "userId", label: "User ID", placeholder: "Masukkan User ID", pattern: "^[0-9]{3,20}$" };
const ANY_ID = { key: "userId", label: "ID Akun", placeholder: "Masukkan ID akun", pattern: "^.{3,40}$" };
const PHONE = { key: "userId", label: "Nomor HP", placeholder: "08xxxxxxxxxx", pattern: "^08[0-9]{7,12}$" };

/**
 * Konfigurasi brand. `brand` harus sama dengan nama brand di price list Digiflazz
 * (perbandingan mengabaikan huruf besar/kecil dan spasi).
 * customerNo: cara menyusun customer_no untuk Digiflazz dari isian pembeli.
 * nickCode: kode game untuk API cek nickname (lihat services/nickname.js).
 */
const GAMES = [
  { brand: "MOBILE LEGENDS", slug: "mobile-legends", name: "Mobile Legends", publisher: "Moonton", colors: ["#2b5cff", "#00d4ff"], popular: true, nickCode: "ml",
    fields: [ID_FIELD, { key: "zoneId", label: "Zone ID", placeholder: "Zone ID", pattern: "^[0-9]{2,6}$" }],
    customerNo: f => f.userId + f.zoneId,
    guide: "Buka profil di dalam game. User ID dan Zone ID tertera di bawah nama, contoh: 12345678 (1234)." },
  { brand: "FREE FIRE", slug: "free-fire", name: "Free Fire", publisher: "Garena", colors: ["#ff7a00", "#ffcc00"], popular: true, nickCode: "ff",
    fields: [{ ...ID_FIELD, label: "Player ID", placeholder: "Masukkan Player ID" }],
    guide: "Ketuk avatar di pojok kiri atas, Player ID tertera di bawah nickname." },
  { brand: "PUBG MOBILE", slug: "pubg-mobile", name: "PUBG Mobile", publisher: "Tencent", colors: ["#c48a1c", "#3d2a0a"], popular: true, nickCode: "pubgm",
    fields: [{ ...ID_FIELD, label: "Character ID", placeholder: "Masukkan Character ID" }],
    guide: "Ketuk avatar di lobby, Character ID tertera di bawah nama karakter." },
  { brand: "GENSHIN IMPACT", slug: "genshin-impact", name: "Genshin Impact", publisher: "HoYoverse", colors: ["#6a5cff", "#e7c27a"], popular: true, nickCode: "gi",
    fields: [{ ...ID_FIELD, label: "UID", placeholder: "Masukkan UID", pattern: "^[0-9]{9,10}$" }],
    guide: "UID tertera di pojok kanan bawah layar saat bermain. Server otomatis terdeteksi dari UID." },
  { brand: "HONKAI STAR RAIL", slug: "honkai-star-rail", name: "Honkai: Star Rail", publisher: "HoYoverse", colors: ["#1b1f4b", "#9d7bff"], nickCode: "hsr",
    fields: [{ ...ID_FIELD, label: "UID", placeholder: "Masukkan UID", pattern: "^[0-9]{9,10}$" }],
    guide: "UID tertera di menu Phone > profil karakter." },
  { brand: "VALORANT", slug: "valorant", name: "Valorant", publisher: "Riot Games", colors: ["#ff4655", "#1f2326"],
    fields: [{ key: "userId", label: "Riot ID", placeholder: "Nama#TAG", pattern: "^.{3,16}#[A-Za-z0-9]{2,5}$" }],
    guide: "Riot ID berformat Nama#TAG, dapat dilihat di menu profil." },
  { brand: "CALL OF DUTY MOBILE", slug: "call-of-duty-mobile", name: "Call of Duty Mobile", publisher: "Activision", colors: ["#3c4a3a", "#a5b48c"], nickCode: "codm",
    fields: [{ ...ID_FIELD, label: "Open ID", placeholder: "Masukkan Open ID" }],
    guide: "Open ID dapat dilihat di menu Settings > Legal and Privacy." },
  { brand: "HONOR OF KINGS", slug: "honor-of-kings", name: "Honor of Kings", publisher: "Level Infinite", colors: ["#b8860b", "#5b1a1a"],
    fields: [{ ...ID_FIELD, label: "Player ID" }], guide: "Ketuk avatar di lobby untuk melihat Player ID." },
  { brand: "MAGIC CHESS", slug: "magic-chess", name: "Magic Chess: Go Go", publisher: "Moonton", colors: ["#7b2bff", "#ff5fa2"], nickCode: "mcgg",
    fields: [ID_FIELD, { key: "zoneId", label: "Zone ID", placeholder: "Zone ID", pattern: "^[0-9]{2,6}$" }],
    customerNo: f => f.userId + f.zoneId, guide: "User ID dan Zone ID tertera di halaman profil." },
  { brand: "ROBLOX", slug: "roblox", name: "Roblox", publisher: "Roblox Corp.", colors: ["#e2231a", "#3a3a3a"], voucher: true,
    fields: [], guide: "Kode voucher Robux dikirim di halaman invoice dan WhatsApp. Tukarkan di roblox.com/redeem." },
  { brand: "STUMBLE GUYS", slug: "stumble-guys", name: "Stumble Guys", publisher: "Scopely", colors: ["#ffb800", "#ff3d7f"],
    fields: [ANY_ID], guide: "ID akun dapat dilihat di menu profil." },
  { brand: "ARENA OF VALOR", slug: "arena-of-valor", name: "Arena of Valor", publisher: "Garena", colors: ["#2a4b8d", "#d4af37"],
    fields: [ID_FIELD], guide: "ID akun tertera di halaman profil." },
  { brand: "STEAM WALLET (IDR)", slug: "steam-wallet", name: "Steam Wallet", publisher: "Valve", colors: ["#171a21", "#66c0f4"], voucher: true, category: "Voucher",
    fields: [], guide: "Kode voucher dikirim di halaman invoice dan WhatsApp." },
  { brand: "GOOGLE PLAY INDONESIA", slug: "google-play", name: "Google Play Voucher", publisher: "Google", colors: ["#34a853", "#4285f4"], voucher: true, category: "Voucher",
    fields: [], guide: "Kode voucher dikirim di halaman invoice dan WhatsApp." },
  { brand: "SPOTIFY", slug: "spotify", name: "Spotify Premium", publisher: "Spotify", colors: ["#1db954", "#0b3d1f"], voucher: true, category: "Entertainment",
    fields: [], guide: "Kode voucher dikirim di halaman invoice dan WhatsApp." },
  { brand: "TELKOMSEL", slug: "pulsa-telkomsel", name: "Pulsa Telkomsel", publisher: "Telkomsel", colors: ["#e0001b", "#ff6a3d"],
    fields: [PHONE], guide: "Masukkan nomor Telkomsel aktif." },
  { brand: "PLN", slug: "token-pln", name: "Token Listrik PLN", publisher: "PLN", colors: ["#00a2e9", "#ffd200"],
    fields: [{ key: "userId", label: "Nomor Meter / ID Pelanggan", placeholder: "Masukkan nomor meter", pattern: "^[0-9]{11,12}$" }],
    guide: "Nomor meter tertera di meteran listrik prabayar Anda." },
  { brand: "DANA", slug: "saldo-dana", name: "Saldo DANA", publisher: "DANA", colors: ["#118eea", "#0b5cad"],
    fields: [PHONE], guide: "Masukkan nomor HP yang terdaftar di DANA." },
];

// Kategori Digiflazz -> tab di website
const CATEGORY_TAB = { GAMES: "Top Up Games", VOUCHER: "Voucher", PULSA: "Pulsa & Data", DATA: "Pulsa & Data", EMONEY: "E-Money", PLN: "PLN", STREAMING: "Entertainment", TV: "Entertainment" };
const TABS = ["Top Up Games", "Voucher", "Pulsa & Data", "E-Money", "PLN", "Entertainment", "Lainnya"];

const PALETTE = [["#6c5cff", "#00d4ff"], ["#ff6a3d", "#ffb800"], ["#00b894", "#0984e3"], ["#e84393", "#6c5ce7"], ["#2d3436", "#636e72"]];
const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Daftar game/brand yang punya produk aktif, digabung dengan konfigurasi tampilan. */
async function listGames() {
  const brands = await db.all(`
    SELECT brand, MIN(category) AS category, COUNT(*) AS n FROM products
    WHERE enabled AND available GROUP BY brand`);
  const byKey = new Map(GAMES.map(g => [key(g.brand), g]));
  return brands.map((b, i) => {
    const cfg = byKey.get(key(b.brand));
    const base = cfg || {
      brand: b.brand, slug: slugify(b.brand), name: b.brand.replace(/\b\w+/g, w => w[0] + w.slice(1).toLowerCase()),
      publisher: b.category, colors: PALETTE[i % PALETTE.length], fields: [ANY_ID], guide: "Masukkan ID/nomor tujuan dengan benar.",
    };
    return { ...base, brand: b.brand, category: base.category || CATEGORY_TAB[key(b.category)] || "Lainnya", productCount: b.n };
  }).sort((a, b) => (b.popular ? 1 : 0) - (a.popular ? 1 : 0) || (byKey.has(key(b.brand)) ? 1 : 0) - (byKey.has(key(a.brand)) ? 1 : 0) || a.name.localeCompare(b.name));
}

const findGame = async slug => (await listGames()).find(g => g.slug === slug) || null;

// Bentuk aman untuk dikirim ke browser (tanpa fungsi).
const publicGame = g => ({
  slug: g.slug, name: g.name, publisher: g.publisher, colors: g.colors, popular: !!g.popular, category: g.category,
  voucher: !!g.voucher, guide: g.guide, canCheckNickname: !!g.nickCode,
  fields: g.fields.map(({ key, label, placeholder, pattern }) => ({ key, label, placeholder, pattern })),
});

function roleMargin(role, s) {
  if (role === "reseller") return Number(s.margin_reseller);
  if (role === "member" || role === "admin") return Number(s.margin_member);
  return Number(s.margin_public);
}

/** Harga jual untuk role tertentu ('guest' | 'member' | 'reseller' | 'admin'). */
function sellPrice(product, role, s) {
  if (product.custom_price && role === "guest") return product.custom_price;
  const round = Math.max(1, Number(s.round_to) || 1);
  const p = Math.ceil((product.base_price * (1 + roleMargin(role, s) / 100)) / round) * round;
  return product.custom_price ? Math.min(p, product.custom_price) : p;
}

function activeFlashSales() {
  return db.all(`
    SELECT f.*, p.name AS product_name, p.brand FROM flash_sales f JOIN products p ON p.sku = f.sku
    WHERE f.start_at <= now() AND f.end_at > now() AND (f.stock IS NULL OR f.sold < f.stock) AND p.enabled AND p.available
    ORDER BY f.end_at`);
}

/** Produk untuk satu brand, lengkap dengan harga sesuai role & flash sale. */
async function productsFor(brand, role) {
  const [s, flashes, rows] = await Promise.all([
    db.getSettings(),
    activeFlashSales(),
    db.all("SELECT * FROM products WHERE brand = ? AND enabled AND available ORDER BY base_price", brand),
  ]);
  const flash = new Map(flashes.map(f => [f.sku, f]));
  return rows.map(p => {
    const normal = sellPrice(p, role, s);
    const f = flash.get(p.sku);
    const price = f ? Math.min(f.price, normal) : normal;
    const short = p.name.replace(new RegExp("^" + brand.replace(/[^A-Za-z0-9 ]/g, ".?") + "\\s*[-:]?\\s*", "i"), "").trim();
    return {
      sku: p.sku, name: /[a-z]/i.test(short) ? short : p.name, price, normalPrice: f ? sellPrice(p, "guest", s) : null, label: p.label,
      flash: f ? { id: f.id, endAt: f.end_at, stockLeft: f.stock == null ? null : f.stock - f.sold } : null,
    };
  });
}

/** Simpan hasil price list Digiflazz ke tabel products (satu query massal, cepat untuk serverless). */
async function syncProducts(list) {
  const uniq = new Map(list.map(p => [p.buyer_sku_code, p]));
  const rows = [...uniq.values()];
  const col = f => rows.map(f);
  await db.tx(async t => {
    await t.query(`
      INSERT INTO products (sku, brand, category, type, name, base_price, available, synced_at)
      SELECT u.sku, u.brand, u.category, u.type, u.name, u.base_price, u.available, now()
      FROM unnest(?::text[], ?::text[], ?::text[], ?::text[], ?::text[], ?::bigint[], ?::boolean[]) AS u(sku, brand, category, type, name, base_price, available)
      ON CONFLICT (sku) DO UPDATE SET brand = excluded.brand, category = excluded.category, type = excluded.type,
        name = excluded.name, base_price = excluded.base_price, available = excluded.available, synced_at = excluded.synced_at`,
      [
        col(p => p.buyer_sku_code), col(p => p.brand), col(p => p.category), col(p => p.type || null), col(p => p.product_name),
        col(p => Number(p.price)), col(p => !!(p.buyer_product_status && p.seller_product_status && (p.unlimited_stock || p.stock > 0))),
      ]);
    // Produk yang hilang dari price list ditandai tidak tersedia.
    await t.query("UPDATE products SET available = false WHERE NOT (sku = ANY(?::text[]))", [col(p => p.buyer_sku_code)]);
  });
  return rows.length;
}

module.exports = { listGames, findGame, publicGame, productsFor, sellPrice, activeFlashSales, syncProducts, TABS };
