'use client';

import { useEffect, useMemo, useState } from 'react';
import type { GeoJSONSource, Map as MlMap } from 'maplibre-gl';
import type { MapLib } from '@/components/peta/PlaceMap';
import { fmtKm } from '@/components/peta/JejakView';
import { areaCache, areaKey, areaService, type AreaGroup, type Place, type PlaceArea } from '@/lib/places';
import { categoryVisual } from '@/lib/categoryEmoji';
import { rp, short } from '@/lib/kanvas/data';
import { cn } from '@/lib/utils';

// Wilayah tiap tempat: cache perangkat dulu, lalu server (bertahap — server membatasi titik baru per panggilan).
export function useAreas(places: Place[], active: boolean) {
  const [areas, setAreas] = useState<Record<string, PlaceArea | null>>(() => areaCache.read());
  const [busy, setBusy] = useState(false);
  const [stalled, setStalled] = useState(false);
  const want = useMemo(() => {
    const seen = new Set<string>();
    return places.filter((p) => {
      const k = areaKey(p);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [places]);
  const missingKey = want
    .filter((p) => areas[areaKey(p)] === undefined)
    .map(areaKey)
    .join('|');

  useEffect(() => {
    if (!active || !missingKey) return;
    let alive = true;
    (async () => {
      setBusy(true);
      setStalled(false);
      let todo = want.filter((p) => areas[areaKey(p)] === undefined);
      for (let round = 0; round < 25 && todo.length && alive; round++) {
        try {
          const r = await areaService.lookup(todo.slice(0, 40).map((p) => ({ lat: p.lat, lng: p.lng })));
          if (!alive) return;
          const got = Object.keys(r.areas).length;
          if (got) {
            areaCache.write(r.areas);
            setAreas((a) => ({ ...a, ...r.areas }));
          }
          todo = todo.filter((p) => r.areas[areaKey(p)] === undefined);
          if (!todo.length) break;
          // Tidak ada kemajuan (dibatasi/gangguan) → tunggu lebih lama.
          await new Promise((res) => setTimeout(res, got ? 600 : 6000));
        } catch {
          break;
        }
      }
      if (alive) {
        setBusy(false);
        setStalled(todo.length > 0);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cukup saat daftar titik yang belum dikenal berubah
  }, [active, missingKey]);

  return {
    areas,
    busy,
    stalled,
    known: want.length - (missingKey ? missingKey.split('|').length : 0),
    all: want.length,
  };
}

const HEX = (lat: number, lng: number, m: number) => {
  const pts: [number, number][] = [];
  for (let k = 0; k <= 6; k++) {
    const a = (Math.PI / 3) * k + Math.PI / 6;
    pts.push([lng + (m * Math.sin(a)) / (111320 * Math.cos((lat * Math.PI) / 180)), lat + (m * Math.cos(a)) / 111320]);
  }
  return pts;
};

// Lapisan peta Rekap: lingkaran intensitas (2D) atau tiang 3D setinggi nominal belanja per wilayah.
export function useAreaLayer(map: { m: MlMap; ml: MapLib } | null, groups: AreaGroup[] | null, threeD: boolean) {
  useEffect(() => {
    if (!map) return;
    const { m } = map;
    const max = Math.max(1, ...(groups ?? []).map((g) => g.total));
    const pts = {
      type: 'FeatureCollection' as const,
      features: (groups ?? []).map((g) => ({
        type: 'Feature' as const,
        properties: { r: Math.sqrt(g.total / max) },
        geometry: { type: 'Point' as const, coordinates: [g.lng, g.lat] },
      })),
    };
    const cols = {
      type: 'FeatureCollection' as const,
      features: (groups ?? []).map((g) => {
        const f = g.total / max;
        return {
          type: 'Feature' as const,
          properties: { h: 150 + 2600 * f, f },
          geometry: { type: 'Polygon' as const, coordinates: [HEX(g.lat, g.lng, 160 + 260 * Math.sqrt(f))] },
        };
      }),
    };
    try {
      if (!m.getSource('rekap-pt')) {
        m.addSource('rekap-pt', { type: 'geojson', data: pts });
        m.addLayer({
          id: 'rekap-circle',
          type: 'circle',
          source: 'rekap-pt',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['get', 'r'], 0, 14, 1, 64],
            'circle-color': '#6366f1',
            'circle-opacity': 0.22,
            'circle-stroke-color': '#6366f1',
            'circle-stroke-width': 2,
            'circle-stroke-opacity': 0.55,
          },
        });
        m.addSource('rekap-col', { type: 'geojson', data: cols });
        m.addLayer({
          id: 'rekap-3d',
          type: 'fill-extrusion',
          source: 'rekap-col',
          paint: {
            'fill-extrusion-color': [
              'interpolate',
              ['linear'],
              ['get', 'f'],
              0,
              '#a5b4fc',
              0.5,
              '#6366f1',
              1,
              '#c026d3',
            ],
            'fill-extrusion-height': ['get', 'h'],
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': 0.88,
          },
        });
      } else {
        (m.getSource('rekap-pt') as GeoJSONSource).setData(pts);
        (m.getSource('rekap-col') as GeoJSONSource).setData(cols);
      }
      m.setLayoutProperty('rekap-circle', 'visibility', groups && !threeD ? 'visible' : 'none');
      m.setLayoutProperty('rekap-3d', 'visibility', groups && threeD ? 'visible' : 'none');
    } catch {
      /* gaya peta belum siap */
    }
  }, [map, groups, threeD]);

  // Lepas lapisan saat komponen hilang.
  useEffect(
    () => () => {
      const m = map?.m;
      if (!m) return;
      try {
        for (const l of ['rekap-3d', 'rekap-circle']) if (m.getLayer(l)) m.removeLayer(l);
        for (const s of ['rekap-col', 'rekap-pt']) if (m.getSource(s)) m.removeSource(s);
      } catch {
        /* peta sudah dihapus */
      }
    },
    [map],
  );
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const LEVEL_NOTE: Record<AreaGroup['level'], string> = {
  kec: 'Kec.',
  kel: 'Kel.',
  kota: '',
  lain: '',
};

export function RekapPanel({
  rekap,
  status,
  periodLabel,
  hasPrev,
  sel,
  onSelect,
}: {
  rekap: { groups: AreaGroup[]; pending: number; radius80: number };
  status: { busy: boolean; stalled: boolean; known: number; all: number };
  periodLabel: string;
  hasPrev: boolean;
  sel: string | null;
  onSelect: (g: AreaGroup | null) => void;
}) {
  const { groups } = rekap;
  const top = groups[0];
  const top2 = groups.slice(0, 2).reduce((a, g) => a + g.share, 0);
  const fresh = hasPrev ? groups.filter((g) => g.prev === 0) : [];

  if (!status.all)
    return (
      <div className="rounded-[22px] bg-white p-5 text-center ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <p className="text-[30px]">🗺️</p>
        <p className="mt-1 text-[15px] font-black">Belum ada wilayah untuk direkap</p>
        <p className="mx-auto mt-1 max-w-xs text-[12.5px] text-slate-500">
          Tandai lokasi pengeluaranmu dulu — rekap per kecamatan muncul otomatis.
        </p>
      </div>
    );

  return (
    <div className="space-y-4">
      {status.busy || rekap.pending ? (
        <div className="rounded-2xl bg-indigo-50 px-3.5 py-2.5 dark:bg-indigo-500/10">
          <p className="text-[12.5px] font-bold text-indigo-800 dark:text-indigo-200">
            {status.stalled
              ? 'Sebagian wilayah belum bisa dikenali sekarang — coba buka lagi nanti.'
              : `Mengenali wilayah… ${status.known}/${status.all} tempat`}
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-indigo-100 dark:bg-indigo-500/20">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{ width: `${(status.known / Math.max(1, status.all)) * 100}%` }}
            />
          </div>
        </div>
      ) : null}

      {top ? (
        <div className="overflow-hidden rounded-[22px] bg-slate-950 p-4 text-white">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/50">
            Wilayah terboros · {periodLabel}
          </p>
          <p className="mt-1 text-[24px] font-black leading-tight">
            {LEVEL_NOTE[top.level]} {top.name}
          </p>
          <p className="text-[12.5px] text-white/60">{top.kota ?? ''}</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[22px] font-black tabular-nums">{rp(top.total)}</p>
              <p className="text-[12px] text-white/60">
                {top.places.length} tempat · {top.visits} kunjungan
              </p>
            </div>
            <p className="text-[34px] font-black leading-none text-fuchsia-300">{pct(top.share)}</p>
          </div>
          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-white/10">
            {groups.slice(0, 6).map((g, i) => (
              <div
                key={g.key}
                style={{ width: pct(g.share), opacity: 1 - i * 0.13 }}
                className={i === 0 ? 'bg-fuchsia-400' : 'bg-indigo-400'}
              />
            ))}
          </div>
        </div>
      ) : null}

      {groups.length ? (
        <div className="grid grid-cols-3 gap-2">
          {[
            ['Wilayah', String(groups.length)],
            ['2 teratas', pct(top2)],
            ['Radius 80%', rekap.radius80 ? fmtKm(rekap.radius80) : '—'],
          ].map(([k, v]) => (
            <div
              key={k}
              className="rounded-2xl bg-white px-3 py-2.5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
            >
              <p className="text-[11px] font-bold text-slate-400">{k}</p>
              <p className="text-[17px] font-black tabular-nums">{v}</p>
            </div>
          ))}
        </div>
      ) : null}
      {groups.length ? (
        <p className="text-[12.5px] leading-relaxed text-slate-500">
          {rekap.radius80 ? `80% belanjamu terjadi dalam ±${fmtKm(rekap.radius80)} dari pusat belanjamu. ` : ''}
          {fresh.length
            ? `Wilayah baru dibanding periode sebelumnya: ${fresh
                .slice(0, 3)
                .map((g) => g.name)
                .join(', ')}.`
            : ''}
        </p>
      ) : null}

      <ol className="space-y-1.5">
        {groups.map((g, i) => {
          const open = sel === g.key;
          const delta = hasPrev && g.prev > 0 ? (g.total - g.prev) / g.prev : null;
          return (
            <li
              key={g.key}
              className={cn(
                'overflow-hidden rounded-2xl bg-white ring-1 dark:bg-slate-900',
                open ? 'ring-2 ring-indigo-400' : 'ring-slate-200 dark:ring-slate-800',
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(open ? null : g)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
              >
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[13px] font-black',
                    i === 0
                      ? 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
                  )}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-bold">
                    {LEVEL_NOTE[g.level]} {g.name}
                  </span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500"
                      style={{ width: pct(g.share) }}
                    />
                  </span>
                  <span className="mt-0.5 block truncate text-[11.5px] text-slate-500">
                    {g.kota ? `${g.kota} · ` : ''}
                    {g.places.length} tempat · {pct(g.share)}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[14px] font-black tabular-nums">{short(g.total)}</span>
                  {delta !== null ? (
                    <span
                      className={cn(
                        'block text-[11.5px] font-bold',
                        delta > 0.05 ? 'text-rose-600' : delta < -0.05 ? 'text-emerald-600' : 'text-slate-400',
                      )}
                    >
                      {delta > 0 ? '▲' : delta < 0 ? '▼' : '•'} {Math.abs(Math.round(delta * 100))}%
                    </span>
                  ) : hasPrev ? (
                    <span className="block text-[11.5px] font-bold text-indigo-600">baru</span>
                  ) : null}
                </span>
              </button>
              {open ? (
                <div className="space-y-1 border-t border-slate-100 px-3 py-2 dark:border-slate-800">
                  {g.places.slice(0, 5).map((p) => (
                    <div key={p.key} className="flex items-center gap-2 text-[12.5px]">
                      <span>{categoryVisual(p.category, 'pengeluaran').emoji}</span>
                      <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                      <span className="text-slate-500">{p.visits}×</span>
                      <span className="w-16 text-right font-bold tabular-nums">{short(p.total)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      {groups.some((g) => g.level === 'kel') ? (
        <p className="text-[11.5px] text-slate-400">
          Kecamatan diambil dari data OpenStreetMap. Wilayah bertanda “Kel.” belum punya data kecamatan, jadi
          ditampilkan per kelurahan.
        </p>
      ) : null}
    </div>
  );
}
