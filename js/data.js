// Data katalog. Harga dalam Rupiah. Ganti sesuai harga supplier Anda.
const CATEGORIES = ["Semua", "Top Up Games", "Voucher", "Pulsa & Data", "Entertainment"];

// Helper membuat daftar nominal dari [jumlah, harga]
const items = (unit, list) => list.map(([qty, price, label]) => ({
  id: `${unit}-${qty}`.toLowerCase().replace(/\s+/g, "-"),
  name: label || `${qty.toLocaleString("id-ID")} ${unit}`,
  price,
}));

const GAMES = [
  {
    slug: "mobile-legends", name: "Mobile Legends", publisher: "Moonton", category: "Top Up Games",
    colors: ["#2b5cff", "#00d4ff"], popular: true,
    fields: [{ key: "userId", label: "User ID", placeholder: "Masukkan User ID" }, { key: "zoneId", label: "Zone ID", placeholder: "Zone ID" }],
    guide: "Buka profil di dalam game. User ID dan Zone ID tertera di bawah nama, contoh: 12345678 (1234).",
    products: [
      ...items("Diamonds", [[5, 1500], [12, 3500], [28, 8000], [44, 12500], [86, 22900], [172, 45800], [257, 68500], [344, 91500], [429, 114000], [514, 137000], [706, 182000], [1050, 274000], [2195, 548000]]),
      { id: "wdp", name: "Weekly Diamond Pass", price: 27500 },
      { id: "twilight", name: "Twilight Pass", price: 145000 },
    ],
  },
  {
    slug: "free-fire", name: "Free Fire", publisher: "Garena", category: "Top Up Games",
    colors: ["#ff7a00", "#ffcc00"], popular: true,
    fields: [{ key: "userId", label: "Player ID", placeholder: "Masukkan Player ID" }],
    guide: "Ketuk avatar di pojok kiri atas, Player ID tertera di bawah nickname.",
    products: [
      ...items("Diamonds", [[5, 900], [12, 1900], [50, 7500], [70, 9500], [140, 19000], [355, 47500], [720, 95000], [1450, 190000], [2180, 285000], [3640, 475000]]),
      { id: "ff-mingguan", name: "Membership Mingguan", price: 29000 },
      { id: "ff-bulanan", name: "Membership Bulanan", price: 85000 },
    ],
  },
  {
    slug: "pubg-mobile", name: "PUBG Mobile", publisher: "Tencent", category: "Top Up Games",
    colors: ["#c48a1c", "#3d2a0a"], popular: true,
    fields: [{ key: "userId", label: "Character ID", placeholder: "Masukkan Character ID" }],
    guide: "Ketuk avatar di lobby, Character ID tertera di bawah nama karakter.",
    products: items("UC", [[30, 7500], [60, 14500], [325, 72000], [660, 144000], [1800, 360000], [3850, 720000], [8100, 1440000]]),
  },
  {
    slug: "genshin-impact", name: "Genshin Impact", publisher: "HoYoverse", category: "Top Up Games",
    colors: ["#6a5cff", "#e7c27a"], popular: true,
    fields: [{ key: "userId", label: "UID", placeholder: "Masukkan UID" }, { key: "server", label: "Server", type: "select", options: ["Asia", "America", "Europe", "TW, HK, MO"] }],
    guide: "UID tertera di pojok kanan bawah layar saat bermain atau di menu Paimon.",
    products: [
      ...items("Genesis Crystals", [[60, 15000], [330, 75000], [1090, 230000], [2240, 470000], [3880, 750000], [8080, 1500000]]),
      { id: "welkin", name: "Blessing of the Welkin Moon", price: 75000 },
    ],
  },
  {
    slug: "honkai-star-rail", name: "Honkai: Star Rail", publisher: "HoYoverse", category: "Top Up Games",
    colors: ["#1b1f4b", "#9d7bff"],
    fields: [{ key: "userId", label: "UID", placeholder: "Masukkan UID" }, { key: "server", label: "Server", type: "select", options: ["Asia", "America", "Europe", "TW, HK, MO"] }],
    guide: "UID tertera di menu Phone > profil karakter.",
    products: [
      ...items("Oneiric Shard", [[60, 15000], [330, 75000], [1090, 230000], [2240, 470000], [3880, 750000], [8080, 1500000]]),
      { id: "express", name: "Express Supply Pass", price: 75000 },
    ],
  },
  {
    slug: "valorant", name: "Valorant", publisher: "Riot Games", category: "Top Up Games",
    colors: ["#ff4655", "#1f2326"],
    fields: [{ key: "userId", label: "Riot ID", placeholder: "Nama#TAG" }],
    guide: "Riot ID berformat Nama#TAG, dapat dilihat di menu profil.",
    products: items("VP", [[475, 56000], [1000, 112000], [2050, 224000], [3650, 392000], [5350, 560000], [11000, 1120000]]),
  },
  {
    slug: "call-of-duty-mobile", name: "Call of Duty Mobile", publisher: "Activision", category: "Top Up Games",
    colors: ["#3c4a3a", "#a5b48c"],
    fields: [{ key: "userId", label: "Open ID", placeholder: "Masukkan Open ID" }],
    guide: "Open ID dapat dilihat di menu Settings > Legal and Privacy.",
    products: items("CP", [[31, 5000], [63, 10000], [128, 20000], [321, 50000], [645, 100000], [1373, 200000], [3564, 500000]]),
  },
  {
    slug: "honor-of-kings", name: "Honor of Kings", publisher: "Level Infinite", category: "Top Up Games",
    colors: ["#b8860b", "#5b1a1a"],
    fields: [{ key: "userId", label: "Player ID", placeholder: "Masukkan Player ID" }],
    guide: "Ketuk avatar di lobby untuk melihat Player ID.",
    products: items("Tokens", [[16, 3000], [80, 15000], [240, 45000], [400, 75000], [560, 105000], [830, 150000], [1245, 225000], [2508, 450000]]),
  },
  {
    slug: "steam-wallet", name: "Steam Wallet", publisher: "Valve", category: "Voucher",
    colors: ["#171a21", "#66c0f4"],
    fields: [], voucher: true,
    guide: "Kode voucher akan dikirim ke nomor WhatsApp dan ditampilkan di halaman invoice.",
    products: [12000, 45000, 60000, 90000, 120000, 250000, 400000, 600000].map(v => ({ id: `steam-${v}`, name: `Steam Wallet IDR ${v.toLocaleString("id-ID")}`, price: Math.round(v * 1.06) })),
  },
  {
    slug: "google-play", name: "Google Play Voucher", publisher: "Google", category: "Voucher",
    colors: ["#34a853", "#4285f4"],
    fields: [], voucher: true,
    guide: "Kode voucher akan dikirim ke nomor WhatsApp dan ditampilkan di halaman invoice.",
    products: [10000, 20000, 50000, 100000, 150000, 300000, 500000].map(v => ({ id: `gp-${v}`, name: `Google Play Rp ${v.toLocaleString("id-ID")}`, price: Math.round(v * 1.04) })),
  },
  {
    slug: "pulsa-telkomsel", name: "Pulsa Telkomsel", publisher: "Telkomsel", category: "Pulsa & Data",
    colors: ["#e0001b", "#ff6a3d"],
    fields: [{ key: "userId", label: "Nomor HP", placeholder: "08xxxxxxxxxx" }],
    guide: "Masukkan nomor Telkomsel aktif yang akan diisi pulsa.",
    products: [5000, 10000, 20000, 25000, 50000, 100000].map(v => ({ id: `tsel-${v}`, name: `Pulsa ${v.toLocaleString("id-ID")}`, price: v + 1500 })),
  },
  {
    slug: "spotify", name: "Spotify Premium", publisher: "Spotify", category: "Entertainment",
    colors: ["#1db954", "#0b3d1f"],
    fields: [], voucher: true,
    guide: "Kode voucher akan dikirim ke nomor WhatsApp dan ditampilkan di halaman invoice.",
    products: [{ id: "sp-1", name: "Premium 1 Bulan", price: 54990 }, { id: "sp-3", name: "Premium 3 Bulan", price: 164970 }, { id: "sp-12", name: "Premium 12 Bulan", price: 599000 }],
  },
];

