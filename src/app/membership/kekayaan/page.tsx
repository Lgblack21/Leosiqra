"use client";

import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  Banknote,
  Building2,
  Coins,
  CreditCard,
  Eye,
  EyeOff,
  Gem,
  HandCoins,
  Landmark,
  PiggyBank,
  Plus,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { cn, formatIDR } from '@/lib/utils';
import { useModal, type ModalType } from '@/context/ModalContext';
import { accountService, type Account } from '@/lib/services/accountService';
import { savingsService, type Saving } from '@/lib/services/savingsService';
import { investmentService, type Investment } from '@/lib/services/investmentService';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { exchangeRateService, type ExchangeRates } from '@/lib/services/exchangeRateService';
import { computeCreditUsage, isCreditAccountType } from '@/lib/creditCard';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { AnimatedNumber } from '@/components/app/AnimatedNumber';
import { Skeleton } from '@/components/ui/Skeleton';
import { LeoMascot } from '@/components/mascot/LeoMascot';

// Kekayaan bersih = semua yang kamu punya − semua yang kamu utang.
// Hanya membaca data yang sudah ada (rekening, tabungan, investasi, catatan
// hutang/piutang) dengan aturan yang sama seperti Dashboard:
// - setoran tabungan & pembelian investasi sudah mengurangi saldo rekening,
//   jadi keduanya aset terpisah (tidak dobel);
// - saldo kartu kredit negatif = tagihan terpakai → kewajiban, bukan aset.
// Riwayat grafik disimpan per perangkat (localStorage), satu titik per hari.

const HISTORY_KEY = 'leo-networth-history:v1';

const ADD_ITEMS: { label: string; desc: string; icon: LucideIcon; tone: string; modal: ModalType }[] = [
  { label: 'Rekening & e-wallet', desc: 'BCA, Mandiri, GoPay, OVO, tunai', icon: Building2, tone: 'bg-blue-50 text-blue-600', modal: 'rekening' },
  { label: 'Tabungan', desc: 'Dana darurat, target, celengan', icon: PiggyBank, tone: 'bg-sky-50 text-sky-600', modal: 'tabungan' },
  { label: 'Saham & reksa dana', desc: 'Portofolio di sekuritas', icon: TrendingUp, tone: 'bg-emerald-50 text-emerald-600', modal: 'saham' },
  { label: 'Deposito', desc: 'Bunga dan tanggal jatuh tempo', icon: Landmark, tone: 'bg-indigo-50 text-indigo-600', modal: 'deposito' },
  { label: 'Emas, kripto, properti', desc: 'Investasi dan aset lainnya', icon: Coins, tone: 'bg-amber-50 text-amber-600', modal: 'investasi_lain' },
  { label: 'Kartu kredit & paylater', desc: 'Limit dan tagihan', icon: CreditCard, tone: 'bg-rose-50 text-rose-500', modal: 'kartu' },
  { label: 'Hutang & piutang', desc: 'Pinjaman dan uang yang dipinjamkan', icon: HandCoins, tone: 'bg-orange-50 text-orange-600', modal: 'hutang_piutang' },
];

const readHistory = (): Record<string, number> => {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}') as Record<string, number>;
  } catch {
    return {};
  }
};

