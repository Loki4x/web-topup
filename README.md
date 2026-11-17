# RhineShop — Website Top Up Game

Website top up game & produk digital dengan **Node.js**. Produk dan pengiriman memakai **Digiflazz**, pembayaran memakai **Tripay**.

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
server/            Backend Express
  index.js         Entry point
  config.js        Membaca .env
  db.js            Skema database SQLite (bawaan Node.js)
  catalog.js       Daftar game, field ID, perhitungan harga
  orders.js        Alur pesanan, pembayaran, refund, deposit
  services/        Digiflazz, Tripay, cek nickname
  routes/          API publik, admin, callback
public/            Frontend (HTML/CSS/JS tanpa build)
  js/pages.js      Teks banner, FAQ, S&K, Kebijakan Privasi
scripts/           create-admin.js
data/              Database (dibuat otomatis, tidak di-commit)
```

## Menjalankan

Butuh **Node.js 22.13 atau lebih baru**.

```bash
npm install
cp .env.example .env
npm run create-admin -- email@kamu.com "Nama Admin" passwordkamu 08123456789
npm start
```

Buka http://localhost:3000. Panel admin ada di http://localhost:3000/admin (masuk dulu dengan akun admin).

Jika kredensial di `.env` masih kosong, website berjalan dalam **mode simulasi**: produk contoh, tombol "Simulasi Bayar", dan nickname palsu. Di mode ini ID yang berakhiran `0000` sengaja dibuat gagal untuk menguji refund.

## Menghubungkan layanan asli

### Digiflazz
1. Masuk ke member.digiflazz.com → **Atur Koneksi → API**. Salin username dan API key (Development key untuk uji coba, Production key untuk live).
2. Isi `DIGIFLAZZ_USERNAME` dan `DIGIFLAZZ_API_KEY` di `.env`.
3. Di menu **Webhook**, isi URL `https://domainkamu.com/api/callback/digiflazz`, lalu salin secret ke `DIGIFLAZZ_WEBHOOK_SECRET`.
4. Daftarkan IP server di whitelist IP Digiflazz.
5. Setelah siap live, ubah `DIGIFLAZZ_TESTING=false`.
6. Nama brand di `server/catalog.js` (daftar `GAMES`) harus sama dengan nama brand di price list Digiflazz. Brand yang tidak terdaftar tetap tampil dengan isian "ID Akun".

> **Format customer_no**: Mobile Legends dan Magic Chess memakai `UserID + ZoneID` digabung. Cek kembali format setiap produk di Digiflazz, lalu sesuaikan `customerNo` di `catalog.js` bila perlu.

### Tripay
1. Daftar di tripay.co.id. Ambil API key, private key, dan kode merchant (sandbox dulu).
2. Isi `TRIPAY_API_KEY`, `TRIPAY_PRIVATE_KEY`, `TRIPAY_MERCHANT_CODE` di `.env`.
3. Atur URL callback: `https://domainkamu.com/api/callback/tripay`.
4. Atur biaya transaksi agar **dibebankan ke pelanggan**.
5. Setelah merchant disetujui, ubah `TRIPAY_SANDBOX=false`.

### Cek nickname
Digiflazz tidak menyediakan cek nickname game, jadi perlu API pihak ketiga. Isi `NICKNAME_API_URL` dengan placeholder `{game}`, `{id}`, `{zone}`, lalu sesuaikan `server/services/nickname.js` dengan format respons penyedia.

## Hosting

Backend butuh server yang menjalankan Node.js, jadi **GitHub Pages tidak bisa dipakai** lagi. Pilihan: VPS (mis. dengan PM2 + Nginx), Railway, Render, atau Fly.io. Pastikan:
- `BASE_URL` diisi domain HTTPS kamu, `NODE_ENV=production`, dan `SESSION_SECRET` diisi string acak panjang
- Folder `data/` disimpan di disk permanen (berisi database) dan rutin di-backup
- Server punya IP tetap untuk whitelist Digiflazz

## Sebelum live
- Ganti semua teks `[DALAM KURUNG SIKU]` di `public/js/pages.js` (S&K dan Kebijakan Privasi) dengan data usaha kamu. Sebaiknya minta ahli hukum meninjau isinya.
- Atur nomor WhatsApp CS dan margin di **Admin → Pengaturan**.
- Ganti gambar game (saat ini placeholder inisial) dengan aset yang boleh kamu pakai.
