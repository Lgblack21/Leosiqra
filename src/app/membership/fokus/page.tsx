"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Briefcase, CloudRain, Pause, PencilLine, Play, SkipForward, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LeoMascot, type LeoMood } from '@/components/mascot/LeoMascot';
import { focusService, type FocusKind, type FocusSession } from '@/lib/services/focusService';
import { useFeedback } from '@/components/ui/Feedback';

// Fokus: timer Pomodoro bareng Leo. Waktu dihitung dari jam (endAt), bukan
// hitungan interval, jadi tetap akurat walau tab di latar belakang. Sesi yang
// selesai dicatat ke server untuk rekap; istirahat 5 menit, tiap 4 sesi 15 menit.

const KINDS: { id: FocusKind; label: string; icon: typeof PencilLine }[] = [
  { id: 'belajar', label: 'Belajar', icon: PencilLine },
  { id: 'kerja', label: 'Kerja', icon: Briefcase },
  { id: 'baca', label: 'Baca', icon: BookOpen },
];
const DURATIONS = [15, 25, 50];
type Phase = 'idle' | 'focus' | 'break' | 'done';

const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

// Bunyi lonceng singkat (tanpa file audio).
const chime = () => {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [660, 880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.type = 'sine';
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.6);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.18);
      o.stop(ctx.currentTime + i * 0.18 + 0.65);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {
    /* audio tidak tersedia */
  }
};

// Suara hujan lembut: brown noise yang difilter.
function useRain() {
  const ref = useRef<{ ctx: AudioContext; src: AudioBufferSourceNode } | null>(null);
  const [on, setOn] = useState(false);
  const toggle = () => {
    if (ref.current) {
      ref.current.src.stop();
      void ref.current.ctx.close();
      ref.current = null;
      setOn(false);
      return;
    }
    try {
      const ctx = new AudioContext();
      const buf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
      const data = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        data[i] = last * 3.2;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1200;
      const gain = ctx.createGain();
      gain.gain.value = 0.35;
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start();
      ref.current = { ctx, src };
      setOn(true);
    } catch {
      /* audio tidak tersedia */
    }
  };
  useEffect(() => () => {
    ref.current?.src.stop();
    void ref.current?.ctx.close();
  }, []);
  return { on, toggle };
}

