'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AiOrb } from '@/components/ai/AiChat';
import { ArrowLeft, Camera, ChevronRight, HandCoins, LayoutGrid, Sprout, Store, Tag } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { SellFlow } from '@/components/ladang/SellFlow';
import { TagihView } from '@/components/ladang/TagihView';
import { UsahaView } from '@/components/ladang/UsahaView';
import { RingkasView } from '@/components/ladang/RingkasView';
import { itemService, listingService, type Listing } from '@/lib/services/itemService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { categoryMeta, itemCurrentValue, type Item } from '@/lib/itemValue';
import { cn, formatIDR, toLocalDateString } from '@/lib/utils';

// Tab di hash (#ringkas, #usaha, #jual, #tagih). Tab Target lama dihapus karena ikut menghitung gaji.
// ?item=<id> langsung membuka barang itu (tombol di Barangku).

const TABS = [
  { id: 'ringkas', label: 'Ringkas', icon: LayoutGrid, title: 'Ladangku', sub: 'Cuan sampingan bulan ini' },
  { id: 'usaha', label: 'Usaha', icon: Store, title: 'Usahaku', sub: 'Kasir, katalog & website toko' },
  { id: 'jual', label: 'Jual', icon: Tag, title: 'Jual barang', sub: 'Barang nganggur jadi uang' },
  { id: 'tagih', label: 'Tagih', icon: HandCoins, title: 'Tagih', sub: 'Piutang, cicilan & patungan' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export function LadangView({ variant, toast }: { variant: 'web' | 'app'; toast?: (m: string) => void }) {
  const [tab, setTab] = useState<TabId>('ringkas');
  const [flash, setFlash] = useState('');
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1);
      if (TABS.some((t) => t.id === h)) setTab(h as TabId);
      else if (new URLSearchParams(window.location.search).has('item')) setTab('jual'); // tombol "Jual" di Barangku
    };
    read(); // hash baru terbaca di klien (static export)
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  const go = (t: TabId) => {
    setTab(t);
    try {
      window.history.replaceState(null, '', `${window.location.pathname}#${t}`);
    } catch {
      /* abaikan */
    }
  };
  const say = (m: string) => {
    if (toast) toast(m);
    else {
      setFlash(m);
      window.setTimeout(() => setFlash(''), 3500);
    }
  };
  const content = (
    <>
      {flash && (
        <div
          role="status"
          className="rounded-2xl bg-emerald-50 px-4 py-3 text-[13px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
        >
          {flash}
        </div>
      )}
      {tab === 'ringkas' && <RingkasView variant={variant} go={go} onToast={say} />}
      {tab === 'usaha' && <UsahaView variant={variant} onToast={say} />}
      {tab === 'jual' && <JualView variant={variant} onToast={say} />}
      {tab === 'tagih' && <TagihView variant={variant} onToast={say} />}
    </>
  );

  // Web: layar penuh seperti Investasiku (tanpa sidebar — FULLSCREEN_PATHS di
  // app/membership/layout.tsx): bar atas + dock melayang di bawah.
  if (variant === 'web') {
    const current = TABS.find((t) => t.id === tab) ?? TABS[0];
    return (
      <div className="mx-auto min-h-screen max-w-6xl px-4 pb-32 pt-4 md:px-8 md:pt-6">
        <header className="mb-5 grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <Link
            href="/membership/dashboard"
            aria-label="Kembali ke Ringkasan"
            className="web-keep group flex h-11 items-center gap-1.5 rounded-full bg-slate-950 pl-2 pr-4 text-[13px] font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 transition-transform group-hover:-translate-x-0.5">
              <ArrowLeft size={16} />
            </span>{' '}
            <span className="hidden sm:inline">Ringkasan</span>
          </Link>
          <div className="min-w-0 text-center">
            <h1 className="truncate text-[20px] font-extrabold tracking-tight text-slate-900 md:text-[24px]">
              {current.title}
            </h1>
            <p className="truncate text-[12px] text-slate-500">{current.sub}</p>
          </div>
          <Link
            href="/membership/ai-leosiqra"
            aria-label="Tanya Leo"
            className="rounded-full ring-2 ring-white transition-transform hover:scale-105"
          >
            <AiOrb size={44} />
          </Link>
        </header>
        <main className="space-y-4">{content}</main>
        <nav
          aria-label="Menu Ladangku"
          className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+16px)] z-40 flex justify-center px-4 print:hidden"
        >
          <div className="web-keep flex items-center gap-1 rounded-full bg-slate-950/85 p-1.5 shadow-[0_20px_50px_-12px_rgba(2,6,23,0.6)] ring-1 ring-white/10 backdrop-blur-xl">
            {TABS.map((t) => {
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => go(t.id)}
                  aria-current={active ? 'page' : undefined}
                  aria-label={t.label}
                  className={cn(
                    'relative flex h-12 items-center justify-center gap-2 rounded-full text-[13px] font-bold transition-all',
                    active
                      ? 'bg-gradient-to-r from-emerald-400 to-teal-300 px-4 text-slate-950'
                      : 'w-12 text-white/70 hover:bg-white/10',
                  )}
                >
                  <t.icon size={20} className="shrink-0" strokeWidth={active ? 2.4 : 1.9} />
                  {active && <span className="whitespace-nowrap">{t.label}</span>}
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Ladangku" className="flex gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => go(t.id)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[13px] font-bold transition-colors',
                tab === t.id
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400',
              )}
            >
              <Icon size={15} className="hidden sm:block" /> {t.label}
            </button>
          );
        })}
      </div>
      {content}
    </div>
  );
}

