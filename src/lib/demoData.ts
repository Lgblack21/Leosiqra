// Data rekaan untuk mode contoh (/contoh): ±3 bulan keuangan karyawan muda di
// kota besar, dibangkitkan deterministik (seed tetap) relatif ke tanggal hari
// ini. Murni di browser — tidak ada yang dibaca/ditulis ke server. Nominal
// dalam rupiah bulat (integer), jadi penjumlahan tidak kena galat desimal.

export type DemoType = 'pengeluaran' | 'pemasukan' | 'transfer';

export interface DemoAccount {
  id: string;
  name: string;
  kind: 'Bank' | 'E-Wallet' | 'Tunai';
  start: number;
  tile: string;
}

export interface DemoTx {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  title: string;
  category: string;
  type: DemoType;
  amount: number;
  account: string;
  toAccount?: string;
  emoji: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { id: 'bank', name: 'Rekening Gaji', kind: 'Bank', start: 6_250_000, tile: 'bg-blue-600' },
  { id: 'ewallet', name: 'Dompet Digital', kind: 'E-Wallet', start: 420_000, tile: 'bg-indigo-600' },
  { id: 'tunai', name: 'Uang Tunai', kind: 'Tunai', start: 350_000, tile: 'bg-emerald-500' },
  { id: 'tabungan', name: 'Tabungan Mudik', kind: 'Bank', start: 2_800_000, tile: 'bg-pink-500' },
];

export const DEMO_BUDGETS = [
  { category: 'Makan & Minum', limit: 2_400_000 },
  { category: 'Transportasi', limit: 900_000 },
  { category: 'Belanja Harian', limit: 1_200_000 },
  { category: 'Hiburan', limit: 400_000 },
];

const SPEND: { title: string; category: string; emoji: string; min: number; max: number; account: string; weight: number; hours: [number, number] }[] = [
  { title: 'Kopi susu', category: 'Makan & Minum', emoji: '☕', min: 18_000, max: 32_000, account: 'ewallet', weight: 5, hours: [7, 10] },
  { title: 'Makan siang', category: 'Makan & Minum', emoji: '🍛', min: 20_000, max: 45_000, account: 'tunai', weight: 6, hours: [11, 13] },
  { title: 'Nasi padang', category: 'Makan & Minum', emoji: '🍛', min: 25_000, max: 38_000, account: 'tunai', weight: 2, hours: [12, 19] },
  { title: 'Bakso', category: 'Makan & Minum', emoji: '🍜', min: 18_000, max: 28_000, account: 'tunai', weight: 2, hours: [17, 20] },
  { title: 'Ojek online', category: 'Transportasi', emoji: '🛵', min: 12_000, max: 35_000, account: 'ewallet', weight: 5, hours: [7, 9] },
  { title: 'Parkir', category: 'Transportasi', emoji: '🅿️', min: 2_000, max: 5_000, account: 'tunai', weight: 3, hours: [9, 20] },
  { title: 'Bensin', category: 'Transportasi', emoji: '⛽', min: 30_000, max: 60_000, account: 'tunai', weight: 1, hours: [7, 18] },
  { title: 'Minimarket', category: 'Belanja Harian', emoji: '🛒', min: 25_000, max: 95_000, account: 'ewallet', weight: 3, hours: [18, 21] },
  { title: 'Belanja dapur', category: 'Belanja Harian', emoji: '🥬', min: 60_000, max: 180_000, account: 'bank', weight: 1, hours: [9, 11] },
  { title: 'Nonton bioskop', category: 'Hiburan', emoji: '🎬', min: 45_000, max: 90_000, account: 'ewallet', weight: 1, hours: [19, 21] },
];

