"use client";

import { 
  TrendingUp, 
  Building2, 
  Globe, 
  Wallet, 
  ShieldAlert, 
  ArrowLeftRight,
  ChevronRight,
  Monitor
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useModal } from '@/context/ModalContext';

export default function InputTransactionPage() {
  const { openModal } = useModal();

  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-700 max-w-[1400px] pb-12">
      
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
            Input Transaksi <span className="text-blue-600 italic">Harian</span>
          </h1>
          <p className="text-[12px] md:text-sm font-medium text-slate-400 mt-2 max-w-xl leading-relaxed">
            Manajemen aset cerdas dimulai dengan pencatatan yang presisi. Pilih kategori input di bawah untuk memperbarui narasi finansial Anda hari ini.
          </p>
        </div>
      </div>

      {/* 2. Pilih Jenis Input Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Pilih Jenis Input</span>
          <div className="h-[1px] w-48 bg-slate-100" />
          <div className="ml-auto w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
            <Monitor size={14} />
          </div>
        </div>

        {/* TOP CARDS GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Card: Transaksi Harian (2/3) */}
          <div 
            onClick={() => openModal('harian')}
            className="lg:col-span-2 bg-white rounded-[32px] p-6 md:p-8 border border-slate-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden flex flex-col justify-between h-[200px] md:h-[240px] cursor-pointer"
          >
            <div className="flex justify-between items-start">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100 group-hover:scale-110 transition-transform">
                <Monitor size={24} />
              </div>
              <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-50/50 px-3 py-1 rounded-full">Most Used</span>
            </div>
            
            <div className="max-w-md">
              <h3 className="text-lg md:text-xl font-black text-slate-900 mb-2">Transaksi Harian</h3>
              <p className="text-xs font-medium text-slate-400 leading-relaxed">
                Catat pengeluaran rutin, belanja, dan biaya operasional harian dengan kategorisasi otomatis.
              </p>
            </div>

            {/* Decorative background shape */}
            <div className="absolute right-[-20px] bottom-[-20px] opacity-[0.03] text-indigo-600 group-hover:scale-110 transition-transform duration-700">
              <Monitor size={180} />
            </div>
          </div>

          {/* Side Card: Investasi Saham (1/3) */}
          <div 
            onClick={() => openModal('saham')}
            className="bg-white rounded-[32px] p-6 md:p-8 border border-slate-100 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between h-[200px] md:h-[240px] cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 shadow-sm border border-purple-100 group-hover:scale-110 transition-transform">
              <TrendingUp size={24} />
            </div>
            
            <div>
              <h3 className="text-lg md:text-xl font-black text-slate-900 mb-2">Investasi Saham</h3>
              <p className="text-xs font-medium text-slate-400 leading-relaxed">
                Update portofolio saham, dividen, dan capital gain terbaru.
              </p>
              <button className="mt-4 flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-widest hover:translate-x-1 transition-transform">
                Update Portfolio <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* MIDDLE CARDS GRID (3-cols) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Deposito */}
          <div 
            onClick={() => openModal('deposito')}
            className="bg-white rounded-[24px] p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 mb-6 group-hover:bg-slate-900 group-hover:text-white transition-colors">
              <Building2 size={20} />
            </div>
            <h3 className="text-[15px] font-bold text-slate-900 mb-2">Deposito</h3>
            <p className="text-[11px] font-medium text-slate-400 leading-relaxed">
              Kelola penempatan dana berjangka dan monitor bunga jatuh tempo.
            </p>
          </div>

          {/* Investasi Lainnya */}
          <div 
            onClick={() => openModal('investasi_lain')}
            className="bg-white rounded-[24px] p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 mb-6 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
              <Globe size={20} />
            </div>
            <h3 className="text-[15px] font-bold text-slate-900 mb-2">Investasi Lainnya</h3>
            <p className="text-[11px] font-medium text-slate-400 leading-relaxed">
              Emas, Crypto, atau Properti dalam satu dasbor terpadu.
            </p>
          </div>

          {/* Tabungan */}
          <div 
            onClick={() => openModal('tabungan')}
            className="bg-white rounded-[24px] p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Wallet size={20} />
            </div>
            <h3 className="text-[15px] font-bold text-slate-900 mb-2">Tabungan</h3>
            <p className="text-[11px] font-medium text-slate-400 leading-relaxed">
              Pantau pertumbuhan dana darurat dan tabungan rencana.
            </p>
          </div>
        </div>

        {/* BOTTOM CARDS ROW (2-cols) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
          {/* Hutang & Piutang */}
          <div 
            onClick={() => openModal('hutang_piutang')}
            className="bg-white rounded-[24px] p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all flex items-center gap-6 group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-colors">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-slate-900 mb-1">Hutang & Piutang</h3>
              <p className="text-[11px] font-medium text-slate-400">Lacak kewajiban dan tagihan yang belum tertagih.</p>
            </div>
          </div>

          {/* Top Up & Transfer */}
          <div 
            onClick={() => openModal('topup_transfer')}
            className="bg-white rounded-[24px] p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all flex items-center gap-6 group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <ArrowLeftRight size={20} />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-slate-900 mb-1">Top Up & Transfer</h3>
              <p className="text-[11px] font-medium text-slate-400">Pindahkan dana antar rekening atau isi saldo e-wallet.</p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Summary Today & Insights Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-6">
        {/* Left: Stats List */}
        <div className="space-y-6">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Summary Today</p>
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-50">
                <span className="text-xs font-bold text-slate-500">Active Entries</span>
                <span className="text-xs font-black text-slate-900">12 items</span>
              </div>
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-50">
                <span className="text-xs font-bold text-slate-500">Total Volume</span>
                <span className="text-xs font-black text-blue-600 tracking-tight">Rp 4.250.000</span>
              </div>
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-50">
                <span className="text-xs font-bold text-slate-500">System Status</span>
                <span className="flex items-center gap-2 text-xs font-black text-emerald-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Synced
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Insights Banner (Wide) */}
        <div className="lg:col-span-2 relative h-[180px] md:h-[220px] rounded-[32px] overflow-hidden bg-[#0a192f] group cursor-pointer border border-white/10 shadow-2xl">
          {/* Mock Candlestick Chart Background overlay */}
          <div className="absolute inset-0 opacity-20 flex items-end justify-between px-8 gap-1.5 pointer-events-none">
            {[40, 80, 50, 90, 100, 60, 40, 70, 80, 50, 30, 90, 60, 40, 70].map((h, i) => (
              <div key={i} className="flex flex-col items-center gap-1 w-full h-full justify-end">
                <div className="w-[1px] h-full bg-white/20" />
                <div 
                  className={cn(
                    "w-full max-w-[8px] rounded-sm",
                    i % 3 === 0 ? "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]" : "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                  )} 
                  style={{ height: `${h}%` }}
                />
                <div className="w-[1px] h-full bg-white/20" />
              </div>
            ))}
          </div>

          <div className="relative z-10 w-full h-full p-6 md:p-10 flex flex-col justify-center">
            <h3 className="text-xl md:text-2xl font-black text-white mb-3">Automated Insights</h3>
            <p className="text-xs font-medium text-slate-400 max-w-sm leading-relaxed">
              Sistem kami mencatat pola pengeluaran yang lebih efisien di kategori &quot;Transaksi Harian&quot; Anda.
            </p>
          </div>

          <div className="absolute right-[-40px] top-[-40px] w-64 h-64 bg-blue-500/10 blur-[100px] pointer-events-none" />
        </div>
      </div>

    </div>
  );
}
