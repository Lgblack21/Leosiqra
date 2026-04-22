"use client";

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { ShieldCheck, Smartphone, Eye, EyeOff, LayoutGrid } from 'lucide-react';
import { TwoFactorModal } from '@/components/auth/TwoFactorModal';
import { cloudflareApi } from '@/lib/cloudflare-api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const router = useRouter();

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
            Masuk dengan aman ke <br /> dashboard finansial pribadi <br /> Anda.
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
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-slate-50/50 relative overflow-hidden">
        <div className="w-full max-w-[460px] bg-white p-10 lg:p-11 rounded-[40px] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.05)] border border-slate-100 relative z-10 space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest leading-none">
              Encrypted Access
            </div>
            <h2 className="text-2xl font-serif font-black text-slate-900 leading-tight">Selamat datang kembali</h2>
            <p className="text-slate-500 font-medium text-xs">Masuk untuk melanjutkan review arus kas, target, dan investasi Anda.</p>
          </div>

          {/* Social Logins */}
          <div className="grid grid-cols-2 gap-3">
            <button className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-slate-100 bg-white text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-all">
              <span className="w-4 h-4 flex items-center justify-center bg-[#EA4335] rounded-full text-[8px] text-white font-black">G</span>
              Google
            </button>
            <button className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-slate-100 bg-white text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-all">
              <span className="w-4 h-4 flex items-center justify-center bg-[#1877F2] rounded-full text-[8px] text-white font-black italic">f</span>
              Facebook
            </button>
          </div>

          <div className="relative flex items-center">
            <div className="flex-grow border-t border-slate-100"></div>
            <span className="flex-shrink mx-4 text-[8px] font-black text-slate-200 uppercase tracking-[0.2em]">Atau email</span>
            <div className="flex-grow border-t border-slate-100"></div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <Input 
              label="Email" 
              placeholder="contoh@gmail.com" 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="py-3"
            />
            <div className="relative">
              <Input 
                label="Password" 
                placeholder="••••••••••••••••" 
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

            {error && (
              <div className="text-center py-2 px-4 rounded-lg bg-red-50 text-red-600 text-[10px] font-bold">
                {error}
              </div>
            )}

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
