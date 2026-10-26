'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, BadgeCheck, Bot, Check, Eye, Loader2, PenLine, ShieldCheck, X } from 'lucide-react';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { cn } from '@/lib/utils';

// Layar persetujuan OAuth Leosiqra MCP (tahap 3, docs/rancangan/mcp.md).
// Alur: claude.ai/ChatGPT → GET /oauth/authorize (Worker memvalidasi) → halaman
// ini → login dulu kalau perlu (?next= kembali ke sini) → Izinkan/Tolak →
// kembali ke aplikasi AI. Semua parameter divalidasi ulang di Worker; halaman
// ini hanya menampilkan & meneruskan keputusan member.

interface AuthorizeInfo {
  clientName: string;
  redirectHost: string;
  verified: boolean;
  writeRequested: boolean;
  canWrite: boolean;
  userName: string;
  userEmail: string;
}

export default function IzinkanAiPage() {
  const [query, setQuery] = useState('');
  const [info, setInfo] = useState<AuthorizeInfo | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [write, setWrite] = useState(false);
  const [submitting, setSubmitting] = useState<'allow' | 'deny' | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const presetError = params.get('error');
    if (presetError && !params.get('client_id')) {
      setError(presetError);
      setLoading(false);
      return;
    }
    const search = window.location.search.slice(1);
    setQuery(search);
    (async () => {
      try {
        const me = await cloudflareApi<{ user?: unknown | null }>('/api/auth/me').catch(() => ({ user: null }));
        if (!me.user) {
          const next = `/izinkan-ai?${search}`;
          window.location.replace(`/auth/login?next=${encodeURIComponent(next)}`);
          return;
        }
        setInfo(await cloudflareApi<AuthorizeInfo>(`/api/member/mcp/authorize?${search}`));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Permintaan izin tidak valid.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const decide = async (allow: boolean) => {
    setSubmitting(allow ? 'allow' : 'deny');
    setError('');
    try {
      const res = await cloudflareApi<{ redirectTo: string }>('/api/member/mcp/authorize', {
        method: 'POST',
        json: { query, allow, write: allow && write },
      });
      window.location.href = res.redirectTo;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memproses izin.');
      setSubmitting(null);
    }
  };

  const writeAvailable = Boolean(info?.canWrite && info?.writeRequested);

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-[28px] border border-slate-100 shadow-sm p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
            <Bot size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Leosiqra</p>
            <h1 className="text-lg font-black text-slate-900 tracking-tight leading-tight">Hubungkan aplikasi AI</h1>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10 text-slate-400">
            <Loader2 className="animate-spin" size={22} />
          </div>
        ) : !info ? (
          <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl space-y-2">
            <p className="text-sm font-black text-rose-700 flex items-center gap-2">
              <AlertTriangle size={16} /> Permintaan tidak bisa diproses
            </p>
            <p className="text-xs font-medium text-rose-700 leading-relaxed">{error || 'Permintaan izin tidak valid.'}</p>
            <p className="text-[11px] font-medium text-rose-600 leading-relaxed">
              Tutup halaman ini lalu ulangi pemasangan connector dari aplikasi AI-nya.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-600 leading-relaxed">
                <b className="text-slate-900">{info.clientName}</b> meminta akses ke akun Leosiqra kamu.
              </p>
              <div
                className={cn(
                  'p-4 rounded-2xl border',
                  info.verified ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-200'
                )}
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Akan kembali ke</p>
                <p className="text-base font-black text-slate-900 break-all">{info.redirectHost}</p>
                {info.verified ? (
                  <p className="mt-1 text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                    <BadgeCheck size={14} /> Domain aplikasi AI resmi yang dikenal Leosiqra
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] font-bold text-amber-700 leading-relaxed">
                    Tidak terverifikasi. Lanjutkan hanya kalau kamu sendiri yang sedang memasang aplikasi di domain ini.
                  </p>
                )}
              </div>
              <p className="text-[11px] font-medium text-slate-400">
                Masuk sebagai <span className="font-bold text-slate-600">{info.userEmail}</span>
              </p>
            </div>

            <ul className="space-y-2.5">
              <li className="flex items-start gap-2.5 text-xs font-medium text-slate-600">
                <Eye size={15} className="text-emerald-600 mt-0.5 shrink-0" />
                <span>
                  <b>Membaca</b> rekening &amp; saldo, transaksi, laporan bulanan, budget, dan kategori.
                </span>
              </li>
              <li>
                <label className={cn('flex items-start gap-2.5 text-xs font-medium', writeAvailable ? 'text-slate-600' : 'text-slate-400')}>
                  <input
                    type="checkbox"
                    checked={writeAvailable && write}
                    disabled={!writeAvailable}
                    onChange={(e) => setWrite(e.target.checked)}
                    className="mt-0.5"
                  />
                  <PenLine size={15} className="mt-0.5 shrink-0" />
                  <span>
                    <b>Mencatat</b> transaksi &amp; mengatur budget
                    {!info.canWrite ? ' (khusus PRO)' : !info.writeRequested ? ' (tidak diminta aplikasi ini)' : ''}.
                  </span>
                </label>
              </li>
              <li className="flex items-start gap-2.5 text-xs font-medium text-slate-500">
                <ShieldCheck size={15} className="text-slate-400 mt-0.5 shrink-0" />
                <span>AI tidak pernah bisa menghapus data, transfer, atau mengubah password.</span>
              </li>
            </ul>

            <p className="text-[11px] font-medium text-slate-400 leading-relaxed">
              Data yang dibaca AI dikirim ke penyedia aplikasi tersebut. Koneksi bisa diputus kapan saja di Profil → Keamanan →
              Hubungkan ke AI, dan otomatis terputus saat password diganti/direset.
            </p>

            {error && <p className="text-[11px] font-bold text-rose-500">{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={() => decide(false)}
                disabled={submitting !== null}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl bg-slate-100 text-slate-600 text-xs font-black disabled:opacity-50"
              >
                {submitting === 'deny' ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />} Tolak
              </button>
              <button
                onClick={() => decide(true)}
                disabled={submitting !== null}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl bg-indigo-600 text-white text-xs font-black hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting === 'allow' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Izinkan
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
