"use client";

import { useState, useEffect, useRef } from 'react';
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
import { auth, db } from '@/lib/cf-client';
import { onAuthStateChanged } from '@/lib/cf-auth';
import { collection, query, where, onSnapshot } from '@/lib/cf-firestore';

export default function RekeningPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        const q = query(collection(db, 'accounts'), where('userId', '==', u.uid));
        if (unsubRef.current) unsubRef.current();
        const unsubSnap = onSnapshot(q, (snap) => {
          setAccounts(snap.docs.map(doc => {
            const d = doc.data();
            return { ...d, id: doc.id, balance: Number(d.balance) || 0, createdAt: d.createdAt?.toDate?.() ?? new Date() } as Account;
          }));
          setLoading(false);
        }, (err) => { 
          if (err.code !== 'permission-denied') console.error('Account listener error:', err);
          setLoading(false); 
        });
        unsubRef.current = unsubSnap;
      } else { setAccounts([]); setLoading(false); }
    });
    return () => { unsub(); if (unsubRef.current) unsubRef.current(); };
  }, []);

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
          <button className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-widest hover:gap-3 transition-all w-fit">
            Lihat Histori Aktivitas
            <ExternalLink size={14} />
          </button>
        </div>

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
                    <th className="px-5 md:px-10 py-5 md:py-8 text-[10px] font-black text-slate-300 uppercase tracking-widest text-right whitespace-nowrap">Nilai Base</th>
                    <th className="px-5 md:px-10 py-5 md:py-8 text-[10px] font-black text-slate-300 uppercase tracking-widest text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {accounts.map((acc) => (
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
                      <td className="px-5 md:px-10 py-5 md:py-8 text-right font-black text-slate-900 text-sm"> {formatRp(acc.balance || 0)}</td>
                      <td className="px-5 md:px-10 py-5 md:py-8 text-right font-black text-slate-700 text-sm"> {formatRp(acc.baseValue || 0)}</td>
                      <td className="px-5 md:px-10 py-5 md:py-8">
                        <div className="flex items-center justify-center gap-3">
                          <button className="p-2.5 rounded-xl bg-slate-50 text-slate-300 hover:bg-slate-900 hover:text-white transition-all shadow-sm">
                            <Edit2 size={14} />
                          </button>
                          <button 
                            onClick={async () => {
                              if(acc.id) {
                                await accountService.deleteAccount(acc.id);
                              }
                            }}
                            className="p-2.5 rounded-xl bg-slate-50 text-slate-300 hover:bg-rose-500 hover:text-white transition-all shadow-sm">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

