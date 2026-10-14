"use client";

import { useEffect, useRef, useState } from 'react';
import type { Map as MLMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { formatIDR } from '@/lib/utils';
import { categoryEmoji } from '@/lib/categoryEmoji';
import type { Place } from '@/lib/services/connectService';

// Peta 3D (MapLibre + OpenFreeMap, tanpa API key): gedung 3D dan tiang di
// tiap tempat belanja — makin tinggi tiangnya, makin besar total belanjamu
// di sana. Mode 2D tetap memakai Leaflet (tambah/ubah lokasi ada di sana).

const STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const JAKARTA: [number, number] = [106.82, -6.2];

// Kotak (~150 m) di sekitar titik — cukup besar terlihat di zoom kota, untuk diekstrusi jadi tiang.
const square = (lng: number, lat: number, r = 0.0014): [number, number][] => [
  [lng - r, lat - r], [lng + r, lat - r], [lng + r, lat + r], [lng - r, lat + r], [lng - r, lat - r],
];

export function Map3D({ places, path }: { places: Place[]; path?: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markers = useRef<{ remove: () => void }[]>([]);
  const [ready, setReady] = useState(false);

  // Kelompokkan per titik (tempat yang sama dikunjungi berkali-kali).
  const groups = (() => {
    const m = new Map<string, { lng: number; lat: number; total: number; count: number; name: string; category: string }>();
    for (const p of places) {
      const k = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
      const g = m.get(k) ?? { lng: p.lng, lat: p.lat, total: 0, count: 0, name: p.name || p.note || p.category || 'Tempat', category: p.category || '' };
      g.total += Number(p.amount_idr) || 0;
      g.count += 1;
      m.set(k, g);
    }
    return [...m.values()];
  })();
  const max = Math.max(1, ...groups.map((g) => g.total));
  const dataKey = JSON.stringify(groups.map((g) => [g.lng, g.lat, g.total])) + (path ? 'p' : '');

  useEffect(() => {
    let cancelled = false;
    import('maplibre-gl').then(({ default: ml }) => {
      if (cancelled || !el.current || mapRef.current) return;
      const map = new ml.Map({ container: el.current, style: STYLE, center: JAKARTA, zoom: 12, pitch: 58, bearing: -18, attributionControl: { compact: true } });
      map.addControl(new ml.NavigationControl({ visualizePitch: true }), 'top-right');
      mapRef.current = map;
      map.on('load', () => !cancelled && setReady(true));
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const draw = async () => {
      const map = mapRef.current;
      if (!map || !ready) return;
      const { default: ml } = await import('maplibre-gl');
      const fc = {
        type: 'FeatureCollection' as const,
        features: groups.map((g) => ({
          type: 'Feature' as const,
          properties: { h: 300 + (g.total / max) * 3200, c: g.total / max },
          geometry: { type: 'Polygon' as const, coordinates: [square(g.lng, g.lat)] },
        })),
      };
      const src = map.getSource('leo-spend') as { setData?: (d: unknown) => void } | undefined;
      if (src?.setData) src.setData(fc);
      else {
        map.addSource('leo-spend', { type: 'geojson', data: fc });
        map.addLayer({
          id: 'leo-spend',
          type: 'fill-extrusion',
          source: 'leo-spend',
          paint: {
            'fill-extrusion-color': ['interpolate', ['linear'], ['get', 'c'], 0, '#a5b4fc', 0.5, '#6366f1', 1, '#f97316'],
            'fill-extrusion-height': ['get', 'h'],
            'fill-extrusion-opacity': 0.92,
          },
        });
      }
      // Jalur hari ini (mode Jejak).
      const line = { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: path ? places.map((p) => [p.lng, p.lat]) : [] } };
      const lsrc = map.getSource('leo-path') as { setData?: (d: unknown) => void } | undefined;
      if (lsrc?.setData) lsrc.setData(line);
      else {
        map.addSource('leo-path', { type: 'geojson', data: line });
        map.addLayer({ id: 'leo-path', type: 'line', source: 'leo-path', paint: { 'line-color': '#6366f1', 'line-width': 4, 'line-dasharray': [2, 1.5] } });
      }
      // Label emoji + nominal di puncak tiang.
      markers.current.forEach((m) => m.remove());
      markers.current = groups.map((g) => {
        const node = document.createElement('div');
        node.style.cssText = 'display:flex;align-items:center;gap:4px;padding:3px 8px;border-radius:999px;background:#fff;box-shadow:0 4px 12px rgba(15,23,42,.25);font:600 11px system-ui;white-space:nowrap;transform:translateY(-6px)';
        node.textContent = `${categoryEmoji(g.category)} ${formatIDR(g.total)}`;
        node.title = `${g.name} · ${g.count}× kunjungan`;
        return new ml.Marker({ element: node, anchor: 'bottom' }).setLngLat([g.lng, g.lat]).addTo(map);
      });
      if (groups.length) {
        const b = new ml.LngLatBounds();
        groups.forEach((g) => b.extend([g.lng, g.lat]));
        map.fitBounds(b, { padding: 80, maxZoom: 16, pitch: 58, bearing: -18, duration: 900 });
      }
    };
    void draw();
    // dataKey merangkum groups & path.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, ready]);

  return <div ref={el} className="h-full w-full" />;
}
