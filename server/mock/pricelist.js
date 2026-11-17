// Contoh price list berformat Digiflazz, dipakai saat kredensial Digiflazz belum diisi.
const list = (brand, category, unit, rows, prefix) =>
  rows.map(([qty, price, name]) => ({
    product_name: name || `${brand} ${qty.toLocaleString("id-ID")} ${unit}`,
    category, brand, type: "Umum", seller_name: "SIMULASI",
    price, buyer_sku_code: `${prefix}${qty}`,
    buyer_product_status: true, seller_product_status: true, unlimited_stock: true, stock: 0,
  }));

module.exports = () => [
  ...list("MOBILE LEGENDS", "Games", "Diamonds", [[5, 1350], [12, 3250], [28, 7400], [44, 11600], [86, 21300], [172, 42500], [257, 63600], [344, 85000], [429, 106000], [514, 127300], [706, 169000], [1050, 254000], [2195, 509000]], "ML"),
  ...list("MOBILE LEGENDS", "Games", "", [[1, 25500, "Weekly Diamond Pass"], [2, 135000, "Twilight Pass"]], "MLPASS"),
  ...list("FREE FIRE", "Games", "Diamonds", [[5, 800], [12, 1750], [50, 6900], [70, 8800], [140, 17600], [355, 44000], [720, 88000], [1450, 176000], [2180, 264000]], "FF"),
  ...list("FREE FIRE", "Games", "", [[1, 26900, "Membership Mingguan"], [2, 79000, "Membership Bulanan"]], "FFM"),
  ...list("PUBG MOBILE", "Games", "UC", [[30, 6900], [60, 13400], [325, 66500], [660, 133000], [1800, 333000], [3850, 666000]], "PUBG"),
  ...list("GENSHIN IMPACT", "Games", "Genesis Crystals", [[60, 13900], [330, 69500], [1090, 213000], [2240, 435000], [3880, 695000]], "GI"),
  ...list("GENSHIN IMPACT", "Games", "", [[1, 69500, "Blessing of the Welkin Moon"]], "GIW"),
  ...list("HONKAI STAR RAIL", "Games", "Oneiric Shard", [[60, 13900], [330, 69500], [1090, 213000], [2240, 435000]], "HSR"),
  ...list("VALORANT", "Games", "Points", [[475, 52000], [1000, 104000], [2050, 207000], [3650, 363000]], "VAL"),
  ...list("CALL OF DUTY MOBILE", "Games", "CP", [[31, 4700], [63, 9300], [128, 18600], [321, 46400], [645, 92800]], "CODM"),
  ...list("HONOR OF KINGS", "Games", "Tokens", [[16, 2800], [80, 13900], [240, 41700], [400, 69500], [830, 139000]], "HOK"),
  ...list("MAGIC CHESS", "Games", "Diamonds", [[12, 3250], [28, 7400], [86, 21300], [172, 42500]], "MCGG"),
  ...list("ROBLOX", "Voucher", "Robux", [[80, 14500], [400, 72000], [800, 143000], [1700, 290000]], "RBX"),
  ...list("STUMBLE GUYS", "Games", "Gems", [[100, 8500], [500, 41000], [1000, 82000]], "STG"),
  ...list("ARENA OF VALOR", "Games", "Vouchers", [[40, 9200], [90, 18500], [230, 46000]], "AOV"),
  ...list("STEAM WALLET (IDR)", "Voucher", "", [[12000, 12500, "Steam Wallet IDR 12.000"], [45000, 46800, "Steam Wallet IDR 45.000"], [60000, 62400, "Steam Wallet IDR 60.000"], [120000, 124800, "Steam Wallet IDR 120.000"], [250000, 260000, "Steam Wallet IDR 250.000"]], "STEAM"),
  ...list("GOOGLE PLAY INDONESIA", "Voucher", "", [[10000, 10300, "Google Play Rp 10.000"], [20000, 20500, "Google Play Rp 20.000"], [50000, 51000, "Google Play Rp 50.000"], [100000, 102000, "Google Play Rp 100.000"]], "GP"),
  ...list("TELKOMSEL", "Pulsa", "", [[5000, 5600, "Telkomsel 5.000"], [10000, 10500, "Telkomsel 10.000"], [20000, 20300, "Telkomsel 20.000"], [50000, 49800, "Telkomsel 50.000"], [100000, 98500, "Telkomsel 100.000"]], "TSEL"),
  ...list("PLN", "PLN", "", [[20000, 20300, "Token PLN 20.000"], [50000, 50300, "Token PLN 50.000"], [100000, 100300, "Token PLN 100.000"]], "PLN"),
  ...list("DANA", "E-Money", "", [[10000, 10600, "DANA 10.000"], [25000, 25600, "DANA 25.000"], [50000, 50600, "DANA 50.000"], [100000, 100600, "DANA 100.000"]], "DANA"),
  ...list("SPOTIFY", "Voucher", "", [[1, 52000, "Spotify Premium 1 Bulan"], [3, 156000, "Spotify Premium 3 Bulan"]], "SPOT"),
];
