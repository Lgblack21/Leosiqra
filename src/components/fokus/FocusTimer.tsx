"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Minus, Music2, Pause, Play, Plus, Settings2, Square, Volume1, Volume2, VolumeX } from 'lucide-react';
import { FocusScene } from './FocusScene';
import { focusAudio, FOCUS_TRACKS, type FocusTrack } from '@/lib/focus/audio';
import {
  DEFAULT_SETTINGS, FOCUS_KINDS, RUN_STORAGE_KEY, clampInt, elapsedSec, fmtClock, loadRun, loadSettings, recordSession,
  remainingMs, saveRun, saveSettings, uuid, wibDate, type FocusKind, type FocusRun, type FocusSettings,
} from '@/lib/focus/store';
import { lightTap } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import type { LeoActivity, LeoMood } from '@/components/mascot/LeoMascot';

const DURATIONS = [15, 25, 50, 90];
const iso = (ms: number) => new Date(ms).toISOString();

const useAudio = () => {
  const track = useSyncExternalStore((fn) => focusAudio.subscribe(fn), () => focusAudio.track, () => null);
  const volume = useSyncExternalStore((fn) => focusAudio.subscribe(fn), () => focusAudio.volume, () => DEFAULT_SETTINGS.volume);
  return { track, volume };
};

async function notify(title: string, body: string) {
  try { navigator.vibrate?.([180, 90, 180]); } catch { /* tidak didukung */ }
  lightTap();
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !document.hidden) return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, icon: '/images/Logo-new.png', tag: 'leosiqra-focus' });
    else new Notification(title, { body, icon: '/images/Logo-new.png', tag: 'leosiqra-focus' });
  } catch { /* notifikasi tidak tersedia */ }
}

