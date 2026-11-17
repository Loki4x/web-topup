// Integrasi API Digiflazz (https://developer.digiflazz.com/api/buyer/)
const crypto = require("node:crypto");
const config = require("../config");
const mockPricelist = require("../mock/pricelist");

const BASE = "https://api.digiflazz.com/v1";
const md5 = s => crypto.createHash("md5").update(s).digest("hex");
const { username, apiKey } = config.digiflazz;

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const json = await res.json().catch(() => ({}));
  if (!json || json.data === undefined) throw new Error(`Digiflazz ${path}: respons tidak valid (HTTP ${res.status})`);
  return json.data;
}

// ---- Mock (dipakai jika kredensial Digiflazz belum diisi) ----
const mock = {
  async balance() {
    return 1_000_000;
  },
  async priceList() {
    return mockPricelist();
  },
  // customer_no berakhiran 0000 => simulasi gagal; selain itu sukses setelah beberapa detik
  async transaction({ sku, customerNo, refId }) {
    mock._pending.set(refId, Date.now());
    return { ref_id: refId, customer_no: customerNo, buyer_sku_code: sku, status: "Pending", message: "Transaksi Pending", sn: "", rc: "03" };
  },
  async status({ sku, customerNo, refId }) {
    const started = mock._pending.get(refId) || 0;
    if (Date.now() - started < 3000) return { ref_id: refId, status: "Pending", message: "Transaksi Pending", sn: "" };
    if (customerNo.endsWith("0000")) return { ref_id: refId, status: "Gagal", message: "Nomor tujuan salah (simulasi)", sn: "", rc: "49" };
    return { ref_id: refId, customer_no: customerNo, buyer_sku_code: sku, status: "Sukses", message: "Transaksi Sukses", sn: "SIM" + crypto.randomBytes(6).toString("hex").toUpperCase(), rc: "00" };
  },
  _pending: new Map(),
};

// ---- Real ----
const real = {
  async balance() {
    const d = await post("/cek-saldo", { cmd: "deposit", username, sign: md5(username + apiKey + "depo") });
    return Number(d.deposit);
  },
  async priceList() {
    const d = await post("/price-list", { cmd: "prepaid", username, sign: md5(username + apiKey + "pricelist") });
    if (!Array.isArray(d)) throw new Error(`Digiflazz price-list: ${d?.message || "gagal"}`);
    return d;
  },
  async transaction({ sku, customerNo, refId }) {
    const body = { username, buyer_sku_code: sku, customer_no: customerNo, ref_id: refId, sign: md5(username + apiKey + refId) };
    if (config.digiflazz.testing) body.testing = true;
    return post("/transaction", body);
  },
  // Cek status = kirim ulang request transaksi dengan ref_id yang sama.
  async status(args) {
    return real.transaction(args);
  },
};

const impl = config.mockDigiflazz ? mock : real;

// Verifikasi webhook: header X-Hub-Signature = "sha1=" + HMAC-SHA1(body, secret)
function verifyWebhook(rawBody, signatureHeader) {
  if (!config.digiflazz.webhookSecret) return false;
  const expected = "sha1=" + crypto.createHmac("sha1", config.digiflazz.webhookSecret).update(rawBody).digest("hex");
  const got = String(signatureHeader || "");
  return got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

module.exports = { ...impl, verifyWebhook, isMock: config.mockDigiflazz };
