"use client";

import { useState } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeftRight, ExternalLink, Gem, Landmark, Newspaper, Percent, Receipt, ShieldAlert, TrendingUp, Bitcoin, BarChart3, Layers, Radar, Wallet } from 'lucide-react';
import { LeoMascot } from '@/components/mascot/LeoMascot';
import type { useMarketData } from '@/lib/hooks/useMarketData';
import { BI_RATE, LPS, SBN_RETAIL, TAX_DEPOSITO, TAX_SBN, monthlyNet } from '@/lib/sbnData';
import { cn, formatIDR } from '@/lib/utils';
import type { InvestTab } from '@/components/investasi/InvestShell';

// Tab Kabar ("Radar Leo"): berita keuangan minggu ini dari RSS CNBC Indonesia
// lewat Worker (/api/member/kabar). Worker sudah menyaring: skor relevansi ke
// dompet, buang hiburan/promosi/duplikat, batas per topik. Judul & cuplikan
// asli + tautan sumber, tanpa ditulis ulang. "Buat kamu" dihitung dari
// lib/sbnData (angka resmi), bukan dari berita.

export type KabarItem = { id: string; title: string; summary: string; url: string; source: string; date: string; topic: string; score?: number; related?: number };
export type KabarState = { items: KabarItem[] | null; error: boolean; scanned?: number; relevant?: number };

const TOPIC: Record<string, { label: string; icon: typeof Percent; tone: string }> = {
  bunga: { label: 'Bunga', icon: Percent, tone: 'bg-violet-50 text-violet-700' },
  sbn: { label: 'SBN', icon: Landmark, tone: 'bg-teal-50 text-teal-700' },
  emas: { label: 'Emas', icon: Gem, tone: 'bg-amber-50 text-amber-700' },
  rupiah: { label: 'Rupiah', icon: ArrowLeftRight, tone: 'bg-sky-50 text-sky-700' },
  pajak: { label: 'Pajak', icon: Receipt, tone: 'bg-slate-100 text-slate-700' },
  saham: { label: 'Saham', icon: BarChart3, tone: 'bg-indigo-50 text-indigo-700' },
  kripto: { label: 'Kripto', icon: Bitcoin, tone: 'bg-orange-50 text-orange-700' },
  waspada: { label: 'Waspada', icon: ShieldAlert, tone: 'bg-rose-50 text-rose-700' },
  ekonomi: { label: 'Ekonomi', icon: TrendingUp, tone: 'bg-emerald-50 text-emerald-700' },
};
// Bagian keuangan pribadi yang biasanya tersentuh topik ini (umum, bukan
// tafsiran isi berita).
const AFFECTS: Record<string, string[]> = {
  bunga: ['Tabungan', 'Deposito', 'Cicilan'],
  sbn: ['Investasi', 'Pendapatan pasif'],
  emas: ['Investasi', 'Simpanan emas'],
  rupiah: ['Belanja impor', 'Liburan luar negeri'],
  pajak: ['Gaji', 'Hasil investasi'],
  saham: ['Investasi', 'Dana pensiun'],
  kripto: ['Investasi berisiko'],
  waspada: ['Keamanan uangmu'],
  ekonomi: ['Belanja harian'],
};
// Skor dari Worker → 1..5 titik relevansi.
const level = (score = 0) => Math.max(1, Math.min(5, Math.ceil(score / 3)));
const fmtDate = (iso: string, opt: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) => new Intl.DateTimeFormat('id-ID', opt).format(new Date(iso));
const short = (n: number) => (n >= 1e6 ? `Rp${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 2 })} jt` : formatIDR(n));

