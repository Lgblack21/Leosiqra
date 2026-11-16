'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import type { Shop } from '@/lib/services/shopService';
import { shopLoanService, type LoanReport } from '@/lib/services/shopLoanService';
import { rekapLaporan } from '@/lib/usaha/pinjaman';
import { cn, formatIDR } from '@/lib/utils';
import { PeriodPicker, periodLabel } from './BerandaUsaha';

// Laporan usaha Pinjaman per periode + Excel (Ringkasan · Peminjam · Angsuran). Tahap 2 rancangan pinjaman.
export function PinjamanLaporan({ shop }: { shop: Shop }) {
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [data, setData] = useState<LoanReport | null>(null);
  const [error, setError] = useState('');
  const [xls, setXls] = useState<'idle' | 'busy' | 'err'>('idle');
  const load = useCallback(async () => {
    try {
      setData(await shopLoanService.laporan(shop.id, range));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat laporan.');
    }
  }, [shop.id, range]);
  useEffect(() => {
    void load();
    return subscribeToCollectionChanges('shop_book', load);
  }, [load]);
  const k = useMemo(() => (data ? rekapLaporan(data) : null), [data]);

  const download = async () => {
    if (!data || !k) return;
    setXls('busy');
    try {
      const { buildPinjamanXlsx } = await import('@/lib/pinjamanXlsx');
      const blob = await buildPinjamanXlsx(shop.name, data, k);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Laporan-Pinjaman-${shop.name.replace(/[^\w-]+/g, '-')}-${data.range.from}_${data.range.to}.xlsx`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      setXls('idle');
    } catch {
      setXls('err');
    }
  };

  if (error && !data)
    return <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 fs-13 font-semibold text-rose-600 dark:bg-rose-500/10">{error}</p>;
  if (!data || !k) return <div className="h-72 animate-pulse rounded-[28px] bg-slate-200/70 dark:bg-slate-800" />;
  const label = periodLabel(range ?? data.range);
  const stat = (t: string, v: string, hint?: string, tone = 'text-slate-900 dark:text-white') => (
    <div className="min-w-0 rounded-3xl bg-white p-4 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
      <p className="truncate fs-12 font-semibold text-slate-500 dark:text-slate-400">{t}</p>
      <p className={cn('truncate fsh-22 font-black tabular-nums tracking-tight', tone)}>{v}</p>
      {hint && <p className="truncate fs-11 text-slate-400">{hint}</p>}
    </div>
  );
  const akhir = data.range.to === data.today ? 'hari ini' : `per ${data.range.to}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <PeriodPicker range={data.range} onRange={setRange} />
        </div>
        <button
          type="button"
          onClick={download}
          disabled={xls === 'busy'}
          className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 fs-13 font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700"
        >
          {xls === 'busy' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Unduh Excel
        </button>
      </div>
      {xls === 'err' && <p className="fs-12 font-semibold text-rose-600">Excel gagal dibuat. Coba lagi.</p>}
      {data.truncated && <p className="fs-12 text-amber-700">Data periode ini sangat banyak — sebagian tidak ikut. Persempit periodenya.</p>}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {stat(`Pendapatan ${label}`, formatIDR(k.pendapatan), `admin ${formatIDR(k.admin)} · jasa ${formatIDR(k.jasa)}`, 'text-emerald-700 dark:text-emerald-300')}
        {stat('Angsuran masuk', formatIDR(k.masuk.total), `${k.masuk.n} kali bayar`)}
        {stat('Pinjaman keluar', formatIDR(k.cair.pokok), `${k.cair.n} pinjaman · diserahkan ${formatIDR(k.cair.diserahkan)}`)}
        {stat(`Uang beredar ${akhir}`, formatIDR(k.beredar), `modal di luar ${formatIDR(k.modal)}`)}
      </div>

      <section className="rounded-[26px] bg-white p-4 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
        <p className="fs-15 font-extrabold text-slate-900 dark:text-white">Kelancaran {akhir}</p>
        <ul className="mt-2 grid gap-2 sm:grid-cols-4">
          <li className="rounded-2xl bg-emerald-50 px-3 py-2.5 dark:bg-emerald-500/10">
            <p className="fs-12 text-emerald-800 dark:text-emerald-200">Lancar</p>
            <p className="fs-15 font-extrabold text-emerald-800 dark:text-emerald-200">{k.aktif - k.telat.reduce((a, t) => a + t.n, 0)} orang</p>
          </li>
          {k.telat.map((t) => (
            <li key={t.g} className={cn('rounded-2xl px-3 py-2.5', t.n ? (t.g === 'lebih dari 30 hari' ? 'bg-rose-50 dark:bg-rose-500/10' : 'bg-amber-50 dark:bg-amber-500/10') : 'bg-slate-50 dark:bg-slate-800/60')}>
              <p className="fs-12 text-slate-600 dark:text-slate-300">Telat {t.g}</p>
              <p className="fs-15 font-extrabold text-slate-900 dark:text-white">
                {t.n} orang{t.n ? ` · ${formatIDR(t.tagihan)}` : ''}
              </p>
            </li>
          ))}
        </ul>
        {k.lunasDiPeriode > 0 && <p className="mt-2 fs-12 text-slate-500">{k.lunasDiPeriode} pinjaman lunas di periode ini.</p>}
      </section>

      <section className="rounded-[26px] bg-white p-4 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
        <p className="fs-15 font-extrabold text-slate-900 dark:text-white">Per peminjam</p>
        {k.rows.length === 0 ? (
          <p className="mt-2 fs-13 text-slate-500">Tidak ada pinjaman di periode ini.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
            {k.rows.map((x) => (
              <li key={x.l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <span className="min-w-0 flex-1 basis-40">
                  <span className="block truncate fs-14 font-bold text-slate-900 dark:text-white">{x.l.borrowerName}</span>
                  <span className="block truncate fs-11 text-slate-500">
                    {formatIDR(x.l.principal)} · {x.l.count}× {formatIDR(x.l.installment)} {x.l.frequency} · cair {x.l.disbursedOn}
                  </span>
                </span>
                <span className="fs-12 tabular-nums text-slate-600 dark:text-slate-300">
                  masuk <b>{formatIDR(x.masuk)}</b> · untung <b className="text-emerald-700 dark:text-emerald-300">{formatIDR(x.jasa + x.admin)}</b>
                </span>
                <span
                  className={cn(
                    'rounded-md px-2 py-0.5 fs-11 font-bold',
                    x.sisa === 0
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                      : x.st.telat > 0
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
                  )}
                >
                  {x.sisa === 0 ? 'lunas' : `sisa ${formatIDR(x.sisa)}${x.st.telat ? ` · telat ${x.st.telat} hr` : ''}`}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 fs-11 text-slate-400">
          Pendapatan = admin (saat uang diserahkan) + jasa (diakui sedikit-sedikit tiap angsuran masuk). Uang yang diserahkan
          bukan biaya, angsuran bukan omzet.
        </p>
      </section>
    </div>
  );
}
