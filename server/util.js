const crypto = require("node:crypto");

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const newId = prefix => {
  const d = new Date();
  const ymd = `${d.getFullYear() % 100}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `${prefix}${ymd}${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
};

const normalizePhone = p => {
  let s = String(p || "").replace(/\D/g, "");
  if (s.startsWith("62")) s = "0" + s.slice(2);
  return s;
};
const isValidPhone = p => /^08\d{7,12}$/.test(normalizePhone(p));
const isValidEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || ""));

const maskPhone = p => {
  const s = normalizePhone(p);
  return s.length > 6 ? s.slice(0, 4) + "****" + s.slice(-2) : "****";
};
const maskName = n => {
  const s = String(n || "").trim();
  if (s.length <= 2) return s[0] + "*";
  return s.slice(0, 2) + "*".repeat(Math.min(4, s.length - 3)) + s.slice(-1);
};

// Rate limiter sederhana di memori: max hit per window per key.
const buckets = new Map();
function rateLimit({ windowMs, max, key = req => req.ip }) {
  return (req, res, next) => {
    const k = `${req.baseUrl}${req.path}|${key(req)}`;
    const now = Date.now();
    const b = buckets.get(k);
    if (!b || b.reset < now) buckets.set(k, { n: 1, reset: now + windowMs });
    else if (++b.n > max) return res.status(429).json({ error: "Terlalu banyak permintaan, coba lagi sebentar." });
    next();
  };
}
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
}, 60_000).unref();

const asyncH = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { HttpError, newId, normalizePhone, isValidPhone, isValidEmail, maskPhone, maskName, rateLimit, asyncH };
