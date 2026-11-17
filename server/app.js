// Aplikasi Express. Dipakai oleh server lokal (server/index.js) dan Vercel (api/index.js).
const path = require("node:path");
const express = require("express");
const { db } = require("./db");
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

// Pastikan tabel ada & produk sudah tersinkron sebelum melayani API.
app.use("/api", async (_req, _res, next) => {
  try {
    await db.ready();
    await jobs.ensureProducts();
    next();
  } catch (e) {
    next(e);
  }
});

// Callback Tripay/Digiflazz & cron: tanpa sesi, diverifikasi dengan signature/secret.
app.use("/api/callback", require("./routes/callbacks"));

app.use("/api", (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
app.use("/api", auth.requireJson, auth.loadUser);
app.use("/api/admin", require("./routes/admin"));
app.use("/api", require("./routes/api"));
app.use("/api", (_req, res) => res.status(404).json({ error: "Endpoint tidak ditemukan" }));

// Di Vercel file statis dilayani CDN dari folder public/; ini untuk server lokal.
app.use(express.static(path.join(__dirname, "..", "public"), { extensions: ["html"] }));

app.use((err, _req, res, _next) => {
  const status = err.status || (err.type === "entity.parse.failed" ? 400 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? "Terjadi kesalahan server" : err.message });
});

module.exports = app;
