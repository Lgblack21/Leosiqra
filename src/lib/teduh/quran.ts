// Al-Qur'an untuk Teduh: data statis (public/teduh/quran — Tanzil + Kemenag via QuranEnc, tanpa diubah),
// progres & tanda bacaan hanya di perangkat.
import { cloudflareApi } from '@/lib/cloudflare-api';

export type SurahMeta = { n: number; ayat: number; start: number; ar: string; latin: string; en: string; type: string };
export type Sources = {
  arab: { nama: string; url: string; lisensi: string; catatan: string };
  terjemahan: { nama: string; versi: string; url: string; catatan: string };
};
/** [teks Arab, terjemahan, catatan kaki] */
export type Ayat = [string, string, string];
export type SurahData = { n: number; basmalah: string | null; sources: Sources; ayat: Ayat[] };
export const TOTAL_AYAT = 6236;

let metaP: Promise<{ sources: Sources; surah: SurahMeta[] }> | null = null;
export const loadMeta = () => {
  if (!metaP)
    metaP = fetch('/teduh/quran/surah.json').then((r) => {
      if (!r.ok) throw new Error('Daftar surah gagal dimuat.');
      return r.json();
    });
  metaP.catch(() => (metaP = null));
  return metaP;
};
const surahCache = new Map<number, Promise<SurahData>>();
export const loadSurah = (n: number) => {
  let p = surahCache.get(n);
  if (!p) {
    p = fetch(`/teduh/quran/s${n}.json`).then((r) => {
      if (!r.ok) throw new Error('Surah gagal dimuat.');
      return r.json();
    });
    p.catch(() => surahCache.delete(n));
    surahCache.set(n, p);
  }
  return p;
};

/** "2:255", "2 255", "al baqarah 255", "yasin" → { s, a? } */
export function parseRef(q: string, list: SurahMeta[]): { s: number; a?: number } | null {
  const t = q.trim().toLowerCase();
  const m = /^(\d{1,3})\s*[:.\s]\s*(\d{1,3})$/.exec(t);
  if (m) {
    const s = Number(m[1]);
    const a = Number(m[2]);
    const meta = list.find((x) => x.n === s);
    return meta && a >= 1 && a <= meta.ayat ? { s, a } : null;
  }
  if (/^\d{1,3}$/.test(t)) {
    const s = Number(t);
    return s >= 1 && s <= 114 ? { s } : null;
  }
  return null;
}
const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '');
export const searchSurah = (q: string, list: SurahMeta[]) => {
  const k = norm(q.replace(/\d+\s*$/, ''));
  if (!k) return list;
  return list.filter((s) => norm(s.latin).includes(k) || norm(s.en).includes(k) || String(s.n) === q.trim());
};

