"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowRight, Check, AlertCircle } from 'lucide-react';
import { AuthShowcase } from '@/components/auth/AuthShowcase';
import { TwoFactorModal } from '@/components/auth/TwoFactorModal';
import { cloudflareApi } from '@/lib/cloudflare-api';

const GoogleIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const [next, setNext] = useState<string | null>(null);
  const router = useRouter();

  // Tampilkan pesan error dari alur OAuth Google (?error=...), dan simpan
  // `?next=` (kalau ada dan mengarah ke /app) supaya user yang daftar dari
  // /app kembali ke sana, bukan ke dashboard web — mirror dari auth/login.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get('error');
    if (oauthError) {
      setError(oauthError);
      window.history.replaceState({}, '', '/auth/register');
    }
    const rawNext = params.get('next');
    setNext(rawNext && rawNext.startsWith('/app') ? rawNext : null);
  }, []);

  const googleHref = next ? `/api/auth/google?next=${encodeURIComponent(next)}` : '/api/auth/google';

  const reduce = useReducedMotion();
  const card = useAnimationControls();
  const shake = () => {
    if (!reduce) void card.start({ x: [0, -10, 9, -6, 5, -2, 0], transition: { duration: 0.5 } });
  };

  // Syarat password — minimal 8 karakter wajib (sama dengan server); sisanya
  // menaikkan kekuatan.
  const checks = [
    { label: 'Min. 8 karakter', ok: password.length >= 8 },
    { label: 'Huruf besar', ok: /[A-Z]/.test(password) },
    { label: 'Angka', ok: /\d/.test(password) },
    { label: 'Simbol', ok: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = checks.filter((c) => c.ok).length;
  const strength = password.length === 0
    ? { label: '', color: 'bg-slate-200', text: 'text-slate-400' }
    : score <= 1 ? { label: 'Lemah', color: 'bg-rose-500', text: 'text-rose-500' }
    : score <= 3 ? { label: 'Sedang', color: 'bg-amber-500', text: 'text-amber-600' }
    : { label: 'Kuat', color: 'bg-emerald-500', text: 'text-emerald-600' };
  const confirmState = confirmPassword.length === 0 ? null : confirmPassword === password;

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password minimal 8 karakter.');
      shake();
      return;
    }
    if (password !== confirmPassword) {
      setError('Konfirmasi password tidak cocok.');
      shake();
      return;
    }
    setError('');
    
    // Tampilkan modal 2FA Setup
    setShow2FA(true);
  };

  const handleCompleteRegistration = async (twoFactorSecret: string) => {
    setLoading(true);
    setError('');

    try {
      await cloudflareApi('/api/auth/register', {
        method: 'POST',
        json: {
        name,
          email: email.trim().toLowerCase(),
        whatsapp,
          password,
          twoFactorSecret,
        },
      });

      router.push(next ?? '/membership/dashboard');
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Gagal mendaftar. Silakan periksa kembali data Anda.'
      );
      setShow2FA(false);
      shake();
    } finally {
      setLoading(false);
    }
  };

  const item = (k: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay: 0.1 + k * 0.06, ease: [0.16, 1, 0.3, 1] as const },
        };

  return (
    <div className="min-h-screen bg-[#f7f8fb] flex font-sans selection:bg-indigo-100">
      <AuthShowcase
        title={<>Mulai kelola uang dengan <span className="italic text-indigo-200">tenang.</span></>}
        subtitle="Gratis 14 hari, tanpa kartu kredit. Catat rekening, kartu, tabungan, dan investasi — Leosiqra yang merangkumnya."
      />

      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-5 sm:p-10">
        <div className="hero-aurora" aria-hidden />
        <div className="dot-grid" aria-hidden />

        <motion.div animate={card} className="relative z-10 my-6 w-full max-w-[460px]">
          <motion.div {...item(0)} className="mb-8 flex justify-center lg:hidden">
            <Link href="/" className="flex items-center gap-3">
              <Image src="/images/Logo-new.png" alt="Leosiqra" width={34} height={34} />
              <span className="font-serif text-2xl font-black tracking-tight text-slate-900">Leosiqra</span>
            </Link>
          </motion.div>

          <div className="lp-card rounded-[32px] p-7 sm:p-10">
            <motion.div {...item(1)}>
              <h2 className="font-serif text-3xl leading-tight text-slate-900">Buat akun</h2>
              <p className="mt-1.5 text-sm text-slate-500">
                Sudah punya akun?{' '}
                <Link href="/auth/login" className="font-bold text-indigo-600 hover:underline">Masuk</Link>
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
              Daftar dengan Google
            </motion.a>

            <motion.div {...item(3)} className="my-6 flex items-center gap-4">
              <span className="h-px flex-1 bg-slate-100" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">atau pakai email</span>
              <span className="h-px flex-1 bg-slate-100" />
            </motion.div>

            <form onSubmit={handleRegister} className="space-y-4">
              <motion.label {...item(4)} className="block">
                <span className="mb-1.5 block pl-1 text-[11px] font-bold text-slate-500">Nama lengkap</span>
                <span className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 transition-all focus-within:border-indigo-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-500/10">
                  <User size={17} className="shrink-0 text-slate-400 transition-colors group-focus-within:text-indigo-500" />
                  <input type="text" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama Anda" className="w-full bg-transparent py-3.5 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400" />
                </span>
              </motion.label>
              <motion.label {...item(5)} className="block">
                <span className="mb-1.5 block pl-1 text-[11px] font-bold text-slate-500">Email</span>
                <span className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 transition-all focus-within:border-indigo-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-500/10">
                  <Mail size={17} className="shrink-0 text-slate-400 transition-colors group-focus-within:text-indigo-500" />
                  <input type="email" autoComplete="email" autoCapitalize="none" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" className="w-full bg-transparent py-3.5 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400" />
                </span>
              </motion.label>
              <motion.label {...item(6)} className="block">
                <span className="mb-1.5 block pl-1 text-[11px] font-bold text-slate-500">Nomor WhatsApp</span>
                <span className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 transition-all focus-within:border-indigo-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-500/10">
                  <Phone size={17} className="shrink-0 text-slate-400 transition-colors group-focus-within:text-indigo-500" />
                  <input type="tel" autoComplete="tel" required value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="0812xxxxxxxx" className="w-full bg-transparent py-3.5 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400" />
                </span>
              </motion.label>

              <motion.div {...item(7)}>
                <label className="block">
                  <span className="mb-1.5 flex items-center justify-between pl-1 text-[11px] font-bold text-slate-500">
                    Password
                    {strength.label && <span className={`font-black ${strength.text}`}>{strength.label}</span>}
                  </span>
                  <span className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 transition-all focus-within:border-indigo-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-500/10">
                    <Lock size={17} className="shrink-0 text-slate-400 transition-colors group-focus-within:text-indigo-500" />
                    <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" required value={password} onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }} placeholder="Minimal 8 karakter" className="w-full bg-transparent py-3.5 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'} className="shrink-0 text-slate-400 transition-colors hover:text-indigo-600">
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </span>
                </label>
                {/* Meter kekuatan 4 segmen + syarat yang tercentang */}
                <div className="mt-2.5 grid grid-cols-4 gap-1.5 px-1">
                  {[0, 1, 2, 3].map((k) => (
                    <span key={k} className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <motion.span className={`block h-full rounded-full ${strength.color}`} initial={false} animate={{ width: k < score ? '100%' : '0%' }} transition={{ duration: 0.35, delay: k * 0.05 }} />
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 px-1">
                  {checks.map((c) => (
                    <span key={c.label} className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition-colors duration-300 ${c.ok ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                      <motion.span initial={false} animate={{ scale: c.ok ? 1 : 0.6, opacity: c.ok ? 1 : 0.5 }} className="flex"><Check size={11} /></motion.span>
                      {c.label}
                    </span>
                  ))}
                </div>
              </motion.div>

              <motion.label {...item(8)} className="block">
                <span className="mb-1.5 flex items-center justify-between pl-1 text-[11px] font-bold text-slate-500">
                  Konfirmasi password
                  {confirmState !== null && (
                    <span className={confirmState ? 'font-black text-emerald-600' : 'font-black text-rose-500'}>{confirmState ? 'Cocok' : 'Belum cocok'}</span>
                  )}
                </span>
                <span className={`group flex items-center gap-3 rounded-2xl border bg-slate-50/70 px-4 transition-all focus-within:bg-white focus-within:ring-4 ${confirmState === false ? 'border-rose-300 focus-within:ring-rose-500/10' : confirmState ? 'border-emerald-300 focus-within:ring-emerald-500/10' : 'border-slate-200 focus-within:border-indigo-400 focus-within:ring-indigo-500/10'}`}>
                  <Lock size={17} className="shrink-0 text-slate-400" />
                  <input type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" required value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); if (error) setError(''); }} placeholder="Ulangi password" className="w-full bg-transparent py-3.5 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400" />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} aria-label={showConfirmPassword ? 'Sembunyikan password' : 'Tampilkan password'} className="shrink-0 text-slate-400 transition-colors hover:text-indigo-600">
                    {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </motion.label>

              <motion.div {...item(9)} className="pt-2">
                <motion.button
                  type="submit"
                  disabled={loading}
                  whileTap={{ scale: 0.98 }}
                  className="lp-btn group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl py-4 text-sm font-bold text-white disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Membuat akun…</>
                  ) : (
                    <>Lanjut: amankan akun <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" /></>
                  )}
                </motion.button>
                <p className="mt-3 text-center text-[11px] text-slate-400">Langkah berikutnya: sambungkan aplikasi Authenticator untuk verifikasi 2 langkah.</p>
              </motion.div>
            </form>
          </div>
        </motion.div>
      </div>

      <TwoFactorModal
        isOpen={show2FA}
        onClose={() => setShow2FA(false)}
        mode="setup"
        email={email}
        onVerify={handleCompleteRegistration}
      />
    </div>
  );
}
