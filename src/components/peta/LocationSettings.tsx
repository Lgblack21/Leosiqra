'use client';

import { useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { LocationPicker } from '@/components/peta/LocationPicker';
import {
  currentPosition,
  distanceKm,
  placePrefs,
  placeService,
  ZONE_META,
  ZONE_RADII,
  type PlacedTx,
  type PrivateZone,
} from '@/lib/places';
import { cn } from '@/lib/utils';

// Lokasi & privasi Peta Belanja. Setelan otomatis & zona privat tersimpan HANYA di perangkat ini.
export function LocationSettings({
  items,
  onClose,
  onChanged,
}: {
  items: PlacedTx[];
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const [auto, setAuto] = useState(placePrefs.auto());
  const [zones, setZones] = useState(placePrefs.zones());
  const [pickZone, setPickZone] = useState<PrivateZone['id'] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);

  const toggleAuto = async () => {
    setMsg(null);
    if (auto) {
      placePrefs.setAuto(false);
      setAuto(false);
      return;
    }
    // Minta izin lokasi sekarang, supaya saat mencatat tidak tiba-tiba muncul pop-up.
    setBusy(true);
    try {
      await currentPosition();
      placePrefs.setAuto(true);
      setAuto(true);
      setMsg({ ok: true, text: 'Lokasi otomatis aktif di perangkat ini.' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Izin lokasi belum diberikan.' });
    } finally {
      setBusy(false);
    }
  };
  const refreshZones = () => setZones(placePrefs.zones());
  const inZone = (z: PrivateZone) => items.filter((t) => distanceKm(z, t) * 1000 <= z.radius);
  const clearInZone = async (z: PrivateZone) => {
    const list = inZone(z);
    setBusy(true);
    try {
      for (const t of list) await placeService.remove(t.tx_id);
      setMsg({ ok: true, text: `${list.length} lokasi di zona ${ZONE_META[z.id].label} dihapus.` });
      await onChanged();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Gagal menghapus lokasi.' });
    } finally {
      setBusy(false);
    }
  };
  const removeAll = async () => {
    setBusy(true);
    try {
      const r = await placeService.removeAll();
      setMsg({ ok: true, text: `Semua lokasi dihapus (${r.deleted}). Transaksimu tetap utuh.` });
      setConfirmAll(false);
      await onChanged();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Gagal menghapus lokasi.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-slate-950/40 sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-[#f6f5f1] sm:max-w-lg sm:rounded-[28px] dark:bg-slate-950"
      >
        <div className="flex items-center gap-3 px-5 pb-2 pt-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            <ShieldCheck size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-black">Lokasi &amp; privasi</p>
            <p className="text-[12px] text-slate-500">Kamu yang pegang kendali lokasimu.</p>
          </div>
          <button
            type="button"
            aria-label="Tutup"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-200/70 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 pb-6 pt-2">
          {msg ? (
            <p
              className={cn(
                'rounded-2xl px-3.5 py-2.5 text-[12.5px] font-semibold',
                msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700',
              )}
            >
              {msg.text}
            </p>
          ) : null}

          <section className="rounded-[22px] bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-black">Lokasi otomatis saat mencatat</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-500">
                  Saat mencatat pengeluaran <b>hari ini</b>, posisimu diambil sekali dan ditempel ke transaksi itu —
                  bisa kamu hapus sebelum menyimpan. Tidak ada pelacakan di latar belakang. Berlaku di perangkat ini.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={auto}
                aria-label="Lokasi otomatis"
                disabled={busy}
                onClick={() => void toggleAuto()}
                className={cn(
                  'relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60',
                  auto ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all',
                    auto ? 'left-[22px]' : 'left-0.5',
                  )}
                />
              </button>
            </div>
          </section>

          <section className="rounded-[22px] bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
            <p className="text-[14.5px] font-black">Zona privat</p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-500">
              Di dalam zona ini, lokasi otomatis <b>tidak menyimpan koordinat</b>. Titik &amp; radiusnya hanya ada di
              perangkat ini — server Leosiqra tidak pernah tahu letak rumahmu.
            </p>
            <div className="mt-3 space-y-2">
              {(Object.keys(ZONE_META) as PrivateZone['id'][]).map((id) => {
                const z = zones.find((x) => x.id === id);
                const meta = ZONE_META[id];
                const stale = z ? inZone(z).length : 0;
                return (
                  <div key={id} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
                    <div className="flex items-center gap-3">
                      <span className="text-[22px]">{meta.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-bold">{meta.label}</p>
                        <p className="text-[12px] text-slate-500">{z ? `Radius ${z.radius} m` : 'Belum diatur'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPickZone(id)}
                        className="h-8 rounded-full bg-slate-900 px-3 text-[12.5px] font-bold text-white dark:bg-white dark:text-slate-900"
                      >
                        {z ? 'Pindah titik' : 'Atur'}
                      </button>
                      {z ? (
                        <button
                          type="button"
                          aria-label={`Hapus zona ${meta.label}`}
                          onClick={() => {
                            placePrefs.removeZone(id);
                            refreshZones();
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                        >
                          <X size={15} />
                        </button>
                      ) : null}
                    </div>
                    {z ? (
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pl-9">
                        {ZONE_RADII.map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => {
                              placePrefs.setZone({ ...z, radius: r });
                              refreshZones();
                            }}
                            className={cn(
                              'h-8 rounded-full px-3 text-[12.5px] font-bold',
                              z.radius === r
                                ? 'bg-emerald-600 text-white'
                                : 'bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700',
                            )}
                          >
                            {r} m
                          </button>
                        ))}
                        {stale ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void clearInZone(z)}
                            className="h-8 rounded-full px-2 text-[12px] font-bold text-rose-600 disabled:opacity-50"
                          >
                            Hapus {stale} lokasi lama di zona ini
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[11.5px] text-slate-400">Saran: 200 m. GPS di dalam rumah bisa meleset 30–100 m.</p>
          </section>

          <section className="rounded-[22px] bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
            <p className="text-[14.5px] font-black">Data lokasimu</p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-500">
              {items.length} transaksi punya lokasi. Lokasi hanya terlihat olehmu dan ikut terhapus bersama
              transaksinya.
            </p>
            {confirmAll ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[12.5px] font-semibold text-rose-700">
                  Hapus semua lokasi? Transaksinya tetap ada.
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void removeAll()}
                  className="h-9 rounded-full bg-rose-600 px-4 text-[13px] font-bold text-white disabled:opacity-60"
                >
                  {busy ? 'Menghapus…' : 'Ya, hapus'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAll(false)}
                  className="h-9 rounded-full px-3 text-[13px] font-bold text-slate-500"
                >
                  Batal
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={!items.length}
                onClick={() => setConfirmAll(true)}
                className="mt-3 h-10 rounded-full px-4 text-[13px] font-bold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-40 dark:ring-rose-500/30 dark:hover:bg-rose-500/10"
              >
                Hapus semua lokasiku
              </button>
            )}
          </section>
        </div>
      </div>

      {pickZone ? (
        <div onClick={(e) => e.stopPropagation()}>
          <LocationPicker
            zone
            title={`Titik zona ${ZONE_META[pickZone].label}`}
            defaultName={ZONE_META[pickZone].label}
            start={zones.find((z) => z.id === pickZone) ?? null}
            onClose={() => setPickZone(null)}
            onSave={async (p) => {
              const prev = zones.find((z) => z.id === pickZone);
              placePrefs.setZone({ id: pickZone, lat: p.lat, lng: p.lng, radius: prev?.radius ?? 200 });
              refreshZones();
              setPickZone(null);
              setMsg({ ok: true, text: `Zona ${ZONE_META[pickZone].label} tersimpan di perangkat ini.` });
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
