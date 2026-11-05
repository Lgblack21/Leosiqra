"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Copy, Loader2, Minus, Palette, Plus, ReceiptText, Search, Settings2, ShoppingBag, Store, Trash2, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { shopService, groupProducts, type KasirStyle, type Shop, type ShopProduct } from '@/lib/services/shopService';
import { KasirStyleEditor } from './KasirStyleEditor';
import { KASIR_THEME } from './kasirTheme';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { accountService } from '@/lib/services/accountService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { isCreditAccountType } from '@/lib/creditCard';
import { cn, formatIDR, toLocalDateString } from '@/lib/utils';
import { ShopDetail, amt, fieldCls, initials, labelCls, monthKey, productLabel, short, toneOf } from './UsahaView';

// Ladangku › Usahaku › Kasir: halaman penuh per usaha. Kiri = katalog toko (per
// kategori, cari, ketuk = masuk struk); kanan (HP: bar bawah → sheet) = struk:
// item, nama/ID pembeli, total (bisa diubah untuk diskon), rekening → satu
// transaksi pemasukan atomik di server (request_id anti dobel). "Kelola" membuka
// pengaturan usaha (kontak, produk, website).

type Line = { key: string; name: string; group?: string; price: number; qty: number };
const lineKey = (p: ShopProduct) => `${p.group ?? ''}|${p.name}`;
const ACC_KEY = 'leosiqra-kasir-acc-v1';

const themeOf = (s: KasirStyle) => KASIR_THEME[s.theme] ?? KASIR_THEME.ungu;

