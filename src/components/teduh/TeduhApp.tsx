'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Amiri_Quran } from 'next/font/google';
import { ArrowLeft, BookOpen, Bookmark, ChevronRight, Home, Search, Sparkles } from 'lucide-react';
import { QuranReader } from '@/components/teduh/QuranReader';
import { JadwalSholat } from '@/components/teduh/JadwalSholat';
import { AGAMA, agamaPilihan, type AgamaId } from '@/lib/teduh/agama';
import {
  TEMA,
  TOTAL_AYAT,
  ayatHariIni,
  loadMeta,
  loadSurah,
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

type Tab = 'beranda' | 'baca' | 'tema' | 'simpan';
const TABS: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: 'beranda', label: 'Beranda', icon: Home },
  { id: 'baca', label: 'Baca', icon: BookOpen },
  { id: 'tema', label: 'Tema', icon: Sparkles },
  { id: 'simpan', label: 'Tersimpan', icon: Bookmark },
];
const SEDEKAH_RE = /sedekah|sodaqoh|shodaqoh|zakat|infa[qk]|wakaf|donasi|amal|kurban|qurban|fidyah/i;

// Teduh: ruang tenang lintas agama. Rilis 1: Al-Qur'an lengkap; agama lain menunggu sumber kitab berizin.
export function TeduhApp({ variant = 'web' }: { variant?: 'web' | 'app' }) {
  const agama = useAgama();
  const [ganti, setGanti] = useState(false);
  const pilih = AGAMA.find((a) => a.id === agama) ?? null;

  const header = (
    <div className="flex items-center gap-3">
      {variant === 'app' ? (
        <Link
          href="/app/more"
          aria-label="Kembali"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
        >
          <ArrowLeft size={18} />
        </Link>
      ) : null}
      <div className="min-w-0 flex-1">
        <h1 className={cn('font-black tracking-tight', variant === 'app' ? 'fsh-22' : 'fsh-34')}>Teduh</h1>
        {variant === 'web' ? (
          <p className="fs-13.5 text-slate-500">Ruang tenang untuk hatimu, di tengah urusan uang.</p>
        ) : null}
      </div>
      {pilih ? (
        <button
          type="button"
          onClick={() => setGanti(true)}
          className="flex h-10 items-center gap-1.5 rounded-full bg-white px-3 fs-12.5 font-bold ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
        >
          <span>{pilih.emoji}</span> {pilih.nama}
        </button>
      ) : null}
    </div>
  );

  return (
    <div
      className={cn(
        'text-slate-900 dark:text-white',
        variant === 'app' &&
          'min-h-dvh bg-[#f6f5f1] px-4 pb-28 pt-[max(12px,env(safe-area-inset-top))] dark:bg-slate-950',
      )}
    >
      <div className="mx-auto max-w-3xl space-y-5">
        {header}
        {!pilih || ganti ? (
          <AgamaPicker
            current={agama}
            onPick={(id) => {
              setAgama(id);
              setGanti(false);
            }}
            onCancel={pilih ? () => setGanti(false) : undefined}
          />
        ) : pilih.siap ? (
          <QuranHome variant={variant} />
        ) : (
          <SegeraHadir agama={pilih.id} onGanti={() => setGanti(true)} />
        )}
      </div>
    </div>
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
  return (
    <section className="space-y-3">
      <div>
        <h2 className="fsh-22 font-black">Pilih agamamu</h2>
        <p className="fs-13 text-slate-500">
          Teduh menyesuaikan kitab & renungannya. Pilihan ini <b>hanya disimpan di perangkat ini</b> — tidak dikirim ke
          server Leosiqra.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {AGAMA.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onPick(a.id)}
            className={cn(
              'rounded-[22px] bg-gradient-to-br p-4 text-left ring-1 transition hover:scale-[1.01]',
              a.tint,
              current === a.id ? 'ring-2 ring-slate-900 dark:ring-white' : 'ring-black/5',
            )}
          >
            <span className="fsh-26">{a.emoji}</span>
            <span className="mt-1 block fs-15 font-black">{a.nama}</span>
            <span className="block fs-12 opacity-80">{a.kitab}</span>
            {!a.siap ? (
              <span className="mt-1.5 inline-block rounded-full bg-white/70 px-2 py-0.5 fs-11 font-bold">
                Segera hadir
              </span>
            ) : null}
          </button>
        ))}
      </div>
      {onCancel ? (
        <button type="button" onClick={onCancel} className="fs-13 font-bold text-slate-500">
          Batal
        </button>
      ) : null}
    </section>
  );
}