const MONTHLY: { day: number; title: string; category: string; emoji: string; amount: number; account: string; type: DemoType; toAccount?: string }[] = [
  { day: 1, title: 'Gaji bulanan', category: 'Gaji', emoji: '💼', amount: 8_500_000, account: 'bank', type: 'pemasukan' },
  { day: 2, title: 'Bayar kos', category: 'Tempat Tinggal', emoji: '🏠', amount: 1_800_000, account: 'bank', type: 'pengeluaran' },
  { day: 3, title: 'Isi saldo dompet digital', category: 'Transfer', emoji: '🔁', amount: 2_700_000, account: 'bank', type: 'transfer', toAccount: 'ewallet' },
  { day: 3, title: 'Setor tabungan mudik', category: 'Transfer', emoji: '🔁', amount: 1_000_000, account: 'bank', type: 'transfer', toAccount: 'tabungan' },
  { day: 5, title: 'Paket internet', category: 'Tagihan', emoji: '📶', amount: 150_000, account: 'ewallet', type: 'pengeluaran' },
  { day: 8, title: 'Token listrik', category: 'Tagihan', emoji: '💡', amount: 200_000, account: 'ewallet', type: 'pengeluaran' },
  { day: 12, title: 'Langganan musik', category: 'Hiburan', emoji: '🎧', amount: 54_990, account: 'ewallet', type: 'pengeluaran' },
  { day: 1, title: 'Tarik tunai', category: 'Transfer', emoji: '🔁', amount: 1_500_000, account: 'bank', type: 'transfer', toAccount: 'tunai' },
  { day: 20, title: 'Cicilan HP', category: 'Cicilan', emoji: '📱', amount: 625_000, account: 'bank', type: 'pengeluaran' },
  { day: 25, title: 'Freelance desain', category: 'Pendapatan Lain', emoji: '🎨', amount: 1_200_000, account: 'bank', type: 'pemasukan' },
];

// mulberry32 — cukup untuk data contoh yang sama setiap kali dibuka.
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const round500 = (n: number) => Math.round(n / 500) * 500;

/** Transaksi rekaan dari awal bulan ke-2 sebelumnya sampai hari ini (jam sekarang), terbaru dulu. */
export const buildDemoTransactions = (now: Date): DemoTx[] => {
  const r = rng(20261027);
  const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const out: DemoTx[] = [];
  const nowHm = now.getHours() * 60 + now.getMinutes();
  const pickSpend = () => {
    const total = SPEND.reduce((s, x) => s + x.weight, 0);
    let v = r() * total;
    for (const x of SPEND) {
      v -= x.weight;
      if (v <= 0) return x;
    }
    return SPEND[0];
  };
  let n = 0;
  for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
    const date = ymd(d);
    const isToday = date === ymd(now);
    for (const m of MONTHLY) {
      if (d.getDate() !== m.day) continue;
      const hm = 9 * 60 + Math.floor(r() * 60);
      if (isToday && hm > nowHm) continue;
      out.push({ id: `d${n++}`, date, time: `${String(Math.floor(hm / 60)).padStart(2, '0')}:${String(hm % 60).padStart(2, '0')}`, title: m.title, category: m.category, type: m.type, amount: m.amount, account: m.account, toAccount: m.toAccount, emoji: m.emoji });
    }
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    const count = (weekend ? 2 : 3) + Math.floor(r() * 3);
    for (let i = 0; i < count; i++) {
      const s = pickSpend();
      const hm = s.hours[0] * 60 + Math.floor(r() * ((s.hours[1] - s.hours[0]) * 60 + 59));
      if (isToday && hm > nowHm) continue;
      out.push({
        id: `d${n++}`,
        date,
        time: `${String(Math.floor(hm / 60)).padStart(2, '0')}:${String(hm % 60).padStart(2, '0')}`,
        title: s.title,
        category: s.category,
        type: 'pengeluaran',
        amount: round500(s.min + r() * (s.max - s.min)),
        account: s.account,
        emoji: s.emoji,
      });
    }
  }
  return out.sort((a, b) => (a.date === b.date ? b.time.localeCompare(a.time) : b.date.localeCompare(a.date)));
};

/** Saldo akhir per rekening = saldo awal + semua mutasi (transfer memindah, bukan pengeluaran). */
export const demoBalances = (txs: DemoTx[]) => {
  const bal = new Map(DEMO_ACCOUNTS.map((a) => [a.id, a.start]));
  for (const t of txs) {
    if (t.type === 'pemasukan') bal.set(t.account, (bal.get(t.account) ?? 0) + t.amount);
    else if (t.type === 'pengeluaran') bal.set(t.account, (bal.get(t.account) ?? 0) - t.amount);
    else if (t.toAccount) {
      bal.set(t.account, (bal.get(t.account) ?? 0) - t.amount);
      bal.set(t.toAccount, (bal.get(t.toAccount) ?? 0) + t.amount);
    }
  }
  return bal;
};

