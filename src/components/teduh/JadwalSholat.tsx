'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { LocateFixed, MapPin, Search } from 'lucide-react';
import { currentPosition } from '@/lib/places';
import {
  KOTA,
  berikutnyaDari,
  jadwal,
  lokasiSholat,
  sholatApi,
  waktuDariBaris,
  type BarisJadwal,
  type KotaApi,
  type LokasiSholat,
  type Waktu,
} from '@/lib/teduh/sholat';
import { cn } from '@/lib/utils';

const jam = (d: Date) => d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
const sisa = (ms: number) => {
  const m = Math.max(0, Math.ceil(ms / 60_000));
  return m >= 60 ? `${Math.floor(m / 60)} jam ${m % 60} mnt lagi` : `${m} menit lagi`;
};
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const norm = (v: string) =>
  v
    .toLowerCase()
    .replace(/^(kota|kab\.?|kabupaten)\s+/, '')
    .replace(/[^a-z0-9]/g, '');

// Jadwal sholat hari ini.
// - Kab/kota dari daftar API Indonesia → jadwal resmi Kemenag (disimpan per bulan di perangkat).
// - GPS / kota bawaan → dihitung di perangkat (metode Kemenag, ±1 menit). Lokasi hanya di HP.
export function JadwalSholat() {
  const loc = useSyncExternalStore(lokasiSholat.subscribe, lokasiSholat.get, () => null);
  const [now, setNow] = useState<Date | null>(null);
  const [pilih, setPilih] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [rows, setRows] = useState<{ key: string; list: BarisJadwal[] } | null>(null);
  const [apiErr, setApiErr] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const t0 = setTimeout(tick, 0);
    const t = setInterval(tick, 30_000);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, []);

  // Jadwal resmi: bulan ini + bulan depan (untuk Subuh besok di akhir bulan).
  const monthKey = now ? `${loc?.kotaId}|${now.getFullYear()}-${now.getMonth() + 1}` : '';
  useEffect(() => {
    if (!loc?.kotaId || !now) return;
    let alive = true;
    const a = new Date(now.getFullYear(), now.getMonth(), 1);
    const b = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    Promise.all([
      sholatApi.bulan(loc.kotaId, a.getFullYear(), a.getMonth() + 1),
      sholatApi.bulan(loc.kotaId, b.getFullYear(), b.getMonth() + 1).catch(() => [] as BarisJadwal[]),
    ])
      .then(([x, y]) => {
        if (!alive) return;
        setRows({ key: monthKey, list: [...x, ...y] });
        setApiErr(null);
      })
      .catch((e) => alive && setApiErr(e instanceof Error ? e.message : 'Jadwal belum bisa dimuat.'));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cukup saat kota/bulan berganti
  }, [monthKey]);

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
  const pilihKota = (v: LokasiSholat) => {
    lokasiSholat.set(v);
    setPilih(false);
  };

  // Waktu hari ini & besok — dari API (resmi) atau hitungan perangkat.
  let hari: Waktu[] = [];
  let besok: Waktu[] = [];
  let resmi = false;
  if (loc && now) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const r = loc.kotaId && rows?.key === monthKey ? rows.list : null;
    const rToday = r?.find((x) => x.date === ymd(now));
    if (rToday) {
      hari = waktuDariBaris(rToday);
      const rTom = r?.find((x) => x.date === ymd(tomorrow));
      besok = rTom ? waktuDariBaris(rTom) : [];
      resmi = true;
    } else if (loc.lat !== undefined && loc.lng !== undefined && (!loc.kotaId || apiErr)) {
      const xy = { lat: loc.lat, lng: loc.lng };
      hari = jadwal(xy, now);
      besok = jadwal(xy, tomorrow);
    }
  }
  const next = now && hari.length ? berikutnyaDari(hari, besok, now) : null;

  const picker = <Picker busy={busy} err={err} onGps={() => void gps()} onPick={pilihKota} />;

  if (!loc || !now)
    return (
      <section className="rounded-[24px] bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <p className="fs-14.5 font-black">🕌 Jadwal sholat</p>
        <p className="fs-12.5 text-slate-500">Pilih kab/kotamu sekali untuk melihat waktu sholat hari ini.</p>
        {now ? picker : null}
      </section>
    );

  return (
    <section className="rounded-[24px] bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="fs-11.5 font-bold uppercase tracking-wider text-slate-400">Sholat berikutnya</p>
          {next ? (
            <>
              <p className="fsh-24 font-black leading-tight">
                {next.nama} <span className="tabular-nums text-emerald-700 dark:text-emerald-300">{jam(next.at)}</span>
              </p>
              <p className="fs-12.5 text-slate-500">{sisa(next.at.getTime() - now.getTime())}</p>
            </>
          ) : (
            <p className="mt-1 fs-13 text-slate-500">
              {apiErr ? 'Jadwal belum bisa dimuat — coba lagi nanti atau pakai lokasimu.' : 'Memuat jadwal…'}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setPilih((v) => !v)}
          className="flex h-9 max-w-[45%] shrink-0 items-center gap-1 rounded-full bg-slate-100 px-3 fs-12 font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        >
          <MapPin size={13} className="shrink-0" /> <span className="truncate">{loc.nama}</span>
        </button>
      </div>
      {pilih ? picker : null}
      {hari.length ? (
        <div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-7">
          {hari.map((w) => {
            const on = next && w.id === next.id && w.at.getTime() === next.at.getTime();
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
      ) : null}
      <p className="mt-2 fs-11 text-slate-400">
        {resmi
          ? 'Jadwal resmi Kemenag untuk kab/kota ini (via API Indonesia).'
          : 'Perkiraan dengan metode Kemenag (Subuh 20°, Isya 18°), dihitung di perangkatmu. Ikuti jadwal resmi masjid setempat.'}
      </p>
    </section>
  );
}

function Picker({
  busy,
  err,
  onGps,
  onPick,
}: {
  busy: boolean;
  err: string;
  onGps: () => void;
  onPick: (v: LokasiSholat) => void;
}) {
  const [kota, setKota] = useState<KotaApi[] | null>(null);
  const [gagal, setGagal] = useState(false);
  const [q, setQ] = useState('');
  useEffect(() => {
    let alive = true;
    sholatApi
      .kota()
      .then((k) => alive && setKota(k))
      .catch(() => alive && setGagal(true));
    return () => {
      alive = false;
    };
  }, []);
  const hasil = useMemo(() => {
    const k = norm(q);
    if (!kota || k.length < 2) return [];
    return kota.filter((x) => norm(x.nama).includes(k)).slice(0, 8);
  }, [kota, q]);
  return (
    <div className="mt-3 space-y-2">
      {kota ? (
        <>
          <label className="flex h-10 items-center gap-2 rounded-xl bg-slate-50 px-3 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
            <Search size={15} className="text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari kab/kota, mis. Bogor"
              className="h-full min-w-0 flex-1 bg-transparent fs-13 outline-none"
            />
          </label>
          {hasil.length ? (
            <div className="overflow-hidden rounded-xl ring-1 ring-slate-200 dark:ring-slate-700">
              {hasil.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => {
                    const bawaan = KOTA.find((x) => norm(x.nama) === norm(k.nama));
                    onPick({ nama: k.nama, kotaId: k.id, ...(bawaan ? { lat: bawaan.lat, lng: bawaan.lng } : {}) });
                  }}
                  className="block w-full border-b border-slate-100 px-3 py-2 text-left last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                >
                  <span className="block fs-13 font-bold">{k.nama}</span>
                  <span className="block fs-11.5 text-slate-500">{k.provinsi}</span>
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <select
          aria-label="Pilih kota"
          value=""
          onChange={(e) => {
            const k = KOTA.find((x) => x.nama === e.target.value);
            if (k) onPick(k);
          }}
          className="h-10 w-full rounded-xl bg-white px-3 fs-13 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
        >
          <option value="">{gagal ? 'Pilih kota…' : 'Memuat daftar kab/kota…'}</option>
          {KOTA.map((k) => (
            <option key={k.nama} value={k.nama}>
              {k.nama}
            </option>
          ))}
        </select>
      )}
      <button
        type="button"
        onClick={onGps}
        disabled={busy}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 fs-13 font-bold text-white disabled:opacity-60"
      >
        <LocateFixed size={16} /> {busy ? 'Mencari lokasimu…' : 'Pakai lokasiku sekarang'}
      </button>
      {err ? <p className="fs-12 font-semibold text-rose-600">{err}</p> : null}
      <p className="fs-11.5 text-slate-400">Lokasi hanya disimpan di perangkatmu.</p>
    </div>
  );
}
