import type { Transaction } from '@/lib/services/transactionService';
import { CICILAN_RE, isIncome, isSpend, rp, type Metrics } from '@/lib/kanvas/data';
import { isInvestmentFlow, toLocalDateString } from '@/lib/utils';

// Rapor Keuangan: tujuh indikator dari catatan & Kekayaan user sendiri, dinilai 0–100 lalu digabung
// menjadi satu nilai dan huruf. Batas memakai pedoman umum perencanaan keuangan (bukan nasihat pribadi).

export type MonthRow = {
  key: string;
  label: string;
  income: number;
  expense: number;
  cicilan: number;
  invest: number;
  days: number;
};
export type IndicatorId = 'arus' | 'tabung' | 'darurat' | 'cicilan' | 'utang' | 'produktif' | 'catat';
export type Indicator = {
  id: IndicatorId;
  label: string;
  value: string; // angka utama, mis. "18%"
  target: string; // mis. "minimal 10%"
  detail: string; // rumus dengan angka asli
  score: number | null; // 0–100, null = belum bisa dihitung
  history?: (number | null)[]; // nilai per bulan (lama → baru) untuk indikator berbasis arus
  why: string;
  fix: string;
  href: string;
  linkLabel: string;
};
export type Rapor = {
  mode: 'penuh' | 'perkiraan' | 'kosong';
  basis: string;
  months: MonthRow[];
  indicators: Indicator[];
  score: number | null;
  grade: Grade | null;
  prevScore: number | null;
  income: number;
  expense: number;
  cicilan: number;
  daysLogged: number;
};
export type Grade = {
  letter: 'A' | 'B' | 'C' | 'D' | 'E';
  label: string;
  tone: 'emerald' | 'teal' | 'amber' | 'orange' | 'rose';
};

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const idr = (t: Transaction) => Number(t.amountIDR) || Number(t.amount) || 0;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const clamp = (x: number) => Math.max(0, Math.min(100, Math.round(x)));
// Skor naik linear dari `bad` (0) ke `good` (100). Untuk "makin kecil makin baik", isi bad > good.
const lin = (x: number, bad: number, good: number) => clamp(((x - bad) / (good - bad)) * 100);

export const gradeOf = (s: number): Grade =>
  s >= 85
    ? { letter: 'A', label: 'Sangat sehat', tone: 'emerald' }
    : s >= 70
      ? { letter: 'B', label: 'Sehat', tone: 'teal' }
      : s >= 55
        ? { letter: 'C', label: 'Cukup', tone: 'amber' }
        : s >= 40
          ? { letter: 'D', label: 'Perlu perhatian', tone: 'orange' }
          : { letter: 'E', label: 'Waspada', tone: 'rose' };

export const WEIGHTS: Record<IndicatorId, number> = {
  arus: 1.2,
  tabung: 1.2,
  darurat: 1.3,
  cicilan: 1.1,
  utang: 1,
  produktif: 0.7,
  catat: 0.5,
};

export function monthRows(tx: Transaction[], now = new Date(), count = 6): MonthRow[] {
  const rows: MonthRow[] = [];
  for (let i = count; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = toLocalDateString(d).slice(0, 7);
    rows.push({
      key,
      label: `${MONTH[d.getMonth()]}${i === 0 ? '*' : ''}`,
      income: 0,
      expense: 0,
      cicilan: 0,
      invest: 0,
      days: 0,
    });
  }
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const days = new Map<string, Set<string>>();
  for (const t of tx) {
    const day = toLocalDateString(new Date(t.date));
    const r = byKey.get(day.slice(0, 7));
    if (!r) continue;
    if (!days.has(r.key)) days.set(r.key, new Set());
    days.get(r.key)!.add(day);
    if (isIncome(t)) r.income += idr(t);
    else if (isSpend(t)) {
      r.expense += idr(t);
      if (CICILAN_RE.test(t.category || '')) r.cicilan += idr(t);
    } else if (t.type === 'pengeluaran' && t.relatedType === 'debt') r.cicilan += idr(t);
    else if (t.type === 'pengeluaran' && isInvestmentFlow(t)) r.invest += idr(t);
  }
  for (const r of rows) r.days = days.get(r.key)?.size ?? 0;
  return rows;
}

type Flow = { income: number; expense: number; cicilan: number };