// ── Tema keuangan (rujukan dicek terhadap terjemahan Kemenag) ──
export type Tema = {
  id: string;
  judul: string;
  emoji: string;
  ajak?: { label: string; href: string; app?: string };
  ayat: string[];
};
export const TEMA: Tema[] = [
  { id: 'rezeki', judul: 'Rezeki', emoji: '🌾', ayat: ['65:3', '11:6', '34:39', '29:60', '51:58', '62:10'] },
  { id: 'syukur', judul: 'Syukur', emoji: '🤲', ayat: ['14:7', '2:152', '16:18'] },
  {
    id: 'sedekah',
    judul: 'Sedekah & zakat',
    emoji: '💝',
    ajak: { label: 'Catat sedekah', href: '/input-cepat?teks=Sedekah' },
    ayat: ['2:261', '2:274', '3:92', '57:7', '64:16', '2:268', '9:60'],
  },
  {
    id: 'utang',
    judul: 'Utang',
    emoji: '🤝',
    ajak: { label: 'Buka Hutang & Piutang', href: '/membership/kekayaan', app: '/app/debts' },
    ayat: ['2:282', '2:280'],
  },
  {
    id: 'hemat',
    judul: 'Tidak boros',
    emoji: '🪙',
    ajak: { label: 'Cek anggaranmu', href: '/membership/laporan', app: '/app/budget' },
    ayat: ['17:26', '17:27', '25:67', '7:31'],
  },
  { id: 'tenang', judul: 'Tenang saat sulit', emoji: '🌤️', ayat: ['94:5', '94:6', '2:153', '13:28', '2:286', '65:7'] },
  { id: 'harta', judul: 'Harta & amanah', emoji: '⚖️', ayat: ['8:28', '18:46', '63:9', '4:29'] },
];
const ALL_TEMA_AYAT = TEMA.flatMap((t) => t.ayat.map((k) => ({ k, tema: t })));
const dayNumber = (d = new Date()) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400_000);
/** Ayat hari ini: bergilir dari ayat-ayat tema (sama untuk semua orang di hari yang sama). */
export const ayatHariIni = (d = new Date()) => ALL_TEMA_AYAT[dayNumber(d) % ALL_TEMA_AYAT.length];
export const temaHariIni = (d = new Date()) => TEMA[dayNumber(d) % TEMA.length];
export const splitKey = (k: string) => {
  const [s, a] = k.split(':').map(Number);
  return { s, a };
};

// ── Progres di perangkat ──
export const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
type Store = {
  read: string; // bitset base64 (6236 ayat)
  days: Record<string, number>; // tanggal → jumlah ayat dibaca
  last: { s: number; a: number } | null;
  marks: { k: string; at: number }[];
  qari: number;
};
const KEY = 'leosiqra-teduh-quran';
const empty = (): Store => ({ read: '', days: {}, last: null, marks: [], qari: 7 });
let mem: Store | null = null;
const listeners = new Set<() => void>();
const load = (): Store => {
  if (mem) return mem;
  try {
    mem = { ...empty(), ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    mem = empty();
  }
  return mem!;
};
const save = (s: Store) => {
  mem = s;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* penuh / diblokir */
  }
  listeners.forEach((l) => l());
};
const bits = (b64: string) => {
  const out = new Uint8Array(Math.ceil(TOTAL_AYAT / 8));
  if (!b64) return out;
  try {
    const raw = atob(b64);
    for (let i = 0; i < raw.length && i < out.length; i++) out[i] = raw.charCodeAt(i);
  } catch {
    /* rusak → mulai ulang */
  }
  return out;
};
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
export const progres = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  snapshot: () => load(),
  /** Tandai ayat (indeks global 0..6235) sudah dibaca. */
  markRead(globalIdx: number, ref: { s: number; a: number }) {
    const s = load();
    const u = bits(s.read);
    const byte = globalIdx >> 3;
    const bit = 1 << (globalIdx & 7);
    const fresh = !(u[byte] & bit);
    u[byte] |= bit;
    const day = todayKey();
    save({
      ...s,
      read: fresh ? b64(u) : s.read,
      days: { ...s.days, [day]: (s.days[day] ?? 0) + 1 },
      last: ref,
    });
  },
  /** Bitset ayat dibaca (didekode sekali; pakai untuk perulangan banyak ayat). */
  readBits: () => bits(load().read),
  isRead(globalIdx: number) {
    const u = bits(load().read);
    return Boolean(u[globalIdx >> 3] & (1 << (globalIdx & 7)));
  },
  countRead() {
    const u = bits(load().read);
    let n = 0;
    for (const x of u) for (let v = x; v; v &= v - 1) n++;
    return n;
  },
  toggleMark(k: string) {
    const s = load();
    const has = s.marks.some((m) => m.k === k);
    save({ ...s, marks: has ? s.marks.filter((m) => m.k !== k) : [{ k, at: Date.now() }, ...s.marks].slice(0, 500) });
  },
  setQari(id: number) {
    save({ ...load(), qari: id });
  },
  reset() {
    save(empty());
  },
};
/** Hari berturut-turut membaca (hari ini belum dibaca → dihitung sampai kemarin). */
export function streak(days: Record<string, number>, d = new Date()) {
  let n = 0;
  const cur = new Date(d);
  if (!days[todayKey(cur)]) cur.setDate(cur.getDate() - 1);
  while (days[todayKey(cur)]) {
    n++;
    cur.setDate(cur.getDate() - 1);
  }
  return n;
}

