const digiflazz = require("./services/digiflazz");
const catalog = require("./catalog");
const orders = require("./orders");

const jobs = { lastSync: null };

jobs.syncPriceList = async () => {
  const list = await digiflazz.priceList();
  const n = catalog.syncProducts(list);
  jobs.lastSync = new Date().toISOString();
  console.log(`[sync] ${n} produk disinkronkan dari Digiflazz${digiflazz.isMock ? " (simulasi)" : ""}`);
  return n;
};

jobs.start = () => {
  const safe = (name, fn) => () => Promise.resolve().then(fn).catch(e => console.error(`[${name}]`, e.message));
  safe("sync", jobs.syncPriceList)();
  // Digiflazz membatasi frekuensi pemanggilan price list, jadi cukup tiap 6 jam (atau manual dari admin).
  setInterval(safe("sync", jobs.syncPriceList), 6 * 3600_000).unref();
  setInterval(safe("poll", orders.pollProcessing), digiflazz.isMock ? 3000 : 60_000).unref();
  setInterval(safe("expire", orders.expireUnpaid), 60_000).unref();
};

module.exports = jobs;
