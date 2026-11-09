'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Amiri_Quran } from 'next/font/google';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { BookOpen, Bookmark, ChevronRight, Home, Pause, Play, Search, Share2, Sparkles, Sunrise } from 'lucide-react';
import { QuranReader } from '@/components/teduh/QuranReader';
import { JadwalSholat } from '@/components/teduh/JadwalSholat';
import { AlkitabHome } from '@/components/teduh/AlkitabHome';
import { PelajariQuran } from '@/components/teduh/PelajariQuran';
import {
  AngkaNaik,
  Berurutan,
  Butir,
  CatatanPribadi,
  CincinProgres,
  JedaSejenak,
  LangitHero,
  sapaWaktu,
  TeduhShell,
  TitikMingguan,
  TombolJeda,
  type DockTab,
} from '@/components/teduh/ui';
import { AGAMA, agamaPilihan, type AgamaId } from '@/lib/teduh/agama';
import {
  TEMA,
  TOTAL_AYAT,
  audioService,
  ayatHariIni,
  loadMeta,
  loadSurah,
  loadTafsir,
  parseRef,
  progres,
  searchSurah,
  splitKey,
  streak,
  todayKey,
  type Ayat,
  type Sources,
  type SurahMeta,
} from '@/lib/teduh/quran';
import { bahanHariIni, catatan } from '@/lib/teduh/renungan';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { rp } from '@/lib/kanvas/data';
import { cn } from '@/lib/utils';

const amiri = Amiri_Quran({ weight: '400', subsets: ['arabic'], display: 'swap' });

// Pilihan agama & progres hanya di perangkat (data pribadi spesifik) — dibaca lewat useSyncExternalStore.
const agamaSubs = new Set<() => void>();
const useAgama = () =>
  useSyncExternalStore(
    (cb) => {
      agamaSubs.add(cb);
      return () => agamaSubs.delete(cb);
    },
    () => agamaPilihan.get(),
    () => null,
  );
const setAgama = (v: AgamaId | null) => {
  agamaPilihan.set(v);
  agamaSubs.forEach((l) => l());
};
const useProgres = () => useSyncExternalStore(progres.subscribe, progres.snapshot, () => null);
const useCatatan = () => useSyncExternalStore(catatan.subscribe, catatan.snapshot, () => null);

type Tab = 'beranda' | 'renungan' | 'baca' | 'tema' | 'simpan';
const TABS: DockTab<Tab>[] = [
  { id: 'beranda', label: 'Beranda', icon: Home },
  { id: 'renungan', label: 'Renungan', icon: Sunrise },
  { id: 'baca', label: 'Baca', icon: BookOpen },
  { id: 'tema', label: 'Tema', icon: Sparkles },
  { id: 'simpan', label: 'Simpan', icon: Bookmark },
];
const SUB: Record<Tab, string> = {
  beranda: "Al-Qur'an · ruang tenang",
  renungan: 'Renungan hari ini',
  baca: '114 surah',
  tema: 'Ayat untuk urusan uangmu',
  simpan: 'Ayat yang kamu tandai',
};
const SEDEKAH_RE = /sedekah|sodaqoh|shodaqoh|zakat|infa[qk]|wakaf|donasi|amal|kurban|qurban|fidyah/i;
const DZIKIR = [
  'Subhanallah — Maha Suci Allah',
  'Alhamdulillah — segala puji bagi Allah',
  'Allahu Akbar — Allah Maha Besar',
  'Hasbunallah — cukuplah Allah bagi kami',
];

