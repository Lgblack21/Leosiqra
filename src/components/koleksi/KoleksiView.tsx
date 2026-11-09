'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  Eye,
  EyeOff,
  Gem,
  Layers,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { CollectibleEditor } from '@/components/koleksi/CollectibleEditor';
import { collectibleService } from '@/lib/services/collectibleService';
import { exchangeRateService, type ExchangeRates } from '@/lib/services/exchangeRateService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import {
  marketImage,
  unitValueIdr,
  variantLabel,
  type Collectible,
  type CollectibleSet,
  type HistoryPoint,
  type SteamLink,
} from '@/lib/collectibles';
import { cn, formatIDR } from '@/lib/utils';

const HIDE_KEY = 'leosiqra-hide-balance';
const SORTS = [
  { id: 'nilai', label: 'Nilai tertinggi' },
  { id: 'untung', label: 'Untung terbesar' },
  { id: 'baru', label: 'Terbaru' },
  { id: 'nama', label: 'Nama A–Z' },
] as const;
type SortId = (typeof SORTS)[number]['id'];
const KINDS = [
  { id: 'semua', label: 'Semua' },
  { id: 'pokemon', label: 'Pokémon' },
  { id: 'steam', label: 'Steam' },
  { id: 'lainnya', label: 'Lainnya' },
] as const;
const short = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e9) return `Rp${(a / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`;
  if (a >= 1e6) return `Rp${(a / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
  if (a >= 1e3) return `Rp${Math.round(a / 1e3)} rb`;
  return formatIDR(Math.round(a));
};

export function KoleksiView({
  variant,
  addSignal = 0,
  toast,
}: {
  variant: 'web' | 'app';
  addSignal?: number;
  toast?: (m: string) => void;
}) {
  const [items, setItems] = useState<Collectible[] | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [steam, setSteam] = useState<SteamLink | null>(null);
  const [sets, setSets] = useState<CollectibleSet[]>([]);
  const [rates, setRates] = useState<ExchangeRates>({});
  const [error, setError] = useState('');
  const [hidden, setHidden] = useState(false);
  const [kind, setKind] = useState<(typeof KINDS)[number]['id']>('semua');
  const [sort, setSort] = useState<SortId>('nilai');
  const [q, setQ] = useState('');
  const [editor, setEditor] = useState<{ item?: Collectible; steam?: boolean } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [flash, setFlash] = useState('');

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- preferensi lokal baru terbaca setelah hydrate (static export)
      setHidden(localStorage.getItem(HIDE_KEY) === '1');
    } catch {
      /* diblokir */
    }
    let alive = true;
    const load = () =>
      collectibleService
        .list()
        .then((r) => {
          if (!alive) return;
          setItems(r.items);
          setHistory(r.history);
          setSteam(r.steam);
          setError('');
          // Progres set Pokémon (kartu unik dimiliki vs jumlah resmi set).
          if (r.items.some((i) => i.kind === 'pokemon'))
            collectibleService
              .pokemonSets()
              .then((s) => alive && setSets(s))
              .catch(() => undefined);
          else setSets([]);
        })
        .catch((e) => {
          if (alive) {
            setItems((p) => p ?? []);
            setError(e instanceof Error ? e.message : 'Gagal memuat koleksi.');
          }
        });
    exchangeRateService
      .getLatestRates()
      .then((r) => alive && setRates(r))
      .catch(() => undefined);
    load().then(() => {
      // Perbarui harga kartu yang sudah lama + catat titik grafik hari ini.
      if (!alive) return;
      setRefreshing(true);
      collectibleService
        .refresh()
        .then(() => {
          if (alive) void load();
        })
        .catch(() => undefined)
        .finally(() => alive && setRefreshing(false));
    });
    const unsub = subscribeToCollectionChanges('collectibles', load);
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sinyal "Tambah" dari header Kekayaan
    if (addSignal > 0) setEditor({});
  }, [addSignal]);

  const toggleHidden = () =>
    setHidden((h) => {
      try {
        localStorage.setItem(HIDE_KEY, h ? '0' : '1');
      } catch {
        /* abaikan */
      }
      return !h;
    });
  const money = (n: number) => (hidden ? 'Rp ••••' : formatIDR(Math.round(n)));

  const enriched = useMemo(
    () =>
      (items ?? []).map((it) => {
        const unit = unitValueIdr(it, rates);
        const value = unit * it.quantity;
        const cost = it.purchasePrice * it.quantity;
        return { it, unit, value, cost, gain: value - cost };
      }),
    [items, rates],
  );
  const totalValue = enriched.reduce((s, e) => s + e.value, 0);
  const totalCost = enriched.reduce((s, e) => s + e.cost, 0);
  const totalGain = totalValue - totalCost;
  const totalQty = enriched.reduce((s, e) => s + e.it.quantity, 0);
  const gainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : null;
  const lastUpdate = enriched
    .map((e) => e.it.marketUpdatedAt)
    .filter(Boolean)
    .sort()
    .pop();

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return enriched
      .filter((e) => kind === 'semua' || e.it.kind === kind)
      .filter(
        (e) =>
          !needle || [e.it.name, e.it.setName, e.it.number, e.it.note].some((s) => s?.toLowerCase().includes(needle)),
      )
      .sort((a, b) =>
        sort === 'nilai'
          ? b.value - a.value
          : sort === 'untung'
            ? b.gain - a.gain
            : sort === 'nama'
              ? a.it.name.localeCompare(b.it.name, 'id')
              : b.it.createdAt.localeCompare(a.it.createdAt),
      );
  }, [enriched, kind, sort, q]);

  const done = (msg: string) => {
    setEditor(null);
    if (toast) toast(msg);
    else {
      setFlash(msg);
      window.setTimeout(() => setFlash(''), 3500);
    }
  };
  const app = variant === 'app';
  const card = app
    ? 'rounded-3xl bg-white ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800'
    : 'rounded-[26px] bg-white ring-1 ring-slate-100';
  const editorBody = editor && (
    <CollectibleEditor
      key={editor.item?.id ?? (editor.steam ? 'steam' : 'baru')}
      item={editor.item}
      rates={rates}
      steam={steam}
      startSteam={editor.steam}
      onDone={done}
    />
  );
  const editorTitle = editor?.item ? 'Ubah koleksi' : editor?.steam ? 'Steam' : 'Tambah koleksi';
  const kinds = KINDS.filter((k) => k.id === 'semua' || enriched.some((e) => e.it.kind === k.id));

  if (items === null) {
    return (
      <div className="space-y-3">
        <div className="h-48 animate-pulse rounded-[28px] bg-slate-200/70 dark:bg-slate-800" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-3xl bg-white dark:bg-slate-900" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {flash && (
        <div
          role="status"
          className="rounded-2xl bg-emerald-50 px-4 py-3 fs-13 font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
        >
          {flash}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-2xl bg-rose-50 px-4 py-3 fs-13 font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
        >
          {error}
        </div>
      )}

      <section className="web-keep relative overflow-hidden rounded-[28px] bg-[radial-gradient(120%_130%_at_0%_0%,#3b0764_0%,#0b1220_60%)] p-5 text-white md:p-6">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-fuchsia-400/10 blur-3xl"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 fs-13 font-semibold text-white/60">
              Nilai koleksimu
              <button
                type="button"
                onClick={toggleHidden}
                aria-label={hidden ? 'Tampilkan angka' : 'Sembunyikan angka'}
                className="rounded-full p-1 text-white/60 hover:bg-white/10 hover:text-white"
              >
                {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </p>
            <p className="mt-1 fsh-34 font-extrabold leading-none tracking-tight tabular-nums md:fsh-44">
              {money(totalValue)}
            </p>
            {totalCost > 0 ? (
              <p
                className={cn(
                  'mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 fs-13 font-bold tabular-nums',
                  totalGain >= 0 ? 'bg-emerald-400/15 text-emerald-300' : 'bg-rose-400/15 text-rose-300',
                )}
              >
                {totalGain >= 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                {hidden ? '••••' : `${totalGain >= 0 ? '+' : '−'}${short(totalGain)}`}
                {gainPct != null &&
                  ` (${totalGain >= 0 ? '+' : '−'}${Math.abs(gainPct).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%)`}{' '}
                dari modal {hidden ? '••••' : short(totalCost)}
              </p>
            ) : (
              <p className="mt-2 fs-13 text-white/60">{totalQty} item · isi harga beli untuk melihat untung/rugi</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setEditor({})}
            className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 fs-13 font-bold text-slate-900 hover:bg-white/90"
          >
            <Plus size={16} strokeWidth={2.6} /> Tambah
          </button>
        </div>
        <Spark history={history} hidden={hidden} />
        <p className="relative mt-2 flex items-center gap-1.5 fs-11 text-white/45">
          <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
          {refreshing
            ? 'Memperbarui harga pasar…'
            : lastUpdate
              ? `Harga pasar diperbarui ${new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(lastUpdate))}`
              : 'Harga kartu Pokémon & item Steam diperbarui otomatis tiap hari'}
        </p>
      </section>

      {steam && (
        <button
          type="button"
          onClick={() => setEditor({ steam: true })}
          className={cn(card, 'flex w-full items-center gap-3 px-4 py-3 text-left')}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 fs-18 dark:bg-slate-800">
            🎮
          </span>
          <span className="min-w-0 flex-1">
            <span className="block fs-14 font-bold text-slate-900 dark:text-white">Steam terhubung</span>
            <span className="block truncate fs-12 text-slate-500 dark:text-slate-400">
              {enriched.filter((e) => e.it.kind === 'steam').length} item CS2
              {steam.syncedAt
                ? ` · sinkron ${new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(steam.syncedAt))}`
                : ''}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 fs-12 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <RefreshCw size={13} /> Sinkron
          </span>
        </button>
      )}

      {sets.length > 0 && <SetProgress sets={sets} className={card} />}

      {enriched.length === 0 ? (
        <section className={cn(card, 'px-5 py-8 text-center')}>
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
            <Layers size={26} />
          </span>
          <h3 className="mt-4 fs-18 font-extrabold text-slate-900 dark:text-white">Mulai Koleksiku</h3>
          <p className="mx-auto mt-1 max-w-sm fs-13 text-slate-500 dark:text-slate-400">
            Kartu Pokémon & item Steam mengikuti harga pasar otomatis (dalam Rupiah). Sneakers, figur, LEGO, koin —
            nilainya kamu isi sendiri. Semuanya ikut dihitung di kekayaan bersih.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setEditor({})}
              className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-5 py-2.5 fs-13 font-bold text-white hover:bg-violet-700"
            >
              <Plus size={15} /> Tambah koleksi pertama
            </button>
            {!steam && (
              <button
                type="button"
                onClick={() => setEditor({ steam: true })}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-5 py-2.5 fs-13 font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                🎮 Impor dari Steam
              </button>
            )}
          </div>
        </section>
      ) : (
        <>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-white px-4 py-2.5 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
              <Search size={16} className="shrink-0 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari nama, set, nomor…"
                aria-label="Cari koleksi"
                className="min-w-0 flex-1 bg-transparent fs-14 font-medium text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
              />
            </label>
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-full bg-slate-100 p-1 [scrollbar-width:none] md:flex-none dark:bg-slate-800">
                {kinds.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setKind(k.id)}
                    className={cn(
                      'shrink-0 rounded-full px-3 py-1.5 fs-12 font-bold',
                      kind === k.id
                        ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                        : 'text-slate-500 dark:text-slate-400',
                    )}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
              <label className="relative shrink-0">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortId)}
                  aria-label="Urutkan"
                  className="appearance-none rounded-full bg-white py-2.5 pl-4 pr-9 fs-13 font-bold text-slate-700 ring-1 ring-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800"
                >
                  {SORTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={15}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </label>
            </div>
          </div>
          {shown.length === 0 ? (
            <p className="py-10 text-center fs-13 text-slate-500 dark:text-slate-400">Tidak ada yang cocok.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {shown.map((e) => (
                <li key={e.it.id}>
                  <CollectibleCard
                    e={e}
                    money={money}
                    hidden={hidden}
                    className={card}
                    onOpen={() => setEditor({ item: e.it })}
                  />
                </li>
              ))}
            </ul>
          )}
          <p className="px-1 fs-11 text-slate-400">
            Harga Pokémon: TCGplayer (USD) / Cardmarket (EUR) lewat TCGdex. Item Steam: median penjualan Skinport /
            Steam Market (USD). Dikonversi ke Rupiah — perkiraan, bukan tawaran jual. Koleksi lain memakai nilai yang
            kamu isi.
          </p>
        </>
      )}

      {app ? (
        <BottomSheet isOpen={Boolean(editor)} onClose={() => setEditor(null)} title={editorTitle}>
          <div className="pb-[calc(env(safe-area-inset-bottom)+16px)]">{editorBody}</div>
        </BottomSheet>
      ) : (
        <Modal isOpen={Boolean(editor)} onClose={() => setEditor(null)} title={editorTitle} maxWidth="max-w-lg">
          {editorBody}
        </Modal>
      )}
    </div>
  );
}

function CollectibleCard({
  e,
  money,
  hidden,
  className,
  onOpen,
}: {
  e: { it: Collectible; value: number; cost: number; gain: number };
  money: (n: number) => string;
  hidden: boolean;
  className: string;
  onOpen: () => void;
}) {
  const { it, value, cost, gain } = e;
  const [broken, setBroken] = useState(false);
  const img = it.kind === 'lainnya' ? (it.hasPhoto ? collectibleService.photoUrl(it) : null) : marketImage(it);
  const pct = cost > 0 ? (gain / cost) * 100 : null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        className,
        'group flex w-full flex-col overflow-hidden text-left transition-transform active:scale-[0.98]',
      )}
    >
      <span
        className={cn(
          'relative flex w-full items-center justify-center overflow-hidden',
          it.kind === 'pokemon'
            ? 'aspect-[3/4] bg-gradient-to-b from-slate-100 to-slate-200 p-3 dark:from-slate-800 dark:to-slate-900'
            : it.kind === 'steam'
              ? 'web-keep aspect-square bg-[radial-gradient(circle_at_50%_40%,#334155_0%,#0f172a_75%)] p-4'
              : 'aspect-square bg-slate-50 dark:bg-slate-800',
        )}
      >
        {img && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element -- kartu TCGdex / foto privat
          <img
            src={img}
            alt={it.name}
            loading="lazy"
            onError={() => setBroken(true)}
            className={cn(
              'transition-transform duration-300 group-hover:scale-[1.04]',
              it.kind === 'pokemon'
                ? 'h-full w-auto rounded-lg object-contain shadow-lg'
                : it.kind === 'steam'
                  ? 'h-full w-full object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]'
                  : 'h-full w-full object-cover',
            )}
          />
        ) : (
          <Gem size={40} strokeWidth={1.4} className="text-violet-400" />
        )}
        {it.quantity > 1 && (
          <span className="absolute right-2 top-2 rounded-full bg-slate-900/80 px-2 py-0.5 fs-11 font-extrabold text-white">
            ×{it.quantity}
          </span>
        )}
        {it.grade && (
          <span className="absolute left-2 top-2 rounded-full bg-amber-400 px-2 py-0.5 fs-10 font-extrabold text-amber-950">
            {it.grade}
          </span>
        )}
      </span>
      <span className="block p-3">
        <span className="block truncate fs-14 font-bold text-slate-900 dark:text-white">{it.name}</span>
        <span className="block truncate fs-11 text-slate-500 dark:text-slate-400">
          {it.kind === 'pokemon'
            ? [it.setName, it.number && `#${it.number}`, variantLabel(it.variant)].filter(Boolean).join(' · ')
            : it.kind === 'steam'
              ? (it.setName ?? 'Item CS2')
              : (it.condition ?? 'Koleksi')}
        </span>
        <span className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-2">
          {it.kind === 'steam' && it.marketPrice == null && !it.purchasePrice ? (
            <span className="fs-12 font-semibold text-slate-400">Harga menyusul</span>
          ) : (
            <span className="fs-14 font-extrabold tabular-nums text-slate-900 dark:text-white">{money(value)}</span>
          )}
          {pct != null && !hidden && (
            <span
              className={cn(
                'shrink-0 fs-11 font-bold tabular-nums',
                gain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
              )}
            >
              {gain >= 0 ? '+' : '−'}
              {Math.abs(pct).toLocaleString('id-ID', { maximumFractionDigits: 0 })}%
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

function SetProgress({ sets, className }: { sets: CollectibleSet[]; className: string }) {
  return (
    <section className={cn(className, 'p-4')}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="fs-15 font-extrabold text-slate-900 dark:text-white">Progres set</h3>
        <span className="fs-11 text-slate-400">kartu unik / jumlah resmi</span>
      </div>
      <ul className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {sets.map((s) => {
          const pct = Math.min(100, (s.owned / s.official) * 100);
          const full = s.owned >= s.official;
          return (
            <li key={s.id} className="w-[168px] shrink-0 snap-start rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <span className="flex h-10 items-center">
                {s.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- logo set dari CDN TCGdex
                  <img src={`${s.logo}.webp`} alt="" loading="lazy" className="max-h-10 max-w-[120px] object-contain" />
                ) : (
                  <span className="fsh-20">⚡</span>
                )}
              </span>
              <span className="mt-2 block truncate fs-13 font-bold text-slate-900 dark:text-white">{s.name}</span>
              <span className="mt-0.5 flex items-baseline justify-between fs-12 tabular-nums">
                <span className="font-extrabold text-slate-900 dark:text-white">
                  {s.owned}
                  <span className="font-semibold text-slate-400">/{s.official}</span>
                </span>
                <span
                  className={cn(
                    'font-bold',
                    full ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400',
                  )}
                >
                  {full ? 'Lengkap 🎉' : `${pct < 1 ? '<1' : Math.round(pct)}%`}
                </span>
              </span>
              <span
                className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={s.official}
                aria-valuenow={Math.min(s.owned, s.official)}
                aria-label={`Progres ${s.name}`}
              >
                <span
                  className={cn(
                    'block h-full rounded-full',
                    full ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-400 to-fuchsia-500',
                  )}
                  style={{ width: `${Math.max(pct, 3)}%` }}
                />
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Spark({ history, hidden }: { history: HistoryPoint[]; hidden: boolean }) {
  if (history.length < 2) {
    return (
      <p className="relative mt-4 rounded-2xl bg-white/[0.06] px-3 py-2.5 fs-12 text-white/55">
        Grafik nilai muncul setelah beberapa hari — tiap kali Koleksiku dibuka, nilainya dicatat.
      </p>
    );
  }
  const W = 600;
  const H = 90;
  const vals = history.map((h) => h.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const pts = history.map(
    (h, i) => [(i / (history.length - 1)) * W, H - 8 - ((h.value - min) / span) * (H - 16)] as const,
  );
  const up = vals[vals.length - 1] >= vals[0];
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const fmt = (d: string) =>
    new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
      new Date(`${d}T00:00:00Z`),
    );
  return (
    <div className="relative mt-4">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-[80px] w-full" aria-hidden>
        <defs>
          <linearGradient id="kol-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={up ? '#34d399' : '#fb7185'} stopOpacity="0.35" />
            <stop offset="100%" stopColor={up ? '#34d399' : '#fb7185'} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${line} L${W},${H} L0,${H} Z`} fill="url(#kol-fill)" />
        <path
          d={line}
          fill="none"
          stroke={up ? '#34d399' : '#fb7185'}
          strokeWidth="2.5"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      </svg>
      <div className="flex justify-between fs-10 text-white/40">
        <span>{fmt(history[0].day)}</span>
        <span>{hidden ? '' : `tertinggi ${short(max)}`}</span>
        <span>{fmt(history[history.length - 1].day)}</span>
      </div>
    </div>
  );
}