export function KasirView({ variant, onToast }: { variant: 'web' | 'app'; onToast?: (m: string) => void }) {
  const app = variant === 'app';
  const router = useRouter();
  const back = `${app ? '/app' : '/membership'}/ladang#usaha`;
  const [id, setId] = useState<string | null>(null);
  const [shops, setShops] = useState<Shop[] | null>(null);
  const [tx, setTx] = useState<Transaction[]>([]);
  const [error, setError] = useState('');
  const [manage, setManage] = useState(false);
  const [styling, setStyling] = useState(false);
  const [sheet, setSheet] = useState(false); // HP: struk
  const [flash, setFlash] = useState('');
  const say = (m: string) => { if (onToast) onToast(m); else { setFlash(m); window.setTimeout(() => setFlash(''), 3500); } };

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- query string baru terbaca di klien (static export)
      setId(new URLSearchParams(window.location.search).get('id'));
    } catch { setId(''); }
    let alive = true;
    const load = () => shopService.list().then((r) => { if (alive) { setShops(r); setError(''); } }).catch((e) => { if (alive) { setShops((p) => p ?? []); setError(e instanceof Error ? e.message : 'Gagal memuat usaha.'); } });
    const loadTx = () => transactionService.getUserTransactions('session').then((v) => alive && setTx(v)).catch(() => undefined);
    void load(); void loadTx();
    const u1 = subscribeToCollectionChanges('shops', load);
    const u2 = subscribeToCollectionChanges('transactions', loadTx);
    // AI-mu menyimpan lewat MCP di tab lain → muat ulang saat kembali ke tab ini.
    const onFocus = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onFocus);
    return () => { alive = false; u1(); u2(); document.removeEventListener('visibilitychange', onFocus); };
  }, []);

  const shop = shops?.find((s) => s.id === id);
  const sales = useMemo(() => tx.filter((t) => t.relatedType === 'shop' && t.relatedId === id), [tx, id]);
  const today = toLocalDateString();
  const todaySales = sales.filter((t) => toLocalDateString(new Date(t.date)) === today);
  const monthSales = sales.filter((t) => monthKey(t.date) === today.slice(0, 7));

  const [lines, setLines] = useState<Line[]>([]);
  const add = (p: ShopProduct) => setLines((l) => {
    const k = lineKey(p);
    return l.some((x) => x.key === k) ? l.map((x) => (x.key === k ? { ...x, qty: Math.min(9999, x.qty + 1) } : x)) : [...l, { key: k, name: p.name, group: p.group, price: p.price, qty: 1 }];
  });
  const setQty = (k: string, q: number) => setLines((l) => (q < 1 ? l.filter((x) => x.key !== k) : l.map((x) => (x.key === k ? { ...x, qty: Math.min(9999, q) } : x))));
  const count = lines.reduce((s, x) => s + x.qty, 0);
  const sum = lines.reduce((s, x) => s + x.price * x.qty, 0);

  if (shops === null || id === null) return <div className="h-72 animate-pulse rounded-[28px] bg-slate-200/70 dark:bg-slate-800" />;
  if (!shop) {
    return (
      <div className="rounded-[28px] bg-white p-8 text-center ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
        <p className="text-[15px] font-bold text-slate-900 dark:text-white">{error || 'Usaha tidak ditemukan.'}</p>
        <Link href={back} className="mt-3 inline-flex items-center gap-1 text-[13px] font-bold text-violet-600 dark:text-violet-300"><ArrowLeft size={15} /> Kembali ke Usahaku</Link>
      </div>
    );
  }

  // inSheet: di dalam sheet/modal (judul dari sheet, tanpa kartu) — "Transaksi baru" menutup sheet.
  const compactHead = shop.style.header === 'ringkas';
  const todayTotal = Math.round(todaySales.reduce((x, t) => x + amt(t), 0));
  const strukLeft = shop.style.strukSide === 'kiri';
  const strukFor = (inSheet: boolean) => <Struk key={`${shop.id}-${inSheet}`} shop={shop} lines={lines} sum={sum} onAdd={add} setQty={setQty} clear={() => setLines([])} onDone={say} inSheet={inSheet} onNew={() => setSheet(false)} />;

  return (
    <div className={cn('space-y-4', app && 'pb-24')}>
      {flash && <div role="status" className="fixed inset-x-4 top-4 z-[95] mx-auto max-w-sm rounded-2xl bg-slate-900 px-4 py-3 text-center text-[13px] font-semibold text-white shadow-lg">{flash}</div>}

      {/* Header toko */}
      <section className={cn('web-keep relative overflow-hidden text-white', compactHead ? 'rounded-[22px] px-3 py-2.5' : 'rounded-[28px] p-4 md:p-5', themeOf(shop.style).header)}>
        <div className="flex items-center gap-3">
          <Link href={back} aria-label="Kembali ke Usahaku" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"><ArrowLeft size={17} /></Link>
          {!compactHead && <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[26px]">{shop.emoji || '🏪'}</span>}
          <div className="min-w-0 flex-1">
            {!compactHead && <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/50"><Store size={12} /> Kasir</p>}
            <h1 className={cn('truncate font-extrabold leading-tight', compactHead ? 'text-[16px]' : 'text-[20px] md:text-[24px]')}>{compactHead && `${shop.emoji || '🏪'} `}{shop.name}</h1>
            {compactHead && shop.style.showStats ? <p className="truncate text-[11px] text-white/70">Hari ini {short(todayTotal)} · {todaySales.length} transaksi</p> : shop.style.greeting && <p className="truncate text-[12px] text-white/70">{shop.style.greeting}</p>}
          </div>
          <button type="button" onClick={() => setStyling(true)} aria-label="Tampilan kasir" className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-[12px] font-bold hover:bg-white/20"><Palette size={14} /> <span className="hidden sm:inline">Tampilan</span></button>
          <button type="button" onClick={() => setManage(true)} aria-label="Kelola usaha" className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-[12px] font-bold hover:bg-white/20"><Settings2 size={14} /> <span className="hidden sm:inline">Kelola</span></button>
        </div>
        {!compactHead && shop.style.showStats && <div className="mt-4 grid grid-cols-3 gap-2">
          {[['Hari ini', short(todayTotal)], ['Transaksi', String(todaySales.length)], ['Bulan ini', short(Math.round(monthSales.reduce((x, t) => x + amt(t), 0)))]].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-white/[0.07] px-3 py-2.5 ring-1 ring-white/10"><p className="text-[11px] text-white/55">{k}</p><p className="truncate text-[16px] font-extrabold tabular-nums md:text-[18px]">{v}</p></div>
          ))}
        </div>}
      </section>

      {shop.products.length === 0 ? (
        <section className="rounded-[26px] bg-white p-8 text-center ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300"><ShoppingBag size={26} /></span>
          <p className="mt-3 text-[16px] font-extrabold text-slate-900 dark:text-white">Katalog masih kosong</p>
          <p className="mx-auto mt-1 max-w-sm text-[13px] text-slate-500 dark:text-slate-400">Tambahkan produk & harga, atau ambil otomatis dari website tokomu — semua game langsung jadi kategori kasir.</p>
          <button type="button" onClick={() => setManage(true)} className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-5 py-2.5 text-[13px] font-bold text-white hover:bg-violet-700"><Settings2 size={15} /> Isi katalog</button>
        </section>
      ) : (
        <div className={cn('grid items-start gap-4', strukLeft ? 'lg:grid-cols-[360px_1fr]' : 'lg:grid-cols-[1fr_360px]')}>
          <Catalog products={shop.products} style={shop.style} lines={lines} onAdd={add} />
          {!app && <aside aria-label="Struk" className={cn('hidden lg:sticky lg:top-4 lg:block', strukLeft && 'lg:order-first')}>{strukFor(false)}</aside>}
        </div>
      )}

      {/* Web sempit (< lg) & HP: struk lewat bar bawah */}
      {shop.products.length > 0 && (
        <div className={cn('fixed inset-x-3 z-40 mx-auto max-w-md', app ? 'bottom-[calc(env(safe-area-inset-bottom)+88px)]' : 'bottom-4 lg:hidden')}>
          <button type="button" onClick={() => setSheet(true)} className={cn('flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left shadow-xl transition-transform active:scale-[0.99]', count ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white dark:bg-slate-800')}>
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15"><ReceiptText size={18} />{count > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-extrabold text-emerald-700">{count}</span>}</span>
            <span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold text-white/70">{count ? `${count} item di struk` : 'Struk kosong'}</span><span className="block text-[16px] font-extrabold tabular-nums">{count ? formatIDR(sum) : 'Ketuk produk untuk mulai'}</span></span>
            {count > 0 && <span className="shrink-0 rounded-full bg-white px-3.5 py-2 text-[13px] font-extrabold text-emerald-700">Bayar</span>}
          </button>
        </div>
      )}

      {app ? (
        <>
          <BottomSheet isOpen={sheet} onClose={() => setSheet(false)} title="Struk"><div className="pb-[calc(env(safe-area-inset-bottom)+16px)]">{strukFor(true)}</div></BottomSheet>
          <BottomSheet isOpen={styling} onClose={() => setStyling(false)} title="Tampilan kasir"><div className="pb-[calc(env(safe-area-inset-bottom)+16px)]"><KasirStyleEditor shop={shop} onDone={(m) => { setStyling(false); say(m); }} onToast={say} onLeave={() => setStyling(false)} /></div></BottomSheet>
          <BottomSheet isOpen={manage} onClose={() => setManage(false)} title={`Kelola ${shop.name}`}><div className="pb-[calc(env(safe-area-inset-bottom)+16px)]"><ShopDetail shop={shop} sales={sales} onToast={say} onLeave={() => setManage(false)} onDeleted={() => router.replace(back)} /></div></BottomSheet>
        </>
      ) : (
        <>
          <Modal isOpen={sheet} onClose={() => setSheet(false)} title="Struk" maxWidth="max-w-md">{strukFor(true)}</Modal>
          <Modal isOpen={styling} onClose={() => setStyling(false)} title="Tampilan kasir" maxWidth="max-w-lg"><KasirStyleEditor shop={shop} onDone={(m) => { setStyling(false); say(m); }} onToast={say} onLeave={() => setStyling(false)} /></Modal>
          <Modal isOpen={manage} onClose={() => setManage(false)} title={`Kelola ${shop.name}`} maxWidth="max-w-xl"><ShopDetail shop={shop} sales={sales} onToast={say} onLeave={() => setManage(false)} onDeleted={() => router.replace(back)} /></Modal>
        </>
      )}

      {shop.style.showRecent && <RecentSales sales={todaySales} />}
    </div>
  );
}

