'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  Home,
  Pause,
  Play,
  Share2,
  Sparkles,
  Square,
  Sunrise,
} from 'lucide-react';
import {
  ATRIBUSI,
  ATRIBUSI_SILANG,
  TEMA_ALKITAB,
  TOTAL_PASAL,
  alkitabService,
  ayatHariIniAlkitab,
  loadSilang,
  progresAlkitab,
  rujukanKey,
  type Kitab,
  type Pasal,
  type Rujukan,
  type Silang,
} from '@/lib/teduh/alkitab';
import { streak, todayKey } from '@/lib/teduh/quran';
import { bahanHariIni, catatan } from '@/lib/teduh/renungan';
import {
  AngkaNaik,
  Berurutan,
  Butir,
  CatatanPribadi,
  CincinProgres,
  JedaSejenak,
  LangitHero,
  sapaWaktu,
  LembarTab,
  TeduhShell,
  TitikMingguan,
  TombolJeda,
  type DockTab,
} from '@/components/teduh/ui';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { rp } from '@/lib/kanvas/data';
import { cn } from '@/lib/utils';

type Tab = 'beranda' | 'renungan' | 'baca' | 'tema' | 'simpan';
const TABS: DockTab<Tab>[] = [
  { id: 'beranda', label: 'Beranda', icon: Home },
  { id: 'renungan', label: 'Renungan', icon: Sunrise },
  { id: 'baca', label: 'Baca', icon: BookOpen },
  { id: 'tema', label: 'Tema', icon: Sparkles },
  { id: 'simpan', label: 'Simpan', icon: Bookmark },
];
const SUB: Record<Tab, string> = {
  beranda: 'Alkitab · ruang tenang',
  renungan: 'Renungan hari ini',
  baca: '66 kitab Terjemahan Baru',
  tema: 'Firman untuk urusan uangmu',
  simpan: 'Ayat yang kamu tandai',
};
const MEMBERI_RE = /persembahan|perpuluhan|persepuluhan|kolekte|diakonia|derma|sumbangan|donasi|amal|ucapan syukur/i;
const DOA = [
  'Tarik napas… serahkan kekhawatiranmu.',
  'Hembuskan… lepaskan beban yang bukan milikmu.',
  'Ucapkan syukur untuk satu hal kecil hari ini.',
  'Mohon hikmat untuk setiap keputusan hari ini.',
];
const useProgres = () => useSyncExternalStore(progresAlkitab.subscribe, progresAlkitab.snapshot, () => null);
const useCatatan = () => useSyncExternalStore(catatan.subscribe, catatan.snapshot, () => null);
const greet = () => sapaWaktu();
const usePasal = (kitab: Kitab | undefined, c: number) => {
  const [p, setP] = useState<{ key: string; data: Pasal | null; gagal: boolean } | null>(null);
  const key = `${kitab?.abbr}:${c}`;
  useEffect(() => {
    if (!kitab) return;
    let alive = true;
    alkitabService
      .pasal(kitab.abbr, c)
      .then((d) => alive && setP({ key, data: d, gagal: false }))
      .catch(() => alive && setP({ key, data: null, gagal: true }));
    return () => {
      alive = false;
    };
  }, [kitab, c, key]);
  return p?.key === key ? p : null;
};

