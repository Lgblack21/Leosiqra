"use client";

import Image from 'next/image';
import { 
  Search, 
  Clock, 
  Users, 
  TrendingUp, 
  Activity,
  ArrowUpRight,
  ChevronRight,
  Layers,
  Zap,
  LayoutDashboard
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { cloudflareApi } from '@/lib/cloudflare-api';

type AdminLog = {
  id: string;
  admin_email: string;
  action: string;
  target: string;
  note?: string;
  color?: 'indigo' | 'orange' | 'emerald' | 'rose' | 'slate';
  created_at: string;
};

type AdminUser = {
  id?: string;
  name?: string;
  email?: string;
  photoURL?: string | null;
  photo_url?: string | null;
  role?: string;
  status?: string;
  plan?: string;
  createdAt?: string;
  created_at?: string;
};

type AdminPayment = {
  status?: string;
  amount?: number;
  approvedAt?: string;
};

export default function AdminDashboard() {
  const [userEmail, setUserEmail] = useState('admin@leosiqra.com');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    let active = true;
    Promise.all([
      cloudflareApi<{ user?: { email?: string } | null }>('/api/auth/me'),
      cloudflareApi<{ items: AdminUser[] }>('/api/admin/users'),
      cloudflareApi<{ items: AdminPayment[] }>('/api/admin/payments'),
      cloudflareApi<{ items: AdminLog[] }>('/api/admin/logs?limit=10'),
    ])
      .then(([me, usersRes, paymentsRes, logsRes]) => {
        if (!active) return;
        setUserEmail(me.user?.email || 'admin@leosiqra.com');
        setUsers(usersRes.items ?? []);
        setPayments(paymentsRes.items ?? []);
        setLogs(logsRes.items ?? []);
      })
      .catch((err) => {
        console.error('Gagal memuat dashboard admin:', err);
        if (!active) return;
        setUsers([]);
        setPayments([]);
        setLogs([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const userList = users.filter(u => u.role === 'user' && u.status !== 'GUEST');

  const stats = {
    totalRevenue: payments.filter(p => p.status === 'DISETUJUI').reduce((acc, curr) => acc + (curr.amount || 0), 0),
    pendingRevenue: payments.filter(p => p.status === 'MENUNGGU').reduce((acc, curr) => acc + (curr.amount || 0), 0),
    totalUsers: userList.length,
    activePro: userList.filter(u => u.plan === 'PRO' && u.status === 'AKTIF').length,
    pendingTickets: payments.filter(p => p.status === 'MENUNGGU').length,
    revenueThisMonth: payments.filter(p => {
      if (p.status !== 'DISETUJUI') return false;
      const approvedAt = p.approvedAt ? new Date(p.approvedAt) : null;
      return approvedAt && approvedAt.getMonth() === new Date().getMonth() && approvedAt.getFullYear() === new Date().getFullYear();
    }).reduce((acc, curr) => acc + (curr.amount || 0), 0),
    // Additional for signals
    conversionRate: userList.length > 0 ? (userList.filter(u => u.plan === 'PRO').length / userList.length * 100).toFixed(1) : '0',
    newUsersToday: userList.filter(u => {
      const createdTime = u.createdAt || u.created_at;
      const d = createdTime ? new Date(createdTime) : null;
      return d && d.toDateString() === new Date().toDateString();
    }).length,
    weeklyChartData: (() => {
      const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
      const data = [];
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const dayName = days[d.getDay()];
        const dailyRevenue = payments.filter(p => {
          if (p.status !== 'DISETUJUI') return false;
          const ad = p.approvedAt ? new Date(p.approvedAt) : null;
          return ad && ad.toDateString() === d.toDateString();
        }).reduce((acc, curr) => acc + (curr.amount || 0), 0);
        data.push({ day: dayName, val: dailyRevenue, date: d.toDateString() });
      }
      return data;
    })()
  };

  const latestUsers = userList.slice(0, 3);

  return (
    <div className="space-y-12 pb-20 max-w-[1600px] mx-auto">
      {/* --- SECTION 1: CONSOLE HEADER --- */}
      <div className="flex flex-col xl:flex-row gap-12">
        <div className="flex-1 space-y-10">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-slate-900/10">
              <Zap size={10} className="text-indigo-400 fill-indigo-400" />
              Leosiqra Operations Console
            </div>
            <div className="space-y-4">
              <h1 className="text-5xl lg:text-6xl font-serif font-black text-slate-900 leading-[1.05] tracking-tight">
                Dashboard Operasional
              </h1>
              <p className="text-slate-400 font-medium text-base lg:text-lg leading-relaxed max-w-2xl">
                Pantau pendapatan, antrian verifikasi, dan kualitas pengalaman member dalam satu workspace yang terasa premium, fokus, dan mudah dibaca.
              </p>
            </div>
            
            <div className="flex flex-wrap gap-3">
              {[
                { label: 'Live sync active', icon: Clock },
                { label: 'Member-first core', icon: Users },
                { label: 'Revenue system', icon: TrendingUp },
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
              { tag: 'EXPERIENCE', title: 'Premium member flow', desc: 'Tampilan diprioritaskan tetap tenang agar admin cepat mengambil aksi.', color: 'text-blue-500', bg: 'bg-blue-50/50' },
              { tag: 'VERIFICATION', title: 'Antrian lebih jelas', desc: 'Sinyal penting diposisikan di atas supaya approval terasa responsif.', color: 'text-indigo-500', bg: 'bg-indigo-50/50' },
              { tag: 'RETENTION', title: 'Fokus pada member value', desc: 'Prioritas akun disusun agar tim mudah menjaga loyalitas pelanggan.', color: 'text-violet-500', bg: 'bg-violet-50/50' },
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

        <div className="w-full xl:w-[400px]">
          <div className="p-10 rounded-[48px] bg-slate-900 text-white shadow-2xl shadow-indigo-500/10 space-y-10 relative overflow-hidden">
            <div className="relative z-10 space-y-8">
              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Quick Command</p>
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={16} />
                  <input 
                    type="text" 
                    placeholder="Search global console..."
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

                <div className="p-8 rounded-[36px] bg-gradient-to-br from-indigo-500 to-violet-600 text-white space-y-4 shadow-xl shadow-indigo-500/20">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-md">
                      <LayoutDashboard size={16} className="text-white" />
                    </div>
                    <h4 className="text-[11px] font-black uppercase tracking-[0.15em]">System Ready</h4>
                  </div>
                  <p className="text-[11px] font-medium text-indigo-50 leading-relaxed opacity-80">
                    Console dirancang untuk sesi monitoring panjang tanpa degradasi fokus visual.
                  </p>
                </div>
              </div>
            </div>
            {/* Ambient Background Elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 animate-pulse" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-violet-500/10 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2" />
          </div>
        </div>
      </div>

      {/* --- SECTION 2: CORE METRICS & REVENUE --- */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Pendapatan', value: `Rp ${stats.totalRevenue.toLocaleString()}`, note: 'Akumulasi global', progress: 'w-full', icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50' },
          { label: 'Bulan Ini', value: `Rp ${stats.revenueThisMonth.toLocaleString()}`, note: 'Periode berjalan', progress: 'w-1/3', icon: Activity, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Menunggu', value: `Rp ${stats.pendingRevenue.toLocaleString()}`, note: `${stats.pendingTickets} tiket pending`, progress: 'w-1/2', icon: Clock, color: 'text-orange-500', bg: 'bg-orange-50' },
          { label: 'MRR Aktif', value: `Rp ${(stats.activePro * 30000).toLocaleString()}`, note: `${stats.activePro} member pro`, progress: 'w-2/3', icon: Zap, color: 'text-indigo-500', bg: 'bg-indigo-50' },
        ].map((metric) => (
          <div key={metric.label} className="p-8 rounded-[40px] bg-white border border-slate-100 shadow-sm space-y-6 hover:border-indigo-100 transition-all group">
            <div className="flex items-center justify-between">
              <div className={cn("p-3 rounded-2xl", metric.bg, metric.color)}>
                <metric.icon size={20} />
              </div>
              <ArrowUpRight size={18} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
            </div>
            <div className="space-y-1">
              <h2 className="text-4xl font-serif font-black text-slate-900 leading-none tracking-tight">{metric.value}</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.1em]">{metric.label}</p>
            </div>
            <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
              <div className={cn("h-full bg-slate-200 rounded-full transition-all duration-1000", metric.progress)} />
            </div>
          </div>
        ))}
      </div>

      {/* --- SECTION 3: REVENUE LENS & ACTION DECK --- */}
      <div className="flex flex-col xl:flex-row gap-8">
        <div className="flex-1 p-10 rounded-[48px] bg-white border border-slate-100 shadow-sm space-y-10">
          <div className="flex items-end justify-between">
            <div className="space-y-2">
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Revenue Lens</p>
              <h3 className="text-3xl font-serif font-black text-slate-900 tracking-tight">Kinerja Operasional</h3>
            </div>
            <button className="text-[11px] font-black text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest flex items-center gap-1">
              View Analytics <ChevronRight size={12} />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {[
              { label: 'BERHASIL', value: payments.filter(p => p.status === 'DISETUJUI').length, sub: 'pembayaran' },
              { label: 'ANTRIAN', value: stats.pendingTickets, sub: 'tiket pending' },
              { label: 'MEMBERS', value: userList.length, sub: 'akun aktif' },
              { label: 'STRATEGI', value: stats.activePro, sub: 'akun pro' },
            ].map((m) => (
              <div key={m.label} className="space-y-1 p-6 rounded-[32px] bg-slate-50/50 hover:bg-indigo-50/30 transition-colors border border-transparent hover:border-indigo-100/50 min-w-0">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">{m.label}</p>
                <div className="flex items-baseline gap-1 overflow-hidden">
                  <h4 className="text-2xl md:text-3xl font-black text-slate-900 leading-none">{m.value}</h4>
                  <span className="text-[9px] text-slate-400 font-medium truncate">{m.sub}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-6">
            <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] border-b border-slate-50 pb-4">Revenue Radar</h4>
            <div className="p-8 rounded-[36px] bg-slate-50/50 border border-slate-100 flex flex-col md:flex-row md:items-center justify-between group hover:bg-white hover:shadow-lg transition-all gap-4">
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                  <Layers size={20} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-black text-slate-900 tracking-tight">Status Verifikasi Sistem</p>
                  <p className="text-[11px] text-slate-400 font-medium italic">
                    {stats.pendingTickets > 0 
                      ? `${stats.pendingTickets} tiket baru butuh tindakan.` 
                      : 'Seluruh pembayaran berhasil diverifikasi.'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-serif font-black text-indigo-600 tracking-tight">Rp {stats.totalRevenue.toLocaleString()}</p>
                <p className="text-[10px] text-emerald-500 font-black tracking-widest uppercase">Live Gross Revenue</p>
              </div>
            </div>
            
            <div className="p-8 rounded-[36px] bg-orange-50/30 border border-orange-100/50 flex items-center gap-6">
              <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-orange-500">
                <Clock size={20} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-black text-slate-900 tracking-tight">Kesehatan Pemasukan</p>
                <p className="text-[11px] text-orange-600 font-medium">
                  {stats.pendingRevenue > 0 
                    ? `Ada Rp ${stats.pendingRevenue.toLocaleString()} volume yang belum cair.` 
                    : 'Likuiditas pemasukan stabil.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full xl:w-[400px]">
          <div className="p-10 rounded-[48px] bg-white border border-slate-100 shadow-sm space-y-10">
            <div className="space-y-2">
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Action Deck</p>
              <h3 className="text-3xl font-serif font-black text-slate-900 tracking-tight">Akses Cepat</h3>
            </div>

            <div className="space-y-3">
              {[
                { label: 'Verifikasi Pembayaran', note: `${stats.pendingTickets} tiket menunggu`, bg: 'bg-orange-50/50', border: 'border-orange-100/50', color: 'text-orange-600' },
                { label: 'Kelola Pelanggan', note: `${stats.totalUsers} akun terdaftar`, bg: 'bg-white', border: 'border-slate-100', color: 'text-slate-400' },
                { label: 'Buka Laporan', note: 'Executive audit', bg: 'bg-emerald-50/50', border: 'border-emerald-100/50', color: 'text-emerald-600' },
                { label: 'Atur Billing', note: 'System configuration', bg: 'bg-white', border: 'border-slate-100', color: 'text-slate-400' },
              ].map((action) => (
                <button 
                  key={action.label}
                  className={cn(
                    "w-full px-8 py-7 rounded-[32px] border text-left transition-all hover:shadow-xl hover:shadow-slate-100 group flex items-center justify-between",
                    action.bg,
                    action.border
                  )}
                >
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{action.label}</h4>
                    <p className={cn("text-[11px] font-medium", action.color)}>{action.note}</p>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-600 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* --- SECTION 4: SIGNALS & WEEKLY MOTION --- */}
      <div className="flex flex-col xl:flex-row gap-8">
        <div className="flex-1 space-y-8">
          <div className="p-10 rounded-[48px] bg-white border border-slate-100 shadow-sm space-y-10">
            <div className="space-y-2">
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Priority Signals</p>
              <h3 className="text-2xl font-serif font-black text-slate-900 tracking-tight">Fokus Strategis</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Tekanan Verifikasi', value: `${stats.pendingTickets} tiket`, note: `Rp ${stats.pendingRevenue.toLocaleString()} antrian`, bg: 'bg-rose-50/40', text: 'text-rose-600' },
                { label: 'Konversi Global', value: `${stats.conversionRate}%`, note: 'Member vs Pro', bg: 'bg-indigo-50/40', text: 'text-indigo-600' },
                { label: 'User Baru Hari Ini', value: `${stats.newUsersToday}`, note: 'Momentum pertumbuhan', bg: 'bg-amber-50/40', text: 'text-amber-600' },
              ].map((s) => (
                <div key={s.label} className={cn("p-8 rounded-[36px] space-y-4 shadow-[0_2px_10px_rgba(0,0,0,0.01)] transition-transform hover:scale-[1.03]", s.bg)}>
                  <p className="text-[9px] font-black opacity-50 uppercase tracking-[0.2em]">{s.label}</p>
                  <div className="space-y-1">
                    <h4 className={cn("text-3xl font-black leading-none", s.text)}>{s.value}</h4>
                    <p className={cn("text-[10px] font-bold opacity-70", s.text)}>{s.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-10 rounded-[48px] bg-white border border-slate-100 shadow-sm space-y-10">
            <div className="flex items-end justify-between">
              <div className="space-y-2">
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Weekly Motion</p>
                <h3 className="text-2xl font-serif font-black text-slate-900 tracking-tight">Tren Mingguan</h3>
              </div>
              <div className="flex items-center gap-6 px-6 py-3 rounded-2xl bg-slate-50/80 border border-slate-100">
                <div className="space-y-0.5">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Tiket Masuk</p>
                  <p className="text-base font-black text-slate-900">1</p>
                </div>
                <div className="h-6 w-px bg-slate-200" />
                <div className="space-y-0.5">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Revenue</p>
                  <p className="text-base font-black text-slate-900">Rp 0</p>
                </div>
              </div>
            </div>

            <div className="flex items-end justify-between px-4 pt-10 h-56 gap-2">
              {stats.weeklyChartData.map((bar) => (
                <div key={bar.date} className="flex flex-col items-center gap-6 flex-1">
                  <div className="w-6 sm:w-8 h-40 bg-slate-50/50 rounded-2xl relative overflow-hidden group">
                    <div 
                      className={cn(
                        "absolute bottom-0 left-0 w-full transition-all duration-1000 rounded-2xl",
                        bar.val > 0 ? "bg-indigo-500 shadow-lg shadow-indigo-500/20" : "h-0 bg-slate-100"
                      )} 
                      style={{ height: bar.val > 0 ? `${Math.min((bar.val / 100000) * 100, 100)}%` : '0%' }}
                    />
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-100/10 cursor-help" title={`Rp ${bar.val.toLocaleString()}`} />
                  </div>
                  <div className="text-center space-y-1">
                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-tighter opacity-70">{bar.day}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="w-full xl:w-[400px]">
          <div className="p-10 rounded-[48px] bg-white border border-slate-100 shadow-sm space-y-10">
            <div className="space-y-2">
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Member Signals</p>
              <h3 className="text-2xl font-serif font-black text-slate-900 tracking-tight">Antrian Prioritas</h3>
            </div>

            <div className="space-y-4">
            {latestUsers.length === 0 ? (
                <p className="text-[12px] text-slate-400 italic text-center py-10">Belum ada member terdaftar.</p>
              ) : latestUsers.map((member, i) => (
                <div key={i} className="flex items-center gap-5 p-6 rounded-[32px] border border-slate-50 hover:bg-slate-50 hover:border-slate-100 transition-all group">
                  <div className="flex -space-x-3">
                    {(member.photoURL || member.photo_url) ? (
                      <div className="relative w-12 h-12 rounded-2xl overflow-hidden border-4 border-white shadow-sm ring-1 ring-slate-100 bg-slate-100">
                        <Image src={member.photoURL || member.photo_url || ''} alt={member.name || member.email || 'User'} fill className="object-cover" />
                      </div>
                    ) : (
                      <>
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center text-[13px] font-black border-4 border-white shadow-sm ring-1 ring-slate-100 text-white",
                          member.plan === 'PRO' ? "bg-indigo-600" : "bg-slate-800"
                        )}>
                          {member.name?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-[11px] font-black border-4 border-white shadow-sm ring-1 ring-slate-100 text-slate-400 bg-slate-50">
                          {(member.name?.split(' ')[1]?.[0] || member.email?.[1])?.toUpperCase()}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-black text-slate-900 truncate tracking-tight">{member.name || 'User Anonymous'}</span>
                    <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-[0.15em]">{member.plan || 'BASIC'} / {member.status || 'AKTIF'}</span>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-indigo-600 transition-colors" />
                </div>
              ))}
            </div>
            
            <button className="w-full py-5 rounded-3xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all shadow-xl shadow-slate-900/10">
              Lihat Semua Member
            </button>
          </div>
        </div>
      </div>

      {/* --- SECTION 5: ACTIVITY FEED --- */}
      <div className="p-12 rounded-[56px] bg-white border border-slate-100 shadow-sm space-y-12">
        <div className="flex items-end justify-between">
          <div className="space-y-2">
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Activity Feed</p>
            <h3 className="text-3xl font-serif font-black text-slate-900 tracking-tight">Aktivitas Dinamis</h3>
            <p className="text-slate-400 font-medium text-xs">Pencatatan aktivitas sistem dan interaksi member secara real-time.</p>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest border border-slate-100 px-4 py-2 rounded-xl">
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
             Live Monitoring
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loading ? (
            <div className="col-span-2 py-20 text-center animate-pulse">
               <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Sinkronisasi aktivitas...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="col-span-2 py-20 text-center text-slate-400 font-medium italic">
               Belum ada aktivitas tercatat.
            </div>
          ) : logs.map((log, i) => (
            <div key={i} className="flex items-center gap-6 p-7 rounded-[36px] border border-slate-50 hover:bg-slate-50/50 hover:border-slate-100 transition-all group">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border transition-all group-hover:scale-110 shadow-sm",
                log.color === 'indigo' ? "bg-indigo-50 border-indigo-100 text-indigo-600" : 
                log.color === 'orange' ? "bg-orange-50 border-orange-100 text-orange-600" : 
                log.color === 'emerald' ? "bg-emerald-50 border-emerald-100 text-emerald-600" :
                "bg-rose-50 border-rose-100 text-rose-600"
              )}>
                <div className="w-2.5 h-2.5 rounded-sm bg-current rotate-45" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                   <h4 className="text-[13px] font-black text-slate-900 tracking-tight">{log.action}</h4>
                   <span className="text-[10px] font-bold text-slate-300 group-hover:text-slate-400 transition-colors">
                     {log.created_at ? new Date(log.created_at).toLocaleTimeString() : 'Recent'}
                   </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-black text-indigo-400/80 uppercase tracking-widest">AUDIT</span>
                  <div className="w-1 h-1 rounded-full bg-slate-200" />
                  <span className="text-[11px] font-medium text-slate-400 truncate max-w-[150px]">
                    {log.admin_email}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
