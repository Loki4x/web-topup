const path = require("node:path");
const express = require("express");
const config = require("./config");
require("./db");
const auth = require("./auth");
const jobs = require("./jobs");

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(express.json({ limit: "100kb", verify: (req, _res, buf) => { req.rawBody = buf.toString("utf8"); } }));
app.use((_req, res, next) => {
  res.set({ "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin", "X-Frame-Options": "DENY" });
  next();
});

// Callback dari Tripay/Digiflazz: tanpa sesi, diverifikasi dengan signature.
app.use("/api/callback", require("./routes/callbacks"));

app.use("/api", auth.requireJson, auth.loadUser);
app.use("/api/admin", require("./routes/admin"));
app.use("/api", require("./routes/api"));
app.use("/api", (_req, res) => res.status(404).json({ error: "Endpoint tidak ditemukan" }));

app.use(express.static(path.join(__dirname, "..", "public"), { extensions: ["html"] }));

app.use((err, _req, res, _next) => {
  const status = err.status || (err.type === "entity.parse.failed" ? 400 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? "Terjadi kesalahan server" : err.message });
});

app.listen(config.port, () => {
  console.log(`${config.storeName} berjalan di ${config.baseUrl} (port ${config.port})`);
  if (config.mockDigiflazz) console.log("  • Digiflazz: MODE SIMULASI (isi DIGIFLAZZ_USERNAME & DIGIFLAZZ_API_KEY)");
  if (config.mockTripay) console.log("  • Tripay: MODE SIMULASI (isi TRIPAY_API_KEY, TRIPAY_PRIVATE_KEY, TRIPAY_MERCHANT_CODE)");
  if (config.mockNickname) console.log("  • Cek nickname: MODE SIMULASI (isi NICKNAME_API_URL)");
  jobs.start();
});
