"use client";

import { useState, useEffect, useMemo } from 'react';
import { 
  TrendingDown,
  TrendingUp, 
  ShieldCheck,
  FileSpreadsheet,
  Printer,
  ChevronRight,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { YearPicker } from '@/components/ui/YearPicker';
import { transactionService, Transaction } from '@/lib/services/transactionService';
import { investmentService, Investment } from '@/lib/services/investmentService';
import { accountService, Account } from '@/lib/services/accountService';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';

export default function PajakCenterPage() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let unsubTrx: (() => void) | null = null;
    let unsubInv: (() => void) | null = null;
    let unsubAcc: (() => void) | null = null;

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        const startOfYear = new Date(selectedYear, 0, 1);
        const endOfYear = new Date(selectedYear, 11, 31, 23, 59, 59);

        const qTrx = query(
          collection(db, 'transactions'),
          where('userId', '==', u.uid),
          where('date', '>=', startOfYear),
          where('date', '<=', endOfYear),
          orderBy('date', 'desc')
        );
        unsubTrx = onSnapshot(qTrx, (snap) => {
          setTransactions(snap.docs.map(doc => {
            const d = doc.data();
            return { ...d, id: doc.id, amount: Number(d.amount) || 0, date: d.date?.toDate?.() ?? new Date() } as Transaction;
          }));
        });

        const qInv = query(collection(db, 'investments'), where('userId', '==', u.uid));
        unsubInv = onSnapshot(qInv, (snap) => {
          setInvestments(snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Investment));
        });

        const qAcc = query(collection(db, 'accounts'), where('userId', '==', u.uid));
        unsubAcc = onSnapshot(qAcc, (snap) => {
          setAccounts(snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Account));
        });
      }
    });

    return () => {
      unsub();
      if (unsubTrx) unsubTrx();
      if (unsubInv) unsubInv();
      if (unsubAcc) unsubAcc();
    };
  }, [selectedYear]);

  // SPT Specific Aggregations
  const daftarHarta = useMemo(() => {
    return [
      ...accounts.map(acc => ({ name: acc.name, type: acc.type, value: Number(acc.balance) || 0 })),
      ...investments.map(inv => ({ name: inv.name, type: 'Investasi', value: Number(inv.amountInvested) || 0 }))
    ];
  }, [accounts, investments]);

  const daftarUtang = useMemo(() => {
    return accounts.filter(acc => acc.type === 'Kartu Kredit' && acc.balance < 0).map(acc => ({
      name: acc.name,
      value: Math.abs(acc.balance)
    }));
  }, [accounts]);

  const totalHarta = daftarHarta.reduce((s, h) => s + h.value, 0);
  const totalUtang = daftarUtang.reduce((s, u) => s + u.value, 0);

  // New Summary Calculations for PDF
  const totalPemasukan = useMemo(() => transactions.filter(t => t.type === 'pemasukan').reduce((s, t) => s + t.amount, 0), [transactions]);
  const totalPengeluaran = useMemo(() => transactions.filter(t => t.type === 'pengeluaran').reduce((s, t) => s + t.amount, 0), [transactions]);
  const netIncome = totalPemasukan - totalPengeluaran;
  
  const investasiPembelian = useMemo(() => {
    // Assuming transactions with category 'Investasi' or related are investment purchases
    return transactions
      .filter(t => t.type === 'pengeluaran' && (t.category?.toLowerCase().includes('investasi') || t.category === 'Saham' || t.category === 'Deposito'))
      .reduce((s, t) => s + t.amount, 0);
  }, [transactions]);

  const totalPiutang = useMemo(() => {
    return accounts.filter(acc => acc.type?.toLowerCase().includes('piutang')).reduce((s, a) => s + (Number(a.balance) || 0), 0);
  }, [accounts]);

  const formatIDR = (val: number) => {
    return 'Rp ' + new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  };

  const generatedAt = useMemo(() => {
    const now = new Date();
    return `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}, ${now.getHours()}.${now.getMinutes().toString().padStart(2, '0')}.${now.getSeconds().toString().padStart(2, '0')}`;
  }, []);

  // Export Funcs
  const handleExportExcel = () => {
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
// ... rest of handleExportExcel ...
    let tableHtml = `
      <table border="1">
        <tr style="background-color: #f1f5f9;">
          <th style="padding: 10px;">Bulan</th>
          <th style="padding: 10px;">Pemasukan</th>
          <th style="padding: 10px;">Pengeluaran</th>
          <th style="padding: 10px;">Net Arus Kas</th>
        </tr>
    `;

    months.forEach((m, idx) => {
      const monthTrx = transactions.filter(t => t.date.getMonth() === idx);
      const inc = monthTrx.filter(t => t.type === 'pemasukan').reduce((s, t) => s + t.amount, 0);
      const exp = monthTrx.filter(t => t.type === 'pengeluaran').reduce((s, t) => s + t.amount, 0);
      tableHtml += `
        <tr>
          <td style="padding: 8px;">${m}</td>
          <td style="padding: 8px; text-align: right;">${inc.toLocaleString()}</td>
          <td style="padding: 8px; text-align: right;">${exp.toLocaleString()}</td>
          <td style="padding: 8px; text-align: right; font-weight: bold;">${(inc - exp).toLocaleString()}</td>
        </tr>
      `;
    });

    tableHtml += `</table>`;
    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Laporan_Pajak_${selectedYear}.xls`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-700 max-w-[1400px] print:p-0 print:m-0 print:bg-white print:max-w-none">
      
      {/* 0. Print-Only Minimalist Report (Matches User Image) */}
      <div className="hidden print:block font-sans text-slate-800 p-8 space-y-10">
        <div className="space-y-1">
          <h1 className="text-xl font-bold">Draft Ringkasan SPT {selectedYear}</h1>
          <p className="text-[10px] text-slate-400">Generated at {generatedAt}</p>
        </div>

        {/* Ringkasan Total */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold border-b border-slate-100 pb-2">Ringkasan Total</h2>
          <div className="space-y-3">
            {[
              { label: 'Penghasilan', value: formatIDR(totalPemasukan) },
              { label: 'Pengeluaran', value: formatIDR(totalPengeluaran) },
              { label: 'Net Income', value: formatIDR(netIncome) },
              { label: 'Investasi (Pembelian)', value: formatIDR(investasiPembelian) },
              { label: 'Nilai Aset Investasi', value: formatIDR(totalHarta) },
              { label: 'Total Hutang', value: formatIDR(totalUtang) },
              { label: 'Total Piutang', value: formatIDR(totalPiutang) },
              { label: 'Jumlah Transaksi', value: transactions.length },
            ].map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs">
                <span className="text-slate-600">{item.label}</span>
                <span className="font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Mapping Kategori Pajak */}
        <div className="space-y-4 pt-4">
          <h2 className="text-sm font-bold border-b border-slate-100 pb-2">Mapping Kategori Pajak</h2>
          <div className="space-y-3">
            {[
              { label: 'Penghasilan (bucket)', value: formatIDR(totalPemasukan) },
              { label: 'Biaya (bucket)', value: formatIDR(totalPengeluaran - investasiPembelian) },
              { label: 'Investasi (bucket)', value: formatIDR(investasiPembelian) },
              { label: 'Lainnya (bucket)', value: formatIDR(0) },
            ].map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs">
                <span className="text-slate-600">{item.label}</span>
                <span className="font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 1. Dashboard View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-[24px] border border-slate-50 shadow-sm print:hidden">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-tight">Pajak Center</h2>
          <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">SPT Annual Assistant - {selectedYear}</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-100 hover:bg-emerald-100 transition-all"
          >
            <FileSpreadsheet size={14} />
            Excel
          </button>
          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 hover:bg-slate-200 transition-all"
          >
            <Printer size={14} />
            PDF / Print
          </button>

          <div className="w-px h-6 bg-slate-100 mx-1" />

          <YearPicker 
            value={selectedYear}
            onChange={(y) => setSelectedYear(y)}
          />
        </div>
      </div>

      {/* 2. Top Info Cards (Embel-embel Professional) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 print:hidden">
        <div className="p-6 rounded-[32px] bg-slate-900 text-white space-y-4 shadow-xl shadow-slate-200/50">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status SPT Aktif</p>
          <h3 className="text-2xl font-black tracking-tight">Siap Disusun</h3>
          <p className="text-[11px] text-slate-400 leading-relaxed font-medium">Fokus awal diarahkan ke siklus tahunan terbaru agar summary dan arsip bisa ditelusuri per tahun.</p>
        </div>

        <div className="p-6 rounded-[32px] bg-white border border-slate-100 space-y-4 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Pelaporan</p>
          <h3 className="text-2xl font-black tracking-tight text-slate-900">Tahun Pajak {selectedYear}</h3>
          <p className="text-[11px] text-slate-400 leading-relaxed font-medium">Fondasi modul sudah aktif dan siap disambungkan ke data transaksi, investasi, dan dokumen pendukung.</p>
        </div>

        <div className="p-6 rounded-[32px] bg-white border border-slate-100 space-y-4 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Output Utama</p>
          <h3 className="text-2xl font-black tracking-tight text-slate-900">PDF / Print</h3>
          <p className="text-[11px] text-slate-400 leading-relaxed font-medium">Step berikutnya akan menambahkan generator draft, status pelaporan, dan export dokumen yang lebih formal.</p>
        </div>
      </div>

      {/* 3. Main Data Section (Redesigned & Grouped) */}
      <div className="space-y-12 print:hidden">
        
        {/* Grup Asset */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <TrendingUp size={18} />
            </div>
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Daftar Harta (Aset)</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {daftarHarta.length === 0 ? (
              <div className="col-span-full p-12 rounded-[32px] bg-slate-50 border border-dashed border-slate-200 text-center space-y-2">
                <Info className="mx-auto text-slate-300" size={32} />
                <p className="text-sm text-slate-500 font-medium">Belum ada aset terdaftar pada periode ini.</p>
              </div>
            ) : (
              daftarHarta.map((harta, i) => (
                <div key={i} className="p-6 rounded-[32px] bg-white border border-slate-100 hover:border-indigo-100 hover:shadow-lg hover:shadow-indigo-500/5 transition-all group relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex items-center justify-between mb-4">
                    <span className="px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 text-[9px] font-black uppercase tracking-widest border border-slate-100">
                      {harta.type}
                    </span>
                  </div>
                  <h5 className="text-sm font-bold text-slate-900 mb-1 truncate">{harta.name}</h5>
                  <p className="text-lg font-serif font-black text-slate-900">
                    Rp {harta.value.toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Grup Utang */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
              <TrendingDown size={18} />
            </div>
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Daftar Utang & Kewajiban</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {daftarUtang.length === 0 ? (
              <div className="col-span-full p-10 rounded-[32px] bg-slate-50 border border-dashed border-slate-200 text-center">
                <p className="text-sm text-slate-400 font-medium italic">Tidak ada kewajiban tercatat.</p>
              </div>
            ) : (
              <>
                {daftarUtang.map((utang, i) => (
                  <div key={i} className="p-6 rounded-[32px] bg-white border border-slate-100 hover:border-rose-100 hover:shadow-lg hover:shadow-rose-500/5 transition-all group relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-rose-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-center justify-between mb-4">
                      <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-500 text-[9px] font-black uppercase tracking-widest border border-rose-100">
                        KEWAJIBAN
                      </span>
                    </div>
                    <h5 className="text-sm font-bold text-slate-900 mb-1 truncate">{utang.name}</h5>
                    <p className="text-lg font-serif font-black text-rose-600">
                      Rp {utang.value.toLocaleString()}
                    </p>
                  </div>
                ))}
                
                {/* Total Harta Bersih Mini Card */}
                <div className="p-6 rounded-[32px] bg-indigo-600 text-white shadow-lg shadow-indigo-200 lg:col-start-3">
                  <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1">Total Harta Bersih</p>
                  <p className="text-2xl font-serif font-black">
                    Rp {(totalHarta - totalUtang).toLocaleString()}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 4. Footer Note Section (Dashboard View) */}
      <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100 flex items-start gap-6 border-l-4 border-l-slate-300 print:hidden">
        <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-slate-400 shrink-0 shadow-sm">
          <Info size={24} />
        </div>
        <div className="space-y-1">
          <h4 className="font-black text-slate-900 uppercase text-xs tracking-widest">Catatan Penting</h4>
          <p className="text-slate-500 text-sm leading-relaxed">
            Data ini dikumpulkan berdasarkan saldo rekening, daftar aset investasi, dan tagihan kartu kredit yang tercatat dalam sistem Leosiqra. 
            Pastikan seluruh data Anda sudah terupdate di menu <strong>Rekening</strong> dan <strong>Investasi</strong> untuk akurasi pelaporan SPT yang maksimal.
          </p>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          body {
            background-color: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print\\:hidden, 
          header, 
          aside, 
          button, 
          .YearPicker {
            display: none !important;
          }
          main {
            margin-left: 0 !important;
            padding: 0 !important;
          }
          .max-w-[1400px] {
            max-width: none !important;
          }
        }
      `}</style>
    </div>
  );
}
