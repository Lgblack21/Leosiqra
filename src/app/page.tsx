"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight, ArrowUpRight, CreditCard, Landmark, LineChart, PiggyBank, HandCoins, Wallet, Repeat, Target,
  FileText, Sparkles, Mic, Camera, Undo2, Globe2, Bell, Smartphone, ShieldCheck, Scale, Eye, Check,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { LandingFooter } from '@/components/LandingFooter';
import { getDeveloperInfo, PublicDeveloperInfo } from '@/lib/services/publicContactService';
import { isStandaloneDisplay } from '@/lib/pushNotifications';
import { Reveal } from '@/components/landing/Reveal';
import { AppShowcase } from '@/components/landing/AppShowcase';
import { QuickInputShowcase } from '@/components/landing/QuickInputShowcase';

// Semua klaim di halaman ini mengacu ke fitur yang benar-benar ada di aplikasi.
const MARQUEE = [
  'Multi rekening & mata uang', 'Siklus tagihan kartu kredit', 'Deposito cair otomatis', 'Harga saham live',
  'Emas & kripto', 'Hutang & piutang', 'Tabungan per tujuan', 'Transaksi rutin otomatis', 'Budget per kategori',
  'Laporan tahunan', 'Ringkasan SPT', 'Asisten AI',
];

const FEATURES = [
  { icon: Wallet, title: 'Semua rekening', desc: 'Bank, e-wallet, cash, dan mata uang asing dalam satu saldo.' },
  { icon: CreditCard, title: 'Kartu kredit', desc: 'Tagihan tercetak, pembayaran minimum, dan pengingat jatuh tempo.' },
  { icon: PiggyBank, title: 'Tabungan per tujuan', desc: 'Dana darurat, liburan, rumah — lengkap dengan setoran otomatis.' },
  { icon: HandCoins, title: 'Hutang & piutang', desc: 'Catat cicilan, lihat sisa, lunasi sekali tap.' },
  { icon: LineChart, title: 'Saham & aset', desc: 'Harga saham live, emas, kripto, dan untung-rugi yang jelas.' },
  { icon: Landmark, title: 'Deposito', desc: 'Bunga bersih dihitung otomatis, cair atau diperpanjang saat jatuh tempo.' },
  { icon: Target, title: 'Budget', desc: 'Batas per kategori dengan peringatan sebelum kebablasan.' },
  { icon: Repeat, title: 'Transaksi rutin', desc: 'Gaji, langganan, dan tagihan tercatat sendiri tiap periode.' },
  { icon: Sparkles, title: 'Asisten AI', desc: 'Tanya kondisi keuanganmu dalam bahasa sehari-hari.' },
  { icon: Bell, title: 'Notifikasi', desc: 'Ringkasan harian dan pengingat langsung ke HP.' },
  { icon: Smartphone, title: 'Android & web', desc: 'Aplikasi Android, bisa dipasang di iPhone, dan versi web lengkap.' },
  { icon: FileText, title: 'Laporan tahunan', desc: 'Rekap setahun penuh untuk evaluasi dan perencanaan.' },
];

const STEPS = [
  { n: 'I', title: 'Buat akun', desc: 'Daftar dalam satu menit. Gratis 14 hari, tanpa kartu kredit.' },
  { n: 'II', title: 'Tambahkan rekening', desc: 'Masukkan saldo awal rekening, kartu, dan aset yang Anda miliki.' },
  { n: 'III', title: 'Catat seperlunya', desc: 'Ketik, ucapkan, atau foto struk — sisanya dirangkum otomatis.' },
];

const PRINCIPLES = [
  { icon: Scale, title: 'Akurat sampai rupiah', desc: 'Setiap transaksi dan perubahan saldo disimpan bersamaan. Tidak ada data setengah jadi, tidak ada saldo yang terpotong dua kali.' },
  { icon: Eye, title: 'Data Anda, hanya untuk Anda', desc: 'Setiap data terikat ke akun Anda sendiri dan hanya bisa dibuka lewat sesi login Anda.' },
  { icon: ShieldCheck, title: 'Jujur, tanpa janji', desc: 'Leosiqra membantu Anda melihat dengan jernih. Bukan saran investasi, dan bukan janji keuntungan.' },
];