export const sumBy = (txs: DemoTx[], type: DemoType) => txs.reduce((s, t) => (t.type === type ? s + t.amount : s), 0);

export const DEMO_CATEGORIES = {
  pengeluaran: ['Makan & Minum', 'Transportasi', 'Belanja Harian', 'Hiburan', 'Tagihan', 'Tempat Tinggal', 'Cicilan', 'Lainnya'],
  pemasukan: ['Gaji', 'Pendapatan Lain', 'Bonus'],
} as const;

const CATEGORY_EMOJI: Record<string, string> = {
  'Makan & Minum': '🍛', Transportasi: '🛵', 'Belanja Harian': '🛒', Hiburan: '🎬', Tagihan: '💡', 'Tempat Tinggal': '🏠',
  Cicilan: '📱', Lainnya: '🧾', Gaji: '💼', 'Pendapatan Lain': '🎨', Bonus: '🎁', Transfer: '🔁',
};
export const emojiFor = (category: string) => CATEGORY_EMOJI[category] ?? '🧾';

// Data contoh yang diotak-atik pengunjung disimpan di browser ini saja
// (tidak ikut ke akun — ini data rekaan). `base` = tanggal saat disimpan:
// besoknya data yang belum diubah dibangkitkan ulang, yang sudah diubah
// digeser maju sejumlah hari yang lewat supaya "Hari ini" tidak kosong terus.
const DEMO_KEY = 'leosiqra-demo-v2';
interface DemoStore {
  base: string;
  edited: boolean;
  txs: DemoTx[];
}
const DAY = 86400e3;
const shiftDate = (date: string, days: number) => {
  const [y, m, d] = date.split('-').map(Number);
  return ymd(new Date(y, m - 1, d + days));
};

/** Data contoh untuk hari ini: dari perangkat ini kalau ada, atau dibangkitkan baru. */
export const loadDemo = (now: Date): { txs: DemoTx[]; edited: boolean } => {
  const today = ymd(now);
  try {
    const raw = window.localStorage.getItem(DEMO_KEY);
    const v = raw ? (JSON.parse(raw) as DemoStore) : null;
    if (v && Array.isArray(v.txs) && /^\d{4}-\d{2}-\d{2}$/.test(v.base) && v.edited) {
      const [y, m, d] = v.base.split('-').map(Number);
      const days = Math.max(0, Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(y, m - 1, d).getTime()) / DAY));
      const txs = v.txs
        .filter((t) => t && typeof t.amount === 'number' && Number.isInteger(t.amount) && t.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(t.date))
        .map((t) => (days ? { ...t, date: shiftDate(t.date, days) } : t));
      if (days) saveDemo(txs, true, now);
      return { txs, edited: true };
    }
    if (v && v.base === today && Array.isArray(v.txs)) return { txs: v.txs, edited: false };
  } catch {
    // data rusak / localStorage diblokir → bangkitkan ulang
  }
  const txs = buildDemoTransactions(now);
  saveDemo(txs, false, now);
  return { txs, edited: false };
};
export const saveDemo = (txs: DemoTx[], edited: boolean, now: Date) => {
  try {
    window.localStorage.setItem(DEMO_KEY, JSON.stringify({ base: ymd(now), edited, txs } satisfies DemoStore));
  } catch {
    // mode privat / penuh — perubahan tetap berlaku sampai halaman ditutup
  }
};
export const clearDemo = () => {
  try {
    window.localStorage.removeItem(DEMO_KEY);
    window.localStorage.removeItem('leosiqra-demo-v1');
  } catch {
    // abaikan
  }
};
export const sortTx = (txs: DemoTx[]) =>
  [...txs].sort((a, b) => (a.date === b.date ? b.time.localeCompare(a.time) : b.date.localeCompare(a.date)));

/** Id unik untuk transaksi contoh yang ditambah pengunjung. */
export const newDemoId = () => `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
