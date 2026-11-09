'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GeoJSONSource, Map as MlMap, Marker } from 'maplibre-gl';
import { Pause, Play, RotateCcw, X } from 'lucide-react';
import type { MapLib } from '@/components/peta/PlaceMap';
import { idrOf, type DayTrip } from '@/lib/places';
import { categoryVisual } from '@/lib/categoryEmoji';
import { rp, short } from '@/lib/kanvas/data';
import { cn } from '@/lib/utils';

export const fmtKm = (km: number) =>
  km < 1 ? `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m` : `${km.toFixed(1).replace('.', ',')} km`;
const MODE = {
  jalan: { icon: '🚶', label: 'Jalan kaki' },
  kendaraan: { icon: '🛵', label: 'Kendaraan' },
} as const;
const STAY = 1100;
const legMs = (km: number) => Math.min(2600, Math.max(900, 700 + km * 500));

type Step = { kind: 'stay'; i: number; ms: number } | { kind: 'move'; i: number; ms: number }; // move i → i+1
type Live = { kind: 'idle' } | { kind: 'run' | 'pause'; step: Step; spent: number } | { kind: 'done' };

export const dayLabel = (day: string) => {
  const d = new Date(`${day}T12:00:00`);
  const t = new Date();
  const k = (x: Date) => x.toDateString();
  if (k(d) === k(t)) return 'Hari ini';
  if (k(d) === k(new Date(t.getTime() - 86400_000))) return 'Kemarin';
  return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
};

