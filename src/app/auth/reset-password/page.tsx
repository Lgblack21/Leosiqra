"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, CheckCircle2, Lock } from 'lucide-react';
import { AuthCard } from '@/components/auth/AuthCard';
import { authInput, authInputWrap, authLabel, authPrimaryBtn } from '@/components/auth/AuthLayout';
import { cloudflareApi } from '@/lib/cloudflare-api';

export default function ResetPasswordPage() {
  // Token dibaca dari query di client (halaman ini static export, tidak ada
  // server render yang bisa membaca searchParams), lalu dihapus dari address
  // bar supaya tidak ikut tersimpan di riwayat browser / terbagi lewat screenshot.
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [typingPw, setTypingPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('token');
    if (value) window.history.replaceState({}, '', '/auth/reset-password');
    setToken(value);
    setReady(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password baru minimal 8 karakter.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Konfirmasi password tidak sama.');
      return;
    }
    setLoading(true);
    try {
      await cloudflareApi('/api/auth/password/reset', {
        method: 'POST',
        json: { token, password },
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Gagal mengubah password. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  if (!ready) return null;

  if (!token) {
    return (
      <AuthCard mood="sad" badge="Link tidak valid" title="Link reset tidak lengkap" subtitle="Buka link langsung dari email reset password, atau minta link baru.">
        <Link href="/auth/forgot-password" className="block text-center w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-bold shadow-lg shadow-indigo-500/25 hover:-translate-y-0.5 transition-all">
          Minta link baru
        </Link>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard mood="happy" badge="Berhasil" title="Password sudah diganti" subtitle="Silakan login dengan password baru. Demi keamanan, semua perangkat yang sebelumnya login sudah dikeluarkan.">
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
          <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-800">Kalau akunmu memakai 2FA, kode Authenticator tetap diminta saat login.</p>
        </div>
        <Link href="/auth/login" className="block text-center w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-bold shadow-lg shadow-indigo-500/25 hover:-translate-y-0.5 transition-all">
          Ke halaman login
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard mood={error ? 'sad' : typingPw ? (showPassword ? 'peek' : 'hide') : 'idle'} badge="Password baru" title="Buat password baru" subtitle="Minimal 8 karakter. Gunakan kombinasi huruf, angka, dan simbol.">
      {error && (
        <div role="alert" className="py-2.5 px-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-sm font-medium">
          {error}
          {error.includes('kedaluwarsa') && (
            <Link href="/auth/forgot-password" className="block mt-1 font-bold underline">Minta link baru</Link>
          )}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className={authLabel}>Password baru</span>
          <span className={authInputWrap}>
            <Lock size={18} className="shrink-0 text-slate-400 transition-colors group-focus-within:text-indigo-500" />
            <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Minimal 8 karakter" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} onFocus={() => setTypingPw(true)} onBlur={() => setTypingPw(false)} className={authInput} />
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'} className="shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:text-indigo-600">
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>
        <label className="block">
          <span className={authLabel}>Ulangi password baru</span>
          <span className={authInputWrap}>
            <Lock size={18} className="shrink-0 text-slate-400 transition-colors group-focus-within:text-indigo-500" />
            <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Ketik ulang password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} onFocus={() => setTypingPw(true)} onBlur={() => setTypingPw(false)} className={authInput} />
          </span>
        </label>
        <button type="submit" disabled={loading} className={authPrimaryBtn}>
          {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : 'Simpan password baru'}
        </button>
      </form>
    </AuthCard>
  );
}
