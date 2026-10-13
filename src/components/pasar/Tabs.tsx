"use client";

import { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeftRight, BadgePercent, Bell, ChevronRight, Coins, ExternalLink, Fuel, Landmark, Link2, Newspaper, Receipt, ShieldCheck, ShieldQuestion, TrendingDown, TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Investment } from '@/lib/services/investmentService';
import type { Transaction } from '@/lib/services/transactionService';
import { LeoMascot } from '@/components/mascot/LeoMascot';
import {
  card, daysTo, DEPO_TAX, DEPO_TAX_FREE, fmtDate, kuponRange, offerOpen, pct, rp, rpShort, SBN_TAX, SourceLink,
  type PasarFeed, type PasarNews,
} from '@/components/pasar/shared';

type Go = (t: 'pasar' | 'kabar' | 'sbn' | 'belajar') => void;
const toIdr = (t: Transaction) => Number(t.amountIDR) || Number(t.amount) || 0;

// Warna & ikon per topik berita (chip di pojok kartu).
const TOPIC_STYLE: Record<string, { icon: React.ReactNode; cls: string }> = {
  SBN: { icon: <Landmark size={12} />, cls: 'bg-emerald-50 text-emerald-700' },
  'Suku bunga': { icon: <BadgePercent size={12} />, cls: 'bg-sky-50 text-sky-700' },
  Deposito: { icon: <ShieldCheck size={12} />, cls: 'bg-indigo-50 text-indigo-700' },
  Emas: { icon: <Coins size={12} />, cls: 'bg-amber-50 text-amber-700' },
  Rupiah: { icon: <ArrowLeftRight size={12} />, cls: 'bg-blue-50 text-blue-700' },
  BBM: { icon: <Fuel size={12} />, cls: 'bg-orange-50 text-orange-700' },
  Pajak: { icon: <Receipt size={12} />, cls: 'bg-slate-200 text-slate-700' },
  Kripto: { icon: <Coins size={12} />, cls: 'bg-violet-50 text-violet-700' },
  Saham: { icon: <TrendingUp size={12} />, cls: 'bg-rose-50 text-rose-700' },
};
const TopicChip = ({ topic }: { topic: string }) => {
  const s = TOPIC_STYLE[topic] ?? { icon: <Newspaper size={12} />, cls: 'bg-slate-200 text-slate-700' };
  return <span className={cn('inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold', s.cls)}>{s.icon}{topic}</span>;
};