export function KabarList({ kabar, limit, compact, onOpenAll }: { kabar: KabarState; limit?: number; compact?: boolean; onOpenAll?: () => void }) {
  if (kabar.items === null) return <div className="space-y-2 py-1">{[1, 2, 3].slice(0, limit ?? 3).map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}</div>;
  if (kabar.items.length === 0) return <p className="py-4 text-center text-[13px] text-slate-500">{kabar.error ? 'Kabar belum bisa dimuat. Coba lagi nanti.' : 'Belum ada kabar minggu ini.'}</p>;
  const list = kabar.items.slice(0, limit);
  if (compact) {
    return (
      <ul className="divide-y divide-slate-100">
        {list.map((k) => {
          const t = TOPIC[k.topic] ?? TOPIC.ekonomi;
          return (
            <li key={k.id}>
              <button type="button" onClick={onOpenAll} className="flex w-full items-start gap-3 py-2.5 text-left">
                <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', t.tone)}><t.icon size={16} /></span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-slate-900">{k.title}</span>
                  <span className="text-[11px] text-slate-400">{t.label} · {k.source} · {fmtDate(k.date)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  }
  return null;
}

function Relevance({ score }: { score?: number }) {
  const n = level(score);
  return (
    <span className="inline-flex items-center gap-1" title={`Relevansi ${n}/5`} aria-label={`Relevansi ${n} dari 5`}>
      {[1, 2, 3, 4, 5].map((i) => <span key={i} className={cn('h-1.5 w-3 rounded-full', i <= n ? 'bg-emerald-400' : 'bg-slate-200')} />)}
    </span>
  );
}

export function TabKabar({ kabar, market, go }: { kabar: KabarState; market: ReturnType<typeof useMarketData>; go: (t: InvestTab) => void }) {
  const reduce = useReducedMotion();
  const [filter, setFilter] = useState<string>('semua');
  const top = SBN_RETAIL[0];
  const goldGram = market.gold ? market.gold.price_idr / 31.1035 : 0;
  const chips = [
    { label: 'BI-Rate', value: `${BI_RATE.rate.toLocaleString('id-ID')}%`, sub: `diputuskan ${fmtDate(BI_RATE.decided)}` },
    { label: 'Dijamin LPS', value: `${LPS.bankUmum.toLocaleString('id-ID')}%`, sub: 'bunga deposito maks.' },
    { label: 'SBN ritel', value: top ? `${top.coupon.toLocaleString('id-ID')}%` : '—', sub: top ? `tertinggi: ${top.code}` : '' },
    { label: 'Dolar AS', value: market.usdIdrRate ? formatIDR(Math.round(market.usdIdrRate)) : '—', sub: 'rupiah hari ini' },
    { label: 'Emas / gram', value: goldGram ? short(goldGram) : '—', sub: 'harga dunia' },
  ];
  const forYou = top ? `Rp10 jt sebulan, setelah pajak: deposito LPS ${formatIDR(monthlyNet(10_000_000, LPS.bankUmum, TAX_DEPOSITO))}, ${top.code} ${formatIDR(monthlyNet(10_000_000, top.coupon, TAX_SBN))}.` : '';

  const all = kabar.items ?? [];
  const counts = all.reduce<Record<string, number>>((m, k) => ({ ...m, [k.topic]: (m[k.topic] ?? 0) + 1 }), {});
  const topics = Object.keys(TOPIC).filter((t) => counts[t]);
  const shown = filter === 'semua' ? all : all.filter((k) => k.topic === filter);
  const [lead, ...rest] = shown;

  return (
    <div className="space-y-4">
      {/* Radar Leo */}
      <section className="relative overflow-hidden rounded-[32px] bg-[#0b1220] p-5 text-white md:p-7">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-[420px] w-[420px] md:right-0">
          {[1, 0.72, 0.46].map((s) => <span key={s} className="absolute inset-0 m-auto rounded-full border border-emerald-400/15" style={{ width: `${s * 100}%`, height: `${s * 100}%` }} />)}
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ background: 'conic-gradient(from 0deg, rgba(52,211,153,0.28), transparent 25%)' }}
            animate={reduce ? undefined : { rotate: 360 }}
            transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          />
        </div>
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-300"><Radar size={13} /> Radar Leo · {fmtDate(new Date().toISOString(), { weekday: 'long', day: 'numeric', month: 'short' })}</p>
            <h2 className="mt-3 text-[26px] font-extrabold leading-tight tracking-tight md:text-[34px]">Kabar yang nyentuh dompetmu</h2>
            {kabar.items && kabar.scanned ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
                <span className="rounded-full bg-white/10 px-3 py-1 tabular-nums">{kabar.scanned} berita dipindai</span>
                <span className="text-white/40">→</span>
                <span className="rounded-full bg-white/10 px-3 py-1 tabular-nums">{kabar.relevant ?? all.length} soal keuangan</span>
                <span className="text-white/40">→</span>
                <span className="rounded-full bg-emerald-400 px-3 py-1 font-bold text-[#0b1220] tabular-nums">{all.length} terpilih</span>
              </div>
            ) : (
              <p className="mt-2 max-w-md text-[13px] text-white/70">Leo memilah berita minggu ini — hiburan, promosi & berita kembar dibuang.</p>
            )}
          </div>
          <div className="hidden shrink-0 sm:block"><LeoMascot mood="watch" size={112} /></div>
        </div>
        <div className="relative -mx-5 mt-5 flex gap-2 overflow-x-auto px-5 no-scrollbar md:mx-0 md:grid md:grid-cols-5 md:px-0">
          {chips.map((c, i) => (
            <motion.div key={c.label} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }} className="w-[148px] shrink-0 rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10 backdrop-blur md:w-auto">
              <p className="text-[11px] text-white/55">{c.label}</p>
              <p className="text-[18px] font-extrabold tracking-tight tabular-nums">{c.value}</p>
              <p className="truncate text-[11px] text-white/40">{c.sub}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {kabar.items === null ? (
        <div className="grid gap-3 md:grid-cols-2">{[1, 2, 3, 4].map((i) => <div key={i} className="h-44 animate-pulse rounded-[24px] bg-white" />)}</div>
      ) : all.length === 0 ? (
        <div className="rounded-[24px] bg-white p-8 text-center ring-1 ring-slate-100">
          <Newspaper className="mx-auto text-slate-300" />
          <p className="mt-2 text-[15px] font-semibold text-slate-900">{kabar.error ? 'Kabar belum bisa dimuat' : 'Belum ada kabar penting minggu ini'}</p>
          <p className="mt-1 text-[13px] text-slate-500">Coba buka lagi nanti.</p>
        </div>
      ) : (
        <>
          <LayoutGroup id="kabar-filter">
            <div role="tablist" aria-label="Saring topik" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 no-scrollbar md:mx-0 md:flex-wrap md:px-0">
              {['semua', ...topics].map((t) => {
                const active = filter === t;
                const meta = TOPIC[t];
                return (
                  <button key={t} type="button" role="tab" aria-selected={active} onClick={() => setFilter(t)} className={cn('relative flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors', active ? 'text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50')}>
                    {active && <motion.span layoutId={reduce ? undefined : 'kabar-chip'} className="absolute inset-0 rounded-full bg-slate-900" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                    <span className="relative flex items-center gap-1.5">
                      {meta ? <meta.icon size={14} /> : <Layers size={14} />}
                      {meta?.label ?? 'Semua'}
                      <span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', active ? 'bg-white/20' : 'bg-slate-100 text-slate-500')}>{t === 'semua' ? all.length : counts[t]}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </LayoutGroup>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={filter} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -6 }} transition={{ duration: 0.2 }} className="space-y-3">
              {lead && <Story k={lead} lead forYou={forYou} go={go} />}
              <div className="grid gap-3 md:grid-cols-2">
                {rest.map((k, i) => (
                  <motion.div key={k.id} initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04 }}>
                    <Story k={k} forYou={forYou} go={go} />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </>
      )}
      <p className="text-center text-[12px] text-slate-400">Judul & cuplikan disalin apa adanya dari sumber berita. Angka BI-Rate, LPS & SBN dari lembaga resmi.</p>
    </div>
  );
}

function Story({ k, lead, forYou, go }: { k: KabarItem; lead?: boolean; forYou: string; go: (t: InvestTab) => void }) {
  const t = TOPIC[k.topic] ?? TOPIC.ekonomi;
  const money = (k.topic === 'bunga' || k.topic === 'sbn') && forYou;
  return (
    <article className={cn('flex h-full flex-col rounded-[26px] bg-white p-4 ring-1 ring-slate-100 md:p-5', lead && 'md:grid md:grid-cols-[1fr_280px] md:gap-6 md:p-6')}>
      <div className="flex min-w-0 flex-col">
        <div className="flex items-center justify-between gap-2">
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold', t.tone)}><t.icon size={13} /> {t.label}{lead && ' · paling penting'}</span>
          <span className="flex items-center gap-2 text-[12px] text-slate-400"><Relevance score={k.score} /> {fmtDate(k.date)}</span>
        </div>
        <h3 className={cn('mt-2 font-bold leading-snug text-slate-900', lead ? 'text-[20px] md:text-[24px]' : 'text-[16px]')}>{k.title}</h3>
        {k.summary && <p className={cn('mt-1 text-[14px] leading-relaxed text-slate-600', lead ? 'line-clamp-5' : 'line-clamp-3')}>{k.summary}</p>}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
          <a href={k.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-1.5 text-[13px] text-slate-500 hover:text-slate-900">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">{k.source[0]?.toUpperCase()}</span>
            <span className="truncate">{k.source}</span> <ExternalLink size={13} className="shrink-0" />
          </a>
          {k.related ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">+{k.related} berita serupa digabung</span> : null}
        </div>
      </div>
      <div className={cn('mt-3 space-y-2', lead && 'md:mt-0')}>
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-slate-50 p-2.5">
          <Wallet size={14} className="text-slate-400" />
          <span className="text-[11px] font-semibold text-slate-500">Berpengaruh ke</span>
          {(AFFECTS[k.topic] ?? AFFECTS.ekonomi).map((a) => <span key={a} className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">{a}</span>)}
        </div>
        {money && (
          <div className="flex items-center gap-2.5 rounded-2xl bg-emerald-50 p-2.5">
            <LeoMascot mood="happy" size={40} />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700/70">Buat kamu</p>
              <p className="text-[13px] font-semibold text-slate-800">{forYou}</p>
              <button type="button" onClick={() => go('sbn')} className="mt-1 text-[12px] font-bold text-emerald-700 hover:underline">Bandingkan di SBN →</button>
            </div>
          </div>
        )}
        {k.topic === 'waspada' && (
          <button type="button" onClick={() => go('belajar')} className="w-full rounded-2xl bg-rose-50 px-3 py-2 text-left text-[12px] font-bold text-rose-700 hover:bg-rose-100">Cara cek legalitas sebelum transfer →</button>
        )}
      </div>
    </article>
  );
}
