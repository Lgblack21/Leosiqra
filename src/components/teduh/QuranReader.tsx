'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Repeat,
  Share2,
  SkipBack,
  SkipForward,
  Sparkles,
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { PelajariQuran } from '@/components/teduh/PelajariQuran';
import { NomorAyat } from '@/components/teduh/ui';
import { audioService, loadSurah, progres, type Qari, type SurahData, type SurahMeta } from '@/lib/teduh/quran';
import { cn } from '@/lib/utils';

const SPEEDS = [0.75, 1, 1.25];
const REPEATS = [1, 3, 5];

// Pembaca satu surah: basmalah pembuka, ayat + terjemahan Kemenag + catatan kaki, tanda ayat, bagikan,
// tercatat "dibaca" saat ayat terlihat ±1 detik, dan murattal per ayat (sorot + gulir otomatis).
export function QuranReader({
  meta,
  list,
  startAyat,
  marks,
  arabClass,
  onClose,
  onOpen,
}: {
  meta: SurahMeta;
  list: SurahMeta[];
  startAyat?: number;
  marks: Set<string>;
  arabClass: string;
  onClose: () => void;
  onOpen: (s: number, a?: number) => void;
}) {
  const [data, setData] = useState<SurahData | null>(null);
  const [err, setErr] = useState('');
  const [note, setNote] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const [pelajari, setPelajari] = useState<number | null>(null);
  const boxes = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    let alive = true;
    loadSurah(meta.n)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setErr(e instanceof Error ? e.message : 'Surah gagal dimuat.'));
    return () => {
      alive = false;
    };
  }, [meta.n]);

  // Gulir ke ayat tujuan setelah data siap.
  useEffect(() => {
    if (!data || !startAyat) return;
    const t = setTimeout(() => boxes.current[startAyat - 1]?.scrollIntoView({ block: 'center' }), 60);
    return () => clearTimeout(t);
  }, [data, startAyat]);

  // Tercatat dibaca bila ayat terlihat ≥60% selama ±1 detik.
  useEffect(() => {
    if (!data) return;
    const timers = new Map<Element, ReturnType<typeof setTimeout>>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const i = Number((e.target as HTMLElement).dataset.i);
          if (e.isIntersecting) {
            if (!timers.has(e.target))
              timers.set(
                e.target,
                setTimeout(() => progres.markRead(meta.start + i, { s: meta.n, a: i + 1 }), 1000),
              );
          } else {
            clearTimeout(timers.get(e.target));
            timers.delete(e.target);
          }
        }
      },
      { threshold: 0.6 },
    );
    boxes.current.forEach((b) => b && io.observe(b));
    return () => {
      io.disconnect();
      timers.forEach((t) => clearTimeout(t));
    };
  }, [data, meta.n, meta.start]);

  const say = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(''), 2200);
  };
  const share = async (i: number) => {
    if (!data) return;
    const [ar, id] = data.ayat[i];
    const text = `${ar}\n\n${id.replace(/\[\d+\]/g, '')}\n— QS ${meta.latin} ${meta.n}:${i + 1} (Terjemahan Kemenag RI)`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        say('Ayat disalin.');
      }
    } catch {
      /* dibatalkan */
    }
  };

  const player = useMurattal(meta.n, data?.ayat.length ?? 0, (i) =>
    boxes.current[i]?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
  );

  const prev = list.find((s) => s.n === meta.n - 1);
  const next = list.find((s) => s.n === meta.n + 1);

  return (
    <div className="pb-6">
      <div className="sticky top-0 z-20 -mx-4 flex items-center gap-2 bg-[#f6f7fb]/85 px-4 py-2.5 backdrop-blur-xl md:-mx-8 md:px-8 dark:bg-slate-950/85">
        <button
          type="button"
          onClick={onClose}
          aria-label="Kembali"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate fs-15 font-black">
            {meta.n}. {meta.latin}
          </p>
          <p className="fs-11.5 text-slate-500">
            {meta.ayat} ayat · {meta.type}
          </p>
        </div>
        <span className={cn('w-10 text-right fs-22 leading-none', arabClass)}>{meta.ar}</span>
      </div>

      {err ? <p className="mt-6 rounded-2xl bg-rose-50 px-4 py-3 fs-13 font-semibold text-rose-700">{err}</p> : null}
      {!data && !err ? <p className="mt-10 text-center fs-13 text-slate-400">Memuat surah…</p> : null}

      {data ? (
        <>
          {data.basmalah ? (
            <p
              dir="rtl"
              lang="ar"
              className={cn('mt-6 text-center fsh-28 leading-loose text-emerald-800 dark:text-emerald-300', arabClass)}
            >
              {data.basmalah}
            </p>
          ) : null}
          <ol className="mt-4 space-y-3">
            {data.ayat.map(([ar, id, foot], i) => {
              const k = `${meta.n}:${i + 1}`;
              const playing = player.index === i && player.on;
              return (
                <li
                  key={k}
                  ref={(el) => {
                    boxes.current[i] = el;
                  }}
                  data-i={i}
                  className={cn(
                    'scroll-mt-24 rounded-[22px] bg-white p-4 ring-1 transition-colors dark:bg-slate-900',
                    playing
                      ? 'ring-2 ring-emerald-400'
                      : startAyat === i + 1
                        ? 'ring-indigo-200'
                        : 'ring-slate-200 dark:ring-slate-800',
                  )}
                >
                  <div className="flex items-center gap-1">
                    <NomorAyat n={i + 1} aktif={playing} />
                    <button
                      type="button"
                      onClick={() => setPelajari(i + 1)}
                      className="ml-1 flex h-9 items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-50 to-emerald-50 px-3 fs-12.5 font-bold text-emerald-800 ring-1 ring-emerald-100 transition hover:ring-emerald-300 dark:from-amber-500/10 dark:to-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/20"
                    >
                      <Sparkles size={14} className="text-amber-500" /> Pelajari
                    </button>
                    <span className="flex-1" />
                    <IconBtn label={playing ? 'Jeda' : 'Putar ayat ini'} onClick={() => player.toggleFrom(i)}>
                      {playing && player.playing ? <Pause size={16} /> : <Play size={16} />}
                    </IconBtn>
                    <IconBtn label={marks.has(k) ? 'Hapus tanda' : 'Tandai ayat'} onClick={() => progres.toggleMark(k)}>
                      {marks.has(k) ? <BookmarkCheck size={16} className="text-amber-600" /> : <Bookmark size={16} />}
                    </IconBtn>
                    <IconBtn label="Bagikan" onClick={() => void share(i)}>
                      <Share2 size={16} />
                    </IconBtn>
                  </div>
                  <p
                    dir="rtl"
                    lang="ar"
                    className={cn('mt-3 fsh-30 leading-[2.15] text-slate-900 dark:text-white', arabClass)}
                  >
                    {ar}
                  </p>
                  <p className="mt-3 fs-15 leading-relaxed text-slate-700 dark:text-slate-300">{id}</p>
                  {foot ? (
                    <button
                      type="button"
                      onClick={() => setNote(note === i ? null : i)}
                      className="mt-2 fs-12 font-bold text-indigo-600 dark:text-indigo-400"
                    >
                      {note === i ? 'Tutup catatan' : 'Catatan kaki'}
                    </button>
                  ) : null}
                  {foot && note === i ? (
                    <p className="mt-1.5 whitespace-pre-line rounded-xl bg-slate-50 px-3 py-2 fs-12.5 leading-relaxed text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {foot}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
          <div className="mt-5 flex gap-2">
            {prev ? (
              <button
                type="button"
                onClick={() => onOpen(prev.n)}
                className="flex h-12 flex-1 items-center justify-center gap-1 rounded-2xl bg-white fs-13 font-bold ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
              >
                <ChevronLeft size={16} /> {prev.latin}
              </button>
            ) : null}
            {next ? (
              <button
                type="button"
                onClick={() => onOpen(next.n)}
                className="flex h-12 flex-1 items-center justify-center gap-1 rounded-2xl bg-slate-900 fs-13 font-bold text-white dark:bg-white dark:text-slate-900"
              >
                {next.latin} <ChevronRight size={16} />
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      {player.on ? player.bar : null}
      <AnimatePresence>
        {pelajari ? (
          <PelajariQuran
            key={pelajari}
            meta={meta}
            a={pelajari}
            arabClass={arabClass}
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

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
    >
      {children}
    </button>
  );
}

// Murattal per ayat: daftar URL dari Worker (Quran Foundation), satu <audio> dipakai bergantian.
function useMurattal(surah: number, count: number, onFocus: (i: number) => void) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const urls = useRef<string[] | null>(null);
  const loaded = useRef<{ surah: number; qari: number } | null>(null);
  const [on, setOn] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [repeat, setRepeat] = useState(1);
  const [err, setErr] = useState('');
  const [qariList, setQariList] = useState<Qari[] | null>(null);
  const [qari, setQari] = useState<number>(() => progres.snapshot().qari || 7);
  const left = useRef(1);
  const idxRef = useRef(0);
  const st = useRef({ speed: 1, repeat: 1, count: 0 });
  // Lanjut ke ayat berikutnya dari dalam onended → lewat ref (selalu versi playAt terbaru).
  const playRef = useRef<((i: number) => Promise<void>) | null>(null);
  useEffect(() => {
    st.current = { speed, repeat, count };
    if (audio.current) audio.current.playbackRate = speed;
  }, [speed, repeat, count]);

  const playAt = useCallback(
    async (i: number) => {
      setErr('');
      if (!urls.current || loaded.current?.surah !== surah || loaded.current?.qari !== qari) {
        try {
          const r = await audioService.surah(surah, qari, count);
          const map = new Map(r.items.map((x) => [x.key, x.url]));
          urls.current = Array.from({ length: count }, (_, k) => map.get(`${surah}:${k + 1}`) ?? '');
          loaded.current = { surah, qari };
        } catch (e) {
          setErr(e instanceof Error ? e.message : 'Audio sedang tidak tersedia.');
          setPlaying(false);
          return;
        }
      }
      const src = urls.current[i];
      if (!src) {
        setErr('Audio ayat ini belum tersedia.');
        return;
      }
      if (!audio.current) audio.current = new Audio();
      const a = audio.current;
      a.src = src;
      a.playbackRate = st.current.speed;
      idxRef.current = i;
      left.current = st.current.repeat;
      setIndex(i);
      onFocus(i);
      a.onended = () => {
        left.current -= 1;
        if (left.current > 0) {
          a.currentTime = 0;
          void a.play();
          return;
        }
        const n = idxRef.current + 1;
        if (n < st.current.count) void playRef.current?.(n);
        else setPlaying(false);
      };
      try {
        await a.play();
        setPlaying(true);
      } catch {
        setErr('Ketuk putar untuk memulai audio.');
        setPlaying(false);
      }
    },
    [surah, qari, count, onFocus],
  );
  useEffect(() => {
    playRef.current = playAt;
  }, [playAt]);

  useEffect(
    () => () => {
      audio.current?.pause();
    },
    [],
  );

  const toggleFrom = (i: number) => {
    setOn(true);
    if (playing && index === i) {
      audio.current?.pause();
      setPlaying(false);
    } else void playAt(i);
    if (!qariList)
      audioService
        .reciters()
        .then((r) => setQariList(r.items))
        .catch(() => setQariList([]));
  };
  const toggle = () => {
    if (playing) {
      audio.current?.pause();
      setPlaying(false);
    } else if (audio.current?.src && loaded.current?.qari === qari) {
      void audio.current.play().then(() => setPlaying(true));
    } else void playAt(index);
  };

  const bar = (
    <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+12px)] z-30 mx-auto mt-4 w-[min(560px,100%)] rounded-[24px] bg-slate-950/95 p-3 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur">
      {err ? <p className="mb-2 rounded-xl bg-white/10 px-3 py-1.5 fs-12 font-semibold text-amber-200">{err}</p> : null}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Ayat sebelumnya"
          onClick={() => index > 0 && void playAt(index - 1)}
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"
        >
          <SkipBack size={18} />
        </button>
        <button
          type="button"
          aria-label={playing ? 'Jeda' : 'Putar'}
          onClick={toggle}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white"
        >
          {playing ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
        </button>
        <button
          type="button"
          aria-label="Ayat berikutnya"
          onClick={() => index + 1 < count && void playAt(index + 1)}
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"
        >
          <SkipForward size={18} />
        </button>
        <div className="min-w-0 flex-1 pl-1">
          <p className="fs-13 font-black">Ayat {index + 1}</p>
          <p className="truncate fs-11 text-white/60">{qariList?.find((q) => q.id === qari)?.name ?? 'Murattal'}</p>
        </div>
        <button
          type="button"
          aria-label="Ulangi ayat"
          onClick={() => setRepeat(REPEATS[(REPEATS.indexOf(repeat) + 1) % REPEATS.length])}
          className={cn(
            'flex h-9 items-center gap-1 rounded-full px-2.5 fs-12 font-black',
            repeat > 1 ? 'bg-amber-400 text-slate-900' : 'bg-white/10',
          )}
        >
          <Repeat size={14} /> {repeat}×
        </button>
        <button
          type="button"
          aria-label="Kecepatan"
          onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
          className="h-9 rounded-full bg-white/10 px-2.5 fs-12 font-black"
        >
          {speed}×
        </button>
      </div>
      {qariList && qariList.length > 1 ? (
        <select
          value={qari}
          onChange={(e) => {
            const id = Number(e.target.value);
            setQari(id);
            progres.setQari(id);
            audio.current?.pause();
            setPlaying(false);
          }}
          aria-label="Pilih qari"
          className="mt-2 h-9 w-full rounded-xl bg-white/10 px-2 fs-12.5 text-white"
        >
          {qariList.map((q) => (
            <option key={q.id} value={q.id} className="text-slate-900">
              {q.name}
              {q.style ? ` (${q.style})` : ''}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );

  return { on, playing, index, toggleFrom, bar };
}
