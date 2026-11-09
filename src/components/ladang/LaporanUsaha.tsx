'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  CalendarDays,
  Download,
  FileSpreadsheet,
  Package,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { KASIR_THEME } from './kasirTheme';
import { formatIDR, cn } from '@/lib/utils';
import {
  fetchShopReport,
  periodeLabel,
  rangeFor,
  saleLines,
  summarize,
  tglPanjang,
  tglPendek,
  todayWIB,
  type RangeId,
  type ShopReport,
} from '@/lib/shopReport';

// Laporan Usahaku per toko (?id=<usaha>): ringkasan, grafik, produk terlaris, biaya, tim,
// rincian, stok — bergaya warna & logo toko. "Unduh PDF" = dialog cetak (pilih Simpan sebagai
// PDF); "Unduh Excel" = .xlsx (exceljs dimuat saat diklik).

const RANGES: { id: Exclude<RangeId, 'bebas'>; label: string }[] = [
  { id: 'bulan', label: 'Bulan ini' },
  { id: 'bulan-lalu', label: 'Bulan lalu' },
  { id: '3-bulan', label: '3 bulan' },
  { id: 'tahun', label: 'Tahun ini' },
];

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) => {
  const [x, y] = [hex(a), hex(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`;
};
const rgba = (c: string, a: number) => `rgba(${hex(c).join(',')},${a})`;
const jt = (n: number) =>
  Math.abs(n) >= 1e9
    ? `${(n / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`
    : Math.abs(n) >= 1e6
      ? `${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`
      : Math.abs(n) >= 1e3
        ? `${Math.round(n / 1e3)} rb`
        : String(Math.round(n));

export function LaporanUsaha({ variant }: { variant: 'web' | 'app' }) {
  const reduce = useReducedMotion();
  const [id, setId] = useState<string | null>(null);
  const [rangeId, setRangeId] = useState<RangeId>('bulan');
  const [custom, setCustom] = useState(() => rangeFor('bulan'));
  const [data, setData] = useState<ShopReport | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [xls, setXls] = useState<'idle' | 'busy' | 'err'>('idle');

  useEffect(() => {
    setId(new URLSearchParams(window.location.search).get('id'));
  }, []);
  const range = rangeId === 'bebas' ? custom : rangeFor(rangeId);
  useEffect(() => {
    if (!id) return;
    let alive = true;

    setLoading(true);
    setErr(null);
    fetchShopReport(id, range.from, range.to)
      .then((r) => alive && setData(r))
      .catch((e) => alive && setErr(e instanceof Error ? e.message : 'Laporan gagal dimuat.'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id, range.from, range.to]);

  const sum = useMemo(() => (data ? summarize(data) : null), [data]);
  const theme = KASIR_THEME[data?.shop.theme ?? 'ungu'] ?? KASIR_THEME.ungu;
  const c = theme.swatch;
  const back = variant === 'app' ? '/app/ladang' : '/membership/ladang';

  const downloadXlsx = async () => {
    if (!data || !sum) return;
    setXls('busy');
    try {
      const { buildShopXlsx } = await import('@/lib/shopReportXlsx');
      const blob = await buildShopXlsx(data, sum, c);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Laporan-${data.shop.name.replace(/[^\w-]+/g, '-')}-${data.range.from}_${data.range.to}.xlsx`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      setXls('idle');
    } catch {
      setXls('err');
    }
  };

  const fade = (i: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.45, delay: 0.05 + i * 0.06, ease: [0.16, 1, 0.3, 1] as const },
        };

  return (
    <div className="lap-root min-h-screen bg-[#f5f6fa] pb-16 text-slate-900">
      <style>{`
        @media print {
          @page { size: A4; margin: 11mm; }
          html, body { background: #fff !important; }
          body * { visibility: hidden !important; }
          #laporan-sheet, #laporan-sheet * { visibility: visible !important; }
          #laporan-sheet { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; border-radius: 0 !important; margin: 0 !important; }
          #laporan-sheet * { -webkit-print-color-adjust: exact; print-color-adjust: exact; animation: none !important; transition: none !important; }
          .lap-avoid { break-inside: avoid; }
          .lap-break { break-before: page; }
          #laporan-sheet h2 { break-after: avoid; }
        }
      `}</style>

      {/* Toolbar (tidak ikut dicetak) */}
      <div className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/95 print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-3 md:px-6">
          <Link
            href={back}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
            aria-label="Kembali ke Usahaku"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="mr-auto min-w-0">
            <p className="fs-11 font-bold uppercase tracking-[0.14em] text-slate-400">Laporan usaha</p>
            <p className="truncate fs-15 font-extrabold">{data?.shop.name ?? 'Memuat…'}</p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!data}
            className="flex h-10 items-center gap-1.5 rounded-full bg-slate-900 px-4 fs-13 font-bold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Download size={15} /> Unduh PDF
          </button>
          <button
            type="button"
            onClick={downloadXlsx}
            disabled={!data || xls === 'busy'}
            className="flex h-10 items-center gap-1.5 rounded-full bg-emerald-600 px-4 fs-13 font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            <FileSpreadsheet size={15} /> {xls === 'busy' ? 'Menyiapkan…' : 'Unduh Excel'}
          </button>
        </div>
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-1.5 px-4 pb-3 md:px-6">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRangeId(r.id)}
              className={cn(
                'h-8 rounded-full px-3.5 fs-12.5 font-bold transition-colors',
                rangeId === r.id ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
              style={rangeId === r.id ? { background: c } : undefined}
            >
              {r.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setCustom(range);
              setRangeId('bebas');
            }}
            className={cn(
              'flex h-8 items-center gap-1 rounded-full px-3.5 fs-12.5 font-bold transition-colors',
              rangeId === 'bebas' ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
            style={rangeId === 'bebas' ? { background: c } : undefined}
          >
            <CalendarDays size={13} /> Pilih tanggal
          </button>
          {rangeId === 'bebas' && (
            <span className="flex items-center gap-1.5 fs-12.5 text-slate-500">
              <input
                type="date"
                value={custom.from}
                max={custom.to}
                onChange={(e) => e.target.value && setCustom((v) => ({ ...v, from: e.target.value }))}
                className="h-8 rounded-lg border border-slate-200 px-2 fs-12.5"
              />
              –
              <input
                type="date"
                value={custom.to}
                min={custom.from}
                max={todayWIB()}
                onChange={(e) => e.target.value && setCustom((v) => ({ ...v, to: e.target.value }))}
                className="h-8 rounded-lg border border-slate-200 px-2 fs-12.5"
              />
            </span>
          )}
          {xls === 'err' && <span className="fs-12 font-semibold text-rose-600">Excel gagal dibuat. Coba lagi.</span>}
        </div>
      </div>

      {err && (
        <div className="mx-auto mt-6 max-w-5xl px-4 md:px-6">
          <p className="rounded-2xl bg-rose-50 p-4 fs-14 font-semibold text-rose-700">{err}</p>
        </div>
      )}
      {!data && !err && (
        <div className="mx-auto mt-6 max-w-5xl space-y-3 px-4 md:px-6">
          {[0, 1, 2].map((k) => (
            <div key={k} className="h-32 animate-pulse rounded-3xl bg-white" />
          ))}
        </div>
      )}

      {data && sum && (
        <div
          id="laporan-sheet"
          className={cn(
            'mx-auto mt-5 max-w-5xl overflow-hidden rounded-[28px] bg-white shadow-[0_30px_70px_-40px_rgba(15,23,42,0.45)] ring-1 ring-slate-200/70 transition-opacity md:mt-8',
            loading && 'opacity-60',
          )}
        >
          {/* Kepala laporan berwarna tema toko */}
          <header
            className="relative overflow-hidden px-6 pb-7 pt-6 text-white md:px-9 md:pt-8"
            style={{ background: `linear-gradient(135deg, ${c} 0%, ${mix(c, '#0f172a', 0.45)} 100%)` }}
          >
            <span
              aria-hidden
              className="absolute -right-16 -top-20 h-64 w-64 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.22), transparent 65%)' }}
            />
            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg">
                  {data.shop.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- logo toko (https/data:) dari pengguna
                    <img src={data.shop.logo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="fsh-30">{data.shop.emoji || '🏪'}</span>
                  )}
                </span>
                <div className="min-w-0">
                  <h1 className="truncate fsh-26 font-extrabold tracking-tight md:fsh-30">{data.shop.name}</h1>
                  {data.shop.tagline && <p className="truncate fs-14 text-white/75">{data.shop.tagline}</p>}
                  <p className="mt-1 fs-12 text-white/60">
                    {[data.shop.area, data.shop.contact_wa && `WA ${data.shop.contact_wa}`, data.shop.link_url]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="fs-11 font-bold uppercase tracking-[0.18em] text-white/70">Laporan usaha</p>
                <p className="fs-16 font-extrabold">{periodeLabel(data.range.from, data.range.to)}</p>
                <p className="fs-11 text-white/60">
                  {sum.days} hari · dibuat {tglPanjang(todayWIB())}
                </p>
              </div>
            </div>
          </header>

          <div className="space-y-7 px-6 py-7 md:px-9">
            {/* Angka utama */}
            <motion.section {...fade(0)} className="lap-avoid grid grid-cols-2 gap-3 md:grid-cols-3">
              {[
                {
                  icon: TrendingUp,
                  label: 'Omzet',
                  value: formatIDR(sum.omzet),
                  sub: `${formatIDR(sum.perHari)} / hari`,
                  hi: true,
                },
                {
                  icon: Wallet,
                  label: 'Biaya usaha',
                  value: formatIDR(sum.biaya),
                  sub: `${data.expenses.length} catatan`,
                },
                {
                  icon: Receipt,
                  label: 'Laba kotor',
                  value: formatIDR(sum.laba),
                  sub: sum.omzet ? `Margin ${Math.round(sum.margin * 100)}%` : '—',
                  tone: sum.laba < 0 ? 'text-rose-600' : 'text-emerald-600',
                },
                {
                  icon: ShoppingBag,
                  label: 'Transaksi',
                  value: sum.trx.toLocaleString('id-ID'),
                  sub: `${sum.unit.toLocaleString('id-ID')} item terjual`,
                },
                { icon: Receipt, label: 'Rata-rata / transaksi', value: formatIDR(sum.avg), sub: 'nilai keranjang' },
                {
                  icon: CalendarDays,
                  label: sum.monthly ? 'Bulan terlaris' : 'Hari terlaris',
                  value: sum.best?.omzet ? (sum.monthly ? sum.best.label : tglPendek(sum.best.key)) : '—',
                  sub: sum.best?.omzet ? formatIDR(sum.best.omzet) : 'belum ada penjualan',
                },
              ].map((k) => (
                <div
                  key={k.label}
                  className="rounded-2xl p-4 ring-1 ring-slate-200/80"
                  style={
                    k.hi ? { background: rgba(c, 0.07), boxShadow: `inset 0 0 0 1px ${rgba(c, 0.25)}` } : undefined
                  }
                >
                  <p className="flex items-center gap-1.5 fs-12 font-bold text-slate-500">
                    <k.icon size={14} style={{ color: c }} /> {k.label}
                  </p>
                  <p className={cn('mt-1.5 fsh-20 font-extrabold tracking-tight tabular-nums', k.tone)}>{k.value}</p>
                  <p className="fs-11.5 text-slate-400">{k.sub}</p>
                </div>
              ))}
            </motion.section>

            {/* Grafik omzet & biaya */}
            <motion.section {...fade(1)} className="lap-avoid">
              <div className="mb-3 flex items-end justify-between gap-2">
                <h2 className="fs-16 font-extrabold">Omzet {sum.monthly ? 'per bulan' : 'per hari'}</h2>
                <p className="flex items-center gap-3 fs-11.5 text-slate-500">
                  <span className="flex items-center gap-1">
                    <i className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} /> Omzet
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="h-2.5 w-2.5 rounded-sm bg-rose-300" /> Biaya
                  </span>
                </p>
              </div>
              <Chart buckets={sum.buckets} color={c} reduce={Boolean(reduce)} />
            </motion.section>

            <div className="grid gap-7 md:grid-cols-2">
              {/* Produk terlaris */}
              <motion.section {...fade(2)} className="lap-avoid">
                <h2 className="mb-3 flex items-center gap-2 fs-16 font-extrabold">
                  <Package size={17} style={{ color: c }} /> Produk terlaris
                </h2>
                {sum.products.length ? (
                  <ol className="space-y-2.5">
                    {sum.products.slice(0, 8).map((p, i) => {
                      const pct = sum.products[0].omzet ? p.omzet / sum.products[0].omzet : 0;
                      return (
                        <li key={p.name}>
                          <div className="flex items-baseline justify-between gap-2 fs-13">
                            <span className="min-w-0 truncate font-bold">
                              <span className="mr-1.5 tabular-nums text-slate-400">{i + 1}.</span>
                              {p.name}
                            </span>
                            <span className="shrink-0 tabular-nums text-slate-600">
                              {p.qty.toLocaleString('id-ID')}× · <b className="text-slate-900">{formatIDR(p.omzet)}</b>
                            </span>
                          </div>
                          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                            <motion.div
                              className="h-full rounded-full"
                              style={{ background: `linear-gradient(90deg, ${c}, ${mix(c, '#ffffff', 0.35)})` }}
                              initial={reduce ? false : { width: 0 }}
                              animate={{ width: `${Math.max(3, pct * 100)}%` }}
                              transition={{ duration: 0.8, delay: 0.2 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <Empty text="Belum ada penjualan di periode ini." />
                )}
              </motion.section>

              <div className="space-y-7">
                {/* Biaya per jenis */}
                <motion.section {...fade(3)} className="lap-avoid">
                  <h2 className="mb-3 flex items-center gap-2 fs-16 font-extrabold">
                    <Wallet size={17} style={{ color: c }} /> Biaya per jenis
                  </h2>
                  {sum.costs.length ? (
                    <ul className="space-y-2">
                      {sum.costs.map((k) => (
                        <li key={k.kind} className="flex items-center gap-3 fs-13">
                          <span className="w-28 shrink-0 font-semibold text-slate-600">{k.kind}</span>
                          <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <span
                              className="block h-full rounded-full bg-rose-400"
                              style={{ width: `${Math.max(3, (k.amount / sum.costs[0].amount) * 100)}%` }}
                            />
                          </span>
                          <span className="w-28 shrink-0 text-right font-bold tabular-nums">{formatIDR(k.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Empty text="Belum ada biaya tercatat." />
                  )}
                </motion.section>

                {/* Kasir / tim / website */}
                <motion.section {...fade(4)} className="lap-avoid">
                  <h2 className="mb-3 flex items-center gap-2 fs-16 font-extrabold">
                    <Users size={17} style={{ color: c }} /> Penjualan per kasir
                  </h2>
                  {sum.staff.length ? (
                    <ul className="divide-y divide-slate-100 rounded-2xl ring-1 ring-slate-200/80">
                      {sum.staff.map((s) => (
                        <li key={s.name} className="flex items-center justify-between gap-2 px-3.5 py-2.5 fs-13">
                          <span className="font-bold">{s.name}</span>
                          <span className="tabular-nums text-slate-600">
                            {s.trx} trx · <b className="text-slate-900">{formatIDR(s.omzet)}</b>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Empty text="—" />
                  )}
                </motion.section>
              </div>
            </div>

            {/* Rincian penjualan — di PDF selalu mulai di halaman baru */}
            <motion.section {...fade(5)} className="lap-break">
              <h2 className="mb-3 fs-16 font-extrabold">Rincian penjualan</h2>
              {data.sales.length ? (
                <div className="overflow-x-auto rounded-2xl ring-1 ring-slate-200/80">
                  <table className="w-full min-w-[640px] text-left fs-12.5">
                    <thead style={{ background: rgba(c, 0.08) }}>
                      <tr className="text-slate-600">
                        {['Tanggal', 'Item', 'Pembeli', 'Kasir', 'Rekening', 'Nominal'].map((h) => (
                          <th key={h} className={cn('px-3 py-2.5 font-bold', h === 'Nominal' && 'text-right')}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[...data.sales].reverse().map((s) => (
                        <tr key={s.id} className="lap-avoid align-top">
                          <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-500">
                            {tglPendek(s.date)}
                          </td>
                          <td className="px-3 py-2">
                            {saleLines(s)
                              .map((l) => `${l.name}${l.qty > 1 ? ` ×${l.qty}` : ''}`)
                              .join(', ')}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{s.buyer || '—'}</td>
                          <td className="px-3 py-2 text-slate-600">
                            {s.source === 'website' ? 'Website' : s.staff || 'Pemilik'}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{s.account || '—'}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right font-bold tabular-nums">
                            {formatIDR(s.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="font-extrabold" style={{ background: rgba(c, 0.06) }}>
                        <td className="px-3 py-2.5" colSpan={5}>
                          Total {data.sales.length} penjualan
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                          {formatIDR(sum.omzet)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <Empty text="Belum ada penjualan di periode ini." />
              )}
              {data.truncated && (
                <p className="mt-2 fs-12 font-semibold text-amber-700">
                  Periode ini berisi lebih dari 5.000 transaksi — perkecil rentang tanggal agar lengkap.
                </p>
              )}
            </motion.section>

            {/* Rincian biaya */}
            {data.expenses.length > 0 && (
              <motion.section {...fade(6)}>
                <h2 className="mb-3 fs-16 font-extrabold">Rincian biaya</h2>
                <div className="overflow-x-auto rounded-2xl ring-1 ring-slate-200/80">
                  <table className="w-full min-w-[560px] text-left fs-12.5">
                    <thead className="bg-rose-50/70">
                      <tr className="text-slate-600">
                        {['Tanggal', 'Untuk', 'Jenis', 'Dicatat oleh', 'Nominal'].map((h) => (
                          <th key={h} className={cn('px-3 py-2.5 font-bold', h === 'Nominal' && 'text-right')}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[...data.expenses].reverse().map((e) => (
                        <tr key={e.id} className="lap-avoid">
                          <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-500">
                            {tglPendek(e.date)}
                          </td>
                          <td className="px-3 py-2">{e.item || e.kind}</td>
                          <td className="px-3 py-2 text-slate-600">{e.kind}</td>
                          <td className="px-3 py-2 text-slate-600">{e.staff || 'Pemilik'}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right font-bold tabular-nums">
                            {formatIDR(e.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-rose-50/60 font-extrabold">
                        <td className="px-3 py-2.5" colSpan={4}>
                          Total biaya
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                          {formatIDR(sum.biaya)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </motion.section>
            )}

            {/* Stok bahan */}
            {data.materials.length > 0 && (
              <motion.section {...fade(7)} className="lap-avoid">
                <h2 className="mb-3 fs-16 font-extrabold">Stok bahan saat ini</h2>
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                  {data.materials.map((m) => {
                    const low = m.stock <= 0 || (m.min_stock !== null && m.stock <= m.min_stock);
                    return (
                      <div
                        key={m.id}
                        className={cn(
                          'flex items-center justify-between rounded-xl px-3.5 py-2.5 fs-13 ring-1',
                          low ? 'bg-amber-50 ring-amber-200' : 'ring-slate-200/80',
                        )}
                      >
                        <span className="min-w-0 truncate font-semibold">{m.name}</span>
                        <span
                          className={cn('shrink-0 font-bold tabular-nums', low ? 'text-amber-700' : 'text-slate-700')}
                        >
                          {m.stock.toLocaleString('id-ID')} {m.unit}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {sum.lowStock.length > 0 && (
                  <p className="mt-2 fs-12 font-semibold text-amber-700">
                    {sum.lowStock.length} bahan hampir/sudah habis — waktunya belanja.
                  </p>
                )}
              </motion.section>
            )}

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 fs-11 text-slate-400">
              <span>{data.shop.receipt_footer || 'Terima kasih sudah berjualan bersama Leosiqra.'}</span>
              <span>Dibuat dengan Leosiqra · leosiqra.com</span>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl bg-slate-50 px-4 py-6 text-center fs-13 text-slate-400">{text}</p>;
}

function Chart({
  buckets,
  color,
  reduce,
}: {
  buckets: { key: string; label: string; omzet: number; biaya: number }[];
  color: string;
  reduce: boolean;
}) {
  const max = Math.max(1, ...buckets.map((b) => Math.max(b.omzet, b.biaya)));
  const step = buckets.length > 20 ? Math.ceil(buckets.length / 12) : 1;
  return (
    <div className="rounded-2xl p-4 ring-1 ring-slate-200/80">
      <div className="flex h-44 items-end gap-[3px]">
        {buckets.map((b, i) => (
          <div
            key={b.key}
            className="group relative flex h-full flex-1 flex-col justify-end"
            title={`${b.label}: ${formatIDR(b.omzet)}`}
          >
            <div className="relative flex h-full items-end gap-[1px]">
              <motion.div
                className="flex-1 rounded-t-[4px]"
                style={{
                  background: `linear-gradient(180deg, ${color}, ${mix(color, '#ffffff', 0.4)})`,
                  transformOrigin: 'bottom',
                }}
                initial={reduce ? false : { scaleY: 0 }}
                animate={{ scaleY: 1, height: `${(b.omzet / max) * 100}%` }}
                transition={{ duration: 0.6, delay: 0.1 + i * 0.012, ease: [0.16, 1, 0.3, 1] }}
              />
              {b.biaya > 0 && (
                <div className="w-[30%] rounded-t-[3px] bg-rose-300" style={{ height: `${(b.biaya / max) * 100}%` }} />
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[3px]">
        {buckets.map((b, i) => (
          <span key={b.key} className="flex-1 text-center fs-9.5 tabular-nums text-slate-400">
            {i % step === 0 ? b.label : ''}
          </span>
        ))}
      </div>
      <p className="mt-2 text-right fs-11 text-slate-400">Puncak {jt(max)}</p>
    </div>
  );
}
