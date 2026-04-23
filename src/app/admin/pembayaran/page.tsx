"use client";

import Image from 'next/image';
import { 
  Search, 
  CheckCircle2, 
  ShieldCheck,
  Zap,
  LayoutDashboard,
  Activity,
  ArrowUpRight,
  X,
  ImageIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { cloudflareApi } from '@/lib/cloudflare-api';

type PaymentRow = {
  id: string;
  user_id?: string;
  user_email?: string;
  user_name?: string;
  user_photo_url?: string | null;
  package_id?: string | null;
  package_name?: string | null;
  package_duration_months?: number | null;
  amount?: number;
  method?: string | null;
  ref?: string | null;
  proof_image_url?: string | null;
  status: 'MENUNGGU' | 'DISETUJUI' | 'DITOLAK' | 'GAGAL';
};

export default function AdminPembayaranPage() {
  const [userEmail, setUserEmail] = useState('admin@leosiqra.com');
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('Menunggu');
  const [proofModal, setProofModal] = useState<string | null>(null);
  
  useEffect(() => {
    (async () => {
      try {
        const [me, paymentsResponse] = await Promise.all([
          cloudflareApi<{ user?: { email?: string } | null }>('/api/auth/me'),
          cloudflareApi<{ items: PaymentRow[] }>('/api/admin/payments'),
        ]);
        setUserEmail(me.user?.email || 'admin@leosiqra.com');
        setPayments(paymentsResponse.items || []);
      } catch (error) {
        console.error(error);
        setPayments([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleApprovePayment = async (payment: PaymentRow) => {
    if (!confirm(`Aktifkan paket PRO untuk ${payment.user_name || payment.user_email}?`)) return;
    try {
      await cloudflareApi(`/api/admin/payments/${payment.id}`, {
        method: 'PATCH',
        json: {
          status: 'DISETUJUI',
        },
      });
      setPayments((current) =>
        current.map((item) => (item.id === payment.id ? { ...item, status: 'DISETUJUI' } : item))
      );
      alert('Pembayaran disetujui dan user telah diaktifkan!');
    } catch (error) {
      console.error(error);
      alert('Gagal memproses pembayaran.');
    }
  };

  const handleRejectPayment = async (payment: PaymentRow) => {
    if (!confirm('Tolak pembayaran?')) return;
    try {
      await cloudflareApi(`/api/admin/payments/${payment.id}`, {
        method: 'PATCH',
        json: {
          status: 'DITOLAK',
        },
      });
      setPayments((current) =>
        current.map((item) => (item.id === payment.id ? { ...item, status: 'DITOLAK' } : item))
      );
      alert('Pembayaran ditolak.');
    } catch (error) {
      console.error(error);
      alert('Gagal menolak pembayaran.');
    }
  };

  const filteredPayments = payments.filter(p => {
    const matchesSearch = 
      p.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id?.includes(searchQuery);
    
    if (activeFilter === 'Semua') return matchesSearch;
    if (activeFilter === 'Menunggu') return matchesSearch && p.status === 'MENUNGGU';
    if (activeFilter === 'Disetujui') return matchesSearch && p.status === 'DISETUJUI';
    if (activeFilter === 'Ditolak/Gagal') return matchesSearch && (p.status === 'DITOLAK' || p.status === 'GAGAL');
    return matchesSearch;
  });

  const stats = {
    total: payments.length,
    success: payments.filter(p => p.status === 'DISETUJUI').length,
    pending: payments.filter(p => p.status === 'MENUNGGU').length,
    failed: payments.filter(p => p.status === 'GAGAL' || p.status === 'DITOLAK').length,
    revenueTotal: payments.filter(p => p.status === 'DISETUJUI').reduce((acc, curr) => acc + (curr.amount || 0), 0),
    revenuePending: payments.filter(p => p.status === 'MENUNGGU').reduce((acc, curr) => acc + (curr.amount || 0), 0)
  };

  return (
    <>
      <div className="space-y-12 pb-20 max-w-[1600px] mx-auto">
      {/* HEADER SECTION */}
      <div className="flex flex-col xl:flex-row gap-12">
        <div className="flex-1 space-y-10">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-slate-900/10">
              <Zap size={10} className="text-indigo-400 fill-indigo-400" />
              Leosiqra Operations Console
            </div>
            <div className="space-y-4">
              <h1 className="text-5xl lg:text-6xl font-serif font-black text-slate-900 leading-[1.05] tracking-tight">
                Konfirmasi Pembayaran
              </h1>
              <p className="text-slate-400 font-medium text-base lg:text-lg leading-relaxed max-w-2xl">
                Verifikasi transaksi masuk, kelola bukti pembayaran, dan aktifkan akses premium member secara cepat.
              </p>
            </div>
            
            <div className="flex flex-wrap gap-3">
              {[
                { label: 'Real-time billing monitor', icon: Activity },
                { label: 'Verified transaction focused', icon: ArrowUpRight },
                { label: 'Secure payment protocol', icon: ShieldCheck },
              ].map((pill) => (
                <div key={pill.label} className="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-white border border-slate-100 text-slate-500 text-[11px] font-black uppercase tracking-wider shadow-sm hover:border-indigo-100 transition-colors">
                  <pill.icon size={14} className="text-indigo-500" />
                  {pill.label}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { tag: 'VERIFICATION', title: 'Verifikasi Instan', desc: 'Alur persetujuan satu-klik untuk aktivasi member cepat.', color: 'text-emerald-500', bg: 'bg-emerald-50/50' },
              { tag: 'REVENUE', title: 'Pelacakan Revenue', desc: 'Monitor aliran dana dari berbagai kanal pembayaran akurat.', color: 'text-blue-500', bg: 'bg-blue-50/50' },
              { tag: 'TICKETING', title: 'Manajemen Dispute', desc: 'Tangani keluhan pembayaran dengan sistem terintegrasi.', color: 'text-rose-500', bg: 'bg-rose-50/50' },
            ].map((card) => (
              <div key={card.tag} className="group p-8 rounded-[40px] bg-white border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] space-y-5 hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1 transition-all duration-500">
                <div className={cn("inline-flex px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase", card.bg, card.color)}>
                  {card.tag}
                </div>
                <div className="space-y-2">
                  <h3 className="font-serif font-black text-slate-900 text-xl leading-tight group-hover:text-indigo-600 transition-colors">{card.title}</h3>
                  <p className="text-slate-400 font-medium text-xs leading-relaxed">{card.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="w-full xl:w-[400px]">
          <div className="p-10 rounded-[48px] bg-slate-900 text-white shadow-2xl shadow-indigo-500/10 space-y-10 relative overflow-hidden">
            <div className="relative z-10 space-y-8">
              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Billing Console</p>
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={16} />
                  <input 
                    type="text" 
                    placeholder="Search Transaction ID..."
                    className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-[13px] font-medium placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:bg-white/10 transition-all italic"
                  />
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Operations access</p>
                   <div className="px-6 py-4 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-between">
                     <span className="text-[11px] font-black tracking-wide text-indigo-300">
                       {userEmail.replace(/(.{1}).+@(.{1}).+/, "$1********@$2***.com")}
                     </span>
                     <div className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-[9px] font-black text-indigo-400 border border-indigo-500/30 uppercase tracking-widest">
                       PRO
                     </div>
                   </div>
                </div>

                <div className="p-8 rounded-[36px] bg-gradient-to-br from-emerald-500 to-teal-600 text-white space-y-4 shadow-xl shadow-emerald-500/20">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-md">
                      <LayoutDashboard size={16} className="text-white" />
                    </div>
                    <h4 className="text-[11px] font-black uppercase tracking-[0.15em]">Billing Ready</h4>
                  </div>
                  <p className="text-[11px] font-medium text-emerald-50 leading-relaxed opacity-80">
                    Sistem pembayaran sedang aktif memantau transaksi masuk secara terus menerus.
                  </p>
                </div>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
          </div>
        </div>
      </div>

      {/* SECTION: Metrics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ticket Performance */}
        <div className="p-8 rounded-[40px] bg-white border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Ticket Performance</p>
              <h3 className="text-xl font-serif font-black text-slate-900 tracking-tight">Total Tiket Pembayaran</h3>
            </div>
            <p className="text-[12px] font-black text-slate-900 uppercase tracking-widest">Total Tiket: {stats.total}</p>
          </div>
          
          <div className="h-6 w-full rounded-full bg-slate-50 flex overflow-hidden border border-slate-100/50">
            <div className="w-1/2 bg-emerald-300" />
            <div className="w-1/2 bg-orange-100" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { label: `BERHASIL ${stats.total > 0 ? (stats.success/stats.total*100).toFixed(1) : 0}%`, val: `${stats.success} tiket`, color: 'bg-emerald-500' },
              { label: `MENUNGGU ${stats.total > 0 ? (stats.pending/stats.total*100).toFixed(1) : 0}%`, val: `${stats.pending} tiket`, color: 'bg-orange-400' },
              { label: `DITOLAK/GAGAL ${stats.total > 0 ? (stats.failed/stats.total*100).toFixed(1) : 0}%`, val: `${stats.failed} tiket`, color: 'bg-rose-500' },
            ].map((stat) => (
              <div key={stat.label} className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", stat.color)} />
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</span>
                </div>
                <p className="text-xl font-black text-slate-900 tracking-tight">{stat.val}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue Volume */}
        <div className="p-8 rounded-[40px] bg-white border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Revenue Volume</p>
              <h3 className="text-xl font-serif font-black text-slate-900 tracking-tight">Nominal Pembayaran</h3>
            </div>
            <p className="text-[12px] font-black text-slate-900 uppercase tracking-widest">Total: Rp {(stats.revenueTotal + stats.revenuePending).toLocaleString()}</p>
          </div>
          
          <div className="h-6 w-full rounded-full bg-slate-50 flex overflow-hidden border border-slate-100/50">
            <div className="w-[25%] bg-blue-500/80" />
            <div className="w-[75%] bg-orange-100" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { label: `BERHASIL ${stats.revenueTotal > 0 ? (stats.revenueTotal/(stats.revenueTotal+stats.revenuePending)*100).toFixed(1) : 0}%`, val: `Rp ${stats.revenueTotal.toLocaleString()}`, color: 'bg-blue-500' },
              { label: `MENUNGGU ${stats.revenuePending > 0 ? (stats.revenuePending/(stats.revenueTotal+stats.revenuePending)*100).toFixed(1) : 0}%`, val: `Rp ${stats.revenuePending.toLocaleString()}`, color: 'bg-orange-400' },
              { label: 'DITOLAK/GAGAL 0.0%', val: 'Rp 0', color: 'bg-rose-500' },
            ].map((stat) => (
              <div key={stat.label} className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", stat.color)} />
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</span>
                </div>
                <p className="text-xl font-black text-slate-900 tracking-tight">{stat.val}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION: Filter Tabs */}
      <div className="p-3 rounded-[32px] bg-slate-50/50 border border-slate-100 flex overflow-x-auto no-scrollbar gap-2 shadow-inner">
        {[
          { label: 'Menunggu', count: stats.pending, active: activeFilter === 'Menunggu' },
          { label: 'Disetujui', count: stats.success, active: activeFilter === 'Disetujui' },
          { label: 'Ditolak/Gagal', count: stats.failed, active: activeFilter === 'Ditolak/Gagal' },
          { label: 'Semua', active: activeFilter === 'Semua' },
        ].map((tab) => (
          <button 
            key={tab.label}
            onClick={() => setActiveFilter(tab.label)}
            className={cn(
              "flex-1 min-w-[140px] px-6 py-4 rounded-2xl text-[13px] font-black uppercase tracking-tight transition-all flex items-center justify-center gap-3",
              tab.active 
                ? "bg-white text-slate-900 shadow-md ring-1 ring-slate-100" 
                : "text-slate-400 hover:text-slate-600 hover:bg-white/50"
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black",
                tab.active ? "bg-orange-50 text-orange-600" : "bg-indigo-50 text-indigo-400"
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* SECTION: Approval Desk Table */}
      <div className="p-12 rounded-[56px] bg-white border border-slate-100 shadow-sm space-y-10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Approval Desk</p>
            <h3 className="text-3xl font-serif font-black text-slate-900 tracking-tight">Antrian Verifikasi Pembayaran</h3>
            <p className="text-slate-400 font-medium text-xs max-w-md leading-relaxed">Seluruh tiket pembayaran pelanggan yang menunggu tinjauan tim admin.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={16} />
              <input 
                type="text" 
                placeholder="Cari ticket / user / metode"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-[280px] pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[13px] font-medium placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all font-sans italic"
              />
            </div>
            <button className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-[12px] font-bold text-slate-700 hover:bg-slate-50 transition-colors">
              Ekspor CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-50">
                {['TIKET', 'PELANGGAN', 'PAKET', 'METODE', 'REF', 'BUKTI', 'STATUS', 'AKSI'].map((head) => (
                  <th key={head} className="text-left py-6 px-4 text-[11px] font-black text-slate-900 tracking-widest uppercase">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-4 animate-pulse">
                      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Memuat antrian pembayaran...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center text-slate-400 font-medium italic">
                    Antrian pembayaran kosong.
                  </td>
                </tr>
              ) : filteredPayments.map((row, idx) => (
                <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="py-6 px-4 text-[12px] font-medium text-slate-400 tracking-tight">{row.id?.slice(-8).toUpperCase()}</td>
                  <td className="py-6 px-4">
                    <div className="flex items-center gap-3">
                      <div className="relative w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-[10px] font-black text-indigo-500 border border-indigo-100 uppercase overflow-hidden">
                        {row.user_photo_url ? (
                          <Image src={row.user_photo_url} alt={row.user_name || 'User'} fill className="object-cover" />
                        ) : (
                          <span>{row.user_name?.[0] || 'U'}</span>
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[13px] font-black text-slate-900 tracking-tight">{row.user_name || 'Anonymous'}</p>
                        <p className="text-[11px] font-medium text-slate-400">{row.user_email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-6 px-4">
                    <div className="space-y-0.5">
                      <p className="text-[12px] font-bold text-slate-700 tracking-widest uppercase">{row.package_name || row.package_id || 'PRO'}</p>
                      <p className="text-[10px] font-medium text-slate-400">Rp {(row.amount || 0).toLocaleString()}</p>
                    </div>
                  </td>
                  <td className="py-6 px-4 text-[12px] font-bold text-slate-500 tracking-tight italic uppercase">{row.method || 'TRANSFER'}</td>
                  <td className="py-6 px-4 text-[12px] font-medium text-slate-500 tracking-tighter truncate max-w-[100px]">{row.ref || '-'}</td>
                  {/* KOLOM BUKTI */}
                  <td className="py-6 px-4">
                    {row.proof_image_url ? (
                      <button
                        onClick={() => setProofModal(row.proof_image_url ?? null)}
                        className="group relative w-14 h-14 rounded-xl overflow-hidden border-2 border-indigo-100 hover:border-indigo-400 transition-all"
                      >
                        <Image src={row.proof_image_url} alt="Bukti" fill className="object-cover" />
                        <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/40 transition-all flex items-center justify-center">
                          <p className="text-white text-[8px] font-black opacity-0 group-hover:opacity-100">LIHAT</p>
                        </div>
                      </button>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-300 italic">-</span>
                    )}
                  </td>
                  <td className="py-6 px-4">
                    <span className={cn(
                      "inline-flex px-3 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase",
                      row.status === 'DISETUJUI' ? "bg-emerald-100 text-emerald-800" :
                      row.status === 'MENUNGGU' ? "bg-orange-100 text-orange-800" :
                      "bg-rose-100 text-rose-800"
                    )}>
                      {row.status}
                    </span>
                  </td>
                  <td className="py-6 px-4">
                    <div className="flex flex-col gap-2 w-fit">
                      {row.status === 'MENUNGGU' && (
                        <>
                          <button 
                            onClick={() => handleApprovePayment(row)}
                            className="px-10 py-2 bg-slate-900 text-white border border-slate-900 rounded-xl text-[11px] font-black hover:bg-emerald-600 hover:border-emerald-600 transition-all shadow-sm"
                          >
                            Aktifkan Pro
                          </button>
                          <button 
                            onClick={() => handleRejectPayment(row)}
                            className="px-10 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-black text-slate-400 hover:border-slate-300 transition-all shadow-sm"
                          >
                            Tolak
                          </button>
                        </>
                      )}
                      {row.status === 'DISETUJUI' && (
                        <div className="text-[10px] font-black text-emerald-500 uppercase flex items-center gap-1">
                          <CheckCircle2 size={12} /> Terverifikasi
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div className="flex items-center justify-end gap-6 pt-4">
           <button className="text-[12px] font-bold text-slate-400 hover:text-slate-900 transition-colors px-4 py-2 bg-slate-50 rounded-xl">
             Sebelumnya
           </button>
           <span className="text-[12px] font-bold text-slate-900">
             Halaman 1 / 1
           </span>
           <button className="text-[12px] font-bold text-slate-400 hover:text-slate-900 transition-colors px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
             Berikutnya
           </button>
        </div>
      </div>
    </div>

      {/* PROOF IMAGE MODAL */}
      {proofModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200"
          onClick={() => setProofModal(null)}
        >
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setProofModal(null)}
              className="absolute -top-12 right-0 p-2 bg-white/20 hover:bg-white/40 rounded-full text-white transition-all"
            >
              <X size={20} />
            </button>
            <div className="bg-white rounded-[32px] overflow-hidden shadow-2xl">
              <div className="p-5 border-b border-slate-100 flex items-center gap-3">
                <ImageIcon size={16} className="text-indigo-500" />
                <h4 className="text-[13px] font-black text-slate-900 uppercase tracking-widest">Bukti Pembayaran</h4>
              </div>
              <Image
                src={proofModal}
                alt="Bukti Pembayaran"
                width={1400}
                height={900}
                className="w-full max-h-[70vh] h-auto object-contain bg-slate-50"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
