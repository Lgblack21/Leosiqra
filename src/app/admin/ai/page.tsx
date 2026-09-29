"use client";

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, KeyRound, Loader2, RefreshCw, Wallet } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { cn } from '@/lib/utils';

type AiStatus = {
  source: 'admin' | 'cloudflare' | 'none';
  keyHint: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
  hasCloudflareSecret: boolean;
  models: { chat: string; parse: string };
  managementKeyHint: string | null;
  keyValid: boolean;
  keyInfo: { label: string | null; usage: number; limit: number | null; limitRemaining: number | null; isFreeTier: boolean } | null;
  credits: { total: number; used: number; remaining: number } | null;
};

// Perkiraan biaya 1 pesan chat Gemini 2.5 Flash Lite dengan konteks data
// keuangan user (±19rb token) — cuma buat gambaran "cukup untuk berapa pesan".
const USD_PER_MESSAGE = 0.0022;
const LOW_BALANCE_USD = 1;

const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmt = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const SOURCE_LABEL: Record<AiStatus['source'], string> = {
  admin: 'Dipasang dari panel admin',
  cloudflare: 'Secret Cloudflare',
  none: 'Belum ada key',
};

export default function AdminAiPage() {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [kind, setKind] = useState<'api' | 'management'>('api');
  const [apiKey, setApiKey] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'save' | 'reset' | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setStatus(await cloudflareApi<AiStatus>('/api/admin/ai-status'));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Gagal memuat status AI.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (mode: 'save' | 'reset') => {
    const resetQuestion = kind === 'management'
      ? 'Hapus Management key? Saldo tidak akan tampil lagi di sini.'
      : 'Hapus key dari panel admin dan kembali pakai secret Cloudflare?';
    if (mode === 'reset' && !confirm(resetQuestion)) return;
    setBusy(mode);
    setMessage(null);
    try {
      await cloudflareApi('/api/admin/ai-key', {
        method: mode === 'save' ? 'PUT' : 'DELETE',
        json: mode === 'save' ? { kind, apiKey: apiKey.trim(), password } : { kind, password },
      });
      setApiKey('');
      setPassword('');
      setMessage({
        tone: 'ok',
        text:
          kind === 'management'
            ? mode === 'save' ? 'Management key tersimpan — saldo akun sekarang tampil.' : 'Management key dihapus.'
            : mode === 'save' ? 'Key baru aktif. Server lain ikut pakai key ini paling lambat 1 menit.' : 'Kembali memakai secret Cloudflare.',
      });
      await load();
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Gagal menyimpan.' });
    } finally {
      setBusy(null);
    }
  };

  const remaining = status?.credits?.remaining ?? status?.keyInfo?.limitRemaining ?? null;
  const low = remaining !== null && remaining < LOW_BALANCE_USD;

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 pb-16">
      <AdminPageHeader
        title="AI & Saldo"
        description="Pantau sisa saldo OpenRouter untuk AI Leosiqra (chat, scan struk, voice) dan ganti API key tanpa perlu deploy."
        action={
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={cn(loading && 'animate-spin')} /> Muat ulang
          </button>
        }
      />

      {loadError && <p className="rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">{loadError}</p>}

      <div className="grid gap-4 md:grid-cols-3">
        <div className={cn('rounded-3xl border p-6 shadow-sm md:col-span-2', low ? 'border-rose-200 bg-rose-50' : 'border-slate-100 bg-white')}>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <Wallet size={14} /> Sisa saldo OpenRouter
          </div>
          {loading && !status ? (
            <Loader2 className="mt-4 animate-spin text-slate-300" />
          ) : remaining !== null ? (
            <>
              <p className={cn('mt-2 text-4xl font-black tracking-tight', low ? 'text-rose-600' : 'text-slate-900')}>{usd(remaining)}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                ± {Math.floor(remaining / USD_PER_MESSAGE).toLocaleString('id-ID')} pesan chat lagi (perkiraan)
              </p>
              {status?.credits && (
                <p className="mt-3 text-xs font-medium text-slate-400">
                  Total diisi {usd(status.credits.total)} · terpakai {usd(status.credits.used)}
                </p>
              )}
              {low && (
                <p className="mt-3 flex items-center gap-2 text-sm font-bold text-rose-700">
                  <AlertTriangle size={16} /> Saldo hampir habis — AI akan berhenti menjawab kalau saldo $0.
                </p>
              )}
            </>
          ) : (
            <div className="mt-3 space-y-2 text-sm font-semibold text-slate-500">
              <p>
                {status?.managementKeyHint
                  ? 'Management key ditolak OpenRouter — pasang ulang di bawah.'
                  : 'OpenRouter hanya memberi info saldo akun lewat Management key. Pasang Management key di bawah (sekali saja) supaya saldo tampil di sini.'}
              </p>
              {status?.keyValid && <p className="text-xs text-slate-400">Terpakai lewat API key aktif: {usd(status.keyInfo?.usage ?? 0)}</p>}
            </div>
          )}
          <a
            href="https://openrouter.ai/settings/credits"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
          >
            Isi saldo di OpenRouter <ExternalLink size={14} />
          </a>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <KeyRound size={14} /> Key aktif
          </div>
          {status ? (
            <div className="mt-3 space-y-2 text-sm">
              <p className="flex items-center gap-2 font-bold text-slate-900">
                {status.keyValid ? <CheckCircle2 size={16} className="text-emerald-500" /> : <AlertTriangle size={16} className="text-rose-500" />}
                {status.keyValid ? 'Valid' : 'Tidak valid'}
              </p>
              <p className="font-mono text-xs text-slate-500">{status.keyHint ?? '–'}</p>
              <p className="text-xs font-semibold text-slate-500">{SOURCE_LABEL[status.source]}</p>
              {status.updatedAt && (
                <p className="text-xs text-slate-400">
                  Diganti {fmt(status.updatedAt)}
                  {status.updatedBy ? ` oleh ${status.updatedBy}` : ''}
                </p>
              )}
              <div className="border-t border-slate-100 pt-2 text-xs text-slate-400">
                <p>Chat: <span className="font-mono">{status.models.chat}</span></p>
                <p>Scan & voice: <span className="font-mono">{status.models.parse}</span></p>
              </div>
            </div>
          ) : (
            <Loader2 className="mt-4 animate-spin text-slate-300" />
          )}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit('save');
        }}
        className="space-y-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm"
      >
        <div>
          <h2 className="text-lg font-black text-slate-900">Ganti key OpenRouter</h2>
          <div className="mt-3 inline-flex rounded-xl bg-slate-100 p-1">
            {([['api', 'API key (untuk AI)'], ['management', 'Management key (cek saldo)']] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => { setKind(id); setMessage(null); }}
                className={cn('rounded-lg px-4 py-2 text-xs font-bold', kind === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm text-slate-500">
            Buat key di{' '}
            <a
              href={kind === 'api' ? 'https://openrouter.ai/settings/keys' : 'https://openrouter.ai/settings/management-keys'}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-indigo-600 underline"
            >
              {kind === 'api' ? 'openrouter.ai/settings/keys' : 'openrouter.ai/settings/management-keys'}
            </a>{' '}
            pada akun yang saldonya diisi.{' '}
            {kind === 'api'
              ? 'Key ini yang dipakai AI Leosiqra untuk menjawab.'
              : 'Key ini cuma dipakai untuk membaca saldo, tidak untuk menjawab chat.'}{' '}
            Key dites ke OpenRouter dulu, lalu disimpan terenkripsi.
            {kind === 'management' && status?.managementKeyHint && (
              <span className="mt-1 block font-mono text-xs text-slate-400">Terpasang: {status.managementKeyHint}</span>
            )}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-xs font-bold text-slate-500">{kind === 'api' ? 'API key baru' : 'Management key'}</span>
            <input
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-or-v1-…"
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-mono text-sm outline-none focus:border-indigo-400"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-500">Password admin (konfirmasi)</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-400"
            />
          </label>
        </div>
        {message && (
          <p className={cn('rounded-xl p-3 text-sm font-semibold', message.tone === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>
            {message.text}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={busy !== null || !apiKey.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy === 'save' && <Loader2 size={16} className="animate-spin" />} Tes & simpan key
          </button>
          {(kind === 'api' ? status?.source === 'admin' && status.hasCloudflareSecret : Boolean(status?.managementKeyHint)) && (
            <button
              type="button"
              onClick={() => submit('reset')}
              disabled={busy !== null}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              {busy === 'reset' && <Loader2 size={16} className="animate-spin" />}{' '}
              {kind === 'api' ? 'Kembali ke secret Cloudflare' : 'Hapus Management key'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
