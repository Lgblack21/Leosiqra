'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Share2,
  Sparkles,
  Trash2,
  Wallet,
  Timer,
} from 'lucide-react';
import { MoodLeo } from './MoodLeo';
import {
  MOODS,
  STYLES,
  longDate,
  moodOf,
  shiftDate,
  storyImageUrl,
  storyService,
  wibToday,
  type StoryDay,
  type StoryMood,
  type StoryStyle,
} from '@/lib/stories';
import { imageFileToBase64 } from '@/lib/quick/ai';
import { lightTap } from '@/lib/haptics';
import { cn } from '@/lib/utils';

const rb = (n: number) =>
  n >= 1e6
    ? `Rp${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`
    : n >= 1e3
      ? `Rp${Math.round(n / 1e3)} rb`
      : `Rp${n.toLocaleString('id-ID')}`;

// Satu halaman cerita untuk satu tanggal. Mood tersimpan langsung saat diketuk; tulisan
// tersimpan dengan tombol Simpan (atau otomatis saat pindah tanggal / membuat ilustrasi).
export function TulisView({
  date,
  onDate,
  onChanged,
}: {
  date: string;
  onDate: (d: string) => void;
  onChanged: () => void;
}) {
  const reduce = useReducedMotion();
  const [day, setDay] = useState<StoryDay | null>(null);
  const [text, setText] = useState('');
  const [mood, setMood] = useState<StoryMood | null>(null);
  const [busy, setBusy] = useState<'' | 'save' | 'photo' | 'ai' | 'del'>('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const [style, setStyle] = useState<StoryStyle>('anime');
  // Ada foto & ilustrasi → bisa bergantian lihat Asli / Kartun.
  const [showOriginal, setShowOriginal] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const savedText = useRef('');
  const today = wibToday();

  // Penjaga: jawaban untuk tanggal lama (pindah tanggal cepat) tidak menimpa tanggal sekarang.
  const dateRef = useRef(date);
  dateRef.current = date;
  const load = useCallback(async () => {
    setError('');
    try {
      const d = await storyService.day(date);
      if (dateRef.current !== date) return;
      setDay(d);
      setText(d.story?.text ?? '');
      savedText.current = d.story?.text ?? '';
      setMood(d.story?.mood ?? null);
    } catch (e) {
      if (dateRef.current !== date) return;
      setDay(null);
      setError(e instanceof Error ? e.message : 'Gagal memuat cerita.');
    }
  }, [date]);
  useEffect(() => {
    // Kosongkan saat tanggal berganti, lalu muat.
    setDay(null);
    setAskDelete(false);
    setShowOriginal(false);
    void load();
  }, [load]);

  const dirty = text.trim() !== savedText.current.trim();
  const saveText = async () => {
    if (!dirty) return true;
    setBusy('save');
    setError('');
    try {
      await storyService.save(date, { text: text.trim() });
      savedText.current = text.trim();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
      onChanged();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.');
      return false;
    } finally {
      setBusy('');
    }
  };
  const go = async (d: string) => {
    if (await saveText()) onDate(d);
  };
  const pickMood = async (m: StoryMood) => {
    lightTap();
    const next = mood === m ? null : m;
    setMood(next);
    try {
      await storyService.save(date, { mood: next, ...(dirty ? { text: text.trim() } : {}) });
      savedText.current = text.trim();
      onChanged();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan mood.');
    }
  };
  const onPhoto = async (f: File | undefined) => {
    if (!f) return;
    setBusy('photo');
    setError('');
    try {
      const b64 = await imageFileToBase64(f, 1400, 0.82);
      await storyService.setPhoto(date, b64);
      onChanged();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengunggah foto.');
    } finally {
      setBusy('');
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  const makeAi = async () => {
    if (!(await saveText())) return;
    setBusy('ai');
    setError('');
    try {
      await storyService.makeAi(date, style);
      setShowOriginal(false);
      onChanged();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal membuat ilustrasi.');
    } finally {
      setBusy('');
    }
  };
  const removeImage = async () => {
    const st = day?.story;
    const kind = st?.has_ai && !(st.has_photo && showOriginal) ? 'ai' : st?.has_photo ? 'photo' : null;
    if (!kind) return;
    setBusy('del');
    try {
      await storyService.removeImage(date, kind);
      onChanged();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghapus gambar.');
    } finally {
      setBusy('');
    }
  };
  const removeStory = async () => {
    setBusy('del');
    try {
      await storyService.remove(date);
      setAskDelete(false);
      onChanged();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghapus.');
    } finally {
      setBusy('');
    }
  };
  const share = async () => {
    const m = moodOf(mood);
    const body = `${longDate(date, true)}${m ? ` · ${m.emoji} ${m.label}` : ''}\n\n${text.trim() || '(belum ada tulisan)'}\n\n— Cerita Hari Ini di Leosiqra`;
    try {
      if (navigator.share) await navigator.share({ title: 'Cerita Hari Ini', text: body });
      else {
        await navigator.clipboard.writeText(body);
        setError('');
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1800);
      }
    } catch {
      /* dibatalkan */
    }
  };

  const s = day?.story;
  const m = moodOf(mood);
  const both = Boolean(s?.has_ai && s?.has_photo);
  const img =
    s?.has_ai && !(both && showOriginal)
      ? storyImageUrl(date, 'ai', s.updated_at)
      : s?.has_photo
        ? storyImageUrl(date, 'photo', s.updated_at)
        : null;
  // AI: ada foto → foto diubah jadi ilustrasi; tanpa foto → dari tulisan (minimal 8 huruf).
  const canAi = Boolean(s?.has_photo) || text.trim().length >= 8;
  const ai = day?.ai;
  const aiCost = !ai ? '' : ai.freeLeft > 0 ? 'gratis' : `${ai.price.toLocaleString('id-ID')} koin`;
  const aiLabel = `${s?.has_photo ? 'Jadikan ilustrasi' : 'Ilustrasi AI'}${aiCost ? ` · ${aiCost}` : ''}`;

  return (
    // HP: alur biasa (digulir di dalam area isi), tablet/desktop: dua kolom setinggi layar.
    <div className="grid grid-cols-1 gap-3 pb-2 md:h-full md:min-h-0 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-4 md:pb-0">
      <section className="flex flex-col gap-3 md:min-h-0">
        <div className="flex items-center justify-between gap-2 rounded-full bg-white p-1.5 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
          <button
            type="button"
            onClick={() => go(shiftDate(date, -1))}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            aria-label="Hari sebelumnya"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-0 text-center">
            <p className="truncate text-[15px] font-extrabold text-slate-900 dark:text-white">
              {date === today ? 'Hari ini' : longDate(date)}
            </p>
            <p className="text-[11px] text-slate-400">
              {date === today ? longDate(date, true) : new Date(`${date}T00:00:00Z`).getUTCFullYear()}
            </p>
          </div>
          <button
            type="button"
            disabled={date >= today}
            onClick={() => go(shiftDate(date, 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 disabled:opacity-30 dark:bg-slate-800 dark:text-slate-300"
            aria-label="Hari berikutnya"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div
          className={cn(
            'relative aspect-[16/10] overflow-hidden rounded-[28px] bg-gradient-to-br ring-1 ring-slate-100 dark:ring-slate-800 md:aspect-auto md:min-h-[150px] md:flex-1',
            m?.soft ?? 'from-indigo-50 to-violet-100',
          )}
        >
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element -- gambar privat dari API (bukan aset statis)
            <img
              src={img}
              alt={s?.has_ai ? 'Ilustrasi AI untuk cerita ini' : 'Foto hari ini'}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center [container-type:size]">
              <motion.div
                key={mood ?? 0}
                initial={reduce ? false : { scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={{ width: 'min(60cqw, 70cqh)' }}
              >
                <MoodLeo mood={mood} size={160} className="h-auto w-full" />
              </motion.div>
            </div>
          )}
          {(busy === 'ai' || busy === 'photo') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/70 text-[13px] font-semibold text-indigo-700 backdrop-blur-sm dark:bg-slate-900/70 dark:text-indigo-200">
              <Loader2 size={22} className="animate-spin" />{' '}
              {busy === 'ai'
                ? s?.has_photo
                  ? 'Leo sedang menggambar ulang fotomu…'
                  : 'Leo sedang melukis ceritamu…'
                : 'Mengunggah foto…'}
            </div>
          )}
          {m && (
            <span className="absolute left-3 top-3 rounded-full bg-white/85 px-3 py-1 text-[12px] font-bold text-slate-700 backdrop-blur">
              {m.emoji} {m.label}
            </span>
          )}
          {both && (
            <span className="absolute right-3 top-3 flex rounded-full bg-black/45 p-0.5 text-[11px] font-bold backdrop-blur">
              {[
                ['Ilustrasi', false],
                ['Asli', true],
              ].map(([lbl, orig]) => (
                <button
                  key={String(lbl)}
                  type="button"
                  onClick={() => setShowOriginal(orig as boolean)}
                  className={cn(
                    'rounded-full px-2.5 py-1',
                    showOriginal === orig ? 'bg-white text-slate-900' : 'text-white/85',
                  )}
                >
                  {lbl as string}
                </button>
              ))}
            </span>
          )}
        </div>
        {canAi && (
          <div
            className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]"
            role="radiogroup"
            aria-label="Gaya ilustrasi"
          >
            {STYLES.map((x) => (
              <button
                key={x.id}
                type="button"
                role="radio"
                aria-checked={style === x.id}
                onClick={() => setStyle(x.id)}
                className={cn(
                  'flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors',
                  style === x.id
                    ? 'bg-violet-600 text-white'
                    : 'bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700',
                )}
              >
                <span aria-hidden>{x.emoji}</span>
                {x.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => onPhoto(e.target.files?.[0])}
          />
          <button
            type="button"
            disabled={Boolean(busy) || !day}
            onClick={() => fileRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-white py-2.5 text-[13px] font-bold text-slate-700 ring-1 ring-slate-200 disabled:opacity-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700"
          >
            <Camera size={15} /> Foto
          </button>
          <button
            type="button"
            disabled={Boolean(busy) || !day || !canAi}
            onClick={makeAi}
            title={!canAi ? 'Tambahkan foto atau tulis ceritanya dulu' : undefined}
            className="flex flex-[1.6] items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-500 py-2.5 text-[13px] font-bold text-white shadow-md shadow-violet-600/25 disabled:opacity-50"
          >
            <Sparkles size={15} /> {aiLabel}
          </button>
          {img && (
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={removeImage}
              className="flex items-center justify-center rounded-2xl bg-white px-3 text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
              aria-label="Hapus gambar"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-[28px] bg-white p-3.5 md:min-h-0 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800 md:p-5">
        <div>
          <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100">Cuaca hatimu hari ini?</p>
          <div className="mt-2 grid grid-cols-5 gap-1.5">
            {MOODS.map((x) => (
              <button
                key={x.id}
                type="button"
                disabled={!day}
                onClick={() => pickMood(x.id)}
                aria-pressed={mood === x.id}
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-2xl py-2 text-[11px] font-bold transition-all disabled:opacity-50',
                  mood === x.id
                    ? 'scale-[1.04] text-slate-900 shadow-md ring-2 dark:text-white'
                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400',
                )}
                style={mood === x.id ? { background: `${x.color}22`, boxShadow: `0 0 0 2px ${x.color}` } : undefined}
              >
                <span className="text-[22px] leading-none" aria-hidden>
                  {x.emoji}
                </span>
                {x.label}
              </button>
            ))}
          </div>
        </div>
        <label className="flex min-h-[90px] flex-1 flex-col">
          <span className="sr-only">Cerita hari ini</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 500))}
            disabled={!day}
            placeholder="Satu-dua kalimat tentang hari ini… (apa yang bikin senang, capek, atau kepikiran?)"
            className="h-full min-h-[90px] w-full flex-1 resize-none rounded-2xl bg-slate-50 p-3.5 text-[14px] leading-relaxed text-slate-800 outline-none ring-1 ring-slate-100 placeholder:text-slate-400 focus:bg-white focus:ring-indigo-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700"
          />
          <span className="mt-1 self-end text-[11px] tabular-nums text-slate-400">{text.length}/500</span>
        </label>
        {day && (
          <div className="flex flex-wrap gap-1.5 text-[12px] font-semibold">
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              <Wallet size={12} /> Keluar {rb(day.summary.out)}
            </span>
            {day.summary.in > 0 && (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                Masuk {rb(day.summary.in)}
              </span>
            )}
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {day.summary.count} transaksi
            </span>
            {day.summary.focusSec > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                <Timer size={12} /> Fokus {Math.round(day.summary.focusSec / 60)} mnt
              </span>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="text-[12px] font-semibold text-rose-600">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!day || busy === 'save' || !dirty}
            onClick={saveText}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 text-[15px] font-bold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
          >
            {busy === 'save' ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : null}{' '}
            {saved ? 'Tersimpan' : dirty ? 'Simpan' : 'Tersimpan'}
          </button>
          <button
            type="button"
            disabled={!day}
            onClick={share}
            className="flex items-center justify-center gap-1.5 rounded-2xl bg-slate-100 px-4 text-[13px] font-bold text-slate-700 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200"
            aria-label="Bagikan"
          >
            <Share2 size={15} />
          </button>
          {s &&
            (askDelete ? (
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setAskDelete(false)}
                  className="rounded-2xl bg-slate-100 px-3 py-3 text-[12px] font-bold text-slate-600 dark:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={busy === 'del'}
                  onClick={removeStory}
                  className="rounded-2xl bg-rose-600 px-3 py-3 text-[12px] font-bold text-white"
                >
                  Hapus
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setAskDelete(true)}
                className="flex items-center justify-center rounded-2xl bg-slate-100 px-3 text-slate-500 dark:bg-slate-800"
                aria-label="Hapus cerita"
              >
                <Trash2 size={15} />
              </button>
            ))}
        </div>
      </section>
    </div>
  );
}
