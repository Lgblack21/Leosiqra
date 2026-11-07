'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ChevronRight,
  KeyRound,
  LayoutGrid,
  Loader2,
  LogOut,
  Package,
  ReceiptText,
  Store,
  Wallet,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { staffService, staffStockService, type StaffMe, type StaffSale } from '@/lib/services/staffService';
import { ExpenseForm } from '@/components/ladang/ExpenseForm';
import { StockView } from '@/components/ladang/StockView';
import { fmtQty, isLow, type StockData, type StockMaterial } from '@/lib/services/stockService';
import type { Shop, ShopProduct } from '@/lib/services/shopService';
import { Catalog, Struk, lineKey, type Line } from '@/components/ladang/KasirView';
import { CustomKasirFrame } from '@/components/ladang/CustomKasirFrame';
import { CatalogImage } from '@/components/ladang/CatalogImage';
import { KASIR_THEME } from '@/components/ladang/kasirTheme';
import { fieldCls, labelCls, short } from '@/components/ladang/UsahaView';
import { cn, formatIDR } from '@/lib/utils';

// Halaman akun TIM — /tim. Terpisah dari akun pemilik: login username "toko-nama",
// lalu hanya: Ringkas (penjualan & biaya hari ini), Kasir (usaha yang diberikan:
// jual, catat pengeluaran) dan Stok (lihat, tambah bahan, masuk/pakai/hitung, beli).
// Tanpa saldo, rekening (selain nama tujuan yang dikunci pemilik), transaksi lain,
// Tagih, atau Jual barang. Semua yang dicatat tim bertanda "oleh <nama>".

type Tab = 'ringkas' | 'kasir' | 'stok';
const noteText = (n: string | null) => (n ?? '').replace(/^\[[^\]]*\]\s*/, '') || 'Penjualan';
const isCost = (t: StaffSale) => t.type === 'pengeluaran';
const sumOf = (list: StaffSale[]) => list.reduce((a, t) => a + Number(t.amount || 0), 0);
const themeHeader = (s: Shop) => (KASIR_THEME[s.style.theme] ?? KASIR_THEME.ungu).header;
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?';
const card = 'rounded-[22px] bg-white ring-1 ring-slate-100';

