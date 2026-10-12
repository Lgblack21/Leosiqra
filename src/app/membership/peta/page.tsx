"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Map as LeafletMap, LayerGroup } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, LocateFixed, MapPin, MousePointerClick, Search, Trash2, X } from 'lucide-react';
import { cn, formatIDR } from '@/lib/utils';
import { categoryEmoji, isInvestmentCategory } from '@/lib/categoryEmoji';
import { placeService, type Place } from '@/lib/services/connectService';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { LeoMascot } from '@/components/mascot/LeoMascot';
import { useFeedback } from '@/components/ui/Feedback';

// Peta: tempat-tempat kamu belanja. Lokasi ditandai sendiri per transaksi
// (lokasiku / cari nama tempat / klik di peta) — tidak ada pelacakan otomatis.
// Peta dari OpenStreetMap; pencarian tempat lewat Nominatim (OSM).

type Tab = 'peta' | 'jejak' | 'rekap';
const JAKARTA: [number, number] = [-6.2, 106.82];
const toIdr = (t: Transaction) => Number(t.amountIDR) || Number(t.amount) || 0;
const dayKey = (d: string | Date) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

export default function PetaPage() {
  const { toast } = useFeedback();
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const LRef = useRef<typeof import('leaflet') | null>(null);
  const [ready, setReady] = useState(false);
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tab, setTab] = useState<Tab>('peta');
  const [day, setDay] = useState('');
  const [picking, setPicking] = useState<Transaction | null>(null);
  const [pending, setPending] = useState<{ lat: number; lng: number } | null>(null);
  const [placeName, setPlaceName] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ display_name: string; lat: string; lon: string; name?: string }[]>([]);
  const [clickMode, setClickMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    placeService
      .list()
      .then((p) => {
        setPlaces(p);
        setUnavailable(false);
      })
      .catch(() => {
        setPlaces([]);
        setUnavailable(true);
      });
  }, []);

  useEffect(() => {
    load();
    transactionService.getUserTransactions('session').then(setTransactions).catch(() => {});
    return subscribeToCollectionChanges('places', load);
  }, [load]);

  // Leaflet hanya di browser — dimuat dinamis.
  useEffect(() => {
    let cancelled = false;
    import('leaflet').then((L) => {
      if (cancelled || !mapEl.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(mapEl.current, { zoomControl: true, attributionControl: true }).setView(JAKARTA, 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© kontributor OpenStreetMap',
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setReady(true);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  const shown = useMemo(() => {
    const list = places ?? [];
    if (tab === 'jejak' && day) return list.filter((p) => dayKey(p.date) === day).sort((a, b) => +new Date(a.date) - +new Date(b.date));
    if (tab === 'rekap') return list.filter((p) => +new Date(p.date) >= Date.now() - 30 * 864e5);
    return list;
  }, [places, tab, day]);

  // Gambar ulang pin setiap data / tab berubah.
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!ready || !L || !map || !layer) return;
    layer.clearLayers();
    for (const p of shown) {
      const icon = L.divIcon({
        className: '',
        html: `<div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:999px;background:#fff;box-shadow:0 4px 12px rgba(15,23,42,.25);border:2px solid #6366f1;font-size:17px">${categoryEmoji(p.category)}</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
      const title = (p.name || p.note || p.category || '').replace(/[<>&"]/g, '');
      L.marker([p.lat, p.lng], { icon })
        .bindPopup(`<b>${title}</b><br/>${formatIDR(Number(p.amount_idr) || 0)} · ${new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(p.date))}`)
        .addTo(layer);
    }
    if (tab === 'jejak' && shown.length > 1) {
      L.polyline(shown.map((p) => [p.lat, p.lng] as [number, number]), { color: '#6366f1', weight: 3, dashArray: '6 6' }).addTo(layer);
    }
    if (shown.length) map.fitBounds(L.latLngBounds(shown.map((p) => [p.lat, p.lng] as [number, number])).pad(0.3), { maxZoom: 15 });
  }, [shown, ready, tab]);

  // Mode "klik di peta" & pin sementara.
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L) return;
    const onClick = (e: { latlng: { lat: number; lng: number } }) => {
      if (!clickMode) return;
      setPending({ lat: e.latlng.lat, lng: e.latlng.lng });
      setClickMode(false);
    };
    map.on('click', onClick);
    const temp = pending ? L.circleMarker([pending.lat, pending.lng], { radius: 10, color: '#f97316', fillOpacity: 0.6 }).addTo(map) : null;
    if (pending) map.setView([pending.lat, pending.lng], Math.max(map.getZoom(), 15));
    map.getContainer().style.cursor = clickMode ? 'crosshair' : '';
    return () => {
      map.off('click', onClick);
      temp?.remove();
    };
  }, [clickMode, pending, ready]);

  const placedIds = new Set((places ?? []).map((p) => p.transaction_id));
  const candidates = transactions
    .filter((t) => t.type === 'pengeluaran' && !isInvestmentCategory(t.category) && t.id && !placedIds.has(t.id) && +new Date(t.date) >= Date.now() - 30 * 864e5)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .slice(0, 20);

  const startPick = (t: Transaction) => {
    setPicking(t);
    setPending(null);
    setPlaceName(t.note || '');
    setQuery(t.note || '');
    setResults([]);
  };
  const useMyLocation = () => {
    if (!navigator.geolocation) return toast.error('Browser tidak mendukung lokasi.');
    navigator.geolocation.getCurrentPosition(
      (pos) => setPending({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => toast.error('Izin lokasi ditolak atau tidak tersedia.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };
  const search = async () => {
    if (!query.trim()) return;
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=id&accept-language=id&q=${encodeURIComponent(query.trim())}`);
      setResults(await r.json());
    } catch {
      toast.error('Pencarian tempat gagal. Coba lagi.');
    }
  };
  const save = async () => {
    if (!picking?.id || !pending) return;
    setSaving(true);
    try {
      await placeService.set(picking.id, { ...pending, name: placeName.trim() || undefined });
      setPicking(null);
      setPending(null);
      toast.success('Lokasi tersimpan.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan lokasi.');
    } finally {
      setSaving(false);
    }
  };

  const days = [...new Set((places ?? []).map((p) => dayKey(p.date)))].sort().reverse();
  const rekap = useMemo(() => {
    const m = new Map<string, { name: string; total: number; count: number; emoji: string }>();
    for (const p of shown) {
      const name = p.name || p.note || p.category;
      const k = name.toLowerCase();
      const e = m.get(k) ?? { name, total: 0, count: 0, emoji: categoryEmoji(p.category) };
      e.total += Number(p.amount_idr) || 0;
      e.count++;
      m.set(k, e);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [shown]);

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Peta</h1>
          <p className="mt-0.5 text-sm text-slate-500">Tempat-tempat kamu belanja. Lokasi kamu tandai sendiri — tidak ada yang dilacak dari HP-mu.</p>
        </div>
        <div className="flex rounded-2xl bg-slate-100 p-1">
          {(['peta', 'jejak', 'rekap'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t);
                if (t === 'jejak' && !day && days[0]) setDay(days[0]);
              }}
              className={cn('rounded-xl px-4 py-2 text-sm font-bold capitalize', tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}
            >
              {t === 'rekap' ? 'Rekap 30 hari' : t}
            </button>
          ))}
        </div>
      </div>

      {unavailable && <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">Fitur peta belum aktif. Coba lagi nanti ya.</div>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="relative self-start overflow-hidden rounded-[26px] border border-slate-100 bg-white shadow-sm lg:col-span-2">
          {tab === 'jejak' && (
            <div className="absolute left-14 top-3 z-[500] flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 shadow-md">
              <span className="text-xs font-semibold text-slate-500">Hari</span>
              <select value={day} onChange={(e) => setDay(e.target.value)} className="bg-transparent text-sm font-bold outline-none">
                {days.length === 0 && <option value="">Belum ada</option>}
                {days.map((d) => <option key={d} value={d}>{new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${d}T12:00:00`))}</option>)}
              </select>
            </div>
          )}
          {clickMode && (
            <div className="absolute left-1/2 top-3 z-[500] -translate-x-1/2 rounded-xl bg-orange-500 px-3 py-1.5 text-xs font-bold text-white shadow-md">Klik lokasinya di peta</div>
          )}
          <div ref={mapEl} className="h-[460px] w-full" />
          {places && places.length === 0 && !picking && (
            <div className="pointer-events-none absolute inset-x-0 bottom-4 z-[500] mx-auto flex w-fit items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 shadow-lg">
              <LeoMascot mood="idle" size={44} />
              <p className="text-sm text-slate-600"><b>Belum ada tempat di petamu.</b> Tandai lokasi transaksi di samping.</p>
            </div>
          )}
        </div>

        <div className="rounded-[26px] border border-slate-100 bg-white p-4 shadow-sm md:p-5">
          {picking ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-slate-400">Tandai lokasi</p>
                  <p className="font-bold text-slate-900">{categoryEmoji(picking.category)} {picking.note || picking.category}</p>
                  <p className="text-xs text-slate-500">{formatIDR(toIdr(picking))} · {new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(picking.date))}</p>
                </div>
                <button type="button" onClick={() => { setPicking(null); setPending(null); setClickMode(false); }} aria-label="Batal" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={useMyLocation} className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200"><LocateFixed size={14} /> Lokasiku</button>
                <button type="button" onClick={() => setClickMode(true)} className={cn('flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold', clickMode ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')}><MousePointerClick size={14} /> Klik di peta</button>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); void search(); }} className="flex gap-2">
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nama tempat" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
                <button type="submit" aria-label="Cari" className="rounded-xl bg-slate-900 px-3 text-white"><Search size={15} /></button>
              </form>
              {results.length > 0 && (
                <ul className="max-h-40 space-y-1 overflow-y-auto">
                  {results.map((r) => (
                    <li key={`${r.lat},${r.lon}`}>
                      <button
                        type="button"
                        onClick={() => {
                          setPending({ lat: Number(r.lat), lng: Number(r.lon) });
                          if (!placeName) setPlaceName(r.name || r.display_name.split(',')[0]);
                          setResults([]);
                        }}
                        className="w-full rounded-xl px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                      >
                        <MapPin size={12} className="mr-1 inline text-indigo-500" />{r.display_name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <input value={placeName} onChange={(e) => setPlaceName(e.target.value)} maxLength={80} placeholder="Nama tempat (mis. Kopi Kenangan Senopati)" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
              <button type="button" onClick={save} disabled={!pending || saving} className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
                <Crosshair size={15} /> {pending ? (saving ? 'Menyimpan…' : 'Simpan lokasi') : 'Pilih lokasi dulu'}
              </button>
            </div>
          ) : tab === 'rekap' ? (
            <>
              <p className="font-bold text-slate-900">Paling banyak keluar</p>
              <p className="mb-3 text-xs text-slate-400">Dari tempat yang sudah ditandai, 30 hari terakhir</p>
              {rekap.length === 0 ? (
                <p className="text-sm text-slate-500">Belum ada data.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {rekap.map((r) => (
                    <li key={r.name} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0 truncate text-sm font-bold text-slate-800">{r.emoji} {r.name} <span className="font-normal text-slate-400">· {r.count}×</span></span>
                      <span className="shrink-0 text-sm font-extrabold text-slate-900 tabular-nums">{formatIDR(r.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <p className="font-bold text-slate-900">Tandai lokasi</p>
              <p className="mb-3 text-xs text-slate-400">Pengeluaran 30 hari terakhir yang belum punya lokasi</p>
              {candidates.length === 0 ? (
                <p className="text-sm text-slate-500">Semua sudah ditandai. 🎉</p>
              ) : (
                <ul className="max-h-[360px] space-y-1 overflow-y-auto">
                  {candidates.map((t) => (
                    <li key={t.id}>
                      <button type="button" onClick={() => startPick(t)} className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left hover:bg-slate-50">
                        <span className="min-w-0 truncate text-sm text-slate-700">{categoryEmoji(t.category)} {t.note || t.category}</span>
                        <span className="flex shrink-0 items-center gap-1.5 text-xs text-slate-400">{formatIDR(toIdr(t))} <MapPin size={13} className="text-indigo-500" /></span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {(places?.length ?? 0) > 0 && (
                <>
                  <p className="mb-1 mt-4 text-xs font-semibold text-slate-400">Sudah ditandai ({places?.length})</p>
                  <ul className="max-h-40 space-y-1 overflow-y-auto">
                    {(places ?? []).slice(0, 15).map((p) => (
                      <li key={p.transaction_id} className="group flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-sm">
                        <span className="min-w-0 truncate text-slate-600">{categoryEmoji(p.category)} {p.name || p.note || p.category}</span>
                        <button type="button" onClick={() => placeService.remove(p.transaction_id)} aria-label="Hapus lokasi" className="rounded-lg p-1 text-slate-300 opacity-0 hover:text-rose-500 group-hover:opacity-100"><Trash2 size={13} /></button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
