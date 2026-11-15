'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  BarChart3,
  LayoutDashboard,
  Menu,
  NotebookPen,
  Package,
  ReceiptText,
  Settings,
  Store,
  Wallet,
  X,
} from 'lucide-react';
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
import { BerandaUsaha, MulaiBukuUsaha, type BerandaView } from './BerandaUsaha';
import { PengaturanUsaha } from './PengaturanUsaha';
import { UsahaSheet } from './UsahaSheet';

// Usahaku — layar penuh sendiri (keluar dari Ladangku, keputusan Bos 2026-11-10).
// Tanpa ?id: daftar toko (tanpa angka uang). Dengan ?id: menu samping (bagian di hash); Kasir = layar penuh sendiri.
// Rancangan: docs/rancangan/usahaku-pembukuan.md.
const TABS = [
  { id: 'beranda', label: 'Ringkasan', icon: LayoutDashboard, group: 'Toko', desc: 'Omzet, laba, dan yang perlu ditindaklanjuti' },
  { id: 'kasir', label: 'Kasir', icon: Store, group: 'Toko', desc: 'Catat penjualan' },
  { id: 'tagihan', label: 'Pesanan & Bon', icon: NotebookPen, group: 'Toko', desc: 'Pesanan, bon pelanggan, dan uang marketplace yang belum cair', book: true },
  { id: 'biaya', label: 'Biaya', icon: ReceiptText, group: 'Keuangan', desc: 'Pengeluaran usaha dan utang ke supplier', book: true },
  { id: 'kas', label: 'Kas', icon: Wallet, group: 'Keuangan', desc: 'Saldo kas usaha, setor modal, ambil uang, pindah kas', book: true },
  { id: 'stok', label: 'Stok', icon: Package, group: 'Keuangan', desc: 'Bahan, resep, dan pergerakan stok' },
  { id: 'laporan', label: 'Laporan', icon: BarChart3, group: 'Analisis', desc: 'Laporan usaha per periode, bisa diunduh Excel' },
  { id: 'pengaturan', label: 'Pengaturan', icon: Settings, group: 'Analisis', desc: 'Profil toko, kas, katalog, dan tim' },
] as const;
type TabId = (typeof TABS)[number]['id'];
const VIEW_OF: Partial<Record<TabId, BerandaView>> = { beranda: 'ringkasan', tagihan: 'tagihan', biaya: 'biaya', kas: 'kas' };

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
  const [drawer, setDrawer] = useState(false);
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

  useEffect(() => {
    if (!drawer) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [drawer]);

  const go = (t: TabId) => {
    setTab(t);
    setDrawer(false);
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
        <header className="mb-6 md:mb-8">
          <Link
            href={app ? '/app/more' : '/membership/dashboard'}
            className="inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 fs-13 font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <ArrowLeft size={15} /> {app ? 'Kembali' : 'Ringkasan'}
          </Link>
          <h1 className="mt-3 fsh-28 font-black tracking-tight text-slate-900 md:fsh-32 dark:text-white">Usahaku</h1>
          <p className="mt-1 fs-14 text-slate-500 dark:text-slate-400">Toko & pembukuan usaha, terpisah dari uang pribadi.</p>
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
  const tabs = TABS.filter((t) => (t.id !== 'stok' || !kind || kind.stok) && (!('book' in t) || bookOn));
  const kasList = book?.accounts.filter((a) => !a.archived).map((a) => ({ id: a.id, name: a.name }));
  const current = tabs.find((t) => t.id === tab) ?? tabs[0];
  const view = VIEW_OF[current.id];
  // Lencana angka di menu: yang menunggu tindakan (bukan nominal uang).
  const badge: Partial<Record<TabId, number>> = book
    ? {
        tagihan: book.pending.filter((e) => !(e.type === 'biaya' && e.payMethod === 'tempo')).length,
        biaya: book.pending.filter((e) => e.type === 'biaya' && e.payMethod === 'tempo').length,
      }
    : {};

  const buySheet = (
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
  );

  // ── Kasir: layar penuh, hanya kasir ──
  if (current.id === 'kasir')
    return (
      <div className={cn(wrap, 'max-w-7xl')}>
        <KasirView variant={variant} onToast={say} embedded onExit={() => go('beranda')} />
        {toastEl}
      </div>
    );

  const navList = (
    <nav aria-label={`Menu ${shop.name}`} className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {(['Toko', 'Keuangan', 'Analisis'] as const).map((g) => {
        const items = tabs.filter((t) => t.group === g);
        if (!items.length) return null;
        return (
          <div key={g}>
            <p className="px-3 pb-1.5 fs-11 font-bold uppercase tracking-[0.12em] text-slate-400">{g}</p>
            <ul className="space-y-0.5">
              {items.map((t) => {
                const active = t.id === current.id;
                const n = badge[t.id] ?? 0;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => go(t.id)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left fs-14 font-semibold transition-colors',
                        active
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
                      )}
                    >
                      <t.icon size={18} strokeWidth={active ? 2.3 : 1.9} className="shrink-0" />
                      <span className="flex-1 truncate">{t.label}</span>
                      {t.id === 'kasir' && (
                        <span className={cn('fs-10 font-bold uppercase', active ? 'text-white/60' : 'text-emerald-600 dark:text-emerald-400')}>
                          Buka
                        </span>
                      )}
                      {n > 0 && (
                        <span
                          className={cn(
                            'min-w-5 rounded-full px-1.5 text-center fs-11 font-bold tabular-nums',
                            active ? 'bg-white/20 text-white dark:bg-slate-900/15 dark:text-slate-900' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
                          )}
                        >
                          {n}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
  const sidebar = (
    <>
      <div className="border-b border-slate-200/80 px-4 pb-4 pt-4 dark:border-slate-800">
        <Link
          href={`${base}/usahaku`}
          className="inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 fs-12 font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <ArrowLeft size={14} /> Semua toko
        </Link>
        <div className="mt-3 flex items-center gap-3 px-1">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50 fsh-22 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
            <CatalogImage src={shop.style.logoUrl} alt="" fallback={shop.emoji || kind?.emoji || '🏪'} className="h-full w-full bg-white p-0.5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate fs-15 font-extrabold tracking-tight text-slate-900 dark:text-white">{shop.name}</span>
            <span className="block truncate fs-12 text-slate-500 dark:text-slate-400">{kind ? kind.label : 'Usaha'}</span>
          </span>
        </div>
      </div>
      {navList}
      <div className="border-t border-slate-200/80 px-4 py-3 dark:border-slate-800">
        <p className="flex items-center gap-2 fs-12 text-slate-500 dark:text-slate-400">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', bookOn ? 'bg-emerald-500' : 'bg-amber-500')} />
          {bookOn ? 'Buku usaha terpisah' : 'Masih tercatat di keuangan pribadi'}
        </p>
      </div>
    </>
  );
  const asideCls = 'flex flex-col bg-white dark:bg-slate-900';

  return (
    <div className="min-h-screen">
      {/* Desktop: menu samping tetap */}
      <aside className={cn(asideCls, 'fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200/80 lg:flex dark:border-slate-800 print:hidden')}>
        {sidebar}
      </aside>
      {/* HP/tablet: laci */}
      {drawer && (
        <div className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true" aria-label={`Menu ${shop.name}`}>
          <button type="button" aria-label="Tutup menu" onClick={() => setDrawer(false)} className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" />
          <aside
            className={cn(
              asideCls,
              'absolute inset-y-0 left-0 w-[min(18rem,85vw)] shadow-2xl',
              app && 'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]',
            )}
          >
            <button
              type="button"
              onClick={() => setDrawer(false)}
              aria-label="Tutup menu"
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              style={app ? { marginTop: 'env(safe-area-inset-top)' } : undefined}
            >
              <X size={18} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header
          className={cn(
            'sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85 print:hidden',
            app && 'pt-[env(safe-area-inset-top)]',
          )}
        >
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 md:px-8">
            <button
              type="button"
              onClick={() => setDrawer(true)}
              aria-label="Buka menu toko"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 lg:hidden dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800"
            >
              <Menu size={19} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate fs-12 font-semibold text-slate-400 lg:hidden">{shop.name}</p>
              <h1 className="truncate fsh-20 font-extrabold tracking-tight text-slate-900 md:fsh-22 dark:text-white">{current.label}</h1>
              <p className="hidden truncate fs-12 text-slate-500 md:block dark:text-slate-400">{current.desc}</p>
            </div>
            <button
              type="button"
              onClick={() => go('kasir')}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 fs-13 font-bold text-white hover:bg-emerald-700 sm:px-4"
            >
              <Store size={16} /> <span className="hidden sm:inline">Buka kasir</span>
              <span className="sm:hidden">Kasir</span>
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-24 pt-5 md:px-8 md:pt-6">
          {view &&
            (bookOn && book ? (
              <BerandaUsaha
                shop={shop}
                book={book}
                variant={variant}
                view={view}
                onNav={go}
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
          {current.id === 'stok' && (
            <div className="rounded-[28px] bg-white p-4 ring-1 ring-slate-100 md:p-5 dark:bg-slate-900 dark:ring-slate-800">
              <StockView shop={shop} data={stock} reload={loadStock} onToast={say} onBuy={(m) => setBuyMat(m.id)} />
            </div>
          )}
          {current.id === 'laporan' && <LaporanUsaha variant={variant} embedded />}
          {current.id === 'pengaturan' && (
            <div className="space-y-5">
              <PengaturanUsaha shop={shop} accounts={book?.accounts ?? null} onToast={say} />
              <div className="rounded-[28px] bg-white p-4 ring-1 ring-slate-100 md:p-6 dark:bg-slate-900 dark:ring-slate-800">
                <ShopDetail
                  shop={shop}
                  sales={[]}
                  onToast={say}
                  onLeave={() => go('beranda')}
                  onDeleted={() => router.push(`${base}/usahaku`)}
                />
              </div>
            </div>
          )}
        </main>
      </div>

      {buySheet}
      {toastEl}
    </div>
  );
}
