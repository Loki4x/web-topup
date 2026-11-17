# NexaTopup — Website Top Up Game

Website top up game & voucher digital (statis, tanpa build) yang terinspirasi dari tata letak toko top up Indonesia pada umumnya.

## Fitur
- **Beranda**: banner slider, game populer, filter kategori, keunggulan
- **Pencarian game** di header
- **Halaman game**: input data akun (User ID / Zone ID / Server), pilih nominal, pilih metode pembayaran (QRIS, E-Wallet, Virtual Account, Minimarket) dengan harga + biaya admin, nomor WhatsApp, kode promo (`HEMAT10` = diskon 10%)
- **Konfirmasi pesanan** & **invoice** (QR/kode bayar simulasi, tombol simulasi bayar)
- **Cek Transaksi** berdasarkan nomor invoice (riwayat disimpan di `localStorage`)
- **Leaderboard** top spender (data contoh)
- **Kalkulator Win Rate**
- Responsif (mobile & desktop), tema gelap

## Menjalankan
```bash
python3 -m http.server 8000
```
Buka http://localhost:8000

## Kustomisasi
- Produk, harga, metode pembayaran, banner: `js/data.js`
- Tampilan/warna: variabel di atas `css/style.css`
- Gambar game memakai placeholder gradien + inisial. Ganti dengan aset resmi yang Anda punya izinnya.

## Catatan
Ini frontend saja. Untuk produksi, hubungkan ke backend + payment gateway (Midtrans, Xendit, Tripay, dll.) dan API supplier (Digiflazz, dll.) agar pembayaran dan pengiriman item berjalan otomatis.
