"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { AuthCard } from '@/components/auth/AuthCard';
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
      <AuthCard badge="Link tidak valid" title="Link reset tidak lengkap" subtitle="Buka link langsung dari email reset password, atau minta link baru.">
        <Link href="/auth/forgot-password" className="block text-center w-full py-3 rounded-control bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700">
          Minta link baru
        </Link>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard badge="Berhasil" title="Password sudah diganti" subtitle="Silakan login dengan password baru. Demi keamanan, semua perangkat yang sebelumnya login sudah dikeluarkan.">
        <div className="flex items-center gap-3 p-4 rounded-control bg-emerald-50 border border-emerald-100">
          <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-800">Kalau akunmu memakai 2FA, kode Authenticator tetap diminta saat login.</p>
        </div>
        <Link href="/auth/login" className="block text-center w-full py-3 rounded-control bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700">
          Ke halaman login
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard badge="Password baru" title="Buat password baru" subtitle="Minimal 8 karakter. Gunakan kombinasi huruf, angka, dan simbol.">
      {error && (
        <div role="alert" className="py-2.5 px-4 rounded-control bg-red-50 border border-red-100 text-red-600 text-sm font-medium">
          {error}
          {error.includes('kedaluwarsa') && (
            <Link href="/auth/forgot-password" className="block mt-1 font-bold underline">Minta link baru</Link>
          )}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Input
            label="Password baru"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Minimal 8 karakter"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="py-3 pr-12"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
            className="absolute right-4 bottom-3 text-slate-400 hover:text-indigo-600 transition-colors"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <Input
          label="Ulangi password baru"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="Ketik ulang password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="py-3"
        />
        <Button type="submit" className="w-full py-3.5 text-sm font-black rounded-control" isLoading={loading}>
          Simpan password baru
        </Button>
      </form>
    </AuthCard>
  );
}
