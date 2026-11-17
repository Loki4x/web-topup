# RhineShop — Website Top Up Game

Website top up game & produk digital dengan **Node.js**, di-deploy ke **Vercel** dengan database **Supabase (PostgreSQL)**. Produk dan pengiriman memakai **Digiflazz**, pembayaran memakai **Tripay**.

## Fitur

**Toko**
- Beranda: banner slider, flash sale dengan hitungan mundur, game populer, kategori, ulasan pembeli, FAQ
- Halaman game: data akun sesuai game, **Cek ID / nickname**, label *Terlaris*/*Promo*, harga flash sale, pembayaran QRIS / e-wallet / VA / minimarket / **saldo akun**, kode promo
- Invoice dengan status otomatis (menunggu bayar → diproses → sukses), kode bayar / QR, SN, dan form ulasan
- Akun member: daftar/masuk, **harga member/reseller**, isi saldo (deposit), mutasi saldo, riwayat transaksi
- **Refund otomatis ke saldo** untuk member jika pesanan gagal
- Notifikasi transaksi terbaru, leaderboard top spender, kalkulator win rate
- Halaman **Syarat & Ketentuan**, **Kebijakan Privasi**, dan **FAQ**
- Tombol WhatsApp CS

**Panel admin** (`/admin`)
- Dashboard: saldo Digiflazz, penjualan & laba harian/bulanan
- Pesanan: cari/filter, kirim ulang pesanan gagal, tandai sukses/refund
- Produk: sinkron harga Digiflazz, tampil/sembunyikan, label, harga manual
- Flash sale, kode promo, pengguna (role & saldo), ulasan, pengaturan margin

## Struktur

```
api/index.js       Entry point Vercel (serverless function)
server/            Backend Express
  app.js           Aplikasi Express (dipakai Vercel & server lokal)
  index.js         Server lokal / VPS
  config.js        Membaca environment variable
  db.js            Koneksi PostgreSQL (Supabase)
  catalog.js       Daftar game, field ID, perhitungan harga
  orders.js        Alur pesanan, pembayaran, refund, deposit
  services/        Digiflazz, Tripay, cek nickname
  routes/          API publik, admin, callback & cron
supabase/schema.sql  Skema database
public/            Frontend (HTML/CSS/JS tanpa build)
  js/pages.js      Teks banner, FAQ, S&K, Kebijakan Privasi
scripts/           create-admin.js, db-setup.js
vercel.json        Konfigurasi Vercel (rewrite, cron harian)
```

## Deploy ke Vercel + Supabase

### 1. Buat database di Supabase
1. Buat project di [supabase.com](https://supabase.com). Pilih region **Southeast Asia (Singapore)** agar dekat dengan server Vercel (`sin1`).
2. Simpan **database password** yang kamu buat.
3. Klik tombol **Connect** di atas dashboard → tab **Connection String** → pilih **Transaction pooler** (port `6543`). Salin URL-nya dan ganti `[YOUR-PASSWORD]` dengan password database.
4. (Opsional) Buka **SQL Editor**, tempel isi `supabase/schema.sql`, klik **Run**. Kalau dilewati, tabel dibuat otomatis saat website pertama kali dibuka.

Semua tabel memakai Row Level Security tanpa policy, jadi data **tidak bisa** dibaca lewat REST API publik Supabase (anon key). Hanya server yang terhubung langsung ke database yang bisa mengaksesnya.

### 2. Buat akun admin
Dari komputer kamu (butuh Node.js 20.12+):

```bash
npm install
cp .env.example .env      # isi DATABASE_URL dengan URL dari Supabase
npm run db:setup
npm run create-admin -- emailkamu@gmail.com "Nama Kamu" passwordminimal8 08123456789
```

### 3. Deploy di Vercel
1. Masuk ke [vercel.com](https://vercel.com) dengan akun GitHub → **Add New → Project** → pilih repo `web-topup`.
2. **Framework Preset**: Other. Biarkan Build Command dan Output Directory (sudah diatur di `vercel.json`).
3. Buka **Environment Variables**, isi minimal:
   - `DATABASE_URL` — URL Transaction pooler dari Supabase
   - `SESSION_SECRET` — string acak panjang
   - `CRON_SECRET` — string acak lain
4. Klik **Deploy**. Setelah selesai, buka domain `*.vercel.app` yang diberikan.

Selama kredensial Digiflazz/Tripay belum diisi, website berjalan dalam **mode simulasi** (ada banner kuning dan tombol "Simulasi Bayar"). Di mode ini ID yang berakhiran `0000` sengaja dibuat gagal untuk menguji refund.

> Uji dulu di branch ini: Vercel otomatis membuat **Preview Deployment** untuk setiap branch/PR. Untuk domain produksi, merge PR ke `main`.

### Perbedaan karena serverless
Vercel tidak menjalankan proses terus-menerus, jadi:
- Status pesanan diperbarui lewat **webhook Digiflazz**, dan dicek ulang otomatis setiap kali halaman invoice dibuka.
- **Vercel Cron** berjalan sekali sehari (02.00 WIB) untuk sinkron harga dan membersihkan pesanan kedaluwarsa. Sinkron harga juga bisa dilakukan manual di **Admin → Produk**.
- Pembatas jumlah request (rate limit) hanya berlaku per instance.

## Menjalankan di komputer sendiri

```bash
npm install
cp .env.example .env   # isi DATABASE_URL (Supabase atau Postgres lokal)
npm run create-admin -- email@kamu.com "Nama Admin" passwordkamu 08123456789
npm run dev
```

Buka http://localhost:3000. Panel admin: http://localhost:3000/admin.

## Menghubungkan layanan asli

Semua variabel diisi di **Vercel → Settings → Environment Variables**, lalu **Redeploy**.

### Digiflazz
1. Masuk ke member.digiflazz.com → **Atur Koneksi → API**. Salin username dan API key (Development key untuk uji coba, Production key untuk live).
2. Isi `DIGIFLAZZ_USERNAME` dan `DIGIFLAZZ_API_KEY`.
3. Di menu **Webhook**, isi URL `https://domainkamu.vercel.app/api/callback/digiflazz`, lalu salin secret ke `DIGIFLAZZ_WEBHOOK_SECRET`.
4. Setelah siap live, ubah `DIGIFLAZZ_TESTING=false`.
5. Nama brand di `server/catalog.js` (daftar `GAMES`) harus sama dengan nama brand di price list Digiflazz. Brand yang tidak terdaftar tetap tampil dengan isian "ID Akun".

> ⚠️ **Whitelist IP**: Digiflazz bisa membatasi akses API berdasarkan IP. Vercel (paket Hobby/Pro) **tidak punya IP tetap**, jadi jika akun Digiflazz kamu mewajibkan whitelist IP, request dari Vercel akan ditolak. Untuk produksi, pertimbangkan VPS (bisa menjalankan `npm start` langsung) atau proxy dengan IP statis.

> **Format customer_no**: Mobile Legends dan Magic Chess memakai `UserID + ZoneID` digabung. Cek kembali format setiap produk di Digiflazz, lalu sesuaikan `customerNo` di `catalog.js` bila perlu.

### Tripay
1. Daftar di tripay.co.id. Ambil API key, private key, dan kode merchant (sandbox dulu).
2. Isi `TRIPAY_API_KEY`, `TRIPAY_PRIVATE_KEY`, `TRIPAY_MERCHANT_CODE`.
3. Atur URL callback: `https://domainkamu.vercel.app/api/callback/tripay`.
4. Atur biaya transaksi agar **dibebankan ke pelanggan**.
5. Setelah merchant disetujui, ubah `TRIPAY_SANDBOX=false`.

### Cek nickname
Digiflazz tidak menyediakan cek nickname game, jadi perlu API pihak ketiga. Isi `NICKNAME_API_URL` dengan placeholder `{game}`, `{id}`, `{zone}`, lalu sesuaikan `server/services/nickname.js` dengan format respons penyedia.

## Sebelum live
- Ganti semua teks `[DALAM KURUNG SIKU]` di `public/js/pages.js` (S&K dan Kebijakan Privasi) dengan data usaha kamu. Sebaiknya minta ahli hukum meninjau isinya.
- Atur nomor WhatsApp CS dan margin di **Admin → Pengaturan**.
- Ganti gambar game (saat ini placeholder inisial) dengan aset yang boleh kamu pakai.
- Aktifkan backup database di Supabase.
