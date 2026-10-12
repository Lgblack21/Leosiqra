"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowRight, Check, AlertCircle, Plus } from 'lucide-react';
import { AuthLayout, GoogleIcon, authInput, authInputWrap, authLabel, authPrimaryBtn } from '@/components/auth/AuthLayout';
import type { LeoMood } from '@/components/mascot/LeoMascot';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { googleAuthHref, readSignupSource, type SignupSource } from '@/lib/signupSource';

// Daftar dibuat seringan mungkin: nama, email, password. WhatsApp opsional
// (bisa diisi nanti di Profil) dan verifikasi 2 langkah tidak lagi dipaksa di
// sini — bisa diaktifkan dari Profil › Keamanan setelah masuk. Server memang
// sudah memperlakukan keduanya sebagai opsional.
export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [showWhatsapp, setShowWhatsapp] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [next, setNext] = useState<string | null>(null);
  const [signupSource, setSignupSource] = useState<SignupSource | null>(null);
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
    setSignupSource(readSignupSource());
  }, []);

  const googleHref = googleAuthHref(next, signupSource);

  const reduce = useReducedMotion();
  const card = useAnimationControls();
  const [focused, setFocused] = useState<'name' | 'email' | 'whatsapp' | 'password' | null>(null);
  const [sadUntil, setSadUntil] = useState(0);
  const [, setTick] = useState(0);
  const shake = () => {
    setSadUntil(Date.now() + 2200);
    setTimeout(() => setTick((t) => t + 1), 2300);
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

  const leoMood: LeoMood = done
    ? 'happy'
    : Date.now() < sadUntil
      ? 'sad'
      : focused === 'password'
        ? (showPassword ? 'peek' : 'hide')
        : focused
          ? 'watch'
          : 'idle';
  const typing = focused === 'name' ? name : focused === 'whatsapp' ? whatsapp : email;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password minimal 8 karakter.');
      shake();
      return;
    }
    setLoading(true);
    setError('');
    try {
      await cloudflareApi('/api/auth/register', {
        method: 'POST',
        json: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          whatsapp: whatsapp.trim() || undefined,
          password,
          source: signupSource,
        },
      });
      setDone(true);
      setTimeout(() => router.push(next ?? '/membership/dashboard'), reduce ? 0 : 1400);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Gagal mendaftar. Silakan periksa kembali data Anda.'
      );
      shake();
    } finally {
      setLoading(false);
    }
  };

  const firstName = name.trim().split(/\s+/)[0];

  return (
    <AuthLayout
      headline="Mulai rapikan keuanganmu hari ini."
      sub="Gratis 14 hari, tanpa kartu kredit. Catat rekening, kartu, tabungan, dan investasi — Leo dan AI Leosiqra yang merangkumnya."
      mood={leoMood}
      lookX={Math.min(1, typing.length / 28)}
      footer={<>Dengan mendaftar, kamu setuju dengan <Link href="/privacy" className="font-semibold text-slate-500 underline">Kebijakan Privasi</Link>.</>}
    >
      <motion.div animate={card}>
        <AnimatePresence mode="wait">
          {done ? (
            <motion.div key="ok" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="py-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-500"><Check size={28} /></div>
              <h2 className="mt-4 text-[24px] font-extrabold tracking-tight">Halo{firstName ? `, ${firstName}` : ''}! Akunmu siap.</h2>
              <p className="mt-1.5 text-sm text-slate-500">Leo antar kamu ke dashboard…</p>
            </motion.div>
          ) : (
            <motion.div key="form" exit={{ opacity: 0, y: -8 }}>
              <h2 className="text-[26px] font-extrabold tracking-tight text-slate-900">Buat akun</h2>
              <p className="mt-1 text-sm text-slate-500">
                Sudah punya akun?{' '}
                <Link href="/auth/login" className="font-bold text-indigo-600 hover:underline">Masuk</Link>
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
                Daftar dengan Google
              </a>

              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-slate-100" />
                <span className="text-xs font-medium text-slate-400">atau pakai email</span>
                <span className="h-px flex-1 bg-slate-100" />
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                <label className="block">
                  <span className={authLabel}>Nama panggilan</span>
                  <span className={authInputWrap}>
                    <User size={18} className="shrink-0 text-slate-400 transition-colors group-focus-within:text-indigo-500" />
                    <input type="text" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} onFocus={() => setFocused('name')} onBlur={() => setFocused(null)} placeholder="Mis. Leo" className={authInput} />
                  </span>
                </label>
                <label className="block">
                  <span className={authLabel}>Email</span>
                  <span className={authInputWrap}>
                    <Mail size={18} className="shrink-0 text-slate-400 transition-colors group-focus-within:text-indigo-500" />
                    <input type="email" autoComplete="email" autoCapitalize="none" required value={email} onChange={(e) => setEmail(e.target.value)} onFocus={() => setFocused('email')} onBlur={() => setFocused(null)} placeholder="nama@email.com" className={authInput} />
                  </span>
                </label>

                <div>
                  <label className="block">
                    <span className="mb-1.5 flex items-center justify-between pl-1 text-[13px] font-semibold text-slate-600">
                      Password
                      {strength.label && <span className={`font-bold ${strength.text}`}>{strength.label}</span>}
                    </span>
                    <span className={authInputWrap}>
                      <Lock size={18} className="shrink-0 text-slate-400 transition-colors group-focus-within:text-indigo-500" />
                      <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" required value={password} onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }} onFocus={() => setFocused('password')} onBlur={() => setFocused(null)} placeholder="Minimal 8 karakter" className={authInput} />
                      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'} className="shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:text-indigo-600">
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
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
                      <span key={c.label} className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors duration-300 ${c.ok ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                        <motion.span initial={false} animate={{ scale: c.ok ? 1 : 0.6, opacity: c.ok ? 1 : 0.5 }} className="flex"><Check size={11} /></motion.span>
                        {c.label}
                      </span>
                    ))}
                  </div>
                </div>

                {showWhatsapp ? (
                  <motion.label initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="block">
                    <span className={authLabel}>Nomor WhatsApp <span className="font-normal text-slate-400">(opsional)</span></span>
                    <span className={authInputWrap}>
                      <Phone size={18} className="shrink-0 text-slate-400 transition-colors group-focus-within:text-indigo-500" />
                      <input type="tel" autoComplete="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} onFocus={() => setFocused('whatsapp')} onBlur={() => setFocused(null)} placeholder="0812xxxxxxxx" className={authInput} autoFocus />
                    </span>
                  </motion.label>
                ) : (
                  <button type="button" onClick={() => setShowWhatsapp(true)} className="flex items-center gap-1.5 pl-1 text-[13px] font-semibold text-slate-500 transition-colors hover:text-indigo-600">
                    <Plus size={15} /> Tambah nomor WhatsApp <span className="font-normal text-slate-400">(opsional)</span>
                  </button>
                )}

                <div className="pt-1.5">
                  <motion.button type="submit" disabled={loading} whileTap={{ scale: 0.98 }} className={authPrimaryBtn}>
                    {loading ? (
                      <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Membuat akun…</>
                    ) : (
                      <>Buat akun gratis <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" /></>
                    )}
                  </motion.button>
                  <p className="mt-3 text-center text-xs text-slate-400">Verifikasi 2 langkah bisa diaktifkan kapan saja di Profil › Keamanan.</p>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AuthLayout>
  );
}
