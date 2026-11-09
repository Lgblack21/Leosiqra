import { cloudflareApi } from './cloudflare-api';

// Laporan Usahaku — data dari GET /api/member/shops/:id/report (Worker, baca saja) lalu
// diringkas di perangkat untuk halaman Laporan, PDF (cetak), dan Excel.

export type ReportItem = { name: string; price: number; qty: number };
export type ReportSale = {
  id: string;
  date: string;
  amount: number;
  account: string | null;
  staff: string | null;
  product: string | null;
  qty: number | null;
  buyer: string | null;
  source: 'kasir' | 'website';
  items: ReportItem[];
  note: string;
};
export type ReportExpense = {
  id: string;
  date: string;
  amount: number;
  account: string | null;
  staff: string | null;
  kind: string;
  item: string | null;
  note: string;
};
export type ReportMaterial = { id: string; name: string; unit: string; stock: number; min_stock: number | null };
export type ReportMove = {
  material_id: string;
  kind: string;
  qty: number;
  cost: number | null;
  note: string | null;
  by_name: string | null;
  date: string;
};
export type ShopReport = {
  shop: {
    id: string;
    name: string;
    tagline: string | null;
    emoji: string | null;
    contact_wa: string | null;
    area: string | null;
    link_url: string | null;
    theme: string;
    logo_url: string | null;
    receipt_footer: string | null;
  };
  range: { from: string; to: string };
  sales: ReportSale[];
  expenses: ReportExpense[];
  materials: ReportMaterial[];
  moves: ReportMove[];
  truncated: boolean;
};

export const fetchShopReport = (id: string, from: string, to: string) =>
  cloudflareApi<ShopReport>(
    `/api/member/shops/${encodeURIComponent(id)}/report?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );

/** Tanggal hari ini menurut WIB (sama dengan Worker). */
export const todayWIB = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const addDays = (d: string, n: number) =>
  new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400e3).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400e3) + 1;

export type RangeId = 'bulan' | 'bulan-lalu' | '3-bulan' | 'tahun' | 'bebas';
export const rangeFor = (id: Exclude<RangeId, 'bebas'>, today = todayWIB()) => {
  const [y, m] = today.split('-').map(Number);
  if (id === 'bulan') return { from: `${today.slice(0, 8)}01`, to: today };
  if (id === 'bulan-lalu') {
    const first = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
    const last = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
    return { from: first, to: last };
  }
  if (id === '3-bulan') return { from: new Date(Date.UTC(y, m - 3, 1)).toISOString().slice(0, 10), to: today };
  return { from: `${y}-01-01`, to: today };
};

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export const tglPendek = (d: string) => `${Number(d.slice(8, 10))} ${BULAN[Number(d.slice(5, 7)) - 1]}`;
export const tglPanjang = (d: string) => `${tglPendek(d)} ${d.slice(0, 4)}`;
export const periodeLabel = (from: string, to: string) =>
  from.slice(0, 4) === to.slice(0, 4)
    ? `${tglPendek(from)} – ${tglPanjang(to)}`
    : `${tglPanjang(from)} – ${tglPanjang(to)}`;

/** Baris item sebuah penjualan. Penjualan lama/website tanpa rincian → 1 baris dari produk & nominal. */
export const saleLines = (s: ReportSale): ReportItem[] => {
  if (s.items.length) return s.items;
  const qty = s.qty && s.qty > 0 ? s.qty : 1;
  return [{ name: s.product || 'Penjualan', price: Math.round(s.amount / qty), qty }];
};

export type Summary = ReturnType<typeof summarize>;
export function summarize(r: ShopReport) {
  const omzet = r.sales.reduce((s, x) => s + x.amount, 0);
  const biaya = r.expenses.reduce((s, x) => s + x.amount, 0);
  const laba = omzet - biaya;
  const trx = r.sales.length;
  const days = daysBetween(r.range.from, r.range.to);

  // Produk terlaris (qty & omzet). Omzet per item = harga × qty; kalau tanpa rincian, nominal penjualan.
  const prod = new Map<string, { name: string; qty: number; omzet: number }>();
  for (const s of r.sales) {
    for (const l of saleLines(s)) {
      const k = l.name.toLowerCase();
      const cur = prod.get(k) ?? { name: l.name, qty: 0, omzet: 0 };
      cur.qty += l.qty;
      cur.omzet += s.items.length ? l.price * l.qty : s.amount;
      prod.set(k, cur);
    }
  }
  const products = [...prod.values()].sort((a, b) => b.omzet - a.omzet || b.qty - a.qty);
  const unit = products.reduce((s, p) => s + p.qty, 0);

  const costMap = new Map<string, number>();
  for (const e of r.expenses) costMap.set(e.kind, (costMap.get(e.kind) ?? 0) + e.amount);
  const costs = [...costMap.entries()].map(([kind, amount]) => ({ kind, amount })).sort((a, b) => b.amount - a.amount);

  const staffMap = new Map<string, { name: string; trx: number; omzet: number }>();
  for (const s of r.sales) {
    const name = s.source === 'website' ? 'Website' : s.staff || 'Pemilik';
    const cur = staffMap.get(name) ?? { name, trx: 0, omzet: 0 };
    cur.trx++;
    cur.omzet += s.amount;
    staffMap.set(name, cur);
  }
  const staff = [...staffMap.values()].sort((a, b) => b.omzet - a.omzet);

  // Grafik: per hari (≤ 62 hari) atau per bulan.
  const monthly = days > 62;
  const buckets: { key: string; label: string; omzet: number; biaya: number }[] = [];
  if (monthly) {
    let k = r.range.from.slice(0, 7);
    while (k <= r.range.to.slice(0, 7)) {
      buckets.push({ key: k, label: `${BULAN[Number(k.slice(5, 7)) - 1]} ${k.slice(2, 4)}`, omzet: 0, biaya: 0 });
      const [y, m] = k.split('-').map(Number);
      k = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
    }
  } else {
    for (let d = r.range.from; d <= r.range.to; d = addDays(d, 1))
      buckets.push({ key: d, label: d.slice(8, 10), omzet: 0, biaya: 0 });
  }
  const idx = new Map(buckets.map((b, i) => [b.key, i]));
  const keyOf = (d: string) => (monthly ? d.slice(0, 7) : d);
  for (const s of r.sales) {
    const i = idx.get(keyOf(s.date));
    if (i !== undefined) buckets[i].omzet += s.amount;
  }
  for (const e of r.expenses) {
    const i = idx.get(keyOf(e.date));
    if (i !== undefined) buckets[i].biaya += e.amount;
  }
  const best = buckets.reduce(
    (a, b) => (b.omzet > a.omzet ? b : a),
    buckets[0] ?? { key: '', label: '', omzet: 0, biaya: 0 },
  );

  const lowStock = r.materials.filter((m) => m.stock <= 0 || (m.min_stock !== null && m.stock <= m.min_stock));

  return {
    omzet,
    biaya,
    laba,
    margin: omzet > 0 ? laba / omzet : 0,
    trx,
    avg: trx ? Math.round(omzet / trx) : 0,
    perHari: Math.round(omzet / Math.max(1, days)),
    days,
    unit,
    products,
    costs,
    staff,
    buckets,
    monthly,
    best,
    lowStock,
  };
}
