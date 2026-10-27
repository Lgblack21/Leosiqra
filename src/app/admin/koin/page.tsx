"use client";

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminStatCard } from '@/components/admin/AdminStatCard';
import { FeedbackProvider, useFeedback } from '@/components/ui/Feedback';

// Tarik tunai koin referral: koin user sudah dikunci saat mengajukan.
// "Sudah dibayar" = admin SUDAH transfer manual; "Tolak" = koin dikembalikan
// otomatis oleh server (sekali saja).

type WithdrawalRow = {
  id: string;
  user_name: string | null;
  user_email: string | null;
  coins: number;
  amount_idr: number;
  method: string;
  account_name: string;
  account_number: string;
  status: 'MENUNGGU' | 'DIBAYAR' | 'DITOLAK';
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;
};

const rp = (n: number) => `Rp ${Number(n).toLocaleString('id-ID')}`;
const when = (iso: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

function AdminKoinContent() {
  const { toast, confirm } = useFeedback();
  const [rows, setRows] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await cloudflareApi<{ items: WithdrawalRow[] }>('/api/admin/coin-withdrawals');
      setRows(res.items || []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const act = async (row: WithdrawalRow, status: 'DIBAYAR' | 'DITOLAK') => {
    let note: string | null = null;
    if (status === 'DIBAYAR') {
      const ok = await confirm({
        title: `Sudah transfer ${rp(row.amount_idr)}?`,
        message: `Ke ${row.method} ${row.account_number} a.n. ${row.account_name}. Tandai dibayar hanya setelah uangnya benar-benar terkirim.`,
        confirmLabel: 'Sudah dibayar',
      });
      if (!ok) return;
    } else {
      note = window.prompt('Alasan penolakan (dilihat member):', 'Data rekening tidak valid');
      if (note === null) return;
    }
    setBusy(row.id);
    try {
      await cloudflareApi(`/api/admin/coin-withdrawals/${row.id}`, { method: 'PATCH', json: { status, note } });
      toast.success(status === 'DIBAYAR' ? 'Ditandai dibayar.' : 'Ditolak — koin dikembalikan.');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memproses.');
    } finally {
      setBusy(null);
    }
  };

  const pending = rows.filter((r) => r.status === 'MENUNGGU');
  const paid = rows.filter((r) => r.status === 'DIBAYAR');

  return (
    <div className="space-y-8 pb-16 max-w-[1400px] mx-auto">
      <AdminPageHeader title="Koin & Tarik Tunai" description="Proses pengajuan tarik tunai koin referral. Transfer manual dulu, baru tandai dibayar." />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <AdminStatCard label="Menunggu" value={pending.length} note={rp(pending.reduce((a, r) => a + r.amount_idr, 0))} color="text-orange-600" bg="bg-orange-50" />
        <AdminStatCard label="Dibayar" value={paid.length} note={rp(paid.reduce((a, r) => a + r.amount_idr, 0))} color="text-emerald-600" bg="bg-emerald-50" />
        <AdminStatCard label="Ditolak" value={rows.filter((r) => r.status === 'DITOLAK').length} color="text-rose-600" bg="bg-rose-50" />
      </div>

      <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-400">Memuat…</p>
        ) : error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada pengajuan tarik tunai.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((r) => (
              <div key={r.id} className="flex flex-col gap-3 py-4 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900">{r.user_name || '—'} <span className="font-medium text-slate-400">· {r.user_email}</span></p>
                  <p className="text-sm text-slate-600">
                    <span className="font-bold">{rp(r.amount_idr)}</span> ({r.coins.toLocaleString('id-ID')} koin) → {r.method} <span className="font-mono">{r.account_number}</span> a.n. {r.account_name}
                  </p>
                  <p className="text-xs text-slate-400">Diajukan {when(r.created_at)}{r.processed_at ? ` · diproses ${when(r.processed_at)}` : ''}{r.admin_note ? ` · ${r.admin_note}` : ''}</p>
                </div>
                {r.status === 'MENUNGGU' ? (
                  <div className="flex gap-2">
                    <button type="button" disabled={busy === r.id} onClick={() => act(r, 'DIBAYAR')} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">Sudah dibayar</button>
                    <button type="button" disabled={busy === r.id} onClick={() => act(r, 'DITOLAK')} className="rounded-xl bg-rose-50 px-4 py-2 text-sm font-bold text-rose-600 disabled:opacity-60">Tolak</button>
                  </div>
                ) : (
                  <span className={cn('self-start rounded-full px-3 py-1 text-xs font-bold md:self-center', r.status === 'DIBAYAR' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>
                    {r.status === 'DIBAYAR' ? 'Dibayar' : 'Ditolak'}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Layout admin tidak memasang FeedbackProvider — halaman ini membawanya sendiri.
export default function AdminKoinPage() {
  return (
    <FeedbackProvider>
      <AdminKoinContent />
    </FeedbackProvider>
  );
}
