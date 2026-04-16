"use client";

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';

export const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4 sm:px-6">
      <div className="w-full max-w-7xl h-20 bg-white/70 backdrop-blur-xl border border-white/40 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] rounded-[32px] flex items-center justify-between px-6 sm:px-8 relative">
        <a href="#beranda" className="flex items-center gap-2 sm:gap-3 group shrink-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 relative group-hover:rotate-6 transition-transform">
            <Image 
              src="/images/Logo-new.png" 
              alt="Leosiqra Logo" 
              fill 
              sizes="40px"
              className="object-contain"
            />
          </div>
          <span className="font-serif font-black text-xl sm:text-2xl tracking-tight text-[#1E293B]">Leosiqra</span>
        </a>
        
        {/* Desktop Menu */}
        <div className="hidden lg:flex items-center gap-8 mx-4">
          <div className="flex items-center gap-7 text-[13px] font-bold text-slate-500/80 tracking-wide uppercase">
            <a href="#produk" className="hover:text-indigo-600 transition-colors">Produk</a>
            <a href="#fitur" className="hover:text-indigo-600 transition-colors">Fitur</a>
            <a href="#pajak" className="hover:text-indigo-600 transition-colors">Pajak</a>
            <a href="#cara-kerja" className="hover:text-indigo-600 transition-colors">Cara Kerja</a>
            <a href="#harga" className="hover:text-indigo-600 transition-colors">Harga</a>
            <a href="#keamanan" className="hover:text-indigo-600 transition-colors">Keamanan</a>
          </div>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <div className="hidden sm:flex items-center gap-4">
            <Link href="/auth/login" className="px-5 py-2.5 rounded-full border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all">
              Masuk
            </Link>
          </div>
          <Link href="/auth/register" className="px-5 sm:px-7 py-2.5 sm:py-3 rounded-full bg-[#0F172A] text-white hover:bg-slate-800 transition-all font-bold text-xs sm:text-sm shadow-lg shadow-slate-200">
            Daftar Gratis
          </Link>

          {/* Mobile Menu Button */}
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Dropdown */}
        {isOpen && (
          <div className="absolute top-[calc(100%+12px)] left-0 right-0 bg-white/95 backdrop-blur-xl border border-white/40 shadow-2xl rounded-[32px] p-6 flex flex-col gap-4 lg:hidden animate-in outline-none slide-in-from-top-4 duration-300">
            <div className="flex flex-col gap-4 text-xs font-black text-slate-500 uppercase tracking-widest px-2">
              <a href="#produk" onClick={() => setIsOpen(false)} className="py-2 hover:text-indigo-600 transition-colors border-b border-slate-50">Produk</a>
              <a href="#fitur" onClick={() => setIsOpen(false)} className="py-2 hover:text-indigo-600 transition-colors border-b border-slate-50">Fitur</a>
              <a href="#pajak" onClick={() => setIsOpen(false)} className="py-2 hover:text-indigo-600 transition-colors border-b border-slate-50">Pajak</a>
              <a href="#cara-kerja" onClick={() => setIsOpen(false)} className="py-2 hover:text-indigo-600 transition-colors border-b border-slate-50">Cara Kerja</a>
              <a href="#harga" onClick={() => setIsOpen(false)} className="py-2 hover:text-indigo-600 transition-colors border-b border-slate-50">Harga</a>
              <a href="#keamanan" onClick={() => setIsOpen(false)} className="py-2 hover:text-indigo-600 transition-colors">Keamanan</a>
            </div>
            <div className="pt-2 sm:hidden border-t border-slate-100 flex flex-col gap-3">
              <Link href="/auth/login" className="w-full py-4 rounded-2xl border border-slate-200 text-center font-black text-xs text-slate-700">Masuk</Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};
