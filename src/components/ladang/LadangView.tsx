"use client";

import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, HandCoins, PenLine, Sprout, Tag } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { SellFlow } from '@/components/ladang/SellFlow';
import { TagihView } from '@/components/ladang/TagihView';
import { itemService } from '@/lib/services/itemService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { categoryMeta, itemCurrentValue, type Item } from '@/lib/itemValue';
import { cn, formatIDR } from '@/lib/utils';

// Ladangku: cuan sampingan. Tab (hash): #jual — barang nganggur jadi uang (AI
// menaksir dari iklan asli + menulis iklan), #tagih — piutang + ingatkan via WA +
// Patungan. (Tab Target dihapus 2026-11-04 atas permintaan Bos: ikut menghitung gaji.) Dipakai web (/membership/ladang) & app
// HP (/app/ladang). ?item=<id> langsung membuka barang itu (tombol di Barangku).

const TABS = [
  { id: 'jual', label: 'Jual', icon: Tag },
  { id: 'tagih', label: 'Tagih', icon: HandCoins },
] as const;
type TabId = (typeof TABS)[number]['id'];

export function LadangView({ variant, toast }: { variant: 'web' | 'app'; toast?: (m: string) => void }) {
  const [tab, setTab] = useState<TabId>('jual');
  const [flash, setFlash] = useState('');
  useEffect(() => {
    const read = () => { const h = window.location.hash.slice(1); if (TABS.some((t) => t.id === h)) setTab(h as TabId); };
    read(); // hash baru terbaca di klien (static export)
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  const go = (t: TabId) => {
    setTab(t);
    try { window.history.replaceState(null, '', `${window.location.pathname}#${t}`); } catch { /* abaikan */ }
  };
  const say = (m: string) => {
    if (toast) toast(m);
    else { setFlash(m); window.setTimeout(() => setFlash(''), 3500); }
  };
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Ladangku" className="flex gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => go(t.id)} className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[13px] font-bold transition-colors', tab === t.id ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400')}>
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>
      {flash && <div role="status" className="rounded-2xl bg-emerald-50 px-4 py-3 text-[13px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{flash}</div>}
      {tab === 'jual' && <JualView variant={variant} onToast={say} />}
      {tab === 'tagih' && <TagihView variant={variant} onToast={say} />}
    </div>
  );
}

