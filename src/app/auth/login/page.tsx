"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, ArrowRight, Check, AlertCircle } from 'lucide-react';
import { AuthLayout, GoogleIcon, authInput, authInputWrap, authLabel, authPrimaryBtn } from '@/components/auth/AuthLayout';
import type { LeoMood } from '@/components/mascot/LeoMascot';
import { TwoFactorModal } from '@/components/auth/TwoFactorModal';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { isStandaloneDisplay } from '@/lib/pushNotifications';
import { resolveNext, withNext } from '@/lib/authNext';
import { googleAuthHref, readSignupSource, type SignupSource } from '@/lib/signupSource';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const [next, setNext] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // Login Google untuk akun ber-2FA: server meminta kode Authenticator dulu.
  const [google2fa, setGoogle2fa] = useState(false);
  // Sumber kunjungan (UTM/referrer) — ikut ke login Google karena akun baru bisa terdaftar dari sini.
  const [signupSource, setSignupSource] = useState<SignupSource | null>(null);
  const router = useRouter();
  const reduce = useReducedMotion();
  const card = useAnimationControls();
  // Leo bereaksi: memperhatikan saat email diketik, menutup mata saat
  // password diketik (mengintip kalau password ditampilkan), sedih saat
  // gagal, melompat saat berhasil.
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);
  const [sadUntil, setSadUntil] = useState(0);
  const [, setTick] = useState(0);
  const leoMood: LeoMood = done
    ? 'happy'
    : Date.now() < sadUntil
      ? 'sad'
      : focused === 'password'
        ? (showPassword ? 'peek' : 'hide')
        : focused === 'email'
          ? 'watch'
          : 'idle';

  // Berhasil: tombol berubah jadi centang sebentar, lalu pindah halaman.
  const finish = (destination: string) => {
    setDone(true);
    setTimeout(() => router.push(destination), reduce ? 0 : 1100);
  };
  // Gagal: kartu bergoyang pelan supaya kesalahan langsung terasa.
  const shake = () => {
    setSadUntil(Date.now() + 2200);
    setTimeout(() => setTick((t) => t + 1), 2300);
    if (!reduce) void card.start({ x: [0, -10, 9, -6, 5, -2, 0], transition: { duration: 0.5 } });
  };

  // Tampilkan pesan error yang dikirim balik dari alur OAuth Google (?error=...),
  // dan simpan `?next=` (kalau ada) supaya user yang datang dari /app kembali
  // ke sana setelah login, bukan ke dashboard web.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google2fa') === '1') {
      setGoogle2fa(true);
      setShow2FA(true);
      window.history.replaceState({}, '', '/auth/login');
    }
    const oauthError = params.get('error');
    if (oauthError) {
      setError(oauthError);
      window.history.replaceState({}, '', '/auth/login');
    }
    // PWA terpasang tanpa ?next= → tetap ke UI mobile, bukan dashboard web.
    setNext(resolveNext(params.get('next')));
    setSignupSource(readSignupSource());
  }, []);

  // Admin tidak pernah diarahkan ke /app — tidak ada UI admin di sana.
  const resolveDestination = (role?: 'admin' | 'user') => {
    if (role === 'admin') return '/admin';
    return next ?? '/membership/dashboard';
  };

  const googleHref = googleAuthHref(next, signupSource);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await cloudflareApi<{
        needsTwoFactor?: boolean;
        user?: { role: 'admin' | 'user' };
      }>('/api/auth/login', {
        method: 'POST',
        json: {
          email: email.trim().toLowerCase(),
          password,
          // Sesi PWA ter-install dibuat permanen di backend (lihat handleLogin) —
          // tab browser biasa tetap pakai masa berlaku normal.
          isPwa: isStandaloneDisplay(),
        },
      });

      if (result.needsTwoFactor) {
        setShow2FA(true);
      } else {
        finish(resolveDestination(result.user?.role));
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Gagal login. Periksa kembali email dan password Anda.'
      );
      shake();
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (enteredToken: string) => {
    if (google2fa) {
      const result = await cloudflareApi<{ destination: string }>('/api/auth/google/2fa', {
        method: 'POST',
        json: { twoFactorToken: enteredToken, isPwa: isStandaloneDisplay() },
      });
      finish(result.destination);
      return true;
    }
    const result = await cloudflareApi<{
      user?: { role: 'admin' | 'user' };
    }>('/api/auth/login', {
      method: 'POST',
      json: {
        email: email.trim().toLowerCase(),
        password,
        twoFactorToken: enteredToken,
        isPwa: isStandaloneDisplay(),
      },
    });

    finish(resolveDestination(result.user?.role));
    return true;
  };

  return (
    <>
    <AuthLayout
      headline="Uangmu lebih tenang, bareng Leo."
      sub="Catat dalam hitungan detik, lihat ke mana uangmu pergi, dan biarkan AI Leosiqra yang merangkum semuanya."
      mood={leoMood}
      lookX={Math.min(1, email.length / 28)}
      footer="Dilindungi password terenkripsi, cookie aman, dan verifikasi 2 langkah bila diaktifkan."
    >
      <motion.div animate={card}>
        <h2 className="text-[26px] font-extrabold tracking-tight text-slate-900">Masuk</h2>
        <p className="mt-1 text-sm text-slate-500">
          Belum punya akun?{' '}
          <Link href={withNext('/auth/register', next)} className="font-bold text-indigo-600 hover:underline">Daftar gratis 14 hari</Link>
        </p>

        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-5 flex items-start gap-2 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-600"
            role="alert"
          >
            <AlertCircle size={16} className="mt-px shrink-0" /> {error}
          </motion.div>
        )}

        <a
          href={googleHref}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-3.5 text-[15px] font-bold text-slate-700 transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md active:scale-[0.99]"
        >
          <GoogleIcon size={19} />
          Lanjutkan dengan Google
        </a>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-100" />
          <span className="text-xs font-medium text-slate-400">atau pakai email</span>
          <span className="h-px flex-1 bg-slate-100" />
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <label className="block">
            <span className={authLabel}>Email atau username</span>
            <span className={authInputWrap}>
              <Mail size={18} className="shrink-0 text-slate-400 transition-colors group-focus-within:text-indigo-500" />
              <input
                type="text"
                autoCapitalize="none"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                placeholder="nama@email.com"
                className={authInput}
              />
            </span>
          </label>

          <label className="block">
            <span className="mb-1.5 flex items-center justify-between pl-1 text-[13px] font-semibold text-slate-600">
              Password
              <Link href="/auth/forgot-password" className="text-[13px] font-bold text-indigo-600 hover:text-indigo-700">Lupa password?</Link>
            </span>
            <span className={authInputWrap}>
              <Lock size={18} className="shrink-0 text-slate-400 transition-colors group-focus-within:text-indigo-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                placeholder="Masukkan password"
                className={authInput}
              />
              <button
                type="button"
                // Tetap fokus di kolom password saat tombol mata ditekan (Leo mengintip, bukan berhenti menutup mata).
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                className="shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:text-indigo-600"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>

          <div className="pt-1.5">
            <motion.button
              type="submit"
              disabled={loading || done}
              whileTap={{ scale: 0.98 }}
              className={done ? 'flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 text-[15px] font-bold text-white shadow-lg shadow-emerald-500/30' : authPrimaryBtn}
            >
              {done ? (
                <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-2">
                  <Check size={18} /> Berhasil masuk
                </motion.span>
              ) : loading ? (
                <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Memeriksa…</>
              ) : (
                <>Masuk <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" /></>
              )}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </AuthLayout>

      <TwoFactorModal
        isOpen={show2FA}
        onClose={() => setShow2FA(false)}
        mode="verify"
        email={email}
        secret=""
        onVerify={handleVerify2FA}
      />
    </>
  );
}
