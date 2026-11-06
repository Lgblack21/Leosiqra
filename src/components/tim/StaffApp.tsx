"use client";

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, KeyRound, LayoutGrid, Loader2, LogOut, ReceiptText, Store, Wallet } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { staffService, type StaffMe, type StaffSale } from '@/lib/services/staffService';
import { ExpenseForm } from '@/components/ladang/ExpenseForm';
import type { Shop, ShopProduct } from '@/lib/services/shopService';
import { Catalog, Struk, lineKey, type Line } from '@/components/ladang/KasirView';
import { CustomKasirFrame } from '@/components/ladang/CustomKasirFrame';
import { CatalogImage } from '@/components/ladang/CatalogImage';
import { KASIR_THEME } from '@/components/ladang/kasirTheme';
import { fieldCls, labelCls, short } from '@/components/ladang/UsahaView';
import { cn, formatIDR } from '@/lib/utils';

// Halaman akun TIM (kasir) — /tim. Terpisah dari akun pemilik: login username
// "toko-nama", lalu hanya Ringkas (penjualan hari ini) & Usahaku (kasir usaha yang
// diberikan). Tanpa saldo, rekening (selain nama tujuan yang dikunci pemilik),
// transaksi lain, Tagih, atau Jual barang.

const noteText = (n: string | null) => (n ?? '').replace(/^\[[^\]]*\]\s*/, '') || 'Penjualan';
const isCost = (t: StaffSale) => t.type === 'pengeluaran';
const sumOf = (list: StaffSale[]) => list.reduce((a, t) => a + Number(t.amount || 0), 0);

function TodayList({ list, title }: { list: StaffSale[]; title: string }) {
  if (!list.length) return null;
  return (
    <div className="rounded-[22px] bg-white p-4 ring-1 ring-slate-100">
      <p className="text-[14px] font-extrabold text-slate-900">{title}</p>
      <ul className="mt-2 divide-y divide-slate-100">{list.slice(0, 30).map((t) => (
        <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
          <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-slate-700">{isCost(t) && <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">Biaya</span>}<span className="truncate">{noteText(t.note)}</span></span>
          <span className={cn('shrink-0 text-[13px] font-extrabold tabular-nums', isCost(t) ? 'text-rose-600' : 'text-emerald-700')}>{isCost(t) ? '−' : '+'}{formatIDR(Number(t.amount || 0))}</span>
        </li>
      ))}</ul>
    </div>
  );
}

