"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { CalendarDays, ChevronDown, MessageCircle } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { LandingFooter } from '@/components/LandingFooter';
import { Reveal } from '@/components/landing/Reveal';

export interface LegalSection {
  id: string;
  title: string;
  content: React.ReactNode;
}

// Kerangka halaman legal (Privasi, Syarat): hero terang senada landing, daftar
// isi yang menempel & menandai section aktif saat di-scroll, section muncul halus.
export function LegalLayout({
  eyebrow,
  title,
  updated,
  intro,
  sections,
  footnote,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  intro: React.ReactNode;
  sections: LegalSection[];
  footnote?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    const els = sections.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => Boolean(e));
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-20% 0px -65% 0px' }
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [sections]);

  const toc = (
    <nav className="space-y-0.5">
      {sections.map((s, i) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className={`relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${active === s.id ? 'font-bold text-indigo-700' : 'text-slate-500 hover:text-slate-800'}`}
        >
          {active === s.id && (
            <motion.span layoutId="legal-toc" className="absolute inset-0 rounded-xl bg-indigo-50" transition={{ type: 'spring', stiffness: 420, damping: 36 }} />
          )}
          <span className="relative w-5 text-xs tabular-nums text-slate-400">{String(i + 1).padStart(2, '0')}</span>
          <span className="relative">{s.title}</span>
        </a>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f8fb] text-slate-900">
      <Navbar />

      <header className="relative overflow-hidden px-5 pb-14 pt-36 sm:px-6 sm:pt-44">
        <div aria-hidden className="hero-aurora" />
        <div aria-hidden className="dot-grid" />
        <motion.div
          className="relative mx-auto max-w-5xl"
          initial={reduce ? false : { opacity: 0, y: 20, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-indigo-600">{eyebrow}</p>
          <h1 className="mt-4 font-serif text-4xl leading-tight sm:text-6xl">{title}</h1>
          <p className="mt-5 flex items-center gap-2 text-sm text-slate-500">
            <CalendarDays size={15} /> Terakhir diperbarui {updated}
          </p>
          <div className="mt-6 max-w-2xl text-base leading-relaxed text-slate-600">{intro}</div>
        </motion.div>
      </header>

      <main className="relative flex-1 px-5 pb-24 sm:px-6">
        <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[240px_1fr]">
          {/* Daftar isi: menempel di desktop, lipatan di HP */}
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <details className="lp-card rounded-2xl p-2 lg:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-bold text-slate-700">
                Daftar isi <ChevronDown size={16} className="text-slate-400" />
              </summary>
              <div className="mt-1">{toc}</div>
            </details>
            <div className="hidden lg:block">
              <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Daftar isi</p>
              {toc}
            </div>
          </aside>

          <div className="space-y-5">
            {sections.map((s, i) => (
              <Reveal key={s.id} y={18} className="lp-card scroll-mt-28 rounded-[28px] p-7 sm:p-9">
                <section id={s.id} aria-labelledby={`${s.id}-h`}>
                  <div className="flex items-baseline gap-4">
                    <span className="font-serif text-2xl text-indigo-300">{String(i + 1).padStart(2, '0')}</span>
                    <h2 id={`${s.id}-h`} className="font-serif text-2xl leading-snug text-slate-900">{s.title}</h2>
                  </div>
                  <div className="legal-body mt-4 space-y-3 text-[15px] leading-relaxed text-slate-600">{s.content}</div>
                </section>
              </Reveal>
            ))}

            <Reveal className="flex flex-col items-start justify-between gap-4 rounded-[28px] bg-gradient-to-br from-[#0f172a] via-indigo-700 to-violet-600 p-7 text-white sm:flex-row sm:items-center sm:p-9">
              <div>
                <p className="font-serif text-2xl">Ada pertanyaan?</p>
                <p className="mt-1 text-sm text-indigo-100/90">Tim kami siap membantu lewat WhatsApp atau email.</p>
              </div>
              <Link href="/hubungi-kami" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-indigo-700 transition-transform hover:-translate-y-0.5">
                <MessageCircle size={16} /> Hubungi kami
              </Link>
            </Reveal>

            {footnote && <p className="px-2 text-xs italic text-slate-400">{footnote}</p>}
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
