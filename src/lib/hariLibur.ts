// Tanggal merah Indonesia: libur nasional + cuti bersama sesuai SKB 3 Menteri (bukan perkiraan).
//   2026: SKB Menag 1497/2025, Menaker 2/2025, MenPANRB 5/2025 (19 Sep 2025) — setneg.go.id
//   2027: SKB Menag 1205/2026, Menaker 3/2026, MenPANRB 2/2026 (15 Sep 2026) — kemenag.go.id
// Tanggal hari raya Hijriah bisa disesuaikan lewat Keputusan Menteri Agama — perbarui di sini bila berubah.
// Tambah tahun baru setiap SKB terbit (biasanya September tahun sebelumnya).
export type JenisLibur = 'libur' | 'cuti';
export type HariLibur = { date: string; nama: string; jenis: JenisLibur };

const L = (date: string, nama: string): HariLibur => ({ date, nama, jenis: 'libur' });
const C = (date: string, nama: string): HariLibur => ({ date, nama, jenis: 'cuti' });

export const HARI_LIBUR: HariLibur[] = [
  // ── 2026 ──
  L('2026-01-01', 'Tahun Baru 2026 Masehi'),
  L('2026-01-16', 'Isra Mikraj Nabi Muhammad SAW'),
  C('2026-02-16', 'Tahun Baru Imlek 2577 Kongzili'),
  L('2026-02-17', 'Tahun Baru Imlek 2577 Kongzili'),
  C('2026-03-18', 'Hari Suci Nyepi (Tahun Baru Saka 1948)'),
  L('2026-03-19', 'Hari Suci Nyepi (Tahun Baru Saka 1948)'),
  C('2026-03-20', 'Idulfitri 1447 H'),
  L('2026-03-21', 'Idulfitri 1447 H'),
  L('2026-03-22', 'Idulfitri 1447 H'),
  C('2026-03-23', 'Idulfitri 1447 H'),
  C('2026-03-24', 'Idulfitri 1447 H'),
  L('2026-04-03', 'Wafat Yesus Kristus'),
  L('2026-04-05', 'Kebangkitan Yesus Kristus (Paskah)'),
  L('2026-05-01', 'Hari Buruh Internasional'),
  L('2026-05-14', 'Kenaikan Yesus Kristus'),
  C('2026-05-15', 'Kenaikan Yesus Kristus'),
  L('2026-05-27', 'Iduladha 1447 H'),
  C('2026-05-28', 'Iduladha 1447 H'),
  L('2026-05-31', 'Hari Raya Waisak 2570 BE'),
  L('2026-06-01', 'Hari Lahir Pancasila'),
  L('2026-06-16', '1 Muharam Tahun Baru Islam 1448 H'),
  L('2026-08-17', 'Proklamasi Kemerdekaan'),
  L('2026-08-25', 'Maulid Nabi Muhammad SAW'),
  C('2026-12-24', 'Kelahiran Yesus Kristus (Natal)'),
  L('2026-12-25', 'Kelahiran Yesus Kristus (Natal)'),
  // ── 2027 ──
  L('2027-01-01', 'Tahun Baru 2027 Masehi'),
  L('2027-01-05', 'Isra Mikraj Nabi Muhammad SAW'),
  C('2027-02-05', 'Tahun Baru Imlek 2578 Kongzili'),
  L('2027-02-06', 'Tahun Baru Imlek 2578 Kongzili'),
  L('2027-03-08', 'Hari Suci Nyepi (Tahun Baru Saka 1949)'),
  C('2027-03-09', 'Idulfitri 1448 H'),
  L('2027-03-10', 'Idulfitri 1448 H'),
  L('2027-03-11', 'Idulfitri 1448 H'),
  C('2027-03-12', 'Idulfitri 1448 H'),
  C('2027-03-15', 'Idulfitri 1448 H'),
  C('2027-03-25', 'Wafat Yesus Kristus'),
  L('2027-03-26', 'Wafat Yesus Kristus'),
  L('2027-03-28', 'Kebangkitan Yesus Kristus (Paskah)'),
  L('2027-05-01', 'Hari Buruh Internasional'),
  L('2027-05-06', 'Kenaikan Yesus Kristus'),
  L('2027-05-17', 'Iduladha 1448 H'),
  C('2027-05-18', 'Iduladha 1448 H'),
  C('2027-05-19', 'Hari Raya Waisak 2571 BE'),
  L('2027-05-20', 'Hari Raya Waisak 2571 BE'),
  L('2027-06-01', 'Hari Lahir Pancasila'),
  L('2027-06-06', '1 Muharam Tahun Baru Islam 1449 H'),
  L('2027-08-15', 'Maulid Nabi Muhammad SAW'),
  L('2027-08-17', 'Proklamasi Kemerdekaan'),
  C('2027-12-24', 'Kelahiran Yesus Kristus (Natal)'),
  L('2027-12-25', 'Kelahiran Yesus Kristus (Natal)'),
  L('2027-12-26', 'Isra Mikraj Nabi Muhammad SAW'),
];
export const TAHUN_TERSEDIA = [...new Set(HARI_LIBUR.map((h) => Number(h.date.slice(0, 4))))];

const BY_DATE = new Map<string, HariLibur[]>();
for (const h of HARI_LIBUR) BY_DATE.set(h.date, [...(BY_DATE.get(h.date) ?? []), h]);

/** YYYY-MM-DD menurut kalender lokal. */
export const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseYmd = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const liburPada = (d: Date | string) => BY_DATE.get(typeof d === 'string' ? d.slice(0, 10) : ymd(d)) ?? [];
export const isAkhirPekan = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
/** Data tanggal merah untuk tahun ini tersedia? (kalau tidak, hanya akhir pekan yang diketahui). */
export const adaData = (d: Date) => TAHUN_TERSEDIA.includes(d.getFullYear());
export const isHariKerja = (d: Date) => !isAkhirPekan(d) && liburPada(d).length === 0;
/** Hari kerja terakhir SEBELUM tanggal ini (untuk transfer/bayar lebih awal). */
export const hariKerjaSebelum = (d: Date) => {
  let x = addDays(d, -1);
  for (let i = 0; i < 20 && !isHariKerja(x); i++) x = addDays(x, -1);
  return x;
};

export type Rentang = { mulai: Date; selesai: Date; hari: number; libur: HariLibur[] };
/** Rentang hari tidak bekerja berturut-turut (akhir pekan + tanggal merah) yang memuat tanggal merah. */
export function rentangLibur(from: Date, toExclusive: Date): Rentang[] {
  const out: Rentang[] = [];
  let cur: Rentang | null = null;
  for (let d = new Date(from); d < toExclusive; d = addDays(d, 1)) {
    if (!isHariKerja(d)) {
      if (!cur) cur = { mulai: new Date(d), selesai: new Date(d), hari: 0, libur: [] };
      cur.selesai = new Date(d);
      cur.hari++;
      for (const h of liburPada(d)) if (!cur.libur.some((x) => x.nama === h.nama)) cur.libur.push(h);
    } else if (cur) {
      if (cur.libur.length) out.push(cur);
      cur = null;
    }
  }
  if (cur?.libur.length) out.push(cur);
  return out;
}
/** Tanggal merah berikutnya (mulai hari ini) beserta rentang liburnya. */
export function liburBerikutnya(now = new Date()) {
  const today = parseYmd(ymd(now));
  const list = rentangLibur(today, addDays(today, 400));
  return list.find((r) => r.selesai >= today) ?? null;
}
