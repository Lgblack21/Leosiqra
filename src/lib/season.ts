// Tema musiman maskot Leo (Pengaturan → Tema musiman) = hari raya & tanggal
// merah Indonesia. Ditentukan dari tanggal WIB.
// - Tanggal tetap (Tahun Baru, Hari Buruh, Pancasila, HUT RI, Natal) & yang
//   dihitung (Jumat Agung/Paskah/Kenaikan, dari rumus Paskah) selalu tepat.
// - Hari raya berbasis kalender bulan (hijriah, Imlek, Nyepi, Waisak) dari
//   tabel LUNAR: 2026 mengikuti SKB 3 Menteri; tahun berikutnya PERKIRAAN —
//   perbarui saat SKB terbit. Cukup untuk hiasan (rentang tampil beberapa hari).
export type Season =
  | 'tahunbaru' | 'islami' | 'imlek' | 'nyepi' | 'lebaran' | 'paskah' | 'buruh'
  | 'kenaikan' | 'waisak' | 'pancasila' | 'iduladha' | 'merdeka' | 'natal';

export const SEASON_INFO: Record<Season, { label: string; desc: string; deco: string[]; greeting: string }> = {
  tahunbaru: { label: 'Tahun Baru', desc: 'Leo pakai topi pesta, kartu Ringkasan dihiasi kembang api.', deco: ['🎆', '🥳', '🎉'], greeting: 'Selamat Tahun Baru! Semoga tahun ini dompetmu makin sehat 🎉' },
  islami: { label: 'Hari besar Islam', desc: 'Isra Mikraj, Tahun Baru Islam & Maulid Nabi: Leo pakai peci, kartu dihiasi bulan sabit.', deco: ['🌙', '⭐', '🕌'], greeting: '' },
  imlek: { label: 'Tahun Baru Imlek', desc: 'Leo pakai topi merah, kartu Ringkasan dihiasi lampion & angpao.', deco: ['🏮', '🧧', '🐉'], greeting: 'Gong Xi Fa Cai! Semoga rezekimu makin lancar 🧧' },
  nyepi: { label: 'Hari Raya Nyepi', desc: 'Leo pakai udeng, kartu Ringkasan tenang dengan lilin.', deco: ['🕯️', '🌑', '🙏'], greeting: 'Selamat Hari Raya Nyepi. Hari hening — pas buat istirahat dari belanja juga 🙏' },
  lebaran: { label: 'Ramadan & Idul Fitri', desc: 'Leo pakai peci, kartu Ringkasan berhias bulan sabit & ketupat.', deco: ['🌙', '✨', '🕌'], greeting: 'Selamat Hari Raya Idul Fitri! Mohon maaf lahir & batin 🙏' },
  paskah: { label: 'Jumat Agung & Paskah', desc: 'Leo pakai bando telinga kelinci, kartu Ringkasan dihiasi telur Paskah.', deco: ['🥚', '🐣', '🌷'], greeting: 'Selamat Paskah! Semoga damai & sukacita menyertaimu 🐣' },
  buruh: { label: 'Hari Buruh', desc: 'Leo pakai helm proyek — hormat buat semua pekerja.', deco: ['🛠️', '⚙️', '💪'], greeting: 'Selamat Hari Buruh! Kerja kerasmu layak dihargai — jangan lupa sisihkan buat diri sendiri 💪' },
  kenaikan: { label: 'Kenaikan Yesus Kristus', desc: 'Leo berhias lingkar cahaya, kartu Ringkasan dihiasi awan & merpati.', deco: ['🕊️', '☁️', '✨'], greeting: 'Selamat memperingati Kenaikan Yesus Kristus 🕊️' },
  waisak: { label: 'Hari Raya Waisak', desc: 'Leo berhias teratai, kartu Ringkasan dihiasi lampion.', deco: ['🪷', '🏮', '✨'], greeting: 'Selamat Hari Raya Waisak. Semoga semua makhluk berbahagia 🪷' },
  pancasila: { label: 'Hari Lahir Pancasila', desc: 'Leo pakai ikat kepala merah putih, kartu Ringkasan dihiasi Garuda.', deco: ['🦅', '🇮🇩', '⭐'], greeting: 'Selamat Hari Lahir Pancasila! 🇮🇩' },
  iduladha: { label: 'Idul Adha', desc: 'Leo pakai peci, kartu Ringkasan dihiasi kambing & sapi.', deco: ['🐐', '🕌', '✨'], greeting: 'Selamat Hari Raya Idul Adha! Semoga ibadah kurbanmu diterima 🙏' },
  merdeka: { label: 'Bulan Kemerdekaan', desc: 'Agustus: Leo pakai ikat kepala merah putih, ada bendera kecil berkibar.', deco: ['🇮🇩', '🎉', '⭐'], greeting: 'Dirgahayu Republik Indonesia! Merdeka! 🇮🇩' },
  natal: { label: 'Natal', desc: 'Leo pakai topi Santa, kartu Ringkasan bersalju.', deco: ['❄️', '🎄', '✨'], greeting: 'Selamat Natal! Semoga damai Natal menyertaimu 🎄' },
};

