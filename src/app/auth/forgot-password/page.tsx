"use client";

import { useState } from 'react';
import Link from 'next/link';
import { MailCheck, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { AuthCard } from '@/components/auth/AuthCard';
import { cloudflareApi } from '@/lib/cloudflare-api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sentMessage, setSentMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await cloudflareApi<{ ok: boolean; message?: string }>('/api/auth/password/forgot', {
        method: 'POST',
        json: { email: email.trim().toLowerCase() },
      });
      setSentMessage(result.message ?? 'Kalau email tersebut terdaftar, link reset password sudah kami kirim.');
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Gagal mengirim permintaan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  if (sentMessage) {
    return (
      <AuthCard badge="Cek email kamu" title="Link reset terkirim" subtitle={sentMessage}>
        <div className="flex items-start gap-3 p-4 rounded-control bg-emerald-50 border border-emerald-100">
          <MailCheck size={20} className="text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-800">
            Link berlaku 30 menit dan hanya bisa dipakai sekali. Tidak masuk? Tunggu sekitar 2 menit, lalu coba kirim ulang.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button type="button" variant="secondary" className="w-full py-3 rounded-control" onClick={() => setSentMessage('')}>
            Kirim ulang
          </Button>
          <Link href="/auth/login" className="text-center text-sm font-bold text-indigo-600 hover:text-indigo-700 py-2">
            Kembali ke login
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      badge="Lupa password"
      title="Atur ulang password"
      subtitle="Masukkan email akunmu. Kami kirim link untuk membuat password baru."
    >
      {error && (
        <div role="alert" className="py-2.5 px-4 rounded-control bg-red-50 border border-red-100 text-red-600 text-sm font-medium">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          placeholder="contoh@gmail.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="py-3"
        />
        <Button type="submit" className="w-full py-3.5 text-sm font-black rounded-control" isLoading={loading}>
          Kirim link reset
        </Button>
      </form>
      <p className="text-caption text-slate-400">
        Daftar pakai Google? Kamu tidak butuh password — cukup masuk dengan tombol &quot;Lanjutkan dengan Google&quot;.
      </p>
      <Link href="/auth/login" className="flex items-center justify-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-800">
        <ArrowLeft size={14} /> Kembali ke login
      </Link>
    </AuthCard>
  );
}
