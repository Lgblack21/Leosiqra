'use client';

import { useEffect, useState } from 'react';
import { looksLikeStaffUsername, staffService } from '@/lib/services/staffService';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { TwoFactorModal } from '@/components/auth/TwoFactorModal';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { isNativeApp } from '@/lib/pwaInstall';
import { isStandaloneDisplay } from '@/lib/pushNotifications';
import { sanitizeNext, withNext } from '@/lib/authNext';

// Halaman masuk aplikasi HP/tablet (Capacitor): sederhana seperti aplikasi lain —
// logo, email, sandi, tombol Masuk, tautan kecil Lupa sandi & Daftar. Web tetap
// memakai /auth/login (dengan panel Leo & Google). Logika login sama persis
// (POST /api/auth/login, 2FA lewat TwoFactorModal).
export default function AppLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [show2FA, setShow2FA] = useState(false);
  const [next, setNext] = useState('/app');

  useEffect(() => {
    if (Capacitor.isNativePlatform()) void SplashScreen.hide();
    setNext(sanitizeNext(new URLSearchParams(window.location.search).get('next')) ?? '/app');
    // Sudah masuk (mis. tombol back) → langsung ke aplikasi.
    cloudflareApi<{ user?: { id?: string } | null }>('/api/auth/me')
      .then((r) => {
        if (r.user?.id) router.replace('/app');
      })
      .catch(() => undefined);
  }, [router]);

  const go = (role?: string) => router.replace(role === 'admin' ? '/admin' : next);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      // Username "toko-nama" = akun tim Usahaku → login tim & ke /tim.
      if (looksLikeStaffUsername(email)) {
        await staffService.login(email, password);
        router.replace('/tim');
        return;
      }
      const r = await cloudflareApi<{ needsTwoFactor?: boolean; user?: { role?: string } }>('/api/auth/login', {
        method: 'POST',
        json: { email: email.trim().toLowerCase(), password, isPwa: isStandaloneDisplay() || isNativeApp() },
      });
      if (r.needsTwoFactor) setShow2FA(true);
      else go(r.user?.role);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Gagal masuk. Periksa email dan sandi.');
    } finally {
      setLoading(false);
    }
  };

  const verify2FA = async (token: string) => {
    const r = await cloudflareApi<{ user?: { role?: string } }>('/api/auth/login', {
      method: 'POST',
      json: {
        email: email.trim().toLowerCase(),
        password,
        twoFactorToken: token,
        isPwa: isStandaloneDisplay() || isNativeApp(),
      },
    });
    go(r.user?.role);
    return true;
  };

  const field =
    'flex items-center gap-3 rounded-2xl bg-slate-100 px-4 ring-2 ring-transparent transition-shadow focus-within:bg-white focus-within:ring-indigo-500';
  const input =
    'min-w-0 flex-1 bg-transparent py-4 fs-15 font-semibold text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-400';

  return (
    <main className="flex min-h-[100dvh] flex-col bg-white px-6 pt-[calc(env(safe-area-inset-top)+48px)] pb-[calc(env(safe-area-inset-bottom)+24px)]">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
        <div className="flex flex-col items-center text-center">
          <Image
            src="/images/Logo-new.png"
            alt="Leosiqra"
            width={72}
            height={72}
            priority
            className="rounded-[22px] shadow-lg shadow-indigo-200/60"
          />
          <h1 className="mt-6 fsh-26 font-extrabold tracking-tight text-slate-900">Masuk ke Leosiqra</h1>
          <p className="mt-1.5 fs-14 font-medium text-slate-500">Catat uangmu, lanjut dari mana saja.</p>
        </div>

        <form onSubmit={submit} className="mt-10 space-y-3">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-2xl bg-rose-50 px-4 py-3 fs-13 font-semibold text-rose-600"
            >
              <AlertCircle size={16} className="mt-px shrink-0" /> {error}
            </div>
          )}
          <label className={field}>
            <Mail size={18} className="shrink-0 text-slate-400" />
            <input
              type="text"
              inputMode="email"
              autoCapitalize="none"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              aria-label="Email"
              className={input}
            />
          </label>
          <label className={field}>
            <Lock size={18} className="shrink-0 text-slate-400" />
            <input
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sandi"
              aria-label="Sandi"
              className={input}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
              className="shrink-0 p-1 text-slate-400"
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </label>
          <div className="flex justify-end">
            <Link href="/auth/forgot-password" className="py-1 fs-13 font-bold text-indigo-600">
              Lupa sandi?
            </Link>
          </div>
          <button
            type="submit"
            disabled={loading || !email.trim() || !password}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 fs-16 font-extrabold text-white shadow-lg shadow-indigo-200 transition-all active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : 'Masuk'}
          </button>
        </form>

        <p className="mt-auto pt-10 text-center fs-14 font-medium text-slate-500">
          Belum punya akun?{' '}
          <Link href={withNext('/auth/register', next)} className="font-extrabold text-indigo-600">
            Daftar
          </Link>
        </p>
      </div>

      <TwoFactorModal
        isOpen={show2FA}
        onClose={() => setShow2FA(false)}
        mode="verify"
        email={email}
        secret=""
        onVerify={verify2FA}
      />
    </main>
  );
}
