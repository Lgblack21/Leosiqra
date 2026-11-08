import type { Transaction } from '@/lib/services/transactionService';
import { isInvestmentFlow, toLocalDateString } from '@/lib/utils';

export type StoryRange = 'hari' | 'minggu' | 'bulan';

export type StoryStats = {
  range: StoryRange;
  label: string;
  shortLabel: string;
  total: number;
  count: number;
  income: number;
  prevTotal: number;
  changePct: number | null;
  avgPerDay: number;
  bars: { label: string; total: number; current: boolean }[];
  categories: { name: string; total: number; pct: number }[];
  items: { note: string; category: string; amount: number }[];
  biggest: { note: string; category: string; amount: number } | null;
  noSpendDays: number;
  daysInRange: number;
  verdict: 'hemat' | 'pas' | 'boros' | 'kosong';
  now: Date;
};

const DAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTH = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const idr = (t: Transaction) => Number(t.amountIDR) || Number(t.amount) || 0;
// Sama dengan Ringkasan: beli investasi bukan belanja, hutang/piutang bukan arus kas.
const isSpend = (t: Transaction) => t.type === 'pengeluaran' && !isInvestmentFlow(t);
const isIncome = (t: Transaction) => t.type === 'pemasukan' && !isInvestmentFlow(t);
const dayKey = (d: Date | string) => toLocalDateString(new Date(d));
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const bounds = (range: StoryRange, now: Date, back = 0): [Date, Date] => {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === 'hari') {
    const d = addDays(today, -back);
    return [d, d];
  }
  if (range === 'minggu') {
    const monday = addDays(today, -((today.getDay() + 6) % 7) - 7 * back);
    return [monday, addDays(monday, 6)];
  }
  const first = new Date(today.getFullYear(), today.getMonth() - back, 1);
  return [first, new Date(first.getFullYear(), first.getMonth() + 1, 0)];
};

const sumBetween = (spend: Transaction[], from: Date, to: Date) => {
  const a = toLocalDateString(from);
  const b = toLocalDateString(to);
  return spend.reduce((s, t) => {
    const k = dayKey(t.date);
    return k >= a && k <= b ? s + idr(t) : s;
  }, 0);
};

export function computeStoryStats(transactions: Transaction[], range: StoryRange, now = new Date()): StoryStats {
  const spendAll = transactions.filter(isSpend);
  const [from, to] = bounds(range, now);
  const a = toLocalDateString(from);
  const b = toLocalDateString(to);
  const todayKey = toLocalDateString(now);
  const inRange = (t: Transaction) => {
    const k = dayKey(t.date);
    return k >= a && k <= b;
  };
  const spend = spendAll.filter(inRange);
  const total = spend.reduce((s, t) => s + idr(t), 0);
  const income = transactions.filter((t) => isIncome(t) && inRange(t)).reduce((s, t) => s + idr(t), 0);

  const [pFrom, pTo] = bounds(range, now, 1);
  const prevTotal = sumBetween(spendAll, pFrom, pTo);
  const changePct = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;

  // Hari yang sudah dilewati di rentang ini (bulan berjalan dihitung sampai hari ini).
  const elapsedEnd = to > now ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : to;
  const daysInRange = Math.max(1, Math.round((elapsedEnd.getTime() - from.getTime()) / 864e5) + 1);
  const avgPerDay = Math.round(total / daysInRange);

  const byCat = new Map<string, number>();
  spend.forEach((t) => byCat.set(t.category || 'Lainnya', (byCat.get(t.category || 'Lainnya') ?? 0) + idr(t)));
  const categories = [...byCat.entries()]
    .sort((x, y) => y[1] - x[1])
    .map(([name, v]) => ({ name, total: v, pct: total > 0 ? Math.round((v / total) * 100) : 0 }));

  const sorted = [...spend].sort((x, y) => idr(y) - idr(x));
  const toItem = (t: Transaction) => ({
    note: (t.note || t.subCategory || t.category || 'Belanja').slice(0, 40),
    category: t.category,
    amount: idr(t),
  });
  const items = [...spend]
    .sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime())
    .slice(0, 6)
    .map(toItem);

  // Batang: hari = 7 hari terakhir, minggu = Sen–Min, bulan = per minggu (maks 6).
  let bars: StoryStats['bars'] = [];
  if (range === 'bulan') {
    let start = from;
    let i = 1;
    while (start <= to) {
      const end = addDays(start, 6) > to ? to : addDays(start, 6);
      bars.push({
        label: `M${i}`,
        total: sumBetween(spendAll, start, end),
        current: todayKey >= toLocalDateString(start) && todayKey <= toLocalDateString(end),
      });
      start = addDays(end, 1);
      i++;
    }
  } else {
    const first = range === 'hari' ? addDays(from, -6) : from;
    bars = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(first, i);
      return {
        label: DAY_SHORT[d.getDay()],
        total: sumBetween(spendAll, d, d),
        current: toLocalDateString(d) === todayKey,
      };
    });
  }

  let noSpendDays = 0;
  for (let d = from; d <= elapsedEnd; d = addDays(d, 1)) if (sumBetween(spend, d, d) === 0) noSpendDays++;

  // Penilaian: dibanding rata-rata 4 periode sebelumnya (bukan aturan baku, hanya untuk nada stiker).
  const history = [1, 2, 3, 4]
    .map((n) => {
      const [f, t] = bounds(range, now, n);
      return sumBetween(spendAll, f, t);
    })
    .filter((v) => v > 0);
  const avgPast = history.length ? history.reduce((s, v) => s + v, 0) / history.length : 0;
  const verdict: StoryStats['verdict'] =
    total === 0
      ? 'kosong'
      : !avgPast
        ? 'pas'
        : total <= avgPast * 0.85
          ? 'hemat'
          : total >= avgPast * 1.2
            ? 'boros'
            : 'pas';

  const dateLong = (d: Date) => `${d.getDate()} ${MONTH[d.getMonth()]} ${d.getFullYear()}`;
  const dayName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][now.getDay()];
  const label =
    range === 'hari'
      ? `${dayName}, ${dateLong(now)}`
      : range === 'minggu'
        ? `${from.getDate()}${from.getMonth() !== to.getMonth() ? ` ${MONTH[from.getMonth()].slice(0, 3)}` : ''}–${to.getDate()} ${MONTH[to.getMonth()].slice(0, 3)} ${to.getFullYear()}`
        : `${MONTH[from.getMonth()]} ${from.getFullYear()}`;
  const shortLabel = range === 'hari' ? 'hari ini' : range === 'minggu' ? 'minggu ini' : 'bulan ini';

  return {
    range,
    label,
    shortLabel,
    total,
    count: spend.length,
    income,
    prevTotal,
    changePct,
    avgPerDay,
    bars,
    categories,
    items,
    biggest: sorted[0] ? toItem(sorted[0]) : null,
    noSpendDays,
    daysInRange,
    verdict,
    now,
  };
}
