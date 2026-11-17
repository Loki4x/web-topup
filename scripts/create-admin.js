// Buat atau jadikan admin: npm run create-admin -- email@domain.com "Nama" password123 08123456789
const { db } = require("../server/db");
const { hashPassword } = require("../server/auth");

const [email, name = "Admin", password, whatsapp = "081200000000"] = process.argv.slice(2);
if (!email) {
  console.log('Pemakaian: npm run create-admin -- <email> "<nama>" <password> [whatsapp]');
  process.exit(1);
}
const e = email.trim().toLowerCase();
const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(e);
if (existing) {
  db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(existing.id);
  if (password) db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(password), existing.id);
  console.log(`✔ ${e} sekarang admin.`);
} else {
  if (!password || password.length < 8) {
    console.log("Password minimal 8 karakter.");
    process.exit(1);
  }
  db.prepare("INSERT INTO users (name, email, whatsapp, password_hash, role) VALUES (?, ?, ?, ?, 'admin')").run(name, e, whatsapp, hashPassword(password));
  console.log(`✔ Akun admin ${e} dibuat.`);
}
