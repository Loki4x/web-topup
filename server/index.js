// Server lokal / VPS. Di Vercel yang dipakai adalah api/index.js.
const config = require("./config");
const app = require("./app");
const jobs = require("./jobs");

app.listen(config.port, () => {
  console.log(`${config.storeName} berjalan di http://localhost:${config.port}`);
  if (config.mockDigiflazz) console.log("  • Digiflazz: MODE SIMULASI (isi DIGIFLAZZ_USERNAME & DIGIFLAZZ_API_KEY)");
  if (config.mockTripay) console.log("  • Tripay: MODE SIMULASI (isi TRIPAY_API_KEY, TRIPAY_PRIVATE_KEY, TRIPAY_MERCHANT_CODE)");
  if (config.mockNickname) console.log("  • Cek nickname: MODE SIMULASI (isi NICKNAME_API_URL)");
  jobs.startIntervals();
});
