'use client';

import { useEffect, useRef, useState } from 'react';
import type { GeoJSONSource, Map as MlMap, Marker } from 'maplibre-gl';
import { Compass, Layers, LocateFixed } from 'lucide-react';
import type { MapLib } from '@/components/peta/PlaceMap';
import { currentPosition, type Place } from '@/lib/places';
import { cn } from '@/lib/utils';

type MapRef = { m: MlMap; ml: MapLib } | null;

const hex = (lat: number, lng: number, m: number) => {
  const pts: [number, number][] = [];
  for (let k = 0; k <= 6; k++) {
    const a = (Math.PI / 3) * k + Math.PI / 6;
    pts.push([lng + (m * Math.sin(a)) / (111320 * Math.cos((lat * Math.PI) / 180)), lat + (m * Math.cos(a)) / 111320]);
  }
  return pts;
};

// Lapisan tab Peta: tiang 3D per tempat (tinggi = nominal) dan peta panas (kepadatan belanja).
export function usePlaceLayers(map: MapRef, places: Place[] | null, opt: { threeD: boolean; heat: boolean }) {
  useEffect(() => {
    if (!map) return;
    const { m } = map;
    const list = places ?? [];
    const max = Math.max(1, ...list.map((p) => p.total));
    const pts = {
      type: 'FeatureCollection' as const,
      features: list.map((p) => ({
        type: 'Feature' as const,
        properties: { w: Math.sqrt(p.total / max) },
        geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
      })),
    };
    const cols = {
      type: 'FeatureCollection' as const,
      features: list.map((p) => {
        const f = p.total / max;
        return {
          type: 'Feature' as const,
          properties: { h: 120 + 1800 * f, f },
          geometry: { type: 'Polygon' as const, coordinates: [hex(p.lat, p.lng, 110 + 130 * Math.sqrt(f))] },
        };
      }),
    };
    try {
      if (!m.getSource('tempat-pt')) {
        m.addSource('tempat-pt', { type: 'geojson', data: pts });
        m.addLayer({
          id: 'tempat-heat',
          type: 'heatmap',
          source: 'tempat-pt',
          paint: {
            'heatmap-weight': ['get', 'w'],
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 9, 0.8, 15, 2],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 9, 22, 13, 40, 16, 70],
            'heatmap-opacity': 0.72,
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0,
              'rgba(99,102,241,0)',
              0.25,
              'rgba(129,140,248,0.45)',
              0.55,
              'rgba(99,102,241,0.75)',
              0.85,
              'rgba(168,85,247,0.85)',
              1,
              'rgba(217,70,239,0.95)',
            ],
          },
        });
        m.addSource('tempat-col', { type: 'geojson', data: cols });
        m.addLayer({
          id: 'tempat-3d',
          type: 'fill-extrusion',
          source: 'tempat-col',
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
            // Saat sudah dekat (gedung 3D tampil), tiang memudar supaya jalan & gedung terlihat.
            'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0.9, 14.5, 0],
          },
        });
      } else {
        (m.getSource('tempat-pt') as GeoJSONSource).setData(pts);
        (m.getSource('tempat-col') as GeoJSONSource).setData(cols);
      }
      m.setLayoutProperty('tempat-heat', 'visibility', places && opt.heat ? 'visible' : 'none');
      m.setLayoutProperty('tempat-3d', 'visibility', places && opt.threeD ? 'visible' : 'none');
    } catch {
      /* gaya peta belum siap */
    }
  }, [map, places, opt.threeD, opt.heat]);
}

