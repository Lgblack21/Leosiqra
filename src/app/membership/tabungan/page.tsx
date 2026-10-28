"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Wallet,
  Trash2,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Pencil,
  Search,
  PiggyBank,
} from 'lucide-react';
import { savingsService, Saving } from '@/lib/services/savingsService';
import { Account } from '@/lib/services/accountService';
import { auth, db } from '@/lib/cf-client';
import { onAuthStateChanged } from '@/lib/cf-auth';
import { collection, query, where, onSnapshot, orderBy } from '@/lib/cf-firestore';
import { MonthPicker } from '@/components/ui/MonthPicker';
import { SavingsModal } from '@/components/modals/SavingsModal';
import { savingsGoalService, SavingsGoal } from '@/lib/services/savingsGoalService';
import { recurringService } from '@/lib/services/recurringService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { TargetFormModal, type TargetPreset } from '@/components/savings/TargetFormModal';
import { TARGET_SUGGESTIONS } from '@/components/settings/TargetView';
import { targetColor, targetIcon, monthsUntil, neededPerMonth } from '@/lib/targets';
import { useFeedback } from '@/components/ui/Feedback';
import { cn, formatIDR } from '@/lib/utils';

// Halaman Tabungan: saldo total, target (kartu berwarna, setor langsung), pos
// tabungan lain, lalu riwayat per bulan. Logika uang tidak berubah — setor/
// tarik lewat SavingsModal (saldo rekening diubah atomik di server), target
// lewat TargetFormModal.

function TargetCard({ goal, onDeposit, onEdit, onDelete }: { goal: SavingsGoal; onDeposit: () => void; onEdit: () => void; onDelete: () => void }) {
  const color = targetColor(goal);
  const pct = goal.targetAmount ? Math.max(0, Math.min(100, (goal.currentTotal / goal.targetAmount) * 100)) : 0;
  const done = Boolean(goal.targetAmount) && goal.currentTotal >= (goal.targetAmount ?? 0);
  const months = monthsUntil(goal.targetDate);
  const need = goal.targetAmount ? neededPerMonth(goal.targetAmount, goal.currentTotal, goal.targetDate) : null;
  const status = done
    ? { text: 'Tercapai', cls: 'bg-emerald-50 text-emerald-700' }
    : goal.status === 'PAUSED' && goal.monthlyAmount > 0
      ? { text: 'Dijeda', cls: 'bg-amber-50 text-amber-700' }
      : months === 0
        ? { text: 'Lewat tanggal', cls: 'bg-rose-50 text-rose-700' }
        : months
          ? { text: `${months} bln lagi`, cls: 'bg-slate-100 text-slate-600' }
          : null;
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-[24px] bg-white p-5 ring-1 ring-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-18px_rgba(15,23,42,0.35)]">
      <div className="relative flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[24px]" style={{ background: `${color}1f` }} aria-hidden>{targetIcon(goal)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-bold text-slate-900">{goal.name}</p>
          <p className="text-[12px] text-slate-500">
            {goal.monthlyAmount > 0 ? `Otomatis ${formatIDR(goal.monthlyAmount)}/${goal.interval.toLowerCase().replace('an', '')}` : 'Setor manual'}
          </p>
        </div>
        {status && <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold', status.cls)}>{status.text}</span>}
      </div>

      <div className="relative mt-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[20px] font-extrabold tabular-nums text-slate-900">{formatIDR(goal.currentTotal)}</p>
          {goal.targetAmount ? <p className="text-[13px] font-semibold tabular-nums" style={{ color }}>{Math.floor(pct)}%</p> : null}
        </div>
        {goal.targetAmount ? (
          <>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full" style={{ background: `${color}1f` }}>
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: done ? '#10b981' : color }} />
            </div>
            <p className="mt-1.5 text-[12px] tabular-nums text-slate-500">
              dari {formatIDR(goal.targetAmount)}{need ? ` · butuh ± ${formatIDR(need)}/bln` : ''}
            </p>
          </>
        ) : (
          <p className="mt-1 text-[12px] text-slate-500">terkumpul · belum ada nominal target</p>
        )}
      </div>

      <div className="relative mt-4 flex items-center gap-2">
        <button type="button" onClick={onDeposit} className="flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-[14px] font-semibold text-white transition hover:brightness-110" style={{ background: color }}>
          <Plus size={16} strokeWidth={2.5} /> Setor
        </button>
        <button type="button" onClick={onEdit} aria-label={`Ubah ${goal.name}`} className="rounded-full bg-slate-100 p-2.5 text-slate-600 hover:bg-slate-200"><Pencil size={15} /></button>
        <button type="button" onClick={onDelete} aria-label={`Hapus ${goal.name}`} className="rounded-full bg-slate-100 p-2.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
      </div>
    </div>
  );
}