// ── Audio murattal ──
// Utama: Worker → Quran Foundation API (perlu kunci QF). Selama kunci belum dipasang / API gagal,
// pakai CDN audio publik quran.com (verses.quran.com, berkas yang sama yang dikembalikan API QF),
// ayat demi ayat: <folder>/SSSAAA.mp3. Hanya qari yang sudah dicek tersedia di CDN.
export type Qari = { id: number; name: string; style: string | null };
const QARI_CDN: (Qari & { path: string })[] = [
  { id: 7, name: 'Mishari Rashid al-Afasy', style: null, path: 'Alafasy/mp3' },
  { id: 2, name: 'Abdul Basit Abdus Samad', style: 'Murattal', path: 'AbdulBaset/Murattal/mp3' },
  { id: 1, name: 'Abdul Basit Abdus Samad', style: 'Mujawwad', path: 'AbdulBaset/Mujawwad/mp3' },
  { id: 3, name: 'Abdurrahman as-Sudais', style: null, path: 'Sudais/mp3' },
  { id: 4, name: 'Abu Bakr asy-Syatri', style: null, path: 'Shatri/mp3' },
  { id: 5, name: "Hani ar-Rifa'i", style: null, path: 'Rifai/mp3' },
  { id: 9, name: 'Muhammad Siddiq al-Minshawi', style: 'Murattal', path: 'Minshawi/Murattal/mp3' },
  { id: 8, name: 'Muhammad Siddiq al-Minshawi', style: 'Mujawwad', path: 'Minshawi/Mujawwad/mp3' },
  { id: 10, name: "Sa'ud asy-Syuraim", style: null, path: 'Shuraym/mp3' },
];
const pad3 = (n: number) => String(n).padStart(3, '0');
const cdnSurah = (surah: number, reciter: number, count: number) => {
  const q = QARI_CDN.find((x) => x.id === reciter) ?? QARI_CDN[0];
  return {
    reciter: q.id,
    items: Array.from({ length: count }, (_, i) => ({
      key: `${surah}:${i + 1}`,
      url: `https://verses.quran.com/${q.path}/${pad3(surah)}${pad3(i + 1)}.mp3`,
    })),
  };
};
export const audioService = {
  reciters: () =>
    cloudflareApi<{ items: Qari[] }>('/api/member/teduh/reciters').catch(() => ({
      items: QARI_CDN.map(({ id, name, style }) => ({ id, name, style })),
    })),
  surah: (surah: number, reciter: number, count: number) =>
    cloudflareApi<{ reciter: number; items: { key: string; url: string }[] }>(
      `/api/member/teduh/audio?surah=${surah}&reciter=${reciter}`,
    ).catch(() => cdnSurah(surah, reciter, count)),
};

// ── Tafsir ringkas (Al-Mukhtasar, QuranEnc — tanpa diubah) untuk "Pelajari" ──
export type TafsirSurah = { n: number; sumber: { nama: string; url: string; salinan: string }; tafsir: string[] };
const tafsirCache = new Map<number, Promise<TafsirSurah>>();
export const loadTafsir = (n: number) => {
  let p = tafsirCache.get(n);
  if (!p) {
    p = fetch(`/teduh/tafsir/t${n}.json`).then((r) => {
      if (!r.ok) throw new Error('Tafsir gagal dimuat.');
      return r.json();
    });
    p.catch(() => tafsirCache.delete(n));
    tafsirCache.set(n, p);
  }
  return p;
};
