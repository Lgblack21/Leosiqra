"use client";

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronDown, Eye, EyeOff, Gem, Layers, Plus, RefreshCw, Search } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { CollectibleEditor } from '@/components/koleksi/CollectibleEditor';
import { collectibleService } from '@/lib/services/collectibleService';
import { exchangeRateService, type ExchangeRates } from '@/lib/services/exchangeRateService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { tcgImage, unitValueIdr, variantLabel, type Collectible, type HistoryPoint } from '@/lib/collectibles';
import { cn, formatIDR } from '@/lib/utils';

// Koleksiku: koleksi bernilai pasar (kartu Pokémon via TCGdex, lainnya manual).
// Dipakai tab Kekayaan web (variant "web") & /app/koleksi (variant "app").

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
  { id: 'lainnya', label: 'Lainnya' },
] as const;
const short = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e9) return `Rp${(a / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`;
  if (a >= 1e6) return `Rp${(a / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
  if (a >= 1e3) return `Rp${Math.round(a / 1e3)} rb`;
  return formatIDR(Math.round(a));
};

export function KoleksiView({ variant, addSignal = 0, toast }: { variant: 'web' | 'app'; addSignal?: number; toast?: (m: string) => void }) {
  const [items, setItems] = useState<Collectible[] | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [rates, setRates] = useState<ExchangeRates>({});
  const [error, setError] = useState('');
  const [hidden, setHidden] = useState(false);
  const [kind, setKind] = useState<(typeof KINDS)[number]['id']>('semua');
  const [sort, setSort] = useState<SortId>('nilai');
  const [q, setQ] = useState('');
  const [editor, setEditor] = useState<{ item?: Collectible } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [flash, setFlash] = useState('');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- preferensi lokal baru terbaca setelah hydrate (static export)
    try { setHidden(localStorage.getItem(HIDE_KEY) === '1'); } catch { /* diblokir */ }
    let alive = true;
    const load = () => collectibleService.list().then((r) => { if (alive) { setItems(r.items); setHistory(r.history); setError(''); } }).catch((e) => { if (alive) { setItems((p) => p ?? []); setError(e instanceof Error ? e.message : 'Gagal memuat koleksi.'); } });
    exchangeRateService.getLatestRates().then((r) => alive && setRates(r)).catch(() => undefined);
    load().then(() => {
      // Perbarui harga kartu yang sudah lama + catat titik grafik hari ini.
      if (!alive) return;
      setRefreshing(true);
      collectibleService.refresh().then(() => { if (alive) void load(); }).catch(() => undefined).finally(() => alive && setRefreshing(false));
    });
    const unsub = subscribeToCollectionChanges('collectibles', load);
    return () => { alive = false; unsub(); };
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sinyal "Tambah" dari header Kekayaan
    if (addSignal > 0) setEditor({});
  }, [addSignal]);

  const toggleHidden = () => setHidden((h) => { try { localStorage.setItem(HIDE_KEY, h ? '0' : '1'); } catch { /* abaikan */ } return !h; });
  const money = (n: number) => (hidden ? 'Rp ••••' : formatIDR(Math.round(n)));

  const enriched = useMemo(() => (items ?? []).map((it) => {
    const unit = unitValueIdr(it, rates);
    const value = unit * it.quantity;
    const cost = it.purchasePrice * it.quantity;
    return { it, unit, value, cost, gain: value - cost };
  }), [items, rates]);
  const totalValue = enriched.reduce((s, e) => s + e.value, 0);
  const totalCost = enriched.reduce((s, e) => s + e.cost, 0);
  const totalGain = totalValue - totalCost;
  const totalQty = enriched.reduce((s, e) => s + e.it.quantity, 0);
  const gainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : null;
  const lastUpdate = enriched.map((e) => e.it.marketUpdatedAt).filter(Boolean).sort().pop();

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return enriched
      .filter((e) => kind === 'semua' || e.it.kind === kind)
      .filter((e) => !needle || [e.it.name, e.it.setName, e.it.number, e.it.note].some((s) => s?.toLowerCase().includes(needle)))
      .sort((a, b) => sort === 'nilai' ? b.value - a.value : sort === 'untung' ? b.gain - a.gain : sort === 'nama' ? a.it.name.localeCompare(b.it.name, 'id') : b.it.createdAt.localeCompare(a.it.createdAt));
  }, [enriched, kind, sort, q]);

  const done = (msg: string) => {
    setEditor(null);
    if (toast) toast(msg);
    else { setFlash(msg); window.setTimeout(() => setFlash(''), 3500); }
  };
  const app = variant === 'app';
  const card = app ? 'rounded-3xl bg-white ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800' : 'rounded-[26px] bg-white ring-1 ring-slate-100';
  const editorBody = editor && <CollectibleEditor key={editor.item?.id ?? 'baru'} item={editor.item} rates={rates} onDone={done} />;
  const editorTitle = editor?.item ? 'Ubah koleksi' : 'Tambah koleksi';

  if (items === null) {
    return <div className="space-y-3"><div className="h-48 animate-pulse rounded-[28px] bg-slate-200/70 dark:bg-slate-800" /><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[1, 2, 3, 4].map((i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-3xl bg-white dark:bg-slate-900" />)}</div></div>;
  }

  return (
    <div className="space-y-4">
      {flash && <div role="status" className="rounded-2xl bg-emerald-50 px-4 py-3 text-[13px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{flash}</div>}
      {error && <div role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</div>}

      {/* Ringkasan nilai */}
      <section className="web-keep relative overflow-hidden rounded-[28px] bg-[radial-gradient(120%_130%_at_0%_0%,#3b0764_0%,#0b1220_60%)] p-5 text-white md:p-6">
        <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-fuchsia-400/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-white/60">
              Nilai koleksimu
              <button type="button" onClick={toggleHidden} aria-label={hidden ? 'Tampilkan angka' : 'Sembunyikan angka'} className="rounded-full p-1 text-white/60 hover:bg-white/10 hover:text-white">{hidden ? <EyeOff size={15} /> : <Eye size={15} />}</button>
            </p>
            <p className="mt-1 text-[34px] font-extrabold leading-none tracking-tight tabular-nums md:text-[44px]">{money(totalValue)}</p>
            {totalCost > 0 ? (
              <p className={cn('mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold tabular-nums', totalGain >= 0 ? 'bg-emerald-400/15 text-emerald-300' : 'bg-rose-400/15 text-rose-300')}>
                {totalGain >= 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                {hidden ? '••••' : `${totalGain >= 0 ? '+' : '−'}${short(totalGain)}`}{gainPct != null && ` (${totalGain >= 0 ? '+' : '−'}${Math.abs(gainPct).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%)`} dari modal {hidden ? '••••' : short(totalCost)}
              </p>
            ) : (
              <p className="mt-2 text-[13px] text-white/60">{totalQty} item · isi harga beli untuk melihat untung/rugi</p>
            )}
          </div>
          <button type="button" onClick={() => setEditor({})} className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-[13px] font-bold text-slate-900 hover:bg-white/90"><Plus size={16} strokeWidth={2.6} /> Tambah</button>
        </div>
        <Spark history={history} hidden={hidden} />
        <p className="relative mt-2 flex items-center gap-1.5 text-[11px] text-white/45">
          <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Memperbarui harga pasar…' : lastUpdate ? `Harga kartu diperbarui ${new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(lastUpdate))} · TCGplayer/Cardmarket` : 'Harga kartu Pokémon diperbarui otomatis tiap hari'}
        </p>
      </section>

      {enriched.length === 0 ? (
        <section className={cn(card, 'px-5 py-8 text-center')}>
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300"><Layers size={26} /></span>
          <h3 className="mt-4 text-[18px] font-extrabold text-slate-900 dark:text-white">Mulai Koleksiku</h3>
          <p className="mx-auto mt-1 max-w-sm text-[13px] text-slate-500 dark:text-slate-400">Kartu Pokémon mengikuti harga pasar otomatis (dalam Rupiah). Sneakers, figur, LEGO, koin — nilainya kamu isi sendiri. Semuanya ikut dihitung di kekayaan bersih.</p>
          <button type="button" onClick={() => setEditor({})} className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-5 py-2.5 text-[13px] font-bold text-white hover:bg-violet-700"><Plus size={15} /> Tambah koleksi pertama</button>
        </section>
      ) : (
        <>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-white px-4 py-2.5 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
              <Search size={16} className="shrink-0 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama, set, nomor…" aria-label="Cari koleksi" className="min-w-0 flex-1 bg-transparent text-[14px] font-medium text-slate-900 outline-none placeholder:text-slate-400 dark:text-white" />
            </label>
            <div className="flex items-center gap-2">
              <div className="flex gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800">
                {KINDS.map((k) => <button key={k.id} type="button" onClick={() => setKind(k.id)} className={cn('rounded-full px-3 py-1.5 text-[12px] font-bold', kind === k.id ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400')}>{k.label}</button>)}
              </div>
              <label className="relative">
                <select value={sort} onChange={(e) => setSort(e.target.value as SortId)} aria-label="Urutkan" className="appearance-none rounded-full bg-white py-2.5 pl-4 pr-9 text-[13px] font-bold text-slate-700 ring-1 ring-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800">
                  {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </label>
            </div>
          </div>
          {shown.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-slate-500 dark:text-slate-400">Tidak ada yang cocok.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {shown.map((e) => <li key={e.it.id}><CollectibleCard e={e} money={money} hidden={hidden} className={card} onOpen={() => setEditor({ item: e.it })} /></li>)}
            </ul>
          )}
          <p className="px-1 text-[11px] text-slate-400">Harga Pokémon: TCGplayer (USD) / Cardmarket (EUR) lewat TCGdex, dikonversi ke Rupiah — perkiraan, bukan tawaran jual. Koleksi lain memakai nilai yang kamu isi.</p>
        </>
      )}

      {app ? (
        <BottomSheet isOpen={Boolean(editor)} onClose={() => setEditor(null)} title={editorTitle}><div className="pb-[calc(env(safe-area-inset-bottom)+16px)]">{editorBody}</div></BottomSheet>
      ) : (
        <Modal isOpen={Boolean(editor)} onClose={() => setEditor(null)} title={editorTitle} maxWidth="max-w-lg">{editorBody}</Modal>
      )}
    </div>
  );
}

function CollectibleCard({ e, money, hidden, className, onOpen }: { e: { it: Collectible; value: number; cost: number; gain: number }; money: (n: number) => string; hidden: boolean; className: string; onOpen: () => void }) {
  const { it, value, cost, gain } = e;
  const [broken, setBroken] = useState(false);
  const img = it.kind === 'pokemon' ? tcgImage(it.imageUrl) : it.hasPhoto ? collectibleService.photoUrl(it) : null;
  const pct = cost > 0 ? (gain / cost) * 100 : null;
  return (
    <button type="button" onClick={onOpen} className={cn(className, 'group flex w-full flex-col overflow-hidden text-left transition-transform active:scale-[0.98]')}>
      <span className={cn('relative flex w-full items-center justify-center overflow-hidden', it.kind === 'pokemon' ? 'aspect-[3/4] bg-gradient-to-b from-slate-100 to-slate-200 p-3 dark:from-slate-800 dark:to-slate-900' : 'aspect-square bg-slate-50 dark:bg-slate-800')}>
        {img && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element -- kartu TCGdex / foto privat
          <img src={img} alt={it.name} loading="lazy" onError={() => setBroken(true)} className={cn('transition-transform duration-300 group-hover:scale-[1.04]', it.kind === 'pokemon' ? 'h-full w-auto rounded-lg object-contain shadow-lg' : 'h-full w-full object-cover')} />
        ) : (
          <Gem size={40} strokeWidth={1.4} className="text-violet-400" />
        )}
        {it.quantity > 1 && <span className="absolute right-2 top-2 rounded-full bg-slate-900/80 px-2 py-0.5 text-[11px] font-extrabold text-white">×{it.quantity}</span>}
        {it.grade && <span className="absolute left-2 top-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-extrabold text-amber-950">{it.grade}</span>}
      </span>
      <span className="block p-3">
        <span className="block truncate text-[14px] font-bold text-slate-900 dark:text-white">{it.name}</span>
        <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">{it.kind === 'pokemon' ? [it.setName, it.number && `#${it.number}`, variantLabel(it.variant)].filter(Boolean).join(' · ') : it.condition ?? 'Koleksi'}</span>
        <span className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-2">
          <span className="text-[14px] font-extrabold tabular-nums text-slate-900 dark:text-white">{money(value)}</span>
          {pct != null && !hidden && <span className={cn('shrink-0 text-[11px] font-bold tabular-nums', gain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>{gain >= 0 ? '+' : '−'}{Math.abs(pct).toLocaleString('id-ID', { maximumFractionDigits: 0 })}%</span>}
        </span>
      </span>
    </button>
  );
}