function indicators(
  flow: Flow | null,
  m: Metrics,
  rows: MonthRow[],
  history: boolean,
  daysLogged: number,
): Indicator[] {
  const full = rows.slice(0, -1);
  const hist = (f: (r: MonthRow) => number | null) =>
    history ? full.map((r) => (r.income || r.expense ? f(r) : null)) : undefined;

  const out: Indicator[] = [];
  if (flow) {
    const { income, expense, cicilan } = flow;
    const left = income - expense;
    out.push({
      id: 'arus',
      label: 'Arus kas positif',
      value: income ? `${pct(expense / income)} terpakai` : '—',
      target: 'pengeluaran di bawah pemasukan',
      detail: `Pengeluaran ${rp(expense)} dari pemasukan ${rp(income)} per bulan.`,
      score: income ? lin(expense / income, 1.1, 0.8) : expense ? 0 : null,
      history: hist((r) => (r.income ? lin(r.expense / r.income, 1.1, 0.8) : 0)),
      why: 'Kalau pengeluaran melebihi pemasukan, selisihnya pasti ditutup dari tabungan atau utang.',
      fix: 'Lihat kategori terbesar di Jejak Uang dan pangkas yang paling mudah dikurangi.',
      href: '/membership/jejak-uang',
      linkLabel: 'Buka Jejak Uang',
    });
    out.push({
      id: 'tabung',
      label: 'Menabung rutin',
      value: income ? pct(Math.max(0, left) / income) : '—',
      target: 'minimal 10%, ideal 20%',
      detail: `Sisa ${rp(left)} dari pemasukan ${rp(income)} per bulan (tanpa beli investasi).`,
      score: income ? lin(left / income, 0, 0.2) : null,
      history: hist((r) => (r.income ? lin((r.income - r.expense) / r.income, 0, 0.2) : 0)),
      why: 'Menyisihkan dari awal membuat tujuan jangka panjang (rumah, pensiun) benar-benar terkumpul.',
      fix: 'Jadwalkan setoran tabungan otomatis tepat setelah gajian.',
      href: '/membership/recurring',
      linkLabel: 'Atur transaksi rutin',
    });
    out.push({
      id: 'darurat',
      label: 'Dana darurat',
      value: expense
        ? `${(m.liquid / expense).toLocaleString('id-ID', { maximumFractionDigits: 1 })}× pengeluaran`
        : '—',
      target: 'minimal 3×, ideal 6×',
      detail: `Dana siap pakai ${rp(m.liquid)} (rekening, dompet, tabungan, deposito) ÷ pengeluaran ${rp(expense)}.`,
      score: expense ? lin(m.liquid / expense, 0, 6) : null,
      why: 'Bantalan saat kehilangan penghasilan atau sakit, tanpa harus berutang.',
      fix: 'Mulai papan Dana Darurat di Kanvas untuk menghitung target & setoran bulanan.',
      href: '/membership/kanvas?baru=darurat',
      linkLabel: 'Rencanakan di Kanvas',
    });
    out.push({
      id: 'cicilan',
      label: 'Cicilan dibanding pemasukan',
      value: income ? pct(cicilan / income) : '—',
      target: 'maksimal 30%',
      detail: `Bayar utang & cicilan ${rp(cicilan)} dari pemasukan ${rp(income)} per bulan.`,
      score: income ? lin(cicilan / income, 0.45, 0.15) : cicilan ? 0 : null,
      history: hist((r) => (r.income ? lin(r.cicilan / r.income, 0.45, 0.15) : 0)),
      why: 'Cicilan yang terlalu besar membuat ruang menabung dan bertahan saat darurat menyempit.',
      fix: 'Tahan cicilan baru sampai porsinya di bawah 30% pemasukan.',
      href: '/membership/kanvas?baru=lunas-utang',
      linkLabel: 'Rencana Lunas Utang',
    });
  }
  out.push({
    id: 'utang',
    label: 'Utang dibanding aset',
    value: m.assets ? pct(m.liabilities / m.assets) : m.liabilities ? 'tanpa aset' : '0%',
    target: 'maksimal 50%',
    detail: `Utang & tagihan kartu ${rp(m.liabilities)} ÷ aset di Kekayaan ${rp(m.assets)}.`,
    score: !m.ready ? null : m.assets ? lin(m.liabilities / m.assets, 0.7, 0.2) : m.liabilities ? 0 : 100,
    why: 'Utang yang melebihi separuh aset membuat keuangan rapuh saat ada guncangan.',
    fix: 'Lunasi utang berbunga tinggi lebih dulu dan tahan utang konsumtif baru.',
    href: '/membership/kekayaan',
    linkLabel: 'Buka Kekayaan',
  });
  const netBase = Math.max(m.net, 0);
  out.push({
    id: 'produktif',
    label: 'Harta yang bertumbuh',
    value: netBase ? pct(Math.min(1, m.investments / netBase)) : '—',
    target: 'semakin besar semakin baik (acuan 50%)',
    detail: `Investasi ${rp(m.investments)} dibanding harta bersih ${rp(m.net)}.`,
    score: !m.ready ? null : netBase ? lin(m.investments / netBase, 0, 0.5) : m.net < 0 ? 0 : null,
    why: 'Harta yang diinvestasikan bisa tumbuh mengalahkan inflasi; uang diam nilainya turun pelan-pelan.',
    fix: 'Setelah dana darurat cukup, sisihkan sebagian untuk investasi dari lembaga berizin OJK.',
    href: '/membership/investment',
    linkLabel: 'Buka Investasiku',
  });
  out.push({
    id: 'catat',
    label: 'Kebiasaan mencatat',
    value: `${daysLogged} dari 30 hari`,
    target: 'sebagian besar hari dalam sebulan',
    detail: 'Hari yang punya catatan transaksi dalam 30 hari terakhir.',
    score: lin(daysLogged, 0, 20),
    why: 'Nilai rapor hanya seakurat catatanmu. Catatan yang bolong membuat angka di atas meleset.',
    fix: 'Catat setiap hari — tekan N di web atau pakai Input Cepat di HP.',
    href: '/membership/transactions/input',
    linkLabel: 'Catat transaksi',
  });
  return out;
}