export default function SavingsPage() {
  const [savings, setSavings] = useState<Saving[]>([]);
  // Semua setoran/penarikan sepanjang waktu — saldo tabungan adalah akumulasi,
  // bukan cuma transaksi bulan yang sedang dipilih di MonthPicker.
  const [allSavings, setAllSavings] = useState<Saving[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [userId, setUserId] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'Setoran' | 'Penarikan'>('Setoran');
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [depositCategory, setDepositCategory] = useState<string | undefined>(undefined);
  const [targetModal, setTargetModal] = useState<{ open: boolean; goal: SavingsGoal | null; preset: TargetPreset | null }>({ open: false, goal: null, preset: null });
  const { confirm, toast } = useFeedback();

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const unsubRef = useRef<(() => void) | null>(null);
  const unsubAccRef = useRef<(() => void) | null>(null);
  const unsubAllRef = useRef<(() => void) | null>(null);

  const loadGoals = () => {
    savingsGoalService.getUserSavingsGoals().then(setGoals).catch((error) => {
      console.error('Error loading savings goals:', error);
    });
  };

  useEffect(() => {
    if (!userId) return;
    loadGoals();
    // Progres target ikut berubah saat ada setoran/penarikan atau target diubah.
    const unsubs = [subscribeToCollectionChanges('savings', loadGoals), subscribeToCollectionChanges('recurring', loadGoals)];
    return () => unsubs.forEach((u) => u());
  }, [userId]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUserId(u?.uid || '');
      if (u) {
        // Fetch accounts for lookup
        const qAcc = query(collection(db, 'accounts'), where('userId', '==', u.uid));
        if (unsubAccRef.current) unsubAccRef.current();
        unsubAccRef.current = onSnapshot(qAcc, (snap) => {
          setAccounts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
        }, (err) => {
          if (err.code !== 'permission-denied') console.error('Account listener error:', err);
        });

        const qAll = query(collection(db, 'savings'), where('userId', '==', u.uid), orderBy('date', 'desc'));
        if (unsubAllRef.current) unsubAllRef.current();
        unsubAllRef.current = onSnapshot(qAll, (snap) => {
          setAllSavings(snap.docs.map(doc => {
            const d = doc.data();
            return {
              ...d, id: doc.id, amount: Number(d.amount) || 0,
              date: d.date?.toDate?.() ?? new Date(), createdAt: d.createdAt?.toDate?.() ?? new Date()
            } as Saving;
          }));
        }, (err) => {
          if (err.code !== 'permission-denied') console.error(err);
        });

        const startOfMonth = new Date(selectedYear, selectedMonth, 1);
        const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

        const q = query(
          collection(db, 'savings'), 
          where('userId', '==', u.uid),
          where('date', '>=', startOfMonth),
          where('date', '<=', endOfMonth),
          orderBy('date', 'desc')
        );
        if (unsubRef.current) unsubRef.current();
        unsubRef.current = onSnapshot(q, (snap) => {
          setSavings(snap.docs.map(doc => {
            const d = doc.data();
            return {
              ...d, id: doc.id, amount: Number(d.amount) || 0,
              date: d.date?.toDate?.() ?? new Date(), createdAt: d.createdAt?.toDate?.() ?? new Date()
            } as Saving;
          }));
          setLoading(false);
        }, (err) => { 
          if (err.code !== 'permission-denied') console.error(err); 
          setLoading(false); 
        });
      } else {
        setSavings([]);
        setAllSavings([]);
        setAccounts([]);
        setLoading(false);
      }
    });
    return () => {
      unsub();
      if (unsubRef.current) unsubRef.current();
      if (unsubAccRef.current) unsubAccRef.current();
      if (unsubAllRef.current) unsubAllRef.current();
    };
  }, [selectedMonth, selectedYear]);

  const getAccountName = (id: string) => {
    const acc = accounts.find(a => a.id === id);
    return acc ? acc.name : id || '-';
  };

  // Total gabungan lintas rekening harus pakai amountIDR (sudah dikonversi
  // saat setoran disimpan), bukan .amount mentah — setoran bisa dalam
  // mata uang berbeda-beda. Penarikan mengurangi total, Setoran menambah.
  //
  // Dulu totalSaldo dihitung dari `savings` (cuma bulan terpilih), jadi bulan
  // yang isinya hanya penarikan tampil minus walau setoran bulan-bulan
  // sebelumnya masih ada. Sekarang saldo = akumulasi semua bulan (sama seperti
  // kartu Tabungan di Dashboard); arus bulan ini ditampilkan terpisah.
  const toIdr = (item: Saving) => Number(item.amountIDR) || item.amount;
  const totalSaldo = useMemo(() => allSavings.reduce((s, item) => {
    const amt = toIdr(item);
    return item.transactionType === 'Penarikan' ? s - amt : s + amt;
  }, 0), [allSavings]);
  const monthSetor = useMemo(() => savings.filter(s => s.transactionType !== 'Penarikan').reduce((s, i) => s + toIdr(i), 0), [savings]);
  const monthTarik = useMemo(() => savings.filter(s => s.transactionType === 'Penarikan').reduce((s, i) => s + toIdr(i), 0), [savings]);
  // Saldo per goal (kategori) sepanjang waktu, urut dari yang terbesar.
  const goalBalances = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of allSavings) {
      const key = item.category || 'Lainnya';
      const amt = toIdr(item);
      map.set(key, (map.get(key) ?? 0) + (item.transactionType === 'Penarikan' ? -amt : amt));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [allSavings]);
  // Pos tabungan yang tidak terhubung ke target/jadwal mana pun.
  const otherPots = useMemo(() => goalBalances.filter(([cat, bal]) => bal !== 0 && !goals.some((g) => g.category === cat)), [goalBalances, goals]);
  const targetSaved = goals.filter((g) => g.targetAmount).reduce((s, g) => s + Math.max(0, g.currentTotal), 0);
  const targetAim = goals.reduce((s, g) => s + (g.targetAmount ?? 0), 0);

  const filtered = useMemo(() =>
    searchQuery ? savings.filter(s => s.description.toLowerCase().includes(searchQuery.toLowerCase()) || s.category.toLowerCase().includes(searchQuery.toLowerCase())) : savings,
    [savings, searchQuery]
  );

  const formatRp = (n: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(n);
  const formatAmount = (n: number, currency: string | undefined) => {
    try {
      return new Intl.NumberFormat('id-ID', { style: 'currency', currency: currency || 'IDR', minimumFractionDigits: 0 }).format(n);
    } catch {
      return `${currency || ''} ${formatRp(n)}`.trim();
    }
  };
  const formatDate = (d: Date) => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
  // Riwayat dikelompokkan per tanggal (data sudah urut terbaru dulu).
  const grouped = useMemo(() => {
    const out: { day: string; items: Saving[] }[] = [];
    for (const item of filtered) {
      const day = formatDate(item.date);
      if (out[out.length - 1]?.day === day) out[out.length - 1].items.push(item);
      else out.push({ day, items: [item] });
    }
    return out;
  }, [filtered]);

  const handleDelete = async (item: Saving) => {
    if (!item.id) return;
    const ok = await confirm({ title: 'Hapus catatan ini?', message: `${item.transactionType === 'Penarikan' ? 'Penarikan' : 'Setoran'} ${formatAmount(item.amount, item.currency)} dihapus dan saldo rekeningnya dikembalikan.`, confirmLabel: 'Hapus', danger: true });
    if (!ok) return;
    setError('');
    setDeletingId(item.id);
    try {
      await savingsService.deleteSaving(item);
    } catch (e) {
      console.error(e);
      setError('Gagal menghapus catatan. Silakan coba lagi.');
    } finally {
      setDeletingId(null);
    }
  };

  const deleteTarget = async (goal: SavingsGoal) => {
    const ok = await confirm({ title: `Hapus target "${goal.name}"?`, message: 'Setoran yang sudah masuk tetap tersimpan di tabungan — hanya targetnya yang hilang.', confirmLabel: 'Hapus target', danger: true });
    if (!ok) return;
    try {
      await recurringService.deleteRecurring(goal.id);
      toast.success('Target dihapus.');
      loadGoals();
    } catch {
      toast.error('Gagal menghapus target.');
    }
  };

  const openSaving = (mode: 'Setoran' | 'Penarikan', category?: string) => {
    setModalMode(mode);
    setDepositCategory(category);
    setShowModal(true);
  };
  const periodLabel = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(selectedYear, selectedMonth));

  return (
    <div className="mx-auto mb-12 max-w-[1400px] space-y-6">
      {/* Judul + aksi */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-slate-900 md:text-[30px]">Tabungan</h1>
          <p className="text-[14px] text-slate-500">Sisihkan sedikit demi sedikit untuk tujuanmu.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => openSaving('Penarikan')} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-[14px] font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 sm:flex-none">
            <ArrowUpRight size={16} /> Tarik
          </button>
          <button type="button" onClick={() => openSaving('Setoran')} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-indigo-600 px-5 py-2.5 text-[14px] font-semibold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 sm:flex-none">
            <ArrowDownLeft size={16} /> Setor
          </button>
        </div>
      </div>

      {/* Ringkasan */}
      <div className="relative overflow-hidden rounded-[28px] bg-slate-900 p-6 text-white md:p-8">
        <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-indigo-500/40 blur-3xl" />
        <span aria-hidden className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-violet-500/30 blur-3xl" />
        <div className="relative grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-end">
          <div>
            <p className="flex items-center gap-2 text-[14px] text-white/70"><PiggyBank size={16} /> Total tabungan</p>
            <p className={cn('mt-1 text-[34px] font-extrabold tabular-nums leading-tight md:text-[42px]', totalSaldo < 0 && 'text-rose-300')}>{formatIDR(totalSaldo)}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-[13px] tabular-nums">
              <span className="rounded-full bg-white/10 px-3 py-1">Bulan ini <span className="font-semibold text-emerald-300">+{formatIDR(monthSetor)}</span></span>
              <span className="rounded-full bg-white/10 px-3 py-1">ditarik <span className="font-semibold text-rose-300">−{formatIDR(monthTarik)}</span></span>
            </div>
          </div>
          <div className="rounded-[22px] bg-white/10 p-4 backdrop-blur">
            <div className="flex items-baseline justify-between">
              <p className="text-[13px] text-white/70">{goals.length} target</p>
              {targetAim > 0 && <p className="text-[13px] font-semibold tabular-nums">{Math.min(100, Math.floor((targetSaved / targetAim) * 100))}%</p>}
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-fuchsia-400" style={{ width: `${targetAim > 0 ? Math.min(100, (targetSaved / targetAim) * 100) : 0}%` }} />
            </div>
            <p className="mt-2 text-[12px] tabular-nums text-white/70">{targetAim > 0 ? `${formatIDR(targetSaved)} dari ${formatIDR(targetAim)}` : 'Belum ada nominal target'}</p>
          </div>
        </div>
      </div>

      {/* Target */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[18px] font-bold text-slate-900">Target</h2>
          <button type="button" onClick={() => setTargetModal({ open: true, goal: null, preset: null })} className="flex items-center gap-1 text-[14px] font-semibold text-indigo-600 hover:text-indigo-700">
            <Plus size={16} /> Target baru
          </button>
        </div>
        {goals.length === 0 ? (
          <div className="rounded-[24px] border-2 border-dashed border-slate-200 bg-white/60 p-5">
            <p className="text-[15px] font-semibold text-slate-900">Mau nabung untuk apa?</p>
            <p className="mt-0.5 text-[13px] text-slate-500">Pilih salah satu atau buat sendiri — progresnya dihitung dari setoranmu.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {TARGET_SUGGESTIONS.map((sg) => (
                <button key={sg.name} type="button" onClick={() => setTargetModal({ open: true, goal: null, preset: sg })} className="flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-[14px] font-medium text-slate-700 ring-1 ring-slate-200 transition hover:ring-indigo-300">
                  <span aria-hidden>{sg.icon}</span> {sg.name}
                </button>
              ))}
              <button type="button" onClick={() => setTargetModal({ open: true, goal: null, preset: null })} className="flex items-center gap-1.5 rounded-full bg-indigo-600 px-3.5 py-2 text-[14px] font-semibold text-white hover:bg-indigo-700">
                <Plus size={15} /> Buat sendiri
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {goals.map((goal) => (
              <TargetCard
                key={goal.id}
                goal={goal}
                onDeposit={() => openSaving('Setoran', goal.category)}
                onEdit={() => setTargetModal({ open: true, goal, preset: null })}
                onDelete={() => void deleteTarget(goal)}
              />
            ))}
            <button type="button" onClick={() => setTargetModal({ open: true, goal: null, preset: null })} className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-[24px] border-2 border-dashed border-slate-200 text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100"><Plus size={22} /></span>
              <span className="text-[14px] font-semibold">Tambah target</span>
            </button>
          </div>
        )}
      </section>

      {/* Pos lain (kategori tanpa target) */}
      {otherPots.length > 0 && (
        <section className="space-y-3">
          <h2 className="px-1 text-[18px] font-bold text-slate-900">Pos tabungan lain</h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {otherPots.map(([cat, bal]) => (
              <button key={cat} type="button" onClick={() => openSaving('Setoran', cat)} className="min-w-[160px] shrink-0 rounded-[20px] bg-white p-4 text-left ring-1 ring-slate-200/70 hover:ring-indigo-200">
                <p className="truncate text-[13px] text-slate-500">{cat}</p>
                <p className={cn('mt-0.5 text-[16px] font-bold tabular-nums', bal < 0 ? 'text-rose-600' : 'text-slate-900')}>{formatIDR(bal)}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {error && <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-[14px] text-rose-700">{error}</div>}

      {/* Riwayat */}
      <section className="overflow-hidden rounded-[28px] bg-white ring-1 ring-slate-200/70">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
          <div>
            <h2 className="text-[18px] font-bold text-slate-900">Riwayat</h2>
            <p className="text-[13px] text-slate-500">{periodLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-56 sm:flex-none">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cari…" className="w-full rounded-full bg-slate-100 py-2.5 pl-10 pr-4 text-[14px] outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100" />
            </div>
            <MonthPicker value={{ month: selectedMonth, year: selectedYear }} onChange={({ month, year }) => { setSelectedMonth(month); setSelectedYear(year); }} />
          </div>
        </div>

        {loading ? (
          <p className="p-10 text-center text-[14px] text-slate-400">Memuat…</p>
        ) : grouped.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Wallet size={22} /></span>
            <p className="text-[15px] font-semibold text-slate-800">{searchQuery ? 'Tidak ada yang cocok' : 'Belum ada setoran bulan ini'}</p>
            {!searchQuery && <button type="button" onClick={() => openSaving('Setoran')} className="mt-1 text-[14px] font-semibold text-indigo-600">Catat setoran</button>}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {grouped.map((g) => (
              <div key={g.day}>
                <p className="bg-slate-50/70 px-4 py-2 text-[12px] font-semibold text-slate-500 md:px-6">{g.day}</p>
                <ul>
                  {g.items.map((item) => {
                    const out = item.transactionType === 'Penarikan';
                    const target = goals.find((x) => x.category === item.category);
                    return (
                      <li key={item.id} className="group flex items-center gap-3 px-4 py-3 md:px-6">
                        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-[18px]', out ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600')} aria-hidden>
                          {target ? targetIcon(target) : out ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-semibold text-slate-900">{item.description || (out ? 'Penarikan' : 'Setoran')}</p>
                          <p className="truncate text-[12px] text-slate-500">
                            {target?.name ?? item.category}{item.subCategory ? ` · ${item.subCategory}` : ''} · {out ? 'ke' : 'dari'} {getAccountName(item.fromAccount || '')}
                          </p>
                        </div>
                        <p className={cn('shrink-0 text-right text-[15px] font-bold tabular-nums', out ? 'text-rose-600' : 'text-emerald-600')}>
                          {out ? '−' : '+'}{formatAmount(item.amount, item.currency)}
                        </p>
                        <button type="button" onClick={() => void handleDelete(item)} disabled={deletingId === item.id} aria-label="Hapus catatan" className="shrink-0 rounded-full p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100">
                          <Trash2 size={15} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
        {!loading && savings.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-[13px] md:px-6">
            <span className="text-slate-500">{savings.length} catatan</span>
            <span className="font-semibold tabular-nums text-slate-700">Bersih {monthSetor - monthTarik < 0 ? '−' : '+'}{formatIDR(Math.abs(monthSetor - monthTarik))}</span>
          </div>
        )}
      </section>

      <SavingsModal
        userId={userId}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        initialTransactionType={modalMode}
        initialCategory={depositCategory}
      />

      <TargetFormModal
        open={targetModal.open}
        goal={targetModal.goal}
        preset={targetModal.preset}
        onClose={() => setTargetModal({ open: false, goal: null, preset: null })}
        onSaved={loadGoals}
      />
    </div>
  );
}
