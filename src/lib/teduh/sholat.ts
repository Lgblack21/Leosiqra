// Jadwal sholat dihitung di perangkat (pustaka adhan, MIT) — tanpa API, lokasi tidak dikirim ke server.
// Parameter mendekati Kemenag RI: Subuh 20°, Isya 18°, Ashar mazhab Syafi'i, ihtiyat 2 menit,
// Imsak = Subuh − 10 menit. Tetap perkiraan: ikuti jadwal resmi Kemenag/masjid setempat.
import { CalculationParameters, Coordinates, Madhab, PrayerTimes, Rounding } from 'adhan';

export type LokasiSholat = { lat: number; lng: number; nama: string };
export const KOTA: LokasiSholat[] = [
  { nama: 'Jakarta', lat: -6.1754, lng: 106.8272 },
  { nama: 'Bogor', lat: -6.595, lng: 106.8166 },
  { nama: 'Depok', lat: -6.4025, lng: 106.7942 },
  { nama: 'Tangerang', lat: -6.1783, lng: 106.6319 },
  { nama: 'Bekasi', lat: -6.2383, lng: 106.9756 },
  { nama: 'Bandung', lat: -6.9175, lng: 107.6191 },
  { nama: 'Semarang', lat: -6.9667, lng: 110.4167 },
  { nama: 'Yogyakarta', lat: -7.7956, lng: 110.3695 },
  { nama: 'Surabaya', lat: -7.2575, lng: 112.7521 },
  { nama: 'Malang', lat: -7.9666, lng: 112.6326 },
  { nama: 'Denpasar', lat: -8.6705, lng: 115.2126 },
  { nama: 'Mataram', lat: -8.5833, lng: 116.1167 },
  { nama: 'Kupang', lat: -10.1772, lng: 123.607 },
  { nama: 'Banda Aceh', lat: 5.5483, lng: 95.3238 },
  { nama: 'Medan', lat: 3.5952, lng: 98.6722 },
  { nama: 'Padang', lat: -0.9471, lng: 100.4172 },
  { nama: 'Pekanbaru', lat: 0.5071, lng: 101.4478 },
  { nama: 'Batam', lat: 1.0456, lng: 104.0305 },
  { nama: 'Palembang', lat: -2.9761, lng: 104.7754 },
  { nama: 'Bandar Lampung', lat: -5.3971, lng: 105.2668 },
  { nama: 'Pontianak', lat: -0.0263, lng: 109.3425 },
  { nama: 'Banjarmasin', lat: -3.3186, lng: 114.5944 },
  { nama: 'Balikpapan', lat: -1.2379, lng: 116.8529 },
  { nama: 'Samarinda', lat: -0.5022, lng: 117.1536 },
  { nama: 'Makassar', lat: -5.1477, lng: 119.4327 },
  { nama: 'Manado', lat: 1.4748, lng: 124.8421 },
  { nama: 'Palu', lat: -0.8917, lng: 119.8707 },
  { nama: 'Kendari', lat: -3.9985, lng: 122.513 },
  { nama: 'Ambon', lat: -3.6954, lng: 128.1814 },
  { nama: 'Ternate', lat: 0.7893, lng: 127.3813 },
  { nama: 'Jayapura', lat: -2.5337, lng: 140.7181 },
];

const params = () => {
  const p = new CalculationParameters('Other', 20, 18);
  p.madhab = Madhab.Shafi;
  // Dikalibrasi terhadap jadwal Bimas Islam Kemenag (Jakarta, Nov 2026): Dzuhur & Maghrib +3, lainnya +2.
  p.adjustments = { fajr: 2, sunrise: -2, dhuhr: 3, asr: 2, maghrib: 3, isha: 2 };
  // Kemenag membulatkan ke atas (ke menit berikutnya), bukan ke menit terdekat.
  p.rounding = Rounding.Up;
  return p;
};
export type Waktu = { id: string; nama: string; at: Date };
export function jadwal(loc: { lat: number; lng: number }, date = new Date()): Waktu[] {
  const t = new PrayerTimes(new Coordinates(loc.lat, loc.lng), date, params());
  return [
    { id: 'imsak', nama: 'Imsak', at: new Date(t.fajr.getTime() - 10 * 60_000) },
    { id: 'subuh', nama: 'Subuh', at: t.fajr },
    { id: 'terbit', nama: 'Terbit', at: t.sunrise },
    { id: 'dzuhur', nama: 'Dzuhur', at: t.dhuhr },
    { id: 'ashar', nama: 'Ashar', at: t.asr },
    { id: 'maghrib', nama: 'Maghrib', at: t.maghrib },
    { id: 'isya', nama: 'Isya', at: t.isha },
  ];
}
const WAJIB = new Set(['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya']);
/** Sholat wajib berikutnya (bisa Subuh besok). */
export function berikutnya(loc: { lat: number; lng: number }, now = new Date()): Waktu {
  const hari = jadwal(loc, now).filter((w) => WAJIB.has(w.id));
  const n = hari.find((w) => w.at > now);
  if (n) return n;
  const besok = new Date(now);
  besok.setDate(besok.getDate() + 1);
  return jadwal(loc, besok).find((w) => w.id === 'subuh')!;
}

const KEY = 'leosiqra-teduh-lokasi';
const subs = new Set<() => void>();
let cached: { raw: string | null; val: LokasiSholat | null } = { raw: null, val: null };
export const lokasiSholat = {
  subscribe(cb: () => void) {
    subs.add(cb);
    return () => subs.delete(cb);
  },
  get(): LokasiSholat | null {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(KEY);
    } catch {
      return null;
    }
    if (raw !== cached.raw) {
      let val: LokasiSholat | null = null;
      try {
        const v = JSON.parse(raw ?? 'null');
        if (v && Number.isFinite(v.lat) && Number.isFinite(v.lng))
          val = { lat: v.lat, lng: v.lng, nama: String(v.nama ?? 'Lokasimu') };
      } catch {
        /* rusak */
      }
      cached = { raw, val };
    }
    return cached.val;
  },
  set(v: LokasiSholat | null) {
    try {
      if (v)
        localStorage.setItem(
          KEY,
          JSON.stringify({ lat: Math.round(v.lat * 100) / 100, lng: Math.round(v.lng * 100) / 100, nama: v.nama }),
        );
      else localStorage.removeItem(KEY);
    } catch {
      /* diblokir */
    }
    subs.forEach((l) => l());
  },
};