// Ramadan (awal puasa) → hari ke-7 setelah Idul Fitri.
const LEBARAN: [string, string][] = [
  ['2026-02-18', '2026-03-28'],
  ['2027-02-08', '2027-03-17'],
  ['2028-01-28', '2028-03-05'],
  ['2029-01-16', '2029-02-22'],
];

type LunarKey = 'isra' | 'imlek' | 'nyepi' | 'fitri' | 'adha' | 'waisak' | 'hijri' | 'maulid';
const LUNAR: [LunarKey, string][] = [
  // 2026 — SKB 3 Menteri
  ['isra', '2026-01-16'], ['imlek', '2026-02-17'], ['nyepi', '2026-03-19'], ['fitri', '2026-03-20'], ['adha', '2026-05-27'],
  ['waisak', '2026-05-31'], ['hijri', '2026-06-16'], ['maulid', '2026-08-25'],
  // 2027–2029 — perkiraan
  ['isra', '2027-01-05'], ['imlek', '2027-02-06'], ['nyepi', '2027-03-09'], ['fitri', '2027-03-10'], ['adha', '2027-05-17'],
  ['waisak', '2027-05-20'], ['hijri', '2027-06-06'], ['maulid', '2027-08-15'], ['isra', '2027-12-26'],
  ['imlek', '2028-01-26'], ['fitri', '2028-02-27'], ['nyepi', '2028-03-26'], ['adha', '2028-05-05'], ['waisak', '2028-05-09'],
  ['hijri', '2028-05-25'], ['maulid', '2028-08-03'], ['isra', '2028-12-14'],
  ['imlek', '2029-02-13'], ['fitri', '2029-02-15'], ['nyepi', '2029-03-15'], ['adha', '2029-04-24'], ['hijri', '2029-05-14'],
  ['waisak', '2029-05-27'], ['maulid', '2029-07-24'],
];
const LUNAR_NAME: Record<LunarKey, string> = {
  isra: 'Isra Mikraj', imlek: 'Tahun Baru Imlek', nyepi: 'Hari Raya Nyepi', fitri: 'Idul Fitri', adha: 'Idul Adha',
  waisak: 'Hari Raya Waisak', hijri: 'Tahun Baru Islam', maulid: 'Maulid Nabi Muhammad SAW',
};
const LUNAR_SEASON: Record<LunarKey, Season> = {
  isra: 'islami', imlek: 'imlek', nyepi: 'nyepi', fitri: 'lebaran', adha: 'iduladha', waisak: 'waisak', hijri: 'islami', maulid: 'islami',
};
// Rentang tampil di sekitar hari H (hari sebelum, hari sesudah).
const LUNAR_WINDOW: Record<LunarKey, [number, number]> = {
  isra: [1, 1], imlek: [3, 7], nyepi: [2, 1], fitri: [0, 0], adha: [2, 3], waisak: [2, 1], hijri: [1, 1], maulid: [1, 1],
};

