'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LocationPicker } from '@/components/peta/LocationPicker';
import {
  currentPosition,
  knownPlaces,
  MAX_AUTO_ACCURACY,
  nearestKnown,
  placePrefs,
  placeService,
  zoneAt,
  ZONE_META,
  type PlaceSource,
} from '@/lib/places';
import { cn } from '@/lib/utils';

export type StrukPlace = { name: string | null; address: string | null } | null | undefined;
type Draft =
  | { k: 'idle' }
  | { k: 'locating' }
  | {
      k: 'set';
      lat: number;
      lng: number;
      accuracy: number | null;
      name: string | null;
      address: string | null;
      source: PlaceSource;
      auto: boolean;
    }
  | { k: 'zone'; label: string; emoji: string }
  | { k: 'error'; msg: string }
  | { k: 'off' };

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Lokasi untuk transaksi yang sedang dicatat:
// - Otomatis (kalau dinyalakan di perangkat ini) hanya untuk pengeluaran HARI INI dan GPS cukup akurat.
// - Di dalam zona privat (Rumah/Kantor) koordinat tidak disimpan sama sekali.
// - Foto struk dengan alamat → dicari di peta kalau GPS tidak dipakai.
// - Nama tempat disarankan dari tempat yang pernah kamu tandai (±60 m).
// Lokasi baru disimpan setelah transaksinya tersimpan (commit); gagal tidak membatalkan transaksi.
export function usePlaceDraft({
  type,
  date,
  struk,
  active = true,
}: {
  type: string;
  date?: string;
  struk?: StrukPlace;
  active?: boolean;
}) {
  const [d, setD] = useState<Draft>({ k: 'idle' });
  const [editing, setEditing] = useState(false);
  const run = useRef(0);
  const spending = type === 'pengeluaran';
  const today = !date || date.slice(0, 10) === todayLocal();

  const locate = useCallback(async (auto: boolean) => {
    const id = ++run.current;
    setD({ k: 'locating' });
    try {
      const fix = await currentPosition();
      if (id !== run.current) return;
      if (auto && fix.accuracy > MAX_AUTO_ACCURACY) {
        setD({
          k: 'error',
          msg: `Sinyal lokasi lemah (±${Math.round(fix.accuracy)} m), tidak ditempel otomatis.`,
        });
        return;
      }
      const zone = zoneAt(fix);
      if (zone) {
        setD({ k: 'zone', ...ZONE_META[zone.id] });
        return;
      }
      const near = await nearestKnown(fix);
      if (id !== run.current) return;
      setD({
        k: 'set',
        lat: fix.lat,
        lng: fix.lng,
        accuracy: Math.round(fix.accuracy),
        name: near?.name ?? null,
        address: near?.address ?? null,
        source: 'gps',
        auto,
      });
    } catch (e) {
      if (id !== run.current) return;
      setD(auto ? { k: 'off' } : { k: 'error', msg: e instanceof Error ? e.message : 'Lokasi belum bisa didapat.' });
    }
  }, []);

  // Otomatis: saat form dibuka (atau di-reset setelah simpan) untuk pengeluaran hari ini.
  // Gagal/ditolak/dihapus user → 'off', jadi tidak diulang terus.
  useEffect(() => {
    if (!active || !spending || !today || d.k !== 'idle' || !placePrefs.auto()) return;
    void locate(true);
  }, [active, spending, today, d.k, locate]);

  // Tanggal diganti ke hari lain → lokasi GPS otomatis tidak lagi cocok.
  useEffect(() => {
    if (!today && d.k === 'set' && d.source === 'gps' && d.auto) setD({ k: 'idle' });
    if (!today && (d.k === 'zone' || d.k === 'locating')) {
      run.current++;
      setD({ k: 'idle' });
    }
  }, [today, d]);

  // Struk dengan alamat: cari titiknya kalau belum ada lokasi GPS.
  const strukKey = struk ? `${struk.name ?? ''}|${struk.address ?? ''}` : '';
  useEffect(() => {
    if (!struk?.address || !spending) return;
    let alive = true;
    void placeService
      .search(struk.address.slice(0, 100))
      .then((r) => {
        const hit = r.items[0];
        if (!alive || !hit) return;
        setD((cur) =>
          cur.k === 'set' && cur.source === 'gps'
            ? { ...cur, name: cur.name ?? struk.name }
            : cur.k === 'off'
              ? cur
              : {
                  k: 'set',
                  lat: hit.lat,
                  lng: hit.lng,
                  accuracy: null,
                  name: struk.name ?? hit.name,
                  address: struk.address,
                  source: 'struk',
                  auto: true,
                },
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kunci struk sudah mewakili isinya
  }, [strukKey, spending]);

  const reset = useCallback(() => {
    run.current++;
    setD({ k: 'idle' });
    setEditing(false);
  }, []);

  // Form ditutup → lokasi draf dibuang (posisi bisa sudah basi saat dibuka lagi).
  useEffect(() => {
    if (!active) reset();
  }, [active, reset]);

  const commit = useCallback(
    async (txId: string | null | undefined, fallbackName?: string | null) => {
      if (!txId || !spending || d.k !== 'set') return;
      await placeService
        .set(txId, {
          lat: d.lat,
          lng: d.lng,
          name: d.name || fallbackName?.trim() || null,
          address: d.address,
          source: d.source,
        })
        .then(() => knownPlaces(true))
        .catch((e) => console.warn('Lokasi transaksi gagal disimpan:', e));
    },
    [d, spending],
  );

  const pill = 'inline-flex h-8 items-center gap-1.5 rounded-full px-3 fs-12.5 font-bold ring-1 transition-colors';
  const chip = !spending ? null : (
    <div className="flex flex-wrap items-center gap-1.5">
      {d.k === 'idle' || d.k === 'off' ? (
        <>
          <button
            type="button"
            onClick={() => void locate(false)}
            className={cn(
              pill,
              'bg-white text-slate-600 ring-slate-200 hover:ring-indigo-300 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700',
            )}
          >
            📍 Tandai lokasi di sini
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="fs-12 font-semibold text-slate-400 underline-offset-2 hover:underline"
          >
            pilih di peta
          </button>
        </>
      ) : null}
      {d.k === 'locating' ? (
        <span
          className={cn(
            pill,
            'bg-indigo-50 text-indigo-700 ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/20',
          )}
        >
          <span className="h-2 w-2 animate-ping rounded-full bg-indigo-500" /> Mencari lokasimu…
        </span>
      ) : null}
      {d.k === 'set' ? (
        <span
          className={cn(
            pill,
            'max-w-full bg-emerald-50 pr-1 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30',
          )}
        >
          <button type="button" onClick={() => setEditing(true)} className="min-w-0 truncate text-left">
            📍 {d.name || 'Lokasi ditandai'}
            <span className="font-semibold opacity-70">
              {' '}
              · {d.source === 'struk' ? 'dari alamat struk' : d.accuracy ? `±${d.accuracy} m` : 'dipilih'}
            </span>
          </button>
          <button
            type="button"
            aria-label="Hapus lokasi"
            onClick={() => {
              run.current++;
              setD({ k: 'off' });
            }}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-500/20"
          >
            ✕
          </button>
        </span>
      ) : null}
      {d.k === 'zone' ? (
        <>
          <span
            className={cn(
              pill,
              'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
            )}
          >
            {d.emoji} Di zona {d.label} — lokasi tidak disimpan
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="fs-12 font-semibold text-slate-400 underline-offset-2 hover:underline"
          >
            tetap tandai
          </button>
        </>
      ) : null}
      {d.k === 'error' ? (
        <>
          <span className="fs-12 text-slate-500">{d.msg}</span>
          <button
            type="button"
            onClick={() => void locate(false)}
            className="fs-12 font-bold text-indigo-600 dark:text-indigo-400"
          >
            Coba lagi
          </button>
          <button type="button" onClick={() => setEditing(true)} className="fs-12 font-semibold text-slate-400">
            pilih di peta
          </button>
        </>
      ) : null}
      {editing ? (
        <LocationPicker
          title="Lokasi transaksi ini"
          defaultName={d.k === 'set' ? (d.name ?? '') : ''}
          start={d.k === 'set' ? { lat: d.lat, lng: d.lng } : null}
          onClose={() => setEditing(false)}
          onSave={async (p) => {
            run.current++;
            setD({ k: 'set', ...p, accuracy: null, auto: false });
            setEditing(false);
          }}
        />
      ) : null}
    </div>
  );

  return { chip, commit, reset, hasPlace: d.k === 'set' };
}