export const greet = () => sapaWaktu();
const tanggalHijriah = (d: Date) => {
  try {
    return new Intl.DateTimeFormat('id-ID-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  } catch {
    return '';
  }
};

// Teduh: ruang tenang lintas agama — layar penuh (seperti Ladangku) dengan dock di bawah.
export function TeduhApp({ variant = 'web' }: { variant?: 'web' | 'app' }) {
  const agama = useAgama();
  const [ganti, setGanti] = useState(false);
  const pilih = AGAMA.find((a) => a.id === agama) ?? null;
  const tombolAgama = pilih ? (
    <button
      type="button"
      onClick={() => setGanti(true)}
      className="flex h-11 items-center gap-1.5 rounded-full bg-white px-3 fs-12.5 font-bold shadow-sm ring-1 ring-slate-200 transition hover:ring-slate-300 dark:bg-slate-900 dark:ring-slate-700"
    >
      <span>{pilih.emoji}</span> <span className="hidden sm:inline">{pilih.nama}</span>
    </button>
  ) : null;

  if (!pilih || ganti)
    return (
      <TeduhShell variant={variant} nada="islam" judul="Teduh" sub="Ruang tenang di tengah urusan uang">
        <AgamaPicker
          current={agama}
          onPick={(id) => {
            setAgama(id);
            setGanti(false);
          }}
          onCancel={pilih ? () => setGanti(false) : undefined}
        />
      </TeduhShell>
    );
  if (pilih.siap && pilih.id === 'islam') return <QuranHome variant={variant} kanan={tombolAgama} />;
  if (pilih.siap && (pilih.id === 'kristen' || pilih.id === 'katolik'))
    return <AlkitabHome variant={variant} katolik={pilih.id === 'katolik'} kanan={tombolAgama} />;
  return (
    <TeduhShell variant={variant} nada="islam" judul="Teduh" sub={pilih.kitab} kanan={tombolAgama}>
      <SegeraHadir agama={pilih.id} onGanti={() => setGanti(true)} />
    </TeduhShell>
  );
}

function AgamaPicker({
  current,
  onPick,
  onCancel,
}: {
  current: AgamaId | null;
  onPick: (id: AgamaId) => void;
  onCancel?: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <section className="space-y-4">
      <div className="text-center">
        <motion.p
          initial={reduce ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          className="fsh-40"
        >
          🕊️
        </motion.p>
        <h2 className="mt-1 fsh-26 font-black">Pilih agamamu</h2>
        <p className="mx-auto max-w-md fs-13.5 text-slate-500">
          Teduh menyesuaikan kitab, renungan, dan doanya. Pilihan ini <b>hanya disimpan di perangkat ini</b> — tidak
          dikirim ke server Leosiqra.
        </p>
      </div>
      <Berurutan className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {AGAMA.map((a) => (
          <Butir key={a.id}>
            <motion.button
              type="button"
              whileHover={reduce ? undefined : { y: -3 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onPick(a.id)}
              className={cn(
                'relative h-full w-full overflow-hidden rounded-[24px] bg-gradient-to-br p-4 text-left shadow-sm ring-1',
                a.tint,
                current === a.id ? 'ring-2 ring-slate-900 dark:ring-white' : 'ring-black/5',
              )}
            >
              <span className="absolute -right-3 -top-3 fsh-48 opacity-15">{a.emoji}</span>
              <span className="fsh-28">{a.emoji}</span>
              <span className="mt-1 block fs-15 font-black">{a.nama}</span>
              <span className="block fs-12 opacity-80">{a.kitab}</span>
              {!a.siap ? (
                <span className="mt-1.5 inline-block rounded-full bg-white/70 px-2 py-0.5 fs-11 font-bold">
                  Segera hadir
                </span>
              ) : null}
            </motion.button>
          </Butir>
        ))}
      </Berurutan>
      {onCancel ? (
        <button type="button" onClick={onCancel} className="mx-auto block fs-13 font-bold text-slate-500">
          Batal
        </button>
      ) : null}
    </section>
  );
}

function SegeraHadir({ agama, onGanti }: { agama: AgamaId; onGanti: () => void }) {
  const a = AGAMA.find((x) => x.id === agama)!;
  return (
    <section className={cn('rounded-[28px] bg-gradient-to-br p-6 md:p-8', a.tint)}>
      <p className="fsh-34">{a.emoji}</p>
      <h2 className="mt-1 fsh-24 font-black">{a.kitab} sedang disiapkan</h2>
      <p className="mt-2 max-w-2xl fs-14 leading-relaxed opacity-90">
        Kami sedang mengurus teks kitab & terjemahan Indonesia dari sumber resmi yang berizin, supaya isinya tepat dan
        sah dipakai. Teduh untuk umat {a.nama} akan hadir dengan bacaan harian, pustaka kitab, tema keuangan (mis.{' '}
        {a.memberi.toLowerCase()}), dan suara.
      </p>
      <button type="button" onClick={onGanti} className="mt-4 h-10 rounded-full bg-white/80 px-4 fs-13 font-bold">
        Ganti pilihan agama
      </button>
    </section>
  );
}

function QuranHome({ variant, kanan }: { variant: 'web' | 'app'; kanan: React.ReactNode }) {
  const [meta, setMeta] = useState<{ sources: Sources; surah: SurahMeta[] } | null>(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<Tab>('beranda');
  const [open, setOpen] = useState<{ s: number; a?: number; seq: number } | null>(null);
  const [jeda, setJeda] = useState(false);
  const store = useProgres();
  useEffect(() => {
    loadMeta()
      .then(setMeta)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Gagal memuat.'));
  }, []);
  const marks = useMemo(() => new Set((store?.marks ?? []).map((m) => m.k)), [store]);
  const go = (s: number, a?: number) => {
    setOpen({ s, a, seq: Date.now() });
    window.scrollTo({ top: 0 });
  };

  const list = meta?.surah ?? [];
  const reader = open && meta ? list.find((x) => x.n === open.s) : null;
  return (
    <>
      <TeduhShell
        variant={variant}
        nada="islam"
        tabs={TABS}
        tab={tab}
        onTab={setTab}
        judul="Teduh"
        sub={SUB[tab]}
        kanan={kanan}
        polos={Boolean(reader)}
      >
        {err ? <p className="rounded-2xl bg-rose-50 px-4 py-3 fs-13 font-semibold text-rose-700">{err}</p> : null}
        {!meta && !err ? <p className="py-16 text-center fs-13 text-slate-400">Memuat Al-Qur&apos;an…</p> : null}
        {reader && open ? (
          <QuranReader
            key={`${open.s}-${open.seq}`}
            meta={reader}
            list={list}
            startAyat={open.a}
            marks={marks}
            arabClass={amiri.className}
            onClose={() => setOpen(null)}
            onOpen={go}
          />
        ) : meta ? (
          <>
            {tab === 'beranda' ? (
              <Beranda list={list} store={store} go={go} setTab={setTab} onJeda={() => setJeda(true)} />
            ) : null}
            {tab === 'renungan' ? <Renungan list={list} go={go} onJeda={() => setJeda(true)} /> : null}
            {tab === 'baca' ? <Pustaka list={list} store={store} go={go} /> : null}
            {tab === 'tema' ? <TemaView list={list} go={go} /> : null}
            {tab === 'simpan' ? <Tersimpan list={list} marks={store?.marks ?? []} go={go} /> : null}
            <Credits sources={meta.sources} />
          </>
        ) : null}
      </TeduhShell>
      <AnimatePresence>
        {jeda ? <JedaSejenak nada="islam" kalimat={DZIKIR} onClose={() => setJeda(false)} /> : null}
      </AnimatePresence>
    </>
  );
}

type StoreSnap = ReturnType<typeof progres.snapshot> | null;

const useAyat = (s: number, a: number) => {
  const [ay, setAy] = useState<{ k: string; v: Ayat | null } | null>(null);
  useEffect(() => {
    let alive = true;
    loadSurah(s)
      .then((d) => alive && setAy({ k: `${s}:${a}`, v: d.ayat[a - 1] ?? null }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [s, a]);
  return ay?.k === `${s}:${a}` ? ay.v : null;
};

function AyatCard({
  k,
  list,
  label,
  go,
  extra,
}: {
  k: string;
  list: SurahMeta[];
  label?: string;
  go: (s: number, a?: number) => void;
  extra?: React.ReactNode;
}) {
  const { s, a } = splitKey(k);
  const m = list.find((x) => x.n === s);
  const ay = useAyat(s, a);
  return (
    <article className="relative overflow-hidden rounded-[26px] bg-white p-5 ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-100/50 blur-2xl dark:bg-emerald-500/10"
      />
      <div className="relative flex items-center justify-between gap-2">
        <span className="fs-12 font-bold text-slate-400">{label}</span>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 fs-11 font-black uppercase tracking-wider text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          {m?.latin} · {s}:{a}
        </span>
      </div>
      {ay ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
          <p dir="rtl" lang="ar" className={cn('relative mt-4 text-center fsh-28 leading-[2.1]', amiri.className)}>
            {ay[0]}
          </p>
          <p className="mt-2 text-center fs-14.5 leading-relaxed text-slate-700 dark:text-slate-300">
            {ay[1].replace(/\[\d+\]/g, '')}
          </p>
        </motion.div>
      ) : (
        <div className="mt-5 space-y-2">
          <div className="mx-auto h-6 w-4/5 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
          <div className="mx-auto h-4 w-3/5 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
        </div>
      )}
      <div className="relative mt-4 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => go(s, a)}
          className="h-10 rounded-full bg-slate-900 px-4 fs-13 font-bold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900"
        >
          Baca dalam surahnya
        </button>
        {extra}
      </div>
    </article>
  );
}

function Beranda({
  list,
  store,
  go,
  setTab,
  onJeda,
}: {
  list: SurahMeta[];
  store: StoreSnap;
  go: (s: number, a?: number) => void;
  setTab: (t: Tab) => void;
  onJeda: () => void;
}) {
  const hari = ayatHariIni();
  const days = store?.days ?? {};
  const st = streak(days);
  const read = store ? progres.countRead() : 0;
  const pct = read / TOTAL_AYAT;
  const last = store?.last ? list.find((x) => x.n === store.last!.s) : null;
  const [now] = useState(() => new Date());
  const { s, a } = splitKey(hari.k);
  const ay = useAyat(s, a);
  const mHari = list.find((x) => x.n === s);
  const [sedekah, setSedekah] = useState<{ total: number; n: number } | null>(null);
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
            SEDEKAH_RE.test(`${t.note ?? ''} ${t.category ?? ''} ${t.subCategory ?? ''}`)
          );
        });
        setSedekah({
          total: mine.reduce((a, t) => a + (Number(t.amountIDR) || Number(t.amount) || 0), 0),
          n: mine.length,
        });
      })
      .catch(() => setSedekah(null));
  }, []);

  return (
    <Berurutan className="space-y-4">
      <Butir>
        <LangitHero
          nada="islam"
          sapa={greet()}
          judul="Teduhkan hati sebentar."
          tanggal={`${tanggalHijriah(now)} · ${now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`}
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
              onClick={() => (last ? go(last.n, store!.last!.a) : go(1))}
              className="flex h-10 items-center gap-1.5 rounded-full bg-white px-3.5 fs-12.5 font-bold text-slate-900 shadow-sm transition hover:bg-white/90"
            >
              <BookOpen size={15} /> {last ? `Lanjut ${last.latin}` : 'Mulai membaca'}
            </button>
          </div>
        </LangitHero>
      </Butir>

      <div className="grid gap-4 md:grid-cols-2">
        <Butir>
          <button
            type="button"
            onClick={() => setTab('renungan')}
            className="group relative flex h-full w-full flex-col overflow-hidden rounded-[26px] bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-5 text-left ring-1 ring-amber-100 transition hover:shadow-lg dark:from-amber-500/10 dark:via-slate-900 dark:to-emerald-500/10 dark:ring-amber-500/20"
          >
            <span className="flex items-center gap-2 fs-11.5 font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
              <Sunrise size={15} /> Renungan hari ini · {hari.tema.judul}
            </span>
            <span dir="rtl" lang="ar" className={cn('mt-3 line-clamp-2 fsh-24 leading-[2]', amiri.className)}>
              {ay?.[0] ?? '…'}
            </span>
            <span className="mt-1 line-clamp-3 fs-13.5 leading-relaxed text-slate-600 dark:text-slate-300">
              {ay ? ay[1].replace(/\[\d+\]/g, '') : 'Memuat ayat…'}
            </span>
            <span className="mt-auto flex items-center justify-between pt-4">
              <span className="fs-12 font-bold text-slate-400">
                QS {mHari?.latin} {hari.k}
              </span>
              <span className="flex items-center gap-1 rounded-full bg-slate-900 px-3.5 py-2 fs-12.5 font-bold text-white transition group-hover:gap-2 dark:bg-white dark:text-slate-900">
                Renungkan <ChevronRight size={15} />
              </span>
            </span>
          </button>
        </Butir>
        <Butir>
          <JadwalSholat />
        </Butir>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Butir>
          <div className="flex h-full items-center gap-4 rounded-[24px] bg-white p-4 ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800">
            <CincinProgres pct={pct} />
            <span className="min-w-0 flex-1">
              <span className="block fs-14.5 font-black">Menuju khatam</span>
              <span className="block fs-12 text-slate-500">
                <AngkaNaik nilai={read} /> dari {TOTAL_AYAT.toLocaleString('id-ID')} ayat
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
              💝
            </motion.span>
            <div className="min-w-0 flex-1">
              <p className="fs-14.5 font-black text-amber-900 dark:text-amber-100">Sedekah bulan ini</p>
              <p className="fs-12.5 text-amber-800/80 dark:text-amber-200/80">
                {sedekah === null
                  ? 'Dari catatan keuanganmu (sedekah, zakat, infak, wakaf).'
                  : sedekah.n
                    ? `${rp(sedekah.total)} dari ${sedekah.n} catatan`
                    : 'Belum ada yang tercatat bulan ini.'}
              </p>
            </div>
            <Link
              href="/input-cepat?teks=Sedekah"
              className="h-10 shrink-0 rounded-full bg-amber-500 px-3.5 fs-12.5 font-bold leading-10 text-white transition hover:bg-amber-600"
            >
              Catat
            </Link>
          </section>
        </Butir>
      </div>

      <Butir>
        <div className="rounded-[24px] bg-white p-4 ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800">
          <div className="mb-3 flex items-center justify-between">
            <p className="fs-14.5 font-black">Ayat untuk urusan uangmu</p>
            <button
              type="button"
              onClick={() => setTab('tema')}
              className="flex items-center gap-0.5 fs-12.5 font-bold text-emerald-700"
            >
              Semua <ChevronRight size={14} />
            </button>
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            {TEMA.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab('tema')}
                className="flex shrink-0 flex-col items-start gap-1 rounded-2xl bg-slate-50 px-3.5 py-3 text-left ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:ring-emerald-200 dark:bg-slate-800 dark:ring-slate-700"
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

// ── Renungan harian: ayat + tafsir ringkas + bahan renungan + langkah kecil + catatan pribadi ──
function Renungan({
  list,
  go,
  onJeda,
}: {
  list: SurahMeta[];
  go: (s: number, a?: number) => void;
  onJeda: () => void;
}) {
  const [now] = useState(() => new Date());
  const hari = ayatHariIni(now);
  const { s, a } = splitKey(hari.k);
  const m = list.find((x) => x.n === s);
  const ay = useAyat(s, a);
  const [tafsir, setTafsir] = useState<string | null>(null);
  const [pelajari, setPelajari] = useState(false);
  const [toast, setToast] = useState('');
  const bahan = bahanHariIni(hari.tema.id, now);
  const tgl = todayKey(now);
  const cat = useCatatan();
  const appMode = typeof window !== 'undefined' && window.location.pathname.startsWith('/app');
  const audio = useSatuAyat(s, a, m?.ayat ?? 0);
  useEffect(() => {
    let alive = true;
    loadTafsir(s)
      .then((t) => alive && setTafsir(t.tafsir[a - 1] ?? ''))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [s, a]);
  const jumlahCatatan = Object.keys(cat?.hari ?? {}).length;
  const share = async () => {
    if (!ay) return;
    const text = `${ay[0]}\n\n${ay[1].replace(/\[\d+\]/g, '')}\n— QS ${m?.latin} ${hari.k} (Terjemahan Kemenag RI)\n\n${bahan.renung}`;
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="fs-12 font-bold uppercase tracking-wider text-slate-400">
              {now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })} ·{' '}
              {tanggalHijriah(now)}
            </p>
            <h2 className="fsh-26 font-black">
              {hari.tema.emoji} {hari.tema.judul}
            </h2>
          </div>
          <span className="rounded-full bg-white px-3 py-1.5 fs-12 font-bold text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
            Berganti setiap hari
          </span>
        </div>
      </Butir>

      <Butir>
        <article className="relative overflow-hidden rounded-[30px] bg-gradient-to-b from-emerald-900 via-emerald-800 to-teal-900 p-6 text-white md:p-8">
          <svg aria-hidden viewBox="0 0 200 200" className="absolute -left-16 -top-16 h-64 w-64 text-white/[0.06]">
            <rect x="40" y="40" width="120" height="120" fill="none" stroke="currentColor" strokeWidth="3" />
            <rect
              x="40"
              y="40"
              width="120"
              height="120"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              transform="rotate(45 100 100)"
            />
          </svg>
          <p className="relative text-center fs-11.5 font-black uppercase tracking-[0.2em] text-emerald-200/80">
            QS {m?.latin} · {hari.k}
          </p>
          {ay ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <p dir="rtl" lang="ar" className={cn('relative mt-4 text-center fsh-34 leading-[2.15]', amiri.className)}>
                {ay[0]}
              </p>
              <p className="relative mx-auto mt-3 max-w-2xl text-center fs-15.5 leading-relaxed text-emerald-50/90">
                {ay[1].replace(/\[\d+\]/g, '')}
              </p>
            </motion.div>
          ) : (
            <p className="py-10 text-center fs-13 text-white/60">Memuat ayat…</p>
          )}
          <div className="relative mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={audio.toggle}
              className="flex h-10 items-center gap-1.5 rounded-full bg-white px-4 fs-13 font-bold text-emerald-900"
            >
              {audio.main ? <Pause size={15} /> : <Play size={15} />} {audio.main ? 'Jeda' : 'Dengarkan'}
            </button>
            <button
              type="button"
              onClick={() => setPelajari(true)}
              className="flex h-10 items-center gap-1.5 rounded-full bg-white/15 px-4 fs-13 font-bold ring-1 ring-white/25"
            >
              <Sparkles size={15} className="text-amber-300" /> Pelajari
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
          {audio.err ? <p className="relative mt-2 text-center fs-12 text-amber-200">{audio.err}</p> : null}
        </article>
      </Butir>

      <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
        <Butir>
          <section className="h-full rounded-[26px] bg-white p-5 ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800">
            <p className="fs-11.5 font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              Tafsir ringkas
            </p>
            <p className="mt-2 fs-14.5 leading-relaxed text-slate-700 dark:text-slate-200">
              {tafsir ?? 'Memuat tafsir…'}
            </p>
            <p className="mt-3 fs-11 text-slate-400">
              Al-Mukhtasar fi Tafsir al-Qur&apos;an al-Karim, via QuranEnc.com — tanpa diubah.
            </p>
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

      <Butir>
        <button
          type="button"
          onClick={() => go(s, a)}
          className="flex w-full items-center justify-between rounded-[22px] bg-slate-900 px-5 py-4 fs-14 font-bold text-white dark:bg-white dark:text-slate-900"
        >
          Lanjut baca QS {m?.latin} <ChevronRight size={18} />
        </button>
      </Butir>
      <AnimatePresence>
        {pelajari && m ? (
          <PelajariQuran meta={m} a={a} arabClass={amiri.className} onClose={() => setPelajari(false)} />
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

/** Putar murattal satu ayat (qari pilihan terakhir). */
function useSatuAyat(s: number, a: number, count: number) {
  const el = useRef<HTMLAudioElement | null>(null);
  const [main, setMain] = useState(false);
  const [err, setErr] = useState('');
  useEffect(
    () => () => {
      el.current?.pause();
    },
    [],
  );
  return {
    main,
    err,
    async toggle() {
      if (main && el.current) {
        el.current.pause();
        setMain(false);
        return;
      }
      setErr('');
      try {
        if (!el.current) {
          const r = await audioService.surah(s, progres.snapshot().qari || 7, count);
          const src = r.items.find((x) => x.key === `${s}:${a}`)?.url;
          if (!src) throw new Error('Audio ayat ini belum tersedia.');
          el.current = new Audio(src);
          el.current.onended = () => setMain(false);
          el.current.onpause = () => setMain(false);
        }
        await el.current.play();
        setMain(true);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Audio belum bisa diputar.');
        setMain(false);
      }
    },
  };
}

function Pustaka({ list, store, go }: { list: SurahMeta[]; store: StoreSnap; go: (s: number, a?: number) => void }) {
  const [q, setQ] = useState('');
  const [hint, setHint] = useState('');
  const shown = searchSurah(q, list);
  const perSurah = useMemo(() => {
    if (!store) return new Map<number, number>();
    const m = new Map<number, number>();
    const u = progres.readBits();
    for (const s of list) {
      let n = 0;
      for (let i = s.start; i < s.start + s.ayat; i++) if (u[i >> 3] & (1 << (i & 7))) n++;
      if (n) m.set(s.n, n);
    }
    return m;
  }, [list, store]);
  return (
    <section className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const r = parseRef(q, list);
          if (r) go(r.s, r.a);
          else if (shown.length === 1) go(shown[0].n);
          else setHint(/\d/.test(q) ? 'Nomor surah/ayat tidak ditemukan.' : '');
        }}
        className="sticky top-2 z-10 flex h-13 items-center gap-2 rounded-2xl bg-white/95 px-4 shadow-sm ring-1 ring-slate-200 backdrop-blur dark:bg-slate-900/95 dark:ring-slate-700"
      >
        <Search size={18} className="text-slate-400" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setHint('');
          }}
          placeholder="Cari surah, atau ketik 2:255"
          className="h-12 min-w-0 flex-1 bg-transparent fs-14.5 outline-none"
        />
      </form>
      {hint ? <p className="fs-12.5 font-semibold text-rose-600">{hint}</p> : null}
      <div className="grid gap-2 md:grid-cols-2">
        {shown.map((s) => {
          const done = perSurah.get(s.n) ?? 0;
          return (
            <button
              key={s.n}
              type="button"
              onClick={() => go(s.n)}
              className="group flex items-center gap-3 rounded-[20px] bg-white px-3.5 py-3 text-left ring-1 ring-slate-200/80 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-emerald-200 dark:bg-slate-900 dark:ring-slate-800"
            >
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center">
                <svg
                  viewBox="0 0 40 40"
                  className="absolute inset-0 text-emerald-500/40 transition group-hover:rotate-45 group-hover:text-emerald-500"
                >
                  <rect x="8" y="8" width="24" height="24" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  <rect
                    x="8"
                    y="8"
                    width="24"
                    height="24"
                    rx="3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    transform="rotate(45 20 20)"
                  />
                </svg>
                <span className="relative fs-12 font-black">{s.n}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate fs-14.5 font-bold">{s.latin}</span>
                <span className="block fs-12 text-slate-500">
                  {s.ayat} ayat · {s.type}
                  {done ? ` · ${done === s.ayat ? 'selesai ✓' : `${done} dibaca`}` : ''}
                </span>
                {done ? (
                  <span className="mt-1 block h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <span
                      className="block h-full rounded-full bg-emerald-500"
                      style={{ width: `${(done / s.ayat) * 100}%` }}
                    />
                  </span>
                ) : null}
              </span>
              <span
                dir="rtl"
                lang="ar"
                className={cn('shrink-0 fsh-24 text-emerald-800 dark:text-emerald-200', amiri.className)}
              >
                {s.ar}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function TemaView({ list, go }: { list: SurahMeta[]; go: (s: number, a?: number) => void }) {
  const [sel, setSel] = useState(TEMA[0].id);
  const t = TEMA.find((x) => x.id === sel)!;
  const appMode = typeof window !== 'undefined' && window.location.pathname.startsWith('/app');
  return (
    <section className="space-y-3">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {TEMA.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setSel(x.id)}
            className={cn(
              'relative h-10 shrink-0 rounded-full px-3.5 fs-13 font-bold',
              sel === x.id
                ? 'text-white dark:text-slate-900'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700',
            )}
          >
            {sel === x.id ? (
              <motion.span
                layoutId="tema-quran"
                className="absolute inset-0 rounded-full bg-slate-900 dark:bg-white"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            ) : null}
            <span className="relative">
              {x.emoji} {x.judul}
            </span>
          </button>
        ))}
      </div>
      {t.ajak ? (
        <Link
          href={appMode && t.ajak.app ? t.ajak.app : t.ajak.href}
          className="flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3 fs-13.5 font-bold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200"
        >
          {t.ajak.label} <ChevronRight size={16} />
        </Link>
      ) : null}
      <Berurutan key={sel} className="grid gap-3 md:grid-cols-2">
        {t.ayat.map((k) => (
          <Butir key={k}>
            <AyatCard k={k} list={list} label={t.judul} go={go} />
          </Butir>
        ))}
      </Berurutan>
    </section>
  );
}

function Tersimpan({
  list,
  marks,
  go,
}: {
  list: SurahMeta[];
  marks: { k: string; at: number }[];
  go: (s: number, a?: number) => void;
}) {
  return (
    <section className="space-y-3">
      <p className="fs-13 text-slate-500">Ayat yang kamu tandai — disimpan di perangkat ini.</p>
      {marks.length ? (
        <Berurutan className="grid gap-3 md:grid-cols-2">
          {marks.map((m) => (
            <Butir key={m.k}>
              <AyatCard k={m.k} list={list} go={go} />
            </Butir>
          ))}
        </Berurutan>
      ) : (
        <div className="rounded-[26px] bg-white p-10 text-center ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800">
          <p className="fsh-34">🔖</p>
          <p className="mt-2 fs-14 font-bold">Belum ada ayat tersimpan</p>
          <p className="fs-13 text-slate-500">Ketuk ikon penanda di samping ayat saat membaca.</p>
        </div>
      )}
    </section>
  );
}

function Credits({ sources }: { sources: Sources }) {
  return (
    <p className="pt-2 fs-11.5 leading-relaxed text-slate-400">
      Teks Al-Qur&apos;an: {sources.arab.nama},{' '}
      <a href="https://tanzil.net" target="_blank" rel="noreferrer" className="underline">
        tanzil.net
      </a>{' '}
      ({sources.arab.lisensi}). Terjemahan: {sources.terjemahan.nama}, versi {sources.terjemahan.versi}, dan tafsir
      Al-Mukhtasar, dari{' '}
      <a href={sources.terjemahan.url} target="_blank" rel="noreferrer" className="underline">
        QuranEnc.com
      </a>
      , tanpa diubah. Audio murattal & kata per kata: Quran.com.
    </p>
  );
}
