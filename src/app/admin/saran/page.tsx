"use client";

import { useEffect, useMemo, useState } from 'react';
import { Loader2, MessageCircleReply, Send } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { feedbackService, type FeedbackItem, type FeedbackStatus } from '@/lib/services/feedbackService';
import { CATEGORIES } from '@/components/feedback/Feedback';
import { cn } from '@/lib/utils';

const FILTERS: { id: 'semua' | FeedbackStatus; label: string }[] = [
  { id: 'baru', label: 'Baru' },
  { id: 'dibaca', label: 'Dibaca' },
  { id: 'selesai', label: 'Selesai' },
  { id: 'semua', label: 'Semua' },
];
const MOOD = ['', '😞', '😕', '😐', '🙂', '😍'];
const STATUS_TONE: Record<FeedbackStatus, string> = {
  baru: 'bg-amber-100 text-amber-800',
  dibaca: 'bg-sky-100 text-sky-800',
  selesai: 'bg-emerald-100 text-emerald-800',
};
const fmt = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

export default function AdminSaranPage() {
  const [items, setItems] = useState<FeedbackItem[] | null>(null);
  const [filter, setFilter] = useState<'semua' | FeedbackStatus>('baru');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    feedbackService.adminList().then(setItems).catch(() => setItems([]));
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { semua: items?.length ?? 0, baru: 0, dibaca: 0, selesai: 0 };
    items?.forEach((i) => { c[i.status] = (c[i.status] ?? 0) + 1; });
    return c;
  }, [items]);
  const avg = useMemo(() => {
    const r = (items ?? []).map((i) => i.rating).filter((x): x is number => typeof x === 'number');
    return r.length ? (r.reduce((a, b) => a + b, 0) / r.length).toFixed(1) : '–';
  }, [items]);
  const shown = (items ?? []).filter((i) => filter === 'semua' || i.status === filter);

  const update = async (id: string, patch: { status?: FeedbackStatus; reply?: string }) => {
    setBusy(id);
    setError('');
    try {
      await feedbackService.adminUpdate(id, patch);
      setItems((cur) =>
        (cur ?? []).map((i) =>
          i.id === id
            ? {
                ...i,
                ...(patch.status ? { status: patch.status } : {}),
                ...(patch.reply !== undefined
                  ? { admin_reply: patch.reply || null, replied_at: patch.reply ? new Date().toISOString() : null, status: patch.status ?? (patch.reply ? 'selesai' : i.status) }
                  : {}),
              }
            : i
        )
      );
      if (patch.reply !== undefined) setDrafts((d) => ({ ...d, [id]: '' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 pb-16">
      <AdminPageHeader title="Saran & Kritik" description="Masukan dari member — tandai sudah dibaca, balas, lalu selesaikan. Balasan tampil di halaman Saran & Kritik milik member." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[['Baru', counts.baru, 'text-amber-600'], ['Dibaca', counts.dibaca, 'text-sky-600'], ['Selesai', counts.selesai, 'text-emerald-600'], ['Rata-rata kepuasan', avg, 'text-indigo-600']].map(([l, v, c]) => (
          <div key={l as string} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{l}</p>
            <p className={cn('mt-1 text-2xl font-black', c as string)}>{v}{l === 'Rata-rata kepuasan' && avg !== '–' ? ' / 5' : ''}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn('rounded-full px-4 py-2 text-xs font-black transition-colors', filter === f.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:text-slate-800')}
          >
            {f.label} <span className="opacity-60">({counts[f.id] ?? 0})</span>
          </button>
        ))}
      </div>

      {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">{error}</p>}

      {items === null ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-indigo-500" /></div>
      ) : shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-400">Tidak ada masukan di sini.</p>
      ) : (
        <ul className="space-y-4">
          {shown.map((it) => {
            const c = CATEGORIES.find((x) => x.id === it.category);
            return (
              <li key={it.id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-slate-900">{c?.emoji} {c?.label}</span>
                    {it.rating ? <span title={`Kepuasan ${it.rating}/5`}>{MOOD[it.rating]}</span> : null}
                    <span className={cn('rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest', STATUS_TONE[it.status])}>{it.status}</span>
                  </div>
                  <span className="text-xs text-slate-400">{fmt(it.created_at)}</span>
                </div>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {it.user_name || '—'} · {it.user_email || '—'}
                  {it.page ? ` · dari ${it.page}` : ''}{it.platform ? ` · ${it.platform === 'app' ? 'aplikasi HP' : 'web'}` : ''}
                </p>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">{it.message}</p>

                {it.admin_reply && (
                  <div className="mt-3 rounded-xl bg-indigo-50 p-3">
                    <p className="flex items-center gap-1.5 text-[11px] font-black text-indigo-700"><MessageCircleReply size={13} /> Balasan terkirim{it.replied_at ? ` · ${fmt(it.replied_at)}` : ''}</p>
                    <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{it.admin_reply}</p>
                  </div>
                )}

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <textarea
                    value={drafts[it.id] ?? ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [it.id]: e.target.value.slice(0, 1000) }))}
                    rows={2}
                    placeholder={it.admin_reply ? 'Ubah balasan…' : 'Tulis balasan untuk member…'}
                    className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:bg-white"
                  />
                  <div className="flex gap-2 sm:flex-col">
                    <button
                      type="button"
                      disabled={busy === it.id || !(drafts[it.id] ?? '').trim()}
                      onClick={() => update(it.id, { reply: (drafts[it.id] ?? '').trim() })}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white disabled:opacity-40"
                    >
                      {busy === it.id ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Balas
                    </button>
                    {it.status !== 'dibaca' && it.status !== 'selesai' && (
                      <button type="button" disabled={busy === it.id} onClick={() => update(it.id, { status: 'dibaca' })} className="flex-1 rounded-xl bg-white px-4 py-2 text-xs font-black text-slate-600 ring-1 ring-slate-200">
                        Tandai dibaca
                      </button>
                    )}
                    {it.status !== 'selesai' ? (
                      <button type="button" disabled={busy === it.id} onClick={() => update(it.id, { status: 'selesai' })} className="flex-1 rounded-xl bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700">
                        Selesai
                      </button>
                    ) : (
                      <button type="button" disabled={busy === it.id} onClick={() => update(it.id, { status: 'dibaca' })} className="flex-1 rounded-xl bg-white px-4 py-2 text-xs font-black text-slate-500 ring-1 ring-slate-200">
                        Buka lagi
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