export default function FokusPage() {
  const { toast } = useFeedback();
  const [kind, setKind] = useState<FocusKind>('belajar');
  const [label, setLabel] = useState('');
  const [minutes, setMinutes] = useState(25);
  const [phase, setPhase] = useState<Phase>('idle');
  const [endAt, setEndAt] = useState(0);
  const [total, setTotal] = useState(0);
  const [pausedLeft, setPausedLeft] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [round, setRound] = useState(0);
  const [sessions, setSessions] = useState<FocusSession[] | null>(null);
  const [today, setToday] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const rain = useRain();

  const load = useCallback(() => {
    focusService
      .list()
      .then((r) => {
        setSessions(r.items);
        setToday(r.today);
      })
      .catch(() => {
        setSessions([]);
        setUnavailable(true);
      });
  }, []);
  useEffect(load, [load]);

  const running = (phase === 'focus' || phase === 'break') && pausedLeft === null;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [running]);

  const left = pausedLeft ?? Math.max(0, endAt - now);
  const progress = total > 0 ? 1 - left / total : 0;

  const startPhase = (p: 'focus' | 'break', mins: number) => {
    const ms = mins * 60_000;
    setPhase(p);
    setTotal(ms);
    setEndAt(Date.now() + ms);
    setNow(Date.now());
    setPausedLeft(null);
  };

  // Fase selesai → catat sesi fokus, lalu istirahat (atau kembali siap).
  useEffect(() => {
    if (!running || left > 0) return;
    chime();
    if (phase === 'focus') {
      const done = Math.round(total / 60_000);
      const nextRound = round + 1;
      setRound(nextRound);
      if (!unavailable) {
        focusService.log(kind, done, label).then(load).catch((e) => toast.error(e instanceof Error ? e.message : 'Sesi gagal dicatat.'));
      }
      startPhase('break', nextRound % 4 === 0 ? 15 : 5);
    } else {
      setPhase('done');
    }
    // startPhase/load stabil secara perilaku; cukup dipicu saat waktu habis.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, running]);

  useEffect(() => {
    if (phase === 'focus' || phase === 'break') document.title = `${fmt(left)} · ${phase === 'focus' ? 'Fokus' : 'Istirahat'} — Leosiqra`;
    else document.title = 'Fokus — Leosiqra';
  }, [left, phase]);
  useEffect(() => () => { document.title = 'Leosiqra'; }, []);

  const togglePause = () => {
    if (pausedLeft === null) setPausedLeft(Math.max(0, endAt - Date.now()));
    else {
      setEndAt(Date.now() + pausedLeft);
      setNow(Date.now());
      setPausedLeft(null);
    }
  };
  const stop = () => {
    setPhase('idle');
    setPausedLeft(null);
  };

  const leoMood: LeoMood = phase === 'focus' ? (pausedLeft !== null ? 'idle' : 'watch') : phase === 'done' ? 'happy' : 'idle';
  const bubble =
    phase === 'focus'
      ? pausedLeft !== null ? 'Dijeda dulu ya…' : 'Ssst, lagi fokus 📖'
      : phase === 'break'
        ? 'Istirahat dulu, minum air 🍵'
        : phase === 'done'
          ? 'Mantap! Satu sesi beres 🎉'
          : 'Siap nemenin kamu!';

  const todaySessions = (sessions ?? []).filter((s) => s.day === today);
  const todayMinutes = todaySessions.reduce((s, x) => s + x.minutes, 0);
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${today || new Date().toISOString().slice(0, 10)}T12:00:00`);
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    return { key, label: new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(d), mins: (sessions ?? []).filter((s) => s.day === key).reduce((a, b) => a + b.minutes, 0) };
  });
  const maxMins = Math.max(25, ...last7.map((d) => d.mins));
  const R = 88;
  const C = 2 * Math.PI * R;

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-12">
      <div className="grid gap-5 lg:grid-cols-5">
        {/* Ruang belajar Leo */}
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-b from-violet-100 via-indigo-50 to-amber-50 lg:col-span-3" style={{ minHeight: 360 }}>
          {/* Jendela */}
          <div className="absolute left-8 top-8 h-28 w-36 overflow-hidden rounded-2xl border-4 border-white bg-gradient-to-b from-indigo-900 to-violet-700 shadow-inner">
            <div className="absolute right-4 top-3 h-7 w-7 rounded-full bg-amber-100 shadow-[0_0_20px_4px_rgba(253,230,138,.6)]" />
            {[[12, 20], [40, 50], [70, 15], [95, 60], [25, 75]].map(([x, y], i) => (
              <span key={i} className="auth-star absolute h-1 w-1 rounded-full bg-white" style={{ left: x, top: y, animationDelay: `${i * 0.5}s` }} />
            ))}
            <div className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 bg-white" />
            <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-white" />
          </div>
          {/* Gelembung */}
          <div className="absolute right-8 top-10 max-w-[200px] rounded-2xl rounded-bl-md bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-lg">{bubble}</div>
          {/* Leo di belakang meja */}
          <div className="absolute bottom-[78px] left-1/2 -translate-x-1/2">
            <LeoMascot mood={leoMood} lookX={0.35} size={170} interactive />
          </div>
          {/* Meja */}
          <svg viewBox="0 0 600 140" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-[130px] w-full" aria-hidden>
            <rect x="40" y="20" width="520" height="22" rx="8" fill="#c4b5fd" />
            <rect x="80" y="42" width="16" height="98" fill="#a78bfa" />
            <rect x="504" y="42" width="16" height="98" fill="#a78bfa" />
            {/* Buku terbuka */}
            <path d="M230 20 L300 8 L370 20 Z" fill="#fff" />
            <path d="M232 19 Q300 2 300 10 M368 19 Q300 2 300 10" stroke="#e2e8f0" strokeWidth="2" fill="none" />
            {/* Mug */}
            <rect x="440" y="-6" width="28" height="26" rx="6" fill="#fb7185" />
            <path d="M468 2 q10 0 10 8 q0 8 -10 8" stroke="#fb7185" strokeWidth="4" fill="none" />
          </svg>
          {/* Uap kopi */}
          <div className="absolute bottom-[132px]" style={{ left: 'calc(75.5% )' }}>
            {[0, 1, 2].map((i) => (
              <span key={i} className="focus-steam absolute block h-5 w-1.5 rounded-full bg-white/80" style={{ left: i * 6, animationDelay: `${i * 0.6}s` }} />
            ))}
          </div>
          {/* Lampu */}
          <div className="absolute bottom-[120px] left-[14%] flex flex-col items-center">
            <div className={cn('h-10 w-16 rounded-t-full bg-amber-300 transition-shadow', phase === 'focus' && 'shadow-[0_18px_40px_12px_rgba(252,211,77,.55)]')} />
            <div className="h-12 w-1.5 bg-slate-400" />
          </div>
        </div>

        {/* Kontrol */}
        <div className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-[0_8px_30px_-18px_rgba(49,46,129,0.25)] md:p-6 lg:col-span-2">
          {phase === 'idle' || phase === 'done' ? (
            <>
              <p className="text-sm font-semibold text-slate-500">Mau fokus apa?</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {KINDS.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setKind(k.id)}
                    className={cn('flex flex-col items-center gap-1 rounded-2xl py-3 text-sm font-bold transition-colors', kind === k.id ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100')}
                  >
                    <k.icon size={18} /> {k.label}
                  </button>
                ))}
              </div>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={60}
                placeholder="Lagi ngerjain apa? (boleh kosong)"
                className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:bg-white"
              />
              <div className="mt-3 flex items-center gap-2">
                <div className="flex rounded-2xl bg-slate-100 p-1">
                  {DURATIONS.map((d) => (
                    <button key={d} type="button" onClick={() => setMinutes(d)} className={cn('rounded-xl px-4 py-2 text-sm font-bold', minutes === d ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>
                      {d}
                    </button>
                  ))}
                </div>
                <span className="text-sm text-slate-500">menit · istirahat 5</span>
              </div>
              <button
                type="button"
                onClick={() => startPhase('focus', minutes)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-4 text-base font-bold text-white transition-transform hover:-translate-y-0.5"
              >
                <Play size={18} fill="currentColor" /> Mulai · {String(minutes).padStart(2, '0')}:00
              </button>
              <p className="mt-2 text-center text-xs text-slate-400">Tiap 4 sesi, istirahat panjang 15 menit</p>
            </>
          ) : (
            <div className="flex flex-col items-center">
              <p className={cn('rounded-full px-3 py-1 text-xs font-bold', phase === 'focus' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600')}>
                {phase === 'focus' ? `${KINDS.find((k) => k.id === kind)?.label}${label ? ` · ${label}` : ''}` : round % 4 === 0 ? 'Istirahat panjang' : 'Istirahat'}
              </p>
              <div className="relative mt-3 h-[210px] w-[210px]">
                <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
                  <circle cx="100" cy="100" r={R} stroke="#f1f5f9" strokeWidth="12" fill="none" />
                  <circle
                    cx="100" cy="100" r={R}
                    stroke={phase === 'focus' ? '#6366f1' : '#10b981'}
                    strokeWidth="12" strokeLinecap="round" fill="none"
                    strokeDasharray={C}
                    strokeDashoffset={C * (1 - progress)}
                    style={{ transition: 'stroke-dashoffset .3s linear' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl font-extrabold tabular-nums text-slate-900">{fmt(left)}</span>
                  <span className="text-xs font-semibold text-slate-400">sesi ke-{round + (phase === 'focus' ? 1 : 0)}</span>
                </div>
              </div>
              <div className="mt-4 flex w-full gap-2">
                <button type="button" onClick={togglePause} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 text-sm font-bold text-white">
                  {pausedLeft === null ? <><Pause size={16} /> Jeda</> : <><Play size={16} /> Lanjut</>}
                </button>
                {phase === 'break' ? (
                  <button type="button" onClick={() => startPhase('focus', minutes)} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-100 py-3 text-sm font-bold text-slate-700">
                    <SkipForward size={16} /> Lewati
                  </button>
                ) : (
                  <button type="button" onClick={stop} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-100 py-3 text-sm font-bold text-slate-700">
                    <Square size={14} /> Berhenti
                  </button>
                )}
              </div>
              {phase === 'focus' && <p className="mt-2 text-xs text-slate-400">Berhenti sebelum selesai tidak dicatat.</p>}
            </div>
          )}

          <button
            type="button"
            onClick={rain.toggle}
            className={cn('mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border py-2.5 text-sm font-semibold transition-colors', rain.on ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}
          >
            <CloudRain size={16} /> Suara hujan {rain.on ? 'nyala' : 'mati'}
          </button>
        </div>
      </div>

      {/* Rekap */}
      <div className="rounded-[26px] border border-slate-100 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-bold text-slate-900">Rekap</p>
          <p className="text-sm text-slate-500">
            Hari ini <b className="text-slate-900">{todayMinutes} menit</b> · {todaySessions.length} sesi
          </p>
        </div>
        {unavailable ? (
          <p className="mt-3 text-sm text-slate-500">Rekap belum aktif — timer tetap bisa dipakai.</p>
        ) : (
          <>
            <div className="mt-4 flex h-32 items-end gap-3">
              {last7.map((d) => (
                <div key={d.key} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-400">{d.mins || ''}</span>
                  <div className={cn('w-full rounded-t-xl', d.key === today ? 'bg-indigo-500' : 'bg-indigo-200')} style={{ height: `${Math.max(4, (d.mins / maxMins) * 88)}px` }} />
                  <span className="text-xs font-semibold capitalize text-slate-500">{d.label}</span>
                </div>
              ))}
            </div>
            {todaySessions.length > 0 && (
              <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
                {todaySessions.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="text-slate-700">
                      {KINDS.find((k) => k.id === s.kind)?.label}{s.label ? ` · ${s.label}` : ''}
                    </span>
                    <span className="font-bold text-slate-900">
                      {s.minutes} mnt · {new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date(s.created_at))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
