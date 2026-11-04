import type { Transaction } from '@/lib/services/transactionService';
import { isInvestmentFlow, toLocalDateString } from '@/lib/utils';
import { matchCatalog, SUB_CATALOG_BY_KEY, type CatalogEntry, type SubCategory, type SubCycle } from '@/lib/subscriptionCatalog';

// Langgananku: tipe, jadwal tagihan, dan Radar (deteksi langganan dari
// transaksi). Jadwal = anchor + kelipatan siklus; tanggal 31 di bulan pendek →
// hari terakhir bulan itu. Rumus ini WAJIB sama dengan SQL
// sendSubscriptionReminders di Worker.

export type SubStatus = 'aktif' | 'coba' | 'batal';
export type Subscription = {
  id: string;
  name: string;
  serviceKey?: string;
  domain?: string;
  category: SubCategory;
  amount: number;
  currency: string;
  cycle: SubCycle;
  anchorDate: string;
  accountId?: string;
  status: SubStatus;
  trialEnd?: string;
  note?: string;
  createdAt: string;
};

export const CYCLE_LABEL: Record<SubCycle, string> = { mingguan: 'Mingguan', bulanan: 'Bulanan', '3bulan': 'Tiap 3 bulan', tahunan: 'Tahunan' };
export const CYCLE_SHORT: Record<SubCycle, string> = { mingguan: '/mgg', bulanan: '/bln', '3bulan': '/3 bln', tahunan: '/thn' };

