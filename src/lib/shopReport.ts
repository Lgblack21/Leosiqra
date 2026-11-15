import { cloudflareApi } from './cloudflare-api';

// Laporan Usahaku — data dari GET /api/member/shops/:id/report (Worker, baca saja) lalu
// diringkas di perangkat untuk halaman Laporan, PDF (cetak), dan Excel.

// cost = modal per satuan yang DIKUNCI saat penjualan dicatat (R2 HPP); tidak ada = belum punya modal.
export type ReportItem = { name: string; price: number; qty: number; key?: string; cost?: number; costSrc?: 'manual' | 'resep' };
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
  // Buku usaha (migrasi 0045) — tidak ada di penjualan lama (transaksi pribadi).
  channel?: string | null;
  channelType?: 'langsung' | 'marketplace' | null;
  payMethod?: string | null;
  fee?: number;
  status?: 'selesai' | 'menunggu';
  reseller?: boolean;
  /** Total modal penjualan (lengkap). Tidak ada = sebagian/semua baris belum punya modal. */
  cogs?: number;
  cogsSrc?: 'transaksi' | 'produk';
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
  /** Modal per satuan SAAT INI — hanya untuk "perkirakan modal" penjualan tanpa modal tercatat. */
  costs?: { byKey: Record<string, number>; byName: Record<string, number> };
};

/** Kategori biaya yang dianggap pembelian persediaan (sudah dihitung lewat HPP saat barangnya laku). */
export const STOCK_PURCHASE_KIND = 'Bahan & Stok';
export const MARKETPLACE_FEE_KIND = 'Potongan marketplace';

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

/**
 * Periode pembanding dengan panjang setara tepat sebelumnya. Rentang yang mulai tanggal 1 dibandingkan
 * dengan bulan sebelumnya pada tanggal yang sama (1–15 Nov ↔ 1–15 Okt; Okt penuh ↔ Sep penuh), rentang
 * 1 Jan–hari ini dengan tahun lalu; selain itu digeser mundur sepanjang jumlah harinya.
 */
