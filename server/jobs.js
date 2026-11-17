const digiflazz = require("./services/digiflazz");
const catalog = require("./catalog");
const orders = require("./orders");
const { db } = require("./db");

async function syncPriceList() {
  const list = await digiflazz.priceList();
  const n = await catalog.syncProducts(list);
  await db.setSetting("last_sync", new Date().toISOString());
  console.log(`[sync] ${n} produk disinkronkan dari Digiflazz${digiflazz.isMock ? " (simulasi)" : ""}`);
  return n;
}

/** Sinkron produk bila belum pernah (mis. database baru) — dipanggil saat request pertama. */
let ensured;
function ensureProducts() {
  return (ensured ??= db.one("SELECT 1 AS x FROM products LIMIT 1").then(r => (r ? 0 : syncPriceList())).catch(e => {
    ensured = null;
    console.error("[sync]", e.message);
  }));
}

/** Tugas berkala (Vercel Cron sekali sehari, atau interval di server lokal). */
async function runCron() {
  const result = {};
  try { result.synced = await syncPriceList(); } catch (e) { result.syncError = e.message; }
  try { await orders.maintenance(); result.maintenance = "ok"; } catch (e) { result.maintenanceError = e.message; }
  return result;
}

/** Hanya untuk server lokal / VPS (proses berjalan terus). */
function startIntervals() {
  const safe = (name, fn) => () => Promise.resolve().then(fn).catch(e => console.error(`[${name}]`, e.message));
  setInterval(safe("sync", syncPriceList), 6 * 3600_000).unref();
  setInterval(safe("maintenance", orders.maintenance), digiflazz.isMock ? 5000 : 60_000).unref();
}

module.exports = { syncPriceList, ensureProducts, runCron, startIntervals };
