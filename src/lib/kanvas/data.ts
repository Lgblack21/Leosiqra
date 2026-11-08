import type { Transaction } from '@/lib/services/transactionService';
import type { Account } from '@/lib/services/accountService';
import type { NetWorth } from '@/lib/netWorth';
import { isInvestmentFlow, toLocalDateString } from '@/lib/utils';

// Angka "Dari catatanmu" untuk Kanvas. Aturan sama dengan Ringkasan: beli investasi, transfer,
// dan hutang/piutang bukan pemasukan/pengeluaran.
export type Metrics = {
  ready: boolean;
  months: number; // jumlah bulan penuh yang dipakai untuk rata-rata (0–3)
  incomeAvg: number;
  expenseAvg: number;
  leftAvg: number;
  saveRate: number | null; // 0–1
  topExpenses: { name: string; avg: number }[];
  cash: number;
  savings: number;
  investments: number;
  piutang: number;
  goods: number;
  assets: number;
  cards: number;
  hutang: number;
  liabilities: number;
  net: number;
  liquid: number; // kas & rekening (tanpa kartu kredit) + tabungan + deposito
  deposito: number;
  emergencyMonths: number | null;
  // Rata-rata per bulan, dipecah untuk tabel Arus Kas Keluarga.
  split: { kebutuhan: number; cicilan: number; investasi: number; sosial: number };
  readyLabel: string; // "1 Desember 2026" — kapan rata-rata bulan penuh pertama tersedia
  debts: { name: string; remaining: number }[];
};

const idr = (t: Transaction) => Number(t.amountIDR) || Number(t.amount) || 0;
export const isSpend = (t: Transaction) => t.type === 'pengeluaran' && !isInvestmentFlow(t) && t.relatedType !== 'debt';
export const isIncome = (t: Transaction) => t.type === 'pemasukan' && !isInvestmentFlow(t) && t.relatedType !== 'debt';
const monthKey = (d: Date | string) => toLocalDateString(new Date(d)).slice(0, 7);