// Teduh untuk umat Kristen & Katolik — Alkitab TB (© LAI) lewat API Indonesia.
export function AlkitabHome({
  variant,
  katolik,
  kanan,
}: {
  variant: 'web' | 'app';
  katolik: boolean;
  kanan?: React.ReactNode;
}) {
  const [kitab, setKitab] = useState<Kitab[] | null>(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<Tab>('beranda');
  const [open, setOpen] = useState<{ b: number; c: number; v?: number; seq: number } | null>(null);
  const [jeda, setJeda] = useState(false);
  const store = useProgres();
  const nada: 'kristen' | 'katolik' = katolik ? 'katolik' : 'kristen';
  useEffect(() => {
    alkitabService
      .kitab()
      .then(setKitab)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Alkitab belum bisa dimuat.'));
  }, []);
  const marks = useMemo(() => new Set((store?.marks ?? []).map((m) => m.k)), [store]);
  const go = (b: number, c: number, v?: number) => {
    setOpen({ b, c, v, seq: Date.now() });
    window.scrollTo({ top: 0 });
  };
  const reader = open && kitab ? kitab.find((x) => x.id === open.b) : null;

  return (
    <>
      <TeduhShell
        variant={variant}
        nada={nada}
        tabs={kitab ? TABS : undefined}
        tab={tab}
        onTab={setTab}
        judul="Teduh"
        sub={SUB[tab]}
        kanan={kanan}
        polos={Boolean(reader)}
      >
        {err ? (
          <section className="rounded-[28px] bg-gradient-to-br from-sky-50 to-indigo-100 p-6 text-indigo-900">
            <p className="fsh-34">✝️</p>
            <h2 className="mt-1 fsh-24 font-black">Alkitab sedang disiapkan</h2>
            <p className="mt-2 fs-14 leading-relaxed opacity-90">{err}</p>
          </section>
        ) : null}
        {!kitab && !err ? <p className="py-16 text-center fs-13 text-slate-400">Memuat Alkitab…</p> : null}
        {reader && open && kitab ? (
          <PasalReader
            key={`${open.b}-${open.c}-${open.seq}`}
            kitab={reader}
            list={kitab}
            c={open.c}
            startAyat={open.v}
            marks={marks}
            nada={nada}
            onClose={() => setOpen(null)}
            onOpen={go}
          />
        ) : kitab ? (
          <>
            {katolik && tab === 'beranda' ? (
              <p className="rounded-2xl bg-amber-50 px-4 py-3 fs-12.5 font-semibold text-amber-900 ring-1 ring-amber-100">
                Kitab-kitab Deuterokanonika belum tersedia — saat ini memuat 66 kitab Terjemahan Baru.
              </p>
            ) : null}
            {tab === 'beranda' ? (
              <Beranda kitab={kitab} go={go} setTab={setTab} nada={nada} onJeda={() => setJeda(true)} />
            ) : null}
            {tab === 'renungan' ? (
              <Renungan kitab={kitab} go={go} onJeda={() => setJeda(true)} katolik={katolik} />
            ) : null}
            {tab === 'baca' ? <Pustaka kitab={kitab} go={go} /> : null}
            {tab === 'tema' ? <TemaView kitab={kitab} go={go} /> : null}
            {tab === 'simpan' ? <Tersimpan kitab={kitab} marks={store?.marks ?? []} go={go} /> : null}
            <p className="pt-2 fs-11.5 leading-relaxed text-slate-400">
              {ATRIBUSI}. Data melalui API Indonesia. {ATRIBUSI_SILANG}.
            </p>
          </>
        ) : null}
      </TeduhShell>
      <AnimatePresence>
        {jeda ? <JedaSejenak nada={nada} kalimat={DOA} onClose={() => setJeda(false)} /> : null}
      </AnimatePresence>
    </>
  );
}

const refLabel = (kitab: Kitab[], x: Rujukan & { sampai?: number }) =>
  `${kitab.find((k) => k.id === x.b)?.nama ?? ''} ${x.c}:${x.v}${x.sampai ? `-${x.sampai}` : ''}`;

function AyatCard({
  r,
  kitab,
  label,
  go,
}: {
  r: Rujukan;
  kitab: Kitab[];
  label?: string;
  go: (b: number, c: number, v?: number) => void;
}) {
  const k = kitab.find((x) => x.id === r.b);
  const p = usePasal(k, r.c);
  const teks = p?.data?.ayat.find((a) => a.n === r.v)?.teks;
  return (
    <article className="relative h-full overflow-hidden rounded-[26px] bg-white p-5 ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-indigo-100/60 blur-2xl dark:bg-indigo-500/10"
      />
      <div className="relative flex items-center justify-between gap-2">
        <span className="fs-12 font-bold text-slate-400">{label}</span>
        <span className="rounded-full bg-indigo-50 px-2.5 py-1 fs-11 font-black uppercase tracking-wider text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
          {refLabel(kitab, r)}
        </span>
      </div>
      {teks ? (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative mt-4 text-center font-serif fs-16.5 leading-relaxed text-slate-800 dark:text-slate-100"
        >
          “{teks}”
        </motion.p>
      ) : p?.gagal ? (
        <p className="mt-4 text-center fs-13 text-slate-400">Ayat belum bisa dimuat.</p>
      ) : (
        <div className="mt-5 space-y-2">
          <div className="mx-auto h-4 w-4/5 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
          <div className="mx-auto h-4 w-3/5 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
        </div>
      )}
      <div className="relative mt-4 flex justify-center">
        <button
          type="button"
          onClick={() => go(r.b, r.c, r.v)}
          className="h-10 rounded-full bg-slate-900 px-4 fs-13 font-bold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900"
        >
          Baca pasalnya
        </button>
      </div>
    </article>
  );
}

function Beranda({
  kitab,
  go,
  setTab,
  nada,
  onJeda,
}: {
  kitab: Kitab[];
  go: (b: number, c: number, v?: number) => void;
  setTab: (t: Tab) => void;
  nada: 'kristen' | 'katolik';
  onJeda: () => void;
}) {
  const store = useProgres();
  const [now] = useState(() => new Date());
  const hari = ayatHariIniAlkitab(now);
  const days = store?.days ?? {};
  const st = streak(days);
  const read = store?.read.length ?? 0;
  const last = store?.last ? kitab.find((k) => k.id === store.last!.b) : null;
  const kHari = kitab.find((k) => k.id === hari.a.b);
  const pHari = usePasal(kHari, hari.a.c);
  const teksHari = pHari?.data?.ayat.find((a) => a.n === hari.a.v)?.teks;
  const [memberi, setMemberi] = useState<{ total: number; n: number } | null>(null);
  useEffect(() => {
    const now = new Date();
    transactionService
      .getUserTransactions('session')
      .then((txs: Transaction[]) => {
        const mine = txs.filter((t) => {
          const d = new Date(t.date);
          return (
            t.type === 'pengeluaran' &&
            d.getFullYear() === now.getFullYear() &&
            d.getMonth() === now.getMonth() &&
            MEMBERI_RE.test(`${t.note ?? ''} ${t.category ?? ''} ${t.subCategory ?? ''}`)
          );
        });
        setMemberi({
          total: mine.reduce((a, t) => a + (Number(t.amountIDR) || Number(t.amount) || 0), 0),
          n: mine.length,
        });
      })
      .catch(() => setMemberi(null));
  }, []);
  return (
    <Berurutan className="space-y-4">
      <Butir>
        <LangitHero
          nada={nada}
          sapa={greet()}
          judul="Teduhkan hati sebentar."
          tanggal={now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
        >
          <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <p className="fsh-40 font-black leading-none">
                <AngkaNaik nilai={st} />
              </p>
              <p className="fs-12.5 text-white/80">hari berturut-turut membaca</p>
            </div>
            <TitikMingguan days={days} todayKey={todayKey} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <TombolJeda onClick={onJeda} />
            <button
              type="button"
              onClick={() => (last ? go(last.id, store!.last!.c) : go(43, 1))}
              className="flex h-10 items-center gap-1.5 rounded-full bg-white px-3.5 fs-12.5 font-bold text-slate-900 shadow-sm transition hover:bg-white/90"
            >
              <BookOpen size={15} /> {last ? `Lanjut ${last.nama} ${store!.last!.c}` : 'Mulai dari Yohanes'}
            </button>
          </div>
        </LangitHero>
      </Butir>

      <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
        <Butir>
          <button
            type="button"
            onClick={() => setTab('renungan')}
            className="group flex h-full w-full flex-col rounded-[26px] bg-gradient-to-br from-amber-50 via-white to-indigo-50 p-5 text-left ring-1 ring-amber-100 transition hover:shadow-lg dark:from-amber-500/10 dark:via-slate-900 dark:to-indigo-500/10 dark:ring-amber-500/20"
          >
            <span className="flex items-center gap-2 fs-11.5 font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
              <Sunrise size={15} /> Renungan hari ini · {hari.tema.judul}
            </span>
            <span className="mt-3 line-clamp-4 font-serif fs-16.5 leading-relaxed text-slate-800 dark:text-slate-100">
              {teksHari ? `“${teksHari}”` : pHari?.gagal ? 'Ayat belum bisa dimuat.' : 'Memuat ayat…'}
            </span>
            <span className="mt-auto flex items-center justify-between pt-4">
              <span className="fs-12 font-bold text-slate-400">{refLabel(kitab, hari.a)}</span>
              <span className="flex items-center gap-1 rounded-full bg-slate-900 px-3.5 py-2 fs-12.5 font-bold text-white transition group-hover:gap-2 dark:bg-white dark:text-slate-900">
                Renungkan <ChevronRight size={15} />
              </span>
            </span>
          </button>
        </Butir>
        <div className="grid gap-4">
          <Butir>
            <div className="flex h-full items-center gap-4 rounded-[24px] bg-white p-4 ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800">
              <CincinProgres pct={read / TOTAL_PASAL} warna="stroke-indigo-500" />
              <span className="min-w-0 flex-1">
                <span className="block fs-14.5 font-black">Menuju tamat Alkitab</span>
                <span className="block fs-12 text-slate-500">
                  <AngkaNaik nilai={read} /> dari {TOTAL_PASAL.toLocaleString('id-ID')} pasal
                </span>
              </span>
            </div>
          </Butir>
          <Butir>
            <section className="flex h-full items-center gap-3 rounded-[24px] bg-amber-50 p-4 ring-1 ring-amber-100 dark:bg-amber-500/10 dark:ring-amber-500/20">
              <motion.span
                className="fsh-26"
                animate={{ scale: [1, 1.12, 1] }}
                transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 2 }}
              >
                🙏
              </motion.span>
              <div className="min-w-0 flex-1">
                <p className="fs-14.5 font-black text-amber-900 dark:text-amber-100">
                  {nada === 'katolik' ? 'Kolekte & persembahan' : 'Persembahan bulan ini'}
                </p>
                <p className="fs-12.5 text-amber-800/80 dark:text-amber-200/80">
                  {memberi === null
                    ? 'Dari catatan keuanganmu (persembahan, perpuluhan, kolekte).'
                    : memberi.n
                      ? `${rp(memberi.total)} dari ${memberi.n} catatan`
                      : 'Belum ada yang tercatat bulan ini.'}
                </p>
              </div>
              <Link
                href="/input-cepat?teks=Persembahan"
                className="h-10 shrink-0 rounded-full bg-amber-500 px-3.5 fs-12.5 font-bold leading-10 text-white transition hover:bg-amber-600"
              >
                Catat
              </Link>
            </section>
          </Butir>
        </div>
      </div>

      <Butir>
        <div className="rounded-[24px] bg-white p-4 ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800">
          <div className="mb-3 flex items-center justify-between">
            <p className="fs-14.5 font-black">Firman untuk urusan uangmu</p>
            <button
              type="button"
              onClick={() => setTab('tema')}
              className="flex items-center gap-0.5 fs-12.5 font-bold text-indigo-700"
            >
              Semua <ChevronRight size={14} />
            </button>
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            {TEMA_ALKITAB.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab('tema')}
                className="flex shrink-0 flex-col items-start gap-1 rounded-2xl bg-slate-50 px-3.5 py-3 text-left ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:ring-indigo-200 dark:bg-slate-800 dark:ring-slate-700"
              >
                <span className="fsh-22">{t.emoji}</span>
                <span className="fs-12.5 font-bold">{t.judul}</span>
                <span className="fs-11 text-slate-400">{t.ayat.length} ayat</span>
              </button>
            ))}
          </div>
        </div>
      </Butir>
    </Berurutan>
  );
}

