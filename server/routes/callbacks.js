const express = require("express");
const tripay = require("../services/tripay");
const digiflazz = require("../services/digiflazz");
const orders = require("../orders");
const jobs = require("../jobs");
const config = require("../config");

const r = express.Router();

// Callback pembayaran Tripay. Daftarkan URL: {BASE_URL}/api/callback/tripay
// Pengiriman ke Digiflazz ditunggu sampai selesai sebelum membalas (wajib di serverless).
r.post("/tripay", async (req, res) => {
  if (!tripay.verifyCallback(req.rawBody || "", req.get("X-Callback-Signature"))) {
    return res.status(403).json({ success: false, message: "Invalid signature" });
  }
  if (req.get("X-Callback-Event") !== "payment_status") return res.json({ success: true });
  const { merchant_ref: ref, status } = req.body || {};
  if (ref) await orders.handlePaymentStatus(String(ref), String(status));
  res.json({ success: true });
});

// Webhook Digiflazz. Daftarkan URL: {BASE_URL}/api/callback/digiflazz
r.post("/digiflazz", async (req, res) => {
  if (!digiflazz.verifyWebhook(req.rawBody || "", req.get("X-Hub-Signature"))) {
    return res.status(403).json({ message: "Invalid signature" });
  }
  const data = req.body?.data;
  if (data?.ref_id) await orders.applyProviderResult(String(data.ref_id), data);
  res.json({ ok: true });
});

// Vercel Cron: sinkron harga & pemeliharaan. Dilindungi CRON_SECRET.
r.get("/cron", async (req, res) => {
  if (!config.cronSecret || req.get("Authorization") !== `Bearer ${config.cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  res.json(await jobs.runCron());
});

module.exports = r;
