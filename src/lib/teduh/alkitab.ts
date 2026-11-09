'use client';

// Alkitab Terjemahan Baru (© Lembaga Alkitab Indonesia) lewat API Indonesia (Worker /api/member/teduh/alkitab/*).
// Teks tidak disimpan permanen di Leosiqra — hanya cache sementara. Progres & tanda ayat hanya di perangkat.
import { cloudflareApi } from '@/lib/cloudflare-api';

export type Kitab = { id: number; abbr: string; nama: string; pasal: number; perjanjian: 'PL' | 'PB' };
export type Ayat = { n: number; judul: string | null; teks: string };
export type Pasal = { kitab: { id: number; abbr: string; nama: string }; pasal: number; ayat: Ayat[] };
export const TOTAL_PASAL = 1189;
export const ATRIBUSI = 'Alkitab Terjemahan Baru © Lembaga Alkitab Indonesia (LAI)';

let kitabP: Promise<Kitab[]> | null = null;
const pasalCache = new Map<string, Promise<Pasal>>();
export const alkitabService = {
  kitab() {
    if (!kitabP) kitabP = cloudflareApi<{ items: Kitab[] }>('/api/member/teduh/alkitab/kitab').then((r) => r.items);
    kitabP.catch(() => (kitabP = null));
    return kitabP;
  },
  pasal(abbr: string, n: number) {
    const k = `${abbr}:${n}`;
    let p = pasalCache.get(k);
    if (!p) {
      p = cloudflareApi<Pasal>(`/api/member/teduh/alkitab/pasal?kitab=${encodeURIComponent(abbr)}&pasal=${n}`);
      p.catch(() => pasalCache.delete(k));
      pasalCache.set(k, p);
    }
    return p;
  },
};

// Tema keuangan — rujukan berdasarkan nomor kitab kanon Protestan (1 Kejadian … 66 Wahyu).
export type Rujukan = { b: number; c: number; v: number };
export type TemaAlkitab = {
  id: string;
  judul: string;
  emoji: string;
  ajak?: { label: string; href: string; app?: string };
  ayat: Rujukan[];
};
const r = (b: number, c: number, v: number): Rujukan => ({ b, c, v });
export const TEMA_ALKITAB: TemaAlkitab[] = [
  {
    id: 'memberi',
    judul: 'Persembahan & perpuluhan',
    emoji: '🙏',
    ajak: { label: 'Catat persembahan', href: '/input-cepat?teks=Persembahan' },
    ayat: [r(39, 3, 10), r(47, 9, 7), r(20, 3, 9), r(42, 6, 38)],
  },
  {
    id: 'utang',
    judul: 'Utang',
    emoji: '🤝',
    ajak: { label: 'Buka Hutang & Piutang', href: '/membership/kekayaan', app: '/app/debts' },
    ayat: [r(20, 22, 7), r(45, 13, 8), r(19, 37, 21)],
  },
  {
    id: 'cukup',
    judul: 'Hidup cukup',
    emoji: '🪙',
    ayat: [r(58, 13, 5), r(50, 4, 11), r(50, 4, 12), r(54, 6, 6), r(42, 12, 15)],
  },
  {
    id: 'rencana',
    judul: 'Rencana & menabung',
    emoji: '📒',
    ajak: { label: 'Cek anggaranmu', href: '/membership/budget', app: '/app/budget' },
    ayat: [r(20, 21, 5), r(42, 14, 28), r(20, 6, 6), r(20, 13, 11)],
  },
  { id: 'tenang', judul: 'Jangan kuatir', emoji: '🌤️', ayat: [r(40, 6, 33), r(40, 6, 34), r(50, 4, 6), r(60, 5, 7)] },
  { id: 'kerja', judul: 'Bekerja', emoji: '🛠️', ayat: [r(51, 3, 23), r(20, 14, 23), r(53, 3, 10)] },
  {
    id: 'harta',
    judul: 'Harta & hati',
    emoji: '⚖️',
    ayat: [r(40, 6, 19), r(40, 6, 21), r(40, 6, 24), r(54, 6, 10), r(54, 6, 17)],
  },
];
const SEMUA = TEMA_ALKITAB.flatMap((t) => t.ayat.map((a) => ({ a, tema: t })));
const dayNumber = (d = new Date()) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400_000);
export const ayatHariIniAlkitab = (d = new Date()) => SEMUA[dayNumber(d) % SEMUA.length];
export const rujukanKey = (x: Rujukan) => `${x.b}:${x.c}:${x.v}`;

// ── Progres di perangkat ──
const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
type Store = {
  read: string[];
  days: Record<string, number>;
  last: { b: number; c: number } | null;
  marks: { k: string; at: number }[];
};
const KEY = 'leosiqra-teduh-alkitab';
const empty = (): Store => ({ read: [], days: {}, last: null, marks: [] });
let mem: Store | null = null;
const subs = new Set<() => void>();
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
  subs.forEach((l) => l());
};
export const progresAlkitab = {
  subscribe(cb: () => void) {
    subs.add(cb);
    return () => subs.delete(cb);
  },
  snapshot: () => load(),
  /** Pasal selesai dibaca (ayat terakhir terlihat). */
  markPasal(b: number, c: number) {
    const s = load();
    const k = `${b}:${c}`;
    const day = todayKey();
    save({
      ...s,
      read: s.read.includes(k) ? s.read : [...s.read, k],
      days: { ...s.days, [day]: (s.days[day] ?? 0) + 1 },
      last: { b, c },
    });
  },
  setLast(b: number, c: number) {
    const s = load();
    if (s.last?.b === b && s.last?.c === c) return;
    save({ ...s, last: { b, c } });
  },
  toggleMark(k: string) {
    const s = load();
    const has = s.marks.some((m) => m.k === k);
    save({ ...s, marks: has ? s.marks.filter((m) => m.k !== k) : [{ k, at: Date.now() }, ...s.marks].slice(0, 500) });
  },
};
