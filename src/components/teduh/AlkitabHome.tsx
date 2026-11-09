'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
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
} from 'lucide-react';
import {
  ATRIBUSI,
  TEMA_ALKITAB,
  TOTAL_PASAL,
  alkitabService,
  ayatHariIniAlkitab,
  progresAlkitab,
  rujukanKey,
  type Kitab,
  type Pasal,
  type Rujukan,
} from '@/lib/teduh/alkitab';
import { streak, todayKey } from '@/lib/teduh/quran';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { rp } from '@/lib/kanvas/data';
import { cn } from '@/lib/utils';

type Tab = 'beranda' | 'baca' | 'tema' | 'simpan';
const TABS: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: 'beranda', label: 'Beranda', icon: Home },
  { id: 'baca', label: 'Baca', icon: BookOpen },
  { id: 'tema', label: 'Tema', icon: Sparkles },
  { id: 'simpan', label: 'Tersimpan', icon: Bookmark },
];
const MEMBERI_RE = /persembahan|perpuluhan|persepuluhan|kolekte|diakonia|derma|sumbangan|donasi|amal|ucapan syukur/i;
const useProgres = () => useSyncExternalStore(progresAlkitab.subscribe, progresAlkitab.snapshot, () => null);
const greet = () => {
  const h = new Date().getHours();
  return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
};

