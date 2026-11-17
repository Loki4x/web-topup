// Konten statis RhineShop: banner, FAQ, Syarat & Ketentuan, Kebijakan Privasi.
// Ganti teks dalam [KURUNG SIKU] dengan data usaha Anda sebelum website dipakai.
window.RS_CONTENT = {
  updatedAt: "17 November 2026",

  banners: [
    { title: "Diamond MLBB Termurah", text: "Proses otomatis 24 jam, langsung masuk dalam hitungan detik", slug: "mobile-legends", colors: ["#2b5cff", "#7a2bff"] },
    { title: "Daftar Member, Harga Lebih Murah", text: "Member & reseller dapat harga khusus dan bisa bayar pakai saldo", href: "#/daftar", colors: ["#ff7a00", "#ff2b6a"] },
    { title: "Genesis Crystal Hemat", text: "Top up Genshin Impact cukup pakai UID", slug: "genshin-impact", colors: ["#6a5cff", "#00b3a4"] },
  ],

  faq: [
    ["Berapa lama proses top up?", "Sebagian besar pesanan diproses otomatis dalam 1–5 menit setelah pembayaran diterima. Pada jam sibuk atau gangguan dari server game, proses bisa memakan waktu lebih lama."],
    ["Apakah top up di RhineShop aman?", "Aman. Kami hanya meminta ID akun (bukan password), dan pembayaran diproses melalui payment gateway resmi berizin Bank Indonesia."],
    ["Bagaimana jika saya salah memasukkan ID?", "Item yang sudah terkirim ke ID yang salah tidak dapat ditarik kembali. Gunakan tombol <b>Cek ID</b> untuk memastikan nickname akun sebelum membayar."],
    ["Pesanan saya gagal, apakah uang kembali?", "Ya. Untuk member, dana otomatis dikembalikan ke saldo akun. Untuk pembeli tanpa akun, hubungi CS dengan nomor invoice dan dana akan dikembalikan sesuai Syarat & Ketentuan."],
    ["Bagaimana cara cek status pesanan?", "Buka menu <a href='#/cek-transaksi'>Cek Transaksi</a> dan masukkan nomor invoice. Nomor invoice juga tersedia di riwayat akun jika kamu login."],
    ["Apa keuntungan menjadi member atau reseller?", "Member mendapat harga lebih murah dari harga umum dan bisa membayar dengan saldo tanpa biaya admin. Reseller mendapat harga terendah untuk dijual kembali. Hubungi CS untuk daftar reseller."],
    ["Metode pembayaran apa saja yang tersedia?", "QRIS, e-wallet (DANA, OVO, ShopeePay, dll.), virtual account bank, gerai Alfamart/Indomaret, serta saldo akun untuk member."],
  ],

  terms: `
    <p>Selamat datang di RhineShop. Dengan mengakses situs dan/atau melakukan transaksi di RhineShop, Anda dianggap telah membaca, memahami, dan menyetujui Syarat & Ketentuan berikut. Jika Anda tidak setuju, mohon untuk tidak menggunakan layanan kami.</p>

    <h3>1. Definisi</h3>
    <ul>
      <li><b>RhineShop</b> ("kami") adalah layanan penjualan produk digital yang dikelola oleh <mark>[NAMA PEMILIK / BADAN USAHA]</mark>, beralamat di <mark>[ALAMAT USAHA]</mark>.</li>
      <li><b>Pengguna</b> ("Anda") adalah setiap orang yang mengakses situs atau melakukan transaksi, baik dengan maupun tanpa akun.</li>
      <li><b>Produk</b> adalah item digital yang dijual, antara lain mata uang dalam game, voucher, pulsa, paket data, saldo e-money, dan token listrik.</li>
      <li><b>Data Tujuan</b> adalah ID akun game, nomor HP, nomor meter, atau data lain yang Anda masukkan sebagai tujuan pengiriman produk.</li>
    </ul>

    <h3>2. Ketentuan Umum</h3>
    <ul>
      <li>Anda wajib berusia minimal 18 tahun atau mendapatkan izin dari orang tua/wali untuk bertransaksi.</li>
      <li>RhineShop adalah penjual pihak ketiga dan <b>tidak berafiliasi</b> dengan pengembang atau penerbit game mana pun. Seluruh merek dagang, logo, dan nama game adalah milik pemiliknya masing-masing.</li>
      <li>Penggunaan produk di dalam game tunduk pada ketentuan dari pengembang/penerbit game yang bersangkutan.</li>
    </ul>

    <h3>3. Akun Member dan Reseller</h3>
    <ul>
      <li>Pendaftaran akun bersifat opsional. Anda bertanggung jawab menjaga kerahasiaan email dan password akun Anda.</li>
      <li>Segala aktivitas yang terjadi melalui akun Anda menjadi tanggung jawab Anda.</li>
      <li>Status reseller diberikan atas persetujuan RhineShop dan dapat dicabut sewaktu-waktu apabila terjadi pelanggaran.</li>
      <li>Kami berhak menangguhkan atau menutup akun yang terindikasi penipuan, penyalahgunaan promo, atau pelanggaran hukum.</li>
    </ul>

    <h3>4. Pemesanan dan Data Tujuan</h3>
    <ul>
      <li>Anda wajib memastikan Data Tujuan yang dimasukkan sudah <b>benar dan lengkap</b> sebelum melakukan pembayaran.</li>
      <li>Kesalahan input Data Tujuan sepenuhnya menjadi tanggung jawab Pengguna. Produk yang telah berhasil terkirim ke Data Tujuan yang salah <b>tidak dapat dibatalkan, ditarik, atau dikembalikan</b>.</li>
      <li>Fitur Cek ID/nickname hanya alat bantu dan bergantung pada layanan pihak ketiga; hasilnya tidak menjamin kebenaran data.</li>
      <li>Kami tidak pernah meminta password, kode OTP, atau akses login akun game Anda.</li>
    </ul>

    <h3>5. Harga dan Pembayaran</h3>
    <ul>
      <li>Harga dapat berubah sewaktu-waktu tanpa pemberitahuan. Harga yang berlaku adalah harga yang tercantum pada saat pesanan dibuat.</li>
      <li>Biaya admin metode pembayaran ditanggung oleh pembeli dan ditampilkan sebelum pembayaran.</li>
      <li>Pembayaran diproses oleh payment gateway pihak ketiga. Pesanan yang tidak dibayar hingga batas waktu akan dibatalkan otomatis.</li>
      <li>Pastikan jumlah yang dibayarkan sesuai dengan tagihan. Kelebihan atau kekurangan bayar dapat menyebabkan pesanan tidak terproses.</li>
    </ul>

    <h3>6. Proses dan Pengiriman</h3>
    <ul>
      <li>Pesanan diproses otomatis setelah pembayaran terkonfirmasi, umumnya dalam 1–5 menit.</li>
      <li>Keterlambatan dapat terjadi akibat gangguan server game, operator, payment gateway, atau supplier. Dalam kondisi tersebut pesanan tetap diproses hingga berhasil atau dinyatakan gagal.</li>
      <li>Pesanan dianggap selesai ketika status di halaman invoice menunjukkan <b>Sukses</b>.</li>
    </ul>

    <h3>7. Pembatalan dan Pengembalian Dana</h3>
    <ul>
      <li>Pesanan yang sudah dibayar tidak dapat dibatalkan oleh Pengguna.</li>
      <li>Apabila pesanan <b>gagal diproses</b> oleh sistem kami atau supplier:
        <ul>
          <li>Pengguna dengan akun: dana dikembalikan otomatis ke saldo akun.</li>
          <li>Pengguna tanpa akun: dana dikembalikan setelah menghubungi CS dengan menyertakan nomor invoice, dalam waktu maksimal <mark>[3x24 JAM HARI KERJA]</mark>. Biaya admin pembayaran dapat dipotong sesuai kebijakan payment gateway.</li>
        </ul>
      </li>
      <li>Pengembalian dana tidak berlaku untuk pesanan yang gagal karena kesalahan Data Tujuan yang dimasukkan Pengguna, atau pesanan yang sudah berstatus Sukses.</li>
      <li>Saldo akun tidak dapat dicairkan menjadi uang tunai, kecuali atas kebijakan RhineShop.</li>
    </ul>

    <h3>8. Promo dan Flash Sale</h3>
    <ul>
      <li>Kode promo dan flash sale memiliki syarat, kuota, dan periode tertentu, serta dapat berakhir lebih cepat apabila kuota habis.</li>
      <li>Kami berhak membatalkan transaksi yang terindikasi menyalahgunakan promo (misalnya menggunakan banyak akun atau cara curang).</li>
    </ul>

    <h3>9. Larangan</h3>
    <p>Pengguna dilarang menggunakan RhineShop untuk: penipuan, pencucian uang, penggunaan alat pembayaran milik orang lain tanpa izin, upaya meretas atau mengganggu sistem, serta aktivitas lain yang melanggar hukum Republik Indonesia.</p>

    <h3>10. Batasan Tanggung Jawab</h3>
    <ul>
      <li>RhineShop tidak bertanggung jawab atas pemblokiran akun game, kehilangan item, atau kerugian yang timbul dari kebijakan pengembang game.</li>
      <li>Tanggung jawab RhineShop atas suatu transaksi terbatas pada nilai transaksi yang dibayarkan Pengguna.</li>
    </ul>

    <h3>11. Perubahan Ketentuan</h3>
    <p>Kami dapat mengubah Syarat & Ketentuan ini sewaktu-waktu. Perubahan berlaku sejak dipublikasikan di halaman ini. Penggunaan layanan setelah perubahan berarti Anda menyetujui ketentuan yang baru.</p>

    <h3>12. Hukum yang Berlaku</h3>
    <p>Syarat & Ketentuan ini tunduk pada hukum Republik Indonesia. Perselisihan diselesaikan secara musyawarah terlebih dahulu, dan apabila tidak tercapai kesepakatan, akan diselesaikan melalui Pengadilan Negeri <mark>[KOTA]</mark>.</p>

    <h3>13. Kontak</h3>
    <p>Pertanyaan atau keluhan dapat disampaikan melalui WhatsApp CS <mark>[NOMOR WHATSAPP]</mark> atau email <mark>[EMAIL CS]</mark>.</p>
  `,

  privacy: `
    <p>RhineShop menghargai privasi Anda. Kebijakan Privasi ini menjelaskan data pribadi apa yang kami kumpulkan, bagaimana kami menggunakannya, dan hak-hak Anda, sesuai dengan Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP) dan peraturan terkait.</p>
    <p>Pengendali data: <mark>[NAMA PEMILIK / BADAN USAHA]</mark>, <mark>[ALAMAT USAHA]</mark>.</p>

    <h3>1. Data yang Kami Kumpulkan</h3>
    <ul>
      <li><b>Data transaksi:</b> ID akun game / nomor tujuan, nickname akun (jika dicek), produk yang dibeli, nominal, metode pembayaran, dan waktu transaksi.</li>
      <li><b>Data kontak:</b> nomor WhatsApp dan email (opsional) untuk mengirim bukti dan informasi pesanan.</li>
      <li><b>Data akun (jika mendaftar):</b> nama, email, nomor WhatsApp, password (disimpan dalam bentuk hash terenkripsi, tidak dapat dibaca oleh siapa pun), saldo, dan riwayat transaksi.</li>
      <li><b>Data teknis:</b> alamat IP dan informasi perangkat/browser yang tercatat secara otomatis untuk keamanan dan pencegahan penipuan.</li>
      <li><b>Ulasan:</b> nama tampilan, rating, dan komentar yang Anda kirim secara sukarela.</li>
    </ul>
    <p>Kami <b>tidak pernah</b> meminta atau menyimpan password akun game, kode OTP, PIN, maupun data kartu/rekening Anda.</p>

    <h3>2. Tujuan Penggunaan Data</h3>
    <ul>
      <li>Memproses dan mengirimkan pesanan Anda.</li>
      <li>Memverifikasi pembayaran dan mencegah penipuan.</li>
      <li>Memberikan layanan pelanggan, termasuk pengembalian dana.</li>
      <li>Mengelola akun, saldo, dan harga member/reseller.</li>
      <li>Menampilkan statistik anonim (misalnya notifikasi transaksi terbaru dan leaderboard) dengan nomor/nama yang <b>disamarkan</b>.</li>
      <li>Memenuhi kewajiban hukum dan permintaan otoritas yang berwenang.</li>
    </ul>

    <h3>3. Pembagian Data kepada Pihak Ketiga</h3>
    <p>Kami hanya membagikan data seperlunya kepada mitra berikut untuk menjalankan layanan:</p>
    <ul>
      <li><b>Payment gateway</b> (Tripay dan bank/penyedia e-wallet terkait): nama, email, nomor HP, dan nominal tagihan untuk memproses pembayaran.</li>
      <li><b>Supplier produk digital</b> (Digiflazz): Data Tujuan dan produk untuk mengirimkan pesanan.</li>
      <li><b>Penyedia layanan cek nickname</b>: ID akun game saat Anda menekan tombol Cek ID.</li>
      <li><b>Penyedia hosting/server</b> tempat data disimpan.</li>
    </ul>
    <p>Kami tidak menjual atau menyewakan data pribadi Anda kepada pihak mana pun.</p>

    <h3>4. Cookie dan Penyimpanan Lokal</h3>
    <p>Kami menggunakan satu cookie sesi (<code>rs_session</code>) yang diperlukan agar Anda tetap login. Kami tidak menggunakan cookie iklan atau pelacak pihak ketiga.</p>

    <h3>5. Penyimpanan dan Keamanan</h3>
    <ul>
      <li>Data disimpan di server yang dilindungi dan hanya dapat diakses oleh pengelola yang berwenang.</li>
      <li>Koneksi ke situs dienkripsi menggunakan HTTPS.</li>
      <li>Data transaksi disimpan selama diperlukan untuk keperluan layanan, pembukuan, dan kewajiban hukum, yaitu paling lama <mark>[5 TAHUN]</mark>, kemudian dihapus atau dianonimkan.</li>
    </ul>

    <h3>6. Hak Anda</h3>
    <p>Sesuai UU PDP, Anda berhak untuk:</p>
    <ul>
      <li>Mengakses dan memperoleh salinan data pribadi Anda.</li>
      <li>Memperbarui atau memperbaiki data yang tidak akurat.</li>
      <li>Meminta penghapusan akun dan data pribadi, kecuali data yang wajib kami simpan berdasarkan hukum.</li>
      <li>Menarik persetujuan pemrosesan data.</li>
      <li>Mengajukan keberatan atau pengaduan atas pemrosesan data.</li>
    </ul>
    <p>Permintaan dapat diajukan melalui kontak di bawah. Kami akan menanggapi paling lambat 3x24 jam sejak permintaan diterima.</p>

    <h3>7. Data Anak</h3>
    <p>Pengguna di bawah 18 tahun harus menggunakan layanan dengan persetujuan dan pengawasan orang tua/wali.</p>

    <h3>8. Perubahan Kebijakan</h3>
    <p>Kebijakan ini dapat diperbarui sewaktu-waktu. Tanggal pembaruan terakhir tercantum di bagian atas halaman ini.</p>

    <h3>9. Kontak</h3>
    <p>Pertanyaan terkait privasi dapat disampaikan melalui WhatsApp <mark>[NOMOR WHATSAPP]</mark> atau email <mark>[EMAIL CS]</mark>.</p>
  `,
};
