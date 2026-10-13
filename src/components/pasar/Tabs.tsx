"use client";

import { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, ChevronDown, ChevronRight, ExternalLink, Landmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Investment } from '@/lib/services/investmentService';
import type { Transaction } from '@/lib/services/transactionService';
import {
  card, daysTo, DEPO_TAX, DEPO_TAX_FREE, fmtDate, kuponRange, offerOpen, pct, rp, rpShort, SBN_TAX, SourceLink, TOPIC_EMOJI,
  type PasarFeed, type PasarNews,
} from '@/components/pasar/shared';

type Go = (t: 'pasar' | 'kabar' | 'sbn' | 'belajar') => void;
const toIdr = (t: Transaction) => Number(t.amountIDR) || Number(t.amount) || 0;

// ================= Kabar =================
export function KabarTab({ feed, news, transactions, investments, go }: { feed: PasarFeed | null; news: PasarNews[]; transactions: Transaction[]; investments: Investment[]; go: Go }) {
  const [topic, setTopic] = useState<string | null>(null);
  const [nowMs] = useState(() => Date.now());
  const offer = feed?.sbnOffers.find(offerOpen) ?? null;
  const topics = [...new Set(news.map((n) => n.topic))];
  const shown = topic ? news.filter((n) => n.topic === topic) : news;

  // "Buat kamu": hubungkan kabar dengan data member sendiri.
  const forYou = (n: PasarNews): string | null => {
    const since = nowMs - 30 * 864e5;
    const recent = transactions.filter((t) => t.type === 'pengeluaran' && +new Date(t.date) >= since);
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
    if (n.topic === 'Pajak') return 'Cek perkiraan SPT-mu di Pajak';
    return null;
  };

  const stats = [
    feed?.biRate && { label: 'BI-Rate', value: pct(feed.biRate.rate), sub: `diputuskan ${fmtDate(feed.biRate.date)}` },
    feed?.lps && { label: 'Dijamin LPS', value: pct(feed.lps.umum), sub: 'bunga deposito maks.' },
    feed?.usdIdr && { label: 'Dolar AS', value: rp(feed.usdIdr), sub: 'kurs hari ini' },
    feed?.goldGramIdr && { label: 'Emas per gram', value: rpShort(feed.goldGramIdr), sub: 'harga dunia' },
  ].filter(Boolean) as { label: string; value: string; sub: string }[];

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{fmtDate(new Date(), { weekday: 'long', day: 'numeric', month: 'short' })}</p>
      <h2 className="mt-1 text-[28px] font-extrabold tracking-tight text-slate-900">Kabar uang minggu ini</h2>
      <p className="text-slate-500">Dipilih Leo dari berita minggu ini. Tiap kabar ada sumbernya.</p>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className={cn(card, 'p-4')}>
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className="text-xl font-extrabold tracking-tight text-slate-900 tabular-nums">{s.value}</p>
            <p className="text-[11px] text-slate-400">{s.sub}</p>
          </motion.div>
        ))}
      </div>

      {offer && (
        <button type="button" onClick={() => go('sbn')} className={cn(card, 'mt-3 flex w-full items-center gap-3 p-4 text-left hover:bg-slate-100')}>
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><Landmark size={18} /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold text-slate-900">{offer.seri} sedang ditawarkan</span>
            <span className="block text-sm text-slate-500">{daysTo(offer.akhir) !== null ? `${daysTo(offer.akhir)} hari lagi · ` : ''}{offer.tenors.map((t) => pct(t.kupon)).join(' · ')}</span>
          </span>
          <span className="flex items-center gap-1 text-sm font-semibold text-slate-600">Lihat di SBN <ChevronRight size={15} /></span>
        </button>
      )}

      {topics.length > 1 && (
        <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto">
          {[null, ...topics].map((t) => (
            <button key={t ?? 'semua'} type="button" onClick={() => setTopic(t)} className={cn('shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors', topic === t ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')}>
              {t ? `${TOPIC_EMOJI[t] ?? ''} ${t}` : 'Semua'}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {shown.length === 0 && <p className={cn(card, 'p-6 text-center text-sm text-slate-500')}>Belum ada kabar minggu ini.</p>}
        <AnimatePresence initial={false}>
          {shown.map((n, i) => {
            const mine = forYou(n);
            return (
              <motion.article key={n.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }} className={cn(card, 'p-5')}>
                <p className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white">{TOPIC_EMOJI[n.topic] ?? '📰'}</span>
                  {n.topic} <span className="ml-auto font-normal text-slate-400">{fmtDate(n.published_at)}</span>
                </p>
                <h3 className="mt-2 text-[17px] font-bold leading-snug text-slate-900">{n.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{n.summary}</p>
                {mine && (
                  <p className="mt-3 rounded-2xl bg-white px-3.5 py-2.5 text-[13px] text-slate-700">
                    <span className="mr-1.5 text-[10px] font-bold uppercase tracking-wide text-indigo-500">Buat kamu</span>{mine}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <SourceLink url={n.url} name={n.source} />
                  {n.topic === 'SBN' && offer && <button type="button" onClick={() => go('sbn')} className="text-xs font-bold text-slate-600 hover:text-slate-900">Bandingkan di SBN</button>}
                  {n.topic === 'Pajak' && <Link href="/membership/pajak-center" className="text-xs font-bold text-slate-600 hover:text-slate-900">Buka Pajak</Link>}
                </div>
              </motion.article>
            );
          })}
        </AnimatePresence>
      </div>
      <p className="mt-4 text-center text-xs text-slate-400">Ringkasan ditulis Leo dari berita aslinya; angka yang tidak tertulis di sumber dibuang otomatis.</p>
    </div>
  );
}

// ================= SBN =================
export function SbnTab({ feed }: { feed: PasarFeed | null }) {
  const [amt, setAmt] = useState(10_000_000);
  const [howTo, setHowTo] = useState<string | null>(null);
  const [nowMs] = useState(() => Date.now());
  const offers = feed?.sbnOffers ?? [];
  const best = offers.flatMap((o) => o.tenors.map((t) => ({ o, t }))).sort((a, b) => b.t.kupon - a.t.kupon)[0];
  const ladder = [
    feed?.lps && { label: 'Deposito LPS', value: feed.lps.umum, sub: 'dijamin, paling tinggi', tone: 'bg-amber-400' },
    feed?.biRate && { label: 'BI-Rate', value: feed.biRate.rate, sub: `diputuskan ${fmtDate(feed.biRate.date)}`, tone: 'bg-sky-400' },
    best && { label: 'SBN ritel', value: best.t.kupon, sub: `tertinggi: ${best.o.seri}${best.t.label}`, tone: 'bg-emerald-500' },
  ].filter(Boolean) as { label: string; value: number; sub: string; tone: string }[];
  const top = Math.max(1, ...ladder.map((l) => l.value));

  const monthly = (rate: number, kind: 'sbn' | 'depo') => ((amt * rate) / 100 / 12) * (1 - (kind === 'sbn' ? SBN_TAX : amt <= DEPO_TAX_FREE ? 0 : DEPO_TAX));
  const rows = [
    ...offers.flatMap((o) => o.tenors.map((t) => ({ name: `${o.seri}${t.label}`, open: offerOpen(o), sub: `${t.minimal ? 'min. ' : ''}${pct(t.kupon)}`, v: monthly(t.kupon, 'sbn') }))),
    ...(feed?.lps ? [{ name: 'Deposito', open: false, sub: `bunga LPS ${pct(feed.lps.umum)}`, v: monthly(feed.lps.umum, 'depo') }] : []),
  ].sort((a, b) => b.v - a.v);

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="text-[28px] font-extrabold tracking-tight text-slate-900">SBN hari ini</h2>
      {feed && <p className="text-slate-500">Diperbarui {fmtDate(feed.fetchedAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>}

      <section className={cn(card, 'mt-5 p-5')}>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Tangga bunga</p>
        {best && <p className="mt-1 text-lg font-extrabold text-slate-900">SBN ritel sampai {pct(best.t.kupon)} setahun</p>}
        <div className="mt-4 flex h-40 items-end gap-4">
          {ladder.map((l, i) => (
            <div key={l.label} className="flex flex-1 flex-col items-center justify-end gap-2">
              <span className="text-lg font-extrabold text-slate-900 tabular-nums">{pct(l.value)}</span>
              <motion.span className={cn('w-full rounded-t-2xl', l.tone)} initial={{ height: 0 }} animate={{ height: `${(l.value / top) * 100}px` }} transition={{ delay: i * 0.1, type: 'spring', stiffness: 120, damping: 16 }} />
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-4">
          {ladder.map((l) => (
            <div key={l.label} className="flex-1 text-center">
              <p className="text-sm font-bold text-slate-800">{l.label}</p>
              <p className="text-[11px] text-slate-500">{l.sub}</p>
            </div>
          ))}
        </div>
        {feed?.lps && best && <p className="mt-4 text-sm text-slate-600">Kupon SBN ritel yang sedang ditawarkan sampai {pct(best.t.kupon)}. Deposito cuma dijamin LPS sampai {pct(feed.lps.umum)}.</p>}
      </section>

      {offers.length === 0 ? (
        <p className={cn(card, 'mt-4 p-5 text-sm text-slate-600')}>Belum ada penawaran SBN ritel yang terdeteksi dari berita minggu ini. Jadwal resmi ada di situs DJPPR Kemenkeu.</p>
      ) : offers.map((o) => {
        const open = offerOpen(o);
        const left = daysTo(o.akhir);
        const total = o.mulai && o.akhir ? (new Date(o.akhir).getTime() - new Date(o.mulai).getTime()) / 864e5 : null;
        const passed = o.mulai ? (nowMs - new Date(o.mulai).getTime()) / 864e5 : null;
        return (
          <section key={o.seri} className={cn(card, 'mt-4 p-5')}>
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className={cn('rounded-full px-2.5 py-1', open ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600')}>{open ? 'Sedang dibuka' : 'Segera / sudah lewat'}</span>
              {open && left !== null && <span className="text-slate-500">{left} hari lagi</span>}
            </div>
            <p className="mt-3 text-2xl font-extrabold text-slate-900">{o.seri}</p>
            <p className="text-sm text-slate-500">{o.jenis || 'SBN ritel'} · {kuponRange(o)}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {o.tenors.map((t) => (
                <div key={t.label} className="rounded-2xl bg-white p-4">
                  <p className="text-sm font-semibold text-slate-600">{t.label}{t.tahun ? ` · ${t.tahun} tahun` : ''}</p>
                  <p className="text-3xl font-extrabold text-slate-900">{t.minimal && <span className="mr-1 text-sm font-semibold text-slate-400">min.</span>}{pct(t.kupon)}</p>
                </div>
              ))}
            </div>
            {o.mulai && o.akhir && total && passed !== null && (
              <div className="mt-4">
                <div className="h-2 overflow-hidden rounded-full bg-slate-200"><motion.div className="h-full rounded-full bg-emerald-500" initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(0, (passed / total) * 100))}%` }} /></div>
                <div className="mt-1 flex justify-between text-xs text-slate-500"><span>{fmtDate(o.mulai)}</span><span>{fmtDate(o.akhir)}</span></div>
              </div>
            )}
            {o.minBeli && <p className="mt-2 text-xs text-slate-500">Mulai {rp(o.minBeli)}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {open && o.akhir && (
                <a
                  href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Beli ${o.seri} (penawaran ditutup)`)}&dates=${o.akhir.replace(/-/g, '')}/${o.akhir.replace(/-/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                ><Bell size={14} /> Ingatkan</a>
              )}
              <button type="button" onClick={() => setHowTo(howTo === o.seri ? null : o.seri)} className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">Cara beli <ChevronDown size={14} className={cn('transition-transform', howTo === o.seri && 'rotate-180')} /></button>
            </div>
            <AnimatePresence initial={false}>
              {howTo === o.seri && (
                <motion.ol initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-3 list-decimal space-y-1.5 overflow-hidden rounded-2xl bg-white p-4 pl-8 text-sm text-slate-700">
                  <li>Pilih mitra distribusi resmi (bank, perusahaan efek, atau aplikasi investasi) — daftarnya ada di situs DJPPR.</li>
                  <li>Daftar akun di mitra itu: siapkan KTP (NIK), NPWP bila diminta, rekening bank, dan nomor SID (dibuat otomatis saat daftar).</li>
                  <li>Pesan {o.seri} di masa penawaran, pilih tenor, masukkan nominal, lalu bayar memakai kode billing sebelum batas waktunya.</li>
                  <li>Setelah terbit, kupon masuk ke rekeningmu tiap bulan. Catat di Investasi supaya ikut di Kekayaan.</li>
                </motion.ol>
              )}
            </AnimatePresence>
            <p className="mt-3 text-xs text-slate-400">Dari berita: <a href={o.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline">{o.sourceName}</a> · cek detail resmi di DJPPR.</p>
          </section>
        );
      })}

      {rows.length > 0 && (
        <section className={cn(card, 'mt-4 p-5')}>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Sebulan dapat berapa?</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-500">Kalau</span>
            {[1, 5, 10, 50, 100].map((j) => (
              <button key={j} type="button" onClick={() => setAmt(j * 1e6)} className={cn('rounded-full px-3.5 py-1.5 text-[13px] font-semibold', amt === j * 1e6 ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-200/60')}>Rp {j} jt</button>
            ))}
          </div>
          <ul className="mt-4 divide-y divide-slate-200/70 overflow-hidden rounded-2xl bg-white">
            {rows.map((r, i) => (
              <motion.li key={r.name} layout className="flex items-center gap-3 px-4 py-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-bold text-slate-900">{r.name}{r.open && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">DIBUKA</span>}</span>
                  <span className="text-xs text-slate-500">{r.sub}</span>
                </span>
                <motion.span key={`${r.name}-${amt}`} initial={{ opacity: 0.3 }} animate={{ opacity: 1 }} className="font-extrabold text-slate-900 tabular-nums">{rp(r.v)}</motion.span>
              </motion.li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">Setelah pajak: kupon SBN 10%, bunga deposito 20% (simpanan s.d. Rp7,5 jt tidak dipotong). Kupon mengambang bisa berubah tiap 3 bulan.</p>
        </section>
      )}

      <section className="mt-6">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Sumber</p>
        <ul className="mt-2 space-y-2">
          {(feed?.sources ?? []).filter((s) => s.at).map((s) => (
            <li key={s.name} className={cn(card, 'flex items-center justify-between p-3.5 text-sm')}>
              <span><b className="text-slate-800">{s.name}</b> <span className="text-slate-500">· dibaca {fmtDate(s.at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></span>
              <a href={s.url} target="_blank" rel="noopener noreferrer" aria-label={`Buka ${s.name}`} className="text-slate-400 hover:text-slate-700"><ExternalLink size={15} /></a>
            </li>
          ))}
          {feed?.biRate?.via && <li className="text-xs text-slate-500">BI-Rate terakhir dibaca dari berita {feed.biRate.via.name} karena situs BI sedang tidak bisa diakses.</li>}
        </ul>
        <p className="mt-3 text-xs text-slate-400">Harga pasar sekunder & kurva imbal hasil (PHEI) belum tersedia. Angka diambil otomatis dari sumber di atas — pilihannya tetap di kamu.</p>
      </section>
    </div>
  );
}

// ================= Belajar =================
function Lesson({ title, children, links }: { title: string; children: React.ReactNode; links: { label: string; url: string }[] }) {
  return (
    <motion.section initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} className={cn(card, 'p-5')}>
      <h3 className="text-lg font-extrabold text-slate-900">{title}</h3>
      <div className="mt-2 space-y-2 text-[15px] leading-relaxed text-slate-700">{children}</div>
      <div className="mt-4 flex flex-wrap gap-2">
        {links.map((l) => (
          <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:text-slate-900">{l.label} <ExternalLink size={11} /></a>
        ))}
      </div>
    </motion.section>
  );
}

export function BelajarTab({ feed }: { feed: PasarFeed | null }) {
  const floating = (feed?.sbnOffers ?? []).filter((o) => /^(SBR|ST)/.test(o.seri)).slice(0, 2);
  const bi = feed?.biRate?.rate;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h2 className="text-[28px] font-extrabold tracking-tight text-slate-900">Belajar</h2>

      <Lesson title="SBN itu apa?" links={[{ label: 'DJPPR · SBN ritel', url: 'https://www.djppr.kemenkeu.go.id/' }]}>
        <p>Surat Berharga Negara: kamu meminjamkan uang ke negara. Negara membayar kupon tiap bulan dan mengembalikan pokoknya saat jatuh tempo.</p>
        <p>Pokok dan kuponnya dijamin undang-undang. SBN ritel bisa dibeli mulai Rp1 juta lewat mitra distribusi (bank atau aplikasi), hanya di masa penawaran.</p>
        <p>Ada empat jenis: <b>ORI</b> dan <b>SBR</b> (konvensional), <b>SR</b> dan <b>ST</b> (syariah).</p>
      </Lesson>

      <Lesson title="Kupon tetap atau mengambang" links={[{ label: 'DJPPR', url: 'https://www.djppr.kemenkeu.go.id/' }]}>
        <p><b>ORI dan SR</b>: kuponnya tetap sampai jatuh tempo.</p>
        <p><b>SBR dan ST</b>: kupon mengambang = BI-Rate + spread, disesuaikan tiap tiga bulan. Kupon awalnya jadi kupon minimal — kalau BI-Rate turun, kupon tidak turun di bawahnya.</p>
        {bi !== undefined && floating.map((o) => {
          const t = o.tenors[o.tenors.length - 1];
          return (
            <div key={o.seri} className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-3 text-sm">
              <b className="mr-1">{o.seri}{t.label}</b>
              <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700">BI {pct(bi)}</span>+
              <span className="rounded-full bg-slate-100 px-2.5 py-1">spread {pct(Math.max(0, +(t.kupon - bi).toFixed(2)))}</span>=
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700">{pct(t.kupon)}</span>
            </div>
          );
        })}
      </Lesson>

      <Lesson title="Butuh uangnya sebelum jatuh tempo?" links={[{ label: 'DJPPR', url: 'https://www.djppr.kemenkeu.go.id/' }]}>
        <p><b>ORI dan SR</b> bisa dijual di pasar sekunder setelah masa tahan minimal. Harganya bisa di atas atau di bawah 100%, tergantung pasar hari itu.</p>
        <p><b>SBR dan ST</b> tidak bisa dijual, tapi sebagian bisa dicairkan lebih awal (<i>early redemption</i>) di tanggal yang sudah ditentukan.</p>
      </Lesson>

      <Lesson title="Pajaknya: 10% atau 20%" links={[{ label: 'PP 91/2021', url: 'https://peraturan.bpk.go.id/Details/174980/pp-no-91-tahun-2021' }]}>
        <p>Kupon SBN kena PPh final <b>10%</b>, langsung dipotong. Bunga deposito dan tabungan kena PPh final <b>20%</b>; simpanan sampai Rp7,5 juta tidak dipotong.</p>
        {feed?.lps && (
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-3 text-sm">
            <span className="text-slate-500">Rp10 jt sebulan, deposito {pct(feed.lps.umum)}</span>
            <b className="text-right tabular-nums">{rp(((10e6 * feed.lps.umum) / 100 / 12) * (1 - DEPO_TAX))}</b>
            {floating[0] && <><span className="text-slate-500">Rp10 jt sebulan, {floating[0].seri} {pct(floating[0].tenors[0].kupon)}</span><b className="text-right tabular-nums">{rp(((10e6 * floating[0].tenors[0].kupon) / 100 / 12) * (1 - SBN_TAX))}</b></>}
          </div>
        )}
      </Lesson>

      <Lesson title="Jaminan LPS untuk tabunganmu" links={[{ label: 'LPS', url: 'https://www.lps.go.id/' }]}>
        <p>LPS menjamin simpanan di bank sampai <b>Rp2 miliar per nasabah per bank</b>.</p>
        <p>Syaratnya <b>3T</b>: tercatat di pembukuan bank, bunganya tidak melebihi bunga penjaminan LPS, dan tidak melakukan tindakan yang merugikan bank. Simpanan dengan bunga di atas bunga penjaminan tidak dijamin.</p>
        {feed?.lps && (
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            {[['Bank umum', feed.lps.umum], ['BPR', feed.lps.bpr], ['Valas', feed.lps.valas]].map(([l, v]) => (
              <div key={l as string} className="rounded-2xl bg-white p-3"><p className="text-xs text-slate-500">{l}</p><p className="text-xl font-extrabold">{pct(v as number)}</p></div>
            ))}
            <p className="col-span-3 text-xs text-slate-500">Periode {feed.lps.periode}</p>
          </div>
        )}
      </Lesson>

      <Lesson title="Suku bunga naik, harga obligasi turun" links={[{ label: 'OJK · Sikapi Uangmu', url: 'https://sikapiuangmu.ojk.go.id/' }]}>
        <p>Harga obligasi bergerak berlawanan dengan suku bunga. Kalau suku bunga naik, harga obligasi yang sudah beredar turun — dan sebaliknya.</p>
        <p>Ini penting kalau kamu menjual ORI atau SR sebelum jatuh tempo. Kalau dipegang sampai jatuh tempo, negara membayar kembali pokoknya penuh.</p>
      </Lesson>

      <Lesson title="Cek dulu sebelum pinjam atau investasi" links={[{ label: 'OJK · cek legalitas', url: 'https://www.ojk.go.id/' }]}>
        <p>Pastikan perusahaannya berizin dan diawasi OJK. Waspadai janji untung pasti yang terlalu tinggi, apalagi kalau diminta mengajak orang lain.</p>
        <p>Ragu? Tanya Kontak OJK <b>157</b> atau WhatsApp <b>081-157-157-157</b>.</p>
      </Lesson>

      <p className="pb-4 text-center text-xs text-slate-400">Materi umum, bukan saran investasi pribadi.</p>
    </div>
  );
}
