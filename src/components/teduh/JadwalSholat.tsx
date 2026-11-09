'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { LocateFixed, MapPin } from 'lucide-react';
import { currentPosition } from '@/lib/places';
import { KOTA, berikutnya, jadwal, lokasiSholat } from '@/lib/teduh/sholat';
import { cn } from '@/lib/utils';

const jam = (d: Date) => d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
const sisa = (ms: number) => {
  const m = Math.max(0, Math.ceil(ms / 60_000));
  return m >= 60 ? `${Math.floor(m / 60)} jam ${m % 60} mnt lagi` : `${m} menit lagi`;
};

// Jadwal sholat hari ini (dihitung di perangkat). Lokasi: GPS sekali atau pilih kota — hanya disimpan di HP.
export function JadwalSholat() {
  const loc = useSyncExternalStore(lokasiSholat.subscribe, lokasiSholat.get, () => null);
  const [now, setNow] = useState<Date | null>(null);
  const [pilih, setPilih] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    const tick = () => setNow(new Date());
    const t0 = setTimeout(tick, 0);
    const t = setInterval(tick, 30_000);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, []);

  const gps = async () => {
    setBusy(true);
    setErr('');
    try {
      const p = await currentPosition();
      lokasiSholat.set({ lat: p.lat, lng: p.lng, nama: 'Lokasimu' });
      setPilih(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lokasi belum bisa didapat.');
    } finally {
      setBusy(false);
    }
  };

  const picker = (
    <div className="mt-3 space-y-2">
      <button
        type="button"
        onClick={() => void gps()}
        disabled={busy}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 fs-13 font-bold text-white disabled:opacity-60"
      >
        <LocateFixed size={16} /> {busy ? 'Mencari lokasimu…' : 'Pakai lokasiku sekarang'}
      </button>
      <select
        aria-label="Pilih kota"
        value=""
        onChange={(e) => {
          const k = KOTA.find((x) => x.nama === e.target.value);
          if (k) {
            lokasiSholat.set(k);
            setPilih(false);
          }
        }}
        className="h-10 w-full rounded-xl bg-white px-3 fs-13 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
      >
        <option value="">atau pilih kota…</option>
        {KOTA.map((k) => (
          <option key={k.nama} value={k.nama}>
            {k.nama}
          </option>
        ))}
      </select>
      {err ? <p className="fs-12 font-semibold text-rose-600">{err}</p> : null}
      <p className="fs-11.5 text-slate-400">
        Lokasi hanya dipakai di perangkatmu untuk menghitung jadwal — tidak dikirim ke server.
      </p>
    </div>
  );

  if (!loc || !now)
    return (
      <section className="rounded-[24px] bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <p className="fs-14.5 font-black">🕌 Jadwal sholat</p>
        <p className="fs-12.5 text-slate-500">Atur lokasimu sekali untuk melihat waktu sholat hari ini.</p>
        {now ? picker : null}
      </section>
    );

  const hari = jadwal(loc, now);
  const next = berikutnya(loc, now);
  return (
    <section className="rounded-[24px] bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="fs-11.5 font-bold uppercase tracking-wider text-slate-400">Sholat berikutnya</p>
          <p className="fsh-24 font-black leading-tight">
            {next.nama} <span className="tabular-nums text-emerald-700 dark:text-emerald-300">{jam(next.at)}</span>
          </p>
          <p className="fs-12.5 text-slate-500">{sisa(next.at.getTime() - now.getTime())}</p>
        </div>
        <button
          type="button"
          onClick={() => setPilih((v) => !v)}
          className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-slate-100 px-3 fs-12 font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        >
          <MapPin size={13} /> {loc.nama}
        </button>
      </div>
      {pilih ? picker : null}
      <div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-7">
        {hari.map((w) => {
          const on = w.id === next.id && w.at.toDateString() === next.at.toDateString();
          const lewat = w.at < now && !on;
          return (
            <div
              key={w.id}
              className={cn(
                'rounded-xl px-1 py-2 text-center',
                on ? 'bg-emerald-600 text-white' : 'bg-slate-50 dark:bg-slate-800',
                lewat && 'opacity-50',
              )}
            >
              <p className={cn('fs-11 font-bold', on ? 'text-white/80' : 'text-slate-500')}>{w.nama}</p>
              <p className="fs-14 font-black tabular-nums">{jam(w.at)}</p>
            </div>
          );
        })}
      </div>
      <p className="mt-2 fs-11 text-slate-400">
        Perkiraan dengan metode Kemenag (Subuh 20°, Isya 18°). Ikuti jadwal resmi masjid setempat.
      </p>
    </section>
  );
}
