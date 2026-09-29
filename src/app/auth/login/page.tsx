"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, ArrowRight, Check, AlertCircle } from 'lucide-react';
import { AuthShowcase } from '@/components/auth/AuthShowcase';
import { TwoFactorModal } from '@/components/auth/TwoFactorModal';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { isStandaloneDisplay } from '@/lib/pushNotifications';

const GoogleIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

// Cuma terima redirect target ke tree /app atau /input-cepat — mencegah open
// redirect kalau parameter `next` diisi sembarangan (mis. URL eksternal).
const sanitizeNext = (value: string | null): string | null =>
  value && /^\/(app|input-cepat)(\/|\?|$)/.test(value) ? value : null;

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
  const router = useRouter();
  const reduce = useReducedMotion();
  const card = useAnimationControls();

  // Berhasil: tombol berubah jadi centang sebentar, lalu pindah halaman.
  const finish = (destination: string) => {
    setDone(true);
    setTimeout(() => router.push(destination), reduce ? 0 : 450);
  };
  // Gagal: kartu bergoyang pelan supaya kesalahan langsung terasa.
  const shake = () => {
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
    setNext(sanitizeNext(params.get('next')) ?? (isStandaloneDisplay() ? '/app' : null));
  }, []);

  // Admin tidak pernah diarahkan ke /app — tidak ada UI admin di sana.
  const resolveDestination = (role?: 'admin' | 'user') => {
    if (role === 'admin') return '/admin';
    return next ?? '/membership/dashboard';
  };

  const googleHref = next ? `/api/auth/google?next=${encodeURIComponent(next)}` : '/api/auth/google';

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

  const item = (k: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay: 0.1 + k * 0.07, ease: [0.16, 1, 0.3, 1] as const },
        };

  return (
    <div className="min-h-screen bg-[#f7f8fb] flex font-sans selection:bg-indigo-100">
      <AuthShowcase
        title={<>Selamat datang <span className="italic text-indigo-200">kembali.</span></>}
        subtitle="Masuk untuk melihat saldo, tagihan, tabungan, dan investasi Anda — semuanya ter-update sejak terakhir Anda buka."
      />

      {/* Form */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-5 sm:p-10">
        <div className="hero-aurora" aria-hidden />
        <div className="dot-grid" aria-hidden />

        <motion.div animate={card} className="relative z-10 w-full max-w-[430px]">
          {/* Logo (HP; di desktop logo ada di panel kiri) */}
          <motion.div {...item(0)} className="mb-8 flex justify-center lg:hidden">
            <Link href="/" className="flex items-center gap-3">
              <Image src="/images/Logo-new.png" alt="Leosiqra" width={34} height={34} />
              <span className="font-serif text-2xl font-black tracking-tight text-slate-900">Leosiqra</span>
            </Link>
          </motion.div>

          <div className="lp-card rounded-[32px] p-7 sm:p-10">
            <motion.div {...item(1)}>
              <h2 className="font-serif text-3xl leading-tight text-slate-900">Masuk</h2>
              <p className="mt-1.5 text-sm text-slate-500">
                Belum punya akun?{' '}
                <Link href="/auth/register" className="font-bold text-indigo-600 hover:underline">Daftar gratis 14 hari</Link>
              </p>
            </motion.div>

            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-5 flex items-start gap-2 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-600"
                role="alert"
              >
                <AlertCircle size={15} className="mt-px shrink-0" /> {error}
              </motion.div>
            )}

            <motion.a
              {...item(2)}
              href={googleHref}
              className="mt-7 flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-3.5 text-sm font-bold text-slate-700 transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md active:scale-[0.99]"
            >
              <GoogleIcon size={18} />
              Lanjutkan dengan Google
            </motion.a>

            <motion.div {...item(3)} className="my-6 flex items-center gap-4">
              <span className="h-px flex-1 bg-slate-100" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">atau pakai email</span>
              <span className="h-px flex-1 bg-slate-100" />
            </motion.div>

            <form onSubmit={handleLogin} className="space-y-4">
              <motion.label {...item(4)} className="block">
                <span className="mb-1.5 block pl-1 text-[11px] font-bold text-slate-500">Email atau username</span>
                <span className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 transition-all focus-within:border-indigo-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-500/10">
                  <Mail size={17} className="shrink-0 text-slate-400 transition-colors group-focus-within:text-indigo-500" />
                  <input
                    type="text"
                    autoCapitalize="none"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    className="w-full bg-transparent py-3.5 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
                  />
                </span>
              </motion.label>

              <motion.label {...item(5)} className="block">
                <span className="mb-1.5 flex items-center justify-between pl-1 text-[11px] font-bold text-slate-500">
                  Password
                  <Link href="/auth/forgot-password" className="font-bold text-indigo-600 hover:text-indigo-700">Lupa password?</Link>
                </span>
                <span className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 transition-all focus-within:border-indigo-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-500/10">
                  <Lock size={17} className="shrink-0 text-slate-400 transition-colors group-focus-within:text-indigo-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password"
                    className="w-full bg-transparent py-3.5 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    className="shrink-0 text-slate-400 transition-colors hover:text-indigo-600"
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </motion.label>

              <motion.div {...item(6)} className="pt-2">
                <motion.button
                  type="submit"
                  disabled={loading || done}
                  whileTap={{ scale: 0.98 }}
                  className={`group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl py-4 text-sm font-bold text-white transition-colors duration-300 ${done ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30' : 'lp-btn'} disabled:cursor-not-allowed`}
                >
                  {done ? (
                    <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-2">
                      <Check size={18} /> Berhasil masuk
                    </motion.span>
                  ) : loading ? (
                    <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Memeriksa…</>
                  ) : (
                    <>Masuk <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" /></>
                  )}
                </motion.button>
              </motion.div>
            </form>
          </div>

          <motion.p {...item(7)} className="mt-6 text-center text-xs text-slate-400">
            Dilindungi password terenkripsi, cookie aman, dan verifikasi Authenticator bila diaktifkan.
          </motion.p>
        </motion.div>
      </div>

      <TwoFactorModal
        isOpen={show2FA}
        onClose={() => setShow2FA(false)}
        mode="verify"
        email={email}
        secret=""
        onVerify={handleVerify2FA}
      />
    </div>
  );
}