// Putar ulang satu hari: garis rute + titik yang berjalan dari tempat ke tempat, kamera mengikuti,
// uang terpakai bertambah setiap tiba. Animasi berjalan di luar React (requestAnimationFrame);
// React hanya diperbarui saat pindah langkah.
export function useReplay(trip: DayTrip | null, map: { m: MlMap; ml: MapLib } | null) {
  const [live, setLive] = useState<Live>({ kind: 'idle' });
  const [speed, setSpeed] = useState(1);
  const speedRef = useRef(1);
  const bar = useRef<HTMLDivElement | null>(null);
  const raf = useRef(0);
  const t = useRef(0);
  const mover = useRef<Marker | null>(null);
  const stepKey = useRef('');
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const stops = trip?.stops ?? [];
  const steps: Step[] = [];
  stops.forEach((_, i) => {
    steps.push({ kind: 'stay', i, ms: STAY });
    if (i < stops.length - 1) steps.push({ kind: 'move', i, ms: legMs(trip!.legs[i].km) });
  });
  const totalMs = steps.reduce((a, s) => a + s.ms, 0);
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  // Garis rute (putus-putus) + jejak yang sudah dilalui (tebal).
  const lineOf = (c: [number, number][]) => ({
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'LineString' as const, coordinates: c },
  });
  useEffect(() => {
    if (!map) return;
    const { m } = map;
    const all = stops.map((s) => [s.lng, s.lat] as [number, number]);
    const ensure = () => {
      if (!m.getSource('jejak')) {
        m.addSource('jejak', { type: 'geojson', data: lineOf(all) });
        m.addLayer({
          id: 'jejak-all',
          type: 'line',
          source: 'jejak',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#6366f1', 'line-width': 4, 'line-opacity': 0.45, 'line-dasharray': [1.2, 1.6] },
        });
        m.addSource('jejak-trail', { type: 'geojson', data: lineOf([]) });
        m.addLayer({
          id: 'jejak-trail',
          type: 'line',
          source: 'jejak-trail',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#4f46e5', 'line-width': 6 },
        });
      } else {
        (m.getSource('jejak') as GeoJSONSource).setData(lineOf(all));
        (m.getSource('jejak-trail') as GeoJSONSource).setData(lineOf([]));
      }
    };
    try {
      if (trip) ensure();
    } catch {
      /* gaya peta belum siap — rute muncul saat diputar */
    }
    return () => {
      try {
        if (m.getLayer('jejak-trail')) m.removeLayer('jejak-trail');
        if (m.getLayer('jejak-all')) m.removeLayer('jejak-all');
        if (m.getSource('jejak-trail')) m.removeSource('jejak-trail');
        if (m.getSource('jejak')) m.removeSource('jejak');
      } catch {
        /* peta sudah dihapus */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kunci hari & peta cukup
  }, [map, trip?.day, stops.length]);

  const stopAnim = useCallback(() => {
    cancelAnimationFrame(raf.current);
    mover.current?.remove();
    mover.current = null;
  }, []);
  useEffect(() => () => stopAnim(), [stopAnim]);
  // Ganti hari / tab → hentikan.
  useEffect(() => {
    stopAnim();
    t.current = 0;
    setLive({ kind: 'idle' });
  }, [trip?.day, stopAnim]);

  const frame = useCallback(
    (last: number) => (now: number) => {
      if (!map || !trip) return;
      const { m, ml } = map;
      t.current += Math.min(100, now - last) * speedRef.current;
      const st = stepsRef.current;
      let acc = 0;
      let idx = st.length - 1;
      for (let k = 0; k < st.length; k++) {
        if (t.current < acc + st[k].ms) {
          idx = k;
          break;
        }
        acc += st[k].ms;
      }
      const done = t.current >= totalMs;
      const step = st[idx];
      const f = done ? 1 : Math.min(1, (t.current - acc) / step.ms);
      const a = trip.stops[step.i];
      const b = step.kind === 'move' ? trip.stops[step.i + 1] : a;
      const ease = f < 0.5 ? 2 * f * f : 1 - (-2 * f + 2) ** 2 / 2;
      const pos: [number, number] = [a.lng + (b.lng - a.lng) * ease, a.lat + (b.lat - a.lat) * ease];

      if (!mover.current) {
        const el = document.createElement('div');
        el.className = 'jejak-mover';
        mover.current = new ml.Marker({ element: el }).setLngLat(pos).addTo(m);
      }
      const el = mover.current.getElement();
      const icon = step.kind === 'move' ? MODE[trip.legs[step.i].mode].icon : '🛍️';
      if (el.textContent !== icon) el.textContent = icon;
      mover.current.setLngLat(pos);
      m.setCenter(pos);
      const trail = trip.stops.slice(0, step.i + 1).map((s) => [s.lng, s.lat] as [number, number]);
      if (step.kind === 'move') trail.push(pos);
      (m.getSource('jejak-trail') as GeoJSONSource | undefined)?.setData(lineOf(trail));
      if (bar.current) bar.current.style.width = `${Math.min(100, (t.current / totalMs) * 100)}%`;

      const key = `${idx}`;
      if (key !== stepKey.current) {
        stepKey.current = key;
        const spent = trip.stops.slice(0, step.i + 1).reduce((x, s) => x + idrOf(s), 0);
        setLive({ kind: 'run', step, spent });
      }
      if (done) {
        stopAnim();
        stepKey.current = '';
        setLive({ kind: 'done' });
        const bnds = new ml.LngLatBounds();
        trip.stops.forEach((s) => bnds.extend([s.lng, s.lat]));
        m.fitBounds(bnds, { padding: { top: 120, bottom: 40, left: 50, right: 50 }, maxZoom: 15, duration: 800 });
        return;
      }
      raf.current = requestAnimationFrame(frame(now));
    },
    [map, trip, totalMs, stopAnim],
  );

  const play = useCallback(() => {
    if (!map || !trip || trip.stops.length < 2) return;
    stopAnim();
    t.current = 0;
    stepKey.current = '';
    const maxLeg = Math.max(...trip.legs.map((l) => l.km), 0.2);
    map.m.jumpTo({
      center: [trip.stops[0].lng, trip.stops[0].lat],
      zoom: Math.max(11, Math.min(15.8, 15.6 - Math.log2(maxLeg + 0.4))),
    });
    raf.current = requestAnimationFrame((now) => frame(now)(now));
  }, [map, trip, frame, stopAnim]);
  const pause = () => {
    cancelAnimationFrame(raf.current);
    setLive((l) => (l.kind === 'run' ? { ...l, kind: 'pause' } : l));
  };
  const resume = () => {
    setLive((l) => (l.kind === 'pause' ? { ...l, kind: 'run' } : l));
    raf.current = requestAnimationFrame((now) => frame(now)(now));
  };
  const stop = () => {
    stopAnim();
    t.current = 0;
    stepKey.current = '';
    setLive({ kind: 'idle' });
    try {
      (map?.m.getSource('jejak-trail') as GeoJSONSource | undefined)?.setData(lineOf([]));
    } catch {
      /* abaikan */
    }
  };

  const current = live.kind === 'run' || live.kind === 'pause' ? live.step : null;
  const hud =
    !trip || live.kind === 'idle' ? null : (
      <div className="pointer-events-auto absolute left-3 right-[68px] top-3 z-20 max-w-md overflow-hidden rounded-[22px] bg-slate-950/85 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-md">
        <div className="flex items-center gap-3 px-3.5 py-3">
          {live.kind === 'done' ? (
            <>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 fsh-22">
                🏁
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate fs-15 font-black">Selesai · {trip.stops.length} tempat</p>
                <p className="truncate fs-12.5 text-white/70">
                  {rp(trip.total)} · ±{fmtKm(trip.km)} ditempuh
                </p>
              </div>
              <HudBtn label="Putar lagi" onClick={play}>
                <RotateCcw size={16} />
              </HudBtn>
              <HudBtn label="Tutup" onClick={stop}>
                <X size={16} />
              </HudBtn>
            </>
          ) : current ? (
            <>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 fsh-22">
                {current.kind === 'move'
                  ? MODE[trip.legs[current.i].mode].icon
                  : categoryVisual(trip.stops[current.i].category, 'pengeluaran').emoji}
              </span>
              <div className="min-w-0 flex-1">
                {current.kind === 'move' ? (
                  <>
                    <p className="truncate fs-15 font-black">Menuju {trip.stops[current.i + 1].label}</p>
                    <p className="truncate fs-12.5 text-white/70">
                      {MODE[trip.legs[current.i].mode].label} ±{trip.legs[current.i].minutes} mnt ·{' '}
                      {fmtKm(trip.legs[current.i].km)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="truncate fs-15 font-black">{trip.stops[current.i].label}</p>
                    <p className="truncate fs-12.5 font-bold text-rose-300">−{rp(idrOf(trip.stops[current.i]))}</p>
                  </>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="fs-10 font-bold uppercase tracking-wider text-white/50">Terpakai</p>
                <p className="fs-14 font-black tabular-nums">{short(live.spent)}</p>
              </div>
              {live.kind === 'run' ? (
                <HudBtn label="Jeda" onClick={pause}>
                  <Pause size={16} />
                </HudBtn>
              ) : (
                <HudBtn label="Lanjut" onClick={resume}>
                  <Play size={16} />
                </HudBtn>
              )}
              <HudBtn label="Berhenti" onClick={stop}>
                <X size={16} />
              </HudBtn>
            </>
          ) : null}
        </div>
        <div className="h-1 bg-white/10">
          <div
            ref={bar}
            className="h-full bg-gradient-to-r from-indigo-400 to-fuchsia-400"
            style={{ width: live.kind === 'done' ? '100%' : undefined }}
          />
        </div>
        <style>{`
          .jejak-mover{display:flex;height:44px;width:44px;align-items:center;justify-content:center;border-radius:9999px;background:#fff;font-size:22px;border:3px solid #4f46e5;box-shadow:0 0 0 8px rgba(99,102,241,.25),0 10px 24px -8px rgba(15,23,42,.6);z-index:5}
        `}</style>
      </div>
    );

  return { live, speed, setSpeed, play, totalMs, current, hud };
}

function HudBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
    >
      {children}
    </button>
  );
}

export function JejakPanel({
  trips,
  trip,
  onDay,
  replay,
  onStop,
  onFocus,
}: {
  onFocus: (txId: string) => void;
  trips: DayTrip[];
  trip: DayTrip | null;
  onDay: (day: string) => void;
  replay: ReturnType<typeof useReplay>;
  onStop: (i: number) => void;
}) {
  if (!trips.length || !trip)
    return (
      <div className="rounded-[22px] bg-white p-5 text-center ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <p className="fsh-30">🧭</p>
        <p className="mt-1 fs-15 font-black">Belum ada jejak</p>
        <p className="mx-auto mt-1 max-w-xs fs-12.5 text-slate-500">
          Jejak terbentuk dari pengeluaran berlokasi di hari yang sama. Nyalakan <b>lokasi otomatis</b> di ⚙️ Lokasi
          &amp; privasi, atau tandai lokasi saat mencatat.
        </p>
      </div>
    );
  const walk = trip.legs.filter((l) => l.mode === 'jalan').reduce((a, l) => a + l.km, 0);
  const ride = trip.km - walk;
  const cur = replay.current;
  const activeStop = cur ? (cur.kind === 'stay' ? cur.i : cur.i + 1) : -1;
  const secs = Math.max(1, Math.round(replay.totalMs / 1000 / replay.speed));

  return (
    <div className="space-y-4">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {trips.slice(0, 30).map((d) => (
          <button
            key={d.day}
            type="button"
            onClick={() => onDay(d.day)}
            className={cn(
              'flex h-12 shrink-0 flex-col items-center justify-center rounded-2xl px-3.5 leading-tight',
              d.day === trip.day
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700',
            )}
          >
            <span className="fs-13 font-bold">{dayLabel(d.day)}</span>
            <span className="fs-11 opacity-70">{d.stops.length + d.extra.length} tempat</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          ['Belanja', short(trip.total)],
          ['Tempat', String(trip.stops.length + trip.extra.length)],
          ['Jarak ±', fmtKm(trip.km)],
        ].map(([k, v]) => (
          <div
            key={k}
            className="rounded-2xl bg-white px-3 py-2.5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
          >
            <p className="fs-11 font-bold text-slate-400">{k}</p>
            <p className="fs-17 font-black tabular-nums">{v}</p>
          </div>
        ))}
      </div>

      {trip.km > 0 ? (
        <div>
          <div className="flex h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="bg-emerald-500" style={{ width: `${(walk / trip.km) * 100}%` }} />
            <div className="bg-indigo-500" style={{ width: `${(ride / trip.km) * 100}%` }} />
          </div>
          <p className="mt-1.5 flex flex-wrap gap-x-3 fs-12 text-slate-500">
            <span>🚶 Jalan kaki ±{fmtKm(walk)}</span>
            <span>🛵 Kendaraan ±{fmtKm(ride)}</span>
            <span className="text-slate-400">perkiraan dari jarak antar tempat</span>
          </p>
        </div>
      ) : null}

      <div className="flex items-center gap-3 rounded-[22px] bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-3.5 text-white">
        <button
          type="button"
          onClick={replay.play}
          disabled={trip.stops.length < 2}
          aria-label="Putar ulang perjalanan"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-indigo-700 shadow-lg disabled:opacity-50"
        >
          <Play size={20} className="ml-0.5" fill="currentColor" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="fs-15 font-black">Putar ulang perjalanan</p>
          <p className="truncate fs-12 text-white/80">
            {trip.stops.length < 2
              ? 'Perlu minimal 2 tempat di hari ini'
              : `${trip.stops[0].time ?? ''}${trip.stops[0].time && trip.stops.at(-1)?.time ? ` – ${trip.stops.at(-1)?.time}` : ''} · ±${secs} detik`}
          </p>
        </div>
        <div className="flex shrink-0 rounded-full bg-white/15 p-0.5">
          {[1, 2, 4].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => replay.setSpeed(s)}
              className={cn(
                'h-7 w-8 rounded-full fs-12 font-black',
                replay.speed === s ? 'bg-white text-indigo-700' : 'text-white/80',
              )}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      <ol>
        {trip.stops.map((s, i) => (
          <li key={s.tx_id}>
            <button
              type="button"
              onClick={() => onStop(i)}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors',
                activeStop === i ? 'bg-indigo-50 dark:bg-indigo-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-900',
              )}
            >
              <span className="w-11 shrink-0 fs-12.5 font-bold tabular-nums text-slate-400">{s.time ?? '—'}</span>
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white fsh-20 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
                {categoryVisual(s.category, 'pengeluaran').emoji}
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1 fs-10.5 font-black text-white">
                  {i + 1}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate fs-14 font-bold">{s.label}</span>
                <span className="block truncate fs-12 text-slate-500">
                  {s.source === 'struk' ? '🧾 dari struk · ' : ''}
                  {s.address || s.category}
                </span>
              </span>
              <span className="shrink-0 fs-14 font-black tabular-nums">{short(idrOf(s))}</span>
            </button>
            {i < trip.legs.length ? (
              <div className="flex items-center gap-3 py-0.5 pl-2">
                <span className="w-11 shrink-0" />
                <span className="flex w-11 shrink-0 justify-center">
                  <span
                    className={cn(
                      'h-7 border-l-[3px]',
                      trip.legs[i].mode === 'jalan' ? 'border-dotted border-emerald-400' : 'border-indigo-400',
                    )}
                  />
                </span>
                <span className="fs-12 text-slate-500">
                  {MODE[trip.legs[i].mode].icon} {MODE[trip.legs[i].mode].label} ±{trip.legs[i].minutes} mnt ·{' '}
                  {fmtKm(trip.legs[i].km)}
                </span>
              </div>
            ) : null}
          </li>
        ))}
      </ol>
      {trip.extra.length ? (
        <section className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">
          <p className="fs-12.5 font-bold text-slate-600 dark:text-slate-300">Tanpa jam · tidak masuk rute</p>
          <p className="mb-1.5 fs-11.5 text-slate-400">Dicatat di hari lain, jadi urutannya tidak diketahui.</p>
          {trip.extra.map((s) => (
            <button
              key={s.tx_id}
              type="button"
              onClick={() => onFocus(s.tx_id)}
              className="flex w-full items-center gap-3 rounded-xl px-1 py-1.5 text-left hover:bg-white dark:hover:bg-slate-800"
            >
              <span className="fs-18">{categoryVisual(s.category, 'pengeluaran').emoji}</span>
              <span className="min-w-0 flex-1 truncate fs-13 font-semibold">{s.label}</span>
              <span className="shrink-0 fs-13 font-bold tabular-nums">{short(idrOf(s))}</span>
            </button>
          ))}
        </section>
      ) : null}
    </div>
  );
}