const pad = (n: number) => String(n).padStart(2, '0');
const addDays = (ymd: string, d: number) => {
  const [y, m, day] = ymd.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, day + d));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
};
// Minggu Paskah (algoritma Meeus/Jones/Butcher, kalender Gregorian).
const easter = (y: number) => {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${y}-${pad(month)}-${pad(day)}`;
};

export type Holiday = { season: Season; name: string; isDay: boolean };

type Event = { season: Season; name: string; days: string[]; from: string; to: string };
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);

const eventsFor = (y: number): Event[] => {
  const ev: Event[] = [];
  for (const [key, date] of LUNAR) {
    if (Math.abs(Number(date.slice(0, 4)) - y) > 1) continue;
    if (key === 'fitri') {
      ev.push({ season: 'lebaran', name: 'Idul Fitri', days: [date, addDays(date, 1)], from: addDays(date, -1), to: addDays(date, 2) });
      continue;
    }
    const [before, after] = LUNAR_WINDOW[key];
    ev.push({ season: LUNAR_SEASON[key], name: LUNAR_NAME[key], days: [date], from: addDays(date, -before), to: addDays(date, after) });
  }
  for (const yy of [y - 1, y]) {
    const es = easter(yy);
    const gf = addDays(es, -2);
    const asc = addDays(es, 39);
    ev.push({ season: 'paskah', name: 'Jumat Agung & Paskah', days: [gf, es], from: addDays(gf, -3), to: addDays(es, 1) });
    ev.push({ season: 'kenaikan', name: 'Kenaikan Yesus Kristus', days: [asc], from: addDays(asc, -2), to: asc });
    ev.push({ season: 'tahunbaru', name: 'Tahun Baru', days: [`${yy}-12-31`, `${yy + 1}-01-01`], from: `${yy}-12-27`, to: `${yy + 1}-01-02` });
    ev.push({ season: 'buruh', name: 'Hari Buruh', days: [`${yy}-05-01`], from: `${yy}-04-28`, to: `${yy}-05-01` });
    ev.push({ season: 'pancasila', name: 'Hari Lahir Pancasila', days: [`${yy}-06-01`], from: `${yy}-05-29`, to: `${yy}-06-01` });
    ev.push({ season: 'natal', name: 'Natal', days: [`${yy}-12-24`, `${yy}-12-25`], from: `${yy}-12-18`, to: `${yy}-12-26` });
    ev.push({ season: 'merdeka', name: 'HUT Kemerdekaan RI', days: [`${yy}-08-17`], from: `${yy}-08-16`, to: `${yy}-08-18` });
  }
  return ev;
};

/** Hari raya yang sedang berlangsung (atau sebentar lagi) menurut tanggal WIB. */
export function currentHoliday(now = new Date()): Holiday | null {
  const wib = new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
  const y = Number(wib.slice(0, 4));
  const events = eventsFor(y);

  // 1) Hari H selalu menang (urutan daftar = prioritas: Idul Fitri lebih dulu).
  const today = events.find((e) => e.days.includes(wib));
  if (today) return { season: today.season, name: today.name, isDay: true };
  // 2) Dalam rentang hiasan → yang hari H-nya paling dekat.
  const near = events
    .filter((e) => wib >= e.from && wib <= e.to)
    .map((e) => ({ e, dist: Math.min(...e.days.map((d) => Math.abs(daysBetween(d, wib)))) }))
    .sort((a, b) => a.dist - b.dist)[0];
  if (near) return { season: near.e.season, name: near.e.name, isDay: false };
  // 3) Musim panjang: Ramadan s.d. seminggu setelah Lebaran, lalu bulan Agustus.
  if (LEBARAN.some(([a, b]) => wib >= a && wib <= b)) {
    const fitri = LUNAR.find(([k, d]) => k === 'fitri' && d.slice(0, 4) === String(y))?.[1];
    return { season: 'lebaran', name: fitri && wib >= fitri ? 'Idul Fitri' : 'Ramadan', isDay: false };
  }
  if (wib.slice(5, 7) === '08') return { season: 'merdeka', name: 'HUT Kemerdekaan RI', isDay: false };
  return null;
}

export function currentSeason(now = new Date()): Season | null {
  return currentHoliday(now)?.season ?? null;
}
