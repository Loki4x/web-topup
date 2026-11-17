// Cek nickname akun game.
// Digiflazz TIDAK menyediakan API cek nickname game, jadi perlu layanan pihak ketiga.
// Atur NICKNAME_API_URL di .env dengan placeholder {game}, {id}, {zone}, contoh:
//   NICKNAME_API_URL=https://api-penyedia.com/v1/nickname?game={game}&id={id}&zone={zone}
// Respons JSON yang diharapkan berisi salah satu field: name / nickname / username / data.name / data.nickname.
// Sesuaikan fungsi pickName() bila format penyedia Anda berbeda.
const config = require("../config");

const pickName = j => j?.name || j?.nickname || j?.username || j?.data?.name || j?.data?.nickname || j?.data?.username || null;

async function check(gameCode, id, zone = "") {
  if (config.mockNickname) {
    // Mode simulasi: ID berakhiran 0000 dianggap tidak ditemukan.
    if (String(id).endsWith("0000")) return null;
    return `Player${String(id).slice(-4)}`;
  }
  const url = config.nickname.url
    .replace("{game}", encodeURIComponent(gameCode))
    .replace("{id}", encodeURIComponent(id))
    .replace("{zone}", encodeURIComponent(zone));
  const res = await fetch(url, {
    headers: config.nickname.key ? { Authorization: `Bearer ${config.nickname.key}` } : {},
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  return pickName(await res.json().catch(() => null));
}

module.exports = { check, isMock: config.mockNickname };
