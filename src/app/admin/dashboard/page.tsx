"use client";

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Search,
  Clock,
  TrendingUp,
  Activity,
  ChevronRight,
  Zap,
  CreditCard,
  Users,
  FileText,
  Settings as SettingsIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminStatCard } from '@/components/admin/AdminStatCard';

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
  createdAt?: string;
  created_at?: string;
};

export default function AdminDashboard() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [commandQuery, setCommandQuery] = useState('');

  const handleQuickCommand = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !commandQuery.trim()) return;
    router.push(`/admin/user?q=${encodeURIComponent(commandQuery.trim())}`);
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      cloudflareApi<{ items: AdminUser[] }>('/api/admin/users'),
      cloudflareApi<{ items: AdminPayment[] }>('/api/admin/payments'),
      cloudflareApi<{ items: AdminLog[] }>('/api/admin/logs?limit=8'),
    ])
      .then(([usersRes, paymentsRes, logsRes]) => {
        if (!active) return;
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

  const totalRevenue = payments.filter(p => p.status === 'DISETUJUI').reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const pendingRevenue = payments.filter(p => p.status === 'MENUNGGU').reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const pendingTickets = payments.filter(p => p.status === 'MENUNGGU').length;
  const activePro = userList.filter(u => u.plan === 'PRO' && u.status === 'AKTIF').length;
  const revenueThisMonth = payments.filter(p => {
    if (p.status !== 'DISETUJUI') return false;
    const approvedAt = p.approvedAt ? new Date(p.approvedAt) : null;
    return approvedAt && approvedAt.getMonth() === new Date().getMonth() && approvedAt.getFullYear() === new Date().getFullYear();
  }).reduce((acc, curr) => acc + (curr.amount || 0), 0);

  const conversionRate = userList.length > 0 ? (userList.filter(u => u.plan === 'PRO').length / userList.length * 100).toFixed(1) : '0';
  const newUsersToday = userList.filter(u => {
    const createdTime = u.createdAt || u.created_at;
    const d = createdTime ? new Date(createdTime) : null;
    return d && d.toDateString() === new Date().toDateString();
  }).length;

  const weeklyChartData = (() => {
    const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const data = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dailyRevenue = payments.filter(p => {
        if (p.status !== 'DISETUJUI') return false;
        const ad = p.approvedAt ? new Date(p.approvedAt) : null;
        return ad && ad.toDateString() === d.toDateString();
      }).reduce((acc, curr) => acc + (curr.amount || 0), 0);
      data.push({ day: days[d.getDay()], val: dailyRevenue, date: d.toDateString() });
    }
    return data;
  })();

  const approvedPayments = payments.filter(p => p.status === 'DISETUJUI');
  const avgApprovedAmount = approvedPayments.length > 0
    ? approvedPayments.reduce((s, p) => s + (p.amount || 0), 0) / approvedPayments.length
    : 0;

  const latestUsers = userList.slice(0, 4);

  const quickActions = [
    { label: 'Verifikasi Pembayaran', note: `${pendingTickets} tiket menunggu`, icon: CreditCard, href: '/admin/pembayaran' },
    { label: 'Kelola Pelanggan', note: `${userList.length} akun terdaftar`, icon: Users, href: '/admin/user' },
    { label: 'Buka Laporan', note: 'Audit aktivitas admin', icon: FileText, href: '/admin/laporan' },
    { label: 'Atur Billing', note: 'Konfigurasi sistem', icon: SettingsIcon, href: '/admin/pengaturan' },
  ];

  return (
    <div className="space-y-8 pb-16 max-w-[1400px] mx-auto">
      <AdminPageHeader
        title="Dashboard Operasional"
        description="Ringkasan pendapatan, antrian verifikasi, dan aktivitas member."
        action={
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" size={15} />
            <input
              type="text"
              value={commandQuery}
              onChange={(e) => setCommandQuery(e.target.value)}
              onKeyDown={handleQuickCommand}
              placeholder="Cari member, tekan Enter..."
              className="w-full sm:w-64 pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[13px] font-medium placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
          </div>
        }
      />

      {/* Core metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard label="Total Pendapatan" value={`Rp ${totalRevenue.toLocaleString()}`} note="Akumulasi global" icon={TrendingUp} color="text-emerald-600" bg="bg-emerald-50" />
        <AdminStatCard label="Bulan Ini" value={`Rp ${revenueThisMonth.toLocaleString()}`} note="Periode berjalan" icon={Activity} color="text-blue-600" bg="bg-blue-50" />
        <AdminStatCard label="Menunggu" value={`Rp ${pendingRevenue.toLocaleString()}`} note={`${pendingTickets} tiket pending`} icon={Clock} color="text-orange-600" bg="bg-orange-50" />
        <AdminStatCard label="Rata-Rata Transaksi" value={`Rp ${Math.round(avgApprovedAmount).toLocaleString()}`} note={`${approvedPayments.length} disetujui`} icon={Zap} color="text-indigo-600" bg="bg-indigo-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: signals + weekly chart */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm space-y-5">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Sinyal Prioritas</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-xl bg-rose-50/60 space-y-1">
                <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Tekanan Verifikasi</p>
                <p className="text-xl font-black text-rose-600">{pendingTickets} tiket</p>
                <p className="text-[11px] font-bold text-rose-500/80">Rp {pendingRevenue.toLocaleString()} antrian</p>
              </div>
              <div className="p-5 rounded-xl bg-indigo-50/60 space-y-1">
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Konversi Pro</p>
                <p className="text-xl font-black text-indigo-600">{conversionRate}%</p>
                <p className="text-[11px] font-bold text-indigo-500/80">Member vs Pro</p>
              </div>
              <div className="p-5 rounded-xl bg-amber-50/60 space-y-1">
                <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">User Baru Hari Ini</p>
                <p className="text-xl font-black text-amber-600">{newUsersToday}</p>
                <p className="text-[11px] font-bold text-amber-600/80">Momentum pertumbuhan</p>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Tren Mingguan</h3>
              <p className="text-[11px] font-bold text-slate-400">{weeklyChartData.reduce((s, d) => s + (d.val > 0 ? 1 : 0), 0)} hari aktif</p>
            </div>
            <div className="flex items-end justify-between px-2 h-40 gap-2">
              {weeklyChartData.map((bar) => (
                <div key={bar.date} className="flex flex-col items-center gap-2 flex-1">
                  <div className="w-full h-28 bg-slate-50 rounded-lg relative overflow-hidden" title={`Rp ${bar.val.toLocaleString()}`}>
                    <div
                      className={cn("absolute bottom-0 left-0 w-full transition-all duration-700 rounded-lg", bar.val > 0 ? "bg-indigo-500" : "bg-transparent")}
                      style={{ height: bar.val > 0 ? `${Math.min((bar.val / 100000) * 100, 100)}%` : '0%' }}
                    />
                  </div>
                  <span className="text-[10px] font-black text-slate-500">{bar.day}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Aktivitas Terbaru</h3>
              <button onClick={() => router.push('/admin/laporan')} className="text-[11px] font-black text-indigo-600 hover:underline flex items-center gap-1">
                Lihat Semua <ChevronRight size={12} />
              </button>
            </div>
            {loading ? (
              <p className="text-[12px] text-slate-400 italic py-6 text-center">Memuat aktivitas...</p>
            ) : logs.length === 0 ? (
              <p className="text-[12px] text-slate-400 italic py-6 text-center">Belum ada aktivitas tercatat.</p>
            ) : (
              <div className="space-y-2">
                {logs.map((log, i) => (
                  <div key={i} className="flex items-center justify-between gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={cn(
                        "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest shrink-0",
                        log.color === 'indigo' ? "bg-indigo-50 text-indigo-600" :
                        log.color === 'orange' ? "bg-orange-50 text-orange-600" :
                        log.color === 'emerald' ? "bg-emerald-50 text-emerald-600" :
                        log.color === 'rose' ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-600"
                      )}>
                        {log.action}
                      </span>
                      <span className="text-[12px] font-medium text-slate-400 truncate">{log.admin_email}</span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-300 shrink-0">
                      {log.created_at ? new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: quick actions + latest members */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm space-y-3">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-2">Akses Cepat</h3>
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => router.push(action.href)}
                className="w-full px-5 py-4 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 text-left transition-all group flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-lg bg-slate-50 group-hover:bg-white flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0">
                  <action.icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-black text-slate-900">{action.label}</p>
                  <p className="text-[11px] font-medium text-slate-400 truncate">{action.note}</p>
                </div>
                <ChevronRight size={14} className="text-slate-300 group-hover:text-indigo-600 transition-colors shrink-0" />
              </button>
            ))}
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Member Terbaru</h3>
            {latestUsers.length === 0 ? (
              <p className="text-[12px] text-slate-400 italic text-center py-6">Belum ada member terdaftar.</p>
            ) : (
              <div className="space-y-2">
                {latestUsers.map((member, i) => (
                  <div
                    key={i}
                    onClick={() => router.push(`/admin/user?q=${encodeURIComponent(member.email || member.name || '')}`)}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-all cursor-pointer group"
                  >
                    {(member.photoURL || member.photo_url) ? (
                      <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                        <Image src={member.photoURL || member.photo_url || ''} alt={member.name || member.email || 'User'} fill className="object-cover" />
                      </div>
                    ) : (
                      <div className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center text-[11px] font-black text-white shrink-0",
                        member.plan === 'PRO' ? "bg-indigo-600" : "bg-slate-400"
                      )}>
                        {member.name?.[0]?.toUpperCase() || 'U'}
                      </div>
                    )}
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[13px] font-black text-slate-900 truncate">{member.name || 'User Anonymous'}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{member.plan || 'FREE'} &middot; {member.status || 'AKTIF'}</span>
                    </div>
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-indigo-600 transition-colors shrink-0" />
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => router.push('/admin/user')}
              className="w-full py-3 rounded-xl bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all"
            >
              Lihat Semua Member
            </button>
          </div>

          {activePro > 0 && (
            <div className="p-6 rounded-2xl bg-indigo-600 text-white space-y-1">
              <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">Member Pro Aktif</p>
              <p className="text-3xl font-black">{activePro}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
