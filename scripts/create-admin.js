// Buat atau jadikan admin: npm run create-admin -- email@domain.com "Nama" password123 08123456789
// Memakai DATABASE_URL dari file .env (bisa langsung ke database Supabase).
const { db } = require("../server/db");
const { hashPassword } = require("../server/auth");

(async () => {
  const [email, name = "Admin", password, whatsapp = "081200000000"] = process.argv.slice(2);
  if (!email) {
    console.log('Pemakaian: npm run create-admin -- <email> "<nama>" <password> [whatsapp]');
    process.exit(1);
  }
  await db.ready();
  const e = email.trim().toLowerCase();
  const existing = await db.one("SELECT id FROM users WHERE email = ?", e);
  if (existing) {
    await db.run("UPDATE users SET role = 'admin' WHERE id = ?", existing.id);
    if (password) await db.run("UPDATE users SET password_hash = ? WHERE id = ?", hashPassword(password), existing.id);
    console.log(`✔ ${e} sekarang admin.`);
  } else {
    if (!password || password.length < 8) {
      console.log("Password minimal 8 karakter.");
      process.exit(1);
    }
    await db.run("INSERT INTO users (name, email, whatsapp, password_hash, role) VALUES (?, ?, ?, ?, 'admin')", name, e, whatsapp, hashPassword(password));
    console.log(`✔ Akun admin ${e} dibuat.`);
  }
  await db.end();
})().catch(e => {
  console.error("Gagal:", e.message);
  process.exit(1);
});
