"use client";

import Image from 'next/image';
import { 
  Search, 
  Clock, 
  Users, 
  ShieldCheck,
  Zap,
  LayoutDashboard,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { cloudflareApi } from '@/lib/cloudflare-api';

type AppSettings = {
  free_plan_days?: number;
};

type AdminUserRow = {
  id: string;
  name?: string;
  email: string;
  role?: 'admin' | 'user';
  plan?: 'FREE' | 'PRO';
  status?: 'AKTIF' | 'NONAKTIF' | 'GUEST' | 'PENDING';
  expired_at?: string | null;
  photo_url?: string | null;
};

export default function AdminUserPage() {
  const [userEmail, setUserEmail] = useState('admin@leosiqra.com');
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  
  useEffect(() => {
    (async () => {
      try {
        const [me, usersResponse, settingsResponse] = await Promise.all([
          cloudflareApi<{ user?: { email?: string } | null }>('/api/auth/me'),
          cloudflareApi<{ items: AdminUserRow[] }>('/api/admin/users'),
          cloudflareApi<{ item?: AppSettings | null }>('/api/admin/settings'),
        ]);

        setUserEmail(me.user?.email || 'admin@leosiqra.com');
        setUsers(usersResponse.items || []);
        setSettings(settingsResponse.item ?? null);
      } catch (error) {
        console.error(error);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleDeleteUser = async (userId: string, targetEmail: string) => {
    if (!confirm(`Hapus akun ${targetEmail}? Tindakan ini permanen.`)) return;
    try {
      await cloudflareApi(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });
      setUsers((current) => current.filter((item) => item.id !== userId));
      alert('User berhasil dihapus.');
  } catch {
      alert('Gagal menghapus user.');
    }
  };

  const handleExtendPro = async (userId: string, currentEmail: string, currentExpiredAt?: string) => {
    try {
      const now = new Date();
      // Jika sudah ada expiredAt dan belum basi, hitung dari tanggal tersebut. Jika tidak, dari hari ini.
      const baseDate = (currentExpiredAt && new Date(currentExpiredAt) > now) 
        ? new Date(currentExpiredAt) 
        : now;
        
      const nextMonth = new Date(baseDate);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      
      await cloudflareApi(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        json: {
          plan: 'PRO',
          status: 'AKTIF',
          expiredAt: nextMonth.toISOString(),
        },
      });
      setUsers((current) =>
        current.map((item) =>
          item.id === userId
            ? { ...item, plan: 'PRO', status: 'AKTIF', expired_at: nextMonth.toISOString() }
            : item
        )
      );
      alert('Paket berhasil diperpanjang (akumulatif).');
    } catch {
      alert('Gagal memperbarui paket.');
    }
  };

  const filteredUsers = users.filter(u => 
    (u.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
     u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     u.id?.includes(searchQuery)) && 
     u.role === 'user' && 
     u.status !== 'GUEST'
  );

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
                Manajemen Pengguna
              </h1>
              <p className="text-slate-400 font-medium text-base lg:text-lg leading-relaxed max-w-2xl">
                Kelola database member, verifikasi status langganan, dan pantau aktivitas pengguna dalam satu antarmuka yang efisien.
              </p>
            </div>
            
            <div className="flex flex-wrap gap-3">
              {[
                { label: 'Live member tracking', icon: Activity },
                { label: 'Verified focus', icon: ShieldCheck },
                { label: 'Role control', icon: Users },
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
              { tag: 'DATABASE', title: 'Data Terpusat', desc: 'Akses profil lengkap pengguna tanpa navigasi rumit.', color: 'text-blue-500', bg: 'bg-blue-50/50' },
              { tag: 'VERIFICATION', title: 'Sistem Verifikasi', desc: 'Klasifikasi otomatis member PRO, Active, dan Suspended.', color: 'text-indigo-500', bg: 'bg-indigo-50/50' },
              { tag: 'SECURITY', title: 'Kontrol Akses', desc: 'Manajemen role presisi untuk menjaga keamanan data.', color: 'text-violet-500', bg: 'bg-violet-50/50' },
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
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">User Console</p>
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={16} />
                  <input 
                    type="text" 
                    placeholder="Search UID or Name..."
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
                    <h4 className="text-[11px] font-black uppercase tracking-[0.15em]">User System Ready</h4>
                  </div>
                  <p className="text-[11px] font-medium text-indigo-50 leading-relaxed opacity-80">
                    Modul manajemen pengguna telah terhubung ke database dan siap digunakan.
                  </p>
                </div>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
          </div>
        </div>
      </div>

      {/* CONTENT AREA: Direktori Pelanggan */}
      <div className="p-12 rounded-[56px] bg-white border border-slate-100 shadow-sm space-y-10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Customer Directory</p>
            <h3 className="text-3xl font-serif font-black text-slate-900 tracking-tight">Direktori Pelanggan</h3>
            <p className="text-slate-400 font-medium text-xs max-w-md leading-relaxed">Pusat kendali akun pelanggan, status paket, dan tindakan administratif.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={16} />
              <input 
                type="text" 
                placeholder="Cari ID / nama / email"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-[280px] pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[13px] font-medium placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all font-sans italic"
              />
            </div>
            <div className="flex gap-2">
              <button className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-[12px] font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                Ekspor CSV
              </button>
              <button className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-[12px] font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                Muat Ulang
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-50">
                {['ID', 'NAMA', 'EMAIL', 'PLAN', 'STATUS', 'EXPIRED', 'AKSI'].map((head) => (
                  <th key={head} className="text-left py-6 px-4 text-[11px] font-black text-slate-900 tracking-widest uppercase">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-4 animate-pulse">
                      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Memuat database member...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center text-slate-400 font-medium italic">
                    Tidak ada pengguna yang ditemukan.
                  </td>
                </tr>
              ) : filteredUsers.map((row, idx) => (
                <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="py-6 px-4 text-[13px] font-medium text-slate-400">{row.id?.slice(-4) || '-'}</td>
                  <td className="py-6 px-4">
                    <div className="flex items-center gap-3">
                      {row.photo_url ? (
                        <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-100 shadow-sm bg-slate-50">
                          <Image src={row.photo_url} alt={row.name || 'User'} fill className="object-cover" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-[10px] font-black text-indigo-500 border border-indigo-100 uppercase">
                          {row.name?.[0] || 'U'}
                        </div>
                      )}
                      <p className="text-[13px] font-black text-slate-900 tracking-tight">{row.name || 'Anonymous'}</p>
                    </div>
                  </td>
                  <td className="py-6 px-4 text-[13px] font-medium text-slate-500">{row.email}</td>
                  <td className="py-6 px-4 text-[12px] font-bold text-slate-500 tracking-widest">{row.plan || 'FREE'}</td>
                  <td className="py-6 px-4">
                    <span className={cn(
                      "inline-flex px-3 py-1.5 rounded-full text-[10px] font-black tracking-widest",
                      row.status === 'AKTIF' ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                    )}>
                      {row.status || 'NONAKTIF'}
                    </span>
                  </td>
                  <td className="py-6 px-4">
                    {row.expired_at ? (
                      <div className="flex items-center gap-2 text-[12px] font-bold text-slate-600">
                        <Clock size={12} className="text-slate-400" />
                        {new Date(row.expired_at).toLocaleDateString('id-ID', { 
                          day: 'numeric', 
                          month: 'short', 
                          year: 'numeric' 
                        })}
                      </div>
                    ) : (
                      <span className="text-[12px] text-slate-300 font-medium italic">No active plan</span>
                    )}
                  </td>
                  <td className="py-6 px-4">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleExtendPro(row.id, row.email, row.expired_at ?? undefined)}
                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-black text-slate-900 hover:border-indigo-600 hover:text-indigo-600 transition-all"
                      >
                        Perpanjang 1 Bulan
                      </button>
                      <button 
                        onClick={async () => {
                          if(!confirm(`Set ${row.email} ke paket FREE?`)) return;
                          
                          let activeExpiredAt = null;
                          if (settings?.free_plan_days && settings.free_plan_days > 0) {
                            const d = new Date();
                            d.setDate(d.getDate() + settings.free_plan_days);
                            activeExpiredAt = d.toISOString();
                          }
                          
                          await cloudflareApi(`/api/admin/users/${row.id}`, {
                            method: 'PATCH',
                            json: {
                              plan: 'FREE',
                              status: 'AKTIF',
                              expiredAt: activeExpiredAt,
                            },
                          });
                          setUsers((current) =>
                            current.map((item) =>
                              item.id === row.id
                                ? { ...item, plan: 'FREE', status: 'AKTIF', expired_at: activeExpiredAt }
                                : item
                            )
                          );
                          alert('Status diatur ke FREE');
                        }}
                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-black text-slate-900 hover:border-indigo-600 hover:text-indigo-600 transition-all font-sans"
                      >
                        Set Free
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(row.id, row.email)}
                        className="px-4 py-2 bg-rose-500 text-white rounded-xl text-[11px] font-black tracking-tight hover:bg-rose-600 transition-all"
                      >
                        Hapus Akun
                      </button>
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
             Total: {filteredUsers.length} member
           </span>
           <button className="text-[12px] font-bold text-slate-400 hover:text-slate-900 transition-colors px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
             Berikutnya
           </button>
        </div>
      </div>
    </div>
  );
}
