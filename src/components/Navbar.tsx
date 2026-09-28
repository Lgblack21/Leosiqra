"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';

const SECTIONS = [
  { id: 'produk', label: 'Produk' },
  { id: 'fitur', label: 'Fitur' },
  { id: 'pajak', label: 'Pajak' },
  { id: 'cara-kerja', label: 'Cara Kerja' },
  { id: 'harga', label: 'Harga' },
];

// variant "dark" dipakai landing page (gaya Dark Luxury); halaman publik lain
// (privasi, syarat, hubungi kami) tetap memakai versi terang.
export const Navbar = ({ variant = 'light' }: { variant?: 'light' | 'dark' }) => {
  const dark = variant === 'dark';
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const router = useRouter();
  const pathname = usePathname();

  // Scroll ke section di landing page tanpa nambah "#..." ke URL. Kalau
  // sedang di halaman lain (mis. /hubungi-kami), pindah dulu ke "/" lewat
  // sessionStorage handoff, lalu page.tsx yang scroll setelah render.
  const goToSection = (id: string) => {
    setIsOpen(false);
    if (pathname === '/') {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    } else {
      sessionStorage.setItem('leosiqra-scroll-target', id);
      router.push('/');
    }
  };

  return (
    <nav className={`fixed left-0 right-0 z-50 flex justify-center px-4 sm:px-6 transition-all duration-500 ${scrolled ? 'top-3' : 'top-6'}`}>
      <div
        className={
          dark
            ? `w-full max-w-7xl h-16 sm:h-[72px] backdrop-blur-xl border rounded-full flex items-center justify-between px-5 sm:px-7 relative transition-all duration-500 ${scrolled ? 'bg-[#0b0d12]/80 border-white/10 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)]' : 'bg-white/[0.03] border-white/[0.06]'}`
            : 'w-full max-w-7xl h-20 bg-white/70 backdrop-blur-xl border border-white/40 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] rounded-[32px] flex items-center justify-between px-6 sm:px-8 relative'
        }
      >
        <Link href="/" className="flex items-center gap-2 sm:gap-3 group shrink-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 relative group-hover:rotate-6 transition-transform">
            <Image
              src="/images/Logo-new.png"
              alt="Leosiqra Logo"
              fill
              sizes="40px"
              className="object-contain"
            />
          </div>
          <span className={`font-serif font-black text-xl sm:text-2xl tracking-tight ${dark ? 'text-[#f4efe6]' : 'text-[#1E293B]'}`}>Leosiqra</span>
        </Link>

        {/* Desktop Menu */}
        <div className="hidden lg:flex items-center gap-8 mx-4">
          <div className={`flex items-center gap-7 text-[13px] font-bold tracking-wide uppercase ${dark ? 'text-[#9a958c]' : 'text-slate-500/80'}`}>
            {SECTIONS.map((s) => (
              <button key={s.id} type="button" onClick={() => goToSection(s.id)} className={dark ? 'hover:text-[#d6b67e] transition-colors' : 'hover:text-indigo-600 transition-colors'}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <div className="hidden sm:flex items-center gap-4">
            <Link href="/auth/login" className={dark ? 'px-5 py-2.5 rounded-full text-sm font-bold text-[#f4efe6]/80 hover:text-[#f4efe6] transition-colors' : 'px-5 py-2.5 rounded-full border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all'}>
              Masuk
            </Link>
          </div>
          <Link
            href="/auth/register"
            className={
              dark
                ? 'lux-btn-gold px-5 sm:px-6 py-2.5 rounded-full font-bold text-xs sm:text-sm transition-all hover:-translate-y-0.5'
                : 'px-5 sm:px-7 py-2.5 sm:py-3 rounded-full bg-gradient-to-r from-[#0F172A] to-indigo-700 text-white hover:shadow-indigo-500/30 hover:-translate-y-0.5 transition-all font-bold text-xs sm:text-sm shadow-lg shadow-slate-200'
            }
          >
            Daftar Gratis
          </Link>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? 'Tutup menu' : 'Buka menu'}
            className={`lg:hidden p-2 rounded-xl transition-colors ${dark ? 'text-[#f4efe6] hover:bg-white/5' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Dropdown */}
        {isOpen && (
          <div className={`absolute top-[calc(100%+12px)] left-0 right-0 backdrop-blur-xl border shadow-2xl rounded-[32px] p-6 flex flex-col gap-4 lg:hidden animate-in outline-none slide-in-from-top-4 duration-300 ${dark ? 'bg-[#0b0d12]/95 border-white/10' : 'bg-white/95 border-white/40'}`}>
            <div className={`flex flex-col gap-4 text-xs font-black uppercase tracking-widest px-2 ${dark ? 'text-[#9a958c]' : 'text-slate-500'}`}>
              {SECTIONS.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goToSection(s.id)}
                  className={`text-left py-2 transition-colors ${dark ? 'hover:text-[#d6b67e]' : 'hover:text-indigo-600'} ${i < SECTIONS.length - 1 ? (dark ? 'border-b border-white/5' : 'border-b border-slate-50') : ''}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className={`pt-2 sm:hidden border-t flex flex-col gap-3 ${dark ? 'border-white/5' : 'border-slate-100'}`}>
              <Link href="/auth/login" className={`w-full py-4 rounded-2xl border text-center font-black text-xs ${dark ? 'border-white/10 text-[#f4efe6]' : 'border-slate-200 text-slate-700'}`}>Masuk</Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};
