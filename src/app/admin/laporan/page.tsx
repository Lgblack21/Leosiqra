"use client";

import { 
  CheckCircle2, 
  Clock, 
  ShieldCheck,
  Zap,
  LayoutDashboard,
  Activity,
  Calendar,
  Download,
  LineChart,
  PieChart,
  ChevronRight,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { 
  subscribeAdminLogs, 
  AdminLog 
} from '@/lib/services/adminService';

export default function AdminLaporanPage() {
  const [userEmail, setUserEmail] = useState('admin@leosiqra.com');
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserEmail(user.email || 'admin@leosiqra.com');
      }
    });

    const unsubLogs = subscribeAdminLogs(50, (data) => {
      setLogs(data);
      setLoading(false);
    });

    return () => {
      unsubAuth();
      unsubLogs();
    };
  }, []);

  const exportCSV = useCallback(() => {
    if (logs.length === 0) return;
    const header = ['Waktu', 'Admin', 'Aksi', 'Target', 'Catatan'];
    const rows = logs.map(l => [
      l.timestamp?.toDate ? l.timestamp.toDate().toLocaleString('id-ID') : '-',
      l.adminEmail,
      l.action,
      l.target,
      `"${l.note}"`
    ]);
    const csvContent = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `admin-log-${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [logs]);

  const exportJSON = useCallback(() => {
    if (logs.length === 0) return;
    const data = logs.map(l => ({
      waktu: l.timestamp?.toDate ? l.timestamp.toDate().toISOString() : null,
      admin: l.adminEmail,
      aksi: l.action,
      target: l.target,
      catatan: l.note
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `admin-log-${new Date().toISOString().slice(0,10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [logs]);

  const stats = {
    total: logs.length,
    admins: new Set(logs.map(l => l.adminEmail)),
    today: logs.filter(l => {
      const d = l.timestamp?.toDate ? l.timestamp.toDate() : null;
      return d && d.toDateString() === new Date().toDateString();
    }).length,
    thisWeek: logs.filter(l => {
      const d = l.timestamp?.toDate ? l.timestamp.toDate() : null;
      if (!d) return false;
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return d > weekAgo;
    }).length,
    topAction: logs.length > 0 ? (() => {
      const counts: any = {};
      logs.forEach(l => { counts[l.action] = (counts[l.action] || 0) + 1; });
      return Object.entries(counts).sort((a: any, b: any) => b[1] - a[1])[0][0];
    })() : '-'
  };

  return (
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
                Laporan Eksekutif
              </h1>
              <p className="text-slate-400 font-medium text-base lg:text-lg leading-relaxed max-w-2xl">
                Analisis performa bisnis, pantau tren pertumbuhan member, dan buat keputusan strategis berdasarkan data visual yang akurat.
              </p>
            </div>
            
            <div className="flex flex-wrap gap-3">
              {[
                { label: 'Dynamic visualization', icon: Activity },
                { label: 'Weekly growth audit', icon: LineChart },
                { label: 'Export-ready engine', icon: Download },
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
              { tag: 'ANALYTICS', title: 'Wawasan Bisnis', desc: 'Identifikasi pola pendapatan dan perilaku pengguna mendalam.', color: 'text-violet-500', bg: 'bg-violet-50/50' },
              { tag: 'GROWTH', title: 'Retensi Member', desc: 'Analisis tingkat loyalitas dan churn rate untuk kesehatan ekosistem.', color: 'text-indigo-500', bg: 'bg-indigo-50/50' },
              { tag: 'STRATEGY', title: 'Prediksi Revenue', desc: 'Estimasi pendapatan masa depan berdasarkan tren MRR Akun Pro.', color: 'text-emerald-500', bg: 'bg-emerald-50/50' },
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
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Report Console</p>
                <div className="relative group">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-violet-400 transition-colors" size={16} />
                  <input 
                    type="text" 
                    placeholder="Select date range..."
                    className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-[13px] font-medium placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:bg-white/10 transition-all italic"
                  />
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Operations access</p>
                   <div className="px-6 py-4 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-between">
                     <span className="text-[11px] font-black tracking-wide text-violet-300">
                       {userEmail.replace(/(.{1}).+@(.{1}).+/, "$1********@$2***.com")}
                     </span>
                     <div className="px-2 py-0.5 rounded-md bg-violet-500/20 text-[9px] font-black text-violet-400 border border-violet-500/30 uppercase tracking-widest">
                       PRO
                     </div>
                   </div>
                </div>

                <div className="p-8 rounded-[36px] bg-gradient-to-br from-violet-500 to-indigo-600 text-white space-y-4 shadow-xl shadow-violet-500/20">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-md">
                      <LayoutDashboard size={16} className="text-white" />
                    </div>
                    <h4 className="text-[11px] font-black uppercase tracking-[0.15em]">Analytics Ready</h4>
                  </div>
                  <p className="text-[11px] font-medium text-violet-50 leading-relaxed opacity-80">
                    Mesin analisis data siap mengolah laporan strategis Anda secara otomatis.
                  </p>
                </div>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
          </div>
        </div>
      </div>

      {/* SECTION: Audit Summary Cards */}
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Audit Timeline</p>
            <h3 className="text-3xl font-serif font-black text-slate-900 tracking-tight">Log Aktivitas Admin</h3>
            <p className="text-slate-400 font-medium text-xs max-w-md leading-relaxed">Riwayat tindakan penting untuk audit internal, verifikasi perubahan, dan keamanan akses.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportCSV}
              disabled={logs.length === 0}
              className={cn(
                "flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-xl text-[12px] font-bold text-slate-700 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-all",
                logs.length === 0 && "opacity-40 cursor-not-allowed"
              )}
            >
              <Download size={13} /> Ekspor CSV
            </button>
            <button
              onClick={exportJSON}
              disabled={logs.length === 0}
              className={cn(
                "flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-xl text-[12px] font-bold text-slate-700 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-all",
                logs.length === 0 && "opacity-40 cursor-not-allowed"
              )}
            >
              <Download size={13} /> Ekspor JSON
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'TOTAL LOG', val: stats.total },
            { label: 'ADMIN AKTIF', val: stats.admins.size },
            { label: 'HARI INI', val: stats.today },
            { label: 'MINGGU INI', val: stats.thisWeek },
          ].map((card) => (
            <div key={card.label} className="p-8 rounded-[36px] bg-white border border-slate-100 shadow-sm space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{card.label}</p>
              <h4 className="text-4xl font-serif font-black text-slate-900 leading-none">{card.val}</h4>
            </div>
          ))}
          <div className="col-span-2 p-8 rounded-[36px] bg-white border border-slate-100 shadow-sm space-y-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AKSI DOMINAN</p>
            <h4 className="text-4xl font-serif font-black text-slate-900 leading-none truncate">
              {stats.topAction || '-'}
            </h4>
          </div>
        </div>
      </div>

      {/* SECTION: Filters */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <select className="px-6 py-4 bg-white border border-slate-100 rounded-2xl text-[13px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all appearance-none cursor-pointer">
            <option>Semua aksi</option>
            <option>save_billing_settings</option>
            <option>activate_member_pro</option>
            <option>delete_user</option>
          </select>
          <input 
            type="text" 
            placeholder="dd/mm/yyyy"
            className="px-6 py-4 bg-white border border-slate-100 rounded-2xl text-[13px] font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all italic"
          />
        </div>
        <div className="relative group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={16} />
          <input 
            type="text" 
            placeholder="Cari admin / aksi / target / catatan"
            className="w-full pl-14 pr-6 py-4 bg-white border border-slate-100 rounded-2xl text-[13px] font-medium placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-sans italic"
          />
        </div>
      </div>

      {/* SECTION: Audit Table */}
      <div className="p-8 rounded-[48px] bg-white border border-slate-100 shadow-sm space-y-8 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-50">
                {['WAKTU', 'ADMIN', 'AKSI', 'TARGET', 'CATATAN'].map((head) => (
                  <th key={head} className="text-left py-6 px-4 text-[11px] font-black text-slate-900 tracking-widest uppercase">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-4 animate-pulse">
                      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Memuat audit logs...</p>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-slate-400 font-medium italic">
                    Belum ada aktivitas admin yang tercatat.
                  </td>
                </tr>
              ) : logs.map((row, idx) => (
                <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="py-8 px-4 text-[13px] font-medium text-slate-400 truncate max-w-[150px]">
                    {row.timestamp?.toDate ? row.timestamp.toDate().toLocaleString() : '-'}
                  </td>
                  <td className="py-8 px-4 text-[13px] font-medium text-slate-900 tracking-tight">{row.adminEmail}</td>
                  <td className="py-8 px-4">
                    <span className={cn(
                      "inline-flex px-5 py-2.5 rounded-full text-[10px] font-black tracking-widest uppercase border",
                      row.color === 'indigo' ? "bg-indigo-50 text-indigo-600 border-indigo-100" :
                      row.color === 'orange' ? "bg-orange-50 text-orange-600 border-orange-100" :
                      row.color === 'emerald' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                      row.color === 'rose' ? "bg-rose-50 text-rose-600 border-rose-100" : 
                      "bg-slate-50 text-slate-600 border-slate-100"
                    )}>
                      {row.action}
                    </span>
                  </td>
                  <td className="py-8 px-4">
                    <div className="space-y-0.5">
                      <p className="text-[13px] font-black text-slate-900 tracking-tight underline decoration-indigo-500/20 underline-offset-4 truncate max-w-[120px]">
                        {row.target}
                      </p>
                    </div>
                  </td>
                  <td className="py-8 px-4 text-[13px] font-medium text-slate-900 italic">
                    "{row.note}"
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
  );
}
