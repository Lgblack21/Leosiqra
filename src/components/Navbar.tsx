'use client';

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

// variant "clean" dipakai landing page (kaca putih, lambang LS, tombol emas); halaman publik lain
// (privasi, syarat, hubungi kami) tetap memakai versi "light" lama.
export const Navbar = ({ variant = 'light' }: { variant?: 'light' | 'clean' }) => {
  const dark = variant === 'clean'; // nama variabel lama; artinya: gaya landing baru
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
    <nav
      className={`fixed left-0 right-0 z-50 flex justify-center px-4 sm:px-6 transition-all duration-500 ${scrolled ? 'top-3' : 'top-6'}`}
    >
      <div
        className={
          dark
            ? `w-full max-w-7xl h-16 sm:h-[72px] border rounded-full flex items-center justify-between px-4 sm:px-6 relative transition-[background-color,box-shadow] duration-500 ${scrolled ? 'bg-white/[0.97] border-slate-200/80 shadow-[0_16px_40px_-20px_rgba(15,23,42,0.35)]' : 'bg-white/70 border-white shadow-sm'}`
            : 'w-full max-w-7xl h-20 bg-white/70 backdrop-blur-xl border border-white/40 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] rounded-[32px] flex items-center justify-between px-6 sm:px-8 relative'
        }
      >
        {dark ? (
          <Link href="/" className="group flex shrink-0 items-center gap-2.5 sm:gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200 transition-transform group-hover:rotate-6 sm:h-10 sm:w-10">
              <Image
                src="/images/logo-emblem.png"
                alt="Leosiqra"
                width={32}
                height={32}
                className="h-full w-full object-contain"
              />
            </span>
            <span className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">Leosiqra</span>
          </Link>
        ) : (
          <Link href="/" className="flex items-center gap-2 sm:gap-3 group shrink-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 relative group-hover:rotate-6 transition-transform">
              <Image src="/images/Logo-new.png" alt="Leosiqra Logo" fill sizes="40px" className="object-contain" />
            </div>
            <span className="font-serif font-black text-xl sm:text-2xl tracking-tight text-[#1E293B]">Leosiqra</span>
          </Link>
        )}

        <div className="hidden lg:flex items-center gap-8 mx-4">
          <div
            className={`flex items-center gap-7 fs-13 font-bold tracking-wide ${dark ? 'text-slate-500' : 'uppercase text-slate-500/80'}`}
          >
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goToSection(s.id)}
                className={dark ? 'hover:text-indigo-600 transition-colors' : 'hover:text-indigo-600 transition-colors'}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <div className="hidden sm:flex items-center gap-4">
            <Link
              href="/auth/login"
              className={
                dark
                  ? 'px-5 py-2.5 rounded-full text-sm font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 transition-colors'
                  : 'px-5 py-2.5 rounded-full border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all'
              }
            >
              Masuk
            </Link>
          </div>
          <Link
            href="/mulai"
            className={
              dark
                ? 'px-5 sm:px-6 py-2.5 rounded-full bg-gradient-to-r from-amber-300 to-orange-400 text-slate-950 font-extrabold text-xs sm:text-sm shadow-[0_10px_26px_-10px_rgba(251,191,36,0.8)] transition-all hover:-translate-y-0.5'
                : 'px-5 sm:px-7 py-2.5 sm:py-3 rounded-full bg-gradient-to-r from-[#0F172A] to-indigo-700 text-white hover:shadow-indigo-500/30 hover:-translate-y-0.5 transition-all font-bold text-xs sm:text-sm shadow-lg shadow-slate-200'
            }
          >
            Daftar Gratis
          </Link>

          <button
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? 'Tutup menu' : 'Buka menu'}
            className={`lg:hidden p-2 rounded-xl transition-colors ${dark ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {isOpen && (
          <div
            className={`absolute top-[calc(100%+12px)] left-0 right-0 border shadow-2xl rounded-[32px] p-6 flex flex-col gap-4 lg:hidden animate-in outline-none slide-in-from-top-4 duration-300 ${dark ? 'bg-white border-slate-200' : 'bg-white/95 border-white/40'}`}
          >
            <div
              className={`flex flex-col gap-4 text-xs font-black uppercase tracking-widest px-2 ${dark ? 'text-slate-500' : 'text-slate-500'}`}
            >
              {SECTIONS.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goToSection(s.id)}
                  className={`text-left py-2 transition-colors hover:text-indigo-600 ${i < SECTIONS.length - 1 ? 'border-b border-slate-100' : ''}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className={`pt-2 sm:hidden border-t flex flex-col gap-3 border-slate-100`}>
              <Link
                href="/auth/login"
                className={`w-full py-4 rounded-2xl border text-center font-black text-xs border-slate-200 text-slate-700`}
              >
                Masuk
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};
