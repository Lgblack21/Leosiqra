"use client";

import Image from 'next/image';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TrendingDown,
  TrendingUp,
  FileSpreadsheet,
  Printer,
  Info,
  Landmark,
  AlertTriangle,
  X,
  Calculator,
  ChevronDown
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
import { exchangeRateService, ExchangeRates } from '@/lib/services/exchangeRateService';

// PTKP (Penghasilan Tidak Kena Pajak) & tarif PPh Pasal 17 UU HPP (berlaku
// sejak tahun pajak 2022) — dasar hukum untuk estimasi PPh Orang Pribadi.
const PTKP_BASE: Record<'TK' | 'K', number> = { TK: 54_000_000, K: 58_500_000 };
const PTKP_PER_TANGGUNGAN = 4_500_000;
const MAX_TANGGUNGAN = 3;

const TAX_BRACKETS = [
  { min: 0, max: 60_000_000, rate: 0.05 },
  { min: 60_000_000, max: 250_000_000, rate: 0.15 },
  { min: 250_000_000, max: 500_000_000, rate: 0.25 },
  { min: 500_000_000, max: 5_000_000_000, rate: 0.30 },
  { min: 5_000_000_000, max: Infinity, rate: 0.35 },
] as const;

interface TaxBracketResult {
  min: number;
  max: number;
  rate: number;
  taxableInBracket: number;
  tax: number;
}

// Pajak progresif — tiap lapisan cuma kena tarifnya sendiri atas bagian yang
// masuk lapisan itu, bukan seluruh PKP dikali tarif tertinggi.
const calculatePPh = (pkp: number): { totalTax: number; breakdown: TaxBracketResult[] } => {
  if (pkp <= 0) return { totalTax: 0, breakdown: [] };
  const breakdown: TaxBracketResult[] = [];
  let totalTax = 0;
  for (const bracket of TAX_BRACKETS) {
    if (pkp <= bracket.min) break;
    const upper = Math.min(pkp, bracket.max);
    const taxableInBracket = upper - bracket.min;
    const tax = taxableInBracket * bracket.rate;
    breakdown.push({ ...bracket, taxableInBracket, tax });
    totalTax += tax;
  }
  return { totalTax, breakdown };
};