export function FocusTimer({ settingsOpen, onOpenSettings, onCloseSettings }: { settingsOpen: boolean; onOpenSettings: () => void; onCloseSettings: () => void }) {
  const reduce = useReducedMotion();
  // Dipanggil hanya di browser (FocusApp merender ini setelah hydrate) → aman baca localStorage.
  const [settings, setSettingsState] = useState<FocusSettings>(() => loadSettings());
  const [run, setRunState] = useState<FocusRun | null>(() => loadRun());
  const [now, setNow] = useState(() => Date.now());
  const [label, setLabel] = useState(() => loadRun()?.label ?? '');
  const [cycle, setCycle] = useState(() => loadRun()?.cycle ?? 0);
  const [done, setDone] = useState<{ phase: 'focus' | 'break'; min: number } | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);
  const [customOpen, setCustomOpen] = useState(() => !DURATIONS.includes(loadSettings().minutes));
  const audio = useAudio();

  const runRef = useRef(run);
  const settingsRef = useRef(settings);
  const chimeRef = useRef<{ id: string; cancel: () => void } | null>(null);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setRun = useCallback((r: FocusRun | null) => {
    runRef.current = r;
    saveRun(r);
    setRunState(r);
  }, []);
  const setSettings = (patch: Partial<FocusSettings>) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    saveSettings(next);
    setSettingsState(next);
  };

  const cancelChime = () => { chimeRef.current?.cancel(); chimeRef.current = null; };
  const scheduleChime = (r: FocusRun) => {
    cancelChime();
    const left = remainingMs(r) / 1000;
    const cancel = focusAudio.chime(left);
    if (cancel) chimeRef.current = { id: r.sessionId, cancel };
  };

  const celebrate = (phase: 'focus' | 'break', min: number) => {
    setDone({ phase, min });
    if (doneTimer.current) clearTimeout(doneTimer.current);
    doneTimer.current = setTimeout(() => setDone(null), 6000);
  };

  const startPhase = useCallback((phase: 'focus' | 'break', opts: { long?: boolean; cycle: number; kind: FocusKind; label: string; minutes: number }) => {
    const t = Date.now();
    const r: FocusRun = { phase, long: Boolean(opts.long), sessionId: uuid(), kind: opts.kind, label: opts.label, minutes: opts.minutes, startedAt: t, endsAt: t + opts.minutes * 60_000, pausedAt: null, pausedMs: 0, cycle: opts.cycle };
    setRun(r);
    setCycle(opts.cycle);
    return r;
  }, [setRun]);

  // Fase habis (dipanggil dari tick; juga saat kembali ke tab setelah lama di belakang).
  const finishPhase = useCallback((r: FocusRun) => {
    // Tab lain sudah menangani fase ini → ikuti keadaan tersimpan.
    const stored = loadRun();
    if (stored?.sessionId !== r.sessionId) { runRef.current = stored; setRunState(stored); return; }
    const s = settingsRef.current;
    const chimed = chimeRef.current?.id === r.sessionId;
    chimeRef.current = null;
    if (!chimed) focusAudio.chime();
    if (r.phase === 'focus') {
      recordSession({ id: r.sessionId, kind: r.kind, label: r.label || null, planned_min: r.minutes, focus_sec: elapsedSec(r, r.endsAt), completed: 1, started_at: iso(r.startedAt), ended_at: iso(r.endsAt), date: wibDate(r.startedAt) });
      const nextCycle = r.cycle + 1;
      const long = nextCycle % s.longEvery === 0;
      void notify('Sesi fokus selesai 🎉', `${r.minutes} menit fokus. Waktunya istirahat ${long ? s.longBreakMin : s.breakMin} menit.`);
      celebrate('focus', r.minutes);
      if (!s.musicInBreak) focusAudio.stop();
      if (s.autoBreak) {
        const br = startPhase('break', { long, cycle: nextCycle, kind: r.kind, label: r.label, minutes: long ? s.longBreakMin : s.breakMin });
        scheduleChime(br);
      } else {
        setRun(null);
        setCycle(nextCycle);
      }
    } else {
      void notify('Istirahat selesai', 'Siap lanjut fokus bareng Leo?');
      celebrate('break', r.minutes);
      if (s.autoNext) {
        const fr = startPhase('focus', { cycle: r.long ? 0 : r.cycle, kind: r.kind, label: r.label, minutes: s.minutes });
        if (s.track) focusAudio.play(s.track, s.volume);
        scheduleChime(fr);
      } else {
        setRun(null);
        setCycle(r.long ? 0 : r.cycle);
      }
    }
    // scheduleChime/celebrate memakai ref & setter stabil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setRun, startPhase]);

  // Detak: hanya saat berjalan. Sisa waktu dihitung dari endsAt → tetap tepat walau interval diperlambat.
  const ticking = Boolean(run && !run.pausedAt);
  useEffect(() => {
    if (!ticking) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      const r = runRef.current;
      if (r && !r.pausedAt && r.endsAt <= t) finishPhase(r);
    };
    tick();
    const iv = setInterval(tick, 250);
    const onVis = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onVis); };
  }, [ticking, finishPhase]);

  // Tab lain memulai/menjeda/menghentikan → ikut.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== RUN_STORAGE_KEY) return;
      const r = loadRun();
      runRef.current = r;
      setRunState(r);
      if (r) setCycle(r.cycle);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!run) return;
    const prev = document.title;
    document.title = `${run.pausedAt ? '⏸ ' : ''}${fmtClock(remainingMs(run, now))} · ${run.phase === 'focus' ? 'Fokus' : 'Istirahat'} — Leosiqra`;
    return () => { document.title = prev; };
  }, [run, now]);

  useEffect(() => {
    if (!ticking || !settings.keepAwake) return;
    type WakeLock = { release: () => Promise<void> };
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLock> } };
    if (!nav.wakeLock) return;
    let lock: WakeLock | null = null;
    let alive = true;
    const acquire = () => {
      if (document.visibilityState !== 'visible') return;
      nav.wakeLock?.request('screen').then((l) => { if (alive) lock = l; else void l.release(); }).catch(() => undefined);
    };
    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => { alive = false; document.removeEventListener('visibilitychange', acquire); void lock?.release().catch(() => undefined); };
  }, [ticking, settings.keepAwake]);

  useEffect(() => () => { if (doneTimer.current) clearTimeout(doneTimer.current); cancelChime(); }, []);

  // Aksi: semua dari sentuhan pengguna → boleh memutar suara (kebijakan autoplay).
  const start = () => {
    lightTap();
    const s = settingsRef.current;
    if (s.notify && typeof Notification !== 'undefined' && Notification.permission === 'default') void Notification.requestPermission().catch(() => undefined);
    if (s.track) focusAudio.play(s.track, s.volume);
    setDone(null);
    const r = startPhase('focus', { cycle, kind: s.kind, label: label.trim().slice(0, 80), minutes: s.minutes });
    scheduleChime(r);
  };
  const pause = () => {
    const r = runRef.current;
    if (!r || r.pausedAt) return;
    lightTap();
    cancelChime();
    setRun({ ...r, pausedAt: Date.now() });
  };
  const resume = () => {
    const r = runRef.current;
    if (!r || !r.pausedAt) return;
    lightTap();
    const gap = Date.now() - r.pausedAt;
    const next = { ...r, pausedAt: null, endsAt: r.endsAt + gap, pausedMs: r.pausedMs + gap };
    setRun(next);
    const s = settingsRef.current;
    if (next.phase === 'focus' && s.track && !focusAudio.playing) focusAudio.play(s.track, s.volume);
    scheduleChime(next);
  };
  const extend = (min: number) => {
    const r = runRef.current;
    if (!r) return;
    lightTap();
    const next = { ...r, endsAt: r.endsAt + min * 60_000, minutes: r.minutes + min };
    setRun(next);
    if (!next.pausedAt) scheduleChime(next);
  };
  const stop = () => {
    const r = runRef.current;
    if (!r) return;
    lightTap();
    cancelChime();
    setConfirmStop(false);
    // Fokus ≥ 1 menit tetap tercatat (tidak selesai) supaya usahanya terlihat di Rekap.
    if (r.phase === 'focus') {
      const sec = elapsedSec(r);
      if (sec >= 60) recordSession({ id: r.sessionId, kind: r.kind, label: r.label || null, planned_min: r.minutes, focus_sec: sec, completed: 0, started_at: iso(r.startedAt), ended_at: iso(Math.min(Date.now(), r.endsAt)), date: wibDate(r.startedAt) });
    }
    focusAudio.stop();
    setRun(null);
    if (r.phase === 'break') setCycle(r.long ? 0 : r.cycle);
  };
  const skipBreak = () => {
    const r = runRef.current;
    if (!r || r.phase !== 'break') return;
    cancelChime();
    const s = settingsRef.current;
    if (s.track) focusAudio.play(s.track, s.volume);
    const fr = startPhase('focus', { cycle: r.long ? 0 : r.cycle, kind: r.kind, label: r.label, minutes: s.minutes });
    scheduleChime(fr);
  };
  const pickTrack = (t: FocusTrack | null) => {
    lightTap();
    setSettings({ track: t });
    const r = runRef.current;
    const live = r && !r.pausedAt && (r.phase === 'focus' || settingsRef.current.musicInBreak);
    if (t && (live || focusAudio.playing)) focusAudio.play(t, settingsRef.current.volume);
    else if (!t) focusAudio.stop();
  };
  const preview = () => {
    const t = settingsRef.current.track;
    if (!t) return;
    if (focusAudio.playing) focusAudio.stop();
    else focusAudio.play(t, settingsRef.current.volume);
  };
  const setVolume = (v: number) => { focusAudio.setVolume(v); setSettings({ volume: v }); };

  const remaining = run ? remainingMs(run, now) : settings.minutes * 60_000;
  const total = run ? run.minutes * 60_000 : settings.minutes * 60_000;
  const progress = run ? 1 - remaining / total : 0;
  const focusing = run?.phase === 'focus' && !run.pausedAt;
  const kind = run?.kind ?? settings.kind;
  const t = new Date(now);
  const lookX = focusing ? 0.5 + Math.sin(now / (kind === 'baca' ? 1400 : 2200)) * (kind === 'baca' ? 0.45 : 0.25) : 0.5;
  const mood: LeoMood = done ? 'happy' : focusing ? 'watch' : 'idle';
  const activity: LeoActivity | null = run?.phase === 'break' && !run.pausedAt ? (run.long ? 'play' : 'eat') : null;
  const kindLabel = FOCUS_KINDS.find((k) => k.id === kind)?.label ?? 'Fokus';
  const status = done
    ? done.phase === 'focus' ? `Mantap! ${done.min} menit fokus 🎉` : 'Istirahat selesai — lanjut?'
    : !run ? (cycle ? `${cycle} sesi selesai · siap lanjut` : 'Leo siap nemenin kamu fokus')
      : run.pausedAt ? 'Dijeda dulu…'
        : run.phase === 'break' ? (run.long ? 'Istirahat panjang — Leo main bola ⚽' : 'Istirahat — Leo ngemil 🍗')
          : run.label ? `Fokus: ${run.label}` : `Fokus ${kindLabel.toLowerCase()} bareng Leo`;
  const longEvery = settings.longEvery;
  const dotsDone = run?.phase === 'break' ? run.cycle % longEvery || (run.long ? longEvery : 0) : cycle % longEvery;
  const musicOff = !audio.track;
  const needMusicTap = Boolean(run && focusing && settings.track && musicOff);

  const chipBase = 'relative flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 py-1.5 text-[10px] font-bold leading-tight transition-colors md:py-2 md:text-[12px]';
  const musicChips = (
    <div className="grid grid-cols-5 gap-1.5">
      {[{ id: null, label: 'Hening', emoji: '🤫' }, ...FOCUS_TRACKS].map((tr) => {
        const on = settings.track === tr.id;
        const playing = tr.id !== null && audio.track === tr.id;
        return (
          <button key={tr.id ?? 'off'} type="button" onClick={() => pickTrack(tr.id as FocusTrack | null)} aria-pressed={on} aria-label={`Musik ${tr.label}`}
            className={cn(chipBase, on ? 'bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500 dark:bg-indigo-500/15 dark:text-indigo-200' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300')}>
            <span className="text-[15px] leading-none md:text-[18px]" aria-hidden>{tr.emoji}</span><span className="truncate">{tr.label}</span>
            {playing && <span className="absolute right-1.5 top-1.5 flex gap-[2px]" aria-hidden>{[0, 1, 2].map((i) => <span key={i} className="focus-eq w-[2px] rounded-full bg-indigo-500" style={{ animationDelay: `${i * 0.15}s` }} />)}</span>}
          </button>
        );
      })}
    </div>
  );
  const volumeRow = (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => setVolume(settings.volume > 0 ? 0 : 0.55)} className="text-slate-400 hover:text-slate-600" aria-label={settings.volume > 0 ? 'Bisukan' : 'Bunyikan'}>
        {settings.volume === 0 ? <VolumeX size={18} /> : settings.volume < 0.5 ? <Volume1 size={18} /> : <Volume2 size={18} />}
      </button>
      <input type="range" min={0} max={1} step={0.01} value={settings.volume} onChange={(e) => setVolume(Number(e.target.value))} aria-label="Volume musik" className="h-1.5 flex-1 cursor-pointer accent-indigo-600" />
      {!run && settings.track && (
        <button type="button" onClick={preview} className="rounded-full bg-slate-100 px-3 py-1.5 text-[12px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{audio.track ? 'Stop' : 'Coba'}</button>
      )}
    </div>
  );

  const trackInfo = FOCUS_TRACKS.find((x) => x.id === settings.track);
  const night = t.getHours() >= 18 || t.getHours() < 5;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 md:gap-4">
      <section className="relative min-h-[170px] flex-1 overflow-hidden rounded-[32px] [container-type:size] shadow-[0_24px_60px_-34px_rgba(49,46,129,0.7)]">
        <div className="absolute inset-0">
          <FocusScene now={t} kind={kind} mood={mood} activity={activity} lookX={lookX} music={Boolean(audio.track)} focusing={focusing} progress={progress} />
        </div>
        {/* Ukuran ikut tinggi adegan (cqh) → selalu muat di langit, di atas Leo (kepala Leo ±44cqh dari atas). */}
        <div className={cn('pointer-events-none absolute inset-x-0 top-[6cqh] flex flex-col items-center text-center', night ? 'text-white' : 'text-slate-900')}>
          <span className={cn('rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] backdrop-blur md:text-[11px]', night ? 'bg-white/10 text-white/80' : 'bg-white/55 text-slate-600')}>
            {run ? (run.pausedAt ? 'Dijeda' : run.phase === 'focus' ? kindLabel : run.long ? 'Istirahat panjang' : 'Istirahat') : 'Siap fokus'}
          </span>
          <span className="mt-[1cqh] font-black leading-none tabular-nums tracking-tight drop-shadow-sm" style={{ fontSize: 'clamp(28px, 20cqh, 88px)' }}>{fmtClock(remaining)}</span>
          <div className="mt-[1.5cqh] flex gap-1.5" aria-label={`${dotsDone} dari ${longEvery} sesi`}>
            {Array.from({ length: longEvery }, (_, i) => (
              <span key={i} className={cn('h-1.5 w-6 rounded-full transition-colors md:w-8', i < dotsDone ? (night ? 'bg-amber-300' : 'bg-indigo-600') : i === dotsDone && run?.phase === 'focus' ? (night ? 'bg-white/50' : 'bg-indigo-300') : night ? 'bg-white/15' : 'bg-white/60')} />
            ))}
          </div>
        </div>
        <button type="button" onClick={onOpenSettings} className={cn('absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold backdrop-blur transition-colors md:right-4 md:top-4', night ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-white/70 text-slate-700 hover:bg-white')} aria-label="Musik & pengaturan">
          <span aria-hidden>{trackInfo?.emoji ?? '🤫'}</span> {trackInfo?.label ?? 'Hening'}
          {audio.track && <span className="ml-0.5 flex h-3 items-end gap-[2px]" aria-hidden>{[0, 1, 2].map((i) => <span key={i} className={cn('focus-eq w-[2px] rounded-full', night ? 'bg-amber-300' : 'bg-indigo-500')} style={{ animationDelay: `${i * 0.15}s` }} />)}</span>}
        </button>
        <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2 md:inset-x-4 md:bottom-4">
          {/* Tanpa AnimatePresence "wait": ganti teks cepat (fase habis + rayakan) bisa membuatnya macet. */}
          <motion.span
            key={status}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="inline-flex min-w-0 items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-[12px] font-semibold text-slate-700 shadow-sm backdrop-blur dark:bg-slate-900/85 dark:text-slate-200 md:text-[13px]"
          >
            <span className={cn('h-2 w-2 shrink-0 rounded-full', focusing ? 'bg-emerald-500' : run?.phase === 'break' ? 'bg-amber-400' : 'bg-slate-300')} />
            <span className="truncate">{status}</span>
          </motion.span>
          {needMusicTap && (
            <button type="button" onClick={() => settings.track && focusAudio.play(settings.track, settings.volume)} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1.5 text-[12px] font-bold text-white shadow-md">
              <Music2 size={13} /> Putar musik
            </button>
          )}
        </div>
      </section>

      <div className="shrink-0 rounded-[28px] bg-white p-3 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800 md:p-4">
        {run ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="hidden min-w-0 flex-1 md:block">
                <p className="truncate text-[15px] font-bold text-slate-900 dark:text-white">{run.label || kindLabel}</p>
                <p className="text-[12px] text-slate-500">{run.phase === 'focus' ? `Istirahat ${(run.cycle + 1) % longEvery === 0 ? settings.longBreakMin : settings.breakMin} mnt setelah ini` : `Lalu fokus ${settings.minutes} mnt`}</p>
              </div>
              {run.pausedAt ? (
                <button type="button" onClick={resume} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3.5 text-[15px] font-bold text-white shadow-lg shadow-indigo-600/25 active:scale-[0.98] md:w-56 md:flex-none"><Play size={17} fill="currentColor" /> Lanjut</button>
              ) : (
                <button type="button" onClick={pause} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3.5 text-[15px] font-bold text-white active:scale-[0.98] dark:bg-white dark:text-slate-900 md:w-56 md:flex-none"><Pause size={17} fill="currentColor" /> Jeda</button>
              )}
              <button type="button" onClick={() => extend(5)} className="h-[52px] rounded-2xl bg-slate-100 px-4 text-[14px] font-bold text-slate-700 active:scale-[0.98] dark:bg-slate-800 dark:text-slate-200" aria-label="Tambah 5 menit">+5</button>
              {run.phase === 'break' ? (
                <button type="button" onClick={skipBreak} className="h-[52px] rounded-2xl bg-slate-100 px-4 text-[13px] font-bold text-slate-700 active:scale-[0.98] dark:bg-slate-800 dark:text-slate-200">Lewati</button>
              ) : (
                <button type="button" onClick={() => setConfirmStop(true)} className="flex h-[52px] items-center rounded-2xl bg-slate-100 px-4 text-slate-600 active:scale-[0.98] dark:bg-slate-800 dark:text-slate-300" aria-label="Hentikan"><Square size={16} /></button>
              )}
            </div>
            <AnimatePresence>
              {confirmStop && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="flex items-center gap-2 rounded-2xl bg-rose-50 p-2.5 dark:bg-rose-500/10">
                    <p className="min-w-0 flex-1 text-[12px] text-rose-700 dark:text-rose-300">{elapsedSec(run, now) >= 60 ? `Berhenti? ${Math.floor(elapsedSec(run, now) / 60)} menit tetap tercatat di Rekap.` : 'Berhenti? Kurang dari 1 menit — tidak dicatat.'}</p>
                    <button type="button" onClick={() => setConfirmStop(false)} className="rounded-full bg-white px-3 py-1.5 text-[12px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">Lanjut</button>
                    <button type="button" onClick={stop} className="rounded-full bg-rose-600 px-3 py-1.5 text-[12px] font-bold text-white">Berhenti</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:gap-3">
            <div className="space-y-2.5">
              <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
                {FOCUS_KINDS.map((k) => (
                  <button key={k.id} type="button" onClick={() => { lightTap(); setSettings({ kind: k.id }); }} aria-pressed={settings.kind === k.id}
                    className={cn('flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-bold transition-colors md:text-[13px]', settings.kind === k.id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300')}>
                    <span aria-hidden>{k.emoji}</span>{k.label}
                  </button>
                ))}
              </div>
              <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} placeholder="Lagi ngerjain apa? (boleh kosong)" aria-label="Lagi ngerjain apa"
                className="w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-[14px] text-slate-800 outline-none ring-1 ring-slate-100 placeholder:text-slate-400 focus:bg-white focus:ring-indigo-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700" />
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5">
                {DURATIONS.map((m) => (
                  <button key={m} type="button" onClick={() => { lightTap(); setCustomOpen(false); setSettings({ minutes: m }); }}
                    className={cn('min-w-0 flex-1 rounded-full py-2 text-[13px] font-bold tabular-nums transition-colors', settings.minutes === m && !customOpen ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300')}>{m}</button>
                ))}
                {customOpen ? (
                  <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-indigo-600 p-1 text-white">
                    <button type="button" onClick={() => setSettings({ minutes: clampInt(settings.minutes - 5, 5, 180, 25) })} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15" aria-label="Kurangi 5 menit"><Minus size={13} /></button>
                    <span className="w-8 text-center text-[13px] font-bold tabular-nums">{settings.minutes}</span>
                    <button type="button" onClick={() => setSettings({ minutes: clampInt(settings.minutes + 5, 5, 180, 25) })} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15" aria-label="Tambah 5 menit"><Plus size={13} /></button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setCustomOpen(true)} className="min-w-0 flex-1 rounded-full bg-slate-100 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300">Atur</button>
                )}
              </div>
              <button type="button" onClick={start} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-[16px] font-bold text-white shadow-lg shadow-indigo-600/30 transition-transform active:scale-[0.98]">
                <Play size={18} fill="currentColor" /> Mulai fokus {settings.minutes} menit
              </button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {settingsOpen && (
          <motion.div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 backdrop-blur-[2px] md:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCloseSettings}>
            <motion.div
              role="dialog" aria-modal="true" aria-label="Musik & pengaturan"
              initial={reduce ? false : { y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={reduce ? undefined : { y: 40, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] shadow-2xl dark:bg-slate-900 md:rounded-[28px] md:pb-5"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="flex items-center gap-2 text-[16px] font-bold text-slate-900 dark:text-white"><Settings2 size={17} className="text-slate-400" /> Musik & pengaturan</p>
                <button type="button" onClick={onCloseSettings} className="rounded-full bg-slate-100 px-3 py-1.5 text-[12px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">Selesai</button>
              </div>
              <div className="space-y-3">
                <div className="space-y-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-[13px] font-bold text-slate-800 dark:text-slate-100"><Music2 size={15} className="text-indigo-500" /> Musik fokus</p>
                    <span className="text-[11px] font-semibold text-slate-400">dibuat langsung · bebas royalti</span>
                  </div>
                  {musicChips}
                  {volumeRow}
                  <p className="text-[11px] text-slate-400">{settings.track ? 'Musik otomatis menyala saat fokus dimulai.' : 'Tanpa musik.'}</p>
                </div>
                <Stepper label="Istirahat pendek" value={settings.breakMin} unit="mnt" min={1} max={30} step={1} onChange={(v) => setSettings({ breakMin: v })} />
                <Stepper label="Istirahat panjang" value={settings.longBreakMin} unit="mnt" min={5} max={60} step={5} onChange={(v) => setSettings({ longBreakMin: v })} />
                <Stepper label="Istirahat panjang tiap" value={settings.longEvery} unit="sesi" min={2} max={8} step={1} onChange={(v) => setSettings({ longEvery: v })} />
                <Toggle label="Mulai istirahat otomatis" on={settings.autoBreak} onChange={(v) => setSettings({ autoBreak: v })} />
                <Toggle label="Lanjut fokus otomatis setelah istirahat" on={settings.autoNext} onChange={(v) => setSettings({ autoNext: v })} />
                <Toggle label="Musik tetap menyala saat istirahat" on={settings.musicInBreak} onChange={(v) => setSettings({ musicInBreak: v })} />
                <Toggle label="Layar tetap menyala" on={settings.keepAwake} onChange={(v) => setSettings({ keepAwake: v })} />
                <Toggle label="Notifikasi saat sesi selesai" on={settings.notify} onChange={(v) => setSettings({ notify: v })} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Stepper({ label, value, unit, min, max, step, onChange }: { label: string; value: number; unit: string; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13px] text-slate-600 dark:text-slate-300">{label}</span>
      <span className="flex items-center gap-1 rounded-full bg-slate-50 p-1 dark:bg-slate-800">
        <button type="button" disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))} className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm disabled:opacity-40 dark:bg-slate-700 dark:text-slate-200" aria-label={`Kurangi ${label}`}><Minus size={13} /></button>
        <span className="w-14 text-center text-[13px] font-bold tabular-nums text-slate-800 dark:text-slate-100">{value} {unit}</span>
        <button type="button" disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))} className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm disabled:opacity-40 dark:bg-slate-700 dark:text-slate-200" aria-label={`Tambah ${label}`}><Plus size={13} /></button>
      </span>
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex w-full items-center justify-between gap-3 text-left">
      <span className="text-[13px] text-slate-600 dark:text-slate-300">{label}</span>
      <span className={cn('relative h-6 w-10 shrink-0 rounded-full transition-colors', on ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700')}>
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left]', on ? 'left-[18px]' : 'left-0.5')} />
      </span>
    </button>
  );
}
