'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, BarChart3, Home, Package, Settings, Store } from 'lucide-react';
import { KasirView } from '@/components/ladang/KasirView';
import { LaporanUsaha } from '@/components/ladang/LaporanUsaha';
import { StockView } from '@/components/ladang/StockView';
import { ExpenseForm } from '@/components/ladang/ExpenseForm';
import { ShopDetail, UsahaView } from '@/components/ladang/UsahaView';
import { CatalogImage } from '@/components/ladang/CatalogImage';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { shopService, type Shop } from '@/lib/services/shopService';
import { shopBookService, type ShopBook } from '@/lib/services/shopBookService';
import { stockService, type StockData } from '@/lib/services/stockService';
import { kindOf } from '@/lib/usaha/jenis';
import { cn } from '@/lib/utils';
import { BerandaUsaha, MulaiBukuUsaha } from './BerandaUsaha';
import { PengaturanUsaha } from './PengaturanUsaha';
import { UsahaSheet } from './UsahaSheet';

// Usahaku — layar penuh sendiri (keluar dari Ladangku, keputusan Bos 2026-11-10).
// Tanpa ?id: daftar usaha. Dengan ?id: Beranda · Kasir · Stok · Laporan (tab di hash) + ⚙️ Pengaturan.
// Rancangan: docs/rancangan/usahaku-pembukuan.md.
const TABS = [
  { id: 'beranda', label: 'Beranda', icon: Home },
  { id: 'kasir', label: 'Kasir', icon: Store },
  { id: 'stok', label: 'Stok', icon: Package },
  { id: 'laporan', label: 'Laporan', icon: BarChart3 },
] as const;
type TabId = (typeof TABS)[number]['id'];