function JualView({ variant, onToast }: { variant: 'web' | 'app'; onToast: (m: string) => void }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState('');
  const [flow, setFlow] = useState<{ item?: Item } | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => itemService.list().then((r) => { if (alive) { setItems(r); setError(''); } }).catch((e) => { if (alive) { setItems((p) => p ?? []); setError(e instanceof Error ? e.message : 'Gagal memuat barang.'); } });
    void load().then(() => undefined);
    const unsub = subscribeToCollectionChanges('items', load);
    return () => { alive = false; unsub(); };
  }, []);

  // ?item=<id> dari tombol "Jual" di Barangku (dibaca sekali setelah data ada).
  const [deep, setDeep] = useState<string | null>(null);
  useEffect(() => {
    try {
      const id = new URLSearchParams(window.location.search).get('item');
      // eslint-disable-next-line react-hooks/set-state-in-effect -- query string baru terbaca di klien (static export)
      if (id) setDeep(id);
    } catch { /* abaikan */ }
  }, []);
  useEffect(() => {
    if (!deep || !items) return;
    const it = items.find((i) => i.id === deep && i.status === 'aktif');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- buka barang dari tautan sekali saja
    if (it) setFlow({ item: it });
    setDeep(null);
    try { window.history.replaceState(null, '', window.location.pathname); } catch { /* abaikan */ }
  }, [deep, items]);

  const active = useMemo(() => (items ?? []).filter((i) => i.status === 'aktif' && (i.currency || 'IDR') === 'IDR').map((it) => ({ it, value: itemCurrentValue(it) })).sort((a, b) => b.value - a.value), [items]);
  const sold = useMemo(() => (items ?? []).filter((i) => i.status === 'terjual').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [items]);
  const potential = active.reduce((s, e) => s + e.value, 0);
  const cashed = sold.reduce((s, i) => s + (i.manualValue ?? 0), 0);

  const done = (msg: string) => {
    setFlow(null);
    onToast(msg);
  };
  const app = variant === 'app';
  const card = app ? 'rounded-3xl bg-white ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800' : 'rounded-[26px] bg-white ring-1 ring-slate-100';
  const body = flow && <SellFlow key={flow.item?.id ?? 'lain'} item={flow.item} onDone={done} />;
  const title = flow?.item ? `Jual ${flow.item.name}` : 'Jual barang';

  if (items === null) return <div className="space-y-3"><div className="h-44 animate-pulse rounded-[28px] bg-slate-200/70 dark:bg-slate-800" /><div className="h-40 animate-pulse rounded-3xl bg-white dark:bg-slate-900" /></div>;

  return (
    <div className="space-y-4">
      {error && <div role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</div>}

      <section className="web-keep relative overflow-hidden rounded-[28px] bg-[radial-gradient(120%_140%_at_100%_0%,#047857_0%,#064e3b_35%,#0b1220_80%)] p-5 text-white md:p-6">
        <Sprout aria-hidden size={150} strokeWidth={1} className="pointer-events-none absolute -bottom-6 -right-4 text-emerald-300/10" />
        <p className="text-[13px] font-semibold text-white/60">Barang nganggur jadi uang</p>
        <p className="mt-1 text-[32px] font-extrabold leading-none tracking-tight tabular-nums md:text-[40px]">{formatIDR(Math.round(potential))}</p>
        <p className="mt-2 text-[13px] text-white/60">perkiraan nilai {active.length} barang di Barangku{cashed > 0 ? ` · sudah cair ${formatIDR(Math.round(cashed))}` : ''}</p>
        <div className="relative mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setFlow({})} className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-[13px] font-bold text-slate-900 hover:bg-white/90"><PenLine size={15} /> Ketik barang lain</button>
        </div>
        <ol className="relative mt-5 grid grid-cols-3 gap-2 text-[11px] text-white/70">
          {['Pilih barang', 'AI cek iklan asli', 'Salin iklan & jual'].map((s, i) => (
            <li key={s} className="rounded-2xl bg-white/[0.07] px-2.5 py-2"><span className="block text-[15px] font-extrabold text-emerald-300">{i + 1}</span>{s}</li>
          ))}
        </ol>
      </section>

      <section className={cn(card, 'p-4')}>
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-[15px] font-extrabold text-slate-900 dark:text-white">Dari Barangku</h3>
          <span className="text-[11px] text-slate-400">nilai = perkiraan susut</span>
        </div>
        {active.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-slate-500 dark:text-slate-400">Belum ada barang aktif di Barangku. Ketik barangnya langsung lewat tombol di atas.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
            {active.map(({ it, value }) => <ItemRow key={it.id} item={it} value={value} onOpen={() => setFlow({ item: it })} />)}
          </ul>
        )}
      </section>

      {sold.length > 0 && (
        <section className={cn(card, 'p-4')}>
          <h3 className="text-[15px] font-extrabold text-slate-900 dark:text-white">Sudah terjual</h3>
          <ul className="mt-2 space-y-1.5">
            {sold.slice(0, 8).map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 text-[13px]">
                <span className="min-w-0 truncate text-slate-600 dark:text-slate-300">{[i.brand, i.name].filter(Boolean).join(' ')}</span>
                <span className="shrink-0 font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{i.manualValue ? formatIDR(i.manualValue) : '—'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {app ? (
        <BottomSheet isOpen={Boolean(flow)} onClose={() => setFlow(null)} title={title}><div className="pb-[calc(env(safe-area-inset-bottom)+16px)]">{body}</div></BottomSheet>
      ) : (
        <Modal isOpen={Boolean(flow)} onClose={() => setFlow(null)} title={title} maxWidth="max-w-lg">{body}</Modal>
      )}
    </div>
  );
}

function ItemRow({ item, value, onOpen }: { item: Item; value: number; onOpen: () => void }) {
  const [broken, setBroken] = useState(false);
  const M = categoryMeta(item.category);
  const Icon = M.icon;
  return (
    <li>
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 py-2.5 text-left">
        <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl', M.tone)}>
          {item.hasPhoto && !broken ? (
            // eslint-disable-next-line @next/next/no-img-element -- foto privat dari API
            <img src={itemService.photoUrl(item)} alt="" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover" />
          ) : <Icon size={20} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-bold text-slate-900 dark:text-white">{[item.brand, item.name].filter(Boolean).join(' ')}</span>
          <span className="block truncate text-[12px] text-slate-500 dark:text-slate-400">{[item.variant, item.category].filter(Boolean).join(' · ')}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[13px] font-extrabold tabular-nums text-slate-900 dark:text-white">≈ {formatIDR(Math.round(value))}</span>
          <span className="flex items-center justify-end gap-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Jual <ChevronRight size={13} /></span>
        </span>
      </button>
    </li>
  );
}
