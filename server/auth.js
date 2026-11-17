const crypto = require("node:crypto");
const config = require("./config");
const { db } = require("./db");
const { HttpError } = require("./util");

const COOKIE = "rs_session";
const MAX_AGE = 30 * 24 * 3600 * 1000;

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}
function verifyPassword(password, stored) {
  const [, saltHex, hashHex] = String(stored).split("$");
  if (!saltHex || !hashHex) return false;
  const hash = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), 64);
  return crypto.timingSafeEqual(hash, Buffer.from(hashHex, "hex"));
}

const sign = data => crypto.createHmac("sha256", config.sessionSecret).update(data).digest("base64url");

function createToken(userId) {
  const payload = `${userId}.${Date.now() + MAX_AGE}`;
  return `${payload}.${sign(payload)}`;
}
function readToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  const payload = `${parts[0]}.${parts[1]}`;
  const expected = sign(payload);
  if (expected.length !== parts[2].length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts[2]))) return null;
  if (Number(parts[1]) < Date.now()) return null;
  return Number(parts[0]);
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function setSession(res, userId) {
  res.cookie(COOKIE, createToken(userId), { httpOnly: true, sameSite: "lax", secure: config.isProduction, maxAge: MAX_AGE, path: "/" });
}
function clearSession(res) {
  res.clearCookie(COOKIE, { path: "/" });
}

// Middleware: isi req.user jika login.
async function loadUser(req, _res, next) {
  try {
    const id = readToken(parseCookies(req.headers.cookie)[COOKIE]);
    req.user = id ? await db.one("SELECT id, name, email, whatsapp, role, balance, created_at FROM users WHERE id = ?", id) : null;
    next();
  } catch (e) {
    next(e);
  }
}
const requireUser = (req, _res, next) => (req.user ? next() : next(new HttpError(401, "Silakan login terlebih dahulu.")));
const requireAdmin = (req, _res, next) => (req.user?.role === "admin" ? next() : next(new HttpError(403, "Khusus admin.")));

// Perlindungan CSRF: request yang mengubah data wajib JSON (form lintas situs tidak bisa mengirim JSON tanpa CORS).
function requireJson(req, _res, next) {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && !req.is("application/json")) {
    return next(new HttpError(415, "Content-Type harus application/json"));
  }
  next();
}

module.exports = { hashPassword, verifyPassword, setSession, clearSession, loadUser, requireUser, requireAdmin, requireJson };