export default function LandingPage() {
  const reduce = useReducedMotion();

  // PWA terpasang (Add to Home Screen) memakai UI mobile /app. Termasuk
  // instalasi lama yang start_url-nya masih "/" — tanpa ini mereka mendarat di
  // landing page lalu masuk ke dashboard web desktop.
  useEffect(() => {
    if (isStandaloneDisplay()) window.location.replace('/app');
  }, []);

  const [developer, setDeveloper] = useState<PublicDeveloperInfo | null>(null);
  useEffect(() => {
    getDeveloperInfo().then(setDeveloper).catch(() => setDeveloper(null));
  }, []);

  // Handoff dari Navbar saat link section diklik dari halaman lain (mis.
  // /hubungi-kami) — target section disimpan di sessionStorage lalu di-scroll
  // ke sini setelah landing page selesai render, tanpa pernah menyentuh URL.
  useEffect(() => {
    const target = sessionStorage.getItem('leosiqra-scroll-target');
    if (target) {
      sessionStorage.removeItem('leosiqra-scroll-target');
      requestAnimationFrame(() => {
        document.getElementById(target)?.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }, []);

  const heroItem = (i: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 24, filter: 'blur(10px)' },
          animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
          transition: { duration: 1, delay: 0.15 + i * 0.12, ease: [0.16, 1, 0.3, 1] as const },
        };

  return (
    <div id="beranda" className="min-h-screen overflow-x-clip scroll-mt-20 bg-[#f7f8fb] text-slate-900">
      <Navbar />

      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden px-5 pb-20 pt-36 sm:px-6 sm:pb-28 sm:pt-44">
        <div aria-hidden className="hero-aurora" />
        <div aria-hidden className="dot-grid" />
        <div className="relative mx-auto max-w-4xl text-center">
          <motion.div {...heroItem(0)} className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-indigo-600 shadow-sm backdrop-blur">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" /></span>
            Aplikasi keuangan pribadi
          </motion.div>
          <motion.h1 {...heroItem(1)} className="mt-7 font-serif text-[2.7rem] leading-[1.04] tracking-tight text-slate-900 sm:text-6xl lg:text-7xl">
            Semua uang Anda,
            <br />
            <span className="lp-shine italic">dalam satu layar.</span>
          </motion.h1>
          <motion.p {...heroItem(2)} className="mx-auto mt-7 max-w-2xl text-base leading-relaxed text-slate-500 sm:text-lg">
            Rekening, kartu kredit, tabungan, hutang, dan investasi — tercatat rapi, terhitung otomatis, lengkap dengan ringkasan SPT tahunan. Tanpa spreadsheet, tanpa pusing.
          </motion.p>
          <motion.div {...heroItem(3)} className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/auth/register" className="lp-btn group inline-flex items-center justify-center gap-2 rounded-full px-8 py-4 text-sm font-bold transition-all hover:-translate-y-0.5">
              Mulai gratis 14 hari <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="/auth/login" className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white/80 px-8 py-4 text-sm font-bold text-slate-700 backdrop-blur transition-colors hover:border-slate-300 hover:bg-white">
              Masuk ke akun
            </Link>
          </motion.div>
          <motion.p {...heroItem(4)} className="mt-6 text-xs text-slate-400">Tanpa kartu kredit · Android, iPhone & web · Bahasa Indonesia</motion.p>
        </div>

        {/* Tur animasi mode desktop */}
        <motion.div
          className="relative mx-auto mt-16 max-w-6xl sm:mt-20"
          initial={reduce ? false : { opacity: 0, y: 60, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div aria-hidden className="absolute -inset-x-10 -top-10 bottom-24 -z-10 rounded-[60px] bg-gradient-to-b from-indigo-200/40 via-violet-100/30 to-transparent blur-3xl" />
          <AppShowcase />
        </motion.div>
      </section>

      {/* ============ MARQUEE ============ */}
      <div className="relative border-y border-slate-200/70 bg-white/60 py-5 [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
        <div className="marquee-x flex w-max gap-10 whitespace-nowrap">
          {[...MARQUEE, ...MARQUEE].map((m, i) => (
            <span key={i} className="flex items-center gap-10 text-sm text-slate-500">
              {m} <span className="h-1 w-1 rotate-45 bg-indigo-300" />
            </span>
          ))}
        </div>
      </div>

      {/* ============ PRODUK (BENTO) ============ */}
      <section id="produk" className="relative scroll-mt-24 px-5 py-24 sm:px-6 sm:py-32">
        <div className="mx-auto max-w-7xl">
          <Reveal className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-indigo-600">Produk</p>
            <h2 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">Semua yang Anda miliki, dalam satu pandangan.</h2>
          </Reveal>

          <div className="mt-14 grid gap-4 md:grid-cols-6">
            <Reveal className="lp-card group rounded-[28px] p-7 md:col-span-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Alokasi aset</p>
              <h3 className="mt-2 font-serif text-2xl sm:text-3xl">Tahu persis ke mana uang Anda bekerja.</h3>
              <div className="mt-8 space-y-4">
                {[['Rekening & kas', 38, '#6366f1'], ['Deposito', 34, '#8b5cf6'], ['Saham', 18, '#10b981'], ['Emas & lainnya', 10, '#f59e0b']].map(([label, pct, color], i) => (
                  <div key={label as string}>
                    <div className="mb-1.5 flex justify-between text-xs"><span className="text-slate-500">{label}</span><span className="tabular-nums">{pct}%</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: color as string }}
                        initial={reduce ? false : { width: 0 }}
                        whileInView={{ width: `${pct}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.4, delay: 0.2 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.1} className="lp-card rounded-[28px] p-7 md:col-span-2">
              <CreditCard size={22} className="text-indigo-600" />
              <h3 className="mt-5 font-serif text-2xl">Kartu kredit tanpa kejutan.</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">Tagihan tercetak, minimum bayar, dan hitung mundur jatuh tempo.</p>
              <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex justify-between text-[11px] text-slate-500"><span>Tagihan tercetak</span><span className="text-amber-600">3 hari lagi</span></div>
                <p className="mt-1 font-serif text-2xl tabular-nums">Rp 4.250.000</p>
                <p className="mt-1 text-[11px] text-slate-500">Minimum Rp 425.000</p>
              </div>
            </Reveal>

            <Reveal delay={0.05} className="lp-card rounded-[28px] p-7 md:col-span-2">
              <Landmark size={22} className="text-indigo-600" />
              <h3 className="mt-5 font-serif text-2xl">Deposito yang mengurus dirinya sendiri.</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">Bunga bersih setelah pajak dihitung otomatis. Saat jatuh tempo: cair ke rekening atau diperpanjang — sesuai pilihan Anda.</p>
            </Reveal>

            <Reveal delay={0.1} className="lp-card rounded-[28px] p-7 md:col-span-2">
              <LineChart size={22} className="text-indigo-600" />
              <h3 className="mt-5 font-serif text-2xl">Investasi dengan harga live.</h3>
              <div className="mt-6 flex items-end justify-between">
                <div>
                  <p className="text-xs text-slate-500">BBCA · 1.200 lembar</p>
                  <p className="font-serif text-2xl tabular-nums">Rp 11.880.000</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-600">+8,3%</span>
              </div>
            </Reveal>

            <Reveal delay={0.15} className="lp-card rounded-[28px] p-7 md:col-span-2">
              <PiggyBank size={22} className="text-indigo-600" />
              <h3 className="mt-5 font-serif text-2xl">Tabungan per tujuan.</h3>
              <div className="mt-6 flex items-center gap-5">
                <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden>
                  <circle cx="32" cy="32" r="27" fill="none" stroke="#eef0f6" strokeWidth="6" />
                  <motion.circle
                    cx="32" cy="32" r="27" fill="none" stroke="#4f46e5" strokeWidth="6" strokeLinecap="round"
                    initial={reduce ? false : { pathLength: 0 }}
                    whileInView={{ pathLength: 0.72 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
                  />
                </svg>
                <div>
                  <p className="text-xs text-slate-500">Dana Darurat</p>
                  <p className="font-serif text-xl">72% tercapai</p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============ INPUT CEPAT ============ */}
      <section className="relative overflow-hidden px-5 py-24 sm:px-6 sm:py-32">
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
        <div className="mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-2">
          <Reveal>
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-indigo-600">Input Cepat</p>
            <h2 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">Catat dalam hitungan detik. Dengan cara Anda.</h2>
            <p className="mt-6 max-w-lg text-slate-500 leading-relaxed">
              Ketik seperti menulis catatan, ucapkan, atau foto struknya. Nominal, kategori, rekening, dan tanggal terisi sendiri — Anda tinggal memeriksa lalu menyimpan.
            </p>
            <ul className="mt-10 space-y-5">
              {[
                [Sparkles, 'Ketik pintar', '“25rb kopi bca kemarin” langsung dipahami.'],
                [Mic, 'Bicara', 'Ucapkan transaksinya, AI yang menuliskan.'],
                [Camera, 'Foto struk', 'Total, nama toko, dan kategori terbaca otomatis.'],
                [Undo2, 'Bisa dibatalkan', 'Salah catat? Batalkan, saldo kembali persis.'],
              ].map(([Icon, title, desc]) => {
                const I = Icon as React.ElementType;
                return (
                  <li key={title as string} className="flex gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600"><I size={17} /></span>
                    <span>
                      <span className="block font-semibold">{title as string}</span>
                      <span className="block text-sm text-slate-500">{desc as string}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </Reveal>
          <Reveal delay={0.15}>
            <QuickInputShowcase />
          </Reveal>
        </div>
      </section>

      {/* ============ FITUR ============ */}
      <section id="fitur" className="relative scroll-mt-24 px-5 py-24 sm:px-6 sm:py-32">
        <div className="mx-auto max-w-7xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-indigo-600">Fitur</p>
            <h2 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">Lengkap, tanpa terasa rumit.</h2>
          </Reveal>
          <div className="mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-[28px] border border-slate-200/80 bg-slate-200/70 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 4) * 0.06} y={16} className="group bg-white p-5 sm:p-7 transition-colors duration-500 hover:bg-indigo-50/40">
                <f.icon size={20} className="text-indigo-600 transition-transform duration-500 group-hover:-translate-y-0.5" />
                <h3 className="mt-4 sm:mt-5 text-sm sm:text-base font-semibold">{f.title}</h3>
                <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-500">{f.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PAJAK ============ */}
      <section id="pajak" className="relative scroll-mt-24 px-5 py-24 sm:px-6 sm:py-32">
        <Reveal className="lp-card relative mx-auto grid max-w-7xl items-center gap-12 overflow-hidden rounded-[36px] p-8 sm:p-14 lg:grid-cols-2">
          <div aria-hidden className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.12),transparent)]" />
          <div className="relative">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-indigo-600">Pajak Center</p>
            <h2 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">SPT tahunan, disiapkan dari catatan Anda.</h2>
            <p className="mt-6 max-w-lg leading-relaxed text-slate-500">
              Harta, penghasilan, dan estimasi PPh dirangkum otomatis dari transaksi sepanjang tahun — siap Anda pakai saat lapor.
            </p>
            <p className="mt-6 max-w-lg border-l-2 border-indigo-200 pl-4 text-xs leading-relaxed text-slate-500">
              Leosiqra menghitung &amp; menyusun ringkasan SPT. Pelaporan resmi tetap Anda kirim sendiri melalui{' '}
              <a href="https://coretaxdjp.pajak.go.id/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline-offset-4 hover:underline">coretaxdjp.pajak.go.id</a>.
            </p>
          </div>
          <ul className="relative space-y-3">
            {['Daftar harta otomatis dari saldo & investasi', 'Estimasi PPh dengan PTKP', 'Ringkasan penghasilan setahun', 'Ekspor Excel & PDF'].map((item, i) => (
              <motion.li
                key={item}
                initial={reduce ? false : { opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 + i * 0.1, duration: 0.7 }}
                className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 px-5 py-4"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-indigo-600"><Check size={14} /></span>
                <span className="text-sm">{item}</span>
              </motion.li>
            ))}
          </ul>
        </Reveal>
      </section>

      {/* ============ PRINSIP ============ */}
      <section className="relative px-5 py-24 sm:px-6 sm:py-32">
        <div className="mx-auto max-w-7xl">
          <Reveal className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-indigo-600">Prinsip kami</p>
            <h2 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">Dibangun untuk dipercaya.</h2>
          </Reveal>
          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {PRINCIPLES.map((p, i) => (
              <Reveal key={p.title} delay={i * 0.1} className="lp-card rounded-[28px] p-8">
                <p.icon size={22} className="text-indigo-600" />
                <h3 className="mt-6 font-serif text-2xl">{p.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">{p.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CARA KERJA ============ */}
      <section id="cara-kerja" className="relative scroll-mt-24 px-5 py-24 sm:px-6 sm:py-32">
        <div className="mx-auto max-w-7xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-indigo-600">Cara mulai</p>
            <h2 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">Tiga langkah menuju keuangan yang tenang.</h2>
          </Reveal>
          <div className="relative mt-16 grid gap-10 md:grid-cols-3">
            <motion.div
              aria-hidden
              className="absolute left-[16%] right-[16%] top-8 hidden h-px origin-left bg-gradient-to-r from-indigo-300/0 via-indigo-300 to-indigo-300/0 md:block"
              initial={reduce ? false : { scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
            />
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={0.2 + i * 0.15} className="relative text-center">
                <span className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-indigo-200 bg-white shadow-sm font-serif text-xl text-indigo-600">{s.n}</span>
                <h3 className="mt-6 font-serif text-2xl">{s.title}</h3>
                <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-slate-500">{s.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ HARGA ============ */}
      <section id="harga" className="relative scroll-mt-24 px-5 py-24 sm:px-6 sm:py-32">
        <div className="mx-auto max-w-5xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-indigo-600">Harga</p>
            <h2 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">Coba dulu. Lanjutkan kalau cocok.</h2>
          </Reveal>
          <div className="mt-14 grid gap-4 md:grid-cols-2">
            <Reveal className="lp-card flex flex-col rounded-[32px] p-9">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Masa coba</p>
              <p className="mt-4 font-serif text-5xl">Rp 0</p>
              <p className="mt-1 text-sm text-slate-500">selama 14 hari · tanpa kartu kredit</p>
              <ul className="mt-8 flex-1 space-y-3 text-sm">
                {['Semua fitur aktif', 'Input Cepat: ketik, suara, foto struk', 'Tabungan, hutang, investasi', 'Aplikasi Android & web'].map((x) => (
                  <li key={x} className="flex items-center gap-3"><Check size={15} className="text-indigo-600" /> {x}</li>
                ))}
              </ul>
              <Link href="/auth/register" className="lp-btn mt-10 block rounded-full py-4 text-center text-sm font-bold transition-all hover:-translate-y-0.5">Mulai gratis</Link>
            </Reveal>
            <Reveal delay={0.1} className="relative flex flex-col overflow-hidden rounded-[32px] border border-indigo-200 bg-gradient-to-b from-indigo-50 to-white p-9 shadow-[0_24px_60px_-32px_rgba(79,70,229,0.35)]">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">Pro</p>
              <p className="mt-4 font-serif text-4xl leading-tight">Semua fitur, tanpa batas waktu.</p>
              <p className="mt-3 text-sm text-slate-500">Lanjutkan setelah masa coba. Harga & cara pembayaran tersedia di dalam aplikasi.</p>
              <ul className="mt-8 flex-1 space-y-3 text-sm">
                {['Semua fitur tetap aktif', 'Pajak Center & laporan tahunan', 'Asisten AI', 'Pengingat & notifikasi'].map((x) => (
                  <li key={x} className="flex items-center gap-3"><Check size={15} className="text-indigo-600" /> {x}</li>
                ))}
              </ul>
              <Link href="/hubungi-kami" className="mt-10 block rounded-full border border-indigo-200 bg-white py-4 text-center text-sm font-bold text-indigo-600 transition-colors hover:bg-indigo-50">Tanya tim kami</Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============ DEVELOPER ============ */}
      {developer?.photoUrl && (
        <section className="px-5 pb-8 sm:px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <div className="relative mx-auto h-24 w-24 overflow-hidden rounded-full ring-4 ring-white shadow-xl shadow-slate-200">
              <Image src={developer.photoUrl} alt={developer.name || 'Pendiri Leosiqra'} fill className="object-cover" />
            </div>
            <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.3em] text-indigo-600">Di balik Leosiqra</p>
            {developer.name && <h3 className="mt-2 font-serif text-3xl">{developer.name}</h3>}
            {developer.quote && <p className="mt-5 font-serif text-xl italic leading-relaxed text-slate-600">&ldquo;{developer.quote}&rdquo;</p>}
          </Reveal>
        </section>
      )}

      {/* ============ CTA AKHIR ============ */}
      <section className="relative overflow-hidden px-5 py-28 sm:px-6 sm:py-36">
        <div aria-hidden className="absolute left-1/2 top-1/2 h-[520px] w-[820px] max-w-[140vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.14),transparent)] blur-2xl" />
                <Reveal className="relative mx-auto max-w-3xl text-center">
          <h2 className="font-serif text-4xl leading-[1.08] sm:text-6xl">
            Mulai hari ini.
            <br />
            <span className="lp-shine italic">Tenang</span> seterusnya.
          </h2>
          <p className="mx-auto mt-6 max-w-md text-slate-500">Buat akun gratis dan lihat kondisi keuangan Anda dengan jernih — dalam hitungan menit.</p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/auth/register" className="lp-btn group inline-flex w-full items-center justify-center gap-2 rounded-full px-9 py-4 text-sm font-bold transition-all hover:-translate-y-0.5 sm:w-auto">
              Daftar gratis <ArrowUpRight size={17} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
            <Link href="/hubungi-kami" className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-9 py-4 text-sm font-bold text-slate-700 transition-colors hover:border-slate-300 sm:w-auto">
              <Globe2 size={16} /> Hubungi kami
            </Link>
          </div>
        </Reveal>
      </section>

      <LandingFooter />
    </div>
  );
}