// ── Renungan harian: ayat + konteks perikop + bahan renungan + langkah kecil + catatan pribadi ──
function Renungan({
  kitab,
  go,
  onJeda,
  katolik,
}: {
  kitab: Kitab[];
  go: (b: number, c: number, v?: number) => void;
  onJeda: () => void;
  katolik: boolean;
}) {
  const [now] = useState(() => new Date());
  const hari = ayatHariIniAlkitab(now);
  const k = kitab.find((x) => x.id === hari.a.b);
  const p = usePasal(k, hari.a.c);
  const ayat = p?.data?.ayat ?? [];
  const i = ayat.findIndex((a) => a.n === hari.a.v);
  const teks = i >= 0 ? ayat[i].teks : null;
  // Perikop: judul terdekat di atas ayat ini.
  const perikop =
    i >= 0
      ? ayat
          .slice(0, i + 1)
          .reverse()
          .find((a) => a.judul)?.judul
      : null;
  const konteks = i >= 0 ? ayat.slice(Math.max(0, i - 2), i + 3) : [];
  const [pelajari, setPelajari] = useState(false);
  const [toast, setToast] = useState('');
  const bahan = bahanHariIni(hari.tema.id, now);
  const tgl = todayKey(now);
  const cat = useCatatan();
  const appMode = typeof window !== 'undefined' && window.location.pathname.startsWith('/app');
  const jumlahCatatan = Object.keys(cat?.hari ?? {}).length;
  const share = async () => {
    if (!teks) return;
    const text = `“${teks}”\n— ${refLabel(kitab, hari.a)} (${ATRIBUSI})\n\n${bahan.renung}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setToast('Renungan disalin.');
        setTimeout(() => setToast(''), 2000);
      }
    } catch {
      /* dibatalkan */
    }
  };
  return (
    <Berurutan className="space-y-4">
      <Butir>
        <div>
          <p className="fs-12 font-bold uppercase tracking-wider text-slate-400">
            {now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <h2 className="fsh-26 font-black">
            {hari.tema.emoji} {hari.tema.judul}
          </h2>
        </div>
      </Butir>
      <Butir>
        <article
          className={cn(
            'relative overflow-hidden rounded-[30px] bg-gradient-to-b p-6 text-white md:p-8',
            katolik ? 'from-amber-900 via-orange-900 to-rose-950' : 'from-indigo-950 via-indigo-900 to-violet-900',
          )}
        >
          <span
            aria-hidden
            className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-200/20 blur-3xl"
          />
          <p className="relative text-center fs-11.5 font-black uppercase tracking-[0.2em] text-white/60">
            {perikop ? `${perikop} · ` : ''}
            {refLabel(kitab, hari.a)}
          </p>
          {teks ? (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="relative mx-auto mt-4 max-w-2xl text-center font-serif fsh-22 leading-relaxed md:fsh-26"
            >
              “{teks}”
            </motion.p>
          ) : (
            <p className="py-10 text-center fs-13 text-white/60">
              {p?.gagal ? 'Ayat belum bisa dimuat.' : 'Memuat ayat…'}
            </p>
          )}
          <div className="relative mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setPelajari(true)}
              className="flex h-10 items-center gap-1.5 rounded-full bg-white px-4 fs-13 font-bold text-indigo-950"
            >
              <Sparkles size={15} className="text-amber-500" /> Pelajari
            </button>
            <button
              type="button"
              onClick={() => go(hari.a.b, hari.a.c, hari.a.v)}
              className="flex h-10 items-center gap-1.5 rounded-full bg-white/15 px-4 fs-13 font-bold ring-1 ring-white/25"
            >
              <BookOpen size={15} /> Baca pasalnya
            </button>
            <button
              type="button"
              onClick={() => void share()}
              aria-label="Bagikan"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25"
            >
              <Share2 size={15} />
            </button>
          </div>
        </article>
      </Butir>
      <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
        <Butir>
          <section className="h-full rounded-[26px] bg-white p-5 ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800">
            <p className="fs-11.5 font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
              Konteks ayat
            </p>
            {konteks.length ? (
              <div className="mt-2 space-y-1.5">
                {konteks.map((a) => (
                  <p
                    key={a.n}
                    className={cn(
                      'fs-14 leading-relaxed',
                      a.n === hari.a.v
                        ? 'rounded-xl bg-amber-50 px-2 py-1 font-semibold text-slate-900 dark:bg-amber-500/10 dark:text-white'
                        : 'text-slate-500',
                    )}
                  >
                    <sup className="mr-1 fs-10 font-black text-indigo-500">{a.n}</sup>
                    {a.teks}
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-2 fs-13 text-slate-400">Memuat…</p>
            )}
          </section>
        </Butir>
        <div className="space-y-4">
          <Butir>
            <section className="rounded-[26px] bg-gradient-to-br from-violet-50 to-sky-50 p-5 ring-1 ring-violet-100 dark:from-violet-500/10 dark:to-sky-500/10 dark:ring-violet-500/20">
              <p className="fs-11.5 font-black uppercase tracking-wider text-violet-700 dark:text-violet-300">
                Untuk direnungkan
              </p>
              <p className="mt-2 fs-15.5 font-semibold leading-relaxed text-slate-800 dark:text-slate-100">
                {bahan.renung}
              </p>
            </section>
          </Butir>
          <Butir>
            <section className="rounded-[26px] bg-white p-5 ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800">
              <p className="fs-11.5 font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                Langkah kecil hari ini
              </p>
              <p className="mt-2 fs-14.5 leading-relaxed">{bahan.langkah.teks}</p>
              {bahan.langkah.href ? (
                <Link
                  href={appMode && bahan.langkah.app ? bahan.langkah.app : bahan.langkah.href}
                  className="mt-3 inline-flex h-9 items-center gap-1 rounded-full bg-amber-500 px-3.5 fs-12.5 font-bold text-white"
                >
                  Lakukan sekarang <ChevronRight size={14} />
                </Link>
              ) : null}
              {/jeda napas/i.test(bahan.langkah.teks) ? (
                <button
                  type="button"
                  onClick={onJeda}
                  className="mt-3 h-9 rounded-full bg-slate-900 px-3.5 fs-12.5 font-bold text-white"
                >
                  Mulai jeda sejenak
                </button>
              ) : null}
            </section>
          </Butir>
        </div>
      </div>
      <Butir>
        <section className="rounded-[26px] bg-white p-5 ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="fs-14.5 font-black">Catatan renunganku</p>
            {jumlahCatatan ? <span className="fs-12 text-slate-400">{jumlahCatatan} hari tercatat</span> : null}
          </div>
          <CatatanPribadi
            key={tgl}
            nilai={cat?.hari[tgl] ?? ''}
            onSimpan={(v) => catatan.setHari(tgl, v)}
            placeholder="Satu kalimat syukur, doa, atau niat untuk hari ini…"
          />
        </section>
      </Butir>
      <AnimatePresence>
        {pelajari && k ? (
          <PelajariAlkitab
            kitab={kitab}
            k={k}
            c={hari.a.c}
            v={hari.a.v}
            pasal={p?.data ?? null}
            nada={katolik ? 'katolik' : 'kristen'}
            go={go}
            onClose={() => setPelajari(false)}
          />
        ) : null}
      </AnimatePresence>
      {toast ? (
        <p className="fixed inset-x-0 bottom-28 z-40 mx-auto w-max rounded-full bg-slate-950/90 px-4 py-2 fs-12.5 font-semibold text-white">
          {toast}
        </p>
      ) : null}
    </Berurutan>
  );
}

// ── "Pelajari" satu ayat: ayat terkait (OpenBible), konteks perikop, catatan pribadi ──
function RujukanItem({ r, kitab, go }: { r: Silang; kitab: Kitab[]; go: (b: number, c: number, v?: number) => void }) {
  const [buka, setBuka] = useState(false);
  const k = kitab.find((x) => x.id === r.b);
  return (
    <div className="rounded-2xl bg-slate-50 p-3.5 ring-1 ring-slate-100 dark:bg-slate-800 dark:ring-slate-700">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setBuka((v) => !v)} className="min-w-0 flex-1 text-left fs-14 font-black">
          {refLabel(kitab, r)}
        </button>
        <button
          type="button"
          onClick={() => setBuka((v) => !v)}
          className="h-8 rounded-full bg-white px-3 fs-12 font-bold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700"
        >
          {buka ? 'Tutup' : 'Lihat'}
        </button>
        <button
          type="button"
          onClick={() => go(r.b, r.c, r.v)}
          className="h-8 rounded-full bg-slate-900 px-3 fs-12 font-bold text-white dark:bg-white dark:text-slate-900"
        >
          Baca
        </button>
      </div>
      {buka && k ? <RujukanTeks k={k} r={r} /> : null}
    </div>
  );
}
function RujukanTeks({ k, r }: { k: Kitab; r: Silang }) {
  const p = usePasal(k, r.c);
  const list = p?.data?.ayat.filter((a) => a.n >= r.v && a.n <= (r.sampai ?? r.v)) ?? [];
  return (
    <p className="mt-2 fs-13.5 leading-relaxed text-slate-600 dark:text-slate-300">
      {p?.gagal
        ? 'Ayat belum bisa dimuat.'
        : list.length
          ? list.map((a) => (
              <span key={a.n}>
                <sup className="mr-0.5 fs-10 font-black text-indigo-500">{a.n}</sup>
                {a.teks}{' '}
              </span>
            ))
          : 'Memuat…'}
    </p>
  );
}
function PelajariAlkitab({
  kitab,
  k,
  c,
  v,
  pasal,
  nada,
  go,
  onClose,
}: {
  kitab: Kitab[];
  k: Kitab;
  c: number;
  v: number;
  pasal: Pasal | null;
  nada: 'kristen' | 'katolik';
  go: (b: number, c: number, v?: number) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'terkait' | 'konteks' | 'catatan'>('terkait');
  const [silang, setSilang] = useState<Silang[] | null>(null);
  const [gagal, setGagal] = useState(false);
  const cat = useCatatan();
  useEffect(() => {
    let alive = true;
    loadSilang(k.id, c, v)
      .then((x) => alive && setSilang(x))
      .catch(() => alive && setGagal(true));
    return () => {
      alive = false;
    };
  }, [k.id, c, v]);
  const ayat = pasal?.ayat ?? [];
  const i = ayat.findIndex((a) => a.n === v);
  const perikop =
    i >= 0
      ? ayat
          .slice(0, i + 1)
          .reverse()
          .find((a) => a.judul)?.judul
      : null;
  let mulai = 0;
  for (let j = i; j >= 0; j--)
    if (ayat[j].judul) {
      mulai = j;
      break;
    }
  const akhir = i >= 0 ? ayat.findIndex((a, j) => j > i && a.judul) : -1;
  const bagian = i >= 0 ? ayat.slice(mulai, akhir >= 0 ? akhir : ayat.length) : [];
  const key = `a:${k.id}:${c}:${v}`;
  const pergi = (b: number, cc: number, vv?: number) => {
    onClose();
    go(b, cc, vv);
  };
  return (
    <LembarTab
      judul={`${k.nama} ${c}:${v}`}
      nada={nada}
      tab={tab}
      onTab={setTab}
      onClose={onClose}
      tabs={[
        { id: 'terkait', label: 'Ayat terkait' },
        { id: 'konteks', label: 'Konteks' },
        { id: 'catatan', label: 'Catatanku' },
      ]}
    >
      {tab === 'terkait' ? (
        <div className="space-y-2">
          {silang === null ? (
            <p className="py-6 text-center fs-13 text-slate-400">
              {gagal ? 'Ayat terkait belum bisa dimuat.' : 'Memuat…'}
            </p>
          ) : silang.length ? (
            silang.map((r) => <RujukanItem key={`${r.b}.${r.c}.${r.v}`} r={r} kitab={kitab} go={pergi} />)
          ) : (
            <p className="py-6 text-center fs-13 text-slate-400">Belum ada ayat terkait untuk ayat ini.</p>
          )}
          <p className="pt-1 fs-11.5 leading-relaxed text-slate-400">
            Rujukan silang dari OpenBible.info (CC BY 4.0), diurutkan dari yang paling banyak dipakai pembaca. Teks
            ayat: {ATRIBUSI}.
          </p>
        </div>
      ) : null}
      {tab === 'konteks' ? (
        <div className="space-y-1.5">
          {perikop ? <p className="mb-2 fs-15 font-black text-indigo-900 dark:text-indigo-200">{perikop}</p> : null}
          {bagian.length ? (
            bagian.map((a) => (
              <p
                key={a.n}
                className={cn(
                  'fs-14.5 leading-relaxed',
                  a.n === v
                    ? 'rounded-xl bg-amber-50 px-2 py-1 font-semibold dark:bg-amber-500/10'
                    : 'text-slate-600 dark:text-slate-300',
                )}
              >
                <sup className="mr-1 fs-10 font-black text-indigo-500">{a.n}</sup>
                {a.teks}
              </p>
            ))
          ) : (
            <p className="py-6 text-center fs-13 text-slate-400">Memuat…</p>
          )}
        </div>
      ) : null}
      {tab === 'catatan' ? (
        <div className="space-y-2">
          <p className="fs-13.5 text-slate-600 dark:text-slate-300">
            Apa yang kamu pelajari dari ayat ini? Tulis untuk dirimu sendiri.
          </p>
          <CatatanPribadi
            nilai={cat?.ayat[key] ?? ''}
            onSimpan={(x) => catatan.setAyat(key, x)}
            placeholder="Mis. Aku mau mulai menyisihkan persembahan di awal bulan…"
          />
        </div>
      ) : null}
    </LembarTab>
  );
}

function Pustaka({ kitab, go }: { kitab: Kitab[]; go: (b: number, c: number) => void }) {
  const [sel, setSel] = useState<Kitab | null>(null);
  const store = useProgres();
  const read = new Set(store?.read ?? []);
  if (sel)
    return (
      <section className="space-y-3">
        <button
          type="button"
          onClick={() => setSel(null)}
          className="flex items-center gap-1 fs-13 font-bold text-slate-500"
        >
          <ChevronLeft size={16} /> Semua kitab
        </button>
        <h2 className="fsh-24 font-black">{sel.nama}</h2>
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-10">
          {Array.from({ length: sel.pasal }, (_, i) => i + 1).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => go(sel.id, c)}
              className={cn(
                'h-11 rounded-xl fs-13.5 font-bold ring-1',
                read.has(`${sel.id}:${c}`)
                  ? 'bg-indigo-600 text-white ring-indigo-600'
                  : 'bg-white ring-slate-200 dark:bg-slate-900 dark:ring-slate-700',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </section>
    );
  return (
    <section className="space-y-4">
      {(['PL', 'PB'] as const).map((pj) => (
        <div key={pj}>
          <p className="mb-2 fs-12 font-black uppercase tracking-wider text-slate-400">
            {pj === 'PL' ? 'Perjanjian Lama' : 'Perjanjian Baru'}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {kitab
              .filter((k) => k.perjanjian === pj)
              .map((k) => {
                const done = Array.from({ length: k.pasal }, (_, i) => read.has(`${k.id}:${i + 1}`)).filter(
                  Boolean,
                ).length;
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setSel(k)}
                    className="rounded-2xl bg-white px-3.5 py-3 text-left ring-1 ring-slate-200/80 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-indigo-300 dark:bg-slate-900 dark:ring-slate-800"
                  >
                    <span className="block truncate fs-13.5 font-bold">{k.nama}</span>
                    <span className="block fs-11.5 text-slate-500">
                      {k.pasal} pasal{done ? ` · ${done} dibaca` : ''}
                    </span>
                    <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <span
                        className="block h-full rounded-full bg-indigo-500"
                        style={{ width: `${(done / k.pasal) * 100}%` }}
                      />
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      ))}
    </section>
  );
}

function TemaView({ kitab, go }: { kitab: Kitab[]; go: (b: number, c: number, v?: number) => void }) {
  const [sel, setSel] = useState(TEMA_ALKITAB[0].id);
  const t = TEMA_ALKITAB.find((x) => x.id === sel)!;
  const appMode = typeof window !== 'undefined' && window.location.pathname.startsWith('/app');
  return (
    <section className="space-y-3">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {TEMA_ALKITAB.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setSel(x.id)}
            className={cn(
              'h-10 shrink-0 rounded-full px-3.5 fs-13 font-bold',
              sel === x.id
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700',
            )}
          >
            {x.emoji} {x.judul}
          </button>
        ))}
      </div>
      {t.ajak ? (
        <Link
          href={appMode && t.ajak.app ? t.ajak.app : t.ajak.href}
          className="flex items-center justify-between rounded-2xl bg-indigo-50 px-4 py-3 fs-13.5 font-bold text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-200"
        >
          {t.ajak.label} <ChevronRight size={16} />
        </Link>
      ) : null}
      <Berurutan key={sel} className="grid gap-3 md:grid-cols-2">
        {t.ayat.map((r) => (
          <Butir key={rujukanKey(r)}>
            <AyatCard r={r} kitab={kitab} label={t.judul} go={go} />
          </Butir>
        ))}
      </Berurutan>
    </section>
  );
}

function Tersimpan({
  kitab,
  marks,
  go,
}: {
  kitab: Kitab[];
  marks: { k: string; at: number }[];
  go: (b: number, c: number, v?: number) => void;
}) {
  return (
    <section className="space-y-3">
      {marks.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {marks.map((m) => {
            const [b, c, v] = m.k.split(':').map(Number);
            return <AyatCard key={m.k} r={{ b, c, v }} kitab={kitab} go={go} />;
          })}
        </div>
      ) : (
        <p className="rounded-[22px] bg-white p-6 text-center fs-13.5 text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          Belum ada. Ketuk ikon 🔖 di samping ayat saat membaca.
        </p>
      )}
    </section>
  );
}

function PasalReader({
  kitab,
  list,
  c,
  startAyat,
  marks,
  nada,
  onClose,
  onOpen,
}: {
  kitab: Kitab;
  list: Kitab[];
  c: number;
  startAyat?: number;
  marks: Set<string>;
  nada: 'kristen' | 'katolik';
  onClose: () => void;
  onOpen: (b: number, c: number, v?: number) => void;
}) {
  const [data, setData] = useState<Pasal | null>(null);
  const [err, setErr] = useState('');
  const [toast, setToast] = useState('');
  const [pelajari, setPelajari] = useState<number | null>(null);
  const boxes = useRef<(HTMLElement | null)[]>([]);
  useEffect(() => {
    let alive = true;
    progresAlkitab.setLast(kitab.id, c);
    alkitabService
      .pasal(kitab.abbr, c)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setErr(e instanceof Error ? e.message : 'Pasal gagal dimuat.'));
    return () => {
      alive = false;
    };
  }, [kitab, c]);
  useEffect(() => {
    if (!data || !startAyat) return;
    const t = setTimeout(() => boxes.current[startAyat - 1]?.scrollIntoView({ block: 'center' }), 60);
    return () => clearTimeout(t);
  }, [data, startAyat]);
  // Pasal tercatat selesai saat ayat terakhir terlihat.
  useEffect(() => {
    if (!data?.ayat.length) return;
    const el = boxes.current[data.ayat.length - 1];
    if (!el) return;
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          progresAlkitab.markPasal(kitab.id, c);
          io.disconnect();
        }
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [data, kitab.id, c]);

  const tts = useBacakan(data, (i) => boxes.current[i]?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  const share = async (n: number, teks: string) => {
    const text = `${teks}\n— ${kitab.nama} ${c}:${n} (${ATRIBUSI})`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setToast('Ayat disalin.');
        setTimeout(() => setToast(''), 2000);
      }
    } catch {
      /* dibatalkan */
    }
  };
  const idx = list.findIndex((k) => k.id === kitab.id);
  const prev = c > 1 ? { b: kitab.id, c: c - 1 } : idx > 0 ? { b: list[idx - 1].id, c: list[idx - 1].pasal } : null;
  const next =
    c < kitab.pasal ? { b: kitab.id, c: c + 1 } : idx < list.length - 1 ? { b: list[idx + 1].id, c: 1 } : null;
  const nama = (b: number) => list.find((k) => k.id === b)?.nama ?? '';

  return (
    <div className="pb-6">
      <div className="sticky top-0 z-20 -mx-4 flex items-center gap-2 bg-[#f6f7fb]/85 px-4 py-2.5 backdrop-blur-xl md:-mx-8 md:px-8 dark:bg-slate-950/85">
        <button
          type="button"
          onClick={() => {
            tts.stop();
            onClose();
          }}
          aria-label="Kembali"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
        >
          <ChevronLeft size={18} />
        </button>
        <p className="min-w-0 flex-1 truncate text-center fs-15 font-black">
          {kitab.nama} {c}
        </p>
        {tts.bisa && data ? (
          <button
            type="button"
            onClick={() => (tts.aktif ? tts.stop() : tts.mulai(0))}
            className="flex h-10 items-center gap-1.5 rounded-full bg-indigo-600 px-3 fs-12.5 font-bold text-white"
          >
            {tts.aktif ? <Square size={14} /> : <Play size={14} />} {tts.aktif ? 'Berhenti' : 'Dengarkan'}
          </button>
        ) : (
          <span className="w-10" />
        )}
      </div>
      {err ? <p className="mt-6 rounded-2xl bg-rose-50 px-4 py-3 fs-13 font-semibold text-rose-700">{err}</p> : null}
      {!data && !err ? <p className="mt-10 text-center fs-13 text-slate-400">Memuat pasal…</p> : null}
      {data ? (
        <ol className="mt-4 space-y-1">
          {data.ayat.map((a, i) => {
            const k = `${kitab.id}:${c}:${a.n}`;
            const on = tts.index === i && tts.aktif;
            return (
              <li
                key={a.n}
                ref={(el) => {
                  boxes.current[i] = el;
                }}
                className="scroll-mt-24"
              >
                {a.judul ? (
                  <h3 className="mb-1 mt-5 fs-15 font-black text-indigo-900 dark:text-indigo-200">{a.judul}</h3>
                ) : null}
                <div
                  className={cn(
                    'group flex gap-2 rounded-2xl px-3 py-2 transition-colors',
                    on
                      ? 'bg-indigo-50 ring-2 ring-indigo-300 dark:bg-indigo-500/10'
                      : startAyat === a.n
                        ? 'bg-amber-50'
                        : '',
                  )}
                >
                  <span className="w-6 shrink-0 pt-0.5 text-right fs-11.5 font-black text-indigo-500">{a.n}</span>
                  <p className="min-w-0 flex-1 fs-16 leading-relaxed text-slate-800 dark:text-slate-100">{a.teks}</p>
                  <span className="flex shrink-0 flex-col gap-0.5">
                    <button
                      type="button"
                      aria-label="Pelajari ayat ini"
                      title="Pelajari"
                      onClick={() => setPelajari(a.n)}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10"
                    >
                      <Sparkles size={15} />
                    </button>
                    <button
                      type="button"
                      aria-label={marks.has(k) ? 'Hapus tanda' : 'Tandai ayat'}
                      onClick={() => progresAlkitab.toggleMark(k)}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {marks.has(k) ? <BookmarkCheck size={15} className="text-amber-600" /> : <Bookmark size={15} />}
                    </button>
                    <button
                      type="button"
                      aria-label="Bagikan"
                      onClick={() => void share(a.n, a.teks)}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Share2 size={15} />
                    </button>
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
      {data ? (
        <div className="mt-5 flex gap-2">
          {prev ? (
            <button
              type="button"
              onClick={() => onOpen(prev.b, prev.c)}
              className="flex h-12 flex-1 items-center justify-center gap-1 rounded-2xl bg-white fs-13 font-bold ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
            >
              <ChevronLeft size={16} /> {nama(prev.b)} {prev.c}
            </button>
          ) : null}
          {next ? (
            <button
              type="button"
              onClick={() => onOpen(next.b, next.c)}
              className="flex h-12 flex-1 items-center justify-center gap-1 rounded-2xl bg-slate-900 fs-13 font-bold text-white dark:bg-white dark:text-slate-900"
            >
              {nama(next.b)} {next.c} <ChevronRight size={16} />
            </button>
          ) : null}
        </div>
      ) : null}
      <p className="mt-4 fs-11.5 text-slate-400">{ATRIBUSI}.</p>
      {tts.aktif ? (
        <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+12px)] z-30 mx-auto mt-4 flex w-[min(460px,100%)] items-center gap-2 rounded-[22px] bg-slate-950/95 p-3 text-white shadow-2xl">
          <button
            type="button"
            aria-label={tts.jeda ? 'Lanjut' : 'Jeda'}
            onClick={tts.toggleJeda}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-500"
          >
            {tts.jeda ? <Play size={18} /> : <Pause size={18} />}
          </button>
          <p className="min-w-0 flex-1 fs-13 font-bold">
            Membacakan ayat {data?.ayat[tts.index]?.n}
            <span className="block fs-11 font-normal text-white/60">Suara bawaan perangkatmu</span>
          </p>
          <button
            type="button"
            onClick={tts.gantiKecepatan}
            className="h-9 rounded-full bg-white/10 px-3 fs-12 font-black"
          >
            {tts.kecepatan}×
          </button>
          <button
            type="button"
            aria-label="Berhenti"
            onClick={tts.stop}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10"
          >
            <Square size={14} />
          </button>
        </div>
      ) : null}
      <AnimatePresence>
        {pelajari ? (
          <PelajariAlkitab
            key={pelajari}
            kitab={list}
            k={kitab}
            c={c}
            v={pelajari}
            pasal={data}
            nada={nada}
            go={onOpen}
            onClose={() => setPelajari(null)}
          />
        ) : null}
      </AnimatePresence>
      {toast ? (
        <p className="fixed inset-x-0 bottom-28 z-40 mx-auto w-max rounded-full bg-slate-950/90 px-4 py-2 fs-12.5 font-semibold text-white">
          {toast}
        </p>
      ) : null}
    </div>
  );
}

const SPEEDS = [0.9, 1, 1.2];
// Teks untuk diucapkan (tampilan tetap persis teks TB):
// - "ALLAH"/"Allah" dalam Alkitab diucapkan "Alah" (mesin suara cenderung melafalkan "Alloh").
// - Kata KAPITAL (TUHAN, ALLAH) dibaca sebagai kata biasa, bukan dieja huruf per huruf.
const ucapan = (t: string) =>
  t
    .replace(/\bALLAH\b|\bAllah\b/g, 'Alah')
    .replace(/\b([A-Z])([A-Z]{2,})\b/g, (_, a: string, b: string) => a + b.toLowerCase());
// Pilih suara bahasa Indonesia paling natural yang tersedia (Neural/Natural/Online/Google lebih baik dari suara standar).
const pilihSuara = () => {
  const id = window.speechSynthesis.getVoices().filter((x) => x.lang?.toLowerCase().replace('_', '-').startsWith('id'));
  const skor = (v: SpeechSynthesisVoice) =>
    (/natural|neural/i.test(v.name) ? 4 : 0) + (/online|google/i.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);
  return id.sort((a, b) => skor(b) - skor(a))[0];
};
// Membacakan ayat dengan suara bawaan perangkat (Web Speech API, bahasa Indonesia), ayat demi ayat.
function useBacakan(data: Pasal | null, onFocus: (i: number) => void) {
  const bisa = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [aktif, setAktif] = useState(false);
  const [jeda, setJeda] = useState(false);
  const [index, setIndex] = useState(0);
  const [kecepatan, setKecepatan] = useState(1);
  const run = useRef(0);
  const speedRef = useRef(1);
  useEffect(() => {
    speedRef.current = kecepatan;
  }, [kecepatan]);
  useEffect(
    () => () => {
      if (bisa) window.speechSynthesis.cancel();
    },
    [bisa],
  );
  const ucap = (i: number, id: number) => {
    if (!data || id !== run.current) return;
    if (i >= data.ayat.length) {
      setAktif(false);
      return;
    }
    setIndex(i);
    onFocus(i);
    const u = new SpeechSynthesisUtterance(ucapan(data.ayat[i].teks));
    u.lang = 'id-ID';
    u.rate = speedRef.current * 0.95;
    const v = pilihSuara();
    if (v) u.voice = v;
    u.onend = () => ucap(i + 1, id);
    window.speechSynthesis.speak(u);
  };
  return {
    bisa,
    aktif,
    jeda,
    index,
    kecepatan,
    mulai(i: number) {
      if (!bisa) return;
      window.speechSynthesis.cancel();
      const id = ++run.current;
      setAktif(true);
      setJeda(false);
      ucap(i, id);
    },
    stop() {
      run.current++;
      if (bisa) window.speechSynthesis.cancel();
      setAktif(false);
      setJeda(false);
    },
    toggleJeda() {
      if (!bisa) return;
      if (jeda) window.speechSynthesis.resume();
      else window.speechSynthesis.pause();
      setJeda(!jeda);
    },
    gantiKecepatan() {
      setKecepatan(SPEEDS[(SPEEDS.indexOf(kecepatan) + 1) % SPEEDS.length]);
    },
  };
}
