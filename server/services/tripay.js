// Integrasi payment gateway Tripay (https://tripay.co.id/developer)
const crypto = require("node:crypto");
const config = require("../config");

const { apiKey, privateKey, merchantCode, sandbox } = config.tripay;
const BASE = sandbox ? "https://tripay.co.id/api-sandbox" : "https://tripay.co.id/api";

async function request(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const json = await res.json().catch(() => ({}));
  if (!json.success) throw new Error(`Tripay ${path}: ${json.message || "HTTP " + res.status}`);
  return json.data;
}

const GROUP_ORDER = ["QRIS", "E-Wallet", "Virtual Account", "Convenience Store"];
const groupOf = c => (c.code.startsWith("QRIS") ? "QRIS" : c.group);

// Normalisasi channel ke bentuk yang dipakai frontend.
const normalize = c => ({
  code: c.code,
  name: c.name,
  group: groupOf(c),
  feeFlat: Number(c.fee_customer?.flat || 0),
  feePercent: Number(c.fee_customer?.percent || 0),
  minAmount: Number(c.minimum_amount || 0),
  maxAmount: Number(c.maximum_amount || 0),
  icon: c.icon_url || null,
});

const MOCK_CHANNELS = [
  { code: "QRIS", name: "QRIS (Semua E-Wallet & M-Banking)", group: "QRIS", fee_customer: { flat: 750, percent: 0.7 } },
  { code: "DANA", name: "DANA", group: "E-Wallet", fee_customer: { flat: 0, percent: 1.5 } },
  { code: "OVO", name: "OVO", group: "E-Wallet", fee_customer: { flat: 0, percent: 1.5 } },
  { code: "SHOPEEPAY", name: "ShopeePay", group: "E-Wallet", fee_customer: { flat: 0, percent: 2 } },
  { code: "BCAVA", name: "BCA Virtual Account", group: "Virtual Account", fee_customer: { flat: 5500, percent: 0 }, minimum_amount: 10000 },
  { code: "BRIVA", name: "BRI Virtual Account", group: "Virtual Account", fee_customer: { flat: 4250, percent: 0 }, minimum_amount: 10000 },
  { code: "BNIVA", name: "BNI Virtual Account", group: "Virtual Account", fee_customer: { flat: 4250, percent: 0 }, minimum_amount: 10000 },
  { code: "MANDIRIVA", name: "Mandiri Virtual Account", group: "Virtual Account", fee_customer: { flat: 4250, percent: 0 }, minimum_amount: 10000 },
  { code: "ALFAMART", name: "Alfamart", group: "Convenience Store", fee_customer: { flat: 3500, percent: 0 }, minimum_amount: 10000 },
  { code: "INDOMARET", name: "Indomaret", group: "Convenience Store", fee_customer: { flat: 3500, percent: 0 }, minimum_amount: 10000 },
];

let cache = { at: 0, data: null };
async function channels() {
  if (cache.data && Date.now() - cache.at < 10 * 60_000) return cache.data;
  const raw = config.mockTripay ? MOCK_CHANNELS : (await request("GET", "/merchant/payment-channel")).filter(c => c.active);
  const data = raw.map(normalize).sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));
  cache = { at: Date.now(), data };
  return data;
}

const feeFor = (ch, amount) => Math.ceil(ch.feeFlat + (amount * ch.feePercent) / 100);

/**
 * Buat tagihan. Biaya admin dibebankan ke pelanggan (atur juga di dashboard Tripay).
 * Mengembalikan { reference, payCode, qrUrl, checkoutUrl, total, fee, expiredAt }
 */
async function createTransaction({ method, merchantRef, amount, itemName, sku, customerName, customerEmail, customerPhone, returnPath, expirySeconds }) {
  const expiredTime = Math.floor(Date.now() / 1000) + expirySeconds;
  if (config.mockTripay) {
    const ch = (await channels()).find(c => c.code === method);
    const fee = feeFor(ch, amount);
    return {
      reference: "SIM-" + crypto.randomBytes(5).toString("hex").toUpperCase(),
      payCode: method === "QRIS" ? null : String(8800000000000000n + BigInt(crypto.randomInt(1e9))),
      qrUrl: null,
      checkoutUrl: null,
      total: amount + fee,
      fee,
      expiredAt: new Date(expiredTime * 1000),
    };
  }
  const signature = crypto.createHmac("sha256", privateKey).update(merchantCode + merchantRef + amount).digest("hex");
  const d = await request("POST", "/transaction/create", {
    method,
    merchant_ref: merchantRef,
    amount,
    customer_name: customerName,
    customer_email: customerEmail,
    customer_phone: customerPhone,
    order_items: [{ sku, name: itemName.slice(0, 100), price: amount, quantity: 1 }],
    callback_url: `${config.baseUrl}/api/callback/tripay`,
    return_url: `${config.baseUrl}/${returnPath}`,
    expired_time: expiredTime,
    signature,
  });
  return {
    reference: d.reference,
    payCode: d.pay_code || null,
    qrUrl: d.qr_url || null,
    checkoutUrl: d.checkout_url || null,
    total: Number(d.amount),
    fee: Number(d.fee_customer || 0),
    expiredAt: new Date(Number(d.expired_time) * 1000),
  };
}

// Verifikasi callback: header X-Callback-Signature = HMAC-SHA256(rawBody, privateKey)
function verifyCallback(rawBody, signature) {
  if (config.mockTripay) return false;
  const expected = crypto.createHmac("sha256", privateKey).update(rawBody).digest("hex");
  const got = String(signature || "");
  return got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

module.exports = { channels, feeFor, createTransaction, verifyCallback, isMock: config.mockTripay };
