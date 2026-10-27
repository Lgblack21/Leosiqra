'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  BarChart3,
  Mic,
  Plus,
  RotateCcw,
  Trash2,
  ScanLine,
  Search,
  Send,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react';
import { LeoMascot } from '@/components/mascot/LeoMascot';
import {
  DEMO_ACCOUNTS,
  DEMO_BUDGETS,
  DEMO_CATEGORIES,
  buildDemoTransactions,
  clearDemo,
  demoBalances,
  emojiFor,
  loadDemo,
  saveDemo,
  newDemoId,
  sortTx,
  sumBy,
  type DemoTx,
  type DemoType,
} from '@/lib/demoData';
import { parseQuickText } from '@/lib/quick/parse';
import { cn, formatIDR } from '@/lib/utils';

// Mode contoh: aplikasi Leosiqra dengan data rekaan (lib/demoData), tanpa akun
// dan tanpa server. Transaksi contoh bisa ditambah/diubah/dihapus — tersimpan
// di browser ini saja (localStorage), saldo & laporan ikut dihitung ulang.
// Aksi yang butuh akun (tanya Leo, scan struk, suara) membuka ajakan ke /mulai.
type Tab = 'ringkasan' | 'transaksi' | 'laporan' | 'dompet';
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'ringkasan', label: 'Ringkasan', icon: LayoutGrid },
  { id: 'transaksi', label: 'Transaksi', icon: List },
  { id: 'laporan', label: 'Laporan', icon: BarChart3 },
  { id: 'dompet', label: 'Dompet', icon: Wallet },
];

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const short = (n: number) =>
  n >= 1e6 ? `Rp${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 2 })} jt` : n >= 1e3 ? `Rp${Math.round(n / 1e3)} rb` : formatIDR(n);
const accName = (id?: string) => DEMO_ACCOUNTS.find((a) => a.id === id)?.name ?? '';
const greeting = (h: number) => (h >= 4 && h < 11 ? 'Selamat pagi' : h >= 11 && h < 15 ? 'Selamat siang' : h >= 15 && h < 18 ? 'Selamat sore' : 'Selamat malam');
const card = 'rounded-[24px] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-slate-100';