export const previousRange = (from: string, to: string) => {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  const ymd = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, Math.min(d, lastDay(y, m)))).toISOString().slice(0, 10);
  if (fd === 1 && fm === 1 && fy === ty) return { from: `${fy - 1}-01-01`, to: ymd(ty - 1, tm, td) };
  if (fd === 1) {
    const months = (ty - fy) * 12 + (tm - fm) + 1;
    const fullEnd = td === lastDay(ty, tm);
    const pf = new Date(Date.UTC(fy, fm - 1 - months, 1));
    const pt = new Date(Date.UTC(ty, tm - 1 - months, 1));
    const [py, pm] = [pt.getUTCFullYear(), pt.getUTCMonth() + 1];
    return { from: pf.toISOString().slice(0, 10), to: ymd(py, pm, fullEnd ? lastDay(py, pm) : td) };
  }
  const n = daysBetween(from, to);
  return { from: addDays(from, -n), to: addDays(from, -1) };
};
/** Perubahan relatif (0.12 = naik 12%). null kalau pembanding nol. */
export const growth = (now: number, before: number) => (before > 0 ? (now - before) / before : null);

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
export function summarize(r: ShopReport, opts: { estimate?: boolean } = {}) {
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

  // Per jalur jualan (buku usaha). Penjualan lama tanpa jalur → "Kasir" / "Website".
  const chMap = new Map<string, { name: string; type: 'langsung' | 'marketplace' | null; trx: number; omzet: number; fee: number }>();
  for (const s of r.sales) {
    const name = s.channel || (s.source === 'website' ? 'Website' : 'Kasir');
    const cur = chMap.get(name.toLowerCase()) ?? { name, type: s.channelType ?? null, trx: 0, omzet: 0, fee: 0 };
    cur.trx++;
    cur.omzet += s.amount;
    cur.fee += s.fee ?? 0;
    chMap.set(name.toLowerCase(), cur);
  }
  const channels = [...chMap.values()].map((x) => ({ ...x, net: x.omzet - x.fee })).sort((a, b) => b.omzet - a.omzet);
  // (modal per jalur ditambahkan setelah HPP dihitung, di bawah)

  // Penjualan marketplace yang uangnya belum cair (status 'menunggu') di periode ini.
  const waiting = r.sales.filter((s) => s.status === 'menunggu');
  const pending = {
    count: waiting.length,
    amount: waiting.reduce((a, s) => a + s.amount, 0),
    net: waiting.reduce((a, s) => a + s.amount - (s.fee ?? 0), 0),
    oldest: waiting.reduce<string | null>((a, s) => (a === null || s.date < a ? s.date : a), null),
  };

  // ── HPP (modal barang terjual) ─────────────────────────────────────────────
  // Modal tercatat dipakai apa adanya. Baris tanpa modal: kalau estimate, pakai modal produk SAAT INI
  // (ditandai perkiraan); kalau tidak, baris itu tidak punya modal dan masuk "cakupan" yang kurang.
  const now = r.costs ?? { byKey: {}, byName: {} };
  const guess = (key: string | undefined, name: string) =>
    opts.estimate ? ((key ? now.byKey[key] : undefined) ?? now.byName[name.trim().toLowerCase()]) : undefined;
  let hpp = 0;
  let coveredOmzet = 0;
  let estimated = false;
  const prodCost = new Map<string, { cost: number; revenue: number }>();
  const missing = new Map<string, { name: string; omzet: number }>();
  const saleCostOf = new Map<string, number>();
  const salePartial = new Set<string>(); // penjualan yang sebagian/seluruh barisnya tanpa modal
  for (const s of r.sales) {
    if (typeof s.cogs === 'number') {
      hpp += s.cogs;
      coveredOmzet += s.amount;
      saleCostOf.set(s.id, s.cogs);
      // Modal per transaksi (tanpa rincian) / modal lengkap: bagi ke produk sesuai porsi omzet baris.
      const ls = saleLines(s);
      const tot = ls.reduce((a, l) => a + (s.items.length ? l.price * l.qty : s.amount), 0) || 1;
      for (const l of ls) {
        const rev = s.items.length ? l.price * l.qty : s.amount;
        const share = l.cost !== undefined && s.cogsSrc !== 'transaksi' ? l.cost * l.qty : (s.cogs * rev) / tot;
        const k = l.name.toLowerCase();
        const cur = prodCost.get(k) ?? { cost: 0, revenue: 0 };
        cur.cost += share;
        cur.revenue += rev;
        prodCost.set(k, cur);
      }
      continue;
    }
    let sc = 0;
    for (const l of saleLines(s)) {
      const rev = s.items.length ? l.price * l.qty : s.amount;
      let unit = l.cost;
      if (unit === undefined) {
        unit = guess(l.key, l.name);
        if (unit !== undefined) estimated = true;
      }
      const k = l.name.toLowerCase();
      if (unit === undefined) {
        salePartial.add(s.id);
        const m = missing.get(k) ?? { name: l.name, omzet: 0 };
        m.omzet += rev;
        missing.set(k, m);
        continue;
      }
      const c = unit * l.qty;
      sc += c;
      coveredOmzet += rev;
      const cur = prodCost.get(k) ?? { cost: 0, revenue: 0 };
      cur.cost += c;
      cur.revenue += rev;
      prodCost.set(k, cur);
    }
    hpp += sc;
    saleCostOf.set(s.id, sc);
  }
  hpp = Math.round(hpp);
  const feeExp = r.expenses.filter((e) => e.kind === MARKETPLACE_FEE_KIND).reduce((a, e) => a + e.amount, 0);
  const stockBuy = r.expenses.filter((e) => e.kind === STOCK_PURCHASE_KIND).reduce((a, e) => a + e.amount, 0);
  const operasional = biaya - feeExp - stockBuy;
  const labaKotor = omzet - hpp;
  const labaBersih = labaKotor - feeExp - operasional;
  const coverage = omzet > 0 ? Math.min(1, coveredOmzet / omzet) : 0;
  const productProfit = products
    .map((p) => {
      const pc = prodCost.get(p.name.toLowerCase());
      // Laba produk hanya kalau seluruh omzet produk itu punya modal.
      const full = pc && Math.abs(pc.revenue - p.omzet) < 1;
      return { ...p, cost: pc ? Math.round(pc.cost) : null, laba: full ? Math.round(p.omzet - pc.cost) : null };
    })
    .sort((a, b) => (b.laba ?? -Infinity) - (a.laba ?? -Infinity) || b.omzet - a.omzet);
  const hppInfo = {
    hpp,
    coveredOmzet,
    coverage,
    estimated,
    hasAny: hpp > 0 || coveredOmzet > 0,
    canEstimate: Object.keys(now.byKey).length > 0 || Object.keys(now.byName).length > 0,
    labaKotor,
    feeExp,
    stockBuy,
    operasional,
    labaBersih,
    marginKotor: omzet > 0 ? labaKotor / omzet : 0,
    marginBersih: omzet > 0 ? labaBersih / omzet : 0,
    missing: [...missing.values()].sort((a, b) => b.omzet - a.omzet),
    productProfit,
  };
  // Modal per jalur (dari modal tiap penjualan).
  const chCost = new Map<string, number>();
  const chPartial = new Set<string>();
  for (const s of r.sales) {
    const name = (s.channel || (s.source === 'website' ? 'Website' : 'Kasir')).toLowerCase();
    chCost.set(name, (chCost.get(name) ?? 0) + (saleCostOf.get(s.id) ?? 0));
    if (salePartial.has(s.id)) chPartial.add(name);
  }

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
    channels: channels.map((x) => ({ ...x, cost: Math.round(chCost.get(x.name.toLowerCase()) ?? 0), costFull: !chPartial.has(x.name.toLowerCase()) })),
    pending,
    hppInfo,
  };
}