export default function KekayaanPage() {
  const { openModal } = useModal();
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [savings, setSavings] = useState<Saving[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [fx, setFx] = useState<ExchangeRates>({});
  const [loaded, setLoaded] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [history, setHistory] = useState<Record<string, number>>({});

  useEffect(() => {
    const load = () =>
      Promise.all([
        accountService.getUserAccounts('session'),
        savingsService.getUserSavings('session'),
        investmentService.getUserInvestments('session'),
        transactionService.getUserTransactions('session'),
      ])
        .then(([a, s, i, t]) => {
          setAccounts(a);
          setSavings(s);
          setInvestments(i);
          setTransactions(t);
        })
        .catch(console.error)
        .finally(() => setLoaded(true));
    load();
    exchangeRateService.getLatestRates().then(setFx).catch(() => {});
    const unsubs = ['accounts', 'savings', 'investments', 'transactions'].map((c) => subscribeToCollectionChanges(c, load));
    return () => unsubs.forEach((u) => u());
  }, []);

  const toIdr = (amount: number, currency?: string) => exchangeRateService.convert(amount || 0, currency || 'IDR', 'IDR', fx);

  const w = useMemo(() => {
    const accs = accounts ?? [];
    const cash = accs.filter((a) => !isCreditAccountType(a.type));
    const credit = accs.filter((a) => isCreditAccountType(a.type));
    const creditIds = new Set(credit.map((a) => a.id));
    const rekening = cash.reduce((s, a) => s + toIdr(a.balance, a.currency), 0);
    const tabungan = savings.reduce((s, it) => {
      const amt = Number(it.amountIDR) || it.amount;
      return it.transactionType === 'Penarikan' ? s - amt : s + amt;
    }, 0);
    const activeInv = investments.filter((i) => i.status === 'Active');
    const investasi = activeInv.reduce((s, i) => s + (Number(i.currentValueIDR) || Number(i.amountIDR) || Number(i.amountInvested) || 0), 0);
    const unpaid = transactions.filter((t) => t.type === 'debt' && t.paymentStatus !== 'lunas');
    const idrOf = (t: Transaction) => Number(t.amountIDR) || Number(t.amount) || 0;
    const piutang = unpaid.filter((t) => t.category === 'Piutang').reduce((s, t) => s + idrOf(t), 0);
    const hutangKartuLama = unpaid
      .filter((t) => t.category === 'Hutang' && t.subCategory === 'Kartu Kredit' && (!t.accountId || !creditIds.has(t.accountId)))
      .reduce((s, t) => s + idrOf(t), 0);
    const kartu = credit.reduce((s, a) => s + toIdr(computeCreditUsage(a).used, a.currency), 0) + hutangKartuLama;
    const hutang = unpaid.filter((t) => t.category === 'Hutang' && t.subCategory !== 'Kartu Kredit').reduce((s, t) => s + idrOf(t), 0);
    const aset = rekening + tabungan + investasi + piutang;
    const kewajiban = kartu + hutang;
    return { cash, credit, rekening, tabungan, investasi, activeInv, piutang, kartu, hutang, aset, kewajiban, bersih: aset - kewajiban };
    // toIdr bergantung pada fx — cukup fx di dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, savings, investments, transactions, fx]);

  // Simpan satu titik riwayat per hari (perangkat ini).
  useEffect(() => {
    if (!loaded || accounts === null) return;
    const today = new Date().toISOString().slice(0, 10);
    const next = { ...readHistory(), [today]: Math.round(w.bersih) };
    const keys = Object.keys(next).sort().slice(-365);
    const trimmed = Object.fromEntries(keys.map((k) => [k, next[k]]));
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
    } catch {
      /* storage diblokir — grafik cukup tampil sesi ini */
    }
    setHistory(trimmed);
  }, [loaded, accounts, w.bersih]);

  const chart = Object.entries(history).sort(([a], [b]) => a.localeCompare(b)).map(([day, value]) => ({ day, value }));
  const money = (n: number) => (hidden ? 'Rp ••••••' : formatIDR(n));

  const groups: { label: string; icon: LucideIcon; tone: string; value: number; sub: string; negative?: boolean }[] = [
    { label: 'Rekening & e-wallet', icon: Wallet, tone: 'bg-blue-50 text-blue-600', value: w.rekening, sub: `${w.cash.length} rekening` },
    { label: 'Tabungan', icon: PiggyBank, tone: 'bg-sky-50 text-sky-600', value: w.tabungan, sub: `${savings.length} catatan setoran` },
    { label: 'Investasi', icon: TrendingUp, tone: 'bg-emerald-50 text-emerald-600', value: w.investasi, sub: `${w.activeInv.length} aktif · nilai terakhir` },
    { label: 'Piutang', icon: HandCoins, tone: 'bg-teal-50 text-teal-600', value: w.piutang, sub: 'Uang yang kamu pinjamkan' },
    { label: 'Kartu kredit', icon: CreditCard, tone: 'bg-rose-50 text-rose-500', value: w.kartu, sub: `${w.credit.length} kartu · tagihan terpakai`, negative: true },
    { label: 'Hutang', icon: Banknote, tone: 'bg-orange-50 text-orange-600', value: w.hutang, sub: 'Pinjaman yang belum lunas', negative: true },
  ];
  const maxGroup = Math.max(1, ...groups.map((g) => g.value));
  const empty = loaded && (accounts?.length ?? 0) === 0 && savings.length === 0 && investments.length === 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-10">
      <div className="grid gap-5 lg:grid-cols-5">
        {/* Angka utama + grafik */}
        <div className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-[0_8px_30px_-18px_rgba(49,46,129,0.25)] md:p-7 lg:col-span-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><Gem size={16} /></span>
                Kekayaan bersih
                <button type="button" onClick={() => setHidden((v) => !v)} aria-label={hidden ? 'Tampilkan angka' : 'Sembunyikan angka'} className="rounded-lg p-1 text-slate-400 hover:text-slate-700">
                  {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </p>
              {!loaded ? (
                <Skeleton className="mt-3 h-11 w-64" />
              ) : (
                <p className={cn('mt-2 text-[38px] font-extrabold leading-tight tracking-tight tabular-nums md:text-[44px]', w.bersih < 0 ? 'text-rose-500' : 'text-slate-900')}>
                  {hidden ? 'Rp ••••••' : <AnimatedNumber value={w.bersih} format={formatIDR} />}
                </p>
              )}
              <p className="mt-1 text-sm text-slate-500">
                Aset <b className="text-emerald-600">{money(w.aset)}</b> · Kewajiban <b className="text-rose-500">{money(w.kewajiban)}</b>
              </p>
            </div>
            <LeoMascot mood={w.bersih < 0 ? 'sad' : 'idle'} size={92} interactive className="hidden shrink-0 sm:block" />
          </div>

          <div className="mt-5 h-40">
            {chart.length >= 2 && !hidden ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart} margin={{ top: 5, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="nw" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" hide />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip formatter={(v) => formatIDR(Number(v))} labelFormatter={(d) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(String(d)))} />
                  <Area type="monotone" dataKey="value" stroke="#7c3aed" strokeWidth={2.5} fill="url(#nw)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50 px-6 text-center text-sm text-slate-500">
                {hidden ? 'Angka disembunyikan.' : 'Riwayatmu dimulai hari ini — grafik terisi tiap kamu membuka halaman ini.'}
              </div>
            )}
          </div>
        </div>

        {/* Tambah aset */}
        <div className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-[0_8px_30px_-18px_rgba(49,46,129,0.25)] lg:col-span-2">
          <p className="px-1 font-bold text-slate-900">Tambahkan yang kamu punya</p>
          <p className="mb-3 px-1 text-sm text-slate-500">Makin lengkap, makin akurat angka kekayaanmu.</p>
          <div className="space-y-1">
            {ADD_ITEMS.map((it) => (
              <button
                key={it.label}
                type="button"
                onClick={() => openModal(it.modal)}
                className="flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition-colors hover:bg-slate-50"
              >
                <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', it.tone)}><it.icon size={17} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-800">{it.label}</span>
                  <span className="block truncate text-xs text-slate-400">{it.desc}</span>
                </span>
                <Plus size={16} className="shrink-0 text-slate-400" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {empty ? (
        <div className="rounded-[24px] border border-dashed border-slate-200 bg-white p-8 text-center">
          <p className="font-bold text-slate-900">Belum ada yang dihitung</p>
          <p className="mt-1 text-sm text-slate-500">Mulai dari rekening atau e-wallet yang paling sering kamu pakai.</p>
          <button type="button" onClick={() => openModal('rekening')} className="mt-4 rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">Tambah rekening</button>
        </div>
      ) : (
        <div className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-[0_8px_30px_-18px_rgba(49,46,129,0.25)] md:p-6">
          <p className="mb-4 font-bold text-slate-900">Rinciannya</p>
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g.label} className="flex items-center gap-3">
                <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl', g.tone)}><g.icon size={18} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-sm font-bold text-slate-800">{g.label}</p>
                    {!loaded ? (
                      <Skeleton className="h-5 w-24" />
                    ) : (
                      <p className={cn('shrink-0 text-sm font-extrabold tabular-nums', g.negative && g.value > 0 ? 'text-rose-500' : 'text-slate-900')}>
                        {g.negative && g.value > 0 ? '−' : ''}{money(g.value)}
                      </p>
                    )}
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={cn('h-full rounded-full transition-all duration-700', g.negative ? 'bg-rose-400' : 'bg-gradient-to-r from-indigo-500 to-violet-500')} style={{ width: `${(Math.max(0, g.value) / maxGroup) * 100}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{g.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {w.cash.length > 0 && (
            <div className="mt-6 border-t border-slate-100 pt-5">
              <p className="mb-2 text-sm font-semibold text-slate-500">Rekening</p>
              <ul className="divide-y divide-slate-100">
                {w.cash.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-800">{a.name}</span>
                      <span className="block text-xs text-slate-400">{a.type}</span>
                    </span>
                    <span className="flex items-center gap-1 text-sm font-extrabold text-slate-900 tabular-nums">
                      {money(toIdr(a.balance, a.currency))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
