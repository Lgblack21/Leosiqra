"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { MessageCircle, Mail, Copy, Check, ArrowRight, Plus } from 'lucide-react';
import { Reveal } from '@/components/landing/Reveal';
import { Navbar } from '@/components/Navbar';
import { LandingFooter } from '@/components/LandingFooter';
import { getPublicContact, PublicContact } from '@/lib/services/publicContactService';

// Jawaban singkat untuk pertanyaan yang paling sering — merujuk ke fitur yang ada.
const FAQ: Array<{ q: string; a: React.ReactNode }> = [
  {
    q: 'Saya lupa password',
    a: <>Buka halaman <Link href="/auth/forgot-password" className="font-bold text-indigo-600 hover:underline">Lupa password</Link> dan masukkan email akun Anda — link untuk membuat password baru akan dikirim. Kalau Anda mendaftar dengan Google, cukup masuk lewat tombol &quot;Lanjutkan dengan Google&quot;.</>,
  },
  {
    q: 'Bagaimana cara upgrade ke Pro?',
    a: <>Masuk ke akun Anda, buka halaman <strong>Konfirmasi Pembayaran Pro</strong>, pilih paket, transfer sesuai nominal, lalu unggah bukti transfernya. Pembayaran diverifikasi manual oleh tim kami, maksimal 1×24 jam.</>,
  },
  {
    q: 'Saya ganti HP dan kode Authenticator hilang',
    a: <>Hubungi kami lewat WhatsApp atau email dari alamat email akun Anda. Kami akan membantu memverifikasi kepemilikan akun sebelum mengatur ulang verifikasi 2 langkah.</>,
  },
  {
    q: 'Bagaimana menghapus data saya?',
    a: <>Seluruh data keuangan bisa Anda hapus sendiri lewat <strong>Profil → Danger Zone</strong>. Untuk menghapus akun sepenuhnya, hubungi kami lewat kontak di atas.</>,
  },
  {
    q: 'Apakah data saya aman?',
    a: <>Data Anda terikat ke akun Anda dan hanya bisa dibuka lewat sesi login Anda, dikirim lewat HTTPS, dan tidak pernah kami jual. Detail lengkapnya ada di <Link href="/privacy" className="font-bold text-indigo-600 hover:underline">Kebijakan Privasi</Link>.</>,
  },
];

