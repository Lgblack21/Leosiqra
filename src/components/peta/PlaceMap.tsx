'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as MlMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { cn } from '@/lib/utils';

// Peta MapLibre + gaya OpenFreeMap (gratis, data © kontributor OpenStreetMap). Pustaka dimuat
// dinamis hanya di halaman peta. Gagal memuat gaya online → latar polos, pin tetap tampil.
const STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const FALLBACK = {
  version: 8 as const,
  sources: {},
  layers: [{ id: 'bg', type: 'background' as const, paint: { 'background-color': '#eef1f4' } }],
};
const JAKARTA: [number, number] = [106.8272, -6.1754];

export type MapMarker = {
  key: string;
  lat: number;
  lng: number;
  emoji: string;
  label?: string;
  count?: number;
  active?: boolean;
};

export function PlaceMap({
  markers,
  onMarker,
  picker,
  focus,
  className,
}: {
  markers: MapMarker[];
  onMarker?: (key: string) => void;
  picker?: { onMove: (lat: number, lng: number) => void };
  focus?: { lat: number; lng: number; zoom?: number; seq: number } | null;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const pins = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const fitted = useRef(false);
  const pickerRef = useRef(picker);
  useEffect(() => {
    pickerRef.current = picker;
  });

  useEffect(() => {
    let alive = true;
    let m: MlMap | null = null;
    let ro: ResizeObserver | null = null;
    (async () => {
      const ml = await import('maplibre-gl');
      // Worker disalin ke public/ saat build (scripts/salin-maplibre-worker.mjs).
      ml.setWorkerUrl('/maplibre-gl-worker.mjs');
      if (!alive || !box.current) return;
      // Ambil gaya peta dulu: kalau gagal (offline/diblokir) pakai latar polos. Error tile satu-satu
      // setelahnya tidak mengganti peta — MapLibre cukup melewati tile itu.
      const style = await fetch(STYLE, { signal: AbortSignal.timeout(10000) })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .catch(() => null);
      if (!alive || !box.current) return;
      if (!style) setFailed(true);
      m = new ml.Map({
        container: box.current,
        style: style ?? FALLBACK,
        center: JAKARTA,
        zoom: 10,
        attributionControl: { compact: true },
      });
      m.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right');
      m.on('load', () => alive && setReady(true));
      m.on('moveend', () => {
        const c = m!.getCenter();
        pickerRef.current?.onMove(c.lat, c.lng);
      });
      map.current = m;
      // Kotak peta bisa berubah ukuran setelah dibuat (grid/modal) → canvas ikut menyesuaikan.
      ro = new ResizeObserver(() => m?.resize());
      ro.observe(box.current);
    })();
    return () => {
      alive = false;
      ro?.disconnect();
      m?.remove();
      map.current = null;
    };
  }, []);

  // Pin HTML (emoji kategori + jumlah kunjungan + label nominal).
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    let alive = true;
    (async () => {
      const ml = await import('maplibre-gl');
      if (!alive) return;
      pins.current.forEach((p) => p.remove());
      pins.current = markers.map((mk) => {
        const el = document.createElement('button');
        el.type = 'button';
        el.setAttribute('aria-label', mk.label ? `${mk.label}` : 'Tempat');
        el.className = 'peta-pin';
        el.dataset.active = mk.active ? '1' : '0';
        el.innerHTML = `<span class="peta-pin-dot">${mk.emoji}</span>${
          mk.count && mk.count > 1 ? `<span class="peta-pin-count">${mk.count}</span>` : ''
        }${mk.label ? `<span class="peta-pin-label"></span>` : ''}`;
        if (mk.label) (el.querySelector('.peta-pin-label') as HTMLElement).textContent = mk.label;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onMarker?.(mk.key);
        });
        return new ml.Marker({ element: el, anchor: 'bottom' }).setLngLat([mk.lng, mk.lat]).addTo(m);
      });
      if (!fitted.current && markers.length && !picker) {
        fitted.current = true;
        if (markers.length === 1) m.jumpTo({ center: [markers[0].lng, markers[0].lat], zoom: 15 });
        else {
          const b = new ml.LngLatBounds();
          markers.forEach((mk) => b.extend([mk.lng, mk.lat]));
          m.fitBounds(b, { padding: 70, maxZoom: 15, duration: 0 });
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [markers, ready, onMarker, picker]);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !focus) return;
    m.flyTo({ center: [focus.lng, focus.lat], zoom: focus.zoom ?? Math.max(m.getZoom(), 15), duration: 600 });
  }, [focus, ready]);

  return (
    <div className={cn('relative h-full w-full overflow-hidden bg-[#eef1f4]', className)}>
      <div ref={box} className="h-full w-full" />
      {picker ? (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-full text-[34px] drop-shadow-lg">
          📍
        </div>
      ) : null}
      {failed ? (
        <p className="absolute bottom-2 left-2 z-10 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-500 shadow">
          Peta jalan sedang tidak bisa dimuat — pin tetap di posisinya.
        </p>
      ) : null}
      <style>{`
        .peta-pin{position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer;background:none;border:0;padding:0}
        .peta-pin-dot{display:flex;height:42px;width:42px;align-items:center;justify-content:center;border-radius:9999px;background:#fff;font-size:20px;box-shadow:0 6px 16px -6px rgba(15,23,42,.45);border:3px solid #6366f1;transition:transform .15s}
        .peta-pin[data-active="1"] .peta-pin-dot{border-color:#f97316;transform:scale(1.15)}
        .peta-pin-count{position:absolute;top:-8px;right:-8px;min-width:20px;height:20px;padding:0 5px;border-radius:9999px;background:#4f46e5;color:#fff;font:800 11px/20px system-ui,sans-serif}
        .peta-pin-label{margin-top:3px;white-space:nowrap;border-radius:8px;background:rgba(255,255,255,.95);padding:1px 6px;font:700 11px/16px system-ui,sans-serif;color:#0f172a;box-shadow:0 2px 6px rgba(15,23,42,.18)}
      `}</style>
    </div>
  );
}