// ================= Kabar =================
export function KabarTab({ feed, news, transactions, investments, go }: { feed: PasarFeed | null; news: PasarNews[]; transactions: Transaction[]; investments: Investment[]; go: Go }) {
  const [nowMs] = useState(() => Date.now());
  const offer = feed?.sbnOffers.find(offerOpen) ?? null;

  // "Buat kamu": hubungkan kabar dengan data member sendiri.
  const forYou = (n: PasarNews): string | null => {
    const recent = transactions.filter((t) => t.type === 'pengeluaran' && +new Date(t.date) >= nowMs - 30 * 864e5);
    if (n.topic === 'BBM') {
      const fuel = recent.filter((t) => /bensin|bbm|pertalite|pertamax|spbu|solar/i.test(`${t.note ?? ''} ${t.subCategory ?? ''}`));
      return fuel.length ? `Bensinmu 30 hari terakhir: ${rp(fuel.reduce((s, t) => s + toIdr(t), 0))} (${fuel.length}×)` : null;
    }
    if (n.topic === 'SBN' && offer) return `${offer.seri} sedang dibuka${daysTo(offer.akhir) !== null ? `, ${daysTo(offer.akhir)} hari lagi` : ''}`;
    if (n.topic === 'Emas') {
      const gold = investments.filter((i) => /emas|gold|antam/i.test(i.name));
      return gold.length ? `Kamu punya ${gold.length} catatan emas di Investasi` : null;
    }
    if ((n.topic === 'Deposito' || n.topic === 'Suku bunga') && feed?.lps) return `Bunga deposito yang dijamin LPS sekarang ${pct(feed.lps.umum)}`;
    return null;
  };

  const stats = [
    feed?.biRate && { label: 'BI-Rate', value: pct(feed.biRate.rate), sub: `diputuskan ${fmtDate(feed.biRate.date)}` },
    feed?.lps && { label: 'Dijamin LPS', value: pct(feed.lps.umum), sub: 'bunga deposito maks.' },
    feed?.usdIdr && { label: 'Dolar AS', value: rp(feed.usdIdr), sub: 'rupiah hari ini' },
    feed?.goldGramIdr && { label: 'Emas per gram', value: rpShort(feed.goldGramIdr), sub: 'harga dunia' },
  ].filter(Boolean) as { label: string; value: string; sub: string }[];

  return (
    <div className="space-y-4">
      <section className={cn(card, 'relative overflow-hidden px-5 py-6')}>
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Pasar & belajar · {fmtDate(new Date(), { weekday: 'long', day: 'numeric', month: 'short' })}</p>
        <h2 className="mt-1 text-[28px] font-bold tracking-tight text-slate-900">Kabar uang minggu ini</h2>
        <p className="text-sm text-slate-600">Dipilih Leo dari berita minggu ini. Tiap kabar ada sumbernya.</p>
        <div className="absolute -bottom-3 right-6 hidden md:block"><LeoMascot mood="happy" size={120} /></div>
      </section>

      <div className="flex flex-wrap gap-3">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className={cn(card, 'w-[132px] px-3 py-2.5')}>
            <p className="text-[11px] font-semibold text-slate-600">{s.label}</p>
            <p className="text-base font-bold text-slate-900 tabular-nums">{s.value}</p>
            <p className="truncate text-[10px] text-slate-400">{s.sub}</p>
          </motion.div>
        ))}
      </div>

      {offer && (
        <button type="button" onClick={() => go('sbn')} className={cn(card, 'flex w-full items-center gap-3 p-3.5 text-left hover:bg-slate-100')}>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><Landmark size={18} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-slate-900">{offer.seri} sedang ditawarkan</span>
            <span className="block text-xs text-slate-500">{daysTo(offer.akhir) !== null ? `${daysTo(offer.akhir)} hari lagi · ` : ''}{offer.tenors.map((t) => pct(t.kupon)).join(' · ')}</span>
          </span>
          <span className="flex items-center gap-1 text-[13px] font-semibold text-slate-700">Lihat di SBN <ChevronRight size={15} /></span>
        </button>
      )}

      {news.length === 0 ? (
        <p className={cn(card, 'p-6 text-center text-sm text-slate-500')}>Belum ada kabar minggu ini.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {news.map((n, i) => {
            const mine = forYou(n);
            return (
              <motion.article key={n.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }} className={cn(card, 'flex flex-col p-4')}>
                <div className="flex items-center justify-between"><TopicChip topic={n.topic} /><span className="text-[11px] text-slate-400">{fmtDate(n.published_at)}</span></div>
                <h3 className="mt-2.5 text-[17px] font-bold leading-snug text-slate-900">{n.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600">{n.summary}</p>
                {mine && (
                  <div className="mt-3 flex items-center gap-2.5 rounded-2xl bg-slate-200/50 px-3 py-2">
                    <LeoMascot mood="happy" size={30} />
                    <span>
                      <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Buat kamu</span>
                      <span className="block text-[13px] text-slate-800">{mine}</span>
                    </span>
                  </div>
                )}
                <div className="mt-auto flex items-center justify-between pt-3">
                  <SourceLink url={n.url} name={n.source} />
                  {n.topic === 'SBN' && offer && <button type="button" onClick={() => go('sbn')} className="rounded-full bg-slate-200/70 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-200">Bandingkan di SBN</button>}
                  {n.topic === 'Pajak' && <Link href="/membership/pajak-center" className="rounded-full bg-slate-200/70 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-200">Buka Pajak</Link>}
                </div>
              </motion.article>
            );
          })}
        </div>
      )}
      <p className="pt-1 text-center text-xs text-slate-400">Ringkasan ditulis Leo dari halaman beritanya; angka yang tidak tertulis di sumber dibuang otomatis.</p>
    </div>
  );
}

