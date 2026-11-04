"use client";

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Eye, EyeOff, Package, Plus, Search, ShieldAlert, TrendingDown } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ItemEditor, type EditorPreset } from '@/components/barangku/ItemEditor';
import { itemService } from '@/lib/services/itemService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { categoryMeta, itemAgeLabel, itemCurrentValue, ITEM_CATEGORIES, warrantyStatus, type Item, type ItemCategory } from '@/lib/itemValue';
import { cn, formatIDR } from '@/lib/utils';

// Barangku: daftar barang milik user + perkiraan nilai sekarang. Dipakai tab
// Kekayaan (web, variant "web") dan /app/barangku (variant "app").

const HIDE_KEY = 'leosiqra-hide-balance'; // sama dengan Rekening & Kekayaan
const SORTS = [
  { id: 'baru', label: 'Terbaru' },
  { id: 'nilai', label: 'Nilai tertinggi' },
  { id: 'garansi', label: 'Garansi terdekat' },
  { id: 'nama', label: 'Nama A–Z' },
] as const;
type SortId = (typeof SORTS)[number]['id'];
const STARTERS: EditorPreset[] = [
  { name: 'HP', category: 'Elektronik' },
  { name: 'Laptop', category: 'Elektronik' },
  { name: 'Motor', category: 'Kendaraan' },
  { name: 'Jam tangan', category: 'Jam & perhiasan' },
  { name: 'Kulkas', category: 'Rumah tangga' },
  { name: 'Sepeda', category: 'Hobi & olahraga' },
];
const short = (n: number) => {
  if (n >= 1e9) return `Rp${(n / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`;
  if (n >= 1e6) return `Rp${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
  if (n >= 1e3) return `Rp${Math.round(n / 1e3)} rb`;
  return formatIDR(n);
};

export function BarangkuView({ variant, addSignal = 0, toast }: { variant: 'web' | 'app'; addSignal?: number; toast?: (msg: string) => void }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<ItemCategory | 'Semua'>('Semua');
  const [sort, setSort] = useState<SortId>('baru');
  const [showInactive, setShowInactive] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [editor, setEditor] = useState<{ item?: Item; preset?: EditorPreset } | null>(null);
  const [flash, setFlash] = useState('');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- preferensi lokal baru terbaca setelah hydrate (static export)
    try { setHidden(localStorage.getItem(HIDE_KEY) === '1'); } catch { /* storage diblokir */ }
    let alive = true;
    const load = () =>
      itemService.list().then((v) => { if (alive) { setItems(v); setError(''); } }).catch((e) => { if (alive) { setItems((p) => p ?? []); setError(e instanceof Error ? e.message : 'Gagal memuat barang.'); } });
    load();
    const unsub = subscribeToCollectionChanges('items', load);
    return () => { alive = false; unsub(); };
  }, []);

  // Tombol "Tambah" dari luar (menu Kekayaan) membuka form baru.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sinyal dari induk (tombol Tambah di header Kekayaan)
    if (addSignal > 0) setEditor({});
  }, [addSignal]);

  const toggleHidden = () => setHidden((h) => { try { localStorage.setItem(HIDE_KEY, h ? '0' : '1'); } catch { /* abaikan */ } return !h; });
  const money = (n: number) => (hidden ? 'Rp ••••' : formatIDR(Math.round(n)));

  const enriched = useMemo(() => (items ?? []).map((it) => ({ it, value: itemCurrentValue(it), warranty: warrantyStatus(it.warrantyUntil) })), [items]);
  const active = enriched.filter((e) => e.it.status === 'aktif');
  const totalValue = active.reduce((s, e) => s + e.value, 0);
  const totalCost = active.reduce((s, e) => s + e.it.purchasePrice, 0);
  const drop = totalCost > 0 ? Math.max(0, Math.round((1 - totalValue / totalCost) * 100)) : 0;
  const soon = active.filter((e) => e.warranty?.tone === 'soon');
  const inactiveCount = enriched.length - active.length;
  const cats = ITEM_CATEGORIES.filter((c) => active.some((e) => e.it.category === c));
  const byCat = cats.map((c) => ({ c, value: active.filter((e) => e.it.category === c).reduce((s, e) => s + e.value, 0) })).sort((a, b) => b.value - a.value);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = enriched
      .filter((e) => (showInactive ? e.it.status !== 'aktif' : e.it.status === 'aktif'))
      .filter((e) => cat === 'Semua' || e.it.category === cat)
      .filter((e) => !needle || [e.it.name, e.it.brand, e.it.variant, e.it.note].some((s) => s?.toLowerCase().includes(needle)));
    const w = (e: (typeof list)[number]) => e.it.warrantyUntil && e.warranty?.tone !== 'over' ? e.it.warrantyUntil : '9999';
    return list.sort((a, b) =>
      sort === 'nilai' ? b.value - a.value : sort === 'nama' ? a.it.name.localeCompare(b.it.name, 'id') : sort === 'garansi' ? w(a).localeCompare(w(b)) : b.it.createdAt.localeCompare(a.it.createdAt)
    );
  }, [enriched, q, cat, sort, showInactive]);

  const done = (msg: string) => {
    setEditor(null);
    if (toast) toast(msg);
    else { setFlash(msg); window.setTimeout(() => setFlash(''), 3500); }
  };

  const app = variant === 'app';
  const card = app ? 'rounded-3xl bg-white ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800' : 'rounded-[26px] bg-white ring-1 ring-slate-100';

  const editorBody = editor && <ItemEditor key={editor.item?.id ?? editor.preset?.name ?? 'baru'} item={editor.item} preset={editor.preset} onDone={done} onCancel={app ? undefined : () => setEditor(null)} />;
  const editorTitle = editor?.item ? 'Ubah barang' : 'Tambah barang';

  if (items === null) {
    return (
      <div className="space-y-3">
        <div className="h-44 animate-pulse rounded-[28px] bg-slate-200/70 dark:bg-slate-800" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[1, 2, 3, 4].map((i) => <div key={i} className="aspect-[4/5] animate-pulse rounded-3xl bg-white dark:bg-slate-900" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {flash && <div role="status" className="rounded-2xl bg-emerald-50 px-4 py-3 text-[13px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{flash}</div>}
      {error && <div role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</div>}

      {/* Ringkasan nilai */}
      <section className="web-keep relative overflow-hidden rounded-[28px] bg-[radial-gradient(120%_120%_at_100%_0%,#3b2a10_0%,#111827_55%,#0b1220_100%)] p-5 text-white md:p-6">
        <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-60 w-60 rounded-full bg-amber-400/15 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-white/60">
              Nilai barangmu sekarang
              <button type="button" onClick={toggleHidden} aria-label={hidden ? 'Tampilkan angka' : 'Sembunyikan angka'} className="rounded-full p-1 text-white/60 hover:bg-white/10 hover:text-white">
                {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </p>
            <p className="mt-1 text-[34px] font-extrabold leading-none tracking-tight tabular-nums md:text-[44px]">{money(totalValue)}</p>
            <p className="mt-2 text-[13px] text-white/60">
              {active.length} barang{totalCost > 0 && <> · dibeli {hidden ? '••••' : short(totalCost)}{drop > 0 && <span className="text-amber-300"> · susut {drop}%</span>}</>}
            </p>
          </div>
          <button type="button" onClick={() => setEditor({})} className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-[13px] font-bold text-slate-900 hover:bg-white/90">
            <Plus size={16} strokeWidth={2.6} /> Tambah barang
          </button>
        </div>
        {byCat.length > 0 && totalValue > 0 && (
          <div className="relative mt-5">
            <div className="flex h-2.5 overflow-hidden rounded-full bg-white/10">
              {byCat.map(({ c, value }) => <span key={c} title={c} className="h-full" style={{ width: `${(value / totalValue) * 100}%`, background: CAT_COLOR[c] }} />)}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-white/70">
              {byCat.slice(0, 5).map(({ c, value }) => (
                <span key={c} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: CAT_COLOR[c] }} />{c} <b className="font-bold text-white">{Math.round((value / totalValue) * 100)}%</b></span>
              ))}
            </div>
          </div>
        )}
        {soon.length > 0 && (
          <p className="relative mt-4 flex items-center gap-2 rounded-2xl bg-amber-400/15 px-3 py-2 text-[12px] font-semibold text-amber-200">
            <ShieldAlert size={15} className="shrink-0" /> Garansi {soon.slice(0, 2).map((e) => e.it.name).join(', ')}{soon.length > 2 ? ` +${soon.length - 2}` : ''} segera habis — cek kondisinya sebelum lewat.
          </p>
        )}
      </section>

      {enriched.length === 0 ? (
        <section className={cn(card, 'px-5 py-10 text-center')}>
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300"><Package size={26} /></span>
          <h3 className="mt-4 text-[18px] font-extrabold text-slate-900 dark:text-white">Catat barang yang kamu punya</h3>
          <p className="mx-auto mt-1 max-w-sm text-[13px] text-slate-500 dark:text-slate-400">HP, motor, laptop, jam — lihat berapa nilainya sekarang, ikut dihitung di kekayaan bersih, dan diingatkan sebelum garansinya habis.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {STARTERS.map((p) => {
              const M = categoryMeta(p.category!);
              return (
                <button key={p.name} type="button" onClick={() => setEditor({ preset: p })} className="flex items-center gap-2 rounded-full bg-slate-100 py-1.5 pl-1.5 pr-3.5 text-[13px] font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200">
                  <span className={cn('flex h-7 w-7 items-center justify-center rounded-full', M.tone)}><M.icon size={14} /></span>{p.name}
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <>
          {/* Filter */}
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-white px-4 py-2.5 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
              <Search size={16} className="shrink-0 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama, merek, catatan…" aria-label="Cari barang" className="min-w-0 flex-1 bg-transparent text-[14px] font-medium text-slate-900 outline-none placeholder:text-slate-400 dark:text-white" />
            </label>
            <div className="flex items-center gap-2">
              <label className="relative">
                <select value={sort} onChange={(e) => setSort(e.target.value as SortId)} aria-label="Urutkan" className="appearance-none rounded-full bg-white py-2.5 pl-4 pr-9 text-[13px] font-bold text-slate-700 ring-1 ring-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800">
                  {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </label>
              {inactiveCount > 0 && (
                <button type="button" onClick={() => setShowInactive((v) => !v)} aria-pressed={showInactive} className={cn('rounded-full px-4 py-2.5 text-[13px] font-bold ring-1', showInactive ? 'bg-slate-900 text-white ring-slate-900 dark:bg-white dark:text-slate-900' : 'bg-white text-slate-600 ring-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800')}>
                  Terjual/hilang {inactiveCount}
                </button>
              )}
            </div>
          </div>
          {cats.length > 1 && !showInactive && (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">
              {(['Semua', ...cats] as const).map((c) => {
                const on = cat === c;
                const M = c === 'Semua' ? null : categoryMeta(c);
                return (
                  <button key={c} type="button" onClick={() => setCat(c)} aria-pressed={on} className={cn('flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold', on ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white text-slate-600 ring-1 ring-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800')}>
                    {M && <M.icon size={14} />}{c}
                  </button>
                );
              })}
            </div>
          )}

          {shown.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-slate-500 dark:text-slate-400">{showInactive ? 'Tidak ada barang terjual/hilang.' : 'Tidak ada barang yang cocok.'}</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {shown.map(({ it, value, warranty }) => (
                <li key={it.id}>
                  <ItemCard item={it} value={value} warranty={warranty} money={money} onOpen={() => setEditor({ item: it })} className={card} />
                </li>
              ))}
            </ul>
          )}
          <p className="px-1 text-[11px] text-slate-400">Nilai sekarang = perkiraan (turun mengikuti umur & kategori). Barang terjual/hilang tidak dihitung di kekayaan.</p>
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

const CAT_COLOR: Record<ItemCategory, string> = {
  Elektronik: '#38bdf8',
  Kendaraan: '#818cf8',
  'Rumah tangga': '#2dd4bf',
  Perabot: '#fbbf24',
  Fashion: '#f472b6',
  'Jam & perhiasan': '#facc15',
  'Hobi & olahraga': '#a78bfa',
  Lainnya: '#94a3b8',
};

function ItemCard({ item, value, warranty, money, onOpen, className }: { item: Item; value: number; warranty: ReturnType<typeof warrantyStatus>; money: (n: number) => string; onOpen: () => void; className: string }) {
  const [broken, setBroken] = useState(false);
  const M = categoryMeta(item.category);
  const age = itemAgeLabel(item.purchaseDate);
  const dropped = item.purchasePrice > 0 && value < item.purchasePrice - 0.5;
  return (
    <button type="button" onClick={onOpen} className={cn(className, 'group flex w-full flex-col overflow-hidden text-left transition-transform active:scale-[0.98]', item.status !== 'aktif' && 'opacity-60')}>
      <span className="relative block aspect-square w-full overflow-hidden bg-slate-50 dark:bg-slate-800">
        {item.hasPhoto && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto privat dari API (cookie)
          <img src={itemService.photoUrl(item)} alt={item.name} loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
        ) : (
          <span className={cn('flex h-full w-full items-center justify-center', M.tone)}><M.icon size={40} strokeWidth={1.5} /></span>
        )}
        {warranty && warranty.tone !== 'ok' && item.status === 'aktif' && (
          <span className={cn('absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold', warranty.tone === 'soon' ? 'bg-amber-400 text-amber-950' : 'bg-slate-900/70 text-white')}>{warranty.label}</span>
        )}
        {item.status !== 'aktif' && <span className="absolute left-2 top-2 rounded-full bg-slate-900/75 px-2 py-0.5 text-[10px] font-bold uppercase text-white">{item.status}</span>}
      </span>
      <span className="block p-3">
        <span className="block truncate text-[14px] font-bold text-slate-900 dark:text-white">{item.name}</span>
        <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">{[item.brand, item.variant].filter(Boolean).join(' · ') || item.category}</span>
        <span className="mt-1.5 flex items-baseline justify-between gap-2">
          <span className="truncate text-[15px] font-extrabold tabular-nums text-slate-900 dark:text-white">{money(value)}</span>
          {dropped && <TrendingDown size={13} className="shrink-0 text-amber-500" aria-label="Nilai turun" />}
        </span>
        <span className="block truncate text-[11px] text-slate-400">{age ? `Umur ${age}` : warranty?.tone === 'ok' ? warranty.label : 'Belum ada tanggal beli'}</span>
      </span>
    </button>
  );
}