function TodayList({ list, title, empty }: { list: StaffSale[]; title: string; empty?: string }) {
  if (!list.length)
    return empty ? <p className={cn(card, 'p-5 text-center text-[13px] text-slate-400')}>{empty}</p> : null;
  return (
    <div className={cn(card, 'p-4')}>
      <p className="text-[14px] font-extrabold text-slate-900">{title}</p>
      <ul className="mt-2 divide-y divide-slate-100">
        {list.slice(0, 30).map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
            <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-slate-700">
              {isCost(t) && (
                <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                  Biaya
                </span>
              )}
              <span className="truncate">{noteText(t.note)}</span>
            </span>
            <span
              className={cn(
                'shrink-0 text-[13px] font-extrabold tabular-nums',
                isCost(t) ? 'text-rose-600' : 'text-emerald-700',
              )}
            >
              {isCost(t) ? '−' : '+'}
              {formatIDR(Number(t.amount || 0))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ShopChips({
  shops,
  value,
  onChange,
  lowBy,
}: {
  shops: Shop[];
  value: string;
  onChange: (id: string) => void;
  lowBy: Record<string, number>;
}) {
  if (shops.length < 2) return null;
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
      {shops.map((s) => {
        const on = s.id === value;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id)}
            aria-pressed={on}
            className={cn(
              'web-keep flex shrink-0 items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-[13px] font-bold transition-all',
              on ? cn(themeHeader(s), 'text-white shadow-md') : 'bg-white text-slate-600 ring-1 ring-slate-200',
            )}
          >
            <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-white/90 text-[14px]">
              <CatalogImage src={s.style.logoUrl} alt="" fallback={s.emoji || '🏪'} className="h-full w-full p-0.5" />
            </span>
            {s.name}
            {lowBy[s.id] > 0 && (
              <span className="rounded-full bg-amber-400 px-1.5 text-[10px] font-extrabold text-slate-900">
                {lowBy[s.id]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function StaffApp() {
  const [me, setMe] = useState<StaffMe | null>(null);
  const [state, setState] = useState<'loading' | 'login' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('kasir');
  const [shopId, setShopId] = useState('');
  const [pw, setPw] = useState(false);
  const [flash, setFlash] = useState('');
  const say = (m: string) => {
    setFlash(m);
    window.setTimeout(() => setFlash(''), 3500);
  };

  const load = useCallback(async () => {
    try {
      const r = await staffService.me();
      setMe(r);
      setState('ready');
      setShopId((cur) => (r.shops.some((s) => s.id === cur) ? cur : (r.shops[0]?.id ?? '')));
    } catch (e) {
      const m = e instanceof Error ? e.message : '';
      if (/Unauthorized/i.test(m)) setState('login');
      else {
        setError(m || 'Gagal memuat.');
        setState('error');
      }
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- muat sesi tim sekali saat halaman dibuka
    void load();
  }, [load]);

  if (state === 'loading')
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin text-slate-400" />
      </div>
    );
  if (state === 'login') return <StaffLogin onDone={load} />;
  if (state === 'error' || !me)
    return <div className="mx-auto max-w-sm p-8 text-center text-[14px] text-rose-600">{error}</div>;

  const shop = me.shops.find((s) => s.id === shopId) ?? null;
  const logout = async () => {
    await staffService.logout().catch(() => undefined);
    setMe(null);
    setShopId('');
    setState('login');
  };
  const lowBy: Record<string, number> = {};
  for (const m of me.materials ?? []) if (isLow(m)) lowBy[m.shop_id] = (lowBy[m.shop_id] ?? 0) + 1;
  const lowAll = Object.values(lowBy).reduce((a, b) => a + b, 0);
  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
  const go = (t: Tab, id?: string) => {
    if (id) setShopId(id);
    setTab(t);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 pb-48 pt-4 md:px-8 lg:pb-32">
      {flash && (
        <div
          role="status"
          className="fixed inset-x-4 top-4 z-[95] mx-auto max-w-sm rounded-2xl bg-slate-900 px-4 py-3 text-center text-[13px] font-semibold text-white shadow-lg"
        >
          {flash}
        </div>
      )}

      <header className="mb-4 flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-[15px] font-extrabold text-white shadow-sm">
          {initials(me.staff.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-extrabold text-slate-900">Halo, {me.staff.name} 👋</p>
          <p className="truncate text-[12px] text-slate-500">
            {today}
            {me.owner ? ` · tim ${me.owner}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPw(true)}
          aria-label="Ganti sandi"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-600 ring-1 ring-slate-100 hover:bg-slate-50"
        >
          <KeyRound size={16} />
        </button>
        <button
          type="button"
          onClick={logout}
          aria-label="Keluar"
          className="flex h-10 items-center gap-1.5 rounded-full bg-white px-3 text-[12px] font-bold text-slate-600 ring-1 ring-slate-100 hover:bg-slate-50"
        >
          <LogOut size={15} /> <span className="hidden sm:inline">Keluar</span>
        </button>
      </header>

      {me.shops.length === 0 ? (
        <div className={cn(card, 'p-8 text-center')}>
          <Store size={28} className="mx-auto text-slate-300" />
          <p className="mt-2 text-[15px] font-bold text-slate-900">Belum ada usaha untukmu</p>
          <p className="mt-1 text-[13px] text-slate-500">Minta pemilik usaha memberi akses di Usahaku › Tim.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tab !== 'ringkas' && <ShopChips shops={me.shops} value={shopId} onChange={setShopId} lowBy={lowBy} />}
          {tab === 'ringkas' && <StaffRingkas me={me} lowBy={lowBy} go={go} />}
          {tab === 'kasir' && shop && (
            <StaffKasir
              key={shop.id}
              shop={shop}
              me={me}
              low={lowBy[shop.id] ?? 0}
              onStock={() => go('stok')}
              onSold={(m) => {
                say(m);
                void load();
              }}
              say={say}
            />
          )}
          {tab === 'stok' && shop && <StaffStock key={shop.id} shop={shop} me={me} say={say} onChanged={load} />}
        </div>
      )}

      <nav
        aria-label="Menu tim"
        className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+16px)] z-40 flex justify-center px-4"
      >
        <div className="flex items-center gap-1 rounded-full bg-slate-950/85 p-1.5 shadow-xl ring-1 ring-white/10 backdrop-blur-xl">
          {(
            [
              ['ringkas', 'Ringkas', LayoutGrid],
              ['kasir', 'Kasir', Store],
              ['stok', 'Stok', Package],
            ] as const
          ).map(([id, label, Icon]) => {
            const on = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => go(id)}
                aria-label={id === 'stok' && lowAll > 0 ? `${label}, ${lowAll} hampir habis` : label}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'relative flex h-12 items-center gap-2 rounded-full px-4 text-[13px] font-bold transition-all',
                  on
                    ? 'bg-gradient-to-r from-emerald-400 to-teal-300 text-slate-950'
                    : 'text-white/70 hover:bg-white/10',
                )}
              >
                <Icon size={18} /> <span className={cn(!on && 'hidden sm:inline')}>{label}</span>
                {id === 'stok' && lowAll > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-extrabold text-slate-900">
                    {lowAll}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      <Modal isOpen={pw} onClose={() => setPw(false)} title="Ganti sandi" maxWidth="max-w-sm">
        <ChangePassword
          onDone={(m) => {
            setPw(false);
            say(m);
          }}
        />
      </Modal>
    </div>
  );
}

function StaffLogin({ onDone }: { onDone: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await staffService.login(username, password);
      onDone();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Gagal masuk.');
      setBusy(false);
    }
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(120%_120%_at_100%_0%,#7c3aed22,transparent_60%)] p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-[28px] bg-white p-6 shadow-xl ring-1 ring-slate-100"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <Store size={20} />
          </span>
          <div>
            <p className="text-[18px] font-extrabold text-slate-900">Masuk Tim</p>
            <p className="text-[12px] text-slate-500">Akun kasir dari pemilik usaha</p>
          </div>
        </div>
        {error && (
          <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-600">
            {error}
          </p>
        )}
        <label className="block">
          <span className={labelCls}>Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            placeholder="mis. cxa-rina"
            className={fieldCls}
          />
        </label>
        <label className="block">
          <span className={labelCls}>Sandi</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className={fieldCls}
          />
        </label>
        <button
          type="submit"
          disabled={busy || !username.trim() || !password}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 py-3 text-[14px] font-bold text-white disabled:opacity-40"
        >
          {busy && <Loader2 size={16} className="animate-spin" />} Masuk
        </button>
        <p className="text-center text-[11px] text-slate-400">
          Pemilik usaha? Masuk di{' '}
          <a href="/auth/login" className="font-bold text-violet-600">
            halaman login biasa
          </a>
          .
        </p>
      </form>
    </div>
  );
}

function ChangePassword({ onDone }: { onDone: (m: string) => void }) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await staffService.changePassword(cur, next);
      onDone('Sandi diganti.');
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Gagal.');
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="text-[12px] font-semibold text-rose-600">
          {error}
        </p>
      )}
      <label className="block">
        <span className={labelCls}>Sandi lama</span>
        <input type="password" value={cur} onChange={(e) => setCur(e.target.value)} className={fieldCls} />
      </label>
      <label className="block">
        <span className={labelCls}>Sandi baru (min 8)</span>
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)} className={fieldCls} />
      </label>
      <button
        type="button"
        onClick={save}
        disabled={busy || !cur || next.length < 8}
        className="w-full rounded-full bg-slate-900 py-3 text-[14px] font-bold text-white disabled:opacity-40"
      >
        Simpan
      </button>
    </div>
  );
}

function StaffRingkas({
  me,
  lowBy,
  go,
}: {
  me: StaffMe;
  lowBy: Record<string, number>;
  go: (t: Tab, id?: string) => void;
}) {
  const sales = me.today.filter((t) => !isCost(t));
  const costs = me.today.filter(isCost);
  const mine = sales.filter((t) => (t.note ?? '').endsWith(` · oleh ${me.staff.name}`));
  const low = (me.materials ?? []).filter(isLow);
  return (
    <section className="space-y-4">
      <div className="web-keep relative overflow-hidden rounded-[28px] bg-[radial-gradient(120%_140%_at_100%_0%,#10b981_0%,#065f46_38%,#03140f_82%)] p-5 text-white md:p-6">
        <p className="text-[13px] font-semibold text-white/60">Penjualan hari ini · semua kasir</p>
        <p className="mt-1 text-[32px] font-extrabold leading-none tabular-nums md:text-[38px]">
          {formatIDR(sumOf(sales))}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 min-[380px]:grid-cols-3">
          {[
            ['Transaksi', String(sales.length)],
            ['Oleh kamu', short(sumOf(mine))],
            ['Biaya', short(-sumOf(costs))],
          ].map(([k, v]) => (
            <div
              key={k}
              className="min-w-0 rounded-2xl last:col-span-2 min-[380px]:last:col-span-1 bg-white/[0.08] px-2.5 py-2.5 ring-1 ring-white/10 min-[380px]:px-3"
            >
              <p className="truncate text-[10px] text-white/55 min-[380px]:text-[11px]">{k}</p>
              <p className="truncate text-[14px] font-extrabold tabular-nums tracking-tight min-[380px]:text-[16px]">
                {v}
              </p>
            </div>
          ))}
        </div>
      </div>

      {low.length > 0 && (
        <button
          type="button"
          onClick={() => go('stok', low[0].shop_id)}
          className="flex w-full items-center gap-3 rounded-[22px] bg-amber-50 px-4 py-3.5 text-left ring-1 ring-amber-100"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-400/90 text-slate-900">
            <AlertTriangle size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-extrabold text-amber-900">{low.length} stok hampir habis</span>
            <span className="block truncate text-[12px] text-amber-800">
              {low.map((m) => `${m.name} (${fmtQty(m.stock)} ${m.unit})`).join(', ')}
            </span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-amber-700" />
        </button>
      )}

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {me.shops.map((s) => {
          const list = sales.filter((t) => t.shop_id === s.id);
          const c = sumOf(costs.filter((t) => t.shop_id === s.id));
          return (
            <li key={s.id} className={cn(card, 'overflow-hidden')}>
              <button
                type="button"
                onClick={() => go('kasir', s.id)}
                className={cn(
                  'web-keep flex w-full items-center gap-3 px-4 py-3.5 text-left text-white',
                  themeHeader(s),
                )}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/15 text-[22px]">
                  <CatalogImage
                    src={s.style.logoUrl}
                    alt={`Logo ${s.name}`}
                    fallback={s.emoji || '🏪'}
                    className="h-full w-full bg-white p-1"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-extrabold">{s.name}</span>
                  <span className="block text-[12px] text-white/65">{s.products.length} produk</span>
                </span>
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-bold">
                  <Store size={13} /> Kasir
                </span>
              </button>
              <div className="grid grid-cols-3 divide-x divide-slate-100 py-3">
                {[
                  ['Hari ini', short(sumOf(list)), ''],
                  ['Transaksi', String(list.length), ''],
                  ['Biaya', short(-c), c ? 'text-rose-600' : ''],
                ].map(([k, v, cls]) => (
                  <span key={k} className="min-w-0 px-2 text-center">
                    <span className="block truncate text-[11px] text-slate-400">{k}</span>
                    <span className={cn('block truncate text-[15px] font-extrabold tabular-nums text-slate-900', cls)}>
                      {v}
                    </span>
                  </span>
                ))}
              </div>
              {(lowBy[s.id] ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={() => go('stok', s.id)}
                  className="flex w-full items-center justify-between border-t border-slate-100 px-4 py-2.5 text-[12px] font-bold text-amber-700 hover:bg-amber-50/60"
                >
                  <span className="flex items-center gap-1.5">
                    <Package size={14} /> {lowBy[s.id]} stok hampir habis
                  </span>
                  <ChevronRight size={14} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <TodayList list={me.today} title="Transaksi hari ini" empty="Belum ada transaksi hari ini." />
    </section>
  );
}

function StaffKasir({
  shop,
  me,
  low,
  onStock,
  onSold,
  say,
}: {
  shop: Shop;
  me: StaffMe;
  low: number;
  onStock: () => void;
  onSold: (m: string) => void;
  say: (m: string) => void;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [sheet, setSheet] = useState(false);
  const [spending, setSpending] = useState(false);
  const add = (p: ShopProduct) =>
    setLines((l) => {
      const k = lineKey(p);
      return l.some((x) => x.key === k)
        ? l.map((x) => (x.key === k ? { ...x, qty: Math.min(9999, x.qty + 1) } : x))
        : [...l, { key: k, name: p.name, group: p.group, price: p.price, qty: 1 }];
    });
  const setQty = (k: string, q: number) =>
    setLines((l) =>
      q < 1 ? l.filter((x) => x.key !== k) : l.map((x) => (x.key === k ? { ...x, qty: Math.min(9999, q) } : x)),
    );
  const sum = lines.reduce((s, x) => s + x.price * x.qty, 0);
  const count = lines.reduce((s, x) => s + x.qty, 0);
  const todayShop = me.today.filter((t) => t.shop_id === shop.id);
  const todaySales = todayShop.filter((t) => !isCost(t));
  const todayCost = sumOf(todayShop.filter(isCost));
  const mine = todaySales.filter((t) => (t.note ?? '').endsWith(` · oleh ${me.staff.name}`));
  const materials = (me.materials ?? []).filter((m) => m.shop_id === shop.id);
  const custom = shop.style.mode === 'bebas' && shop.style.customHtml.trim().length > 0;
  const cart: Record<number, number> = {};
  shop.products.forEach((p, i) => {
    const q = lines.find((l) => l.key === lineKey(p))?.qty;
    if (q) cart[i] = q;
  });
  const staffProps = {
    accountName: me.account,
    sell: (input: Parameters<typeof staffService.sale>[1]) => staffService.sale(shop.id, input),
  };
  const struk = (inSheet: boolean) => (
    <Struk
      key={`${shop.id}-${inSheet}`}
      shop={shop}
      lines={lines}
      sum={sum}
      onAdd={add}
      setQty={setQty}
      clear={() => setLines([])}
      onDone={(m) => (/tercatat/.test(m) ? onSold(m) : say(m))}
      inSheet={inSheet}
      onNew={() => setSheet(false)}
      staff={staffProps}
    />
  );
  const actBtn =
    'relative flex min-w-0 items-center justify-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-[12px] font-bold hover:bg-white/20';

  return (
    <div className="space-y-4">
      <section className={cn('web-keep rounded-[28px] p-4 text-white md:p-5', themeHeader(shop))}>
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/10 text-[26px]">
            <CatalogImage
              src={shop.style.logoUrl}
              alt={`Logo ${shop.name}`}
              fallback={shop.emoji || '🏪'}
              className="h-full w-full bg-white p-1"
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/50">
              <Store size={12} /> Kasir
            </p>
            <h1 className="truncate text-[20px] font-extrabold leading-tight md:text-[24px]">{shop.name}</h1>
            {shop.style.greeting && <p className="truncate text-[12px] text-white/70">{shop.style.greeting}</p>}
          </div>
          <div className="hidden shrink-0 gap-1.5 sm:flex">
            <button type="button" onClick={() => setSpending(true)} className={actBtn}>
              <Wallet size={15} /> Biaya
            </button>
            <button type="button" onClick={onStock} className={actBtn}>
              <Package size={15} /> Stok
              {low > 0 && (
                <span className="rounded-full bg-amber-400 px-1.5 text-[10px] font-extrabold text-slate-900">
                  {low}
                </span>
              )}
            </button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-1.5 sm:hidden">
          <button type="button" onClick={() => setSpending(true)} className={cn(actBtn, 'rounded-2xl py-2.5')}>
            <Wallet size={15} /> Catat biaya
          </button>
          <button type="button" onClick={onStock} className={cn(actBtn, 'rounded-2xl py-2.5')}>
            <Package size={15} /> Stok
            {low > 0 && (
              <span className="rounded-full bg-amber-400 px-1.5 text-[10px] font-extrabold text-slate-900">{low}</span>
            )}
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 min-[380px]:grid-cols-3">
          {[
            ['Omzet hari ini', short(sumOf(todaySales))],
            ['Oleh kamu', short(sumOf(mine))],
            ['Biaya hari ini', short(-todayCost)],
          ].map(([k, v]) => (
            <div
              key={k}
              className="min-w-0 rounded-2xl last:col-span-2 min-[380px]:last:col-span-1 bg-white/[0.07] px-2.5 py-2.5 ring-1 ring-white/10 min-[380px]:px-3"
            >
              <p className="truncate text-[10px] text-white/55 min-[380px]:text-[11px]">{k}</p>
              <p className="truncate text-[14px] font-extrabold tabular-nums tracking-tight min-[380px]:text-[16px]">
                {v}
              </p>
            </div>
          ))}
        </div>
      </section>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_360px]">
        {custom ? (
          <CustomKasirFrame
            shop={shop}
            products={shop.products}
            cart={cart}
            onAdd={(i) => add(shop.products[i])}
            onRemove={(i) => {
              const k = lineKey(shop.products[i]);
              const q = lines.find((l) => l.key === k)?.qty ?? 0;
              if (q) setQty(k, q - 1);
            }}
            onCheckout={() => setSheet(true)}
          />
        ) : (
          <Catalog products={shop.products} style={shop.style} lines={lines} onAdd={add} />
        )}
        <aside aria-label="Struk" className="hidden lg:sticky lg:top-4 lg:block">
          {struk(false)}
        </aside>
      </div>
      <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+88px)] z-40 mx-auto max-w-md lg:hidden">
        <button
          type="button"
          onClick={() => setSheet(true)}
          className={cn(
            'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-white shadow-xl',
            count ? 'bg-emerald-600' : 'bg-slate-900',
          )}
        >
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <ReceiptText size={18} />
            {count > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-extrabold text-emerald-700">
                {count}
              </span>
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] text-white/70">{count ? `${count} item di struk` : 'Struk kosong'}</span>
            <span className="block text-[16px] font-extrabold tabular-nums">
              {count ? formatIDR(sum) : 'Ketuk produk untuk mulai'}
            </span>
          </span>
          {count > 0 && (
            <span className="shrink-0 rounded-full bg-white px-3.5 py-2 text-[13px] font-extrabold text-emerald-700">
              Bayar
            </span>
          )}
        </button>
      </div>
      <BottomSheet isOpen={sheet} onClose={() => setSheet(false)} title="Struk">
        <div className="pb-[calc(env(safe-area-inset-bottom)+16px)]">{struk(true)}</div>
      </BottomSheet>
      <BottomSheet isOpen={spending} onClose={() => setSpending(false)} title="Catat pengeluaran">
        <div className="pb-[calc(env(safe-area-inset-bottom)+16px)]">
          <ExpenseForm
            key={String(spending)}
            shop={shop}
            materials={materials}
            locked={{ accountName: me.account }}
            onSave={(input) => staffService.expense(shop.id, input)}
            onDone={(m) => {
              setSpending(false);
              onSold(m);
            }}
            onCancel={() => setSpending(false)}
          />
        </div>
      </BottomSheet>
      <TodayList list={todayShop} title="Hari ini" />
    </div>
  );
}

// Tab Stok (tim): data stok lewat /api/staff (tanpa harga beli). "Beli" → catat pengeluaran
// dengan bahan terpilih → uang keluar dari rekening kunci & stok masuk sekaligus.
function StaffStock({
  shop,
  me,
  say,
  onChanged,
}: {
  shop: Shop;
  me: StaffMe;
  say: (m: string) => void;
  onChanged: () => Promise<void>;
}) {
  const [data, setData] = useState<StockData | null>(null);
  const [buy, setBuy] = useState<StockMaterial | null>(null);
  const [loadError, setLoadError] = useState('');
  const reload = useCallback(async () => {
    try {
      setData(await staffStockService.get(shop.id));
      setLoadError('');
    } catch (e) {
      setData((p) => p ?? { materials: [], recipes: [], moves: [] });
      setLoadError(e instanceof Error && e.message ? e.message : 'Gagal memuat stok.');
    }
  }, [shop.id]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- muat stok saat tab dibuka
    void reload();
  }, [reload]);
  const refresh = async () => {
    await reload();
    await onChanged();
  };
  const mats = (data?.materials ?? []).filter((m) => !m.archived_at);
  return (
    <section className="space-y-3">
      <div className={cn('web-keep flex items-center gap-3 rounded-[24px] px-4 py-3.5 text-white', themeHeader(shop))}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15">
          <Package size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/55">Stok</p>
          <p className="truncate text-[18px] font-extrabold">{shop.name}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] text-white/55">Bahan / barang</p>
          <p className="text-[18px] font-extrabold tabular-nums">{mats.length}</p>
        </div>
      </div>
      {loadError && (
        <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-600">
          {loadError}
        </p>
      )}
      <p className="px-1 text-[12px] text-slate-500">
        Catat bahan yang <b>dipakai</b>, <b>masuk</b>, atau <b>hitung fisik</b>. Beli pakai uang toko → tombol{' '}
        <b>Beli</b> di tiap bahan (pengeluaran & stok tercatat sekaligus). Semua tercatat atas namamu.
      </p>
      <div className={cn(card, 'p-3 md:p-4')}>
        <StockView
          shop={shop}
          data={data}
          reload={refresh}
          onToast={say}
          api={staffStockService}
          staff
          actor={me.staff.name}
          onBuy={(m) => setBuy(m)}
        />
      </div>
      <BottomSheet isOpen={Boolean(buy)} onClose={() => setBuy(null)} title="Catat pengeluaran">
        <div className="pb-[calc(env(safe-area-inset-bottom)+16px)]">
          {buy && (
            <ExpenseForm
              key={buy.id}
              shop={shop}
              materials={mats}
              initialMaterialId={buy.id}
              locked={{ accountName: me.account }}
              onSave={(input) => staffService.expense(shop.id, input)}
              onDone={(m) => {
                setBuy(null);
                say(m);
                void refresh();
              }}
              onCancel={() => setBuy(null)}
            />
          )}
        </div>
      </BottomSheet>
    </section>
  );
}