// ── Katalog: chip kategori + cari + kartu produk (ketuk = +1 di struk) ─────────
const COLS: Record<number, string> = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-3 xl:grid-cols-4' };
const COLS_COMPACT: Record<number, string> = { 2: 'grid-cols-2 sm:grid-cols-3', 3: 'grid-cols-3 sm:grid-cols-4', 4: 'grid-cols-3 sm:grid-cols-4 xl:grid-cols-5' };
const CARD: Record<string, string> = {
  soft: 'bg-slate-50 ring-1 ring-slate-100 hover:bg-white hover:ring-violet-300 dark:bg-slate-800/60 dark:ring-slate-800 dark:hover:bg-slate-800',
  outline: 'bg-white ring-2 ring-slate-200 hover:ring-slate-400 dark:bg-slate-900 dark:ring-slate-700',
  solid: 'bg-white shadow-md shadow-slate-200/70 ring-1 ring-slate-100 hover:shadow-lg dark:bg-slate-800 dark:shadow-none dark:ring-slate-700',
};
function Catalog({ products, style, lines, onAdd }: { products: ShopProduct[]; style: KasirStyle; lines: Line[]; onAdd: (p: ShopProduct) => void }) {
  const groups = useMemo(() => {
    const g = groupProducts(products);
    const rank = (name: string) => { const k = style.categoryOrder.indexOf(name); return k < 0 ? 1000 : k; };
    return g.map((x, k) => ({ x, k })).sort((a, b) => rank(a.x.group) - rank(b.x.group) || a.k - b.k).map(({ x }) => x);
  }, [products, style.categoryOrder]);
  const named = groups.length > 1 || Boolean(groups[0]?.group);
  const [active, setActive] = useState<string | null>(null); // null = semua
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const qtyOf = (p: ShopProduct) => lines.find((l) => l.key === lineKey(p))?.qty ?? 0;
  const shown = groups
    .filter((g) => active === null || g.group === active)
    .map((g) => ({ ...g, items: q ? g.items.filter(({ p }) => `${g.group} ${p.name}`.toLowerCase().includes(q)) : g.items }))
    .filter((g) => g.items.length);

  return (
    <section className="min-w-0 space-y-3">
      {style.showSearch && <div className="flex items-center gap-2 rounded-2xl bg-white px-3.5 py-2.5 ring-1 ring-slate-100 focus-within:ring-2 focus-within:ring-violet-500 dark:bg-slate-900 dark:ring-slate-800">
        <Search size={16} className="shrink-0 text-slate-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={named ? 'Cari game atau nominal…' : 'Cari produk…'} aria-label="Cari produk" className="min-w-0 flex-1 bg-transparent text-[14px] font-semibold text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-400 dark:text-white" />
        {query && <button type="button" onClick={() => setQuery('')} aria-label="Hapus pencarian" className="text-slate-400"><X size={15} /></button>}
      </div>}

      {named && (
        <div role="tablist" aria-label="Kategori" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {[{ group: null as string | null, n: products.length }, ...groups.map((g) => ({ group: g.group as string | null, n: g.items.length }))].map(({ group, n }) => {
            const on = active === group;
            const label = group === null ? 'Semua' : group || 'Lainnya';
            return (
              <button key={label} type="button" role="tab" aria-selected={on} onClick={() => setActive(group)} className={cn('flex shrink-0 items-center gap-2 rounded-2xl py-1.5 pl-1.5 pr-3 text-[13px] font-bold transition-colors', on ? themeOf(style).chip : 'bg-white text-slate-700 ring-1 ring-slate-100 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800')}>
                <span className={cn('flex h-7 w-7 items-center justify-center rounded-xl text-[10px] font-extrabold', group === null ? 'bg-white/15 text-current' : toneOf(group || 'Lainnya'), group === null && !on && 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}>{group === null ? '✦' : initials(group || 'Lainnya')}</span>
                {label}<span className={cn('text-[11px] font-semibold', on ? 'text-white/60' : 'text-slate-400')}>{n}</span>
              </button>
            );
          })}
        </div>
      )}

      {shown.length === 0 && <p className="rounded-2xl bg-white py-8 text-center text-[13px] text-slate-500 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">Tidak ada yang cocok dengan &ldquo;{query}&rdquo;.</p>}
      {shown.map(({ group, items }) => (
        <div key={group || 'lain'} className="rounded-[26px] bg-white p-3 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800 md:p-4">
          {named && (
            <p className="mb-2.5 flex items-center gap-2 px-1">
              <span className={cn('flex h-8 w-8 items-center justify-center rounded-xl text-[11px] font-extrabold', toneOf(group || 'Lainnya'))}>{initials(group || 'Lainnya')}</span>
              <span className="text-[15px] font-extrabold text-slate-900 dark:text-white">{group || 'Lainnya'}</span>
              <span className="text-[12px] font-semibold text-slate-400">{items.length} pilihan</span>
            </p>
          )}
          {style.layout === 'list' ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map(({ p, i }) => {
                const n = qtyOf(p);
                return (
                  <li key={i}>
                    <button type="button" onClick={() => onAdd(p)} aria-label={`Tambah ${productLabel(p)} ke struk`} className={cn('flex w-full items-center gap-3 rounded-xl px-2 text-left transition-colors', style.size === 'besar' ? 'py-4 text-[16px]' : 'py-3', n ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60')}>
                      <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-bold text-slate-900 dark:text-white">{p.name}</span>{style.showUnit && p.unit && <span className="block text-[11px] text-slate-500 dark:text-slate-400">{p.unit}</span>}</span>
                      <span className="shrink-0 text-[14px] font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">{formatIDR(p.price)}</span>
                      <span className={cn('flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold', n ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800')}>{n ? `×${n}` : <Plus size={14} />}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <ul className={cn('grid gap-2', style.layout === 'compact' ? COLS_COMPACT[style.columns] : cn('grid-cols-2', COLS[style.columns]))}>
              {items.map(({ p, i }) => {
                const n = qtyOf(p);
                const compact = style.layout === 'compact';
                const big = style.size === 'besar' && !compact;
                return (
                  <li key={i}>
                    <button type="button" onClick={() => onAdd(p)} aria-label={`Tambah ${productLabel(p)} ke struk`} className={cn('relative flex h-full w-full flex-col items-start rounded-2xl text-left transition-all active:scale-[0.97]', compact ? 'p-2' : big ? 'min-h-[104px] p-4' : 'p-3', n ? 'bg-emerald-50 ring-2 ring-emerald-500 dark:bg-emerald-500/10' : CARD[style.card] ?? CARD.soft)}>
                      {n > 0 && <span className={cn('absolute flex min-w-6 items-center justify-center rounded-full bg-emerald-600 px-1.5 font-extrabold text-white', compact ? 'right-1 top-1 h-5 text-[10px]' : 'right-2 top-2 h-6 text-[11px]')}>×{n}</span>}
                      <span className={cn('line-clamp-2 font-bold leading-snug text-slate-900 dark:text-white', compact ? 'pr-5 text-[12px]' : big ? 'pr-7 text-[17px]' : 'pr-6 text-[14px]')}>{p.name}</span>
                      {style.showUnit && p.unit && !compact && <span className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{p.unit}</span>}
                      <span className={cn('mt-auto font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300', compact ? 'pt-1 text-[12px]' : big ? 'pt-3 text-[19px]' : 'pt-2 text-[15px]')}>{formatIDR(p.price)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}

// ── Struk: item, pembeli, total, rekening → catat; lalu tampil struk siap salin ──
function Struk({ shop, lines, sum, onAdd, setQty, clear, onDone, inSheet, onNew }: { shop: Shop; lines: Line[]; sum: number; onAdd: (p: ShopProduct) => void; setQty: (k: string, q: number) => void; clear: () => void; onDone: (m: string) => void; inSheet: boolean; onNew: () => void }) {
  const needBuyer = shop.products.some((p) => p.group);
  const [buyer, setBuyer] = useState('');
  const [override, setOverride] = useState<string | null>(null); // total diketik manual (diskon)
  const [accounts, setAccounts] = useState<{ id: string; name: string }[] | null>(null);
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(toLocalDateString());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [done, setDone] = useState<{ text: string; amount: number; buyer: string } | null>(null);
  const [manual, setManual] = useState<{ name: string; price: string } | null>(null);

  useEffect(() => {
    accountService.getUserAccounts('').then((list) => {
      const ok = list.filter((a) => a.id && !isCreditAccountType(a.type) && (a.currency || 'IDR') === 'IDR').map((a) => ({ id: String(a.id), name: a.name }));
      setAccounts(ok);
      let saved = '';
      try { saved = localStorage.getItem(`${ACC_KEY}:${shop.id}`) ?? ''; } catch { /* abaikan */ }
      setAccountId(ok.some((a) => a.id === saved) ? saved : ok[0]?.id ?? '');
    }).catch(() => setAccounts([]));
  }, [shop.id]);

  const total = override !== null ? Number(override || '0') : sum;
  const allLines = lines;
  const label = allLines.length === 1
    ? (allLines[0].group ? `${allLines[0].group} · ${allLines[0].name}` : allLines[0].name)
    : allLines.map((l) => `${l.name}${l.qty > 1 ? ` ×${l.qty}` : ''}`).join(', ');

  const save = async () => {
    if (!allLines.length) { setError('Pilih produk dulu.'); return; }
    if (total < 1) { setError('Total belum diisi.'); return; }
    if (needBuyer && !buyer.trim()) { setError('Isi nama / ID pembeli dulu.'); return; }
    if (!accountId) { setError('Pilih rekening tujuan.'); return; }
    setBusy(true);
    setError('');
    try {
      await shopService.sale(shop.id, {
        requestId, amount: total, qty: allLines.length === 1 ? allLines[0].qty : 1, product: label.slice(0, 80), buyer: buyer.trim(),
        items: allLines.map((l) => ({ name: l.group ? `${l.group} · ${l.name}` : l.name, price: l.price, qty: l.qty })), accountId, date,
      });
      try { localStorage.setItem(`${ACC_KEY}:${shop.id}`, accountId); } catch { /* abaikan */ }
      const text = [
        `🧾 *${shop.name}*`,
        new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }),
        ...(buyer.trim() ? [`Pembeli: ${buyer.trim()}`] : []),
        '',
        ...allLines.map((l) => `• ${l.group ? `${l.group} ` : ''}${l.name}${l.qty > 1 ? ` ×${l.qty}` : ''} — ${formatIDR(l.price * l.qty)}`),
        ...(total !== sum ? [`Potongan: −${formatIDR(Math.max(0, sum - total))}`] : []),
        `*Total: ${formatIDR(total)}*`,
        '',
        shop.style.receiptFooter || 'Terima kasih sudah belanja! 🙏',
      ].join('\n');
      setDone({ text, amount: total, buyer: buyer.trim() });
      onDone(`Penjualan ${formatIDR(total)} tercatat & masuk rekening.`);
    } catch (e) { setError(e instanceof Error && e.message ? e.message : 'Gagal mencatat.'); }
    setBusy(false);
  };
  const next = () => { clear(); setBuyer(''); setOverride(null); setDone(null); setError(''); setRequestId(crypto.randomUUID()); if (inSheet) onNew(); };
  const card = inSheet ? '' : 'rounded-[26px] bg-white p-4 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800';

  if (done) {
    return (
      <div className={cn(card, 'space-y-3 text-center')}>
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"><Check size={28} strokeWidth={3} /></span>
        <div><p className="text-[13px] font-semibold text-slate-500 dark:text-slate-400">Tercatat{done.buyer ? ` · ${done.buyer}` : ''}</p><p className="text-[28px] font-extrabold tabular-nums text-slate-900 dark:text-white">{formatIDR(done.amount)}</p></div>
        <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-2xl bg-slate-50 p-3 text-left font-sans text-[12px] leading-relaxed text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">{done.text}</pre>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => { navigator.clipboard.writeText(done.text).then(() => onDone('Struk tersalin — kirim ke pembeli.'), () => onDone('Tidak bisa menyalin otomatis.')); }} className="flex items-center justify-center gap-1.5 rounded-full bg-slate-100 py-3 text-[13px] font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"><Copy size={14} /> Salin struk</button>
          <button type="button" onClick={next} className="flex items-center justify-center gap-1.5 rounded-full bg-emerald-600 py-3 text-[13px] font-bold text-white hover:bg-emerald-700"><Plus size={14} /> Transaksi baru</button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(card, 'space-y-3')}>
      <div className={cn('flex items-center', inSheet ? 'justify-end' : 'justify-between')}>
        {!inSheet && <p className="flex items-center gap-1.5 text-[15px] font-extrabold text-slate-900 dark:text-white"><ReceiptText size={17} className="text-emerald-600" /> Struk</p>}
        {allLines.length > 0 && <button type="button" onClick={() => { clear(); setOverride(null); }} className="flex items-center gap-1 text-[12px] font-bold text-slate-400 hover:text-rose-500"><Trash2 size={13} /> Kosongkan</button>}
      </div>
      {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</p>}

      {allLines.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-slate-200 px-4 py-6 text-center text-[13px] text-slate-400 dark:border-slate-700">Ketuk produk di katalog untuk memasukkan ke struk.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {allLines.map((l) => (
            <li key={l.key} className="flex items-center gap-2 py-2">
              <span className="min-w-0 flex-1">
                {l.group && <span className="block truncate text-[11px] font-semibold text-slate-400">{l.group}</span>}
                <span className="block truncate text-[14px] font-bold text-slate-900 dark:text-white">{l.name}</span>
                <span className="block text-[12px] tabular-nums text-slate-500 dark:text-slate-400">{formatIDR(l.price)}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800">
                <button type="button" onClick={() => { setQty(l.key, l.qty - 1); setOverride(null); }} aria-label={`Kurangi ${l.name}`} className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300">{l.qty === 1 ? <Trash2 size={13} /> : <Minus size={13} />}</button>
                <span className="w-6 text-center text-[13px] font-extrabold tabular-nums text-slate-900 dark:text-white">{l.qty}</span>
                <button type="button" onClick={() => { setQty(l.key, l.qty + 1); setOverride(null); }} aria-label={`Tambah ${l.name}`} className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300"><Plus size={13} /></button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {manual ? (
        <div className="grid grid-cols-[1fr_100px_auto] gap-1.5">
          <input value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} maxLength={60} placeholder="Item lain" aria-label="Nama item" className={cn(fieldCls, 'px-3 py-2 text-[13px]')} />
          <input value={manual.price ? Number(manual.price).toLocaleString('id-ID') : ''} onChange={(e) => setManual({ ...manual, price: e.target.value.replace(/\D/g, '').slice(0, 10) })} inputMode="numeric" placeholder="Harga" aria-label="Harga item" className={cn(fieldCls, 'px-3 py-2 text-[13px] tabular-nums')} />
          <button type="button" disabled={!manual.name.trim() || !Number(manual.price)} onClick={() => { onAdd({ name: manual.name.trim(), price: Number(manual.price), unit: '' }); setManual(null); setOverride(null); }} aria-label="Masukkan item" className="rounded-full bg-emerald-600 px-3 text-white disabled:opacity-40"><Check size={15} /></button>
        </div>
      ) : (
        <button type="button" onClick={() => setManual({ name: '', price: '' })} className="flex items-center gap-1 text-[12px] font-bold text-violet-600 dark:text-violet-300"><Plus size={13} /> Item di luar katalog</button>
      )}

      <label className="block"><span className={labelCls}>{needBuyer ? 'Nama / ID pembeli' : 'Pembeli (opsional)'}</span><input value={buyer} onChange={(e) => { setBuyer(e.target.value); setError(''); }} maxLength={60} placeholder={needBuyer ? 'mis. 123456789 (2001) · Budi' : 'Nama pembeli'} className={fieldCls} /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block"><span className={labelCls}>Masuk ke</span><select value={accountId} onChange={(e) => setAccountId(e.target.value)} disabled={accounts === null} className={fieldCls}>{(accounts ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <label className="block"><span className={labelCls}>Tanggal</span><input type="date" value={date} max={toLocalDateString()} onChange={(e) => setDate(e.target.value)} className={fieldCls} /></label>
      </div>
      <div className="rounded-2xl bg-emerald-50 p-3 dark:bg-emerald-500/10">
        <label className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-bold text-emerald-900 dark:text-emerald-200">Total diterima</span>
          <span className="flex min-w-0 items-center gap-1 text-[22px] font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">
            <span className="text-[14px]">Rp</span>
            <input value={total ? total.toLocaleString('id-ID') : ''} onChange={(e) => setOverride(e.target.value.replace(/\D/g, '').slice(0, 11))} inputMode="numeric" aria-label="Total diterima" className="w-36 min-w-0 bg-transparent text-right outline-none" />
          </span>
        </label>
        {override !== null && total !== sum && <p className="mt-1 flex items-center justify-between text-[11px] text-emerald-800/70 dark:text-emerald-300/70"><span>Harga katalog {formatIDR(sum)}{total < sum ? ` · potongan ${formatIDR(sum - total)}` : ''}</span><button type="button" onClick={() => setOverride(null)} className="font-bold underline">Pakai harga katalog</button></p>}
      </div>
      <button type="button" onClick={save} disabled={busy || !allLines.length} className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 py-3.5 text-[15px] font-extrabold text-white hover:bg-emerald-700 disabled:opacity-40">{busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Bayar & catat</button>
      <p className="text-center text-[11px] text-slate-400">Masuk sebagai pemasukan Usaha & Freelance › Penjualan.</p>
    </div>
  );
}

function RecentSales({ sales }: { sales: Transaction[] }) {
  if (!sales.length) return null;
  const list = [...sales].sort((a, b) => new Date(b.createdAt ?? b.date).getTime() - new Date(a.createdAt ?? a.date).getTime()).slice(0, 10);
  return (
    <section className="rounded-[26px] bg-white p-4 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
      <p className="text-[14px] font-extrabold text-slate-900 dark:text-white">Penjualan hari ini</p>
      <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
        {list.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
            <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-slate-700 dark:text-slate-200">
              {(t.note ?? '').endsWith(' · via website') && <span className="shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">🌐 Website</span>}
              <span className="truncate">{(t.note ?? '').replace(/^\[[^\]]*\]\s*/, '').replace(/ · via website$/, '') || 'Penjualan'}</span>
            </span>
            <span className="shrink-0 text-[13px] font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">+{formatIDR(Math.round(amt(t)))}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
