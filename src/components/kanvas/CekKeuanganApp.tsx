'use client';

import Link from 'next/link';
import { ArrowLeft, ChevronRight, Waypoints } from 'lucide-react';
import { LeoBadge } from '@/components/ai/LeoGuide';
import { useFinance } from '@/components/kanvas/useFinance';
import { rp } from '@/lib/kanvas/data';
import { CEK } from '@/lib/kanvas/templates';
import { STATUS_PILL } from '@/components/kanvas/cards';
import { cn } from '@/lib/utils';

const APP: Record<string, string> = {
  '/membership/kekayaan': '/app/wallet',
  '/membership/recurring': '/app/recurring',
  '/membership/cek-keuangan': '/app/cek-keuangan',
};
const CHECKS = [CEK.tabung, CEK.darurat, CEK.utang, CEK.cicilan, CEK.bersih];
const FIX: Record<string, string> = {
  'c-tabung': 'Atur setoran tabungan otomatis setelah gajian.',
  'c-darurat': 'Sisihkan sebagian sisa bulanan ke tabungan terpisah sampai minimal 3× pengeluaran.',
  'c-utang': 'Prioritaskan melunasi utang berbunga tinggi dan tahan utang konsumtif baru.',
  'c-cicilan': 'Hindari cicilan baru sampai porsinya di bawah 30% pemasukan.',
  'c-bersih': 'Kurangi utang dan tambah aset sedikit demi sedikit.',
};

// Cek Keuangan: pemeriksaan rasio sederhana dari catatan & Kekayaan user sendiri.
export function CekKeuanganApp({ variant = 'web' }: { variant?: 'web' | 'app' }) {
  const fin = useFinance();
  const m = fin?.metrics;
  const href = (h: string) => (variant === 'app' ? (APP[h] ?? h) : h);
  const results = CHECKS.map((c) => ({ c, r: m ? c.calc(m) : null }));
  const scored = results.filter((x) => x.r);
  const aman = scored.filter((x) => x.r!.status === 'aman').length;

  return (
    <div
      className={cn(
        'text-slate-900 dark:text-white',
        variant === 'app' &&
          'min-h-dvh bg-[#f6f5f1] px-4 pb-10 pt-[max(12px,env(safe-area-inset-top))] dark:bg-slate-950',
      )}
    >
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex items-start gap-3">
          {variant === 'app' ? (
            <Link
              href="/app/more"
              aria-label="Kembali"
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
            >
              <ArrowLeft size={18} />
            </Link>
          ) : null}
          <div className="flex-1">
            <h1 className="text-[24px] font-black tracking-tight">Cek Keuangan</h1>
            <p className="text-[13px] text-slate-500 dark:text-slate-400">
              Pemeriksaan sederhana dari catatan & Kekayaanmu sendiri.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-[28px] bg-slate-950 p-5 text-white dark:ring-1 dark:ring-white/10">
          <LeoBadge topic="investasi" size={64} />
          <div className="flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-300">Hasil cek</p>
            <p className="text-[24px] font-black leading-tight">
              {!m ? 'Memuat…' : scored.length ? `${aman} dari ${scored.length} aman` : 'Belum bisa dicek'}
            </p>
            <p className="text-[13px] text-white/60">
              {m && !m.months
                ? `Sebagian cek butuh sebulan penuh catatan — siap ${m.readyLabel}.`
                : m
                  ? `Rata-rata ${m.months} bulan penuh terakhir · pemasukan ${rp(m.incomeAvg)} · pengeluaran ${rp(m.expenseAvg)}`
                  : ''}
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {results.map(({ c, r }) => (
            <div
              key={c.id}
              className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
            >
              <div className="flex items-start gap-3">
                <p className="flex-1 text-[17px] font-black">{c.label}</p>
                {r ? (
                  <span className={cn('rounded-full px-3 py-1 text-[12px] font-bold', STATUS_PILL[r.status].cls)}>
                    {STATUS_PILL[r.status].label}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-[15px] font-bold text-slate-700 dark:text-slate-200">
                {r ? r.text : m ? `Siap ${m.readyLabel}` : 'Memuat…'}
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">{c.desc}</p>
              <p className="mt-2 border-l-2 border-slate-200 pl-3 text-[12.5px] leading-relaxed text-slate-500 dark:border-slate-700">
                {c.ref}
              </p>
              {r && r.status !== 'aman' ? (
                <p className="mt-3 rounded-2xl bg-amber-50 px-3.5 py-2.5 text-[13px] font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                  {FIX[c.id]}
                </p>
              ) : null}
              {c.link ? (
                <Link
                  href={href(c.link.href)}
                  className="mt-3 inline-flex items-center gap-1 text-[13px] font-bold text-indigo-600 dark:text-indigo-400"
                >
                  {c.link.label} <ChevronRight size={15} />
                </Link>
              ) : null}
            </div>
          ))}
        </div>

        <Link
          href={variant === 'app' ? '/app/kanvas' : '/membership/kanvas'}
          className="flex items-center gap-3 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200 hover:ring-slate-300 dark:bg-slate-900 dark:ring-slate-800"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <Waypoints size={20} />
          </span>
          <span className="flex-1">
            <span className="block text-[15px] font-black">Susun rencananya di Kanvas</span>
            <span className="block text-[12.5px] text-slate-500">
              Persiapan Nikah, Dana Darurat, KPR, Lunas Utang, dan lainnya
            </span>
          </span>
          <ChevronRight size={18} className="text-slate-400" />
        </Link>

        <p className="text-[11.5px] leading-relaxed text-slate-400">
          Batas di atas adalah pedoman umum perencanaan keuangan, bukan nasihat keuangan pribadi. Angka mengikuti
          catatanmu: beli investasi, transfer, dan utang-piutang tidak dihitung sebagai pemasukan/pengeluaran.
        </p>
      </div>
    </div>
  );
}
