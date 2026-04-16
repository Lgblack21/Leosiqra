"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { ShieldCheck, Lock, Smartphone, Eye, EyeOff, LayoutGrid, ArrowLeft } from 'lucide-react';
import { TwoFactorModal } from '@/components/auth/TwoFactorModal';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [strength, setStrength] = useState({ label: 'Lemah', color: 'bg-red-500', width: 'w-1/3' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const hasUpperCaseStart = /^[A-Z]/.test(password);
    const hasMinLength = password.length >= 6;
    const hasSymbol = /[!@#$%^&*(),.?":{}|<>;]/.test(password);
    const hasNumber = /\d/.test(password);

    const metCriteria = [hasUpperCaseStart, hasMinLength, hasSymbol, hasNumber].filter(Boolean).length;

    if (password.length === 0) {
      setStrength({ label: 'Lemah', color: 'bg-slate-200', width: 'w-0' });
    } else if (hasUpperCaseStart && hasMinLength && hasSymbol && hasNumber) {
      setStrength({ label: 'Kuat', color: 'bg-emerald-500', width: 'w-full' });
    } else if (metCriteria >= 3) {
      setStrength({ label: 'Sedang', color: 'bg-orange-500', width: 'w-2/3' });
    } else {
      setStrength({ label: 'Lemah', color: 'bg-red-500', width: 'w-1/3' });
    }
  }, [password]);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }
    
    // Tampilkan modal 2FA Setup
    setShow2FA(true);
  };

  const handleCompleteRegistration = async (twoFactorSecret: string) => {
    setLoading(true);
    setError('');

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: name });

      await setDoc(doc(db, 'users', user.uid), {
        name,
        email,
        whatsapp,
        createdAt: new Date().toISOString(),
        role: 'user',
        plan: 'FREE',
        status: 'GUEST',
        balance: 0,
        totalWealth: 0,
        totalIncome: 0,
        totalExpenses: 0,
        totalSavings: 0,
        totalInvestment: 0,
        creditCardBills: 0,
        otherDebts: 0,
        twoFactorSecret: twoFactorSecret // Simpan secret 2FA
      });

      router.push('/membership/dashboard');
    } catch (err: any) {
      setError('Gagal mendaftar. Silakan periksa kembali data Anda.');
      setShow2FA(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex font-sans selection:bg-indigo-100">
      {/* Left Side: Branding & Features (Same as Login) */}
      <div className="hidden lg:flex flex-[1.1] flex-col p-10 bg-white relative overflow-hidden border-r border-slate-100 space-y-12">
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3 group">
            <Image src="/images/Logo-new.png" alt="Logo" width={32} height={32} />
            <span className="font-serif font-black text-2xl tracking-tight text-slate-900">Leosiqra</span>
          </Link>
        </div>

        <div className="relative z-10 max-w-lg space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-widest w-fit">
            Secure Fintech Access
          </div>
          <h1 className="text-4xl xl:text-5xl font-serif font-black text-slate-900 leading-[1.1]">
            Daftar sekarang. Mulai <br /> kelola aset finansial Anda <br /> dengan tenang.
          </h1>
          <p className="text-slate-500 font-medium leading-relaxed text-sm max-w-xs">
            Akses member Leosiqra dirancang ringkas, terlindungi 2FA, dan fokus pada satu hal: membawa Anda ke dashboard tanpa kebingungan.
          </p>
        </div>

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

        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-50/50 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
      </div>

      {/* Right Side: Register Card */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10 bg-slate-50/50 relative overflow-hidden overflow-y-auto">
        <div className="w-full max-w-[480px] bg-white p-10 lg:p-11 rounded-[40px] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.05)] border border-slate-100 relative z-10 space-y-6 my-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest leading-none">
              Encrypted Access
            </div>
            
            <Link href="/auth/login" className="flex items-center gap-2 text-[11px] font-black text-indigo-600 uppercase tracking-widest hover:translate-x-[-4px] transition-transform w-fit">
              <ArrowLeft size={14} /> Kembali ke login
            </Link>

            <div className="space-y-1">
              <h2 className="text-2xl font-serif font-black text-slate-900 leading-tight">Buat akun Leosiqra</h2>
              <p className="text-slate-500 font-medium text-xs">Daftar gratis dan aktifkan 2FA untuk menjaga akses dashboard.</p>
            </div>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <Input 
              label="Nama Lengkap" 
              placeholder="Masukkan nama lengkap Anda" 
              type="text" 
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="py-3"
            />
            <Input 
              label="Email" 
              placeholder="contoh@gmail.com" 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="py-3"
            />
            <Input 
              label="Nomor WhatsApp" 
              placeholder="0812xxxxxx" 
              type="tel" 
              required
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="py-3"
            />
            
            <div className="space-y-2">
              <div className="relative">
                <Input 
                  label="Password" 
                  placeholder="Minimum 6 karakter" 
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
              
              {/* Password Strength Indicator */}
              <div className="px-1 space-y-1.5">
                <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full transition-all duration-500 ${strength.width} ${strength.color}`} />
                </div>
                <p className="text-[10px] font-bold text-slate-400">
                  Kekuatan password: <span className="text-slate-900 uppercase">{strength.label}</span>
                </p>
              </div>
            </div>

            <div className="relative">
              <Input 
                label="Konfirmasi Password" 
                placeholder="Ulangi password Anda" 
                type={showConfirmPassword ? "text" : "password"} 
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="py-3"
              />
              <button 
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 bottom-3 text-slate-300 hover:text-indigo-600 transition-colors"
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <Button type="submit" className="w-full py-4 text-sm font-black rounded-xl shadow-lg shadow-indigo-600/10" isLoading={loading}>
              Lanjut Daftar
            </Button>
          </form>

          {error && (
            <div className="text-center py-2 px-4 rounded-lg bg-red-50 text-red-600 text-[10px] font-bold">
              {error}
            </div>
          )}

          <div className="pt-4 border-t border-slate-50">
            <p className="text-[9px] text-slate-300 text-center leading-normal">
              Dilindungi password terenkripsi, session cookie aman, dan verifikasi Authenticator saat dibutuhkan.
            </p>
          </div>
        </div>

        {/* Subtle background graphics */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500/5 via-transparent to-transparent pointer-events-none" />
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