const DAY = 86400e3;
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const toDays = (s: string) => Date.parse(`${s}T00:00:00Z`) / DAY;
export const daysBetween = (from: string, to: string) => Math.round(toDays(to) - toDays(from));
export const addDaysStr = (s: string, n: number) => new Date(Date.parse(`${s}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

/** Tanggal tagih ke-k dari anchor (k ≥ 0). */
const occurrence = (anchor: string, cycle: SubCycle, k: number) => {
  if (cycle === 'mingguan') return addDaysStr(anchor, 7 * k);
  const step = cycle === 'bulanan' ? 1 : cycle === '3bulan' ? 3 : 12;
  const [ay, am, ad] = anchor.split('-').map(Number);
  const total = am - 1 + step * k;
  const y = ay + Math.floor(total / 12);
  const m = (total % 12) + 1;
  return iso(y, m, Math.min(ad, lastDay(y, m)));
};

/** Tagihan berikutnya pada/sesudah `from` (default hari ini). */
export function nextCharge(anchor: string, cycle: SubCycle, from = toLocalDateString()): string {
  if (anchor >= from) return anchor;
  // Tebakan awal k lalu maju sampai ≥ from (maks beberapa langkah).
  const approxDays = { mingguan: 7, bulanan: 30.44, '3bulan': 91.31, tahunan: 365.25 }[cycle];
  let k = Math.max(0, Math.floor(daysBetween(anchor, from) / approxDays) - 1);
  let d = occurrence(anchor, cycle, k);
  while (d < from) d = occurrence(anchor, cycle, ++k);
  return d;
}

/** Semua tanggal tagih dalam rentang [from, to]. */
export function chargesBetween(anchor: string, cycle: SubCycle, from: string, to: string): string[] {
  const out: string[] = [];
  let d = nextCharge(anchor, cycle, from);
  let guard = 0;
  while (d <= to && guard++ < 60) {
    out.push(d);
    d = nextCharge(anchor, cycle, addDaysStr(d, 1));
  }
  return out;
}

/** Setara per bulan (untuk total & perbandingan). */
export const monthlyEquivalent = (amount: number, cycle: SubCycle) =>
  cycle === 'mingguan' ? (amount * 52) / 12 : cycle === '3bulan' ? amount / 3 : cycle === 'tahunan' ? amount / 12 : amount;

export const subLogoUrl = (domain?: string) => (domain ? `/api/logo?d=${encodeURIComponent(domain)}` : null);

// ── Radar ───────────────────────────────────────────────────────────────────
// Deterministik (tanpa AI, tanpa kirim data ke luar): pengeluaran 30 hari
// terakhir (keputusan Bos 2026-11-04) → (1) cocok katalog = "pasti", (2) nama sama yang muncul ≥2× dengan
// nominal mirip (±15%) & jarak teratur (mingguan/bulanan) = "mungkin".

export type RadarHit = {
  id: string; // kunci stabil kandidat
  name: string;
  serviceKey?: string;
  domain?: string;
  category: SubCategory;
  color?: string;
  amount: number; // nominal terakhir (IDR)
  cycle: SubCycle;
  anchorDate: string; // tanggal bayar terakhir
  dates: string[]; // semua tanggal bayar yang ditemukan (untuk animasi)
  confidence: 'pasti' | 'mungkin';
  accountId?: string;
};

export const RADAR_DAYS = 30;
const idr = (t: Transaction) => Number(t.amountIDR) || Number(t.amount) || 0;
const normName = (s: string) =>
  s.toLowerCase().replace(/\[[^\]]*\]/g, ' ').replace(/[0-9#*.,:/\\-]+/g, ' ').replace(/\b(bayar|pembayaran|langganan|tagihan|payment|subscription|via|ke|dari)\b/g, ' ').replace(/\s+/g, ' ').trim();

export function radarScan(transactions: Transaction[], existing: Subscription[], today = toLocalDateString()): RadarHit[] {
  const from = addDaysStr(today, -(RADAR_DAYS - 1));
  const spend = transactions
    .filter((t) => t.type === 'pengeluaran' && !isInvestmentFlow(t) && !t.relatedType)
    .map((t) => ({ t, day: toLocalDateString(new Date(t.date)), text: `${t.note ?? ''} ${t.subCategory ?? ''} ${t.category ?? ''}` }))
    .filter((x) => x.day >= from && x.day <= today && idr(x.t) > 0)
    .sort((a, b) => a.day.localeCompare(b.day));
  const haveKeys = new Set(existing.filter((s) => s.status !== 'batal').map((s) => s.serviceKey).filter(Boolean));
  const haveNames = new Set(existing.filter((s) => s.status !== 'batal').map((s) => normName(s.name)));

  const hits: RadarHit[] = [];
  const used = new Set<Transaction>();

  // 1) Cocok katalog.
  const byKey = new Map<string, { entry: CatalogEntry; rows: typeof spend }>();
  for (const x of spend) {
    const entry = matchCatalog(x.text);
    if (!entry) continue;
    used.add(x.t);
    const g = byKey.get(entry.key) ?? { entry, rows: [] };
    g.rows.push(x);
    byKey.set(entry.key, g);
  }
  for (const { entry, rows } of byKey.values()) {
    if (haveKeys.has(entry.key) || haveNames.has(normName(entry.name))) continue;
    const last = rows[rows.length - 1];
    hits.push({
      id: `k:${entry.key}`,
      name: entry.name,
      serviceKey: entry.key,
      domain: entry.domain,
      category: entry.category,
      color: entry.color,
      amount: Math.round(idr(last.t)),
      cycle: guessCycle(rows.map((r) => r.day)) ?? entry.cycle,
      anchorDate: last.day,
      dates: rows.map((r) => r.day),
      confidence: 'pasti',
      accountId: last.t.accountId || undefined,
    });
  }

  // 2) Pola berulang (nama sama, nominal mirip, jarak teratur).
  const byName = new Map<string, typeof spend>();
  for (const x of spend) {
    if (used.has(x.t)) continue;
    const key = normName(x.t.note || '');
    if (key.length < 3) continue;
    const list = byName.get(key) ?? [];
    list.push(x);
    byName.set(key, list);
  }
  for (const [key, rows] of byName) {
    if (rows.length < 2 || haveNames.has(key)) continue;
    const amounts = rows.map((r) => idr(r.t));
    const last = amounts[amounts.length - 1];
    if (!amounts.every((a) => Math.abs(a - last) <= last * 0.15)) continue;
    const cycle = guessCycle(rows.map((r) => r.day));
    if (!cycle) continue;
    const lastRow = rows[rows.length - 1];
    const label = (lastRow.t.note || key).trim().slice(0, 60);
    hits.push({
      id: `n:${key}`,
      name: label.charAt(0).toUpperCase() + label.slice(1),
      category: 'Lainnya',
      amount: Math.round(last),
      cycle,
      anchorDate: lastRow.day,
      dates: rows.map((r) => r.day),
      confidence: 'mungkin',
      accountId: lastRow.t.accountId || undefined,
    });
  }

  return hits.sort((a, b) => (a.confidence === b.confidence ? monthlyEquivalent(b.amount, b.cycle) - monthlyEquivalent(a.amount, a.cycle) : a.confidence === 'pasti' ? -1 : 1));
}

/** Tebak siklus dari jarak antar tanggal bayar (null kalau tidak teratur). */
function guessCycle(days: string[]): SubCycle | null {
  const uniq = [...new Set(days)];
  if (uniq.length < 2) return null;
  const gaps = uniq.slice(1).map((d, i) => daysBetween(uniq[i], d));
  if (gaps.every((g) => g >= 6 && g <= 8)) return 'mingguan';
  if (gaps.every((g) => g >= 26 && g <= 35)) return 'bulanan';
  return null;
}

export const catalogFor = (s: Pick<Subscription, 'serviceKey'>) => (s.serviceKey ? SUB_CATALOG_BY_KEY.get(s.serviceKey) : undefined);
