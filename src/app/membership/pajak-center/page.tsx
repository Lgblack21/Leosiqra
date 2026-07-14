"use client";

import { useState, useEffect, useMemo } from 'react';
import {
  TrendingDown,
  TrendingUp,
  FileSpreadsheet,
  Printer,
  Info,
  Landmark,
  AlertTriangle
} from 'lucide-react';
import { YearPicker } from '@/components/ui/YearPicker';
import { Transaction } from '@/lib/services/transactionService';
import { Investment } from '@/lib/services/investmentService';
import { Account } from '@/lib/services/accountService';
import { auth, db } from '@/lib/cf-client';
import { onAuthStateChanged } from '@/lib/cf-auth';
import { collection, query, where, onSnapshot, orderBy } from '@/lib/cf-firestore';
import { cn } from '@/lib/utils';
import { useCountUp } from '@/lib/hooks/useCountUp';

export default function PajakCenterPage() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [debtTransactions, setDebtTransactions] = useState<Transaction[]>([]);

  const isCurrentYear = selectedYear === new Date().getFullYear();

  useEffect(() => {
    let unsubTrx: (() => void) | null = null;
    let unsubInv: (() => void) | null = null;
    let unsubAcc: (() => void) | null = null;
    let unsubDebt: (() => void) | null = null;

    const unsub = onAuthStateChanged(auth, (u) => {
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

        // Portofolio & rekening bersifat posisi terkini (all-time), bukan per-tahun.
        const qInv = query(collection(db, 'investments'), where('userId', '==', u.uid));
        unsubInv = onSnapshot(qInv, (snap) => {
          setInvestments(snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Investment));
        });

        const qAcc = query(collection(db, 'accounts'), where('userId', '==', u.uid));
        unsubAcc = onSnapshot(qAcc, (snap) => {
          setAccounts(snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Account));
        });

        // Hutang & Piutang tercatat sebagai transaksi bertipe 'debt' (menu Hutang & Piutang),
        // bukan sebagai akun — sumber data yang benar untuk Daftar Kewajiban SPT.
        const qDebt = query(
          collection(db, 'transactions'),
          where('userId', '==', u.uid),
          where('type', '==', 'debt')
        );
        unsubDebt = onSnapshot(qDebt, (snap) => {
          setDebtTransactions(snap.docs.map(doc => {
            const d = doc.data();
            return { ...d, id: doc.id, amount: Number(d.amount) || 0, date: d.date?.toDate?.() ?? new Date() } as Transaction;
          }));
        });
      }
    });

    return () => {
      unsub();
      if (unsubTrx) unsubTrx();
      if (unsubInv) unsubInv();
      if (unsubAcc) unsubAcc();
      if (unsubDebt) unsubDebt();
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
    return debtTransactions
      .filter((t) => t.category === 'Hutang' && t.paymentStatus !== 'lunas')
      .map((t) => ({
        name: t.lenderName || t.note || 'Hutang',
        value: t.amount
      }));
  }, [debtTransactions]);

  const daftarPiutang = useMemo(() => {
    return debtTransactions
      .filter((t) => t.category === 'Piutang' && t.paymentStatus !== 'lunas')
      .map((t) => ({
        name: t.lenderName || t.note || 'Piutang',
        value: t.amount
      }));
  }, [debtTransactions]);

  const totalHarta = daftarHarta.reduce((s, h) => s + h.value, 0);
  const totalUtang = daftarUtang.reduce((s, u) => s + u.value, 0);
  const totalPiutang = daftarPiutang.reduce((s, p) => s + p.value, 0);

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

  const formatIDR = (val: number) => {
    return 'Rp ' + new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  };

  const formatIDRShort = (val: number) => {
    if (Math.abs(val) >= 1_000_000_000) return `${val < 0 ? '-' : ''}Rp ${(Math.abs(val) / 1_000_000_000).toFixed(2)}M`;
    if (Math.abs(val) >= 1_000_000) return `${val < 0 ? '-' : ''}Rp ${(Math.abs(val) / 1_000_000).toFixed(2)}Jt`;
    return (val < 0 ? '-Rp ' : 'Rp ') + new Intl.NumberFormat('id-ID').format(Math.abs(val));
  };

  // Angka kartu ringkasan dianimasikan naik/turun secara halus.
  const animatedNetIncome = useCountUp(netIncome);
  const animatedTotalHarta = useCountUp(totalHarta);
  const animatedTotalUtang = useCountUp(totalUtang);
  const animatedTotalPiutang = useCountUp(totalPiutang);
  const animatedHartaBersih = useCountUp(totalHarta + totalPiutang - totalUtang);

  const generatedAt = useMemo(() => {
    const now = new Date();
    return `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}, ${now.getHours()}.${now.getMinutes().toString().padStart(2, '0')}.${now.getSeconds().toString().padStart(2, '0')}`;
  }, []);

  // Export Funcs
  const handleExportExcel = () => {
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

    let tableHtml = `
      <h3>Arus Kas Bulanan &ndash; Tahun ${selectedYear}</h3>
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

    const buildListTable = (title: string, rows: { name: string; value: number }[], extraCol?: (r: { name: string; type?: string }) => string) => {
      let html = `<h3>${title} (posisi terkini)</h3><table border="1"><tr style="background-color: #f1f5f9;"><th style="padding: 10px;">Nama</th>${extraCol ? '<th style="padding: 10px;">Tipe</th>' : ''}<th style="padding: 10px;">Nilai (Rp)</th></tr>`;
      if (rows.length === 0) {
        html += `<tr><td style="padding: 8px;" colspan="${extraCol ? 3 : 2}">Tidak ada data.</td></tr>`;
      } else {
        rows.forEach((r) => {
          html += `<tr><td style="padding: 8px;">${r.name}</td>${extraCol ? `<td style="padding: 8px;">${extraCol(r as { name: string; type?: string })}</td>` : ''}<td style="padding: 8px; text-align: right;">${r.value.toLocaleString()}</td></tr>`;
        });
      }
      html += `</table>`;
      return html;
    };

    tableHtml += buildListTable('Daftar Harta', daftarHarta, (r) => (r as { type?: string }).type ?? '-');
    tableHtml += buildListTable('Daftar Utang', daftarUtang);
    tableHtml += buildListTable('Daftar Piutang', daftarPiutang);
    tableHtml += `<p>Harta Bersih (Harta + Piutang &minus; Utang): Rp ${(totalHarta + totalPiutang - totalUtang).toLocaleString()}</p>`;
    tableHtml += `<p style="font-size: 10px; color: #94a3b8;">Draft pembanding pribadi &ndash; bukan pengganti pelaporan resmi via coretaxdjp.pajak.go.id</p>`;

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
          <p className="text-[10px] text-slate-400">Dibuat pada {generatedAt} · Dokumen ini adalah draft pembanding pribadi, bukan pengganti pelaporan resmi via coretaxdjp.pajak.go.id</p>
        </div>

        {/* Ringkasan Total */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold border-b border-slate-100 pb-2">Ringkasan Total (Tahun {selectedYear})</h2>
          <div className="space-y-3">
            {[
              { label: 'Penghasilan', value: formatIDR(totalPemasukan) },
              { label: 'Pengeluaran', value: formatIDR(totalPengeluaran) },
              { label: 'Penghasilan Neto', value: formatIDR(netIncome) },
              { label: 'Investasi (Pembelian Tahun Ini)', value: formatIDR(investasiPembelian) },
              { label: 'Total Harta (posisi terkini)', value: formatIDR(totalHarta) },
              { label: 'Total Utang (posisi terkini)', value: formatIDR(totalUtang) },
              { label: 'Total Piutang (posisi terkini)', value: formatIDR(totalPiutang) },
              { label: 'Harta Bersih (Harta + Piutang − Utang)', value: formatIDR(totalHarta + totalPiutang - totalUtang) },
              { label: 'Jumlah Transaksi', value: transactions.length },
            ].map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs">
                <span className="text-slate-600">{item.label}</span>
                <span className="font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Daftar Harta */}
        <div className="space-y-4 pt-4">
          <h2 className="text-sm font-bold border-b border-slate-100 pb-2">Daftar Harta</h2>
          <div className="space-y-2">
            {daftarHarta.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Belum ada aset yang tercatat.</p>
            ) : daftarHarta.map((h, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs">
                <span className="text-slate-600">{h.name} <span className="text-slate-400">({h.type})</span></span>
                <span className="font-medium">{formatIDR(h.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Daftar Utang */}
        <div className="space-y-4 pt-4">
          <h2 className="text-sm font-bold border-b border-slate-100 pb-2">Daftar Utang (Kewajiban)</h2>
          <div className="space-y-2">
            {daftarUtang.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Tidak ada utang belum lunas yang tercatat.</p>
            ) : daftarUtang.map((u, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs">
                <span className="text-slate-600">{u.name}</span>
                <span className="font-medium">{formatIDR(u.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Daftar Piutang */}
        <div className="space-y-4 pt-4">
          <h2 className="text-sm font-bold border-b border-slate-100 pb-2">Daftar Piutang</h2>
          <div className="space-y-2">
            {daftarPiutang.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Tidak ada piutang belum lunas yang tercatat.</p>
            ) : daftarPiutang.map((p, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs">
                <span className="text-slate-600">{p.name}</span>
                <span className="font-medium">{formatIDR(p.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Mapping Kategori Pajak */}
        <div className="space-y-4 pt-4">
          <h2 className="text-sm font-bold border-b border-slate-100 pb-2">Mapping Kategori Pajak (Estimasi Internal)</h2>
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
          <p className="text-[10px] text-slate-400 italic pt-2">
            *Bucket ini adalah estimasi kasar untuk membantu pengecekan pribadi, bukan perhitungan PPh resmi (PTKP/PKP/tarif Pasal 17). Verifikasi ulang saat mengisi SPT resmi.
          </p>
        </div>
      </div>

      {/* 1. Dashboard View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-br from-white to-indigo-50/40 p-6 rounded-[24px] border border-slate-100 shadow-sm print:hidden">
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-gradient-to-br from-navy to-indigo-700 text-white items-center justify-center shadow-lg shadow-indigo-600/20 shrink-0">
            <Landmark size={22} />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-serif font-black text-slate-900 tracking-tight leading-tight">Pajak Center</h2>
            <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Draft Ringkasan SPT · Tahun Pajak {selectedYear}</p>
          </div>
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

      {/* 1b. Accuracy Disclaimer — penting untuk alat bantu cek SPT */}
      <div className="flex items-start gap-4 p-5 rounded-[20px] bg-amber-50 border border-amber-100 print:hidden">
        <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-[11px] md:text-xs text-amber-800 leading-relaxed font-medium">
          <strong>Daftar Harta, Utang, dan Piutang</strong> menampilkan <strong>posisi terkini (hari ini)</strong>, bukan posisi resmi per 31 Desember {selectedYear}
          {!isCurrentYear && <> — karena Anda melihat tahun pajak yang sudah lewat, angka ini <strong>kemungkinan tidak sama</strong> dengan kondisi akhir tahun {selectedYear}</>}.
          {' '}<strong>Penghasilan &amp; Pengeluaran</strong> di bawah sudah difilter khusus tahun {selectedYear}. Gunakan halaman ini sebagai draft pembanding, dan tetap verifikasi manual sebelum melapor resmi melalui{' '}
          <a href="https://coretaxdjp.pajak.go.id/" target="_blank" rel="noopener noreferrer" className="underline font-bold hover:text-amber-900">coretaxdjp.pajak.go.id</a>.
        </p>
      </div>

      {/* 2. Top Info Cards — ringkasan kategori inti SPT (Penghasilan Neto / Harta / Kewajiban) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 print:hidden">
        <div className="p-6 rounded-[32px] bg-gradient-to-br from-slate-900 to-navy text-white space-y-2 shadow-xl shadow-slate-200/50">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Penghasilan Neto {selectedYear}</p>
          <h3 className={cn("text-2xl font-black tracking-tight tabular-nums", netIncome >= 0 ? "text-white" : "text-rose-300")}>{formatIDRShort(animatedNetIncome)}</h3>
          <p className="text-[11px] text-slate-400 leading-relaxed font-medium">Total pemasukan dikurangi pengeluaran sepanjang tahun {selectedYear}.</p>
        </div>

        <div className="p-6 rounded-[32px] bg-white border border-slate-100 space-y-2 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Harta (Aset)</p>
          <h3 className="text-2xl font-black tracking-tight text-slate-900 tabular-nums">{formatIDRShort(animatedTotalHarta)}</h3>
          <p className="text-[11px] text-slate-400 leading-relaxed font-medium">Saldo rekening + nilai portofolio investasi, posisi terkini.</p>
        </div>

        <div className="p-6 rounded-[32px] bg-white border border-slate-100 space-y-2 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Kewajiban (Utang)</p>
          <h3 className={cn("text-2xl font-black tracking-tight tabular-nums", totalUtang > 0 ? "text-rose-500" : "text-slate-900")}>{formatIDRShort(animatedTotalUtang)}</h3>
          <p className="text-[11px] text-slate-400 leading-relaxed font-medium">Hutang belum lunas dari menu Hutang &amp; Piutang.</p>
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
                <p className="text-sm text-slate-500 font-medium">Belum ada aset yang tercatat. Tambahkan rekening atau investasi Anda.</p>
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
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Daftar Utang (Kewajiban)</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {daftarUtang.length === 0 ? (
              <div className="col-span-full p-10 rounded-[32px] bg-slate-50 border border-dashed border-slate-200 text-center">
                <p className="text-sm text-slate-400 font-medium italic">Tidak ada utang belum lunas yang tercatat.</p>
              </div>
            ) : (
              daftarUtang.map((utang, i) => (
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
              ))
            )}
          </div>
        </div>

        {/* Grup Piutang */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600">
              <TrendingUp size={18} />
            </div>
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Daftar Piutang</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {daftarPiutang.length === 0 ? (
              <div className="col-span-full p-10 rounded-[32px] bg-slate-50 border border-dashed border-slate-200 text-center">
                <p className="text-sm text-slate-400 font-medium italic">Tidak ada piutang belum lunas yang tercatat.</p>
              </div>
            ) : (
              daftarPiutang.map((piutang, i) => (
                <div key={i} className="p-6 rounded-[32px] bg-white border border-slate-100 hover:border-sky-100 hover:shadow-lg hover:shadow-sky-500/5 transition-all group relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-sky-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex items-center justify-between mb-4">
                    <span className="px-2.5 py-1 rounded-full bg-sky-50 text-sky-600 text-[9px] font-black uppercase tracking-widest border border-sky-100">
                      PIUTANG
                    </span>
                  </div>
                  <h5 className="text-sm font-bold text-slate-900 mb-1 truncate">{piutang.name}</h5>
                  <p className="text-lg font-serif font-black text-sky-600">
                    Rp {piutang.value.toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Total Harta Bersih */}
        <div className="p-8 rounded-[32px] bg-gradient-to-br from-navy to-indigo-700 text-white shadow-lg shadow-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1">Total Harta Bersih (Harta + Piutang − Utang)</p>
            <p className="text-3xl font-serif font-black tabular-nums">
              Rp {Math.round(animatedHartaBersih).toLocaleString()}
            </p>
          </div>
          <div className="flex gap-6 text-right">
            <div>
              <p className="text-[9px] font-bold text-indigo-200 uppercase tracking-widest">Harta</p>
              <p className="text-sm font-black tabular-nums">Rp {Math.round(animatedTotalHarta).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-indigo-200 uppercase tracking-widest">Piutang</p>
              <p className="text-sm font-black tabular-nums">Rp {Math.round(animatedTotalPiutang).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-indigo-200 uppercase tracking-widest">Utang</p>
              <p className="text-sm font-black tabular-nums">Rp {Math.round(animatedTotalUtang).toLocaleString()}</p>
            </div>
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
            Data ini dikumpulkan dari saldo rekening, daftar aset investasi, dan utang/piutang yang belum lunas dari menu <strong>Hutang &amp; Piutang</strong>.
            Pastikan seluruh data Anda sudah terupdate di menu <strong>Rekening</strong>, <strong>Investasi</strong>, dan <strong>Hutang &amp; Piutang</strong> untuk akurasi draft yang maksimal.
            Halaman ini hanya membantu <strong>menghitung dan merangkum</strong> — pelaporan resmi tetap Anda lakukan sendiri melalui <strong>coretaxdjp.pajak.go.id</strong>.
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