function JualView({ variant, onToast }: { variant: 'web' | 'app'; onToast: (m: string) => void }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState('');
  const [flow, setFlow] = useState<{ item?: Item; listing?: Listing } | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);

  useEffect(() => {
    let alive = true;
    const load = () =>
      itemService
        .list()
        .then((r) => {
          if (alive) {
            setItems(r);
            setError('');
          }
        })
        .catch((e) => {
          if (alive) {
            setItems((p) => p ?? []);
            setError(e instanceof Error ? e.message : 'Gagal memuat barang.');
          }
        });
    const loadL = () =>
      listingService
        .list()
        .then((r) => alive && setListings(r))
        .catch(() => undefined); // tabel 0028 bisa belum ada
    void load();
    void loadL();
    const u1 = subscribeToCollectionChanges('items', () => {
      void load();
      void loadL();
    });
    const u2 = subscribeToCollectionChanges('listings', loadL);
    return () => {
      alive = false;
      u1();
      u2();
    };
  }, []);

  // ?item=<id> dari tombol "Jual" di Barangku (dibaca sekali setelah data ada).
  const [deep, setDeep] = useState<string | null>(null);
  useEffect(() => {
    try {
      const id = new URLSearchParams(window.location.search).get('item');
      // eslint-disable-next-line react-hooks/set-state-in-effect -- query string baru terbaca di klien (static export)
      if (id) setDeep(id);
    } catch {
      /* abaikan */
    }
  }, []);
  useEffect(() => {
    if (!deep || !items) return;
    const it = items.find((i) => i.id === deep && i.status === 'aktif');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- buka barang dari tautan sekali saja
    if (it) setFlow({ item: it, listing: listings.find((l) => l.itemId === it.id && l.status === 'dijual') });
    setDeep(null);
    try {
      window.history.replaceState(null, '', window.location.pathname);
    } catch {
      /* abaikan */
    }
  }, [deep, items, listings]);

  const active = useMemo(
    () =>
      (items ?? [])
        .filter((i) => i.status === 'aktif' && (i.currency || 'IDR') === 'IDR')
        .map((it) => ({ it, value: itemCurrentValue(it) }))
        .sort((a, b) => b.value - a.value),
    [items],
  );
  // Sedang dijual: iklan aktif (barang Barangku yang sudah tidak aktif → disembunyikan).
  const selling = useMemo(
    () => listings.filter((l) => l.status === 'dijual' && (!l.itemId || !l.itemStatus || l.itemStatus === 'aktif')),
    [listings],
  );
  const sellingByItem = useMemo(() => new Map(selling.filter((l) => l.itemId).map((l) => [l.itemId!, l])), [selling]);
  // Sudah terjual: iklan laku + barang Barangku terjual (tanpa dobel).
  const sold = useMemo(() => {
    const fromListings = listings
      .filter((l) => l.status === 'terjual')
      .map((l) => ({ id: l.id, itemId: l.itemId, name: l.name, price: l.soldPrice ?? 0, at: l.updatedAt }));
    const linked = new Set(fromListings.map((x) => x.itemId).filter(Boolean));
    const fromItems = (items ?? [])
      .filter((i) => i.status === 'terjual' && !linked.has(i.id))
      .map((i) => ({
        id: i.id,
        itemId: i.id,
        name: [i.brand, i.name].filter(Boolean).join(' '),
        price: i.manualValue ?? 0,
        at: i.updatedAt,
      }));
    return [...fromListings, ...fromItems].sort((a, b) => b.at.localeCompare(a.at));
  }, [listings, items]);
  const potential = active.reduce((s, e) => s + e.value, 0);
  const cashed = sold.reduce((s, i) => s + i.price, 0);

  const done = (msg: string) => {
    setFlow(null);
    onToast(msg);
  };
  const app = variant === 'app';
  const card = app
    ? 'rounded-3xl bg-white ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800'
    : 'rounded-[26px] bg-white ring-1 ring-slate-100';
  const body = flow && (
    <SellFlow key={flow.listing?.id ?? flow.item?.id ?? 'lain'} item={flow.item} listing={flow.listing} onDone={done} />
  );
  const title = flow?.listing ? flow.listing.name : flow?.item ? `Jual ${flow.item.name}` : 'Jual barang';
  const openItem = (it: Item) => setFlow({ item: it, listing: sellingByItem.get(it.id) });
  const openListing = (l: Listing) =>
    setFlow({ listing: l, item: l.itemId ? (items ?? []).find((i) => i.id === l.itemId) : undefined });

  if (items === null)
    return (
      <div className="space-y-3">
        <div className="h-44 animate-pulse rounded-[28px] bg-slate-200/70 dark:bg-slate-800" />
        <div className="h-40 animate-pulse rounded-3xl bg-white dark:bg-slate-900" />
      </div>
    );

  return (
    <div className="space-y-4">
      {error && (
        <div
          role="alert"
          className="rounded-2xl bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
        >
          {error}
        </div>
      )}

      <section className="web-keep relative overflow-hidden rounded-[28px] bg-[radial-gradient(120%_140%_at_100%_0%,#047857_0%,#064e3b_35%,#0b1220_80%)] p-5 text-white md:p-6">
        <Sprout
          aria-hidden
          size={150}
          strokeWidth={1}
          className="pointer-events-none absolute -bottom-6 -right-4 text-emerald-300/10"
        />
        <p className="text-[13px] font-semibold text-white/60">Barang nganggur jadi uang</p>
        <p className="mt-1 text-[32px] font-extrabold leading-none tracking-tight tabular-nums md:text-[40px]">
          {formatIDR(Math.round(potential))}
        </p>
        <p className="mt-2 text-[13px] text-white/60">
          perkiraan nilai {active.length} barang di Barangku
          {cashed > 0 ? ` · sudah cair ${formatIDR(Math.round(cashed))}` : ''}
        </p>
        <div className="relative mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFlow({})}
            className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-[13px] font-bold text-slate-900 hover:bg-white/90"
          >
            <Camera size={15} /> Foto / ketik barang lain
          </button>
        </div>
        <ol className="relative mt-5 grid grid-cols-3 gap-2 text-[11px] text-white/70">
          {['Foto / pilih barang', 'AI cek iklan asli', 'Iklan tersimpan & jual'].map((s, i) => (
            <li key={s} className="rounded-2xl bg-white/[0.07] px-2.5 py-2">
              <span className="block text-[15px] font-extrabold text-emerald-300">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </section>

      {selling.length > 0 && (
        <section className={cn(card, 'p-4')}>
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-[15px] font-extrabold text-slate-900 dark:text-white">
              Sedang dijual <span className="text-slate-400">· {selling.length}</span>
            </h3>
            <span className="text-[11px] text-slate-400">tersimpan otomatis</span>
          </div>
          <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
            {selling.map((l) => (
              <ListingRow key={l.id} listing={l} onOpen={() => openListing(l)} />
            ))}
          </ul>
        </section>
      )}

      <section className={cn(card, 'p-4')}>
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-[15px] font-extrabold text-slate-900 dark:text-white">Dari Barangku</h3>
          <span className="text-[11px] text-slate-400">nilai = perkiraan susut</span>
        </div>
        {active.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-slate-500 dark:text-slate-400">
            Belum ada barang aktif di Barangku. Ketik barangnya langsung lewat tombol di atas.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
            {active.map(({ it, value }) => (
              <ItemRow
                key={it.id}
                item={it}
                value={value}
                selling={sellingByItem.has(it.id)}
                onOpen={() => openItem(it)}
              />
            ))}
          </ul>
        )}
      </section>

      {sold.length > 0 && (
        <section className={cn(card, 'p-4')}>
          <h3 className="text-[15px] font-extrabold text-slate-900 dark:text-white">Sudah terjual</h3>
          <ul className="mt-2 space-y-1.5">
            {sold.slice(0, 8).map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 text-[13px]">
                <span className="min-w-0 truncate text-slate-600 dark:text-slate-300">{i.name}</span>
                <span className="shrink-0 font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {i.price ? formatIDR(i.price) : '—'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {app ? (
        <BottomSheet isOpen={Boolean(flow)} onClose={() => setFlow(null)} title={title}>
          <div className="pb-[calc(env(safe-area-inset-bottom)+16px)]">{body}</div>
        </BottomSheet>
      ) : (
        <Modal isOpen={Boolean(flow)} onClose={() => setFlow(null)} title={title} maxWidth="max-w-lg">
          {body}
        </Modal>
      )}
    </div>
  );
}

function ListingRow({ listing, onOpen }: { listing: Listing; onOpen: () => void }) {
  const [broken, setBroken] = useState(false);
  const src = listingService.photoUrl(listing);
  const days = Math.max(
    0,
    Math.round(
      (new Date(`${toLocalDateString()}T00:00:00`).getTime() -
        new Date(`${toLocalDateString(new Date(listing.createdAt))}T00:00:00`).getTime()) /
        864e5,
    ),
  );
  return (
    <li>
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 py-2.5 text-left">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
          {src && !broken ? (
            // eslint-disable-next-line @next/next/no-img-element -- foto privat dari API
            <img
              src={src}
              alt=""
              loading="lazy"
              onError={() => setBroken(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <Tag size={20} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-bold text-slate-900 dark:text-white">
            {listing.title || listing.name}
          </span>
          <span className="block truncate text-[12px] text-slate-500 dark:text-slate-400">
            {[listing.condition, days === 0 ? 'dipasang hari ini' : `dipasang ${days} hari lalu`]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[14px] font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">
            {listing.price ? formatIDR(listing.price) : '—'}
          </span>
          <span className="flex items-center justify-end gap-0.5 text-[11px] font-bold text-slate-400">
            Buka <ChevronRight size={13} />
          </span>
        </span>
      </button>
    </li>
  );
}

function ItemRow({
  item,
  value,
  selling,
  onOpen,
}: {
  item: Item;
  value: number;
  selling?: boolean;
  onOpen: () => void;
}) {
  const [broken, setBroken] = useState(false);
  const M = categoryMeta(item.category);
  const Icon = M.icon;
  return (
    <li>
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 py-2.5 text-left">
        <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl', M.tone)}>
          {item.hasPhoto && !broken ? (
            // eslint-disable-next-line @next/next/no-img-element -- foto privat dari API
            <img
              src={itemService.photoUrl(item)}
              alt=""
              loading="lazy"
              onError={() => setBroken(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <Icon size={20} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-bold text-slate-900 dark:text-white">
            {[item.brand, item.name].filter(Boolean).join(' ')}
          </span>
          <span className="block truncate text-[12px] text-slate-500 dark:text-slate-400">
            {[item.variant, item.category].filter(Boolean).join(' · ')}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[13px] font-extrabold tabular-nums text-slate-900 dark:text-white">
            ≈ {formatIDR(Math.round(value))}
          </span>
          <span className="flex items-center justify-end gap-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            {selling ? 'Sedang dijual' : 'Jual'} <ChevronRight size={13} />
          </span>
        </span>
      </button>
    </li>
  );
}
