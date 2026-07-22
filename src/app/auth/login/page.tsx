"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { ShieldCheck, Smartphone, Eye, EyeOff, LayoutGrid } from 'lucide-react';
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

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const router = useRouter();

  // Tampilkan pesan error yang dikirim balik dari alur OAuth Google (?error=...).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get('error');
    if (oauthError) {
      setError(oauthError);
      window.history.replaceState({}, '', '/auth/login');
    }
  }, []);

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
        router.push(result.user?.role === 'admin' ? '/admin' : '/membership/dashboard');
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Gagal login. Periksa kembali email dan password Anda.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (enteredToken: string) => {
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

    router.push(result.user?.role === 'admin' ? '/admin' : '/membership/dashboard');
    return true;
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex font-sans selection:bg-indigo-100">
      {/* Left Side: Branding & Features */}
      <div className="hidden lg:flex flex-[1.1] flex-col p-10 bg-white relative overflow-hidden border-r border-slate-100 space-y-12">
        {/* Logo */}
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3 group">
            <Image src="/images/Logo-new.png" alt="Logo" width={32} height={32} />
            <span className="font-serif font-black text-2xl tracking-tight text-slate-900">Leosiqra</span>
          </Link>
        </div>

        {/* Hero Text */}
        <div className="relative z-10 max-w-lg space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-widest w-fit">
            Secure Fintech Access
          </div>
          <h1 className="text-4xl xl:text-5xl font-serif font-black text-slate-900 leading-[1.1]">
            Masuk dengan <span className="text-gradient">aman</span> ke <br /> dashboard finansial pribadi <br /> Anda.
          </h1>
          <p className="text-slate-500 font-medium leading-relaxed text-sm max-w-xs">
            Akses member Leosiqra dirancang ringkas, terlindungi 2FA, dan fokus pada satu hal: membawa Anda ke dashboard tanpa kebingungan.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="relative z-10 grid grid-cols-3 gap-3">
          {[
            { icon: ShieldCheck, title: '2FA Ready', desc: 'Akses tetap berlapis.' },
            { icon: LayoutGrid, title: 'Private', desc: 'Data tetap aman.' },
            { icon: Smartphone, title: 'Trusted', desc: 'Device dipercaya.' },
          ].map((card, i) => (
            <div key={i} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 group hover:bg-white hover:shadow-md transition-all">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
                <card.icon size={14} />
              </div>
              <div className="space-y-0.5">
                <h4 className="font-black text-slate-900 text-[11px] uppercase tracking-tighter">{card.title}</h4>
                <p className="text-[10px] text-slate-400 font-medium leading-tight">{card.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Background Decor */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-50/50 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
      </div>

      {/* Right Side: Login Card */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-gradient-to-br from-slate-50 to-indigo-50/40 relative overflow-hidden">
        <div className="hero-aurora" aria-hidden />
        <div className="w-full max-w-[460px] bg-white/90 backdrop-blur-xl p-10 lg:p-11 rounded-[40px] shadow-[0_30px_70px_-20px_rgba(79,70,229,0.18)] border border-white ring-1 ring-slate-100 relative z-10 space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest leading-none">
              Encrypted Access
            </div>
            <h2 className="text-2xl font-serif font-black text-slate-900 leading-tight">Selamat datang kembali</h2>
            <p className="text-slate-500 font-medium text-xs">Masuk untuk melanjutkan review arus kas, target, dan investasi Anda.</p>
          </div>

          {error && (
            <div className="py-2.5 px-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-[11px] font-bold text-center">
              {error}
            </div>
          )}

          {/* Social Login - Google */}
          <a
            href="/api/auth/google"
            className="flex items-center justify-center gap-3 w-full py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm transition-all active:scale-[0.99]"
          >
            <GoogleIcon size={18} />
            Lanjutkan dengan Google
          </a>

          <div className="relative flex items-center">
            <div className="flex-grow border-t border-slate-100"></div>
            <span className="flex-shrink mx-4 text-[8px] font-black text-slate-300 uppercase tracking-[0.2em]">Atau email/username</span>
            <div className="flex-grow border-t border-slate-100"></div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="Email atau Username"
              placeholder="contoh@gmail.com atau username"
              type="text"
              autoCapitalize="none"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="py-3"
            />
            <div className="relative">
              <Input 
                label="Password" 
                placeholder="Masukkan sandi Anda"
                type={showPassword ? "text" : "password"} 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="py-3"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 bottom-3 text-slate-300 hover:text-indigo-600 transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div className="flex items-center justify-between px-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" className="w-3.5 h-3.5 rounded-md border-slate-200 text-indigo-600 focus:ring-indigo-500/20" />
                <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-600 transition-colors">Percayai browser</span>
              </label>
              <Link href="#" className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700">Lupa password?</Link>
            </div>

            <Button type="submit" className="w-full py-3.5 text-xs font-black rounded-xl shadow-lg shadow-indigo-600/10" isLoading={loading}>
              Login
            </Button>
          </form>

          {/* Footer Card */}
          <div className="space-y-4">
            <div className="text-center text-[11px] font-medium text-slate-400">
              Belum punya akun?{' '}
              <Link href="/auth/register" className="text-indigo-600 font-bold hover:underline">Daftar</Link>
            </div>

            <div className="pt-4 border-t border-slate-50">
              <p className="text-[8px] text-slate-300 text-center leading-normal">
                Dilindungi password terenkripsi, cookie aman, dan verifikasi Authenticator saat dibutuhkan.
              </p>
            </div>
          </div>
        </div>

        {/* Subtle background graphics */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500/5 via-transparent to-transparent pointer-events-none" />
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
