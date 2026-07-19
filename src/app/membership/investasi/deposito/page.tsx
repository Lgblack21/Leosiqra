"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  PlusCircle,
  Banknote,
  Percent,
  Trash2,
  Pencil,
  Wallet
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { investmentService, Investment } from '@/lib/services/investmentService';
import { accountService, Account } from '@/lib/services/accountService';
import { addTransaction } from '@/lib/services/transactionService';
import { updateMemberTotals } from '@/lib/services/userService';
import type { Category } from '@/lib/services/categoryService';
import { auth, db } from '@/lib/cf-client';
import { onAuthStateChanged, User } from '@/lib/cf-auth';
import { collection, query, where, onSnapshot } from '@/lib/cf-firestore';
import { cn } from '@/lib/utils';
import { DepositModal } from '@/components/modals/DepositModal';
import { useCountUp } from '@/lib/hooks/useCountUp';

export default function DepositoPage() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | undefined>(undefined);

  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        // Fetch Accounts for lookup
        const qAcc = query(collection(db, 'accounts'), where('userId', '==', u.uid));
        onSnapshot(qAcc, (snap) => {
          setAccounts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
        });

        // Fetch Categories for lookup
        const qCat = query(collection(db, 'categories'), where('userId', '==', u.uid));
        onSnapshot(qCat, (snap) => {
          setCategories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
        });

        const q = query(
          collection(db, 'investments'),
          where('userId', '==', u.uid),
          where('type', '==', 'Deposito')
        );
        if (unsubRef.current) unsubRef.current();
        unsubRef.current = onSnapshot(q, (snap) => {
          setInvestments(snap.docs.map(doc => {
            const d = doc.data();
            return {
              ...d, id: doc.id, 
              amountInvested: Number(d.amountInvested) || 0,
              currentValue: Number(d.currentValue) || 0,
              dateInvested: d.dateInvested?.toDate?.() ?? new Date(), 
              targetDate: d.targetDate?.toDate?.() ?? null,
              durationDays: d.durationDays || 0,
              createdAt: d.createdAt?.toDate?.() ?? new Date()
            } as Investment;
          }));
          setLoading(false);
        }, (err) => { console.error(err); setLoading(false); });
      } else { setInvestments([]); setLoading(false); }
    });
    return () => { unsub(); if (unsubRef.current) unsubRef.current(); };
  }, []);

  const getAccountName = (id: string) => {
    const acc = accounts.find(a => a.id === id);
    return acc ? acc.name : id || '-';
  };

  const getCategoryName = (id: string) => {
    const cat = categories.find(c => c.id === id);
    return cat ? `${cat.category} - ${cat.subCategory}` : id || '-';
  };

  // Portofolio deposito bersifat all-time: penempatan lama tidak "hilang" saat berpindah bulan.
  // Baris berstatus 'Planned' adalah peninggalan baris proyeksi "(Hasil Akhir)"
  // yang dulu dibuat otomatis (sekarang estimasinya ditampilkan inline di baris
  // Penempatan-nya sendiri, bukan baris terpisah) — disembunyikan dari tabel.
  const filteredInvestments = useMemo(() => investments.filter(i => i.status !== 'Planned'), [investments]);

  const realInvestments = filteredInvestments;

  // Total digabung lintas deposito yang bisa beda mata uang, jadi pakai
  // amountIDR (sudah dikonversi saat disimpan).
  const totalDeposited = useMemo(() => {
    return realInvestments.reduce((s, i) => {
      const amt = Number(i.amountIDR) || i.amountInvested;
      if (i.transactionType === 'Penarikan') return s - amt;
      if (i.transactionType === 'Bunga') return s;
      return s + amt;
    }, 0);
  }, [realInvestments]);
  const avgRate = realInvestments.length > 0 ? realInvestments.reduce((s, i) => s + i.returnPercentage, 0) / realInvestments.length : 0;

  const animatedTotalDeposited = useCountUp(totalDeposited);
  const animatedAvgRate = useCountUp(avgRate);

  const formatRp = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n).replace('Rp', '').trim();
  const formatAmount = (n: number, currency: string | undefined) => {
    try {
      return new Intl.NumberFormat('id-ID', { style: 'currency', currency: currency || 'IDR', minimumFractionDigits: 0 }).format(n);
    } catch {
      return `${currency || ''} ${formatRp(n)}`.trim();
    }
  };
  const formatDate = (d: Date) => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
  const formatTime = (d: Date) => new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(d);

  // Cairkan manual, bisa kapan saja (beda dari cron yang cuma jalan pas jatuh
  // tempo) — kalau ditarik sebelum jatuh tempo, bunga hangus.
  const handleCairkan = async (inv: Investment) => {
    if (!user || !inv.id) return;

    const invested = Number(inv.amountInvested) || 0;
    const rate = Number(inv.returnPercentage) || 0;
    const taxRate = Number(inv.taxPercentage) || 0;
    const days = Number(inv.durationDays) || 0;
    const isMatured = !inv.targetDate || new Date() >= inv.targetDate;

    const grossInterest = invested * (rate / 100) * (days / 365);
    const interestOnly = isMatured ? grossInterest - grossInterest * (taxRate / 100) : 0;
    const totalToAccount = invested + interestOnly;

    const confirmMsg = isMatured
      ? `Cairkan "${inv.name}"? Pokok + bunga (${formatAmount(totalToAccount, inv.currency)}) akan masuk ke rekening sumber.`
      : `"${inv.name}" belum jatuh tempo (${inv.targetDate ? formatDate(inv.targetDate) : '-'}). Cairkan sekarang akan MENGHANGUSKAN bunga — hanya pokok (${formatAmount(invested, inv.currency)}) yang masuk ke rekening, dan deposito ini tidak akan diperpanjang lagi. Lanjutkan?`;
    if (!window.confirm(confirmMsg)) return;

    if (inv.accountId) {
      await accountService.updateAccountBalance(inv.accountId, totalToAccount);
    }

    await addTransaction({
      userId: user.uid,
      type: 'pemasukan',
      amount: totalToAccount,
      category: 'Investasi',
      subCategory: isMatured ? 'Deposito - Penarikan' : 'Deposito - Penarikan (Sebelum Jatuh Tempo)',
      currency: inv.currency,
      accountId: inv.accountId || 'General',
      date: new Date(),
      note: isMatured
        ? `Deposito ${inv.name} dicairkan`
        : `Deposito ${inv.name} dicairkan sebelum jatuh tempo, bunga hangus`,
      status: 'VERIFIED',
      relatedId: inv.id,
      relatedType: 'investasi'
    });

    await updateMemberTotals(user.uid, 'pemasukan', totalToAccount);
    await updateMemberTotals(user.uid, 'investasi', -invested);

    await investmentService.updateInvestment(inv.id, { status: 'Closed' });

    await investmentService.createInvestment({
      userId: user.uid,
      name: `${inv.name} (Dicairkan${isMatured ? '' : ' - Awal'})`,
      type: 'Deposito',
      platform: inv.platform,
      amountInvested: invested,
      currentValue: totalToAccount,
      returnPercentage: rate,
      taxPercentage: taxRate,
      currency: inv.currency,
      durationDays: days,
      transactionType: 'Penarikan',
      category: inv.category,
      accountId: inv.accountId,
      dateInvested: new Date(),
      targetDate: new Date(),
      status: 'Closed',
      relatedInvestmentId: inv.id
    });
  };

  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-700 max-w-[1400px] mb-12">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-br from-white to-indigo-50/40 p-6 rounded-[24px] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white items-center justify-center shadow-lg shadow-emerald-600/20 shrink-0">
            <Banknote size={22} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Deposito</h1>
            <p className="text-[10px] md:text-sm font-medium text-slate-400 mt-1 max-w-xl">
              Kelola seluruh penempatan dana deposito Anda.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => { setEditingInvestment(undefined); setShowModal(true); }}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-black flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <PlusCircle size={18} />
            <span className="hidden md:inline">Buka Deposito</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-5 md:p-8 rounded-[20px] md:rounded-[28px] border border-slate-50 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col gap-4 relative overflow-hidden group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
              <Banknote size={20} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Deposito</p>
          </div>
          <div>
            <h3 className="text-3xl font-black text-slate-900 leading-tight tabular-nums">Rp {formatRp(Math.round(animatedTotalDeposited))}</h3>
            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{realInvestments.length} penempatan aktif</p>
          </div>
          <Banknote size={48} className="absolute -right-2 -bottom-2 text-orange-50/50 group-hover:scale-110 transition-transform -rotate-12" />
        </div>

        <div className="bg-white p-5 md:p-8 rounded-[20px] md:rounded-[28px] border border-slate-50 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col gap-4 relative overflow-hidden group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Percent size={20} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rata-rata Bunga/Thn</p>
          </div>
          <div>
            <h3 className="text-3xl font-black text-slate-900 leading-tight tabular-nums">{animatedAvgRate.toFixed(2)}%</h3>
            <p className="text-[10px] font-bold text-slate-400 mt-1">Per Annum</p>
          </div>
          <Percent size={48} className="absolute -right-2 -bottom-2 text-blue-50/50 group-hover:scale-110 transition-transform -rotate-12" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[20px] md:rounded-[32px] border border-slate-50 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm font-medium text-slate-400">Memuat data deposito...</div>
        ) : filteredInvestments.length === 0 ? (
          <div className="p-10">
            <EmptyState title="Belum ada deposito" description="Belum ada penempatan deposito yang tercatat." icon={<Banknote size={24} />} />
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[900px] xl:min-w-0">
              <thead>
                <tr className="border-b border-slate-50">
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap text-center">No</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Jam</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Tgl Penempatan</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-indigo-400 uppercase tracking-widest whitespace-nowrap">Tgl Jatuh Tempo</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Nama Deposito</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Bank/Institusi</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap text-right">Nominal</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap text-right">Durasi</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap text-center">Bunga %</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Tipe</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Kategori</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Rekening</th>
                  <th className="px-4 md:px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvestments.map((inv, i) => {
                  const isActivePenempatan = inv.transactionType === 'Penempatan' && inv.status === 'Active';
                  const estimasiCair = isActivePenempatan
                    ? (() => {
                        const invested = Number(inv.amountInvested) || 0;
                        const rate = Number(inv.returnPercentage) || 0;
                        const tax = Number(inv.taxPercentage) || 0;
                        const days = Number(inv.durationDays) || 0;
                        const gross = invested * (rate / 100) * (days / 365);
                        const interest = gross - gross * (tax / 100);
                        return invested + interest;
                      })()
                    : null;
                  return (
                    <tr key={inv.id} className="group hover:bg-indigo-50/30 transition-colors border-b border-slate-50 last:border-b-0">
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap text-center text-xs font-bold text-slate-400">{i + 1}</td>
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap text-sm font-bold text-slate-500">{formatTime(inv.createdAt)}</td>
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap text-sm font-bold text-slate-500">{formatDate(inv.dateInvested)}</td>
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap text-sm font-black text-indigo-600 italic bg-indigo-50/20">{inv.targetDate ? formatDate(inv.targetDate) : '-'}</td>
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap">
                      <div className="flex flex-col">
                        <p className="text-sm font-black text-slate-900">{inv.name}</p>
                        {estimasiCair !== null && (
                          <span className="text-[9px] font-bold text-emerald-500 mt-0.5">
                            Estimasi cair: {formatAmount(estimasiCair, inv.currency)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap"><span className="px-3 py-1 bg-orange-50 text-orange-600 text-[9px] font-black rounded-lg uppercase tracking-widest">{inv.platform || '-'}</span></td>
                    <td className="px-4 md:px-6 py-5 text-right whitespace-nowrap font-black text-slate-900 text-sm">{formatAmount(inv.amountInvested, inv.currency)}</td>
                    <td className="px-4 md:px-6 py-5 text-right whitespace-nowrap"><span className="text-sm font-bold text-slate-600">{inv.durationDays || 0} Hari</span></td>
                    <td className="px-4 md:px-6 py-5 text-center whitespace-nowrap"><span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-lg">{inv.returnPercentage.toFixed(2)}%</span></td>
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap">
                      <span className="text-xs font-bold text-slate-600">{inv.transactionType || '-'}</span>
                      {inv.transactionType === 'Penempatan' && inv.status === 'Active' && (
                        <span className={cn(
                          "block mt-1 text-[8px] font-black uppercase tracking-tighter",
                          inv.maturityAction === 'aro_full' ? "text-purple-500" : inv.maturityAction === 'aro_bunga' ? "text-blue-500" : "text-slate-400"
                        )}>
                          {inv.maturityAction === 'aro_full' ? 'ARO Pokok+Bunga' : inv.maturityAction === 'aro_bunga' ? 'ARO Bunga' : 'Cairkan Otomatis'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap">
                      <span className="px-2 py-0.5 text-[9px] font-black rounded uppercase tracking-widest bg-slate-100 text-slate-600">
                        {getCategoryName(inv.category || '')}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-5 whitespace-nowrap"><span className="text-xs font-bold text-slate-600">{getAccountName(inv.accountId || '')}</span></td>
                    <td className="px-4 md:px-6 py-5 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="flex items-center gap-2">
                          {isActivePenempatan && (
                            <button
                              onClick={() => handleCairkan(inv)}
                              className="p-2 rounded-lg bg-emerald-50 text-emerald-500 hover:bg-emerald-600 hover:text-white transition-all">
                              <Wallet size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => { setEditingInvestment(inv); setShowModal(true); }}
                            className="p-2 rounded-lg bg-blue-50 text-blue-400 hover:bg-blue-500 hover:text-white transition-all">
                            <Pencil size={14} />
                          </button>
                          <button onClick={async () => {
                            if (user && inv.id && confirm(`Hapus deposito ${inv.name}? Saldo rekening akan disesuaikan kembali.`)) {
                              await investmentService.hardDeleteInvestment(inv);
                            }
                          }}
                            className="p-2 rounded-lg bg-slate-50 text-slate-400 hover:bg-rose-500 hover:text-white transition-all">
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <span className="text-[9px] font-black text-slate-400 tracking-tighter whitespace-nowrap">
                          {formatAmount(inv.currentValue, inv.currency)}
                        </span>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </div>


      <DepositModal 
        userId={user?.uid || ''} 
        isOpen={showModal} 
        onClose={() => { setShowModal(false); setEditingInvestment(undefined); }} 
        editData={editingInvestment}
      />
    </div>
  );
}

