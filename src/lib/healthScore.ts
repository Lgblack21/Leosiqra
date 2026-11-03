import type { Transaction } from '@/lib/services/transactionService';
import type { Budget } from '@/lib/services/budgetService';
import { isInvestmentFlow } from '@/lib/utils';

// Skor Kesehatan Finansial 0–100 dari data yang sudah dicatat. Murni
// perhitungan di browser (tanpa data baru di server). Komponen tanpa data
// (mis. belum pasang anggaran) dilewati dan bobotnya dibagi ke yang lain.
// Ini panduan kebiasaan, bukan nasihat keuangan — tampilkan begitu di UI.

export type HealthKey = 'menabung' | 'darurat' | 'anggaran' | 'hutang' | 'konsisten';
export type HealthPart = {
  key: HealthKey;
  label: string;
  weight: number;
  score: number; // 0–100
  detail: string; // angka yang dipakai, mis. "Sisa 12% dari pemasukan"
  tip: string; // saran satu kalimat kalau komponen ini yang terlemah
};
export type HealthResult =
  | { ready: false; reason: string }
  | { ready: true; score: number; grade: 'Sehat' | 'Cukup' | 'Perlu perhatian' | 'Rawan'; parts: HealthPart[]; weakest: HealthPart };

const DAY = 24 * 60 * 60 * 1000;
const clamp = (n: number) => Math.max(0, Math.min(100, n));
const idr = (t: Transaction) => Number(t.amountIDR) || Number(t.amount) || 0;
const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const rupiahShort = (n: number) =>
  `Rp ${new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(Math.round(n))}`;

// Pemasukan/pengeluaran riil: tanpa transfer, beli/jual investasi, dan catatan hutang/piutang.
const isRealIncome = (t: Transaction) => t.type === 'pemasukan' && !isInvestmentFlow(t) && t.relatedType !== 'debt';
const isRealSpend = (t: Transaction) => t.type === 'pengeluaran' && !isInvestmentFlow(t) && t.relatedType !== 'debt';

export function computeHealthScore(input: {
  transactions: Transaction[];
  budgets: Budget[];
  /** Kas di rekening (non-kartu) + tabungan, dalam IDR. */
  liquid: number;
  /** Hutang + tagihan kartu yang belum lunas, dalam IDR. */
  liabilities: number;
  today?: Date;
}): HealthResult {
  const today = input.today ?? new Date();
  const tx = input.transactions;
  if (tx.length === 0) return { ready: false, reason: 'Belum ada catatan. Mulai catat beberapa hari, skornya muncul otomatis.' };
  const first = Math.min(...tx.map((t) => new Date(t.date).getTime()).filter(Number.isFinite));
  if (!Number.isFinite(first) || today.getTime() - first < 14 * DAY) {
    return { ready: false, reason: 'Catat paling tidak 2 minggu dulu supaya skornya akurat.' };
  }

  // 3 bulan penuh terakhir (kalau catatan baru < 3 bulan, pakai bulan yang ada + bulan ini).
  const months: string[] = [];
  for (let i = 1; i <= 3; i++) months.push(ym(new Date(today.getFullYear(), today.getMonth() - i, 1)));
  const firstYm = ym(new Date(first));
  let window = months.filter((m) => m >= firstYm);
  if (window.length === 0) window = [ym(today)];
  const inWindow = (t: Transaction) => window.includes(ym(new Date(t.date)));
  const income = tx.filter((t) => isRealIncome(t) && inWindow(t)).reduce((s, t) => s + idr(t), 0) / window.length;
  const spend = tx.filter((t) => isRealSpend(t) && inWindow(t)).reduce((s, t) => s + idr(t), 0) / window.length;

  const parts: HealthPart[] = [];

  if (income > 0) {
    const rate = (income - spend) / income;
    parts.push({
      key: 'menabung',
      label: 'Menabung',
      weight: 25,
      score: clamp((rate / 0.2) * 100),
      detail: rate >= 0 ? `Sisa ${pct(rate)} dari pemasukan per bulan` : `Pengeluaran lebih besar ${pct(-rate)} dari pemasukan`,
      tip: rate < 0 ? 'Pengeluaran melebihi pemasukan — mulai dari kategori terbesar di "Ke mana uangmu".' : 'Coba sisihkan 10–20% pemasukan di awal bulan, sebelum belanja.',
    });
  }

  if (spend > 0) {
    const monthsCovered = Math.max(0, input.liquid) / spend;
    parts.push({
      key: 'darurat',
      label: 'Dana darurat',
      weight: 25,
      score: clamp((monthsCovered / 6) * 100),
      detail: `Kas & tabungan cukup ${monthsCovered >= 10 ? Math.round(monthsCovered) : monthsCovered.toFixed(1).replace('.', ',')} bulan pengeluaran`,
      tip: 'Kumpulkan dana darurat sampai 3–6× pengeluaran bulanan, mis. lewat Target tabungan.',
    });
  }

  const lastMonth = ym(new Date(today.getFullYear(), today.getMonth() - 1, 1));
  const monthly = input.budgets.filter((b) => b.type === 'pengeluaran' && b.period === 'monthly' && Number(b.amount) > 0);
  if (monthly.length > 0 && lastMonth >= firstYm) {
    const spentLast = new Map<string, number>();
    for (const t of tx) if (isRealSpend(t) && ym(new Date(t.date)) === lastMonth) spentLast.set(t.category, (spentLast.get(t.category) ?? 0) + idr(t));
    const ok = monthly.filter((b) => (spentLast.get(b.category) ?? 0) <= Number(b.amount)).length;
    parts.push({
      key: 'anggaran',
      label: 'Anggaran',
      weight: 20,
      score: clamp((ok / monthly.length) * 100),
      detail: `${ok} dari ${monthly.length} anggaran aman bulan lalu`,
      tip: 'Ada anggaran yang jebol bulan lalu — cek halaman Anggaran, mungkin batasnya perlu realistis.',
    });
  }

  if (income > 0 || input.liabilities > 0) {
    const ratio = income > 0 ? Math.max(0, input.liabilities) / income : input.liabilities > 0 ? 99 : 0;
    parts.push({
      key: 'hutang',
      label: 'Hutang',
      weight: 15,
      score: clamp((1 - Math.min(ratio / 1.5, 1)) * 100),
      detail: input.liabilities > 0 ? `Hutang & tagihan ${rupiahShort(input.liabilities)} (${ratio >= 10 ? '>10' : ratio.toFixed(1).replace('.', ',')}× pemasukan bulanan)` : 'Tidak ada hutang tercatat',
      tip: 'Lunasi hutang/tagihan kartu dengan bunga tertinggi lebih dulu.',
    });
  }

  const start = today.getTime() - 30 * DAY;
  const days = new Set(tx.filter((t) => new Date(t.date).getTime() >= start).map((t) => new Date(t.date).toDateString()));
  parts.push({
    key: 'konsisten',
    label: 'Rajin mencatat',
    weight: 15,
    score: clamp((days.size / 20) * 100),
    detail: `Ada catatan di ${days.size} dari 30 hari terakhir`,
    tip: 'Pasang pengingat malam di Pengaturan → Pengingat supaya tidak ada yang terlewat.',
  });

  const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
  const score = Math.round(parts.reduce((s, p) => s + p.score * p.weight, 0) / totalWeight);
  const weakest = [...parts].sort((a, b) => a.score - b.score || b.weight - a.weight)[0];
  const grade = score >= 80 ? 'Sehat' : score >= 60 ? 'Cukup' : score >= 40 ? 'Perlu perhatian' : 'Rawan';
  return { ready: true, score, grade, parts, weakest };
}