export default function PajakCenterPage() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [debtTransactions, setDebtTransactions] = useState<Transaction[]>([]);
  const [fxRates, setFxRates] = useState<ExchangeRates>({});
  const [showDisclaimer, setShowDisclaimer] = useState(true);

  // Status PTKP disimpan lokal di browser (bukan per-tahun-pajak) — jarang
  // berubah, jadi tidak perlu kolom database sendiri.
  const [maritalStatus, setMaritalStatus] = useState<'TK' | 'K'>('TK');
  const [dependents, setDependents] = useState(0);

  useEffect(() => {
    exchangeRateService.getLatestRates().then(setFxRates).catch(console.error);
  }, []);

  useEffect(() => {
    if (localStorage.getItem('pajak-center-disclaimer-dismissed') === '1') {
      setShowDisclaimer(false);
    }
    const savedStatus = localStorage.getItem('pajak-center-marital-status');
    if (savedStatus === 'TK' || savedStatus === 'K') setMaritalStatus(savedStatus);
    const savedDependents = Number(localStorage.getItem('pajak-center-dependents'));
    if (Number.isFinite(savedDependents) && savedDependents >= 0 && savedDependents <= MAX_TANGGUNGAN) {
      setDependents(savedDependents);
    }
  }, []);

  const updateMaritalStatus = (status: 'TK' | 'K') => {
    setMaritalStatus(status);
    localStorage.setItem('pajak-center-marital-status', status);
  };

  const updateDependents = (count: number) => {
    setDependents(count);
    localStorage.setItem('pajak-center-dependents', String(count));
  };

  const dismissDisclaimer = () => {
    setShowDisclaimer(false);
    localStorage.setItem('pajak-center-disclaimer-dismissed', '1');
  };

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
          setInvestments(
            snap.docs
              .map(doc => ({ ...doc.data(), id: doc.id }) as Investment)
              // Deposito "Penempatan" otomatis punya baris proyeksi "(Hasil Akhir)"
              // berstatus Planned — bukan harta nyata, jangan ikut dihitung di
              // Daftar Harta (dulu bikin nilai harta dobel untuk SPT).
              .filter(inv => inv.status !== 'Planned')
          );
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

  // SPT wajib dilaporkan dalam Rupiah — akun/transaksi dalam mata uang asing
  // dikonversi ke IDR pakai kurs live sebelum masuk daftar harta/utang,
  // bukan angka mentahnya (yang sebelumnya dijumlah seolah sudah IDR).
  const toIDR = useCallback(
    (amount: number, currency: string | undefined) =>
      exchangeRateService.convert(amount, currency || 'IDR', 'IDR', fxRates),
    [fxRates]
  );

  // SPT Specific Aggregations
  const daftarHarta = useMemo(() => {
    return [
      ...accounts.map(acc => ({ name: acc.name, type: acc.type, value: toIDR(Number(acc.balance) || 0, acc.currency) })),
      ...investments.map(inv => ({ name: inv.name, type: 'Investasi', value: Number(inv.amountIDR) || Number(inv.amountInvested) || 0 }))
    ];
  }, [accounts, investments, toIDR]);

  const daftarUtang = useMemo(() => {
    return debtTransactions
      .filter((t) => t.category === 'Hutang' && t.paymentStatus !== 'lunas')
      .map((t) => ({
        name: t.lenderName || t.note || 'Hutang',
        value: Number(t.amountIDR) || t.amount
      }));
  }, [debtTransactions]);

  const daftarPiutang = useMemo(() => {
    return debtTransactions
      .filter((t) => t.category === 'Piutang' && t.paymentStatus !== 'lunas')
      .map((t) => ({
        name: t.lenderName || t.note || 'Piutang',
        value: Number(t.amountIDR) || t.amount
      }));
  }, [debtTransactions]);

  const totalHarta = daftarHarta.reduce((s, h) => s + h.value, 0);
  const totalUtang = daftarUtang.reduce((s, u) => s + u.value, 0);
  const totalPiutang = daftarPiutang.reduce((s, p) => s + p.value, 0);

  // New Summary Calculations for PDF
  const totalPemasukan = useMemo(() => transactions.filter(t => t.type === 'pemasukan').reduce((s, t) => s + (Number(t.amountIDR) || t.amount), 0), [transactions]);
  const totalPengeluaran = useMemo(() => transactions.filter(t => t.type === 'pengeluaran').reduce((s, t) => s + (Number(t.amountIDR) || t.amount), 0), [transactions]);

  const investasiPembelian = useMemo(() => {
    // Assuming transactions with category 'Investasi' or related are investment purchases
    return transactions
      .filter(t => t.type === 'pengeluaran' && (t.category?.toLowerCase().includes('investasi') || t.category === 'Saham' || t.category === 'Deposito'))
      .reduce((s, t) => s + (Number(t.amountIDR) || t.amount), 0);
  }, [transactions]);

  // Penempatan dana ke deposito/saham/investasi lain BUKAN pengeluaran/kerugian
  // untuk keperluan pajak — itu cuma pemindahan aset (uang tunai jadi
  // instrumen investasi), dan sudah terhitung terpisah sebagai "Harta" di
  // Daftar Harta. Kalau ikut dikurangkan di sini, Penghasilan Neto jadi
  // salah besar-besaran (mis. taruh Rp280 juta ke deposito bikin neto minus
  // Rp280 juta padahal itu bukan kerugian) — kecualikan dari sini, sama
  // seperti "Biaya (bucket)" di laporan cetak yang sudah benar duluan.
  const netIncome = totalPemasukan - (totalPengeluaran - investasiPembelian);

  // PTKP, PKP, dan estimasi PPh terutang (Pasal 17 UU HPP) — PKP dibulatkan
  // ke bawah kelipatan Rp1.000 sesuai ketentuan resmi.
  const ptkp = PTKP_BASE[maritalStatus] + Math.min(dependents, MAX_TANGGUNGAN) * PTKP_PER_TANGGUNGAN;
  const pkp = Math.floor(Math.max(0, netIncome - ptkp) / 1000) * 1000;
  const { totalTax: pphTerutang, breakdown: pphBreakdown } = useMemo(() => calculatePPh(pkp), [pkp]);

  // SPT resmi melaporkan nilai dalam Rupiah penuh (tanpa desimal) — desimal
  // di sini cuma bikin angka lebih panjang dan gampang kepotong di cetakan.
  const formatIDR = (val: number) => {
    return 'Rp ' + new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(val));
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
  const animatedPphTerutang = useCountUp(pphTerutang);

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
      const inc = monthTrx.filter(t => t.type === 'pemasukan').reduce((s, t) => s + (Number(t.amountIDR) || t.amount), 0);
      const exp = monthTrx.filter(t => t.type === 'pengeluaran').reduce((s, t) => s + (Number(t.amountIDR) || t.amount), 0);
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

    tableHtml += `<h3>Perhitungan PPh Terutang (Pasal 17 UU HPP)</h3>`;
    tableHtml += `<table border="1">
      <tr style="background-color: #f1f5f9;"><th style="padding: 10px;">Komponen</th><th style="padding: 10px;">Nilai (Rp)</th></tr>
      <tr><td style="padding: 8px;">Status PTKP</td><td style="padding: 8px;">${maritalStatus}/${dependents}</td></tr>
      <tr><td style="padding: 8px;">PTKP Setahun</td><td style="padding: 8px; text-align: right;">${ptkp.toLocaleString()}</td></tr>
      <tr><td style="padding: 8px;">Penghasilan Neto</td><td style="padding: 8px; text-align: right;">${netIncome.toLocaleString()}</td></tr>
      <tr><td style="padding: 8px; font-weight: bold;">Penghasilan Kena Pajak (PKP)</td><td style="padding: 8px; text-align: right; font-weight: bold;">${pkp.toLocaleString()}</td></tr>
    </table>`;

    tableHtml += `<table border="1">
      <tr style="background-color: #f1f5f9;">
        <th style="padding: 10px;">Lapisan PKP</th>
        <th style="padding: 10px;">Tarif</th>
        <th style="padding: 10px;">Dasar Pengenaan (Rp)</th>
        <th style="padding: 10px;">PPh (Rp)</th>
      </tr>`;
    if (pphBreakdown.length === 0) {
      tableHtml += `<tr><td style="padding: 8px;" colspan="4">PKP Rp 0 atau di bawah PTKP &ndash; tidak ada PPh terutang.</td></tr>`;
    } else {
      pphBreakdown.forEach((b) => {
        tableHtml += `<tr>
          <td style="padding: 8px;">Rp ${b.min.toLocaleString()} s.d. ${b.max === Infinity ? 'ke atas' : 'Rp ' + b.max.toLocaleString()}</td>
          <td style="padding: 8px; text-align: right;">${(b.rate * 100).toFixed(0)}%</td>
          <td style="padding: 8px; text-align: right;">${b.taxableInBracket.toLocaleString()}</td>
          <td style="padding: 8px; text-align: right;">${b.tax.toLocaleString()}</td>
        </tr>`;
      });
    }
    tableHtml += `<tr style="background-color: #f1f5f9;"><td style="padding: 8px; font-weight: bold;" colspan="3">Total PPh Terutang</td><td style="padding: 8px; text-align: right; font-weight: bold;">${pphTerutang.toLocaleString()}</td></tr>`;
    tableHtml += `</table>`;

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
      
      {/* 0. Print-Only Report — layout terinspirasi format SPT Tahunan 1770 */}
      <div className="hidden print:block font-sans text-slate-800 p-8 text-[11px] leading-relaxed">

        {/* Kop Laporan */}
        <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <Image src="/images/Logo-new.png" alt="Leosiqra" width={40} height={40} className="rounded-lg" />
            <div>
              <p className="text-sm font-black tracking-tight">Leosiqra</p>
              <p className="text-[9px] text-slate-400 uppercase tracking-widest">Personal Finance &amp; Tax Assistant</p>
            </div>
          </div>
          <div className="text-right">
            <h1 className="text-base font-black uppercase tracking-tight">Draft Perhitungan Pajak Penghasilan Orang Pribadi</h1>
            <p className="text-[9px] text-slate-400">Tahun Pajak {selectedYear} &middot; Dicetak {generatedAt}</p>
          </div>
        </div>

        <p className="text-[9px] text-slate-500 bg-slate-50 border border-slate-200 rounded p-2 mb-6">
          Dokumen ini adalah <strong>draft perhitungan pribadi</strong> berdasarkan data yang Anda catat di Leosiqra, dibuat mengikuti struktur
          SPT Tahunan 1770 sebagai alat bantu. Ini <strong>bukan dokumen resmi Direktorat Jenderal Pajak</strong> dan tidak menggantikan
          pelaporan SPT yang sah melalui <strong>coretaxdjp.pajak.go.id</strong>. Verifikasi seluruh angka sebelum melapor resmi.
        </p>

        {/* A. Identitas & Status PTKP */}
        <div className="mb-6">
          <h2 className="text-xs font-black uppercase tracking-widest bg-slate-800 text-white px-3 py-1.5 mb-2">A. Status Perpajakan (PTKP)</h2>
          <table className="w-full border-collapse border border-slate-300 table-fixed">
            <tbody>
              <tr>
                <td className="border border-slate-300 px-3 py-1.5 w-1/2 text-slate-500 break-words">Status Pernikahan</td>
                <td className="border border-slate-300 px-3 py-1.5 font-bold">{maritalStatus === 'TK' ? 'Tidak Kawin (TK)' : 'Kawin (K)'}</td>
              </tr>
              <tr>
                <td className="border border-slate-300 px-3 py-1.5 text-slate-500">Jumlah Tanggungan</td>
                <td className="border border-slate-300 px-3 py-1.5 font-bold">{dependents} orang</td>
              </tr>
              <tr>
                <td className="border border-slate-300 px-3 py-1.5 text-slate-500">Kategori PTKP</td>
                <td className="border border-slate-300 px-3 py-1.5 font-bold">{maritalStatus}/{dependents}</td>
              </tr>
              <tr>
                <td className="border border-slate-300 px-3 py-1.5 text-slate-500">Penghasilan Tidak Kena Pajak (PTKP) Setahun</td>
                <td className="border border-slate-300 px-3 py-1.5 font-bold">{formatIDR(ptkp)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* B. Penghasilan Neto & PKP */}
        <div className="mb-6">
          <h2 className="text-xs font-black uppercase tracking-widest bg-slate-800 text-white px-3 py-1.5 mb-2">B. Penghasilan Neto &amp; Penghasilan Kena Pajak (PKP)</h2>
          <table className="w-full border-collapse border border-slate-300 table-fixed">
            <tbody>
              <tr>
                <td className="border border-slate-300 px-3 py-1.5 w-1/2 text-slate-500">Penghasilan Bruto Setahun</td>
                <td className="border border-slate-300 px-3 py-1.5 font-bold">{formatIDR(totalPemasukan)}</td>
              </tr>
              <tr>
                <td className="border border-slate-300 px-3 py-1.5 text-slate-500">Pengeluaran / Biaya Setahun</td>
                <td className="border border-slate-300 px-3 py-1.5 font-bold">{formatIDR(totalPengeluaran - investasiPembelian)}</td>
              </tr>
              <tr>
                <td className="border border-slate-300 px-3 py-1.5 text-slate-500">Penghasilan Neto Setahun</td>
                <td className="border border-slate-300 px-3 py-1.5 font-bold">{formatIDR(netIncome)}</td>
              </tr>
              <tr>
                <td className="border border-slate-300 px-3 py-1.5 text-slate-500">Dikurangi: PTKP</td>
                <td className="border border-slate-300 px-3 py-1.5 font-bold">({formatIDR(ptkp)})</td>
              </tr>
              <tr className="bg-slate-100">
                <td className="border border-slate-300 px-3 py-1.5 font-black uppercase text-[10px] tracking-widest">Penghasilan Kena Pajak (PKP)</td>
                <td className="border border-slate-300 px-3 py-1.5 font-black">{formatIDR(pkp)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* C. Perhitungan PPh Terutang (Pasal 17) */}
        <div className="mb-6">
          <h2 className="text-xs font-black uppercase tracking-widest bg-slate-800 text-white px-3 py-1.5 mb-2">C. Perhitungan PPh Terutang &ndash; Tarif Progresif Pasal 17 UU HPP</h2>
          <table className="w-full border-collapse border border-slate-300 table-fixed">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-3 py-1.5 text-left w-[38%]">Lapisan Penghasilan Kena Pajak</th>
                <th className="border border-slate-300 px-3 py-1.5 text-right w-[12%]">Tarif</th>
                <th className="border border-slate-300 px-3 py-1.5 text-right w-[25%]">Dasar Pengenaan</th>
                <th className="border border-slate-300 px-3 py-1.5 text-right w-[25%]">PPh</th>
              </tr>
            </thead>
            <tbody>
              {pphBreakdown.length === 0 ? (
                <tr>
                  <td colSpan={4} className="border border-slate-300 px-3 py-2 text-center italic text-slate-400">
                    PKP Rp 0 atau di bawah PTKP &ndash; tidak ada dasar pengenaan pajak.
                  </td>
                </tr>
              ) : pphBreakdown.map((b, idx) => (
                <tr key={idx}>
                  <td className="border border-slate-300 px-3 py-1.5 break-words">
                    {formatIDR(b.min)} s.d. {b.max === Infinity ? 'ke atas' : formatIDR(b.max)}
                  </td>
                  <td className="border border-slate-300 px-3 py-1.5 text-right">{(b.rate * 100).toFixed(0)}%</td>
                  <td className="border border-slate-300 px-3 py-1.5 text-right break-words">{formatIDR(b.taxableInBracket)}</td>
                  <td className="border border-slate-300 px-3 py-1.5 text-right break-words">{formatIDR(b.tax)}</td>
                </tr>
              ))}
              <tr className="bg-slate-100">
                <td colSpan={3} className="border border-slate-300 px-3 py-1.5 font-black uppercase text-[10px] tracking-widest">Total PPh Terutang Setahun</td>
                <td className="border border-slate-300 px-3 py-1.5 font-black text-right">{formatIDR(pphTerutang)}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-[9px] text-slate-500 italic mt-1.5">
            {pphTerutang > 0
              ? 'Berdasarkan perhitungan di atas, terdapat PPh Orang Pribadi yang berpotensi terutang untuk tahun pajak ini.'
              : 'Berdasarkan perhitungan di atas, tidak ada PPh Orang Pribadi yang terutang untuk tahun pajak ini (PKP nihil).'}
          </p>
        </div>

        {/* D. Daftar Harta */}
        <div className="mb-6" style={{ pageBreakInside: 'avoid' }}>
          <h2 className="text-xs font-black uppercase tracking-widest bg-slate-800 text-white px-3 py-1.5 mb-2">D. Daftar Harta (Posisi Terkini)</h2>
          <table className="w-full border-collapse border border-slate-300 table-fixed">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-3 py-1.5 text-left w-[45%]">Nama Harta</th>
                <th className="border border-slate-300 px-3 py-1.5 text-left w-[25%]">Jenis</th>
                <th className="border border-slate-300 px-3 py-1.5 text-right w-[30%]">Nilai (Rp)</th>
              </tr>
            </thead>
            <tbody>
              {daftarHarta.length === 0 ? (
                <tr><td colSpan={3} className="border border-slate-300 px-3 py-2 text-center italic text-slate-400">Belum ada aset yang tercatat.</td></tr>
              ) : daftarHarta.map((h, idx) => (
                <tr key={idx}>
                  <td className="border border-slate-300 px-3 py-1.5 break-words">{h.name}</td>
                  <td className="border border-slate-300 px-3 py-1.5 text-slate-500 break-words">{h.type}</td>
                  <td className="border border-slate-300 px-3 py-1.5 text-right break-words">{formatIDR(h.value)}</td>
                </tr>
              ))}
              <tr className="bg-slate-100">
                <td colSpan={2} className="border border-slate-300 px-3 py-1.5 font-black uppercase text-[10px] tracking-widest">Total Harta</td>
                <td className="border border-slate-300 px-3 py-1.5 font-black text-right">{formatIDR(totalHarta)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* E. Daftar Utang */}
        <div className="mb-6" style={{ pageBreakInside: 'avoid' }}>
          <h2 className="text-xs font-black uppercase tracking-widest bg-slate-800 text-white px-3 py-1.5 mb-2">E. Daftar Utang (Kewajiban, Posisi Terkini)</h2>
          <table className="w-full border-collapse border border-slate-300 table-fixed">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-3 py-1.5 text-left w-[65%]">Nama Pemberi Pinjaman</th>
                <th className="border border-slate-300 px-3 py-1.5 text-right w-[35%]">Nilai (Rp)</th>
              </tr>
            </thead>
            <tbody>
              {daftarUtang.length === 0 ? (
                <tr><td colSpan={2} className="border border-slate-300 px-3 py-2 text-center italic text-slate-400">Tidak ada utang belum lunas yang tercatat.</td></tr>
              ) : daftarUtang.map((u, idx) => (
                <tr key={idx}>
                  <td className="border border-slate-300 px-3 py-1.5 break-words">{u.name}</td>
                  <td className="border border-slate-300 px-3 py-1.5 text-right break-words">{formatIDR(u.value)}</td>
                </tr>
              ))}
              <tr className="bg-slate-100">
                <td className="border border-slate-300 px-3 py-1.5 font-black uppercase text-[10px] tracking-widest">Total Utang</td>
                <td className="border border-slate-300 px-3 py-1.5 font-black text-right">{formatIDR(totalUtang)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* F. Daftar Piutang */}
        <div className="mb-6" style={{ pageBreakInside: 'avoid' }}>
          <h2 className="text-xs font-black uppercase tracking-widest bg-slate-800 text-white px-3 py-1.5 mb-2">F. Daftar Piutang (Posisi Terkini)</h2>
          <table className="w-full border-collapse border border-slate-300 table-fixed">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-3 py-1.5 text-left w-[65%]">Nama Peminjam</th>
                <th className="border border-slate-300 px-3 py-1.5 text-right w-[35%]">Nilai (Rp)</th>
              </tr>
            </thead>
            <tbody>
              {daftarPiutang.length === 0 ? (
                <tr><td colSpan={2} className="border border-slate-300 px-3 py-2 text-center italic text-slate-400">Tidak ada piutang belum lunas yang tercatat.</td></tr>
              ) : daftarPiutang.map((p, idx) => (
                <tr key={idx}>
                  <td className="border border-slate-300 px-3 py-1.5 break-words">{p.name}</td>
                  <td className="border border-slate-300 px-3 py-1.5 text-right break-words">{formatIDR(p.value)}</td>
                </tr>
              ))}
              <tr className="bg-slate-100">
                <td className="border border-slate-300 px-3 py-1.5 font-black uppercase text-[10px] tracking-widest">Total Piutang</td>
                <td className="border border-slate-300 px-3 py-1.5 font-black text-right">{formatIDR(totalPiutang)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* G. Ringkasan Harta Bersih */}
        <div className="mb-6" style={{ pageBreakInside: 'avoid' }}>
          <h2 className="text-xs font-black uppercase tracking-widest bg-slate-800 text-white px-3 py-1.5 mb-2">G. Ringkasan Harta Bersih</h2>
          <table className="w-full border-collapse border border-slate-300 table-fixed">
            <tbody>
              <tr>
                <td className="border border-slate-300 px-3 py-1.5 w-1/2 text-slate-500">Total Harta</td>
                <td className="border border-slate-300 px-3 py-1.5 font-bold">{formatIDR(totalHarta)}</td>
              </tr>
              <tr>
                <td className="border border-slate-300 px-3 py-1.5 text-slate-500">Ditambah: Total Piutang</td>
                <td className="border border-slate-300 px-3 py-1.5 font-bold">{formatIDR(totalPiutang)}</td>
              </tr>
              <tr>
                <td className="border border-slate-300 px-3 py-1.5 text-slate-500">Dikurangi: Total Utang</td>
                <td className="border border-slate-300 px-3 py-1.5 font-bold">({formatIDR(totalUtang)})</td>
              </tr>
              <tr className="bg-slate-100">
                <td className="border border-slate-300 px-3 py-1.5 font-black uppercase text-[10px] tracking-widest">Harta Bersih</td>
                <td className="border border-slate-300 px-3 py-1.5 font-black">{formatIDR(totalHarta + totalPiutang - totalUtang)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-300 flex items-center justify-between">
          <p className="text-[9px] text-slate-400 max-w-md">
            Dihasilkan otomatis oleh Leosiqra berdasarkan data yang Anda catat sendiri. Bukan dokumen resmi DJP/Coretax &mdash;
            lapor SPT resmi melalui <strong>coretaxdjp.pajak.go.id</strong>.
          </p>
          <div className="text-right">
            <p className="text-[9px] text-slate-400">Dicetak melalui</p>
            <p className="text-xs font-black">Leosiqra.com</p>
          </div>
        </div>
      </div>

      {/* 1. Dashboard View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-br from-white to-indigo-50/40 p-6 rounded-[24px] border border-slate-100 shadow-sm print:hidden">
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white items-center justify-center shadow-lg shadow-emerald-600/20 shrink-0">
            <Landmark size={22} />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-tight">Pajak Center</h2>
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
      {showDisclaimer && (
        <div className="flex items-start gap-4 p-5 rounded-[20px] bg-amber-50 border border-amber-100 print:hidden">
          <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[11px] md:text-xs text-amber-800 leading-relaxed font-medium flex-1">
            <strong>Daftar Harta, Utang, dan Piutang</strong> menampilkan <strong>posisi terkini (hari ini)</strong>, bukan posisi resmi per 31 Desember {selectedYear}
            {!isCurrentYear && <> — karena Anda melihat tahun pajak yang sudah lewat, angka ini <strong>kemungkinan tidak sama</strong> dengan kondisi akhir tahun {selectedYear}</>}.
            {' '}<strong>Penghasilan &amp; Pengeluaran</strong> di bawah sudah difilter khusus tahun {selectedYear}. Gunakan halaman ini sebagai draft pembanding, dan tetap verifikasi manual sebelum melapor resmi melalui{' '}
            <a href="https://coretaxdjp.pajak.go.id/" target="_blank" rel="noopener noreferrer" className="underline font-bold hover:text-amber-900">coretaxdjp.pajak.go.id</a>.
          </p>
          <button
            onClick={dismissDisclaimer}
            className="text-amber-400 hover:text-amber-700 transition-colors shrink-0"
            aria-label="Tutup"
          >
            <X size={16} />
          </button>
        </div>
      )}

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

      {/* 2b. Estimasi PPh Terutang (PTKP/PKP/Tarif Pasal 17) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 print:hidden">
        {/* Pengaturan PTKP */}
        <div className="lg:col-span-2 p-6 rounded-[32px] bg-white border border-slate-100 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Calculator size={16} />
            </div>
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Status PTKP</h4>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Pernikahan</p>
            <div className="flex gap-2">
              {(['TK', 'K'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => updateMaritalStatus(s)}
                  className={cn(
                    "flex-1 px-3 py-2 rounded-xl text-xs font-bold border transition-all",
                    maritalStatus === s
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                      : "bg-white border-slate-200 text-slate-500 hover:border-indigo-200"
                  )}
                >
                  {s === 'TK' ? 'Tidak Kawin' : 'Kawin'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Jumlah Tanggungan</p>
            <div className="flex gap-2">
              {[0, 1, 2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => updateDependents(n)}
                  className={cn(
                    "flex-1 px-3 py-2 rounded-xl text-xs font-bold border transition-all",
                    dependents === n
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                      : "bg-white border-slate-200 text-slate-500 hover:border-indigo-200"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">Kategori PTKP</span>
              <span className="font-black text-slate-900">{maritalStatus}/{dependents}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">PTKP Setahun</span>
              <span className="font-black text-slate-900">{formatIDRShort(ptkp)}</span>
            </div>
          </div>
        </div>

        {/* Estimasi PPh Terutang */}
        <div className="lg:col-span-3 p-6 rounded-[32px] bg-gradient-to-br from-slate-900 to-navy text-white shadow-xl shadow-slate-200/50 space-y-5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-slate-300 uppercase tracking-widest">Estimasi PPh Terutang (Pasal 17 UU HPP)</h4>
            {pphTerutang > 0 ? (
              <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 text-[9px] font-black uppercase tracking-widest border border-rose-500/30">
                Ada PPh Terutang
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-black uppercase tracking-widest border border-emerald-500/30">
                Tidak Ada PPh Terutang
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Penghasilan Neto</p>
              <p className="text-sm font-black tabular-nums">{formatIDRShort(netIncome)}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">PTKP</p>
              <p className="text-sm font-black tabular-nums">{formatIDRShort(ptkp)}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">PKP</p>
              <p className="text-sm font-black tabular-nums">{formatIDRShort(pkp)}</p>
            </div>
          </div>

          <div className="pt-3 border-t border-white/10">
            {pphBreakdown.length === 0 ? (
              <p className="text-xs text-slate-300 italic">
                Penghasilan Kena Pajak (PKP) Rp 0 atau di bawah PTKP — tidak ada PPh Pasal 21 tahunan yang terutang.
              </p>
            ) : (
              <div className="space-y-1.5">
                {pphBreakdown.map((b, i) => (
                  <div key={i} className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-300">
                      Lapisan {formatIDRShort(b.min)} &ndash; {b.max === Infinity ? 'ke atas' : formatIDRShort(b.max)} @ {(b.rate * 100).toFixed(0)}%
                    </span>
                    <span className="font-bold tabular-nums">{formatIDRShort(b.tax)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-white/10 flex justify-between items-center">
            <span className="text-xs font-black text-slate-300 uppercase tracking-widest">Total PPh Terutang</span>
            <span className={cn("text-2xl font-black tabular-nums", pphTerutang > 0 ? "text-rose-300" : "text-emerald-300")}>
              {formatIDRShort(animatedPphTerutang)}
            </span>
          </div>
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
                  <p className="text-lg font-black text-slate-900">
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
                  <p className="text-lg font-black text-rose-600">
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
                  <p className="text-lg font-black text-sky-600">
                    Rp {piutang.value.toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Total Harta Bersih */}
        <div className="p-8 rounded-[32px] bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black text-emerald-200 uppercase tracking-widest mb-1">Total Harta Bersih (Harta + Piutang − Utang)</p>
            <p className="text-3xl font-black tabular-nums">
              Rp {Math.round(animatedHartaBersih).toLocaleString()}
            </p>
          </div>
          <div className="flex gap-6 text-right">
            <div>
              <p className="text-[9px] font-bold text-emerald-200 uppercase tracking-widest">Harta</p>
              <p className="text-sm font-black tabular-nums">Rp {Math.round(animatedTotalHarta).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-emerald-200 uppercase tracking-widest">Piutang</p>
              <p className="text-sm font-black tabular-nums">Rp {Math.round(animatedTotalPiutang).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-emerald-200 uppercase tracking-widest">Utang</p>
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
          table {
            table-layout: fixed !important;
            width: 100% !important;
          }
          td, th {
            word-wrap: break-word;
            overflow-wrap: break-word;
          }
        }
      `}</style>
    </div>
  );
}