// Tumpukan tombol peta (kanan atas): 3D, lapisan panas, lokasiku, kompas.
export function MapControls({
  map,
  threeD,
  onThreeD,
  heat,
  onHeat,
  focusZoomOnThreeD,
}: {
  map: MapRef;
  threeD: boolean;
  onThreeD: (v: boolean) => void;
  heat: boolean | null;
  onHeat: (v: boolean) => void;
  /** Titik yang didekati saat 3D dinyalakan dari tampilan satu kota (supaya tiangnya terbaca). */
  focusZoomOnThreeD?: { lat: number; lng: number } | null;
}) {
  const [toast, setToast] = useState('');
  const [tilted, setTilted] = useState(false);
  const [locating, setLocating] = useState(false);
  const me = useRef<Marker | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = (t: string) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3200);
  };

  // Kemiringan kamera mengikuti 3D (berlaku di semua tab).
  const first = useRef(true);
  useEffect(() => {
    if (!map) return;
    if (first.current) {
      first.current = false;
      if (!threeD) return;
    }
    const { m } = map;
    if (threeD) {
      const near = focusZoomOnThreeD && m.getZoom() < 12;
      m.easeTo({
        pitch: 58,
        bearing: -18,
        duration: 900,
        ...(near ? { center: [focusZoomOnThreeD.lng, focusZoomOnThreeD.lat] as [number, number], zoom: 12 } : {}),
      });
    } else m.easeTo({ pitch: 0, bearing: 0, duration: 700 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hanya saat 3D diganti
  }, [threeD, map]);

  useEffect(() => {
    if (!map) return;
    const { m } = map;
    const upd = () => setTilted(Math.abs(m.getBearing()) > 0.5 || m.getPitch() > 0.5);
    m.on('rotate', upd);
    m.on('pitch', upd);
    upd();
    return () => {
      m.off('rotate', upd);
      m.off('pitch', upd);
    };
  }, [map]);
  useEffect(
    () => () => {
      me.current?.remove();
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const locate = async () => {
    if (!map) return;
    setLocating(true);
    try {
      const p = await currentPosition();
      if (!me.current) {
        const el = document.createElement('div');
        el.className = 'peta-me';
        me.current = new map.ml.Marker({ element: el });
      }
      me.current.setLngLat([p.lng, p.lat]).addTo(map.m);
      map.m.flyTo({ center: [p.lng, p.lat], zoom: Math.max(map.m.getZoom(), 15), duration: 800 });
      say('Posisimu sekarang — hanya ditampilkan, tidak disimpan.');
    } catch (e) {
      say(e instanceof Error ? e.message : 'Lokasi belum bisa didapat.');
    } finally {
      setLocating(false);
    }
  };

  const btn = 'flex h-11 w-11 items-center justify-center transition-colors';
  return (
    <>
      <div className="pointer-events-auto absolute right-3 top-3 z-10 flex flex-col gap-2">
        <div className="overflow-hidden rounded-2xl bg-white/95 shadow-lg ring-1 ring-slate-200 backdrop-blur dark:bg-slate-900/95 dark:ring-slate-700">
          <button
            type="button"
            aria-label="Tampilan 3D"
            aria-pressed={threeD}
            onClick={() => {
              onThreeD(!threeD);
              if (!threeD) say('3D: tiang makin tinggi = makin besar belanjamu di sana. Seret dua jari untuk memutar.');
            }}
            className={cn(
              btn,
              'text-[13px] font-black',
              threeD
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'text-slate-700 dark:text-slate-200',
            )}
          >
            3D
          </button>
          {heat !== null ? (
            <button
              type="button"
              aria-label="Lapisan kepadatan belanja"
              aria-pressed={heat}
              onClick={() => {
                onHeat(!heat);
                if (!heat) say('Lapisan kepadatan: warna makin pekat = makin sering & besar belanjamu di area itu.');
              }}
              className={cn(
                btn,
                'border-t border-slate-100 dark:border-slate-800',
                heat
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-700 dark:text-slate-200',
              )}
            >
              <Layers size={19} />
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Lokasiku"
            onClick={() => void locate()}
            disabled={locating}
            className={cn(
              btn,
              'border-t border-slate-100 text-slate-700 disabled:opacity-60 dark:border-slate-800 dark:text-slate-200',
            )}
          >
            <LocateFixed size={19} className={locating ? 'animate-pulse' : ''} />
          </button>
        </div>
        {tilted ? (
          <button
            type="button"
            aria-label="Kembalikan arah utara"
            onClick={() => {
              if (threeD) onThreeD(false);
              else map?.m.easeTo({ pitch: 0, bearing: 0, duration: 600 });
            }}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-lg ring-1 ring-slate-200 dark:bg-slate-900/95 dark:text-slate-200 dark:ring-slate-700"
          >
            <Compass size={19} />
          </button>
        ) : null}
      </div>
      {toast ? (
        <div className="pointer-events-none absolute inset-x-3 bottom-8 z-20 flex justify-center">
          <p className="max-w-sm rounded-2xl bg-slate-950/90 px-4 py-2.5 text-center text-[12.5px] font-semibold text-white shadow-xl">
            {toast}
          </p>
        </div>
      ) : null}
      <style>{`
        .peta-me{height:18px;width:18px;border-radius:9999px;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 6px rgba(37,99,235,.25)}
      `}</style>
    </>
  );
}