export function StaffApp() {
  const [me, setMe] = useState<StaffMe | null>(null);
  const [state, setState] = useState<'loading' | 'login' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'ringkas' | 'usaha'>('usaha');
  const [shopId, setShopId] = useState<string | null>(null);
  const [pw, setPw] = useState(false);
  const [flash, setFlash] = useState('');
  const say = (m: string) => { setFlash(m); window.setTimeout(() => setFlash(''), 3500); };

  const load = useCallback(async () => {
    try {
      const r = await staffService.me();
      setMe(r);
      setState('ready');
      setShopId((cur) => cur ?? (r.shops.length === 1 ? r.shops[0].id : null));
    } catch (e) {
      const m = e instanceof Error ? e.message : '';
      if (/Unauthorized/i.test(m)) setState('login');
      else { setError(m || 'Gagal memuat.'); setState('error'); }
    }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- muat sesi tim sekali saat halaman dibuka
  useEffect(() => { void load(); }, [load]);

  if (state === 'loading') return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin text-slate-400" /></div>;
  if (state === 'login') return <StaffLogin onDone={load} />;
  if (state === 'error' || !me) return <div className="mx-auto max-w-sm p-8 text-center text-[14px] text-rose-600">{error}</div>;

  const shop = me.shops.find((s) => s.id === shopId) ?? null;
  const logout = async () => { await staffService.logout().catch(() => undefined); setMe(null); setShopId(null); setState('login'); };

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 pb-48 pt-4 md:px-8 lg:pb-28">
      {flash && <div role="status" className="fixed inset-x-4 top-4 z-[95] mx-auto max-w-sm rounded-2xl bg-slate-900 px-4 py-3 text-center text-[13px] font-semibold text-white shadow-lg">{flash}</div>}
      <header className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white"><Store size={18} /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-extrabold text-slate-900">{me.staff.name}</p>
          <p className="truncate text-[12px] text-slate-500">Kasir{me.owner ? ` · tim ${me.owner}` : ''} · {me.staff.username}</p>
        </div>
        <button type="button" onClick={() => setPw(true)} aria-label="Ganti sandi" className="rounded-full bg-white p-2.5 text-slate-600 ring-1 ring-slate-100 hover:bg-slate-50"><KeyRound size={16} /></button>
        <button type="button" onClick={logout} aria-label="Keluar" className="flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-[12px] font-bold text-slate-600 ring-1 ring-slate-100 hover:bg-slate-50"><LogOut size={14} /> <span className="hidden sm:inline">Keluar</span></button>
      </header>

      {tab === 'ringkas' ? <StaffRingkas me={me} open={(id) => { setShopId(id); setTab('usaha'); }} /> : shop ? (
        <StaffKasir key={shop.id} shop={shop} me={me} back={me.shops.length > 1 ? () => setShopId(null) : undefined} onSold={(m) => { say(m); void load(); }} say={say} />
      ) : (
        <section className="space-y-3">
          <h1 className="text-[20px] font-extrabold text-slate-900">Pilih usaha</h1>
          {me.shops.length === 0 && <p className="rounded-2xl bg-white p-6 text-center text-[13px] text-slate-500 ring-1 ring-slate-100">Belum ada usaha yang diberikan untuk akunmu. Hubungi pemilik usaha.</p>}
          <ul className="grid gap-3 sm:grid-cols-2">
            {me.shops.map((s) => (
              <li key={s.id}><button type="button" onClick={() => setShopId(s.id)} className={cn('web-keep flex w-full items-center gap-3 rounded-[22px] px-4 py-4 text-left text-white', (KASIR_THEME[s.style.theme] ?? KASIR_THEME.ungu).header)}>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/15 text-[22px]"><CatalogImage src={s.style.logoUrl} alt={`Logo ${s.name}`} fallback={s.emoji || '🏪'} className="h-full w-full bg-white p-1" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-[16px] font-extrabold">{s.name}</span><span className="block text-[12px] text-white/65">{s.products.length} produk</span></span>
              </button></li>
            ))}
          </ul>
        </section>
      )}

      <nav aria-label="Menu tim" className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+16px)] z-40 flex justify-center px-4">
        <div className="flex items-center gap-1 rounded-full bg-slate-950/85 p-1.5 shadow-xl ring-1 ring-white/10 backdrop-blur-xl">
          {([['ringkas', 'Ringkas', LayoutGrid], ['usaha', 'Usahaku', Store]] as const).map(([id, label, Icon]) => {
            const on = tab === id;
            return <button key={id} type="button" onClick={() => setTab(id)} aria-current={on ? 'page' : undefined} className={cn('flex h-12 items-center gap-2 rounded-full px-4 text-[13px] font-bold transition-all', on ? 'bg-gradient-to-r from-emerald-400 to-teal-300 text-slate-950' : 'text-white/70 hover:bg-white/10')}><Icon size={18} /> {label}</button>;
          })}
        </div>
      </nav>

      <Modal isOpen={pw} onClose={() => setPw(false)} title="Ganti sandi" maxWidth="max-w-sm"><ChangePassword onDone={(m) => { setPw(false); say(m); }} /></Modal>
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
    try { await staffService.login(username, password); onDone(); } catch (err) { setError(err instanceof Error && err.message ? err.message : 'Gagal masuk.'); setBusy(false); }
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(120%_120%_at_100%_0%,#7c3aed22,transparent_60%)] p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-[28px] bg-white p-6 shadow-xl ring-1 ring-slate-100">
        <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white"><Store size={20} /></span><div><p className="text-[18px] font-extrabold text-slate-900">Masuk Tim</p><p className="text-[12px] text-slate-500">Akun kasir dari pemilik usaha</p></div></div>
        {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-600">{error}</p>}
        <label className="block"><span className={labelCls}>Username</span><input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" placeholder="mis. cxa-rina" className={fieldCls} /></label>
        <label className="block"><span className={labelCls}>Sandi</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className={fieldCls} /></label>
        <button type="submit" disabled={busy || !username.trim() || !password} className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 py-3 text-[14px] font-bold text-white disabled:opacity-40">{busy && <Loader2 size={16} className="animate-spin" />} Masuk</button>
        <p className="text-center text-[11px] text-slate-400">Pemilik usaha? Masuk di <a href="/auth/login" className="font-bold text-violet-600">halaman login biasa</a>.</p>
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
    try { await staffService.changePassword(cur, next); onDone('Sandi diganti.'); } catch (e) { setError(e instanceof Error && e.message ? e.message : 'Gagal.'); setBusy(false); }
  };
  return (
    <div className="space-y-3">
      {error && <p role="alert" className="text-[12px] font-semibold text-rose-600">{error}</p>}
      <label className="block"><span className={labelCls}>Sandi lama</span><input type="password" value={cur} onChange={(e) => setCur(e.target.value)} className={fieldCls} /></label>
      <label className="block"><span className={labelCls}>Sandi baru (min 8)</span><input type="password" value={next} onChange={(e) => setNext(e.target.value)} className={fieldCls} /></label>
      <button type="button" onClick={save} disabled={busy || !cur || next.length < 8} className="w-full rounded-full bg-slate-900 py-3 text-[14px] font-bold text-white disabled:opacity-40">Simpan</button>
    </div>
  );
}

function StaffRingkas({ me, open }: { me: StaffMe; open: (id: string) => void }) {
  const sales = me.today.filter((t) => !isCost(t));
  const total = sumOf(sales);
  const cost = sumOf(me.today.filter(isCost));
  const mine = sales.filter((t) => (t.note ?? '').endsWith(` · oleh ${me.staff.name}`));
  return (
    <section className="space-y-4">
      <div className="web-keep rounded-[28px] bg-[radial-gradient(120%_140%_at_100%_0%,#10b981_0%,#065f46_38%,#03140f_82%)] p-5 text-white">
        <p className="text-[13px] text-white/60">Penjualan hari ini · semua kasir</p>
        <p className="mt-1 text-[32px] font-extrabold tabular-nums">{formatIDR(total)}</p>
        <p className="mt-1 text-[12px] text-white/60">{sales.length} transaksi · {mine.length} oleh kamu ({short(sumOf(mine))}){cost ? ` · biaya −${short(cost).replace('Rp', '')}` : ''}</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {me.shops.map((s) => {
          const list = sales.filter((t) => t.shop_id === s.id);
          return (
            <li key={s.id}><button type="button" onClick={() => open(s.id)} className="flex w-full items-center justify-between gap-3 rounded-[22px] bg-white p-4 text-left ring-1 ring-slate-100">
              <span className="min-w-0"><span className="block truncate text-[15px] font-extrabold text-slate-900">{s.emoji || '🏪'} {s.name}</span><span className="text-[12px] text-slate-500">{list.length} transaksi hari ini</span></span>
              <span className="shrink-0 text-[16px] font-extrabold tabular-nums text-emerald-700">{short(sumOf(list))}</span>
            </button></li>
          );
        })}
      </ul>
      <TodayList list={me.today} title="Transaksi hari ini" />
    </section>
  );
}

function StaffKasir({ shop, me, back, onSold, say }: { shop: Shop; me: StaffMe; back?: () => void; onSold: (m: string) => void; say: (m: string) => void }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [sheet, setSheet] = useState(false);
  const [spending, setSpending] = useState(false);
  const add = (p: ShopProduct) => setLines((l) => { const k = lineKey(p); return l.some((x) => x.key === k) ? l.map((x) => (x.key === k ? { ...x, qty: Math.min(9999, x.qty + 1) } : x)) : [...l, { key: k, name: p.name, group: p.group, price: p.price, qty: 1 }]; });
  const setQty = (k: string, q: number) => setLines((l) => (q < 1 ? l.filter((x) => x.key !== k) : l.map((x) => (x.key === k ? { ...x, qty: Math.min(9999, q) } : x))));
  const sum = lines.reduce((s, x) => s + x.price * x.qty, 0);
  const count = lines.reduce((s, x) => s + x.qty, 0);
  const todayShop = me.today.filter((t) => t.shop_id === shop.id);
  const todaySales = sumOf(todayShop.filter((t) => !isCost(t)));
  const custom = shop.style.mode === 'bebas' && shop.style.customHtml.trim().length > 0;
  const cart: Record<number, number> = {};
  shop.products.forEach((p, i) => { const q = lines.find((l) => l.key === lineKey(p))?.qty; if (q) cart[i] = q; });
  const staffProps = { accountName: me.account, sell: (input: Parameters<typeof staffService.sale>[1]) => staffService.sale(shop.id, input) };
  const struk = (inSheet: boolean) => <Struk key={`${shop.id}-${inSheet}`} shop={shop} lines={lines} sum={sum} onAdd={add} setQty={setQty} clear={() => setLines([])} onDone={(m) => (/tercatat/.test(m) ? onSold(m) : say(m))} inSheet={inSheet} onNew={() => setSheet(false)} staff={staffProps} />;

  return (
    <div className="space-y-4">
      <section className={cn('web-keep rounded-[28px] p-4 text-white md:p-5', (KASIR_THEME[shop.style.theme] ?? KASIR_THEME.ungu).header)}>
        <div className="flex items-center gap-3">
          {back && <button type="button" onClick={back} aria-label="Pilih usaha lain" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"><ArrowLeft size={17} /></button>}
          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/10 text-[26px]"><CatalogImage src={shop.style.logoUrl} alt={`Logo ${shop.name}`} fallback={shop.emoji || '🏪'} className="h-full w-full bg-white p-1" /></span>
          <div className="min-w-0 flex-1"><p className="text-[11px] font-bold uppercase tracking-wider text-white/50">Kasir</p><h1 className="truncate text-[20px] font-extrabold md:text-[24px]">{shop.name}</h1>{shop.style.greeting && <p className="truncate text-[12px] text-white/70">{shop.style.greeting}</p>}</div>
          <div className="shrink-0 text-right"><p className="text-[11px] text-white/55">Hari ini</p><p className="text-[18px] font-extrabold tabular-nums">{short(todaySales)}</p></div>
        </div>
        <button type="button" onClick={() => setSpending(true)} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-white/10 py-2 text-[12px] font-bold hover:bg-white/20 sm:w-auto sm:px-4"><Wallet size={14} /> Catat pengeluaran (beli botol, dus…)</button>
      </section>
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_360px]">
        {custom
          ? <CustomKasirFrame shop={shop} products={shop.products} cart={cart} onAdd={(i) => add(shop.products[i])} onRemove={(i) => { const k = lineKey(shop.products[i]); const q = lines.find((l) => l.key === k)?.qty ?? 0; if (q) setQty(k, q - 1); }} onCheckout={() => setSheet(true)} />
          : <Catalog products={shop.products} style={shop.style} lines={lines} onAdd={add} />}
        <aside aria-label="Struk" className="hidden lg:sticky lg:top-4 lg:block">{struk(false)}</aside>
      </div>
      <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+88px)] z-40 mx-auto max-w-md lg:hidden">
        <button type="button" onClick={() => setSheet(true)} className={cn('flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-white shadow-xl', count ? 'bg-emerald-600' : 'bg-slate-900')}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15"><ReceiptText size={18} /></span>
          <span className="min-w-0 flex-1"><span className="block text-[11px] text-white/70">{count ? `${count} item di struk` : 'Struk kosong'}</span><span className="block text-[16px] font-extrabold tabular-nums">{count ? formatIDR(sum) : 'Ketuk produk untuk mulai'}</span></span>
          {count > 0 && <span className="rounded-full bg-white px-3.5 py-2 text-[13px] font-extrabold text-emerald-700">Bayar</span>}
        </button>
      </div>
      <BottomSheet isOpen={sheet} onClose={() => setSheet(false)} title="Struk"><div className="pb-[calc(env(safe-area-inset-bottom)+16px)]">{struk(true)}</div></BottomSheet>
      <BottomSheet isOpen={spending} onClose={() => setSpending(false)} title="Catat pengeluaran"><div className="pb-[calc(env(safe-area-inset-bottom)+16px)]"><ExpenseForm shop={shop} locked={{ accountName: me.account }} onSave={(input) => staffService.expense(shop.id, input)} onDone={(m) => { setSpending(false); onSold(m); }} onCancel={() => setSpending(false)} /></div></BottomSheet>
      <TodayList list={todayShop} title="Hari ini" />
    </div>
  );
}
