"use client";

import { useCallback, useEffect, useState } from 'react';
import { Inbox, Hash, Loader2, RefreshCw, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { useFeedback } from '@/components/ui/Feedback';

// Kontrol Kotak Masuk (halaman Kotak Masuk web & HP, layar Gmail): hanya
// sumber yang dipakai user yang tampil (Gmail dan/atau Slack), masing-masing
// dengan saklar baca otomatis; "Periksa sekarang" memeriksa semuanya.

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
export type InboxItem = { id: string; source?: string; title: string | null; sender: string | null; receivedAt: string; suggestion: InboxSuggestion | null };
export type InboxData = {
  items: InboxItem[];
  gmail: { enabled: boolean; lastCheckAt: string | null };
  slack?: { configured: boolean; enabled: boolean; channelName: string | null; lastCheckAt: string | null };
};

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

type GmailStats = { fetched: number; newItems: number; suggested: number; notTransaction: number; noText: number; aiStopped: boolean };
type SlackStats = { fetched: number; suggested: number; notTransaction: number; skipped: number; aiStopped: boolean };

// Angka diagnostik sengaja ditampilkan selama beta — kalau format dari
// Composio berubah, langsung kelihatan (mis. "teks tidak terbaca").
const gmailSummary = (s: GmailStats) =>
  [
    `${s.fetched} email pembayaran ditemukan`,
    s.newItems ? `${s.newItems} baru` : 'tidak ada yang baru',
    s.suggested ? `${s.suggested} jadi usulan` : null,
    s.notTransaction ? `${s.notTransaction} bukan transaksi` : null,
    s.noText ? `${s.noText} teks tidak terbaca` : null,
    s.aiStopped ? 'AI sedang tidak tersedia, sisanya dicoba lagi nanti' : null,
  ].filter(Boolean).join(' · ');
const slackSummary = (s: SlackStats) =>
  [
    s.fetched ? `${s.fetched} pesan baru` : 'tidak ada pesan baru',
    s.suggested ? `${s.suggested} jadi usulan` : null,
    s.notTransaction ? `${s.notTransaction} bukan transaksi` : null,
    s.skipped ? `${s.skipped} dilewati` : null,
    s.aiStopped ? 'AI sedang tidak tersedia, sisanya dicoba lagi nanti' : null,
  ].filter(Boolean).join(' · ');

const fmtWhen = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : null;

function SourceRow({ icon: Icon, iconCls, title, sub, enabled, onToggle, saving }: { icon: React.ElementType; iconCls: string; title: string; sub: string; enabled: boolean; onToggle: () => void; saving: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Icon size={20} className={cn('shrink-0', iconCls)} />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-slate-900 dark:text-white">{title}</span>
        <span className="block text-[13px] text-slate-500 dark:text-slate-400">{sub}</span>
      </span>
      <button
        type="button"
        onClick={onToggle}
        disabled={saving}
        aria-label={title}
        aria-pressed={enabled}
        className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60', enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700')}
      >
        <span className={cn('absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all', enabled ? 'right-1' : 'left-1')} />
      </button>
    </div>
  );
}

