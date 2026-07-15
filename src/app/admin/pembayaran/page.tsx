"use client";

import Image from 'next/image';
import { Search, CheckCircle2, X, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminStatCard } from '@/components/admin/AdminStatCard';

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
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('Menunggu');
  const [proofModal, setProofModal] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const paymentsResponse = await cloudflareApi<{ items: PaymentRow[] }>('/api/admin/payments');
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
      <div className="space-y-8 pb-16 max-w-[1400px] mx-auto">
        <AdminPageHeader
          title="Verifikasi Pembayaran"
          description="Tinjau bukti transfer dan aktifkan akses Pro member."
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <AdminStatCard label="Total Tiket" value={stats.total} color="text-slate-600" bg="bg-slate-100" />
          <AdminStatCard label="Disetujui" value={stats.success} note={`Rp ${stats.revenueTotal.toLocaleString()}`} color="text-emerald-600" bg="bg-emerald-50" />
          <AdminStatCard label="Menunggu" value={stats.pending} note={`Rp ${stats.revenuePending.toLocaleString()}`} color="text-orange-600" bg="bg-orange-50" />
          <AdminStatCard label="Ditolak / Gagal" value={stats.failed} color="text-rose-600" bg="bg-rose-50" />
        </div>

        <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex overflow-x-auto no-scrollbar gap-2 p-1 bg-slate-50 rounded-xl">
              {[
                { label: 'Menunggu', count: stats.pending },
                { label: 'Disetujui', count: stats.success },
                { label: 'Ditolak/Gagal', count: stats.failed },
                { label: 'Semua', count: undefined },
              ].map((tab) => (
                <button
                  key={tab.label}
                  onClick={() => setActiveFilter(tab.label)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-[12px] font-black transition-all whitespace-nowrap flex items-center gap-2",
                    activeFilter === tab.label ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black",
                      activeFilter === tab.label ? "bg-orange-50 text-orange-600" : "bg-slate-100 text-slate-400"
                    )}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" size={15} />
              <input
                type="text"
                placeholder="Cari tiket / user / metode"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[13px] font-medium placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  {['TIKET', 'PELANGGAN', 'PAKET', 'METODE', 'REF', 'BUKTI', 'STATUS', 'AKSI'].map((head) => (
                    <th key={head} className="text-left py-3 px-3 text-[10px] font-black text-slate-400 tracking-widest uppercase">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Memuat antrian pembayaran...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-slate-400 font-medium italic">
                      Antrian pembayaran kosong.
                    </td>
                  </tr>
                ) : filteredPayments.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-3 text-[11px] font-medium text-slate-400">{row.id?.slice(-8).toUpperCase()}</td>
                    <td className="py-4 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="relative w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-[10px] font-black text-indigo-500 uppercase overflow-hidden shrink-0">
                          {row.user_photo_url ? (
                            <Image src={row.user_photo_url} alt={row.user_name || 'User'} fill className="object-cover" />
                          ) : (
                            <span>{row.user_name?.[0] || 'U'}</span>
                          )}
                        </div>
                        <div>
                          <p className="text-[13px] font-black text-slate-900">{row.user_name || 'Anonymous'}</p>
                          <p className="text-[11px] font-medium text-slate-400">{row.user_email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-3">
                      <p className="text-[12px] font-bold text-slate-700">{row.package_name || row.package_id || 'PRO'}</p>
                      <p className="text-[10px] font-medium text-slate-400">Rp {(row.amount || 0).toLocaleString()}</p>
                    </td>
                    <td className="py-4 px-3 text-[12px] font-bold text-slate-500 uppercase">{row.method || 'TRANSFER'}</td>
                    <td className="py-4 px-3 text-[12px] font-medium text-slate-500 truncate max-w-[100px]">{row.ref || '-'}</td>
                    <td className="py-4 px-3">
                      {row.proof_image_url ? (
                        <button
                          onClick={() => setProofModal(row.proof_image_url ?? null)}
                          className="group relative w-11 h-11 rounded-lg overflow-hidden border border-slate-200 hover:border-indigo-400 transition-all"
                        >
                          <Image src={row.proof_image_url} alt="Bukti" fill className="object-cover" />
                          <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/40 transition-all" />
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-300 italic">-</span>
                      )}
                    </td>
                    <td className="py-4 px-3">
                      <span className={cn(
                        "inline-flex px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest",
                        row.status === 'DISETUJUI' ? "bg-emerald-100 text-emerald-800" :
                        row.status === 'MENUNGGU' ? "bg-orange-100 text-orange-800" :
                        "bg-rose-100 text-rose-800"
                      )}>
                        {row.status}
                      </span>
                    </td>
                    <td className="py-4 px-3">
                      {row.status === 'MENUNGGU' ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApprovePayment(row)}
                            className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[11px] font-black hover:bg-emerald-600 transition-all"
                          >
                            Aktifkan
                          </button>
                          <button
                            onClick={() => handleRejectPayment(row)}
                            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-black text-slate-400 hover:border-slate-300 transition-all"
                          >
                            Tolak
                          </button>
                        </div>
                      ) : row.status === 'DISETUJUI' ? (
                        <div className="text-[10px] font-black text-emerald-500 uppercase flex items-center gap-1">
                          <CheckCircle2 size={12} /> Terverifikasi
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-300 uppercase">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
            <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-slate-100 flex items-center gap-2.5">
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