export const SOSIAL_RE = /keluarga|sosial|donasi|zakat|sedekah|infak|kirim|bantuan/i;
export const CICILAN_RE = /cicilan|angsuran|kredit|kpr|pinjaman/i;
const MONTH_LONG = [
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

const lastFullMonths = (now: Date, n: number) =>
  Array.from({ length: n }, (_, i) => monthKey(new Date(now.getFullYear(), now.getMonth() - 1 - i, 1)));

export function computeMetrics(transactions: Transaction[], nw: NetWorth | null, now = new Date()): Metrics {
  // Rata-rata 3 bulan penuh terakhir; bulan tanpa catatan sama sekali tidak ikut dihitung.
  const months = lastFullMonths(now, 3);
  const active = months.filter((m) => transactions.some((t) => (isSpend(t) || isIncome(t)) && monthKey(t.date) === m));
  const n = active.length;
  const inMonths = (t: Transaction) => active.includes(monthKey(t.date));
  const income = transactions.filter((t) => isIncome(t) && inMonths(t)).reduce((s, t) => s + idr(t), 0);
  const spend = transactions.filter((t) => isSpend(t) && inMonths(t));
  const expense = spend.reduce((s, t) => s + idr(t), 0);
  const incomeAvg = n ? Math.round(income / n) : 0;
  const expenseAvg = n ? Math.round(expense / n) : 0;
  const byCat = new Map<string, number>();
  spend.forEach((t) => byCat.set(t.category || 'Lainnya', (byCat.get(t.category || 'Lainnya') ?? 0) + idr(t)));
  const topExpenses = [...byCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, v]) => ({ name, avg: Math.round(v / Math.max(1, n)) }));
  const t = nw?.totals;
  const deposito = (nw?.investments ?? []).filter((i) => i.inv.type === 'Deposito').reduce((s, i) => s + i.value, 0);
  const liquid = (t?.cash ?? 0) + (t?.savings ?? 0) + deposito;
  const avg = (v: number) => (n ? Math.round(v / n) : 0);
  const sosial = spend.filter((x) => SOSIAL_RE.test(x.category || '')).reduce((s2, x) => s2 + idr(x), 0);
  const cicilanCat = spend.filter((x) => CICILAN_RE.test(x.category || '')).reduce((s2, x) => s2 + idr(x), 0);
  const debtPaid = transactions
    .filter((x) => x.type === 'pengeluaran' && x.relatedType === 'debt' && inMonths(x))
    .reduce((s2, x) => s2 + idr(x), 0);
  const invested = transactions
    .filter((x) => x.type === 'pengeluaran' && isInvestmentFlow(x) && inMonths(x))
    .reduce((s2, x) => s2 + idr(x), 0);
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return {
    ready: Boolean(nw),
    months: n,
    incomeAvg,
    expenseAvg,
    leftAvg: incomeAvg - expenseAvg,
    saveRate: incomeAvg > 0 ? (incomeAvg - expenseAvg) / incomeAvg : null,
    topExpenses,
    cash: t?.cash ?? 0,
    savings: t?.savings ?? 0,
    investments: t?.investments ?? 0,
    piutang: t?.piutang ?? 0,
    goods: (t?.items ?? 0) + (t?.collectibles ?? 0),
    assets: t?.assets ?? 0,
    cards: t?.cards ?? 0,
    hutang: t?.hutang ?? 0,
    liabilities: t?.liabilities ?? 0,
    net: t?.net ?? 0,
    liquid,
    deposito,
    emergencyMonths: expenseAvg > 0 ? liquid / expenseAvg : null,
    split: {
      kebutuhan: avg(expense - sosial - cicilanCat),
      cicilan: avg(cicilanCat + debtPaid),
      investasi: avg(invested),
      sosial: avg(sosial),
    },
    readyLabel: `1 ${MONTH_LONG[next.getMonth()]} ${next.getFullYear()}`,
    debts: [
      ...(nw?.hutang ?? []).map((h) => ({ name: h.name, remaining: h.remaining })),
      ...(nw?.cards ?? []).filter((c) => c.used > 0).map((c) => ({ name: c.account.name, remaining: c.used })),
    ].sort((a, b) => b.remaining - a.remaining),
  };
}