// Jejak nilai koleksi (titik per hari Koleksiku dibuka).
function Spark({ history, hidden }: { history: HistoryPoint[]; hidden: boolean }) {
  if (history.length < 2) {
    return <p className="relative mt-4 rounded-2xl bg-white/[0.06] px-3 py-2.5 text-[12px] text-white/55">Grafik nilai muncul setelah beberapa hari — tiap kali Koleksiku dibuka, nilainya dicatat.</p>;
  }
  const W = 600;
  const H = 90;
  const vals = history.map((h) => h.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const pts = history.map((h, i) => [(i / (history.length - 1)) * W, H - 8 - ((h.value - min) / span) * (H - 16)] as const);
  const up = vals[vals.length - 1] >= vals[0];
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const fmt = (d: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`));
  return (
    <div className="relative mt-4">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-[80px] w-full" aria-hidden>
        <defs>
          <linearGradient id="kol-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={up ? '#34d399' : '#fb7185'} stopOpacity="0.35" /><stop offset="100%" stopColor={up ? '#34d399' : '#fb7185'} stopOpacity="0" /></linearGradient>
        </defs>
        <path d={`${line} L${W},${H} L0,${H} Z`} fill="url(#kol-fill)" />
        <path d={line} fill="none" stroke={up ? '#34d399' : '#fb7185'} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <div className="flex justify-between text-[10px] text-white/40"><span>{fmt(history[0].day)}</span><span>{hidden ? '' : `tertinggi ${short(max)}`}</span><span>{fmt(history[history.length - 1].day)}</span></div>
    </div>
  );
}
