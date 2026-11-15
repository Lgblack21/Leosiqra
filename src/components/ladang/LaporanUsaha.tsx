'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  CalendarDays,
  Download,
  FileSpreadsheet,
  Hourglass,
  Lock,
  Package,
  Scale,
  Store,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { KASIR_THEME } from './kasirTheme';
import { usePlan } from '@/lib/usePlan';
import { formatIDR, cn } from '@/lib/utils';
import {
  fetchShopReport,
  growth,
  periodeLabel,
  STOCK_PURCHASE_KIND,
  previousRange,
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

export function LaporanUsaha({ variant, embedded = false }: { variant: 'web' | 'app'; embedded?: boolean }) {
  const reduce = useReducedMotion();
  const [id, setId] = useState<string | null>(null);
  const [rangeId, setRangeId] = useState<RangeId>('bulan');
  const [custom, setCustom] = useState(() => rangeFor('bulan'));
  const [data, setData] = useState<ShopReport | null>(null);
  const [prev, setPrev] = useState<ShopReport | null>(null);
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
    // Periode pembanding (naik/turun). Gagal dimuat → laporan tetap tampil tanpa perbandingan.
    const p = previousRange(range.from, range.to);
    setPrev(null);
    fetchShopReport(id, p.from, p.to)
      .then((r) => alive && setPrev(r))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [id, range.from, range.to]);

  const isPro = usePlan();
  // Perkirakan modal penjualan yang belum punya modal tercatat pakai harga modal SAAT INI (tampilan saja).
  const [estimate, setEstimate] = useState(false);
  const sum = useMemo(() => (data ? summarize(data, { estimate }) : null), [data, estimate]);
  const prevSum = useMemo(() => (prev ? summarize(prev) : null), [prev]);
  // Badge naik/turun vs periode sebelumnya. good = arah yang bagus (omzet naik, biaya turun).
  const delta = (now: number, before: number | undefined, upIsGood = true) => {
    if (before === undefined) return null;
    const g = growth(now, before);
    if (g === null) return null;
    const pct = Math.round(g * 100);
    if (pct === 0) return { text: '= 0%', good: null };
    const up = pct > 0;
    return { text: `${up ? '▲' : '▼'} ${Math.abs(pct)}%`, good: up === upIsGood };
  };
  const theme = KASIR_THEME[data?.shop.theme ?? 'ungu'] ?? KASIR_THEME.ungu;
  const c = theme.swatch;
  const back = `${variant === 'app' ? '/app' : '/membership'}/usahaku${id ? `?id=${encodeURIComponent(id)}` : ''}`;

  const downloadXlsx = async () => {
    if (!data || !sum) return;
    setXls('busy');
    try {
      const { buildShopXlsx } = await import('@/lib/shopReportXlsx');
      const blob = await buildShopXlsx(data, sum, c, isPro === true);
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
    <div className={cn('lap-root bg-[#f5f6fa] text-slate-900', embedded ? 'rounded-[28px] pb-6' : 'min-h-screen pb-16')}>
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
      <div
        className={cn(
          'z-20 border-b border-slate-200/70 bg-white/95 print:hidden',
          embedded ? 'rounded-t-[28px]' : 'sticky top-0',
        )}
      >
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-3 md:px-6">
          {!embedded && (
            <Link
              href={back}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
              aria-label="Kembali ke Usahaku"
            >
              <ArrowLeft size={18} />
            </Link>
          )}
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
                  d: delta(sum.omzet, prevSum?.omzet),
                },
                {
                  icon: Wallet,
                  label: 'Biaya usaha',
                  value: formatIDR(sum.biaya),
                  sub: `${data.expenses.length} catatan`,
                  d: delta(sum.biaya, prevSum?.biaya, false),
                },
                {
                  icon: Receipt,
                  label: 'Laba (dasar kas)',
                  value: formatIDR(sum.laba),
                  sub: sum.omzet ? `Margin ${Math.round(sum.margin * 100)}%` : '—',
                  tone: sum.laba < 0 ? 'text-rose-600' : 'text-emerald-600',
                  // Laba bisa minus → persen dari nilai minus menyesatkan; bandingkan hanya kalau dua-duanya positif.
                  d: prevSum && prevSum.laba > 0 && sum.laba > 0 ? delta(sum.laba, prevSum.laba) : null,
                },
                {
                  icon: ShoppingBag,
                  label: 'Transaksi',
                  value: sum.trx.toLocaleString('id-ID'),
                  sub: `${sum.unit.toLocaleString('id-ID')} item terjual`,
                  d: delta(sum.trx, prevSum?.trx),
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
                  {'d' in k && k.d && (
                    <p className={cn('mt-1 fs-11 font-bold tabular-nums', k.d.good === null ? 'text-slate-500' : k.d.good ? 'text-emerald-600' : 'text-rose-600')}>
                      {k.d.text} <span className="font-medium text-slate-400">vs periode lalu</span>
                    </p>
                  )}
                </div>
              ))}
            </motion.section>
            <p className="-mt-4 fs-11.5 leading-relaxed text-slate-400">
              Laba di sini = omzet − biaya yang tercatat (dasar kas), belum dikurangi modal barang (HPP). Pembanding:{' '}
              {(() => {
                const p = previousRange(data.range.from, data.range.to);
                return periodeLabel(p.from, p.to);
              })()}
              .
            </p>

            {sum.bon.count > 0 && (
              <motion.section {...fade(1)} className="lap-avoid flex items-start gap-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
                <Hourglass size={18} className="mt-0.5 shrink-0 text-amber-600" />
                <p className="fs-13 leading-relaxed text-amber-900">
                  <b>
                    {sum.bon.count} bon pelanggan belum lunas
                    {sum.bon.people > 1 ? ` (${sum.bon.people} orang)` : ''}
                  </b>{' '}
                  — sisa {formatIDR(sum.bon.sisa)}
                  {sum.bon.overdue ? `, ${sum.bon.overdue} lewat jatuh tempo` : ''}. Sudah ikut dihitung di omzet, uangnya belum masuk kas.
                </p>
              </motion.section>
            )}
            {sum.pending.count > 0 && (
              <motion.section
                {...fade(1)}
                className="lap-avoid flex items-start gap-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200"
              >
                <Hourglass size={18} className="mt-0.5 shrink-0 text-amber-600" />
                <p className="fs-13 leading-relaxed text-amber-900">
                  <b>{sum.pending.count} penjualan marketplace belum cair</b> — {formatIDR(sum.pending.amount)} harga jual,
                  perkiraan masuk {formatIDR(sum.pending.net)}
                  {sum.pending.oldest ? `, paling lama sejak ${tglPanjang(sum.pending.oldest)}` : ''}. Sudah ikut dihitung
                  di omzet, tapi uangnya belum ada di kas.
                </p>
              </motion.section>
            )}


            {/* Laba dengan modal barang (HPP) — PRO */}
            {isPro === false && (
              <motion.section {...fade(1)} className="lap-avoid flex items-start gap-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 print:hidden">
                <Lock size={18} className="mt-0.5 shrink-0 text-slate-500" />
                <p className="fs-13 leading-relaxed text-slate-600">
                  <b className="text-slate-900">Laba kotor & bersih dengan modal barang (HPP)</b> dan laba per produk ada di paket PRO.
                  Isi harga modal sekali, tiap penjualan langsung ketahuan untungnya.{' '}
                  <Link href={variant === 'app' ? '/app/profile' : '/membership/profile'} className="font-bold underline" style={{ color: c }}>
                    Lihat paket PRO
                  </Link>
                </p>
              </motion.section>
            )}
            {isPro && !sum.hppInfo.hasAny && !sum.hppInfo.canEstimate && (
              <motion.section {...fade(1)} className="lap-avoid flex items-start gap-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 print:hidden">
                <Scale size={18} className="mt-0.5 shrink-0" style={{ color: c }} />
                <p className="fs-13 leading-relaxed text-slate-600">
                  <b className="text-slate-900">Mau tahu laba sebenarnya?</b> Isi harga modal tiap produk di ⚙️ Pengaturan › Produk, atau
                  lengkapi resep & harga beli bahan di Stok. Penjualan berikutnya otomatis tercatat modalnya, dan laba kotor, laba
                  bersih, serta laba per produk muncul di sini.
                </p>
              </motion.section>
            )}
            {isPro && (sum.hppInfo.hasAny || sum.hppInfo.canEstimate) && (
              <motion.section {...fade(1)} className="lap-avoid">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h2 className="flex items-center gap-2 fs-16 font-extrabold">
                    <Scale size={17} style={{ color: c }} /> Laba dengan modal barang
                  </h2>
                  {sum.hppInfo.coverage < 1 && sum.omzet > 0 && (
                    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 fs-11 font-bold text-amber-700 ring-1 ring-amber-200">
                      Modal tercatat untuk {Math.floor(sum.hppInfo.coverage * 100)}% omzet
                    </span>
                  )}
                  {sum.hppInfo.estimated && (
                    <span className="rounded-full bg-sky-50 px-2.5 py-0.5 fs-11 font-bold text-sky-700 ring-1 ring-sky-200">
                      termasuk perkiraan
                    </span>
                  )}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <dl className="divide-y divide-slate-100 rounded-2xl ring-1 ring-slate-200/80 fs-13 tabular-nums">
                    {[
                      { k: 'Omzet', v: sum.omzet },
                      { k: '− Modal barang terjual (HPP)', v: -sum.hppInfo.hpp, muted: true },
                      { k: 'Laba kotor', v: sum.hppInfo.labaKotor, bold: true, pct: sum.hppInfo.marginKotor },
                      { k: '− Potongan marketplace', v: -sum.hppInfo.feeExp, muted: true },
                      { k: '− Biaya operasional', v: -sum.hppInfo.operasional, muted: true },
                      { k: 'Laba bersih', v: sum.hppInfo.labaBersih, bold: true, pct: sum.hppInfo.marginBersih, hi: true },
                    ].map((row) => (
                      <div
                        key={row.k}
                        className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                        style={row.hi ? { background: rgba(c, 0.06) } : undefined}
                      >
                        <dt className={cn(row.bold ? 'font-extrabold text-slate-900' : 'text-slate-600')}>{row.k}</dt>
                        <dd className={cn(row.bold ? 'font-extrabold' : row.muted ? 'text-slate-500' : 'font-bold', row.bold && (row.v < 0 ? 'text-rose-600' : 'text-emerald-600'))}>
                          {row.v < 0 && !row.bold ? `−${formatIDR(-row.v)}` : formatIDR(row.v)}
                          {row.pct !== undefined && sum.omzet > 0 && <span className="ml-1.5 fs-11 font-semibold text-slate-400">{Math.round(row.pct * 100)}%</span>}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <div className="space-y-3 fs-12.5 leading-relaxed text-slate-500">
                    {sum.hppInfo.stockBuy > 0 && (
                      <p>
                        Belanja stok (<b>{STOCK_PURCHASE_KIND}</b>) {formatIDR(sum.hppInfo.stockBuy)} tidak dikurangkan di sini — sudah
                        masuk lewat modal barang saat barangnya laku. Uangnya tetap tercatat keluar dari kas.
                      </p>
                    )}
                    {sum.hppInfo.missing.length > 0 && (
                      <div className="rounded-2xl bg-amber-50/70 p-3 ring-1 ring-amber-200/70">
                        <p className="font-bold text-amber-900">Penjualan tanpa modal (labanya belum dihitung):</p>
                        <ul className="mt-1 space-y-0.5">
                          {sum.hppInfo.missing.slice(0, 5).map((m) => (
                            <li key={m.name} className="flex justify-between gap-2 tabular-nums">
                              <span className="truncate">{m.name}</span>
                              <span>{formatIDR(m.omzet)}</span>
                            </li>
                          ))}
                        </ul>
                        <p className="mt-1.5">Isi harga modalnya di ⚙️ Pengaturan › Produk — berlaku untuk penjualan berikutnya.</p>
                      </div>
                    )}
                    {sum.hppInfo.canEstimate && (sum.hppInfo.missing.length > 0 || estimate) && (
                      <label className="flex cursor-pointer items-start gap-2 print:hidden">
                        <input type="checkbox" checked={estimate} onChange={(e) => setEstimate(e.target.checked)} className="mt-0.5 h-4 w-4" style={{ accentColor: c }} />
                        <span>
                          <b className="text-slate-700">Perkirakan modal penjualan lama</b> pakai harga modal sekarang. Hanya tampilan, data
                          penjualan tidak diubah.
                        </span>
                      </label>
                    )}
                  </div>
                </div>
                {sum.hppInfo.hasAny && (
                  <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-slate-200/80">
                    <p className="bg-slate-50 px-3.5 py-2 fs-11.5 font-bold uppercase tracking-wide text-slate-500">Laba per produk</p>
                    <ul className="divide-y divide-slate-100 fs-13 tabular-nums">
                      {sum.hppInfo.productProfit.slice(0, 10).map((p) => (
                        <li key={p.name} className="flex items-center justify-between gap-3 px-3.5 py-2">
                          <span className="min-w-0 truncate font-bold">
                            {p.name} <span className="font-medium text-slate-400">· {p.qty.toLocaleString('id-ID')}×</span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="text-slate-500">{formatIDR(p.omzet)}</span>
                            {p.laba !== null ? (
                              <b className={cn('ml-2', p.laba < 0 ? 'text-rose-600' : 'text-emerald-600')}>
                                {p.laba < 0 ? '−' : '+'}
                                {formatIDR(Math.abs(p.laba))}
                              </b>
                            ) : (
                              <span className="ml-2 text-slate-400">modal belum lengkap</span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </motion.section>
            )}

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

            {/* Per jalur jualan — hanya kalau ada lebih dari satu jalur atau ada potongan marketplace */}
            {(sum.channels.length > 1 || sum.channels.some((x) => x.fee > 0 || (isPro && x.cost > 0))) && (
              <motion.section {...fade(2)} className="lap-avoid">
                <h2 className="mb-3 flex items-center gap-2 fs-16 font-extrabold">
                  <Store size={17} style={{ color: c }} /> Per jalur jualan
                </h2>
                <ul className="divide-y divide-slate-100 rounded-2xl ring-1 ring-slate-200/80">
                  {sum.channels.map((x) => (
                    <li key={x.name} className="px-3.5 py-2.5 fs-13">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate font-bold">
                          {x.name}
                          {x.type === 'marketplace' && <span className="ml-1.5 fs-11 font-semibold text-slate-400">marketplace</span>}
                        </span>
                        <span className="shrink-0 tabular-nums text-slate-600">
                          {x.trx} trx · <b className="text-slate-900">{formatIDR(x.omzet)}</b>
                        </span>
                      </div>
                      {(x.fee > 0 || (isPro && x.cost > 0)) && (
                        <p className="mt-0.5 text-right fs-12 tabular-nums text-slate-500">
                          {x.fee > 0 && (
                            <>
                              potongan <span className="font-semibold text-rose-600">{formatIDR(x.fee)} ({Math.round((x.fee / x.omzet) * 100)}%)</span> ·
                              diterima <b className="text-slate-900">{formatIDR(x.net)}</b>
                            </>
                          )}
                          {isPro && x.cost > 0 && (
                            <>
                              {x.fee > 0 && ' · '}modal {formatIDR(x.cost)}
                              {x.costFull ? (
                                <>
                                  {' '}· laba{' '}
                                  <b className={x.net - x.cost < 0 ? 'text-rose-600' : 'text-emerald-600'}>{formatIDR(x.net - x.cost)}</b>
                                </>
                              ) : (
                                ' (sebagian)'
                              )}
                            </>
                          )}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </motion.section>
            )}

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