// ================= SBN =================
export function SbnTab({ feed }: { feed: PasarFeed | null }) {
  const [amt, setAmt] = useState(10_000_000);
  const [howTo, setHowTo] = useState(false);
  const [nowMs] = useState(() => Date.now());
  const offers = feed?.sbnOffers ?? [];
  const offer = offers.find(offerOpen) ?? offers[0] ?? null;
  const best = offers.flatMap((o) => o.tenors.map((t) => ({ o, t }))).sort((a, b) => b.t.kupon - a.t.kupon)[0];
  const ladder = [
    feed?.lps && { label: 'Deposito LPS', value: feed.lps.umum, sub: 'dijamin, paling tinggi', tone: 'bg-slate-200' },
    feed?.biRate && { label: 'BI-Rate', value: feed.biRate.rate, sub: `diputuskan ${fmtDate(feed.biRate.date)}`, tone: 'bg-violet-200' },
    best && { label: 'SBN ritel', value: best.t.kupon, sub: `tertinggi: ${best.o.seri}${best.t.label}`, tone: 'bg-teal-600 text-white' },
  ].filter(Boolean) as { label: string; value: number; sub: string; tone: string }[];
  const top = Math.max(1, ...ladder.map((l) => l.value));

  const monthly = (rate: number, kind: 'sbn' | 'depo') => ((amt * rate) / 100 / 12) * (1 - (kind === 'sbn' ? SBN_TAX : amt <= DEPO_TAX_FREE ? 0 : DEPO_TAX));
  const rows = [
    ...offers.flatMap((o) => o.tenors.map((t) => ({ name: `${o.seri}${t.label}`, open: offerOpen(o), sub: `${t.minimal ? 'min. ' : ''}${pct(t.kupon)}`, v: monthly(t.kupon, 'sbn'), tone: 'bg-orange-500' }))),
    ...(feed?.lps ? [{ name: 'Deposito', open: false, sub: `bunga LPS ${pct(feed.lps.umum)}`, v: monthly(feed.lps.umum, 'depo'), tone: 'bg-slate-400' }] : []),
  ];
  const rowMax = Math.max(1, ...rows.map((r) => r.v));
  const issueYear = offer?.akhir ? new Date(offer.akhir).getFullYear() : null;
  const progress = offer?.mulai && offer.akhir ? Math.min(100, Math.max(0, ((nowMs - new Date(offer.mulai).getTime()) / (new Date(offer.akhir).getTime() - new Date(offer.mulai).getTime())) * 100)) : null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {/* Tangga bunga */}
        <section className={cn(card, 'flex flex-col p-4')}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Tangga bunga</p>
          <p className="text-xl font-bold text-slate-900">{best ? `SBN ritel sampai ${pct(best.t.kupon)} setahun` : 'Bunga hari ini'}</p>
          <div className="mt-6 flex flex-1 items-end gap-2.5">
            {ladder.map((l, i) => (
              <div key={l.label} className="relative flex flex-1 flex-col items-center justify-end">
                {i === ladder.length - 1 && <div className="absolute -top-12"><LeoMascot mood="happy" size={56} /></div>}
                <motion.div className={cn('flex w-full items-start justify-center rounded-t-xl pt-3 text-sm font-bold', l.tone)} initial={{ height: 0 }} animate={{ height: `${60 + (l.value / top) * 90}px` }} transition={{ delay: i * 0.1, type: 'spring', stiffness: 120, damping: 16 }}>
                  {pct(l.value)}
                </motion.div>
                <p className="mt-2 text-[13px] font-bold text-slate-800">{l.label}</p>
                <p className="text-[11px] text-slate-500">{l.sub}</p>
              </div>
            ))}
          </div>
          {feed?.lps && best && <p className="mt-3 text-[13px] text-slate-600">Kupon SBN ritel yang sedang ditawarkan sampai {pct(best.t.kupon)}. Deposito cuma dijamin sampai {pct(feed.lps.umum)}.</p>}
        </section>

        {/* Penawaran */}
        {offer ? (
          <section className={cn(card, 'p-4')}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold', offerOpen(offer) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600')}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', offerOpen(offer) ? 'bg-emerald-500' : 'bg-slate-400')} />{offerOpen(offer) ? 'Sedang dibuka' : 'Tidak sedang dibuka'}
                </span>
                {offerOpen(offer) && daysTo(offer.akhir) !== null && <span className="text-xs font-semibold text-slate-600">{daysTo(offer.akhir)} hari lagi</span>}
              </span>
              <a href={offer.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800">{offer.sourceName} <ExternalLink size={11} /></a>
            </div>
            <p className="mt-2 text-[28px] font-bold text-orange-600">{offer.seri}</p>
            <p className="text-sm text-slate-600">{offer.jenis || 'SBN ritel'} · {kuponRange(offer)}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {offer.tenors.map((t) => (
                <div key={t.label} className="rounded-2xl bg-slate-200/50 p-3">
                  <p className="text-xs font-semibold text-slate-600">{t.label}{t.tahun ? ` · ${t.tahun} tahun` : ''}</p>
                  <p className="text-lg font-bold text-slate-900">{t.minimal && <span className="mr-1 text-xs font-normal text-slate-500">min.</span>}{pct(t.kupon)}</p>
                  {issueYear && t.tahun && <p className="text-[11px] text-slate-500">sampai {issueYear + t.tahun}</p>}
                </div>
              ))}
            </div>
            {progress !== null && offer.mulai && offer.akhir && (
              <div className="mt-4">
                <div className="relative h-1.5 rounded-full bg-slate-200">
                  <motion.div className="h-full rounded-full bg-orange-500" initial={{ width: 0 }} animate={{ width: `${progress}%` }} />
                  <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-900" style={{ left: `${progress}%` }} />
                </div>
                <div className="mt-1.5 flex justify-between text-[11px] text-slate-500"><span>{fmtDate(offer.mulai)}</span><span>{fmtDate(offer.akhir)}</span></div>
              </div>
            )}
            {offer.minBeli && <p className="mt-2 text-[13px] text-slate-600">mulai {rp(offer.minBeli)}</p>}
            {offerOpen(offer) && offer.akhir && (
              <a
                href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Beli ${offer.seri} (penawaran ditutup ${fmtDate(offer.akhir)})`)}&dates=${offer.akhir.replace(/-/g, '')}/${offer.akhir.replace(/-/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-slate-900 text-[15px] font-semibold text-white hover:bg-slate-800"
              ><Bell size={16} /> Ingatkan sebelum {fmtDate(offer.akhir)}</a>
            )}
            <button type="button" onClick={() => setHowTo((v) => !v)} className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-slate-200/70 text-[15px] font-semibold text-slate-800 hover:bg-slate-200"><ExternalLink size={15} /> Cara beli</button>
            <AnimatePresence initial={false}>
              {howTo && (
                <motion.ol initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-2 list-decimal space-y-1.5 overflow-hidden rounded-2xl bg-white p-4 pl-8 text-sm text-slate-700">
                  <li>Pilih mitra distribusi resmi (bank, perusahaan efek, atau aplikasi investasi) — daftarnya ada di situs DJPPR.</li>
                  <li>Daftar akun: siapkan KTP (NIK), rekening bank, dan SID (dibuat saat daftar).</li>
                  <li>Pesan {offer.seri} di masa penawaran, pilih tenor & nominal, lalu bayar dengan kode billing.</li>
                  <li>Setelah terbit, catat di Investasi supaya ikut di Kekayaan.</li>
                </motion.ol>
              )}
            </AnimatePresence>
          </section>
        ) : (
          <section className={cn(card, 'flex flex-col items-center justify-center p-6 text-center')}>
            <LeoMascot mood="idle" size={80} />
            <p className="mt-2 font-bold text-slate-900">Belum ada penawaran SBN ritel terdeteksi</p>
            <p className="text-sm text-slate-500">Leo memantau berita tiap hari. Jadwal resmi ada di DJPPR Kemenkeu.</p>
          </section>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Sebulan dapat berapa */}
        {rows.length > 0 && (
          <section className={cn(card, 'p-4')}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Sebulan dapat berapa?</p>
            <p className="mt-2 text-sm text-slate-600">Kalau</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[1, 5, 10, 50, 100].map((j) => (
                <button key={j} type="button" onClick={() => setAmt(j * 1e6)} className={cn('rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors', amt === j * 1e6 ? 'bg-slate-900 text-white' : 'bg-slate-200/70 text-slate-700 hover:bg-slate-200')}>Rp {j} jt</button>
              ))}
            </div>
            <ul className="mt-4 space-y-3">
              {rows.map((r) => (
                <li key={r.name} className="grid grid-cols-[110px_1fr_auto] items-center gap-3">
                  <span>
                    <span className="block text-sm font-bold text-slate-900">{r.name}</span>
                    <span className="text-[10px] font-semibold text-slate-500">{r.open && <b className="mr-1 text-emerald-600">DIBUKA</b>}{r.sub}</span>
                  </span>
                  <span className="h-2 overflow-hidden rounded-full bg-slate-200"><motion.span className={cn('block h-full rounded-full', r.tone)} initial={{ width: 0 }} animate={{ width: `${(r.v / rowMax) * 100}%` }} transition={{ duration: 0.5 }} /></span>
                  <motion.span key={`${r.name}-${amt}`} initial={{ opacity: 0.3 }} animate={{ opacity: 1 }} className="w-24 text-right text-sm font-bold text-slate-900 tabular-nums">{rp(r.v)}</motion.span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-slate-500">Setelah pajak: kupon SBN 10%, bunga deposito 20% (s.d. Rp7,5 jt tidak dipotong). Kupon mengambang bisa berubah tiap 3 bulan.</p>
          </section>
        )}

        {/* Sumber */}
        <section className={cn(card, 'p-4')}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Sumber</p>
          <ul className="mt-3 space-y-2">
            {(feed?.sources ?? []).filter((s) => s.at).map((s) => (
              <li key={s.name} className="flex items-center justify-between rounded-2xl bg-white px-3.5 py-3 text-sm">
                <span><b className="text-slate-800">{s.name}</b><span className="block text-xs text-slate-500">dibaca {fmtDate(s.at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></span>
                <a href={s.url} target="_blank" rel="noopener noreferrer" aria-label={`Buka ${s.name}`} className="text-slate-400 hover:text-slate-700"><ExternalLink size={15} /></a>
              </li>
            ))}
            {offer && <li className="rounded-2xl bg-white px-3.5 py-3 text-sm"><b className="text-slate-800">Penawaran {offer.seri}</b><span className="block text-xs text-slate-500">dari berita {offer.sourceName}</span></li>}
          </ul>
          {feed?.biRate?.via && <p className="mt-2 text-xs text-slate-500">BI-Rate dibaca dari berita {feed.biRate.via.name} karena situs BI sedang tidak bisa diakses.</p>}
          <p className="mt-3 text-[11px] text-slate-400">Angka resmi dari tiap lembaga. Pilihannya tetap di kamu.</p>
        </section>
      </div>
    </div>
  );
}

// ================= Belajar =================
function Lesson({ icon, tone, title, points, links, children }: { icon: React.ReactNode; tone: string; title: string; points: React.ReactNode[]; links: { label: string; url: string }[]; children?: React.ReactNode }) {
  const dot = tone.split(' ').find((c) => c.startsWith('text-'))?.replace('text-', 'bg-') ?? 'bg-slate-400';
  return (
    <motion.section initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} className={cn(card, 'flex flex-col p-4')}>
      <div className="flex items-center gap-3">
        <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', tone)}>{icon}</span>
        <h3 className="text-[17px] font-bold text-slate-900">{title}</h3>
      </div>
      <ul className="mt-3 space-y-2">
        {points.map((p, i) => (
          <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-slate-700"><span className={cn('mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full', dot)} /><span>{p}</span></li>
        ))}
      </ul>
      {children && <div className="mt-3">{children}</div>}
      <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-3">
        {links.map((l) => (
          <a key={l.url + l.label} href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"><Link2 size={12} /> {l.label}</a>
        ))}
      </div>
    </motion.section>
  );
}

export function BelajarTab({ feed }: { feed: PasarFeed | null }) {
  const floating = (feed?.sbnOffers ?? []).filter((o) => /^(SBR|ST)/.test(o.seri)).slice(0, 2);
  const bi = feed?.biRate?.rate;
  const sbnRow = floating[0] ? { name: `${floating[0].seri}${floating[0].tenors[floating[0].tenors.length - 1].label}`, rate: floating[0].tenors[floating[0].tenors.length - 1].kupon } : null;
  const ex = [
    sbnRow && { name: `${sbnRow.name} · ${pct(sbnRow.rate)}`, v: ((10e6 * sbnRow.rate) / 100 / 12) * (1 - SBN_TAX), tone: 'bg-teal-600' },
    feed?.lps && { name: `Deposito · ${pct(feed.lps.umum)}`, v: ((10e6 * feed.lps.umum) / 100 / 12) * (1 - DEPO_TAX), tone: 'bg-slate-400' },
  ].filter(Boolean) as { name: string; v: number; tone: string }[];
  const exMax = Math.max(1, ...ex.map((e) => e.v));

  return (
    <div className="grid items-start gap-4 md:grid-cols-2">
      <Lesson icon={<Landmark size={18} />} tone="bg-emerald-50 text-emerald-600" title="SBN itu apa?" links={[{ label: 'DJPPR · SBN ritel', url: 'https://www.djppr.kemenkeu.go.id/' }]} points={[
        'Surat Berharga Negara: kamu meminjamkan uang ke negara. Negara membayar kupon tiap bulan dan mengembalikan pokoknya saat jatuh tempo.',
        'Pokok dan kuponnya dijamin undang-undang: negara wajib membayarnya saat jatuh tempo.',
        'SBN ritel bisa dibeli mulai Rp1 juta, lewat bank atau aplikasi yang jadi mitra distribusi, saat masa penawaran.',
        'Ada empat jenis: ORI dan SBR (konvensional), SR dan ST (syariah).',
      ]} />

      <Lesson icon={<TrendingUp size={18} />} tone="bg-orange-50 text-orange-600" title="Kupon tetap atau mengambang" links={[{ label: 'DJPPR', url: 'https://www.djppr.kemenkeu.go.id/' }]} points={[
        'ORI dan SR: kuponnya tetap sampai jatuh tempo.',
        'SBR dan ST: kupon = BI-Rate + spread, disesuaikan tiap tiga bulan.',
        'Kupon pertamanya jadi kupon minimal: kalau BI-Rate turun, kupon tidak ikut turun di bawahnya.',
      ]}>
        {bi !== undefined && floating.length > 0 && (
          <div className="space-y-2 rounded-2xl bg-slate-200/50 p-3">
            {floating.map((o) => {
              const t = o.tenors[o.tenors.length - 1];
              return (
                <div key={o.seri}>
                  <p className="text-[10px] font-bold text-slate-500">{o.seri}{t.label}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm">
                    <span className="rounded-full bg-white px-2 py-0.5 font-bold">BI {pct(bi)}</span>+
                    <span className="rounded-full bg-teal-50 px-2 py-0.5 font-bold text-teal-700">spread {pct(Math.max(0, +(t.kupon - bi).toFixed(2)))}</span>=
                    <b className="text-base">{pct(t.kupon)}</b>
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </Lesson>

      <Lesson icon={<ArrowLeftRight size={18} />} tone="bg-blue-50 text-blue-600" title="Butuh uangnya sebelum jatuh tempo?" links={[{ label: 'DJPPR', url: 'https://www.djppr.kemenkeu.go.id/' }]} points={[
        'ORI dan SR bisa dijual di pasar sekunder setelah lewat masa tahan minimal.',
        'Harganya bisa di atas atau di bawah 100% dari nominal, tergantung pasar hari itu.',
        'SBR dan ST tidak bisa dijual, tapi sebagian bisa dicairkan lebih awal (early redemption) di tanggal yang sudah ditentukan.',
      ]} />

      <Lesson icon={<Receipt size={18} />} tone="bg-slate-200 text-slate-600" title="Pajaknya: 10% atau 20%" links={[{ label: 'PP 91/2021', url: 'https://peraturan.bpk.go.id/Details/174980/pp-no-91-tahun-2021' }]} points={[
        'Kupon SBN kena PPh final 10%, langsung dipotong.',
        'Bunga deposito dan tabungan kena PPh final 20%. Simpanan sampai Rp7,5 juta tidak dipotong.',
      ]}>
        {ex.length > 0 && (
          <div className="rounded-2xl bg-slate-200/50 p-3">
            <p className="text-[10px] font-bold text-slate-500">Rp 10 jt sebulan, setelah pajak</p>
            {ex.map((e) => (
              <div key={e.name} className="mt-2">
                <div className="flex justify-between text-sm"><span>{e.name}</span><b className="tabular-nums">{rp(e.v)}</b></div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-white"><motion.div className={cn('h-full rounded-full', e.tone)} initial={{ width: 0 }} whileInView={{ width: `${(e.v / exMax) * 100}%` }} viewport={{ once: true }} /></div>
              </div>
            ))}
          </div>
        )}
      </Lesson>

      <Lesson icon={<ShieldCheck size={18} />} tone="bg-indigo-50 text-indigo-600" title="Jaminan LPS untuk tabunganmu" links={[{ label: 'LPS', url: 'https://www.lps.go.id/' }]} points={[
        'LPS menjamin simpanan di bank sampai Rp2 miliar per nasabah per bank.',
        'Syaratnya 3T: tercatat di pembukuan bank, bunganya tidak melebihi bunga penjaminan LPS, dan tidak melakukan tindakan yang merugikan bank.',
        'Simpanan yang bunganya di atas bunga penjaminan tidak dijamin sama sekali.',
      ]}>
        {feed?.lps && (
          <div className="grid grid-cols-3 gap-2 text-center">
            {([['Bank umum', feed.lps.umum], ['BPR', feed.lps.bpr], ['Valas', feed.lps.valas]] as const).map(([l, v]) => (
              <div key={l} className="rounded-2xl bg-slate-200/50 p-2.5"><p className="text-lg font-bold">{pct(v)}</p><p className="text-[11px] text-slate-500">{l}</p></div>
            ))}
            <p className="col-span-3 text-[11px] text-slate-500">{feed.lps.periode}</p>
          </div>
        )}
      </Lesson>

      <Lesson icon={<TrendingDown size={18} />} tone="bg-rose-50 text-rose-600" title="Suku bunga naik, harga obligasi turun" links={[{ label: 'OJK · Sikapi Uangmu', url: 'https://sikapiuangmu.ojk.go.id/' }]} points={[
        'Harga obligasi bergerak berlawanan dengan suku bunga: kalau suku bunga naik, harga obligasi yang sudah beredar turun, dan sebaliknya.',
        'Ini penting kalau kamu menjual ORI atau SR sebelum jatuh tempo. Kalau dipegang sampai jatuh tempo, negara membayar kembali pokoknya penuh.',
      ]} />

      <Lesson icon={<ShieldQuestion size={18} />} tone="bg-amber-50 text-amber-600" title="Cek dulu sebelum pinjam atau investasi" links={[{ label: 'OJK', url: 'https://www.ojk.go.id/' }]} points={[
        'Pastikan perusahaannya berizin dan diawasi OJK.',
        'Waspadai janji untung pasti yang terlalu tinggi, apalagi kalau diminta mengajak orang lain.',
        <>Ragu? Tanya Kontak OJK <b>157</b> atau WhatsApp <b>081-157-157-157</b>.</>,
      ]} />
    </div>
  );
}