// ── Arus uang: sumber pemasukan → rekening → kategori pengeluaran ──────────
export type FlowPeriod = 'bulan' | 'bulan-lalu' | '3-bulan';
export type FlowNode = { id: string; col: 0 | 1 | 2; label: string; value: number; sub?: string };
export type FlowLink = { from: string; to: string; value: number };
export type Flow = { nodes: FlowNode[]; links: FlowLink[]; income: number; expense: number; label: string };

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function computeFlow(
  transactions: Transaction[],
  accounts: Account[],
  period: FlowPeriod,
  now = new Date(),
): Flow {
  const from =
    period === 'bulan'
      ? new Date(now.getFullYear(), now.getMonth(), 1)
      : period === 'bulan-lalu'
        ? new Date(now.getFullYear(), now.getMonth() - 1, 1)
        : new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const to = period === 'bulan-lalu' ? new Date(now.getFullYear(), now.getMonth(), 0) : now;
  const a = toLocalDateString(from);
  const b = toLocalDateString(to);
  const inRange = (t: Transaction) => {
    const k = toLocalDateString(new Date(t.date));
    return k >= a && k <= b;
  };
  const accName = new Map(accounts.map((x) => [x.id, x.name]));
  const accLabel = (id: string) => accName.get(id) ?? 'Rekening lain';
  const inc = transactions.filter((t) => isIncome(t) && inRange(t));
  const exp = transactions.filter((t) => isSpend(t) && inRange(t));

  // Kategori kecil digabung ke "Lainnya" supaya diagram tetap terbaca.
  const topKeys = (list: Transaction[], key: (t: Transaction) => string, max: number) => {
    const m = new Map<string, number>();
    list.forEach((t) => m.set(key(t), (m.get(key(t)) ?? 0) + idr(t)));
    const sorted = [...m.entries()].sort((x, y) => y[1] - x[1]);
    return new Set(sorted.slice(0, sorted.length > max ? max - 1 : max).map(([k]) => k));
  };
  const incTop = topKeys(inc, (t) => t.category || 'Lainnya', 5);
  const expTop = topKeys(exp, (t) => t.category || 'Lainnya', 7);
  const accTop = topKeys([...inc, ...exp], (t) => t.accountId || '-', 6);
  const incKey = (t: Transaction) => `in:${incTop.has(t.category || 'Lainnya') ? t.category || 'Lainnya' : 'Lainnya'}`;
  const expKey = (t: Transaction) => `out:${expTop.has(t.category || 'Lainnya') ? t.category || 'Lainnya' : 'Lainnya'}`;
  const accKey = (t: Transaction) => `acc:${accTop.has(t.accountId || '-') ? t.accountId || '-' : 'lain'}`;

  const nodes = new Map<string, FlowNode>();
  const links = new Map<string, FlowLink>();
  const bump = (id: string, col: 0 | 1 | 2, label: string, v: number) => {
    const n = nodes.get(id) ?? { id, col, label, value: 0 };
    n.value += v;
    nodes.set(id, n);
  };
  const link = (f: string, to: string, v: number) => {
    const k = `${f}>${to}`;
    const l = links.get(k) ?? { from: f, to, value: 0 };
    l.value += v;
    links.set(k, l);
  };
  const accountLabel = (k: string) => (k === 'acc:lain' ? 'Rekening lain' : accLabel(k.slice(4)));
  for (const t of inc) {
    const i = incKey(t);
    const r = accKey(t);
    bump(i, 0, i.slice(3), idr(t));
    bump(r, 1, accountLabel(r), 0);
    link(i, r, idr(t));
  }
  for (const t of exp) {
    const r = accKey(t);
    const o = expKey(t);
    bump(r, 1, accountLabel(r), 0);
    bump(o, 2, o.slice(4), idr(t));
    link(r, o, idr(t));
  }
  // Nilai rekening = yang lebih besar dari masuk/keluar lewat rekening itu.
  for (const n of nodes.values()) {
    if (n.col !== 1) continue;
    const ins = [...links.values()].filter((l) => l.to === n.id).reduce((s, l) => s + l.value, 0);
    const outs = [...links.values()].filter((l) => l.from === n.id).reduce((s, l) => s + l.value, 0);
    n.value = Math.max(ins, outs);
    n.sub = `masuk ${short(ins)} · keluar ${short(outs)}`;
  }
  const label =
    period === 'bulan'
      ? `${MONTH[from.getMonth()]} ${from.getFullYear()} (berjalan)`
      : period === 'bulan-lalu'
        ? `${MONTH[from.getMonth()]} ${from.getFullYear()}`
        : `${MONTH[from.getMonth()]}–${MONTH[now.getMonth()]} ${now.getFullYear()}`;
  return {
    nodes: [...nodes.values()].sort((x, y) => x.col - y.col || y.value - x.value),
    links: [...links.values()],
    income: inc.reduce((s, t) => s + idr(t), 0),
    expense: exp.reduce((s, t) => s + idr(t), 0),
    label,
  };
}

export const short = (n: number) => {
  const a = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (a >= 1e9) return `${sign}${(a / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`;
  if (a >= 1e6) return `${sign}${(a / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
  if (a >= 1e3) return `${sign}${Math.round(a / 1e3).toLocaleString('id-ID')} rb`;
  return `${sign}${Math.round(a)}`;
};
export const rp = (n: number) => `${n < 0 ? '−' : ''}Rp${Math.round(Math.abs(n)).toLocaleString('id-ID')}`;
