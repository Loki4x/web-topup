const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");

const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) process.loadEnvFile(envPath);

const env = (k, d = "") => (process.env[k] ?? d).trim();

const config = {
  port: Number(env("PORT", "3000")),
  baseUrl: env("BASE_URL", "http://localhost:3000").replace(/\/$/, ""),
  storeName: env("STORE_NAME", "RhineShop"),
  storeEmail: env("STORE_EMAIL", "cs@rhineshop.id"),
  dbFile: env("DB_FILE", path.join(__dirname, "..", "data", "rhineshop.db")),
  sessionSecret: env("SESSION_SECRET") || crypto.randomBytes(32).toString("hex"),
  isProduction: env("NODE_ENV") === "production",

  digiflazz: {
    username: env("DIGIFLAZZ_USERNAME"),
    apiKey: env("DIGIFLAZZ_API_KEY"),
    webhookSecret: env("DIGIFLAZZ_WEBHOOK_SECRET"),
    // true = transaksi dikirim dengan flag testing (tidak memotong saldo Digiflazz)
    testing: env("DIGIFLAZZ_TESTING", "true") === "true",
  },

  tripay: {
    apiKey: env("TRIPAY_API_KEY"),
    privateKey: env("TRIPAY_PRIVATE_KEY"),
    merchantCode: env("TRIPAY_MERCHANT_CODE"),
    sandbox: env("TRIPAY_SANDBOX", "true") === "true",
  },

  nickname: {
    // URL API pengecekan nickname pihak ketiga (opsional). Lihat services/nickname.js
    url: env("NICKNAME_API_URL"),
    key: env("NICKNAME_API_KEY"),
  },
};

config.mockDigiflazz = !config.digiflazz.username || !config.digiflazz.apiKey;
config.mockTripay = !config.tripay.apiKey || !config.tripay.privateKey || !config.tripay.merchantCode;
config.mockNickname = !config.nickname.url;

if (!env("SESSION_SECRET")) {
  console.warn("[config] SESSION_SECRET belum diisi — sesi login akan hilang setiap server restart.");
}

module.exports = config;
