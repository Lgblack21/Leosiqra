import Link from 'next/link';
import Image from 'next/image';

// Kerangka halaman auth sekunder (lupa/reset password) — sama dengan kartu di
// sisi kanan halaman login, tanpa panel branding kiri supaya fokus ke satu aksi.
export function AuthCard({ badge, title, subtitle, children }: {
  badge: string;
  title: string;
  subtitle: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-indigo-50/40 relative overflow-hidden font-sans">
      <div className="hero-aurora" aria-hidden />
      <div className="w-full max-w-[440px] relative z-10 space-y-6">
        <Link href="/" className="flex items-center justify-center gap-3">
          <Image src="/images/Logo-new.png" alt="Leosiqra" width={32} height={32} />
          <span className="font-serif font-black text-2xl tracking-tight text-slate-900">Leosiqra</span>
        </Link>
        <div className="bg-white/90 backdrop-blur-xl p-8 sm:p-10 rounded-[32px] shadow-[0_30px_70px_-20px_rgba(79,70,229,0.18)] border border-white ring-1 ring-slate-100 space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-label font-bold uppercase">
              {badge}
            </div>
            <h1 className="text-2xl font-serif font-black text-slate-900 leading-tight">{title}</h1>
            <p className="text-slate-500 text-sm">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
