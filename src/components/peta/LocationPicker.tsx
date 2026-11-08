'use client';

import { useState } from 'react';
import { LocateFixed, Search, X } from 'lucide-react';
import { PlaceMap } from '@/components/peta/PlaceMap';
import { currentPosition, placeService, type PlaceSource, type SearchHit } from '@/lib/places';
import { cn } from '@/lib/utils';

export type PickedPlace = {
  lat: number;
  lng: number;
  name: string | null;
  address: string | null;
  source: PlaceSource;
};

// Pilih lokasi satu transaksi: GPS sekali, cari nama tempat (tombol Cari), atau geser peta ke pin tengah.
export function LocationPicker({
  title,
  defaultName,
  start,
  onSave,
  onClose,
  zone,
}: {
  /** Dipakai untuk memilih titik zona privat: tanpa kolom nama, teks disesuaikan. */
  zone?: boolean;
  title: string;
  defaultName: string;
  start?: { lat: number; lng: number } | null;
  onSave: (p: PickedPlace) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(defaultName);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(start ?? null);
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom?: number; seq: number } | null>(
    start ? { ...start, zoom: 16, seq: 0 } : null,
  );
  const [source, setSource] = useState<PlaceSource>('pin');
  const [address, setAddress] = useState<string | null>(null);
  const [busy, setBusy] = useState<'gps' | 'cari' | 'simpan' | null>(null);
  const [err, setErr] = useState('');

  const go = (p: { lat: number; lng: number }, src: PlaceSource, addr: string | null = null) => {
    setFocus({ ...p, zoom: 17, seq: Date.now() });
    setCenter(p);
    setSource(src);
    setAddress(addr);
  };
  const gps = async () => {
    setBusy('gps');
    setErr('');
    try {
      go(await currentPosition(), 'gps');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lokasi belum bisa didapat.');
    } finally {
      setBusy(null);
    }
  };
  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 3) return setErr('Ketik minimal 3 huruf nama tempat.');
    setBusy('cari');
    setErr('');
    try {
      const r = await placeService.search(q.trim());
      setHits(r.items);
      if (!r.items.length) setErr('Tempat tidak ditemukan. Coba nama lain, atau geser peta ke lokasinya.');
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Pencarian gagal.');
    } finally {
      setBusy(null);
    }
  };
  const save = async () => {
    if (!center) return setErr('Pilih lokasi dulu: pakai lokasimu, cari tempat, atau geser peta.');
    setBusy('simpan');
    setErr('');
    try {
      await onSave({ ...center, name: name.trim() || null, address, source });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menyimpan lokasi.');
      setBusy(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/40 sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white sm:max-w-xl sm:rounded-[28px] dark:bg-slate-950"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
              {zone ? 'Zona privat' : 'Tandai lokasi'}
            </p>
            <p className="truncate text-[16px] font-black text-slate-900 dark:text-white">{title}</p>
          </div>
          <button
            type="button"
            aria-label="Tutup"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <label className={cn('block', zone && 'hidden')}>
            <span className="text-[12px] font-bold text-slate-500">Nama tempat</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 120))}
              placeholder="mis. Kopi Kenangan Cipete"
              className="mt-1 h-11 w-full rounded-xl bg-slate-50 px-3 text-[14px] font-semibold outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-400 dark:bg-slate-900 dark:ring-slate-700"
            />
          </label>
          <button
            type="button"
            onClick={() => void gps()}
            disabled={busy !== null}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-[14px] font-bold text-white disabled:opacity-60"
          >
            <LocateFixed size={17} /> {busy === 'gps' ? 'Mencari lokasimu…' : 'Pakai lokasiku sekarang'}
          </button>
          <form onSubmit={(e) => void search(e)} className="flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari tempat, mis. Senayan City"
              className="h-11 min-w-0 flex-1 rounded-xl bg-slate-50 px-3 text-[14px] outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-400 dark:bg-slate-900 dark:ring-slate-700"
            />
            <button
              type="submit"
              disabled={busy !== null}
              className="flex h-11 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-[14px] font-bold text-white disabled:opacity-60 dark:bg-white dark:text-slate-900"
            >
              <Search size={16} /> {busy === 'cari' ? '…' : 'Cari'}
            </button>
          </form>
          {hits && hits.length ? (
            <div className="space-y-1">
              {hits.map((h, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    go(h, 'cari', h.address);
                    if (!name.trim() && h.name) setName(h.name);
                    setHits(null);
                  }}
                  className="block w-full rounded-xl px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  <span className="block text-[13.5px] font-bold text-slate-800 dark:text-slate-100">{h.name}</span>
                  <span className="block truncate text-[12px] text-slate-500">{h.address}</span>
                </button>
              ))}
            </div>
          ) : null}
          {err ? (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-[12.5px] font-semibold text-rose-700">{err}</p>
          ) : null}
          <div className="h-60 overflow-hidden rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800">
            <PlaceMap
              markers={[]}
              focus={focus}
              picker={{
                onMove: (lat, lng) => {
                  setCenter((c) => {
                    if (c && Math.abs(c.lat - lat) < 1e-7 && Math.abs(c.lng - lng) < 1e-7) return c;
                    setSource((s) => (s === 'gps' || s === 'cari' ? s : 'pin'));
                    return { lat, lng };
                  });
                },
              }}
            />
          </div>
          <p className="text-[11.5px] text-slate-400">
            {zone
              ? 'Geser peta sampai pin 📍 tepat di tengah zona. Titik ini hanya disimpan di perangkat ini, tidak dikirim ke server.'
              : 'Geser peta sampai pin 📍 tepat di tempatnya. Lokasi hanya disimpan untuk transaksi ini — Leosiqra tidak melacak posisimu.'}
          </p>
        </div>
        <div className="border-t border-slate-100 px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 dark:border-slate-800">
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy !== null}
            className={cn(
              'h-12 w-full rounded-full text-[15px] font-bold text-white disabled:opacity-60',
              center ? 'bg-emerald-600' : 'bg-slate-400',
            )}
          >
            {busy === 'simpan' ? 'Menyimpan…' : zone ? 'Simpan zona' : 'Simpan lokasi'}
          </button>
        </div>
      </div>
    </div>
  );
}
