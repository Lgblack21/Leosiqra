'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MapPin, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import type { Map as MlMap } from 'maplibre-gl';
import { PlaceMap, type MapLib, type MapMarker } from '@/components/peta/PlaceMap';
import { JejakPanel, useReplay } from '@/components/peta/JejakView';
import { LocationSettings } from '@/components/peta/LocationSettings';
import { LocationPicker, type PickedPlace } from '@/components/peta/LocationPicker';
import { dayTrips, groupPlaces, idrOf, placeService, type Place, type PlacedTx } from '@/lib/places';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { categoryVisual } from '@/lib/categoryEmoji';
import { rp, short } from '@/lib/kanvas/data';
import { isInvestmentFlow } from '@/lib/utils';
import { cn } from '@/lib/utils';

const PERIODS = [
  { days: 30, label: '30 hari' },
  { days: 90, label: '3 bulan' },
  { days: 365, label: '1 tahun' },
];
const dShort = (iso: string) => new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
const sinceIso = (days: number) => new Date(Date.now() - days * 86400_000).toISOString();

// Peta Belanja: ke mana uangmu dibelanjakan, dari lokasi yang kamu tandai sendiri.
export function PetaApp({ variant = 'web' }: { variant?: 'web' | 'app' }) {
  const [items, setItems] = useState<PlacedTx[] | null>(null);
  const [ready, setReady] = useState(true);
  const [txs, setTxs] = useState<Transaction[] | null>(null);
  const [days, setDays] = useState(30);
  const [cat, setCat] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom?: number; seq: number } | null>(null);
  const [pick, setPick] = useState<{
    txId: string;
    title: string;
    name: string;
    start?: { lat: number; lng: number };
  } | null>(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<'peta' | 'jejak'>('peta');
  const [day, setDay] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const [mapInst, setMapInst] = useState<{ m: MlMap; ml: MapLib } | null>(null);
  const onMapReady = useCallback((m: MlMap, ml: MapLib) => setMapInst({ m, ml }), []);

  const load = useCallback(async () => {
    try {
      const r = await placeService.list(365);
      setItems(r.items);
      setReady(r.ready);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal memuat peta.');
      setItems([]);
    }
  }, []);
  useEffect(() => {
    void load();
    transactionService
      .getUserTransactions('session')
      .then(setTxs)
      .catch(() => setTxs([]));
  }, [load]);

  const inPeriod = useMemo(() => (items ?? []).filter((t) => t.date >= sinceIso(days)), [items, days]);
  const allPlaces = useMemo(() => groupPlaces(inPeriod), [inPeriod]);
  const cats = useMemo(() => {
    const m = new Map<string, number>();
    allPlaces.forEach((p) => m.set(p.category, (m.get(p.category) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [allPlaces]);
  const term = q.trim().toLowerCase();
  const places = allPlaces.filter(
    (p) =>
      (!cat || p.category === cat) &&
      (!term || `${p.name} ${p.address ?? ''} ${p.category}`.toLowerCase().includes(term)),
  );
  const total = places.reduce((s, p) => s + p.total, 0);
  const visits = places.reduce((s, p) => s + p.visits, 0);
  const langganan = [...places]
    .filter((p) => p.visits >= 2)
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 5);
  const newPlaces = places.filter((p) => p.first >= sinceIso(Math.min(days, 30))).length;
  const placed = new Set((items ?? []).map((t) => t.tx_id));
  const missing = (txs ?? [])
    .filter(
      (t) => t.id && t.type === 'pengeluaran' && !isInvestmentFlow(t) && t.relatedType !== 'debt' && !placed.has(t.id),
    )
    .filter((t) => new Date(t.date).toISOString() >= sinceIso(30))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);
  const selected = places.find((p) => p.key === sel) ?? null;

  const trips = useMemo(() => dayTrips(items ?? []), [items]);
  const trip = tab === 'jejak' ? (trips.find((t) => t.day === day) ?? trips[0] ?? null) : null;
  const replay = useReplay(trip, mapInst);
  const activeStop = replay.current ? (replay.current.kind === 'stay' ? replay.current.i : replay.current.i + 1) : -1;
  const tripMarkers: MapMarker[] = useMemo(
    () =>
      (trip?.stops ?? [])
        .map(
          (s, i): MapMarker => ({
            key: s.tx_id,
            lat: s.lat,
            lng: s.lng,
            emoji: categoryVisual(s.category, 'pengeluaran').emoji,
            label: s.time ? `${s.time} · ${short(idrOf(s))}` : short(idrOf(s)),
            order: i + 1,
            active: i === activeStop,
          }),
        )
        .concat(
          (trip?.extra ?? []).map((s) => ({
            key: s.tx_id,
            lat: s.lat,
            lng: s.lng,
            emoji: categoryVisual(s.category, 'pengeluaran').emoji,
            label: short(idrOf(s)),
            active: false,
          })),
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cukup saat hari / perhentian aktif berubah
    [trip?.day, trip?.stops.length, activeStop],
  );
  const placeMarkers: MapMarker[] = useMemo(
    () =>
      places.map((p) => ({
        key: p.key,
        lat: p.lat,
        lng: p.lng,
        emoji: categoryVisual(p.category, 'pengeluaran').emoji,
        label: short(p.total),
        count: p.visits,
        active: p.key === sel,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cukup berubah saat isi/pilihan berubah
    [places.map((p) => `${p.key}:${p.total}:${p.visits}`).join('|'), sel],
  );
  const markers = tab === 'jejak' ? tripMarkers : placeMarkers;
  const choose = useCallback(
    (key: string) => {
      setSel(key);
      const p = places.find((x) => x.key === key);
      if (p) setFocus({ lat: p.lat, lng: p.lng, seq: Date.now() });
    },
    [places],
  );

  const savePick = async (p: PickedPlace) => {
    if (!pick) return;
    await placeService.set(pick.txId, p);
    setPick(null);
    await load();
    setFocus({ lat: p.lat, lng: p.lng, zoom: 16, seq: Date.now() });
  };
  const focusStop = useCallback(
    (key: string) => {
      const st = [...(trip?.stops ?? []), ...(trip?.extra ?? [])].find((x) => x.tx_id === key);
      if (st) setFocus({ lat: st.lat, lng: st.lng, zoom: 16, seq: Date.now() });
    },
    [trip],
  );
  const removePlace = async (txId: string) => {
    try {
      await placeService.remove(txId);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menghapus lokasi.');
    }
  };

  const placePanel = (
    <div className="space-y-5">
      {!ready ? (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-800">
          Peta Belanja sedang disiapkan di server. Coba lagi sebentar lagi.
        </p>
      ) : null}
      {err ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-700">{err}</p> : null}

      <div className="flex gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800">
        {PERIODS.map((p) => (
          <button
            key={p.days}
            type="button"
            onClick={() => setDays(p.days)}
            className={cn(
              'h-9 flex-1 rounded-full text-[13px] font-bold',
              days === p.days ? 'bg-white shadow-sm dark:bg-slate-950' : 'text-slate-500',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="rounded-[22px] bg-gradient-to-br from-indigo-600 to-violet-600 p-4 text-white">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/70">
          Belanja di peta · {PERIODS.find((p) => p.days === days)?.label}
        </p>
        <p className="mt-1 text-[28px] font-black leading-tight tabular-nums">{rp(total)}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] font-semibold text-white/85">
          <span>{places.length} tempat</span>
          <span>{visits} kunjungan</span>
          <span>{newPlaces} tempat baru</span>
        </div>
      </div>

      <label className="flex h-11 items-center gap-2 rounded-2xl bg-white px-3 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
        <Search size={17} className="text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari tempat atau kategori"
          className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none"
        />
      </label>

      {cats.length > 1 ? (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          <button
            type="button"
            onClick={() => setCat(null)}
            className={cn(
              'h-9 shrink-0 rounded-full px-3.5 text-[13px] font-bold',
              !cat
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
            )}
          >
            Semua {allPlaces.length}
          </button>
          {cats.map(([c, n]) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c === cat ? null : c)}
              className={cn(
                'h-9 shrink-0 rounded-full px-3.5 text-[13px] font-bold',
                cat === c
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
              )}
            >
              {categoryVisual(c, 'pengeluaran').emoji} {c} {n}
            </button>
          ))}
        </div>
      ) : null}

      {selected ? (
        <SelectedPlace
          p={selected}
          onClose={() => setSel(null)}
          onEdit={(t) =>
            setPick({
              txId: t.tx_id,
              title: t.note || t.category,
              name: t.name ?? '',
              start: { lat: t.lat, lng: t.lng },
            })
          }
          onRemove={(t) => void removePlace(t.tx_id)}
        />
      ) : null}

      {langganan.length ? (
        <section>
          <h2 className="mb-2 text-[15px] font-black">Tempat langgananmu</h2>
          <PlaceList list={langganan} onPick={choose} sel={sel} sub={(p) => `${p.visits}× ke sini`} />
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-[15px] font-black">Semua tempat</h2>
        {items === null ? (
          <p className="text-[13px] text-slate-400">Memuat…</p>
        ) : places.length ? (
          <PlaceList list={places} onPick={choose} sel={sel} sub={(p) => `${p.visits}× · terakhir ${dShort(p.last)}`} />
        ) : (
          <div className="rounded-2xl bg-slate-50 p-4 text-center dark:bg-slate-900">
            <MapPin size={22} className="mx-auto text-slate-400" />
            <p className="mt-1 text-[14px] font-bold">Belum ada tempat di petamu</p>
            <p className="text-[12.5px] text-slate-500">
              Tandai lokasi transaksi di bawah, atau ketuk 📍 saat mencatat pengeluaran.
            </p>
          </div>
        )}
      </section>

      {missing.length ? (
        <section>
          <h2 className="text-[15px] font-black">Lengkapi lokasi</h2>
          <p className="mb-2 text-[12.5px] text-slate-500">Pengeluaran 30 hari terakhir yang belum punya tempat.</p>
          <div className="space-y-1.5">
            {missing.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setPick({ txId: t.id!, title: t.note || t.category, name: t.note || '' })}
                className="flex w-full items-center gap-3 rounded-2xl bg-white px-3 py-2.5 text-left ring-1 ring-slate-200 hover:ring-slate-300 dark:bg-slate-900 dark:ring-slate-800"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[17px] dark:bg-slate-800">
                  {categoryVisual(t.category, 'pengeluaran').emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-bold">{t.note || t.category}</span>
                  <span className="block text-[12px] text-slate-500">
                    {dShort(new Date(t.date).toISOString())} · {rp(Number(t.amountIDR) || Number(t.amount) || 0)}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-[12px] font-bold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                  📍 Tandai
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <p className="text-[11.5px] leading-relaxed text-slate-400">
        Lokasi hanya tersimpan saat kamu menandainya atau saat mencatat dengan lokasi otomatis — tidak ada pelacakan di
        latar belakang. Atur di 🛡️ Lokasi &amp; privasi. Data peta © kontributor OpenStreetMap.
      </p>
    </div>
  );

  const tabs = (
    <div className="flex items-center gap-2">
      <div className="flex flex-1 gap-1 rounded-full bg-slate-200/70 p-1 dark:bg-slate-800">
        {(
          [
            ['peta', 'Peta'],
            ['jejak', 'Jejak'],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={cn(
              'h-10 flex-1 rounded-full text-[14px] font-black transition-colors',
              tab === k ? 'bg-white shadow-sm dark:bg-slate-950' : 'text-slate-500',
            )}
          >
            {l}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setSettings(true)}
        aria-label="Lokasi & privasi"
        title="Lokasi & privasi"
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-emerald-700 ring-1 ring-slate-200 hover:ring-emerald-300 dark:bg-slate-900 dark:text-emerald-300 dark:ring-slate-700"
      >
        <ShieldCheck size={20} />
      </button>
    </div>
  );
  const panel = (
    <div className="space-y-5">
      {tabs}
      {tab === 'peta' ? (
        placePanel
      ) : (
        <JejakPanel
          trips={trips}
          trip={trip}
          onDay={setDay}
          replay={replay}
          onStop={(i) => trip && focusStop(trip.stops[i].tx_id)}
          onFocus={focusStop}
        />
      )}
    </div>
  );

  const map = (
    <div className="relative h-full w-full">
      <PlaceMap
        markers={markers}
        onMarker={tab === 'jejak' ? focusStop : choose}
        focus={focus}
        fitKey={tab === 'jejak' ? `j:${trip?.day ?? ''}` : 'peta'}
        onMapReady={onMapReady}
      />
      {replay.hud}
    </div>
  );
  return (
    <div
      className={cn(
        'text-slate-900 dark:text-white',
        variant === 'app' && 'fixed inset-0 z-40 flex flex-col bg-[#f6f5f1] dark:bg-slate-950',
      )}
    >
      {variant === 'app' ? (
        <>
          <div className="flex items-center gap-3 px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))]">
            <Link
              href="/app/more"
              aria-label="Kembali"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
            >
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-[20px] font-black">Peta Belanja</h1>
          </div>
          <div className="h-[42dvh] shrink-0">{map}</div>
          <div className="flex-1 overflow-y-auto px-4 pb-10 pt-4">{panel}</div>
        </>
      ) : (
        <div className="space-y-4">
          <div>
            <h1 className="text-[26px] font-black tracking-tight md:text-[34px]">Peta Belanja</h1>
            <p className="text-[13.5px] text-slate-500 dark:text-slate-400">
              Ke mana uangmu dibelanjakan — dari lokasi yang kamu tandai sendiri.
            </p>
          </div>
          <div className="grid gap-4 lg:h-[calc(100dvh-13rem)] lg:min-h-[560px] lg:grid-cols-[400px_1fr]">
            <div className="order-2 lg:order-1 lg:overflow-y-auto lg:pr-1">{panel}</div>
            <div className="order-1 h-[45vh] overflow-hidden rounded-[26px] ring-1 ring-slate-200 lg:order-2 lg:h-full dark:ring-slate-800">
              {map}
            </div>
          </div>
        </div>
      )}
      {settings ? <LocationSettings items={items ?? []} onClose={() => setSettings(false)} onChanged={load} /> : null}
      {pick ? (
        <LocationPicker
          title={pick.title}
          defaultName={pick.name}
          start={pick.start}
          onSave={savePick}
          onClose={() => setPick(null)}
        />
      ) : null}
    </div>
  );
}

function PlaceList({
  list,
  onPick,
  sel,
  sub,
}: {
  list: Place[];
  onPick: (k: string) => void;
  sel: string | null;
  sub: (p: Place) => string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
      {list.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => onPick(p.key)}
          className={cn(
            'flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2.5 text-left last:border-0 dark:border-slate-800',
            sel === p.key ? 'bg-indigo-50 dark:bg-indigo-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50',
          )}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[18px] dark:bg-slate-800">
            {categoryVisual(p.category, 'pengeluaran').emoji}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-bold">{p.name}</span>
            <span className="block truncate text-[12px] text-slate-500">{sub(p)}</span>
          </span>
          <span className="shrink-0 text-[14px] font-black tabular-nums">{short(p.total)}</span>
        </button>
      ))}
    </div>
  );
}

function SelectedPlace({
  p,
  onClose,
  onEdit,
  onRemove,
}: {
  p: Place;
  onClose: () => void;
  onEdit: (t: PlacedTx) => void;
  onRemove: (t: PlacedTx) => void;
}) {
  return (
    <div className="rounded-[22px] bg-white p-4 ring-2 ring-orange-300 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <span className="text-[26px]">{categoryVisual(p.category, 'pengeluaran').emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-black">{p.name}</p>
          {p.address ? <p className="line-clamp-2 text-[12px] text-slate-500">{p.address}</p> : null}
          <p className="mt-0.5 text-[12.5px] font-semibold text-slate-600 dark:text-slate-300">
            {rp(p.total)} · {p.visits}× kunjungan · rata-rata {short(p.total / p.visits)}
          </p>
        </div>
        <button
          type="button"
          aria-label="Tutup"
          onClick={onClose}
          className="rounded-full p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X size={17} />
        </button>
      </div>
      <div className="mt-3 space-y-1">
        {p.txs.slice(0, 8).map((t) => (
          <div
            key={t.tx_id}
            className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[12.5px] dark:bg-slate-800/60"
          >
            <span className="w-14 shrink-0 text-slate-500">{dShort(t.date)}</span>
            <span className="min-w-0 flex-1 truncate font-semibold">{t.note || t.category}</span>
            <span className="font-bold tabular-nums">{rp(idrOf(t))}</span>
            <button
              type="button"
              aria-label="Ubah lokasi"
              onClick={() => onEdit(t)}
              className="rounded-md p-1 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
            >
              <MapPin size={14} />
            </button>
            <button
              type="button"
              aria-label="Hapus lokasi"
              onClick={() => onRemove(t)}
              className="rounded-md p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
