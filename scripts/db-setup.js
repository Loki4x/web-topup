// Buat/perbarui tabel di database (Supabase): npm run db:setup
const { db } = require("../server/db");

(async () => {
  await db.migrate(true);
  const tables = await db.all("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1");
  console.log("✔ Skema siap. Tabel:", tables.map(t => t.table_name).join(", "));
  await db.end();
})().catch(e => {
  console.error("Gagal:", e.message);
  process.exit(1);
});