const PAYMENTS = [
  { group: "QRIS", methods: [{ id: "qris", name: "QRIS (Semua E-Wallet & M-Banking)", fee: 0.007 }] },
  { group: "E-Wallet", methods: [
    { id: "dana", name: "DANA", fee: 0.015 },
    { id: "ovo", name: "OVO", fee: 0.015 },
    { id: "gopay", name: "GoPay", fee: 0.02 },
    { id: "shopeepay", name: "ShopeePay", fee: 0.02 },
  ] },
  { group: "Virtual Account", methods: [
    { id: "bca", name: "BCA Virtual Account", fee: 4000 },
    { id: "bri", name: "BRI Virtual Account", fee: 3000 },
    { id: "bni", name: "BNI Virtual Account", fee: 3000 },
    { id: "mandiri", name: "Mandiri Virtual Account", fee: 3000 },
  ] },
  { group: "Convenience Store", methods: [
    { id: "alfamart", name: "Alfamart", fee: 2500 },
    { id: "indomaret", name: "Indomaret", fee: 2500 },
  ] },
];

const BANNERS = [
  { title: "Diamond MLBB Termurah", text: "Mulai Rp1.500 — proses instan 24 jam", slug: "mobile-legends", colors: ["#2b5cff", "#7a2bff"] },
  { title: "Promo Free Fire", text: "Bonus diamond setiap pembelian di atas 500 DM", slug: "free-fire", colors: ["#ff7a00", "#ff2b6a"] },
  { title: "Genesis Crystal Hemat", text: "Welkin Moon cuma Rp75.000", slug: "genshin-impact", colors: ["#6a5cff", "#00b3a4"] },
];