function SegeraHadir({ agama, onGanti }: { agama: AgamaId; onGanti: () => void }) {
  const a = AGAMA.find((x) => x.id === agama)!;
  return (
    <section className={cn('rounded-[26px] bg-gradient-to-br p-6', a.tint)}>
      <p className="fsh-34">{a.emoji}</p>
      <h2 className="mt-1 fsh-24 font-black">{a.kitab} sedang disiapkan</h2>
      <p className="mt-2 fs-14 leading-relaxed opacity-90">
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

const greet = () => {
  const h = new Date().getHours();
  return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
};

function QuranHome({ variant }: { variant: 'web' | 'app' }) {
  const [meta, setMeta] = useState<{ sources: Sources; surah: SurahMeta[] } | null>(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<Tab>('beranda');
  const [open, setOpen] = useState<{ s: number; a?: number; seq: number } | null>(null);
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

  if (err) return <p className="rounded-2xl bg-rose-50 px-4 py-3 fs-13 font-semibold text-rose-700">{err}</p>;
  if (!meta) return <p className="py-10 text-center fs-13 text-slate-400">Memuat Al-Qur&apos;an…</p>;

  const list = meta.surah;
  if (open) {
    const m = list.find((x) => x.n === open.s)!;
    return (
      <QuranReader
        key={`${open.s}-${open.seq}`}
        meta={m}
        list={list}
        startAyat={open.a}
        marks={marks}
        arabClass={amiri.className}
        onClose={() => setOpen(null)}
        onOpen={go}
      />
    );
  }

  return (
    <div className="space-y-5">
      {tab === 'beranda' ? <Beranda list={list} store={store} go={go} setTab={setTab} /> : null}
      {tab === 'baca' ? <Pustaka list={list} store={store} go={go} /> : null}
      {tab === 'tema' ? <TemaView list={list} go={go} /> : null}
      {tab === 'simpan' ? <Tersimpan list={list} marks={store?.marks ?? []} go={go} /> : null}
      <Credits sources={meta.sources} />
      <nav
        className={cn(
          'sticky z-30 mx-auto flex w-[min(460px,100%)] gap-1 rounded-full bg-white/95 p-1.5 shadow-xl ring-1 ring-slate-200 backdrop-blur dark:bg-slate-900/95 dark:ring-slate-700',
          variant === 'app' ? 'bottom-[calc(env(safe-area-inset-bottom)+12px)]' : 'bottom-5',
        )}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              window.scrollTo({ top: 0 });
            }}
            className={cn(
              'flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-full fs-11 font-bold',
              tab === t.id
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200'
                : 'text-slate-500',
            )}
          >
            <t.icon size={18} />
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

type StoreSnap = ReturnType<typeof progres.snapshot> | null;

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
  const [ay, setAy] = useState<Ayat | null>(null);
  useEffect(() => {
    let alive = true;
    loadSurah(s)
      .then((d) => alive && setAy(d.ayat[a - 1] ?? null))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [s, a]);
  return (
    <article className="rounded-[24px] bg-white p-5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
      <div className="flex items-center justify-between gap-2">
        <span className="fs-12 font-bold text-slate-400">{label}</span>
        <span className="fs-11.5 font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
          {m?.latin} · {s}:{a}
        </span>
      </div>
      {ay ? (
        <>
          <p dir="rtl" lang="ar" className={cn('mt-3 text-center fsh-28 leading-[2.1]', amiri.className)}>
            {ay[0]}
          </p>
          <p className="mt-2 text-center fs-14.5 leading-relaxed text-slate-700 dark:text-slate-300">
            {ay[1].replace(/\[\d+\]/g, '')}
          </p>
        </>
      ) : (
        <p className="py-6 text-center fs-12.5 text-slate-400">Memuat ayat…</p>
      )}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => go(s, a)}
          className="h-10 rounded-full bg-slate-900 px-4 fs-13 font-bold text-white dark:bg-white dark:text-slate-900"
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
}: {
  list: SurahMeta[];
  store: StoreSnap;
  go: (s: number, a?: number) => void;
  setTab: (t: Tab) => void;
}) {
  const hari = ayatHariIni();
  const days = store?.days ?? {};
  const st = streak(days);
  const read = store ? progres.countRead() : 0;
  const pct = read / TOTAL_AYAT;
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { d, on: Boolean(days[todayKey(d)]) };
  });
  const last = store?.last ? list.find((x) => x.n === store.last!.s) : null;
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
    <>
      <section className="overflow-hidden rounded-[28px] bg-gradient-to-br from-emerald-700 via-teal-700 to-sky-800 p-5 text-white">
        <p className="fs-12 font-bold uppercase tracking-[0.18em] text-white/60">{greet()}</p>
        <p className="mt-1 fsh-26 font-black leading-tight">Teduhkan hati sebentar.</p>
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <p className="fsh-34 font-black leading-none">{st}</p>
            <p className="fs-12.5 text-white/75">hari berturut-turut membaca</p>
          </div>
          <div className="flex gap-1.5">
            {week.map((w) => (
              <span key={w.d.toISOString()} className="flex flex-col items-center gap-1">
                <span className={cn('h-7 w-7 rounded-full', w.on ? 'bg-amber-300' : 'bg-white/15')} />
                <span className="fs-10 text-white/60">{w.d.toLocaleDateString('id-ID', { weekday: 'narrow' })}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      <JadwalSholat />

      <AyatCard k={hari.k} list={list} label={`Ayat hari ini · ${hari.tema.judul}`} go={go} />

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => (last ? go(last.n, store!.last!.a) : go(1))}
          className="flex items-center gap-3 rounded-[22px] bg-white p-4 text-left ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <BookOpen size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block fs-14.5 font-black">{last ? `Lanjut ${last.latin}` : 'Mulai membaca'}</span>
            <span className="block fs-12 text-slate-500">
              {last ? `Ayat ${store!.last!.a} dari ${last.ayat}` : 'Dari Al-Fatihah'}
            </span>
          </span>
          <ChevronRight size={18} className="text-slate-400" />
        </button>
        <div className="flex items-center gap-3 rounded-[22px] bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <Ring pct={pct} />
          <span className="min-w-0 flex-1">
            <span className="block fs-14.5 font-black">Menuju khatam</span>
            <span className="block fs-12 text-slate-500">
              {read.toLocaleString('id-ID')} dari {TOTAL_AYAT.toLocaleString('id-ID')} ayat
            </span>
          </span>
        </div>
      </div>

      <section className="flex items-center gap-3 rounded-[22px] bg-amber-50 p-4 ring-1 ring-amber-100 dark:bg-amber-500/10 dark:ring-amber-500/20">
        <span className="fsh-26">💝</span>
        <div className="min-w-0 flex-1">
          <p className="fs-14.5 font-black text-amber-900 dark:text-amber-100">Sedekah bulan ini</p>
          <p className="fs-12.5 text-amber-800/80 dark:text-amber-200/80">
            {sedekah === null
              ? 'Dihitung dari catatan keuanganmu (sedekah, zakat, infak, wakaf, donasi).'
              : sedekah.n
                ? `${rp(sedekah.total)} dari ${sedekah.n} catatan`
                : 'Belum ada yang tercatat bulan ini.'}
          </p>
        </div>
        <Link
          href="/input-cepat?teks=Sedekah"
          className="h-10 shrink-0 rounded-full bg-amber-500 px-3.5 fs-12.5 font-bold leading-10 text-white"
        >
          Catat
        </Link>
      </section>

      <button
        type="button"
        onClick={() => setTab('tema')}
        className="flex w-full items-center gap-3 rounded-[22px] bg-white p-4 text-left ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
      >
        <span className="fsh-24">{hari.tema.emoji}</span>
        <span className="min-w-0 flex-1">
          <span className="block fs-14.5 font-black">Ayat untuk urusan uangmu</span>
          <span className="block fs-12 text-slate-500">Rezeki, syukur, sedekah, utang, tidak boros, dan lainnya</span>
        </span>
        <ChevronRight size={18} className="text-slate-400" />
      </button>
    </>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" className="shrink-0">
      <circle cx="26" cy="26" r={r} fill="none" strokeWidth="6" className="stroke-slate-100 dark:stroke-slate-800" />
      <circle
        cx="26"
        cy="26"
        r={r}
        fill="none"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${Math.max(pct > 0 ? 2 : 0, c * pct)} ${c}`}
        transform="rotate(-90 26 26)"
        className="stroke-emerald-500"
      />
      <text x="26" y="30" textAnchor="middle" className="fill-current" style={{ fontSize: 11, fontWeight: 800 }}>
        {pct > 0 && pct < 0.01 ? '<1%' : `${Math.round(pct * 100)}%`}
      </text>
    </svg>
  );
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
      <div>
        <h2 className="fsh-24 font-black">Baca</h2>
        <p className="fs-13 text-slate-500">114 surah. Ketik nama surah, atau langsung ke ayat seperti 2:255.</p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const r = parseRef(q, list);
          if (r) go(r.s, r.a);
          else if (shown.length === 1) go(shown[0].n);
          else setHint(/\d/.test(q) ? 'Nomor surah/ayat tidak ditemukan.' : '');
        }}
        className="flex h-12 items-center gap-2 rounded-2xl bg-white px-3.5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
      >
        <Search size={17} className="text-slate-400" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setHint('');
          }}
          placeholder="Cari surah, atau ketik 2:255"
          className="h-full min-w-0 flex-1 bg-transparent fs-14 outline-none"
        />
      </form>
      {hint ? <p className="fs-12.5 font-semibold text-rose-600">{hint}</p> : null}
      <div className="overflow-hidden rounded-[22px] bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        {shown.map((s) => {
          const done = perSurah.get(s.n) ?? 0;
          return (
            <button
              key={s.n}
              type="button"
              onClick={() => go(s.n)}
              className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 fs-12 font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {s.n}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate fs-14.5 font-bold">{s.latin}</span>
                <span className="block fs-12 text-slate-500">
                  {s.ayat} ayat · {s.type}
                  {done ? ` · ${done === s.ayat ? 'selesai ✓' : `${done} dibaca`}` : ''}
                </span>
              </span>
              <span dir="rtl" lang="ar" className={cn('shrink-0 fsh-24', amiri.className)}>
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
      <div>
        <h2 className="fsh-24 font-black">Ayat untuk urusan uangmu</h2>
        <p className="fs-13 text-slate-500">Pilih tema — ayat-ayat yang berkaitan dengan rezeki dan harta.</p>
      </div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {TEMA.map((x) => (
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
          className="flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3 fs-13.5 font-bold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200"
        >
          {t.ajak.label} <ChevronRight size={16} />
        </Link>
      ) : null}
      <div className="space-y-3">
        {t.ayat.map((k) => (
          <AyatCard key={k} k={k} list={list} label={t.judul} go={go} />
        ))}
      </div>
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
      <div>
        <h2 className="fsh-24 font-black">Tersimpan</h2>
        <p className="fs-13 text-slate-500">Ayat yang kamu tandai (disimpan di perangkat ini).</p>
      </div>
      {marks.length ? (
        marks.map((m) => <AyatCard key={m.k} k={m.k} list={list} go={go} />)
      ) : (
        <p className="rounded-[22px] bg-white p-6 text-center fs-13.5 text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          Belum ada. Ketuk ikon 🔖 di samping ayat saat membaca.
        </p>
      )}
    </section>
  );
}

function Credits({ sources }: { sources: Sources }) {
  return (
    <p className="fs-11.5 leading-relaxed text-slate-400">
      Teks Al-Qur&apos;an: {sources.arab.nama},{' '}
      <a href="https://tanzil.net" target="_blank" rel="noreferrer" className="underline">
        tanzil.net
      </a>{' '}
      ({sources.arab.lisensi}). Terjemahan: {sources.terjemahan.nama}, versi {sources.terjemahan.versi}, dari{' '}
      <a href={sources.terjemahan.url} target="_blank" rel="noreferrer" className="underline">
        QuranEnc.com
      </a>
      , tanpa diubah. Audio murattal: Quran Foundation (quran.com).
    </p>
  );
}