export default function ContohPage() {
  const [now, setNow] = useState<Date | null>(null);
  const [tab, setTab] = useState<Tab>('ringkasan');
  const [cta, setCta] = useState<string | null>(null);
  const [txs, setTxs] = useState<DemoTx[]>([]);
  const [editing, setEditing] = useState<DemoTx | 'baru' | null>(null);

  // Data contoh: pakai yang sudah diotak-atik di perangkat ini, atau bangkitkan
  // baru relatif ke jam perangkat (baru diketahui setelah hydrate — static export).
  useEffect(() => {
    const d = new Date();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data contoh relatif ke jam perangkat & localStorage, baru ada setelah hydrate
    setNow(d);
    setTxs(loadDemo(d).txs);
  }, []);

  const commit = (next: DemoTx[], edited = true) => {
    const sorted = sortTx(next);
    setTxs(sorted);
    saveDemo(sorted, edited, new Date());
  };
  const reset = () => {
    if (!now || !confirm('Kembalikan semua data contoh seperti semula? Perubahanmu di mode contoh akan hilang.')) return;
    clearDemo();
    commit(buildDemoTransactions(new Date()), false);
  };
  const ask = (what: string) => (what === 'Tambah transaksi' ? setEditing('baru') : setCta(what));
  const go = (t: Tab) => {
    setTab(t);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="min-h-screen bg-[#f6f7fb] font-sans text-slate-900 lg:flex">
      {/* Menu samping (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 flex-col border-r border-slate-200/70 bg-white px-4 py-6 lg:flex">
        <Link href="/" className="flex items-center gap-2.5 px-2">
          <Image src="/images/Logo-new.png" alt="Leosiqra" width={30} height={30} />
          <span className="text-[19px] font-extrabold tracking-tight">Leosiqra</span>
        </Link>
        <span className="mx-2 mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
          <Sparkles size={12} /> Mode contoh
        </span>
        <p className="mx-2 mt-2 text-[11px] text-slate-400">Tersimpan di perangkat ini · bebas diotak-atik</p>
        <button type="button" onClick={() => ask('Tanya Leo')} className="mt-5 flex items-center gap-2.5 rounded-2xl bg-slate-50 px-4 py-3 text-left text-[14px] text-slate-400 ring-1 ring-slate-100 hover:bg-slate-100">
          <Sparkles size={16} className="text-indigo-500" /> Tanya Leo…
        </button>
        <nav className="mt-6 space-y-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => go(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-semibold transition-colors',
                tab === t.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              )}
            >
              <t.icon size={18} /> {t.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto space-y-3">
          <button type="button" onClick={() => ask('Tambah transaksi')} className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-[15px] font-bold text-white shadow-[0_14px_30px_-14px_rgba(79,70,229,0.8)]">
            <Plus size={18} /> Tambah transaksi
          </button>
          <div className="rounded-2xl bg-indigo-50 p-4">
            <p className="text-[13px] font-bold text-indigo-900">Ini data rekaan</p>
            <p className="mt-0.5 text-[12px] text-indigo-700/80">Ubah sesukamu — hanya di perangkat ini. Catat uangmu sendiri, gratis 14 hari.</p>
            <Link href="/mulai" className="mt-2.5 inline-flex items-center gap-1 text-[13px] font-bold text-indigo-700 hover:underline">
              Mulai punyamu <ArrowRight size={14} />
            </Link>
            <button type="button" onClick={reset} className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-indigo-500 hover:text-indigo-700">
              <RotateCcw size={12} /> Kembalikan data contoh
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 pb-28 lg:pb-12">
        {/* Pita mode contoh */}
        <div className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-slate-900 px-4 py-2.5 text-white sm:px-8">
          <p className="truncate text-[13px] font-medium">
            <span className="mr-1.5 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-bold text-slate-900">CONTOH</span>
            <span className="hidden sm:inline">Data rekaan, bebas diubah — tersimpan di perangkat ini saja.</span>
            <span className="sm:hidden">Data rekaan, bebas diubah</span>
          </p>
          <Link href="/mulai" className="flex shrink-0 items-center gap-1 rounded-full bg-white px-3.5 py-1.5 text-[13px] font-bold text-slate-900 hover:bg-indigo-50">
            Mulai punyamu <ArrowRight size={14} />
          </Link>
        </div>

        <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-8 sm:pt-10">
          {!now ? (
            <div className="space-y-4">
              <div className="h-56 animate-pulse rounded-[28px] bg-slate-200/60" />
              <div className="h-40 animate-pulse rounded-[24px] bg-slate-200/60" />
            </div>
          ) : tab === 'ringkasan' ? (
            <Ringkasan now={now} txs={txs} ask={ask} go={go} open={setEditing} />
          ) : tab === 'transaksi' ? (
            <Transaksi now={now} txs={txs} ask={ask} open={setEditing} reset={reset} />
          ) : tab === 'laporan' ? (
            <Laporan now={now} txs={txs} />
          ) : (
            <Dompet txs={txs} />
          )}
        </div>
      </main>

      {/* Tab bawah (HP) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2">
          {TABS.slice(0, 2).map((t) => <TabButton key={t.id} t={t} active={tab === t.id} onClick={() => go(t.id)} />)}
          <button type="button" onClick={() => ask('Tambah transaksi')} aria-label="Tambah transaksi" className="mx-auto -mt-5 mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-[0_12px_24px_-10px_rgba(79,70,229,0.9)]">
            <Plus size={24} />
          </button>
          {TABS.slice(2).map((t) => <TabButton key={t.id} t={t} active={tab === t.id} onClick={() => go(t.id)} />)}
        </div>
      </nav>

      {editing && now && (
        <TxEditor
          now={now}
          tx={editing === 'baru' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(t) => {
            commit(editing === 'baru' ? [t, ...txs] : txs.map((x) => (x.id === t.id ? t : x)));
            setEditing(null);
          }}
          onDelete={(id) => {
            commit(txs.filter((x) => x.id !== id));
            setEditing(null);
          }}
        />
      )}

      {cta && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 backdrop-blur-sm sm:items-center" onClick={() => setCta(null)}>
          <div role="dialog" aria-modal="true" aria-label="Mulai pakai Leosiqra" className="relative w-full max-w-sm rounded-[28px] bg-white p-6 pt-4 text-center shadow-2xl animate-in fade-in slide-in-from-bottom-4" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setCta(null)} aria-label="Tutup" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500"><X size={16} /></button>
            <div className="flex justify-center"><LeoMascot mood="happy" size={110} /></div>
            <p className="text-[20px] font-extrabold tracking-tight">“{cta}” butuh ruangmu sendiri</p>
            <p className="mt-2 text-[14px] text-slate-500">Di mode contoh semuanya rekaan. Buat ruangmu — 2 menit, gratis 14 hari, tanpa kartu kredit.</p>
            <Link href="/mulai" className="mt-5 flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-[15px] font-bold text-white">
              Mulai sekarang <ArrowRight size={17} />
            </Link>
            <button type="button" onClick={() => setCta(null)} className="mt-2 w-full py-2.5 text-[14px] font-semibold text-slate-500">Lanjut lihat-lihat</button>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ t, active, onClick }: { t: (typeof TABS)[number]; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-current={active ? 'page' : undefined} className={cn('flex flex-col items-center gap-1 py-2.5 text-[11px] font-bold', active ? 'text-indigo-600' : 'text-slate-400')}>
      <t.icon size={20} /> {t.label}
    </button>
  );
}

function TxRow({ t, open }: { t: DemoTx; open: (t: DemoTx) => void }) {
  const sign = t.type === 'pemasukan' ? '+' : t.type === 'pengeluaran' ? '−' : '';
  return (
    <button type="button" onClick={() => open(t)} className="flex w-full items-center gap-3.5 rounded-xl py-3 text-left transition-colors hover:bg-slate-50">
      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-[20px]', t.type === 'pemasukan' ? 'bg-emerald-50' : t.type === 'transfer' ? 'bg-slate-100' : 'bg-indigo-50')}>{t.emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold">{t.title}</p>
        <p className="truncate text-[12px] text-slate-500">
          {t.time} · {t.type === 'transfer' ? `${accName(t.account)} → ${accName(t.toAccount)}` : `${t.category} · ${accName(t.account)}`}
        </p>
      </div>
      <p className={cn('shrink-0 text-[15px] font-bold tabular-nums', t.type === 'pemasukan' ? 'text-emerald-600' : t.type === 'transfer' ? 'text-slate-500' : 'text-slate-900')}>
        {sign}{formatIDR(t.amount)}
      </p>
    </button>
  );
}

function Ringkasan({ now, txs, ask, go, open }: { now: Date; txs: DemoTx[]; ask: (s: string) => void; go: (t: Tab) => void; open: (t: DemoTx) => void }) {
  const today = ymd(now);
  const todays = txs.filter((t) => t.date === today);
  const spentToday = sumBy(todays, 'pengeluaran');
  const month = today.slice(0, 7);
  const monthTx = txs.filter((t) => t.date.startsWith(month));
  const out = sumBy(monthTx, 'pengeluaran');
  const inc = sumBy(monthTx, 'pemasukan');
  const total = [...demoBalances(txs).values()].reduce((s, v) => s + v, 0);
  const hour = now.getHours();
  // "Biasanya jam segini": judul pengeluaran yang paling sering di jam yang sama.
  const usual = useMemo(() => {
    const count = new Map<string, { n: number; sum: number; emoji: string }>();
    for (const t of txs) {
      if (t.type !== 'pengeluaran' || Math.abs(Number(t.time.slice(0, 2)) - hour) > 1) continue;
      const c = count.get(t.title) ?? { n: 0, sum: 0, emoji: t.emoji };
      count.set(t.title, { n: c.n + 1, sum: c.sum + t.amount, emoji: t.emoji });
    }
    return [...count.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 2).map(([title, c]) => ({ title, emoji: c.emoji, avg: Math.round(c.sum / c.n / 1000) * 1000 }));
  }, [txs, hour]);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[30px] font-extrabold tracking-tight sm:text-[38px]">Ringkasan</h1>
        <div className="flex gap-2">
          <button type="button" onClick={() => ask('Scan struk')} className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[14px] font-semibold ring-1 ring-slate-200 hover:bg-slate-50"><ScanLine size={16} /> <span className="hidden sm:inline">Struk</span></button>
          <button type="button" onClick={() => ask('Catat lewat suara')} className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[14px] font-semibold ring-1 ring-slate-200 hover:bg-slate-50"><Mic size={16} /> <span className="hidden sm:inline">Suara</span></button>
        </div>
      </div>

      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 p-6 text-white sm:p-8">
        <div aria-hidden className="absolute inset-0 opacity-25 [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:20px_20px]" />
        <div aria-hidden className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-8 right-2 hidden sm:block">
          <LeoMascot mood="idle" size={170} />
        </div>
        <div className="relative max-w-xl">
          <p className="text-[28px] font-extrabold tracking-tight sm:text-[34px]">{greeting(hour)}.</p>
          <p className="mt-1 text-[14px] text-white/80">Hari ini · {now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <p className="mt-4 text-[44px] font-extrabold leading-none tracking-tight sm:text-[56px]">{formatIDR(spentToday)}</p>
          <p className="mt-2 text-[14px] text-white/80">keluar dari {todays.filter((t) => t.type === 'pengeluaran').length} pembayaran</p>
          <button type="button" onClick={() => ask('Tanya Leo')} className="mt-6 flex w-full items-center gap-3 rounded-full bg-white/95 py-2 pl-5 pr-2 text-left text-slate-400 shadow-lg">
            <Sparkles size={17} className="text-indigo-500" />
            <span className="flex-1 truncate text-[15px]">Tanya Leo: bulan ini boros di mana?</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white"><Send size={16} /></span>
          </button>
          {usual.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-semibold text-white/85">Biasanya jam segini</span>
              {usual.map((u) => (
                <button key={u.title} type="button" onClick={() => ask(`Catat ${u.title}`)} className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-[13px] font-semibold backdrop-blur hover:bg-white/30">
                  {u.emoji} {u.title} · {short(u.avg)} <Plus size={13} />
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <button type="button" onClick={() => go('dompet')} className={cn(card, 'text-left hover:ring-indigo-200')}>
          <p className="text-[13px] font-semibold text-slate-500">Total saldo</p>
          <p className="mt-1 text-[24px] font-extrabold tracking-tight">{short(total)}</p>
          <p className="mt-1 text-[12px] text-slate-400">{DEMO_ACCOUNTS.length} rekening & dompet</p>
        </button>
        <button type="button" onClick={() => go('laporan')} className={cn(card, 'text-left hover:ring-indigo-200')}>
          <p className="text-[13px] font-semibold text-slate-500">Bulan ini</p>
          <p className="mt-1 text-[24px] font-extrabold tracking-tight">{short(out)}</p>
          <p className="mt-1 text-[12px] text-slate-400">keluar · masuk <span className="font-bold text-emerald-600">{short(inc)}</span></p>
        </button>
        <button type="button" onClick={() => go('laporan')} className={cn(card, 'text-left hover:ring-indigo-200')}>
          <p className="text-[13px] font-semibold text-slate-500">Budget makan</p>
          {(() => {
            const b = DEMO_BUDGETS[0];
            const used = monthTx.filter((t) => t.type === 'pengeluaran' && t.category === b.category).reduce((s, t) => s + t.amount, 0);
            const pct = Math.min(100, Math.round((used / b.limit) * 100));
            return (
              <>
                <p className="mt-1 text-[24px] font-extrabold tracking-tight">{pct}%</p>
                <div className="mt-2 h-2 rounded-full bg-slate-100"><div className={cn('h-full rounded-full', pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${pct}%` }} /></div>
              </>
            );
          })()}
        </button>
      </div>

      <section className={card}>
        <div className="flex items-baseline justify-between">
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-400">Hari ini</p>
          <button type="button" onClick={() => go('transaksi')} className="text-[13px] font-bold text-indigo-600 hover:underline">Semua transaksi</button>
        </div>
        {todays.length === 0 ? (
          <p className="py-6 text-center text-[14px] text-slate-500">Belum ada catatan hari ini.</p>
        ) : (
          <div className="divide-y divide-slate-100">{todays.map((t) => <TxRow key={t.id} t={t} open={open} />)}</div>
        )}
      </section>
    </div>
  );
}

const PERIODS = [
  { id: 'bulan', label: 'Bulan ini' },
  { id: '30', label: '30 hari' },
  { id: '90', label: '90 hari' },
  { id: 'semua', label: 'Semua' },
] as const;

function Transaksi({ now, txs, ask, open, reset }: { now: Date; txs: DemoTx[]; ask: (s: string) => void; open: (t: DemoTx) => void; reset: () => void }) {
  const [q, setQ] = useState('');
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['id']>('bulan');
  const [type, setType] = useState<DemoType | 'semua'>('semua');
  const list = useMemo(() => {
    const from =
      period === 'bulan' ? ymd(new Date(now.getFullYear(), now.getMonth(), 1)) : period === 'semua' ? '' : ymd(new Date(now.getTime() - (Number(period) - 1) * 86400e3));
    const needle = q.trim().toLowerCase();
    return txs.filter(
      (t) =>
        t.date >= from &&
        (type === 'semua' || t.type === type) &&
        (!needle || `${t.title} ${t.category} ${accName(t.account)} ${t.amount}`.toLowerCase().includes(needle))
    );
  }, [txs, now, q, period, type]);
  const groups = useMemo(() => {
    const m = new Map<string, DemoTx[]>();
    for (const t of list) m.set(t.date, [...(m.get(t.date) ?? []), t]);
    return [...m.entries()];
  }, [list]);
  const today = ymd(now);
  const yesterday = ymd(new Date(now.getTime() - 86400e3));
  const chip = (on: boolean) => cn('shrink-0 rounded-full px-4 py-2 text-[13px] font-bold transition-colors', on ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50');
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[30px] font-extrabold tracking-tight sm:text-[38px]">Transaksi</h1>
          <p className="text-[14px] text-slate-500">{list.length} transaksi · keluar {formatIDR(sumBy(list, 'pengeluaran'))}</p>
          <p className="mt-0.5 text-[12px] text-slate-400">
            Ketuk transaksi untuk mengubah atau menghapus.{' '}
            <button type="button" onClick={reset} className="font-semibold text-indigo-600 hover:underline">Kembalikan data contoh</button>
          </p>
        </div>
        <button type="button" onClick={() => ask('Tambah transaksi')} className="hidden items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-[14px] font-bold text-white sm:flex">
          <Plus size={17} /> Tambah transaksi
        </button>
      </div>
      <label className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-indigo-500">
        <Search size={18} className="text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari judul, kategori, dompet, atau jumlah" className="w-full bg-transparent text-[15px] outline-none placeholder:text-slate-400" />
      </label>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {PERIODS.map((p) => <button key={p.id} type="button" onClick={() => setPeriod(p.id)} className={chip(period === p.id)}>{p.label}</button>)}
        <span className="mx-1 w-px shrink-0 bg-slate-200" />
        {(['semua', 'pengeluaran', 'pemasukan', 'transfer'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setType(t)} className={chip(type === t)}>{t[0].toUpperCase() + t.slice(1)}</button>
        ))}
      </div>
      {groups.length === 0 ? (
        <p className="py-16 text-center text-[14px] text-slate-500">Tidak ada transaksi yang cocok.</p>
      ) : (
        groups.slice(0, 40).map(([date, rows]) => (
          <section key={date}>
            <div className="mb-1 flex items-baseline justify-between px-1">
              <p className="text-[13px] font-bold text-slate-500">
                {date === today ? 'Hari ini' : date === yesterday ? 'Kemarin' : new Date(`${date}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
              </p>
              <p className="text-[13px] font-semibold text-slate-400">−{formatIDR(sumBy(rows, 'pengeluaran'))}</p>
            </div>
            <div className={cn(card, 'divide-y divide-slate-100 py-1')}>{rows.map((t) => <TxRow key={t.id} t={t} open={open} />)}</div>
          </section>
        ))
      )}
    </div>
  );
}

function Laporan({ now, txs }: { now: Date; txs: DemoTx[] }) {
  const [offset, setOffset] = useState(0);
  const ref = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const key = ymd(ref).slice(0, 7);
  const monthTx = txs.filter((t) => t.date.startsWith(key));
  const out = sumBy(monthTx, 'pengeluaran');
  const inc = sumBy(monthTx, 'pemasukan');
  const daysInMonth = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
  const lastDay = offset === 0 ? now.getDate() : daysInMonth;
  const perDay = Array.from({ length: daysInMonth }, (_, i) =>
    monthTx.filter((t) => t.type === 'pengeluaran' && Number(t.date.slice(8)) === i + 1).reduce((s, t) => s + t.amount, 0)
  );
  // Grafik harian tanpa tagihan bulanan besar (kos, cicilan) supaya pola jajan harian terlihat.
  const daily = Array.from({ length: daysInMonth }, (_, i) =>
    monthTx.filter((t) => t.type === 'pengeluaran' && Number(t.date.slice(8)) === i + 1 && t.amount < 500_000).reduce((s, t) => s + t.amount, 0)
  );
  const maxDaily = Math.max(1, ...daily);
  const cats = [...monthTx.filter((t) => t.type === 'pengeluaran').reduce((m, t) => m.set(t.category, (m.get(t.category) ?? 0) + t.amount), new Map<string, number>())]
    .sort((a, b) => b[1] - a[1]);
  const COLORS = ['bg-indigo-600', 'bg-violet-500', 'bg-pink-500', 'bg-amber-500', 'bg-emerald-500', 'bg-sky-500', 'bg-slate-400'];
  const avg = lastDay ? Math.round(perDay.slice(0, lastDay).reduce((s, v) => s + v, 0) / lastDay / 1000) * 1000 : 0;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[30px] font-extrabold tracking-tight sm:text-[38px]">Laporan</h1>
        <div className="flex items-center gap-1 rounded-full bg-white p-1 ring-1 ring-slate-200">
          <button type="button" aria-label="Bulan sebelumnya" disabled={offset >= 2} onClick={() => setOffset((o) => o + 1)} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 disabled:opacity-30"><ChevronLeft size={18} /></button>
          <span className="min-w-[7.5rem] text-center text-[14px] font-bold">{ref.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</span>
          <button type="button" aria-label="Bulan berikutnya" disabled={offset === 0} onClick={() => setOffset((o) => o - 1)} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 disabled:opacity-30"><ChevronRight size={18} /></button>
        </div>
      </div>

      <section className={card}>
        <p className="text-[13px] font-semibold text-slate-500">Pengeluaran</p>
        <p className="mt-1 text-[40px] font-extrabold leading-none tracking-tight sm:text-[52px]">{formatIDR(out)}</p>
        <p className="mt-3 text-[14px] text-slate-500">
          dari pemasukan <span className="font-bold text-emerald-600">{short(inc)}</span> ·{' '}
          {inc >= out ? <>sisa <span className="font-bold text-emerald-600">{short(inc - out)}</span></> : <>lebih <span className="font-bold text-rose-600">{short(out - inc)}</span></>}
        </p>
        <div className="mt-6 flex items-baseline justify-between">
          <p className="text-[15px] font-bold">Pengeluaran harian</p>
          <p className="text-[12px] text-slate-400">rata-rata {short(avg)}/hari · tanpa tagihan besar</p>
        </div>
        <div className="mt-3 flex h-36 items-end gap-[3px] sm:gap-1">
          {daily.map((v, i) => {
            const isMax = v === maxDaily && v > 0;
            return (
              <div key={i} className="group relative flex h-full flex-1 flex-col justify-end">
                <div
                  className={cn('rounded-t-md transition-colors', i + 1 > lastDay ? 'bg-slate-100' : isMax ? 'bg-indigo-600' : 'bg-indigo-200 group-hover:bg-indigo-400')}
                  style={{ height: `${Math.max(4, (v / maxDaily) * 100)}%` }}
                />
                <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-white group-hover:block">{i + 1}: {short(v)}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-slate-400"><span>1</span><span>{Math.ceil(daysInMonth / 2)}</span><span>{daysInMonth}</span></div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={card}>
          <p className="text-[15px] font-bold">Ke mana uangnya?</p>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full">
            {cats.map(([c, v], i) => <span key={c} className={COLORS[i % COLORS.length]} style={{ width: `${(v / Math.max(1, out)) * 100}%` }} />)}
          </div>
          <ul className="mt-4 space-y-2.5">
            {cats.slice(0, 6).map(([c, v], i) => (
              <li key={c} className="flex items-center gap-3 text-[14px]">
                <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', COLORS[i % COLORS.length])} />
                <span className="flex-1 truncate">{c}</span>
                <span className="text-slate-400">{Math.round((v / Math.max(1, out)) * 100)}%</span>
                <span className="w-24 text-right font-semibold tabular-nums">{short(v)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className={card}>
          <p className="text-[15px] font-bold">Budget</p>
          <ul className="mt-4 space-y-4">
            {DEMO_BUDGETS.map((b) => {
              const used = monthTx.filter((t) => t.type === 'pengeluaran' && t.category === b.category).reduce((s, t) => s + t.amount, 0);
              const pct = Math.round((used / b.limit) * 100);
              return (
                <li key={b.category}>
                  <div className="flex justify-between text-[14px]">
                    <span className="font-semibold">{b.category}</span>
                    <span className={cn('font-bold', pct > 100 ? 'text-rose-600' : 'text-slate-500')}>{short(used)} / {short(b.limit)}</span>
                  </div>
                  <div className="mt-1.5 h-2.5 rounded-full bg-slate-100">
                    <div className={cn('h-full rounded-full', pct > 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Dompet({ txs }: { txs: DemoTx[] }) {
  const bal = demoBalances(txs);
  const total = [...bal.values()].reduce((s, v) => s + v, 0);
  return (
    <div className="space-y-5">
      <h1 className="text-[30px] font-extrabold tracking-tight sm:text-[38px]">Dompet</h1>
      <section className="rounded-[28px] bg-slate-900 p-6 text-white sm:p-8">
        <p className="text-[13px] font-semibold text-white/60">Total saldo</p>
        <p className="mt-1 text-[40px] font-extrabold leading-none tracking-tight sm:text-[52px]">{formatIDR(total)}</p>
        <p className="mt-3 text-[13px] text-white/60">Pindah uang antar rekening sendiri dicatat sebagai transfer — tidak dihitung pengeluaran.</p>
      </section>
      <div className="grid gap-4 sm:grid-cols-2">
        {DEMO_ACCOUNTS.map((a) => (
          <div key={a.id} className={cn(card, 'flex items-center gap-4')}>
            <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white', a.tile)}><Wallet size={20} /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold">{a.name}</p>
              <p className="text-[12px] text-slate-500">{a.kind}</p>
            </div>
            <p className="text-[16px] font-extrabold tabular-nums">{formatIDR(bal.get(a.id) ?? 0)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Tambah / ubah / hapus transaksi contoh. Bisa diisi lewat "ketik pintar" (parser
// lokal Input Cepat) atau kolom biasa. Nominal rupiah bulat, tanggal ≤ hari ini.
function TxEditor({ now, tx, onClose, onSave, onDelete }: { now: Date; tx: DemoTx | null; onClose: () => void; onSave: (t: DemoTx) => void; onDelete: (id: string) => void }) {
  const today = ymd(now);
  const [type, setType] = useState<DemoType>(tx?.type ?? 'pengeluaran');
  const [amount, setAmount] = useState(tx ? String(tx.amount) : '');
  const [title, setTitle] = useState(tx?.title ?? '');
  const [category, setCategory] = useState(tx?.category ?? 'Makan & Minum');
  const [account, setAccount] = useState(tx?.account ?? 'ewallet');
  const [toAccount, setToAccount] = useState(tx?.toAccount ?? 'tabungan');
  const [date, setDate] = useState(tx?.date ?? today);
  const [smart, setSmart] = useState('');
  const [error, setError] = useState('');

  const applySmart = (text: string) => {
    setSmart(text);
    const d = parseQuickText(text, {
      accounts: DEMO_ACCOUNTS.map((a) => ({ id: a.id, name: a.name })),
      categories: [],
      history: [],
      today,
    });
    if (d.amount) setAmount(String(Math.round(d.amount)));
    if (d.type) {
      setType(d.type);
      setCategory(d.type === 'pemasukan' ? 'Gaji' : category);
    }
    if (d.note) setTitle(d.note);
    if (d.accountId) setAccount(d.accountId);
    if (d.date) setDate(d.date);
  };

  const cats = type === 'transfer' ? [] : DEMO_CATEGORIES[type];
  const save = () => {
    const n = Number(amount);
    if (!Number.isInteger(n) || n <= 0 || n >= 1e12) return setError('Nominal harus angka bulat lebih dari 0 (tanpa titik).');
    if (!title.trim()) return setError('Isi judulnya, mis. “Kopi susu”.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) return setError('Tanggal tidak boleh di masa depan.');
    if (type === 'transfer' && account === toAccount) return setError('Rekening asal dan tujuan harus berbeda.');
    const cat = type === 'transfer' ? 'Transfer' : (cats as readonly string[]).includes(category) ? category : cats[0];
    onSave({
      id: tx?.id ?? newDemoId(),
      date,
      time: tx?.time ?? `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      title: title.trim().slice(0, 60),
      category: cat,
      type,
      amount: n,
      account,
      toAccount: type === 'transfer' ? toAccount : undefined,
      emoji: emojiFor(cat),
    });
  };

  const field = 'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[15px] font-medium outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10';
  const label = 'block text-[13px] font-semibold text-slate-600';
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tx ? 'Ubah transaksi contoh' : 'Tambah transaksi contoh'}
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-2xl animate-in slide-in-from-bottom-6 sm:rounded-[28px] sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-[20px] font-extrabold tracking-tight">{tx ? 'Ubah transaksi' : 'Tambah transaksi'}</p>
          <button type="button" onClick={onClose} aria-label="Tutup" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500"><X size={16} /></button>
        </div>
        <p className="mt-1 text-[12px] text-slate-400">Mode contoh — tersimpan di perangkat ini saja.</p>

        {!tx && (
          <label className="mt-4 block rounded-2xl bg-indigo-50 p-3.5">
            <span className="flex items-center gap-1.5 text-[12px] font-bold text-indigo-700"><Sparkles size={13} /> Ketik pintar</span>
            <input
              value={smart}
              onChange={(e) => applySmart(e.target.value.slice(0, 120))}
              placeholder="mis. bakso 25rb tunai kemarin"
              className="mt-1 w-full bg-transparent text-[16px] font-medium outline-none placeholder:text-indigo-300"
            />
          </label>
        )}

        <div className="mt-4 grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1">
          {(['pengeluaran', 'pemasukan', 'transfer'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setType(t);
                if (t !== 'transfer') setCategory(DEMO_CATEGORIES[t][0]);
              }}
              className={cn('rounded-xl py-2 text-[13px] font-bold', type === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3.5">
          <label className={label}>
            Nominal (Rp)
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, '').slice(0, 12))} inputMode="numeric" placeholder="25000" className={cn(field, 'text-[20px] font-extrabold')} />
          </label>
          <label className={label}>
            Judul
            <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 60))} placeholder="Kopi susu" className={field} />
          </label>
          {type !== 'transfer' && (
            <label className={label}>
              Kategori
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
                {cats.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className={label}>
              {type === 'transfer' ? 'Dari' : 'Dompet'}
              <select value={account} onChange={(e) => setAccount(e.target.value)} className={field}>
                {DEMO_ACCOUNTS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            {type === 'transfer' ? (
              <label className={label}>
                Ke
                <select value={toAccount} onChange={(e) => setToAccount(e.target.value)} className={field}>
                  {DEMO_ACCOUNTS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>
            ) : (
              <label className={label}>
                Tanggal
                <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className={field} />
              </label>
            )}
          </div>
          {type === 'transfer' && (
            <label className={label}>
              Tanggal
              <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className={field} />
            </label>
          )}
        </div>

        {error && <p className="mt-3 text-[13px] font-semibold text-rose-600">{error}</p>}

        <div className="mt-5 flex items-center gap-2">
          {tx && (
            <button type="button" onClick={() => confirm('Hapus transaksi contoh ini?') && onDelete(tx.id)} aria-label="Hapus transaksi" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100">
              <Trash2 size={18} />
            </button>
          )}
          <button type="button" onClick={save} className="h-12 flex-1 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-[15px] font-bold text-white">
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}
