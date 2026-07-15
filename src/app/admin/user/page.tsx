"use client";

import Image from 'next/image';
import { Search, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';

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
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Terima pencarian dari luar (mis. Quick Command di Dashboard Admin) lewat ?q=
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) setSearchQuery(q);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [usersResponse, settingsResponse] = await Promise.all([
          cloudflareApi<{ items: AdminUserRow[] }>('/api/admin/users'),
          cloudflareApi<{ item?: AppSettings | null }>('/api/admin/settings'),
        ]);
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

  const handleSetFree = async (row: AdminUserRow) => {
    if (!confirm(`Set ${row.email} ke paket FREE?`)) return;

    let activeExpiredAt: string | null = null;
    if (settings?.free_plan_days && settings.free_plan_days > 0) {
      const d = new Date();
      d.setDate(d.getDate() + settings.free_plan_days);
      activeExpiredAt = d.toISOString();
    }

    try {
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
    } catch {
      alert('Gagal memperbarui status.');
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
    <div className="space-y-8 pb-16 max-w-[1400px] mx-auto">
      <AdminPageHeader
        title="Kelola Pelanggan"
        description="Direktori member, status paket, dan tindakan administratif."
        action={
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" size={15} />
            <input
              type="text"
              placeholder="Cari ID / nama / email"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-72 pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[13px] font-medium placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
          </div>
        }
      />

      <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-black text-slate-900">
            {filteredUsers.length} member {searchQuery && `(dari ${users.filter(u => u.role === 'user' && u.status !== 'GUEST').length})`}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {['ID', 'NAMA', 'EMAIL', 'PLAN', 'STATUS', 'EXPIRED', 'AKSI'].map((head) => (
                  <th key={head} className="text-left py-3 px-3 text-[10px] font-black text-slate-400 tracking-widest uppercase">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Memuat data member...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400 font-medium italic">
                    Tidak ada pengguna yang ditemukan.
                  </td>
                </tr>
              ) : filteredUsers.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-3 text-[12px] font-medium text-slate-400">{row.id?.slice(-4) || '-'}</td>
                  <td className="py-4 px-3">
                    <div className="flex items-center gap-2.5">
                      {row.photo_url ? (
                        <div className="relative w-7 h-7 rounded-lg overflow-hidden bg-slate-50 shrink-0">
                          <Image src={row.photo_url} alt={row.name || 'User'} fill className="object-cover" />
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-[10px] font-black text-indigo-500 uppercase shrink-0">
                          {row.name?.[0] || 'U'}
                        </div>
                      )}
                      <p className="text-[13px] font-black text-slate-900">{row.name || 'Anonymous'}</p>
                    </div>
                  </td>
                  <td className="py-4 px-3 text-[13px] font-medium text-slate-500">{row.email}</td>
                  <td className="py-4 px-3 text-[12px] font-bold text-slate-500">{row.plan || 'FREE'}</td>
                  <td className="py-4 px-3">
                    <span className={cn(
                      "inline-flex px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest",
                      row.status === 'AKTIF' ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                    )}>
                      {row.status || 'NONAKTIF'}
                    </span>
                  </td>
                  <td className="py-4 px-3">
                    {row.expired_at ? (
                      <div className="flex items-center gap-1.5 text-[12px] font-bold text-slate-600">
                        <Clock size={12} className="text-slate-400" />
                        {new Date(row.expired_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </div>
                    ) : (
                      <span className="text-[12px] text-slate-300 font-medium italic">Tidak ada paket</span>
                    )}
                  </td>
                  <td className="py-4 px-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleExtendPro(row.id, row.email, row.expired_at ?? undefined)}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-black text-slate-900 hover:border-indigo-600 hover:text-indigo-600 transition-all"
                      >
                        +1 Bulan
                      </button>
                      <button
                        onClick={() => handleSetFree(row)}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-black text-slate-900 hover:border-indigo-600 hover:text-indigo-600 transition-all"
                      >
                        Set Free
                      </button>
                      <button
                        onClick={() => handleDeleteUser(row.id, row.email)}
                        className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-[11px] font-black hover:bg-rose-500 hover:text-white transition-all"
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
