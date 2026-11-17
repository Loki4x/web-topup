// Koneksi PostgreSQL (Supabase). Query memakai placeholder "?" yang diubah otomatis ke $1, $2, ...
const fs = require("node:fs");
const path = require("node:path");
const { Pool, types } = require("pg");
const config = require("./config");

// BIGINT & NUMERIC dikembalikan sebagai Number (nilai rupiah aman di bawah 2^53).
types.setTypeParser(20, v => Number(v));
types.setTypeParser(1700, v => Number(v));

if (!config.databaseUrl) {
  throw new Error("DATABASE_URL belum diisi. Isi dengan connection string Supabase (lihat README).");
}

const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(config.databaseUrl);
const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  // Di serverless setiap instance cukup memakai sedikit koneksi; pooling utama dilakukan oleh Supabase.
  max: config.isServerless ? 3 : 10,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
});
pool.on("error", e => console.error("[db]", e.message));

const toPg = sql => {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
};

function wrap(runner) {
  const query = (sql, params = []) => runner.query(toPg(sql), params);
  return {
    query,
    one: async (sql, ...params) => (await query(sql, params)).rows[0] || null,
    all: async (sql, ...params) => (await query(sql, params)).rows,
    run: async (sql, ...params) => (await query(sql, params)).rowCount,
  };
}

const db = wrap(pool);

// Jalankan fn di dalam transaksi. fn menerima objek dengan method yang sama seperti db.
db.tx = async fn => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const r = await fn(wrap(client));
    await client.query("COMMIT");
    return r;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
};

// Buat tabel otomatis jika database masih kosong (dicek sekali per instance).
// Perubahan skema berikutnya: jalankan ulang supabase/schema.sql atau `npm run db:setup`.
async function migrate(force = false) {
  if (!force && (await db.one("SELECT to_regclass('public.settings') AS t")).t) return;
  await db.tx(async t => {
    await t.query("SELECT pg_advisory_xact_lock(424242)");
    await t.query(fs.readFileSync(path.join(__dirname, "..", "supabase", "schema.sql"), "utf8"));
  });
}
let ready;
db.ready = () => (ready ??= migrate().catch(e => {
  ready = null;
  throw e;
}));
db.migrate = migrate;

db.getSettings = async () => Object.fromEntries((await db.all("SELECT key, value FROM settings")).map(r => [r.key, r.value]));
db.setSetting = (key, value) => db.run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", key, String(value));
db.end = () => pool.end();

module.exports = { db };
