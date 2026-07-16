"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Wallet,
  Landmark,
  Banknote,
  Edit2,
  Trash2,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { LogoImage } from '@/components/ui/LogoImage';
import { accountService, Account } from '@/lib/services/accountService';
import { Transaction } from '@/lib/services/transactionService';
import { exchangeRateService, ExchangeRates } from '@/lib/services/exchangeRateService';
import { auth, db } from '@/lib/cf-client';
import { onAuthStateChanged, User } from '@/lib/cf-auth';
import { collection, query, where, onSnapshot } from '@/lib/cf-firestore';
import { AccountModal } from '@/components/modals/AccountModal';
import { isCreditAccountType, computeCreditUsage } from '@/lib/creditCard';

export default function RekeningPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [fxRates, setFxRates] = useState<ExchangeRates>({});

  useEffect(() => {
    exchangeRateService.getLatestRates().then(setFxRates).catch(console.error);
  }, []);

  const unsubRef = useRef<(() => void) | null>(null);
  const unsubTrxRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        // Transaksi dipakai untuk menghitung terpakai/sisa limit kartu kredit
        // & paylater — lihat lib/creditCard.ts.
        const qTrx = query(collection(db, 'transactions'), where('userId', '==', u.uid));
        if (unsubTrxRef.current) unsubTrxRef.current();
        unsubTrxRef.current = onSnapshot(qTrx, (snap) => {
          setTransactions(snap.docs.map(doc => {
            const d = doc.data();
            return { ...d, id: doc.id, amount: Number(d.amount) || 0, date: d.date?.toDate?.() ?? new Date(), createdAt: d.createdAt?.toDate?.() ?? new Date() } as Transaction;
          }));
        }, (err) => console.error(err));

        const q = query(collection(db, 'accounts'), where('userId', '==', u.uid));
        if (unsubRef.current) unsubRef.current();
        const unsubSnap = onSnapshot(q, (snap) => {
          setAccounts(snap.docs.map(doc => {
            const d = doc.data();
            // payload_json menyimpan cardColor & creditLimit — wajib di-parse, kalau
            // tidak keduanya hilang saat rekening ini diedit lewat AccountModal.
            let cardColor: string | undefined;
            let creditLimit = 0;
            const payloadJson = (d.payload_json ?? d.payloadJson) as string | null | undefined;
            if (payloadJson) {
              try {
                const parsed = JSON.parse(payloadJson) as { cardColor?: string; creditLimit?: number };
                cardColor = parsed.cardColor;
                creditLimit = Number(parsed.creditLimit) || 0;
              } catch {
                // payload_json tidak valid JSON — abaikan.
              }
            }
            return { ...d, id: doc.id, balance: Number(d.balance) || 0, cardColor, creditLimit, createdAt: d.createdAt?.toDate?.() ?? new Date() } as Account;
          }));
          setLoading(false);
        }, (err) => {
          if (err.code !== 'permission-denied') console.error('Account listener error:', err);
          setLoading(false);
        });
        unsubRef.current = unsubSnap;
      } else { setAccounts([]); setTransactions([]); setLoading(false); }
    });
    return () => { unsub(); if (unsubRef.current) unsubRef.current(); if (unsubTrxRef.current) unsubTrxRef.current(); };
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus rekening ini? Tindakan ini tidak bisa dibatalkan.')) return;
    setError('');
    setDeletingId(id);
    try {
      await accountService.deleteAccount(id);
    } catch (e) {
      console.error(e);
      setError('Gagal menghapus rekening. Silakan coba lagi.');
    } finally {
      setDeletingId(null);
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'Bank Account': return <Building2 size={20} className="text-white" />;
      case 'E-Wallet': return <Wallet size={20} className="text-white" />;
      case 'Cash': return <Banknote size={20} className="text-white" />;
      case 'Investment Account': return <Landmark size={20} className="text-white" />;
      default: return <Building2 size={20} className="text-white" />;
    }
  };

  const getBgForType = (type: string) => {
    switch (type) {
      case 'Bank Account': return 'bg-blue-600';
      case 'E-Wallet': return 'bg-indigo-600';
      case 'Cash': return 'bg-emerald-500';
      case 'Investment Account': return 'bg-slate-900';
      default: return 'bg-blue-500';
    }
  };

  const formatRp = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num).replace('Rp', '');
  };

  // Nilai IDR otomatis (menggantikan field manual "Nilai Base" yang sudah dihapus).
  const toIDR = (amount: number, currency: string | undefined) =>
    exchangeRateService.convert(amount, currency || 'IDR', 'IDR', fxRates);

  // Kartu kredit/paylater dimodelkan sebagai limit, bukan saldo kas — kolom
  // "Saldo" untuk tipe ini menampilkan terpakai (dihitung dari transaksi,
  // bukan kolom balance) memakai rumus yang sama dengan halaman Kartu Saya.
  const creditUsageByAccount = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeCreditUsage>>();
    accounts.filter(a => isCreditAccountType(a.type) && a.id).forEach(acc => {
      map.set(acc.id!, computeCreditUsage(acc, transactions));
    });
    return map;
  }, [accounts, transactions]);

  const formatBalance = (amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: currency || 'IDR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${currency || ''} ${formatRp(amount)}`.trim();
    }
  };

  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-700 max-w-[1400px] mb-12">
      
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">Rekening</h1>
          <p className="text-[12px] md:text-sm font-medium text-slate-400 mt-2 max-w-xl leading-relaxed">
            Kelola akun keuangan dan saldo awal Anda melalui menu &apos;Tambah Cepat&apos; di header.
          </p>
        </div>
      </div>

      {/* 2. Top Statistic Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* KEAMANAN DATA CARD */}
        <div className="bg-blue-600 rounded-[20px] md:rounded-[32px] p-6 md:p-8 text-white relative overflow-hidden group shadow-2xl shadow-blue-100 flex items-center justify-between">
          <div className="relative z-10 space-y-2 max-w-sm">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck size={20} className="text-blue-200" />
              <h3 className="text-base font-black tracking-tight">Keamanan Data Terenkripsi</h3>
            </div>
            <p className="text-[11px] font-medium text-blue-100 leading-relaxed">
              Informasi saldo dan rekening Anda dienkripsi secara end-to-end. Kami tidak menyimpan detail login bank Anda.
            </p>
          </div>
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none" />
        </div>

        {/* QUICK STATS CARD */}
        <div className="bg-white rounded-[20px] md:rounded-[32px] p-6 md:p-8 border border-slate-50 shadow-sm flex flex-col justify-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Ringkasan Portofolio Akun</p>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-400">Total Rekening Tersimpan</span>
              <span className="text-sm font-black text-slate-900">{loading ? '-' : accounts.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Daftar Rekening Table */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
          <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Daftar Rekening</h2>
          <button
            onClick={() => router.push('/membership/transactions/daily')}
            className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-widest hover:gap-3 transition-all w-fit"
          >
            Lihat Histori Aktivitas
            <ExternalLink size={14} />
          </button>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 text-sm font-medium text-rose-600">
            {error}
          </div>
        )}

        <div className="bg-white rounded-[20px] md:rounded-[40px] border border-slate-50 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-sm font-medium text-slate-400">Memuat data rekening...</div>
          ) : accounts.length === 0 ? (
            <div className="p-6">
               <EmptyState 
                 title="Belum ada rekening" 
                 description="Klik 'Tambah Cepat' di header dan pilih 'Rekening Baru' untuk mulai melacak keuangan."
                 icon={<Building2 size={24} />}
               />
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left min-w-[1100px] md:min-w-0">
                <thead>
                  <tr className="border-b border-slate-50">
                    <th className="px-5 md:px-10 py-5 md:py-8 text-[10px] font-black text-slate-300 uppercase tracking-widest text-center whitespace-nowrap">Logo</th>
                    <th className="px-5 md:px-10 py-5 md:py-8 text-[10px] font-black text-slate-300 uppercase tracking-widest whitespace-nowrap">Nama Akhir</th>
                    <th className="px-5 md:px-10 py-5 md:py-8 text-[10px] font-black text-slate-300 uppercase tracking-widest whitespace-nowrap">Jenis</th>
                    <th className="px-5 md:px-10 py-5 md:py-8 text-[10px] font-black text-slate-300 uppercase tracking-widest text-center whitespace-nowrap">Mata Uang</th>
                    <th className="px-5 md:px-10 py-5 md:py-8 text-[10px] font-black text-slate-300 uppercase tracking-widest text-right whitespace-nowrap">Saldo</th>
                    <th className="px-5 md:px-10 py-5 md:py-8 text-[10px] font-black text-slate-300 uppercase tracking-widest text-right whitespace-nowrap">Nilai (IDR)</th>
                    <th className="px-5 md:px-10 py-5 md:py-8 text-[10px] font-black text-slate-300 uppercase tracking-widest text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {accounts.map((acc) => {
                    const isCredit = isCreditAccountType(acc.type);
                    const creditUsage = acc.id ? creditUsageByAccount.get(acc.id) : undefined;
                    // Untuk kartu kredit/paylater, "Saldo" berarti dana yang masih bisa
                    // dipakai — jadi tampilkan sisa limit (bukan terpakai) sebagai angka utama.
                    const displayAmount = isCredit ? (creditUsage?.remaining ?? 0) : (acc.balance || 0);
                    return (
                    <tr key={acc.id} className="group hover:bg-slate-50/50 transition-all border-b border-slate-50 last:border-b-0">
                      <td className="px-5 md:px-10 py-5 md:py-8">
                        <div className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center overflow-hidden bg-white border border-slate-50">
                          <LogoImage
                            src={acc.logoUrl}
                            alt={acc.name}
                            fallbackText={acc.name.substring(0, 3).toUpperCase()}
                            fallbackIcon={(
                              <div className={`w-full h-full flex items-center justify-center ${getBgForType(acc.type)} text-white`}>
                                {getIconForType(acc.type)}
                              </div>
                            )}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </td>
                      <td className="px-5 md:px-10 py-5 md:py-8">
                        <p className="text-sm font-black text-slate-900 truncate">{acc.name}</p>
                      </td>
                      <td className="px-5 md:px-10 py-5 md:py-8">
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide truncate">{acc.type}</p>
                      </td>
                      <td className="px-5 md:px-10 py-5 md:py-8 text-center">
                        <span className="px-3 py-1.5 bg-slate-100 text-[9px] font-black text-slate-400 rounded-lg tracking-widest uppercase">{acc.currency}</span>
                      </td>
                      <td className="px-5 md:px-10 py-5 md:py-8 text-right whitespace-nowrap">
                        <p className={`font-black text-sm ${isCredit ? 'text-emerald-600' : 'text-slate-900'}`}>{formatBalance(displayAmount, acc.currency)}</p>
                        {isCredit && (
                          <p className="text-[9px] font-bold text-slate-400 mt-0.5">Sisa Limit &middot; Terpakai {formatBalance(creditUsage?.used ?? 0, acc.currency)}</p>
                        )}
                      </td>
                      <td className="px-5 md:px-10 py-5 md:py-8 text-right font-black text-slate-700 text-sm whitespace-nowrap"> {formatRp(toIDR(displayAmount, acc.currency))}</td>
                      <td className="px-5 md:px-10 py-5 md:py-8">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={() => { setEditingAccount(acc); setIsModalOpen(true); }}
                            className="p-2.5 rounded-xl bg-slate-50 text-slate-300 hover:bg-slate-900 hover:text-white transition-all shadow-sm">
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => acc.id && handleDelete(acc.id)}
                            disabled={deletingId === acc.id}
                            className="p-2.5 rounded-xl bg-slate-50 text-slate-300 hover:bg-rose-500 hover:text-white transition-all shadow-sm disabled:opacity-50">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {user && (
        <AccountModal
          userId={user.uid}
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setEditingAccount(null); }}
          initialData={editingAccount}
          existingTypes={Array.from(new Set(accounts.map(a => a.type).filter(Boolean)))}
        />
      )}
    </div>
  );
}

