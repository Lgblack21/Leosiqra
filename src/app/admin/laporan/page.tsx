"use client";

import { Search, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminStatCard } from '@/components/admin/AdminStatCard';

type AdminLog = {
  id: string;
  admin_email: string;
  action: string;
  target: string;
  note: string;
  color?: 'indigo' | 'orange' | 'emerald' | 'rose' | 'slate';
  created_at: string;
};

export default function AdminLaporanPage() {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('Semua aksi');

  useEffect(() => {
    (async () => {
      try {
        const logsResponse = await cloudflareApi<{ items: AdminLog[] }>('/api/admin/logs?limit=50');
        setLogs(logsResponse.items || []);
      } catch (error) {
        console.error(error);
        setLogs([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const exportCSV = useCallback(() => {
    if (logs.length === 0) return;
    const header = ['Waktu', 'Admin', 'Aksi', 'Target', 'Catatan'];
    const rows = logs.map(l => [
      l.created_at ? new Date(l.created_at).toLocaleString('id-ID') : '-',
      l.admin_email,
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
      waktu: l.created_at ? new Date(l.created_at).toISOString() : null,
      admin: l.admin_email,
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
    admins: new Set(logs.map(l => l.admin_email)),
    today: logs.filter(l => {
      const d = l.created_at ? new Date(l.created_at) : null;
      return d && d.toDateString() === new Date().toDateString();
    }).length,
    thisWeek: logs.filter(l => {
      const d = l.created_at ? new Date(l.created_at) : null;
      if (!d) return false;
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return d > weekAgo;
    }).length,
  };

  const uniqueActions = useMemo(() => Array.from(new Set(logs.map(l => l.action))).sort(), [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      const matchesAction = actionFilter === 'Semua aksi' || l.action === actionFilter;
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q ||
        l.admin_email?.toLowerCase().includes(q) ||
        l.action?.toLowerCase().includes(q) ||
        l.target?.toLowerCase().includes(q) ||
        l.note?.toLowerCase().includes(q);
      return matchesAction && matchesSearch;
    });
  }, [logs, actionFilter, searchQuery]);

  return (
    <div className="space-y-8 pb-16 max-w-[1400px] mx-auto">
      <AdminPageHeader
        title="Laporan & Audit Log"
        description="Riwayat tindakan admin untuk audit internal dan keamanan akses."
        action={
          <div className="flex gap-2">
            <button
              onClick={exportCSV}
              disabled={logs.length === 0}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[12px] font-bold text-slate-700 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-all",
                logs.length === 0 && "opacity-40 cursor-not-allowed"
              )}
            >
              <Download size={13} /> CSV
            </button>
            <button
              onClick={exportJSON}
              disabled={logs.length === 0}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[12px] font-bold text-slate-700 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-all",
                logs.length === 0 && "opacity-40 cursor-not-allowed"
              )}
            >
              <Download size={13} /> JSON
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard label="Total Log" value={stats.total} color="text-slate-600" bg="bg-slate-100" />
        <AdminStatCard label="Admin Aktif" value={stats.admins.size} color="text-indigo-600" bg="bg-indigo-50" />
        <AdminStatCard label="Hari Ini" value={stats.today} color="text-blue-600" bg="bg-blue-50" />
        <AdminStatCard label="Minggu Ini" value={stats.thisWeek} color="text-emerald-600" bg="bg-emerald-50" />
      </div>

      <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row gap-3">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[13px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
          >
            <option>Semua aksi</option>
            {uniqueActions.map(action => <option key={action}>{action}</option>)}
          </select>
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" size={15} />
            <input
              type="text"
              placeholder="Cari admin / aksi / target / catatan"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[13px] font-medium placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {['WAKTU', 'ADMIN', 'AKSI', 'TARGET', 'CATATAN'].map((head) => (
                  <th key={head} className="text-left py-3 px-3 text-[10px] font-black text-slate-400 tracking-widest uppercase">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Memuat audit logs...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-400 font-medium italic">
                    {logs.length === 0 ? 'Belum ada aktivitas admin yang tercatat.' : 'Tidak ada log yang cocok dengan filter.'}
                  </td>
                </tr>
              ) : filteredLogs.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-3 text-[12px] font-medium text-slate-400 whitespace-nowrap">
                    {row.created_at ? new Date(row.created_at).toLocaleString('id-ID') : '-'}
                  </td>
                  <td className="py-4 px-3 text-[12px] font-medium text-slate-900">{row.admin_email}</td>
                  <td className="py-4 px-3">
                    <span className={cn(
                      "inline-flex px-3 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase",
                      row.color === 'indigo' ? "bg-indigo-50 text-indigo-600" :
                      row.color === 'orange' ? "bg-orange-50 text-orange-600" :
                      row.color === 'emerald' ? "bg-emerald-50 text-emerald-600" :
                      row.color === 'rose' ? "bg-rose-50 text-rose-600" :
                      "bg-slate-50 text-slate-600"
                    )}>
                      {row.action}
                    </span>
                  </td>
                  <td className="py-4 px-3 text-[12px] font-black text-slate-900 truncate max-w-[140px]">{row.target}</td>
                  <td className="py-4 px-3 text-[12px] font-medium text-slate-500 italic">&quot;{row.note}&quot;</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
