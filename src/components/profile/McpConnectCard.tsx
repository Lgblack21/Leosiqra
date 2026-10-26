'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Bot, Check, Copy, KeyRound, Loader2, Plus, Trash2 } from 'lucide-react';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { cn } from '@/lib/utils';

// Hubungkan akun ke AI agent — Leosiqra MCP (docs/rancangan/mcp.md): token
// manual untuk Claude Code & klien MCP lain (tahap 1+2), dan koneksi login
// OAuth dari claude.ai & ChatGPT (tahap 3) yang tampil di daftar yang sama.
// Dipakai di Profil web & /app/profile (HP) — kelas dark: hanya aktif di AppShell.

const MCP_URL = 'https://www.leosiqra.com/mcp';

interface McpToken {
  id: string;
  name: string;
  hint: string;
  scopes: string[];
  source: 'manual' | 'oauth';
  expiresAt: string;
  lastUsedAt: string | null;
  createdAt: string;
}

interface McpActivity {
  tool: string;
  ok: boolean;
  summary: string | null;
  tokenName: string | null;
  createdAt: string;
}

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));
const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

export function McpConnectCard() {
  const [tokens, setTokens] = useState<McpToken[]>([]);
  const [activity, setActivity] = useState<McpActivity[]>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [days, setDays] = useState(90);
  const [write, setWrite] = useState(false);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [t, a] = await Promise.all([
        cloudflareApi<{ items: McpToken[]; canWrite: boolean }>('/api/member/mcp/tokens'),
        cloudflareApi<{ items: McpActivity[] }>('/api/member/mcp/activity'),
      ]);
      setTokens(t.items);
      setCanWrite(t.canWrite);
      setActivity(a.items);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat token.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    try {
      const res = await cloudflareApi<{ token: string }>('/api/member/mcp/tokens', {
        method: 'POST',
        json: { name: name.trim(), expiresDays: days, write: canWrite && write },
      });
      setNewToken(res.token);
      setShowForm(false);
      setName('');
      setWrite(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal membuat token.');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Cabut akses ini? AI yang memakainya langsung tidak bisa mengakses akun Anda.')) return;
    setRevokingId(id);
    try {
      await cloudflareApi(`/api/member/mcp/tokens/${id}`, { method: 'DELETE' });
      setTokens((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Gagal mencabut token.');
    } finally {
      setRevokingId(null);
    }
  };

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // clipboard ditolak browser — user masih bisa blok & salin manual
    }
  };

  const claudeCodeCmd = newToken
    ? `claude mcp add --transport http leosiqra ${MCP_URL} --header "Authorization: Bearer ${newToken}"`
    : '';

  return (
    <div className="bg-white dark:bg-slate-900 p-5 md:p-8 rounded-[20px] md:rounded-[48px] border border-slate-50 dark:border-slate-800 shadow-sm space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 shrink-0">
            <Bot size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg md:text-xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">Hubungkan ke AI</h2>
            <p className="text-[10px] font-bold text-slate-400 mt-0.5">Tanya &amp; catat keuangan dari Claude, ChatGPT &amp; klien MCP lain</p>
          </div>
        </div>
        {!showForm && !loading && (
          <button
            onClick={() => { setShowForm(true); setNewToken(null); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-[11px] font-black shrink-0 hover:bg-indigo-700 transition-colors"
          >
            <Plus size={14} /> Token
          </button>
        )}
      </div>

      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
        Data yang dibaca AI dikirim ke penyedia AI pilihan Anda. Token bisa dicabut kapan saja dan otomatis dicabut saat
        password diganti/direset.
      </p>
      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
        <b>claude.ai / ChatGPT:</b> tambahkan custom connector dengan URL <code className="text-slate-700 dark:text-slate-200 break-all">{MCP_URL}</code>, lalu
        login Leosiqra &amp; pilih Izinkan — tidak perlu token. Token di bawah untuk Claude Code &amp; klien yang memakai header.
      </p>
      <Link
        href="/panduan/mcp"
        className="inline-flex items-center gap-1.5 text-[11px] font-black text-indigo-600 dark:text-indigo-400 hover:underline"
      >
        <BookOpen size={13} /> Panduan langkah demi langkah
      </Link>

      {error && <p className="text-[11px] font-bold text-rose-500">{error}</p>}

      {showForm && (
        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder='Nama token, mis. "Claude di laptop"'
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500 shrink-0">Berlaku</span>
            {[30, 90, 365].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg text-[11px] font-black transition-colors whitespace-nowrap',
                  days === d ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                )}
              >
                {d} hari
              </button>
            ))}
          </div>
          <label className={cn('flex items-start gap-2 text-[11px] font-medium', canWrite ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400')}>
            <input
              type="checkbox"
              checked={canWrite && write}
              disabled={!canWrite}
              onChange={(e) => setWrite(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Izinkan AI <b>mencatat</b> transaksi &amp; mengatur budget{canWrite ? '' : ' (khusus PRO)'}. Tanpa ini AI hanya bisa membaca.
              AI tidak pernah bisa menghapus data.
            </span>
          </label>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={creating || !name.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-[11px] font-black disabled:opacity-50"
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />} Buat token
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-[11px] font-black text-slate-500">
              Batal
            </button>
          </div>
        </div>
      )}

      {newToken && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-2xl space-y-3">
          <p className="text-[11px] font-black text-emerald-800">
            Salin token sekarang — token ini hanya ditampilkan sekali.
          </p>
          {[
            { label: 'token', title: 'Token', value: newToken },
            { label: 'url', title: 'URL server MCP', value: MCP_URL },
            { label: 'cmd', title: 'Claude Code (terminal)', value: claudeCodeCmd },
          ].map((row) => (
            <div key={row.label}>
              <p className="text-[10px] font-bold text-emerald-700 mb-1">{row.title}</p>
              <div className="flex items-start gap-2">
                <code className="flex-1 min-w-0 break-all text-[11px] bg-white dark:bg-slate-900 px-2.5 py-2 rounded-lg border border-emerald-100 dark:border-emerald-500/20 text-slate-800 dark:text-slate-200">
                  {row.value}
                </code>
                <button
                  onClick={() => copy(row.label, row.value)}
                  aria-label={`Salin ${row.title}`}
                  className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 shrink-0"
                >
                  {copied === row.label ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          ))}
          <p className="text-[10px] font-medium text-emerald-800 leading-relaxed">
            Klien MCP lain yang mendukung header: pakai URL di atas + header <code>Authorization: Bearer &lt;token&gt;</code>.
          </p>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-4">Memuat...</p>
      ) : tokens.length === 0 ? (
        !showForm && <p className="text-sm text-slate-400 text-center py-2">Belum ada token.</p>
      ) : (
        <div className="space-y-3">
          {tokens.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-black text-slate-900 dark:text-white truncate">{t.name}</p>
                  {t.source === 'oauth' ? (
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[9px] font-black rounded-full shrink-0">Login AI</span>
                  ) : (
                    <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-[9px] font-black rounded-full shrink-0">…{t.hint}</span>
                  )}
                  <span
                    className={cn(
                      'px-2 py-0.5 text-[9px] font-black rounded-full uppercase tracking-widest shrink-0',
                      t.scopes.includes('write') ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                    )}
                  >
                    {t.scopes.includes('write') ? 'Baca + catat' : 'Baca'}
                  </span>
                </div>
                <p className="text-[10px] font-medium text-slate-400 mt-1">
                  {t.lastUsedAt ? `Dipakai ${formatDateTime(t.lastUsedAt)}` : 'Belum dipakai'} ·{' '}
                  {t.source === 'oauth' ? `tersambung s.d. ${formatDate(t.expiresAt)} (diperpanjang otomatis saat dipakai)` : `berlaku s.d. ${formatDate(t.expiresAt)}`}
                </p>
              </div>
              <button
                onClick={() => handleRevoke(t.id)}
                disabled={revokingId === t.id}
                title={t.source === 'oauth' ? 'Putuskan koneksi' : 'Cabut token'}
                className="p-2 rounded-lg bg-white dark:bg-slate-900 text-slate-400 hover:bg-rose-500 hover:text-white transition-all shrink-0 disabled:opacity-50"
              >
                {revokingId === t.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              </button>
            </div>
          ))}
        </div>
      )}

      {activity.length > 0 && (
        <div className="pt-2">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Aktivitas AI terakhir</p>
          <ul className="space-y-1.5">
            {activity.slice(0, 8).map((a, i) => (
              <li key={`${a.createdAt}-${i}`} className="flex items-center justify-between gap-3 text-[11px]">
                <span className={cn('font-bold truncate', a.ok ? 'text-slate-700 dark:text-slate-300' : 'text-rose-500')}>
                  {a.tool}
                  {a.summary ? <span className="font-medium text-slate-400"> · {a.summary}</span> : null}
                </span>
                <span className="text-slate-400 shrink-0">{formatDateTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