export function InboxControls({ inbox, onChecked, showLink, only, kotakMasukHref = '/membership/kotak-masuk' }: {
  inbox: ReturnType<typeof useInbox>;
  onChecked?: () => void;
  showLink?: boolean;
  only?: 'gmail';
  kotakMasukHref?: string;
}) {
  const { toast } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string[]>([]);
  const { data } = inbox;

  if (inbox.error) return <p className="rounded-[22px] bg-slate-50 p-4 text-[14px] text-slate-600 dark:bg-slate-900 dark:text-slate-300">{inbox.error}</p>;
  if (!data) return <p className="py-4 text-center text-[14px] text-slate-400">Memuat…</p>;

  // Gmail tampil kalau pernah dipakai (atau di layar Gmail); Slack kalau channel sudah dipilih.
  const showGmail = only === 'gmail' || data.gmail.enabled || Boolean(data.gmail.lastCheckAt);
  const slack = data.slack;
  const showSlack = only !== 'gmail' && Boolean(slack?.configured);

  if (!showGmail && !showSlack) {
    return (
      <div className="flex items-center gap-3 rounded-[22px] bg-slate-50 p-4 dark:bg-slate-900">
        <Inbox size={20} className="shrink-0 text-slate-400" />
        <span className="min-w-0 flex-1 text-[14px] text-slate-600 dark:text-slate-300">Belum ada sumber. Hubungkan Gmail atau Slack supaya usulan transaksi masuk ke sini.</span>
        <a href="/membership/aplikasi" className="shrink-0 rounded-full bg-slate-900 px-4 py-2 text-[13px] font-bold text-white dark:bg-white dark:text-slate-900">Hubungkan</a>
      </div>
    );
  }

  const check = async () => {
    setBusy(true);
    setResult([]);
    const jobs: { label: string; run: () => Promise<string> }[] = [];
    if (showGmail) jobs.push({ label: 'Gmail', run: async () => gmailSummary(await cloudflareApi<GmailStats>('/api/member/inbox/check', { method: 'POST' })) });
    if (showSlack) jobs.push({ label: 'Slack', run: async () => slackSummary(await cloudflareApi<SlackStats>('/api/member/apps/slack/inbox', { method: 'POST' })) });
    const settled = await Promise.allSettled(jobs.map((j) => j.run()));
    const lines = settled.map((r, i) => {
      const text = r.status === 'fulfilled' ? r.value : r.reason instanceof Error ? r.reason.message : 'Gagal memeriksa.';
      return jobs.length > 1 ? `${jobs[i].label}: ${text}` : text;
    });
    if (jobs.length === 1 && settled[0].status === 'rejected') toast.error(lines[0]);
    else setResult(lines);
    await inbox.reload();
    onChecked?.();
    setBusy(false);
  };

  const toggle = async (source: 'gmail' | 'slack') => {
    setSaving(true);
    try {
      if (source === 'gmail') await cloudflareApi('/api/member/inbox/settings', { method: 'PUT', json: { enabled: !data.gmail.enabled } });
      else await cloudflareApi('/api/member/apps/slack/inbox', { method: 'PUT', json: { enabled: !slack?.enabled } });
      await inbox.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setSaving(false);
    }
  };

  const gmailWhen = fmtWhen(data.gmail.lastCheckAt);
  const slackWhen = fmtWhen(slack?.lastCheckAt ?? null);

  return (
    <div className="space-y-3 rounded-[22px] bg-slate-50 p-4 dark:bg-slate-900">
      {showGmail && (
        <SourceRow
          icon={Inbox}
          iconCls="text-rose-500"
          title="Baca email pembayaran otomatis"
          sub={`Tiap ±1 jam${gmailWhen ? ` · terakhir ${gmailWhen}` : ''}. Hasilnya masuk Kotak Masuk, tidak langsung tercatat.`}
          enabled={data.gmail.enabled}
          onToggle={() => void toggle('gmail')}
          saving={saving}
        />
      )}
      {showSlack && slack && (
        <SourceRow
          icon={Hash}
          iconCls="text-violet-600"
          title={`Baca pesan Slack #${slack.channelName ?? 'channel'}`}
          sub={`Tiap ±10 menit${slackWhen ? ` · terakhir ${slackWhen}` : ''}. Ganti channel di Aplikasi terhubung → Slack.`}
          enabled={slack.enabled}
          onToggle={() => void toggle('slack')}
          saving={saving}
        />
      )}
      {result.length > 0 && (
        <div className="space-y-1 rounded-2xl bg-white px-4 py-2.5 text-[13px] text-slate-600 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-slate-300 dark:ring-slate-800">
          {result.map((line) => <p key={line}>{line}</p>)}
        </div>
      )}
      <div className={cn('grid gap-2', showLink && 'sm:grid-cols-2')}>
        <button type="button" onClick={() => void check()} disabled={busy} className="flex items-center justify-center gap-2 rounded-full bg-slate-900 py-3 text-[14px] font-bold text-white disabled:opacity-60 dark:bg-white dark:text-slate-900">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} {only === 'gmail' ? 'Periksa email sekarang' : 'Periksa sekarang'}
        </button>
        {showLink && (
          <a href={kotakMasukHref} className="flex items-center justify-center gap-1.5 rounded-full bg-white py-3 text-[14px] font-bold text-slate-800 ring-1 ring-slate-200 hover:bg-slate-100">
            Buka Kotak Masuk{data.items.length ? ` (${data.items.length})` : ''} <ChevronRight size={15} />
          </a>
        )}
      </div>
    </div>
  );
}
