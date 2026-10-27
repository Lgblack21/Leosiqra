"use client";

import { useCallback, useEffect, useState } from 'react';
import { Inbox, Loader2, RefreshCw, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { useFeedback } from '@/components/ui/Feedback';

// Kontrol Kotak Masuk Gmail (dipakai di halaman Kotak Masuk & layar Gmail):
// baca otomatis tiap jam, "Periksa sekarang", dan ringkasan hasil terakhir.

export type InboxSuggestion = {
  type: 'pengeluaran' | 'pemasukan';
  amount: number;
  category: string | null;
  sub_category: string | null;
  note: string | null;
  confidence: 'high' | 'medium' | 'low';
  account_id?: string | null;
  date?: string | null;
};
export type InboxItem = { id: string; title: string | null; sender: string | null; receivedAt: string; suggestion: InboxSuggestion | null };
export type InboxData = { items: InboxItem[]; gmail: { enabled: boolean; lastCheckAt: string | null } };

export function useInbox() {
  const [data, setData] = useState<InboxData | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      setData(await cloudflareApi<InboxData>('/api/member/inbox'));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat Kotak Masuk.');
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- muat sekali saat dibuka
    void load();
  }, [load]);
  return { data, error, reload: load, setData };
}

type CheckStats = { fetched: number; newItems: number; suggested: number; notTransaction: number; noText: number; aiStopped: boolean };

export function InboxControls({ inbox, onChecked, showLink }: { inbox: ReturnType<typeof useInbox>; onChecked?: () => void; showLink?: boolean }) {
  const { toast } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState('');
  const { data } = inbox;

  const check = async () => {
    setBusy(true);
    setResult('');
    try {
      const s = await cloudflareApi<CheckStats>('/api/member/inbox/check', { method: 'POST' });
      // Angka diagnostik sengaja ditampilkan selama beta — kalau format email
      // dari Composio berubah, langsung kelihatan (mis. "teks tidak terbaca").
      const parts = [
        `${s.fetched} email pembayaran ditemukan`,
        s.newItems ? `${s.newItems} baru` : 'tidak ada yang baru',
        s.suggested ? `${s.suggested} jadi usulan` : null,
        s.notTransaction ? `${s.notTransaction} bukan transaksi` : null,
        s.noText ? `${s.noText} teks tidak terbaca` : null,
        s.aiStopped ? 'AI sedang tidak tersedia, sisanya dicoba lagi nanti' : null,
      ].filter(Boolean);
      setResult(parts.join(' · '));
      await inbox.reload();
      onChecked?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memeriksa email.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async () => {
    if (!data) return;
    setSaving(true);
    try {
      await cloudflareApi('/api/member/inbox/settings', { method: 'PUT', json: { enabled: !data.gmail.enabled } });
      await inbox.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setSaving(false);
    }
  };

  if (inbox.error) return <p className="rounded-[22px] bg-slate-50 p-4 text-[14px] text-slate-600">{inbox.error}</p>;
  if (!data) return <p className="py-4 text-center text-[14px] text-slate-400">Memuat…</p>;
  const when = data.gmail.lastCheckAt ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(data.gmail.lastCheckAt)) : null;

  return (
    <div className="space-y-3 rounded-[22px] bg-slate-50 p-4">
      <div className="flex items-center gap-3">
        <Inbox size={20} className="shrink-0 text-rose-500" />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-slate-900">Baca email pembayaran otomatis</span>
          <span className="block text-[13px] text-slate-500">Tiap ±1 jam{when ? ` · terakhir ${when}` : ''}. Hasilnya masuk Kotak Masuk, tidak langsung tercatat.</span>
        </span>
        <button
          type="button"
          onClick={toggle}
          disabled={saving}
          aria-label="Baca email pembayaran otomatis"
          aria-pressed={data.gmail.enabled}
          className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60', data.gmail.enabled ? 'bg-emerald-500' : 'bg-slate-300')}
        >
          <span className={cn('absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all', data.gmail.enabled ? 'right-1' : 'left-1')} />
        </button>
      </div>
      {result && <p className="rounded-2xl bg-white px-4 py-2.5 text-[13px] text-slate-600 ring-1 ring-slate-200">{result}</p>}
      <div className={cn('grid gap-2', showLink && 'sm:grid-cols-2')}>
        <button type="button" onClick={check} disabled={busy} className="flex items-center justify-center gap-2 rounded-full bg-slate-900 py-3 text-[14px] font-bold text-white disabled:opacity-60">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Periksa email sekarang
        </button>
        {showLink && (
          <a href="/membership/kotak-masuk" className="flex items-center justify-center gap-1.5 rounded-full bg-white py-3 text-[14px] font-bold text-slate-800 ring-1 ring-slate-200 hover:bg-slate-100">
            Buka Kotak Masuk{data.items.length ? ` (${data.items.length})` : ''} <ChevronRight size={15} />
          </a>
        )}
      </div>
    </div>
  );
}