function FaqItem({ q, a, open, onToggle }: { q: string; a: React.ReactNode; open: boolean; onToggle: () => void }) {
  const reduce = useReducedMotion();
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center justify-between gap-4 py-5 text-left">
        <span className="font-semibold text-slate-900">{q}</span>
        <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ type: 'spring', stiffness: 400, damping: 24 }} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
          <Plus size={16} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduce ? { opacity: 1 } : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-5 pr-12 text-sm leading-relaxed text-slate-600">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function PublicHubungiKamiPage() {
  const [contact, setContact] = useState<PublicContact | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    getPublicContact()
      .then(setContact)
      .finally(() => setLoading(false));
  }, []);

  // Normalisasi nomor WhatsApp jadi format internasional tanpa "+"/spasi/strip
  // (dibutuhkan wa.me) — anggap nomor lokal Indonesia kalau diawali "0".
  const normalizedWhatsApp = useMemo(() => {
    const raw = contact?.whatsapp;
    if (!raw) return null;
    let digits = raw.replace(/\D/g, '');
    if (!digits) return null;
    if (digits.startsWith('0')) digits = '62' + digits.slice(1);
    else if (!digits.startsWith('62')) digits = '62' + digits;
    return digits;
  }, [contact?.whatsapp]);

  const copyEmail = async () => {
    if (!contact?.billingEmail) return;
    try {
      await navigator.clipboard.writeText(contact.billingEmail);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } catch {
      // Diam-diam gagal (mis. browser tanpa izin clipboard) — tombol email
      // masih tetap bisa diklik langsung sebagai mailto:.
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f8fb] text-slate-900 selection:bg-indigo-500/10">
      <Navbar />

      <header className="relative overflow-hidden px-5 pb-12 pt-36 sm:px-6 sm:pt-44">
        <div aria-hidden className="hero-aurora" />
        <div aria-hidden className="dot-grid" />
        <motion.div
          className="relative mx-auto max-w-4xl text-center"
          initial={reduce ? false : { opacity: 0, y: 20, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-indigo-600">Bantuan</p>
          <h1 className="mt-4 font-serif text-4xl leading-tight sm:text-6xl">
            Ada yang bisa kami <span className="lp-shine italic">bantu?</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-500">
            Pertanyaan, kendala, atau masukan soal Leosiqra — hubungi kami langsung lewat WhatsApp atau email.
          </p>
        </motion.div>
      </header>

      <main className="relative flex-1 px-5 pb-24 sm:px-6">
        <div className="mx-auto max-w-4xl">
          {loading ? (
            <div className="grid gap-5 md:grid-cols-2">
              {[0, 1].map((i) => <div key={i} className="h-60 animate-pulse rounded-[28px] bg-white/70" />)}
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {/* WhatsApp */}
              <Reveal className="lp-card lift flex flex-col rounded-[28px] p-7 sm:p-8">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100"><MessageCircle size={22} /></span>
                <h2 className="mt-6 font-serif text-2xl">WhatsApp</h2>
                <p className="mt-1 flex-1 text-sm text-slate-500">{normalizedWhatsApp ? `+${normalizedWhatsApp}` : 'Belum diatur'}</p>
                {normalizedWhatsApp ? (
                  <a
                    href={`https://wa.me/${normalizedWhatsApp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition-all hover:-translate-y-0.5 hover:bg-emerald-700"
                  >
                    Chat sekarang <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                  </a>
                ) : (
                  <p className="mt-6 text-xs text-slate-400">Nomor WhatsApp belum diatur admin.</p>
                )}
              </Reveal>

              {/* Email */}
              <Reveal delay={0.08} className="lp-card lift flex flex-col rounded-[28px] p-7 sm:p-8">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100"><Mail size={22} /></span>
                <h2 className="mt-6 font-serif text-2xl">Email</h2>
                <p className="mt-1 flex-1 break-all text-sm text-slate-500">{contact?.billingEmail || 'Belum diatur'}</p>
                {contact?.billingEmail ? (
                  <div className="mt-6 flex items-center gap-2">
                    <a href={`mailto:${contact.billingEmail}`} className="lp-btn flex-1 rounded-2xl px-6 py-3.5 text-center text-sm font-bold transition-all hover:-translate-y-0.5">
                      Kirim email
                    </a>
                    <button
                      type="button"
                      onClick={copyEmail}
                      aria-label="Salin alamat email"
                      className="shrink-0 rounded-2xl border border-slate-200 bg-white p-3.5 text-slate-500 transition-colors hover:text-slate-800"
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.span key={copiedEmail ? 'ok' : 'copy'} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} className="flex">
                          {copiedEmail ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
                        </motion.span>
                      </AnimatePresence>
                    </button>
                  </div>
                ) : (
                  <p className="mt-6 text-xs text-slate-400">Email belum diatur admin.</p>
                )}
              </Reveal>
            </div>
          )}

          {/* FAQ */}
          <Reveal className="mt-16">
            <p className="text-center text-[11px] font-bold uppercase tracking-[0.3em] text-indigo-600">Pertanyaan umum</p>
            <h2 className="mt-3 text-center font-serif text-3xl sm:text-4xl">Mungkin jawabannya sudah ada di sini</h2>
            <div className="lp-card mt-10 rounded-[28px] px-6 sm:px-8">
              {FAQ.map((f, i) => (
                <FaqItem key={f.q} q={f.q} a={f.a} open={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? null : i)} />
              ))}
            </div>
          </Reveal>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