// Teduh untuk umat Kristen & Katolik — Alkitab TB (© LAI) lewat API Indonesia.
export function AlkitabHome({ variant, katolik }: { variant: 'web' | 'app'; katolik: boolean }) {
  const [kitab, setKitab] = useState<Kitab[] | null>(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<Tab>('beranda');
  const [open, setOpen] = useState<{ b: number; c: number; v?: number; seq: number } | null>(null);
  const store = useProgres();
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

  if (err)
    return (
      <section className="rounded-[26px] bg-gradient-to-br from-sky-50 to-indigo-100 p-6 text-indigo-900">
        <p className="fsh-34">✝️</p>
        <h2 className="mt-1 fsh-24 font-black">Alkitab sedang disiapkan</h2>
        <p className="mt-2 fs-14 leading-relaxed opacity-90">{err}</p>
      </section>
    );
  if (!kitab) return <p className="py-10 text-center fs-13 text-slate-400">Memuat Alkitab…</p>;

  if (open) {
    const k = kitab.find((x) => x.id === open.b);
    if (k)
      return (
        <PasalReader
          key={`${open.b}-${open.c}-${open.seq}`}
          kitab={k}
          list={kitab}
          c={open.c}
          startAyat={open.v}
          marks={marks}
          onClose={() => setOpen(null)}
          onOpen={go}
        />
      );
  }

  return (
    <div className="space-y-5">
      {katolik ? (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 fs-12.5 font-semibold text-amber-900 ring-1 ring-amber-100">
          Kitab-kitab Deuterokanonika belum tersedia — saat ini memuat 66 kitab Terjemahan Baru.
        </p>
      ) : null}
      {tab === 'beranda' ? <Beranda kitab={kitab} go={go} setTab={setTab} /> : null}
      {tab === 'baca' ? <Pustaka kitab={kitab} go={go} /> : null}
      {tab === 'tema' ? <TemaView kitab={kitab} go={go} /> : null}
      {tab === 'simpan' ? <Tersimpan kitab={kitab} marks={store?.marks ?? []} go={go} /> : null}
      <p className="fs-11.5 leading-relaxed text-slate-400">{ATRIBUSI}. Data melalui API Indonesia.</p>
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
                ? 'bg-indigo-50 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-200'
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

const refLabel = (kitab: Kitab[], x: Rujukan) => `${kitab.find((k) => k.id === x.b)?.nama ?? ''} ${x.c}:${x.v}`;

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
  const [teks, setTeks] = useState<string | null>(null);
  const [gagal, setGagal] = useState(false);
  useEffect(() => {
    if (!k) return;
    let alive = true;
    alkitabService
      .pasal(k.abbr, r.c)
      .then((p) => alive && setTeks(p.ayat.find((a) => a.n === r.v)?.teks ?? ''))
      .catch(() => alive && setGagal(true));
    return () => {
      alive = false;
    };
  }, [k, r.c, r.v]);
  return (
    <article className="rounded-[24px] bg-white p-5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
      <div className="flex items-center justify-between gap-2">
        <span className="fs-12 font-bold text-slate-400">{label}</span>
        <span className="fs-11.5 font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
          {refLabel(kitab, r)}
        </span>
      </div>
      <p className="mt-3 text-center fs-16 leading-relaxed text-slate-800 dark:text-slate-100">
        {teks ?? (gagal ? 'Ayat belum bisa dimuat.' : 'Memuat ayat…')}
      </p>
      <div className="mt-4 flex justify-center">
        <button
          type="button"
          onClick={() => go(r.b, r.c, r.v)}
          className="h-10 rounded-full bg-slate-900 px-4 fs-13 font-bold text-white dark:bg-white dark:text-slate-900"
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
}: {
  kitab: Kitab[];
  go: (b: number, c: number, v?: number) => void;
  setTab: (t: Tab) => void;
}) {
  const store = useProgres();
  const hari = ayatHariIniAlkitab();
  const days = store?.days ?? {};
  const st = streak(days);
  const read = store?.read.length ?? 0;
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { d, on: Boolean(days[todayKey(d)]) };
  });
  const last = store?.last ? kitab.find((k) => k.id === store.last!.b) : null;
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
    <>
      <section className="overflow-hidden rounded-[28px] bg-gradient-to-br from-indigo-700 via-violet-700 to-sky-800 p-5 text-white">
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

      <AyatCard r={hari.a} kitab={kitab} label={`Ayat hari ini · ${hari.tema.judul}`} go={go} />

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => (last ? go(last.id, store!.last!.c) : go(43, 1))}
          className="flex items-center gap-3 rounded-[22px] bg-white p-4 text-left ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
            <BookOpen size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block fs-14.5 font-black">
              {last ? `Lanjut ${last.nama} ${store!.last!.c}` : 'Mulai membaca'}
            </span>
            <span className="block fs-12 text-slate-500">
              {last ? 'Tempat terakhir kamu membaca' : 'Dari Injil Yohanes'}
            </span>
          </span>
          <ChevronRight size={18} className="text-slate-400" />
        </button>
        <div className="flex items-center gap-3 rounded-[22px] bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 fs-13 font-black text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
            {read / TOTAL_PASAL > 0 && read / TOTAL_PASAL < 0.01 ? '<1%' : `${Math.round((read / TOTAL_PASAL) * 100)}%`}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block fs-14.5 font-black">Menuju tamat Alkitab</span>
            <span className="block fs-12 text-slate-500">
              {read.toLocaleString('id-ID')} dari {TOTAL_PASAL.toLocaleString('id-ID')} pasal
            </span>
          </span>
        </div>
      </div>

      <section className="flex items-center gap-3 rounded-[22px] bg-amber-50 p-4 ring-1 ring-amber-100 dark:bg-amber-500/10 dark:ring-amber-500/20">
        <span className="fsh-26">🙏</span>
        <div className="min-w-0 flex-1">
          <p className="fs-14.5 font-black text-amber-900 dark:text-amber-100">Persembahan bulan ini</p>
          <p className="fs-12.5 text-amber-800/80 dark:text-amber-200/80">
            {memberi === null
              ? 'Dihitung dari catatan keuanganmu (persembahan, perpuluhan, kolekte, diakonia).'
              : memberi.n
                ? `${rp(memberi.total)} dari ${memberi.n} catatan`
                : 'Belum ada yang tercatat bulan ini.'}
          </p>
        </div>
        <Link
          href="/input-cepat?teks=Persembahan"
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
          <span className="block fs-14.5 font-black">Firman untuk urusan uangmu</span>
          <span className="block fs-12 text-slate-500">Perpuluhan, utang, hidup cukup, menabung, dan lainnya</span>
        </span>
        <ChevronRight size={18} className="text-slate-400" />
      </button>
    </>
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
      <div>
        <h2 className="fsh-24 font-black">Baca</h2>
        <p className="fs-13 text-slate-500">66 kitab Alkitab Terjemahan Baru.</p>
      </div>
      {(['PL', 'PB'] as const).map((pj) => (
        <div key={pj}>
          <p className="mb-2 fs-12 font-black uppercase tracking-wider text-slate-400">
            {pj === 'PL' ? 'Perjanjian Lama' : 'Perjanjian Baru'}
          </p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
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
                    className="rounded-2xl bg-white px-3 py-2.5 text-left ring-1 ring-slate-200 hover:ring-indigo-300 dark:bg-slate-900 dark:ring-slate-800"
                  >
                    <span className="block truncate fs-13.5 font-bold">{k.nama}</span>
                    <span className="block fs-11.5 text-slate-500">
                      {k.pasal} pasal{done ? ` · ${done} dibaca` : ''}
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
      <div>
        <h2 className="fsh-24 font-black">Firman untuk urusan uangmu</h2>
        <p className="fs-13 text-slate-500">Pilih tema — ayat-ayat tentang memberi, utang, dan mengelola berkat.</p>
      </div>
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
      <div className="space-y-3">
        {t.ayat.map((r) => (
          <AyatCard key={rujukanKey(r)} r={r} kitab={kitab} label={t.judul} go={go} />
        ))}
      </div>
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
      <div>
        <h2 className="fsh-24 font-black">Tersimpan</h2>
        <p className="fs-13 text-slate-500">Ayat yang kamu tandai (disimpan di perangkat ini).</p>
      </div>
      {marks.length ? (
        marks.map((m) => {
          const [b, c, v] = m.k.split(':').map(Number);
          return <AyatCard key={m.k} r={{ b, c, v }} kitab={kitab} go={go} />;
        })
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
  onClose,
  onOpen,
}: {
  kitab: Kitab;
  list: Kitab[];
  c: number;
  startAyat?: number;
  marks: Set<string>;
  onClose: () => void;
  onOpen: (b: number, c: number, v?: number) => void;
}) {
  const [data, setData] = useState<Pasal | null>(null);
  const [err, setErr] = useState('');
  const [toast, setToast] = useState('');
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
      <div className="sticky top-0 z-20 -mx-4 flex items-center gap-2 bg-[#f6f5f1]/90 px-4 py-2.5 backdrop-blur dark:bg-slate-950/90">
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