export function UsahakuApp({ variant }: { variant: 'web' | 'app' }) {
  const app = variant === 'app';
  const base = app ? '/app' : '/membership';
  const router = useRouter();
  // ?id dibaca lewat useSearchParams supaya pindah usaha (Link di daftar) langsung terbaca tanpa muat ulang.
  const params = useSearchParams();
  const id = params.get('id') ?? '';
  const [tab, setTab] = useState<TabId>('beranda');
  const [shops, setShops] = useState<Shop[] | null>(null);
  const [error, setError] = useState('');
  const [book, setBook] = useState<ShopBook | null>(null);
  const [stock, setStock] = useState<StockData | null>(null);
  const [settings, setSettings] = useState(false);
  const [buyMat, setBuyMat] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const say = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(''), 3500);
  }, []);

  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1);
      setTab(TABS.some((t) => t.id === h) ? (h as TabId) : 'beranda');
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, [id]);

  useEffect(() => {
    let alive = true;
    const load = () =>
      shopService
        .list()
        .then((r) => {
          if (alive) {
            setShops(r);
            setError('');
          }
        })
        .catch((e) => {
          if (alive) {
            setShops((p) => p ?? []);
            setError(e instanceof Error ? e.message : 'Gagal memuat usaha.');
          }
        });
    void load();
    const u = subscribeToCollectionChanges('shops', load);
    return () => {
      alive = false;
      u();
    };
  }, []);

  const shop = id ? shops?.find((s) => s.id === id) : undefined;
  const bookOn = Boolean(shop?.bookOn);
  // Rentang data Beranda (tarik per tanggal/bulan). null = bulan ini (bawaan server).
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const loadBook = useCallback(async () => {
    if (!id || !bookOn) return setBook(null);
    try {
      setBook(await shopBookService.get(id, range ?? undefined));
    } catch (e) {
      say(e instanceof Error ? e.message : 'Gagal memuat buku usaha.');
    }
  }, [id, bookOn, say, range]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- muat buku saat usaha dibuka
    void loadBook();
    return subscribeToCollectionChanges('shop_book', loadBook);
  }, [loadBook]);
  const loadStock = useCallback(async () => {
    if (!id) return;
    try {
      setStock(await stockService.get(id));
    } catch {
      setStock((p) => p ?? { materials: [], recipes: [], moves: [] });
    }
  }, [id]);
  useEffect(() => {
    if (tab !== 'stok') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- muat stok saat tab Stok dibuka
    void loadStock();
    return subscribeToCollectionChanges('shop_stock', loadStock);
  }, [tab, loadStock]);

  const go = (t: TabId) => {
    setTab(t);
    window.scrollTo(0, 0);
    try {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${t}`);
    } catch {
      /* abaikan */
    }
  };

  const wrap = cn(
    'mx-auto min-h-screen max-w-6xl px-4 md:px-8',
    app ? 'pt-[calc(env(safe-area-inset-top)+16px)]' : 'pt-4 md:pt-6',
  );
  const backBtn = (href: string, label: string) => (
    <Link
      href={href}
      aria-label={label}
      className="web-keep group flex h-11 items-center gap-1.5 rounded-full bg-slate-950 pl-2 pr-2 fs-13 font-semibold text-white shadow-sm hover:bg-slate-800 sm:pr-4"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 transition-transform group-hover:-translate-x-0.5">
        <ArrowLeft size={16} />
      </span>
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
  const toastEl = toast ? (
    <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+96px)] z-[90] flex justify-center px-4">
      <div role="status" className="rounded-full bg-slate-900 px-4 py-2.5 fs-13 font-semibold text-white shadow-xl dark:bg-white dark:text-slate-900">
        {toast}
      </div>
    </div>
  ) : null;

  // ── Daftar usaha ──
  if (!id) {
    return (
      <div className={cn(wrap, 'pb-32')}>
        <header className="mb-4 grid grid-cols-[auto_1fr_auto] items-center gap-3 md:mb-5">
          {backBtn(app ? '/app/more' : '/membership/dashboard', app ? 'Kembali' : 'Ringkasan')}
          <div className="min-w-0 text-center">
            <h1 className="truncate fsh-20 font-extrabold tracking-tight text-slate-900 md:fsh-24 dark:text-white">Usahaku</h1>
            <p className="truncate fs-12 text-slate-500 dark:text-slate-400">Toko & pembukuan usaha, terpisah dari uang pribadi</p>
          </div>
          <span className="w-11" />
        </header>
        <UsahaView variant={variant} onToast={say} />
        {toastEl}
      </div>
    );
  }

  if (shops === null) return <div className={wrap}><div className="h-72 animate-pulse rounded-[28px] bg-slate-200/70 dark:bg-slate-800" /></div>;
  if (!shop)
    return (
      <div className={wrap}>
        <div className="rounded-[28px] bg-white p-8 text-center ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
          <p className="fs-15 font-bold text-slate-900 dark:text-white">{error || 'Usaha tidak ditemukan.'}</p>
          <Link href={`${base}/usahaku`} className="mt-3 inline-flex items-center gap-1 fs-13 font-bold text-violet-600">
            <ArrowLeft size={15} /> Semua usaha
          </Link>
        </div>
      </div>
    );

  const kind = kindOf(shop.kind);
  const tabs = TABS.filter((t) => t.id !== 'stok' || !kind || kind.stok);
  const kasList = book?.accounts.filter((a) => !a.archived).map((a) => ({ id: a.id, name: a.name }));

  return (
    <div className={cn(wrap, 'pb-36')}>
      {tab !== 'kasir' && (
        <header className="mb-4 grid grid-cols-[auto_1fr_auto] items-center gap-3 md:mb-5">
          {backBtn(`${base}/usahaku`, 'Semua usaha')}
          <div className="min-w-0 text-center">
            <h1 className="flex items-center justify-center gap-2 fsh-20 font-extrabold tracking-tight text-slate-900 md:fsh-24 dark:text-white">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl fsh-20 md:h-9 md:w-9">
                <CatalogImage src={shop.style.logoUrl} alt="" fallback={shop.emoji || kind?.emoji || '🏪'} className="h-full w-full" />
              </span>
              <span className="truncate">{shop.name}</span>
            </h1>
            <p className="truncate fs-12 text-slate-500 dark:text-slate-400">
              {kind ? kind.label : 'Usahaku'} · {bookOn ? 'buku usaha terpisah' : 'masih tercatat di keuangan pribadi'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSettings(true)}
            aria-label="Pengaturan usaha"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800"
          >
            <Settings size={19} />
          </button>
        </header>
      )}

      <main>
        {tab === 'beranda' &&
          (bookOn && book ? (
            <BerandaUsaha
              shop={shop}
              book={book}
              variant={variant}
              onToast={say}
              onOpenKasir={() => go('kasir')}
              onRange={setRange}
            />
          ) : bookOn ? (
            <div className="h-72 animate-pulse rounded-[28px] bg-slate-200/70 dark:bg-slate-800" />
          ) : shop.bookReady ? (
            <MulaiBukuUsaha shop={shop} onDone={say} />
          ) : (
            <p className="rounded-[26px] bg-amber-50 p-5 fs-14 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              Buku usaha sedang disiapkan di server. Sementara ini kasir tetap jalan seperti biasa (penjualan masuk rekening
              pribadi).
            </p>
          ))}
        {tab === 'kasir' && <KasirView variant={variant} onToast={say} embedded />}
        {tab === 'stok' && (
          <div className="rounded-[28px] bg-white p-4 ring-1 ring-slate-100 md:p-5 dark:bg-slate-900 dark:ring-slate-800">
            <StockView shop={shop} data={stock} reload={loadStock} onToast={say} onBuy={(m) => setBuyMat(m.id)} />
          </div>
        )}
        {tab === 'laporan' && <LaporanUsaha variant={variant} embedded />}
      </main>

      <UsahaSheet variant={variant} open={buyMat !== null} onClose={() => setBuyMat(null)} title="Beli bahan / stok">
        {buyMat !== null && (
          <ExpenseForm
            shop={shop}
            materials={(stock?.materials ?? []).filter((m) => !m.archived_at)}
            initialMaterialId={buyMat}
            kasList={kasList}
            onSave={(input) => shopService.expense(shop.id, { ...input, accountId: input.accountId ?? '', book: Boolean(kasList) })}
            onDone={(m) => {
              setBuyMat(null);
              say(m);
              void loadStock();
            }}
            onCancel={() => setBuyMat(null)}
          />
        )}
      </UsahaSheet>

      <UsahaSheet variant={variant} open={settings} onClose={() => setSettings(false)} title={`Pengaturan ${shop.name}`} wide>
        <div className="space-y-5">
          <PengaturanUsaha shop={shop} accounts={book?.accounts ?? null} onToast={say} />
          <ShopDetail
            shop={shop}
            sales={[]}
            onToast={say}
            onLeave={() => setSettings(false)}
            onDeleted={() => {
              setSettings(false);
              router.push(`${base}/usahaku`);
            }}
          />
        </div>
      </UsahaSheet>

      {toastEl}
      <nav
        aria-label="Menu Usahaku"
        className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+16px)] z-40 flex justify-center px-4 print:hidden"
      >
        <div className="web-keep flex items-center gap-1 rounded-full bg-slate-950/85 p-1.5 shadow-[0_20px_50px_-12px_rgba(2,6,23,0.6)] ring-1 ring-white/10 backdrop-blur-xl">
          {tabs.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => go(t.id)}
                aria-current={active ? 'page' : undefined}
                aria-label={t.label}
                className={cn(
                  'relative flex h-12 items-center justify-center gap-2 rounded-full fs-13 font-bold transition-all',
                  active ? 'bg-gradient-to-r from-emerald-400 to-teal-300 px-4 text-slate-950' : 'w-12 text-white/70 hover:bg-white/10',
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