const overall = (ind: Indicator[]) => {
  const scored = ind.filter((i) => i.score !== null);
  if (scored.filter((i) => i.id !== 'catat').length < 2) return null;
  const w = scored.reduce((s, i) => s + WEIGHTS[i.id], 0);
  return Math.round(scored.reduce((s, i) => s + (i.score as number) * WEIGHTS[i.id], 0) / w);
};

export function computeRapor(tx: Transaction[], m: Metrics, now = new Date()): Rapor {
  const rows = monthRows(tx, now);
  const full = rows
    .slice(0, -1)
    .filter((r) => r.income || r.expense)
    .slice(-3);
  const cur = rows[rows.length - 1];
  let mode: Rapor['mode'];
  let flow: Flow | null = null;
  let basis: string;
  if (full.length) {
    mode = 'penuh';
    const n = full.length;
    flow = {
      income: full.reduce((s, r) => s + r.income, 0) / n,
      expense: full.reduce((s, r) => s + r.expense, 0) / n,
      cicilan: full.reduce((s, r) => s + r.cicilan, 0) / n,
    };
    basis = `Rata-rata ${n} bulan penuh terakhir`;
  } else if (cur.income || cur.expense) {
    // Belum ada bulan penuh: perkiraan dari bulan berjalan, pengeluaran disetahunkan ke sebulan penuh.
    mode = 'perkiraan';
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const f = dim / Math.max(1, now.getDate());
    flow = { income: cur.income, expense: cur.expense * f, cicilan: cur.cicilan };
    basis = `Perkiraan dari ${now.getDate()} hari pertama bulan ini`;
  } else {
    mode = 'kosong';
    basis = 'Belum ada catatan pemasukan atau pengeluaran';
  }
  const since = toLocalDateString(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));
  const daysLogged = new Set(tx.map((t) => toLocalDateString(new Date(t.date))).filter((d) => d >= since)).size;
  const ind = indicators(flow, m, rows, mode === 'penuh', daysLogged);
  const score = overall(ind);
  // Nilai bulan lalu (hanya indikator berbasis arus + aset hari ini) untuk panah naik/turun.
  let prevScore: number | null = null;
  const prevRows = rows.slice(0, -1).filter((r) => r.income || r.expense);
  if (mode === 'penuh' && prevRows.length >= 2) {
    const p = prevRows.slice(-4, -1);
    const n = p.length;
    const pf = {
      income: p.reduce((s, r) => s + r.income, 0) / n,
      expense: p.reduce((s, r) => s + r.expense, 0) / n,
      cicilan: p.reduce((s, r) => s + r.cicilan, 0) / n,
    };
    prevScore = overall(indicators(pf, m, rows.slice(0, -1), false, daysLogged));
  }
  return {
    mode,
    basis,
    months: rows,
    indicators: ind,
    score,
    grade: score === null ? null : gradeOf(score),
    prevScore,
    income: flow?.income ?? 0,
    expense: flow?.expense ?? 0,
    cicilan: flow?.cicilan ?? 0,
    daysLogged,
  };
}

// Simulasi "bagaimana kalau": pangkas pengeluaran p (0–0.5) dan tambah pemasukan x per bulan.
export function simulate(r: Rapor, m: Metrics, cut: number, extra: number) {
  const income = r.income + extra;
  const expense = r.expense * (1 - cut);
  const flow = { income, expense, cicilan: r.cicilan };
  const ind = indicators(flow, m, r.months, false, r.daysLogged);
  const left = income - expense;
  const target = expense * 3;
  const monthsToBuffer = m.liquid >= target ? 0 : left > 0 ? Math.ceil((target - m.liquid) / left) : null;
  return { score: overall(ind), left, monthsToBuffer, saveRate: income ? left / income : null };
}
