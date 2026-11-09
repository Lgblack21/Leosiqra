'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  ArrowUpRight,
  CreditCard,
  Landmark,
  LineChart,
  PiggyBank,
  HandCoins,
  Wallet,
  Repeat,
  Target,
  FileText,
  Sparkles,
  Mic,
  Camera,
  Undo2,
  Globe2,
  Bell,
  Smartphone,
  ShieldCheck,
  Scale,
  Eye,
  Check,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { LandingFooter } from '@/components/LandingFooter';
import { getDeveloperInfo, PublicDeveloperInfo } from '@/lib/services/publicContactService';
import { isStandaloneDisplay } from '@/lib/pushNotifications';
import { Reveal } from '@/components/landing/Reveal';
import { AppShowcase } from '@/components/landing/AppShowcase';
import { ScrollTilt } from '@/components/landing/ScrollTilt';
import { QuickInputShowcase } from '@/components/landing/QuickInputShowcase';
import { Aurora } from '@/components/auth/AuthLayout';
import { BalanceChip, BudgetChip, ScanChip, TxChip, VoiceChip } from '@/components/auth/FinanceChips';
import { LeoMascot } from '@/components/mascot/LeoMascot';

// Semua klaim di halaman ini mengacu ke fitur yang benar-benar ada di aplikasi.
const MARQUEE = [
  'Multi rekening & mata uang',
  'Siklus tagihan kartu kredit',
  'Deposito cair otomatis',
  'Harga saham live',
  'Emas & kripto',
  'Hutang & piutang',
  'Tabungan per tujuan',
  'Transaksi rutin otomatis',
  'Budget per kategori',
  'Laporan tahunan',
  'Ringkasan SPT',
  'Asisten AI',
];

const FEATURES = [
  {
    icon: Wallet,
    title: 'Semua rekening',
    desc: 'Bank, e-wallet, cash, dan mata uang asing dalam satu saldo.',
    tone: 'indigo' as Tone,
  },
  {
    icon: CreditCard,
    title: 'Kartu kredit',
    desc: 'Tagihan tercetak, pembayaran minimum, dan pengingat jatuh tempo.',
    tone: 'amber' as Tone,
  },
  {
    icon: PiggyBank,
    title: 'Tabungan per tujuan',
    desc: 'Dana darurat, liburan, rumah — lengkap dengan setoran otomatis.',
    tone: 'pink' as Tone,
  },
  {
    icon: HandCoins,
    title: 'Hutang & piutang',
    desc: 'Catat cicilan, lihat sisa, lunasi sekali tap.',
    tone: 'rose' as Tone,
  },
  {
    icon: LineChart,
    title: 'Saham & aset',
    desc: 'Harga saham live, emas, kripto, dan untung-rugi yang jelas.',
    tone: 'emerald' as Tone,
  },
  {
    icon: Landmark,
    title: 'Deposito',
    desc: 'Bunga bersih dihitung otomatis, cair atau diperpanjang saat jatuh tempo.',
    tone: 'sky' as Tone,
  },
  {
    icon: Target,
    title: 'Budget',
    desc: 'Batas per kategori dengan peringatan sebelum kebablasan.',
    tone: 'violet' as Tone,
  },
  {
    icon: Repeat,
    title: 'Transaksi rutin',
    desc: 'Gaji, langganan, dan tagihan tercatat sendiri tiap periode.',
    tone: 'indigo' as Tone,
  },
  {
    icon: Sparkles,
    title: 'Asisten AI',
    desc: 'Tanya kondisi keuanganmu dalam bahasa sehari-hari.',
    tone: 'violet' as Tone,
  },
  { icon: Bell, title: 'Notifikasi', desc: 'Ringkasan harian dan pengingat langsung ke HP.', tone: 'amber' as Tone },
  {
    icon: Smartphone,
    title: 'Android & web',
    desc: 'Aplikasi Android, bisa dipasang di iPhone, dan versi web lengkap.',
    tone: 'sky' as Tone,
  },
  {
    icon: FileText,
    title: 'Laporan tahunan',
    desc: 'Rekap setahun penuh untuk evaluasi dan perencanaan.',
    tone: 'emerald' as Tone,
  },
];

const STEPS = [
  { n: 'I', title: 'Buat akun', desc: 'Daftar dalam satu menit. Gratis 14 hari, tanpa kartu kredit.' },
  { n: 'II', title: 'Tambahkan rekening', desc: 'Masukkan saldo awal rekening, kartu, dan aset yang Anda miliki.' },
  { n: 'III', title: 'Catat seperlunya', desc: 'Ketik, ucapkan, atau foto struk — sisanya dirangkum otomatis.' },
];

const PRINCIPLES = [
  {
    icon: Scale,
    title: 'Akurat sampai rupiah',
    desc: 'Setiap transaksi dan perubahan saldo disimpan bersamaan. Tidak ada data setengah jadi, tidak ada saldo yang terpotong dua kali.',
    tone: 'emerald' as Tone,
  },
  {
    icon: Eye,
    title: 'Data Anda, hanya untuk Anda',
    desc: 'Setiap data terikat ke akun Anda sendiri dan hanya bisa dibuka lewat sesi login Anda.',
    tone: 'indigo' as Tone,
  },
  {
    icon: ShieldCheck,
    title: 'Jujur, tanpa janji',
    desc: 'Leosiqra membantu Anda melihat dengan jernih. Bukan saran investasi, dan bukan janji keuntungan.',
    tone: 'amber' as Tone,
  },
];

const TONES = {
  indigo: 'bg-indigo-50 text-indigo-600 ring-indigo-100',
  emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-600 ring-amber-100',
  pink: 'bg-pink-50 text-pink-600 ring-pink-100',
  sky: 'bg-sky-50 text-sky-600 ring-sky-100',
  violet: 'bg-violet-50 text-violet-600 ring-violet-100',
  rose: 'bg-rose-50 text-rose-600 ring-rose-100',
} as const;
type Tone = keyof typeof TONES;
function IconChip({ icon: Icon, tone, size = 'md' }: { icon: React.ElementType; tone: Tone; size?: 'md' | 'lg' }) {
  return (
    <span
      className={`inline-flex items-center justify-center ring-1 ${TONES[tone]} ${size === 'lg' ? 'h-12 w-12 rounded-2xl' : 'h-10 w-10 rounded-xl'}`}
    >
      <Icon size={size === 'lg' ? 22 : 18} />
    </span>
  );
}

// Fakta singkat yang bisa dibuktikan di aplikasi (bukan klaim jumlah pengguna).
const FACTS = [
  ['3 cara mencatat', 'ketik · suara · foto struk'],
  ['12 fitur utama', 'dalam satu akun'],
  ['Android · iPhone · Web', 'data selalu sinkron'],
  ['Gratis 14 hari', 'tanpa kartu kredit'],
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
    getDeveloperInfo()
      .then(setDeveloper)
      .catch(() => setDeveloper(null));
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
      <Navbar variant="dark" />

      {/* ── Hero: langit navy-emas (senada halaman Masuk/Daftar & Mulai) ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#070d1f] via-[#0d1638] to-[#1b1150] px-5 pb-0 pt-32 text-white sm:px-6 sm:pt-40">
        <Aurora />
        <div className="relative mx-auto max-w-4xl text-center">
          <motion.div
            {...heroItem(0)}
            className="relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-amber-300/15 px-4 py-1.5 fs-12 font-bold text-amber-200 ring-1 ring-amber-300/30"
          >
            <span aria-hidden className="auth-shine" />
            <Sparkles size={14} className="auth-twinkle" />
            Aplikasi catatan keuangan pribadi · Gratis 14 hari
          </motion.div>
          <motion.h1
            {...heroItem(1)}
            className="mt-7 text-[2.6rem] font-extrabold leading-[1.04] tracking-[-0.035em] sm:text-6xl lg:text-7xl"
          >
            Semua uang Anda,
            <br />
            <span className="lp-gold">dalam satu layar.</span>
          </motion.h1>
          <motion.p
            {...heroItem(2)}
            className="mx-auto mt-7 max-w-2xl text-base leading-relaxed text-white/65 sm:text-lg"
          >
            Catatan keuangan harian dalam hitungan detik — rekening, kartu kredit, tabungan, hutang, dan investasi
            tercatat rapi, terhitung otomatis, lengkap dengan ringkasan SPT tahunan. Tanpa spreadsheet, tanpa pusing.
          </motion.p>
          <motion.div {...heroItem(3)} className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/mulai"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-300 to-orange-400 px-8 py-4 text-sm font-extrabold text-slate-950 shadow-[0_16px_40px_-14px_rgba(251,191,36,0.85)] transition-all hover:-translate-y-0.5"
            >
              Mulai gratis 14 hari <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white/[0.06] px-8 py-4 text-sm font-bold text-white ring-1 ring-white/20 backdrop-blur transition-colors hover:bg-white/[0.12]"
            >
              Masuk ke akun
            </Link>
          </motion.div>
          <motion.p {...heroItem(4)} className="mt-6 text-xs text-white/45">
            Tanpa kartu kredit · Android, iPhone & web · Bahasa Indonesia ·{' '}
            <Link href="/install" className="font-bold text-amber-300 hover:underline">
              Pasang di HP →
            </Link>
          </motion.p>
        </div>

        {/* Pita kartu fitur yang berjalan */}
        <motion.div
          {...heroItem(5)}
          aria-hidden
          className="relative -mx-5 mt-14 overflow-hidden py-4 [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)] sm:-mx-6"
        >
          <div className="auth-ticker flex w-max items-center gap-6 pl-6">
            {[0, 1].map((k) => (
              <div key={k} className="flex shrink-0 items-center gap-6">
                <TxChip />
                <VoiceChip />
                <BudgetChip />
                <ScanChip />
                <BalanceChip />
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          className="relative mx-auto mt-10 max-w-6xl"
          initial={reduce ? false : { opacity: 0, y: 60, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div
            aria-hidden
            className="absolute -inset-x-10 -top-10 bottom-10 -z-10 rounded-[60px] bg-gradient-to-b from-amber-300/25 via-indigo-500/20 to-transparent blur-3xl"
          />
          <div className="pointer-events-none absolute -top-[86px] left-1/2 z-10 hidden -translate-x-1/2 sm:block">
            <LeoMascot mood="happy" size={120} />
          </div>
          <ScrollTilt>
            <AppShowcase />
          </ScrollTilt>
          <div className="absolute -left-14 top-[60%] hidden xl:block">
            <div
              className="paper-float flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-slate-900 shadow-[0_24px_48px_-20px_rgba(2,6,23,0.6)]"
              style={{ animationDelay: '-2s' } as React.CSSProperties}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <CreditCard size={17} />
              </span>
              <span className="leading-tight">
                <span className="block fs-10 font-bold uppercase tracking-wider text-slate-400">Kartu kredit</span>
                <span className="block text-sm font-bold text-slate-800">Jatuh tempo 3 hari lagi</span>
              </span>
            </div>
          </div>
          <div className="absolute -right-10 top-[18%] hidden xl:block">
            <div className="paper-float flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-slate-900 shadow-[0_24px_48px_-20px_rgba(2,6,23,0.6)]">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Check size={17} />
              </span>
              <span className="leading-tight">
                <span className="block fs-10 font-bold uppercase tracking-wider text-slate-400">Dana darurat</span>
                <span className="block text-sm font-bold text-slate-800">Setoran otomatis tercatat</span>
              </span>
            </div>
          </div>
        </motion.div>

        <div className="relative mx-auto mt-14 grid max-w-5xl grid-cols-2 gap-px overflow-hidden rounded-3xl bg-white/10 ring-1 ring-white/10 lg:grid-cols-4">
          {FACTS.map(([big, small], i) => (
            <Reveal key={big} delay={i * 0.08} y={14} className="bg-[#0b1430]/80 px-5 py-6 text-center backdrop-blur">
              <p className="text-lg font-extrabold tracking-tight text-white sm:text-xl">{big}</p>
              <p className="mt-1 text-xs text-white/50">{small}</p>
            </Reveal>
          ))}
        </div>
        {/* Lengkung ke bagian terang */}
        <svg
          aria-hidden
          viewBox="0 0 1440 90"
          preserveAspectRatio="none"
          className="relative -mx-5 mt-16 block h-16 w-[calc(100%+2.5rem)] sm:-mx-6 sm:h-24 sm:w-[calc(100%+3rem)]"
        >
          <path d="M0 90 C 360 0, 1080 0, 1440 90 Z" fill="#f7f8fb" />
        </svg>
      </section>

      <div className="relative border-b border-slate-200/70 bg-white/60 py-5 [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
        <div className="marquee-x flex w-max gap-10 whitespace-nowrap">
          {[...MARQUEE, ...MARQUEE].map((m, i) => (
            <span key={i} className="flex items-center gap-10 text-sm font-semibold text-slate-500">
              {m} <span className="h-1.5 w-1.5 rotate-45 bg-gradient-to-br from-amber-300 to-orange-400" />
            </span>
          ))}
        </div>
      </div>

      <section id="produk" className="relative scroll-mt-24 px-5 py-24 sm:px-6 sm:py-32">
        <div className="mx-auto max-w-7xl">
          <Reveal className="max-w-2xl">
            <p className="fs-11 font-bold uppercase tracking-[0.3em] text-indigo-600">Produk</p>
            <h2 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">
              Semua yang Anda miliki, dalam satu pandangan.
            </h2>
          </Reveal>

          <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-6">
            <Reveal className="lp-card lift group rounded-[28px] p-7 md:col-span-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Alokasi aset</p>
              <h3 className="mt-2 font-serif text-2xl sm:text-3xl">Tahu persis ke mana uang Anda bekerja.</h3>
              <div className="mt-8 space-y-4">
                {[
                  ['Rekening & kas', 38, '#6366f1'],
                  ['Deposito', 34, '#8b5cf6'],
                  ['Saham', 18, '#10b981'],
                  ['Emas & lainnya', 10, '#f59e0b'],
                ].map(([label, pct, color], i) => (
                  <div key={label as string}>
                    <div className="mb-1.5 flex justify-between text-xs">
                      <span className="text-slate-500">{label}</span>
                      <span className="tabular-nums">{pct}%</span>
                    </div>
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

            <Reveal delay={0.1} className="lp-card lift rounded-[28px] p-7 md:col-span-2">
              <IconChip icon={CreditCard} tone="amber" />
              <h3 className="mt-5 font-serif text-2xl">Kartu kredit tanpa kejutan.</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">
                Tagihan tercetak, minimum bayar, dan hitung mundur jatuh tempo.
              </p>
              <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex justify-between fs-11 text-slate-500">
                  <span>Tagihan tercetak</span>
                  <span className="text-amber-600">3 hari lagi</span>
                </div>
                <p className="mt-1 font-serif text-2xl tabular-nums">Rp 4.250.000</p>
                <p className="mt-1 fs-11 text-slate-500">Minimum Rp 425.000</p>
              </div>
            </Reveal>

            <Reveal delay={0.05} className="lp-card lift rounded-[28px] p-7 md:col-span-2">
              <IconChip icon={Landmark} tone="indigo" />
              <h3 className="mt-5 font-serif text-2xl">Deposito yang mengurus dirinya sendiri.</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">
                Bunga bersih setelah pajak dihitung otomatis. Saat jatuh tempo: cair ke rekening atau diperpanjang —
                sesuai pilihan Anda.
              </p>
            </Reveal>

            <Reveal delay={0.1} className="lp-card lift rounded-[28px] p-7 md:col-span-2">
              <IconChip icon={LineChart} tone="emerald" />
              <h3 className="mt-5 font-serif text-2xl">Investasi dengan harga live.</h3>
              <div className="mt-6 flex items-end justify-between">
                <div>
                  <p className="text-xs text-slate-500">BBCA · 1.200 lembar</p>
                  <p className="font-serif text-2xl tabular-nums">Rp 11.880.000</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-600">+8,3%</span>
              </div>
            </Reveal>

            <Reveal delay={0.15} className="lp-card lift rounded-[28px] p-7 md:col-span-2">
              <IconChip icon={PiggyBank} tone="pink" />
              <h3 className="mt-5 font-serif text-2xl">Tabungan per tujuan.</h3>
              <div className="mt-6 flex items-center gap-5">
                <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden>
                  <circle cx="32" cy="32" r="27" fill="none" stroke="#eef0f6" strokeWidth="6" />
                  <motion.circle
                    cx="32"
                    cy="32"
                    r="27"
                    fill="none"
                    stroke="#4f46e5"
                    strokeWidth="6"
                    strokeLinecap="round"
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

      <section id="input-cepat" className="relative scroll-mt-24 overflow-hidden px-5 py-24 sm:px-6 sm:py-32">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"
        />
        <div className="mx-auto grid grid-cols-1 max-w-7xl items-center gap-16 lg:grid-cols-2">
          <Reveal>
            <p className="fs-11 font-bold uppercase tracking-[0.3em] text-indigo-600">Input Cepat</p>
            <h2 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">
              Catat dalam hitungan detik. Dengan cara Anda.
            </h2>
            <p className="mt-6 max-w-lg text-slate-500 leading-relaxed">
              Ketik seperti menulis catatan, ucapkan, atau foto struknya. Nominal, kategori, rekening, dan tanggal
              terisi sendiri — Anda tinggal memeriksa lalu menyimpan.
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
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600">
                      <I size={17} />
                    </span>
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

      <section
        id="fitur"
        className="relative scroll-mt-24 border-y border-slate-200/70 bg-white px-5 py-24 sm:px-6 sm:py-32"
      >
        <div className="mx-auto max-w-7xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="fs-11 font-bold uppercase tracking-[0.3em] text-indigo-600">Fitur</p>
            <h2 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">Lengkap, tanpa terasa rumit.</h2>
          </Reveal>
          <div className="mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-[28px] border border-slate-200/80 bg-slate-200/70 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <Reveal
                key={f.title}
                delay={(i % 4) * 0.06}
                y={16}
                className="group bg-white p-5 sm:p-7 transition-colors duration-500 hover:bg-slate-50"
              >
                <span className="inline-block transition-transform duration-500 group-hover:-translate-y-1">
                  <IconChip icon={f.icon} tone={f.tone} />
                </span>
                <h3 className="mt-4 sm:mt-5 text-sm sm:text-base font-semibold">{f.title}</h3>
                <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-500">{f.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="pajak" className="relative scroll-mt-24 px-5 py-24 sm:px-6 sm:py-32">
        <Reveal className="lp-card relative mx-auto grid grid-cols-1 max-w-7xl items-center gap-12 overflow-hidden rounded-[36px] p-8 sm:p-14 lg:grid-cols-2">
          <div
            aria-hidden
            className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.12),transparent)]"
          />
          <div className="relative">
            <p className="fs-11 font-bold uppercase tracking-[0.3em] text-indigo-600">Pajak Center</p>
            <h2 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">
              SPT tahunan, disiapkan dari catatan Anda.
            </h2>
            <p className="mt-6 max-w-lg leading-relaxed text-slate-500">
              Harta, penghasilan, dan estimasi PPh dirangkum otomatis dari transaksi sepanjang tahun — siap Anda pakai
              saat lapor.
            </p>
            <p className="mt-6 max-w-lg border-l-2 border-indigo-200 pl-4 text-xs leading-relaxed text-slate-500">
              Leosiqra menghitung &amp; menyusun ringkasan SPT. Pelaporan resmi tetap Anda kirim sendiri melalui{' '}
              <a
                href="https://coretaxdjp.pajak.go.id/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 underline-offset-4 hover:underline"
              >
                coretaxdjp.pajak.go.id
              </a>
              .
            </p>
          </div>
          <ul className="relative space-y-3">
            {[
              'Daftar harta otomatis dari saldo & investasi',
              'Estimasi PPh dengan PTKP',
              'Ringkasan penghasilan setahun',
              'Ekspor Excel & PDF',
            ].map((item, i) => (
              <motion.li
                key={item}
                initial={reduce ? false : { opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 + i * 0.1, duration: 0.7 }}
                className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 px-5 py-4"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                  <Check size={14} />
                </span>
                <span className="text-sm">{item}</span>
              </motion.li>
            ))}
          </ul>
        </Reveal>
      </section>

      <section className="relative px-5 py-24 sm:px-6 sm:py-32">
        <div className="mx-auto max-w-7xl">
          <Reveal className="max-w-2xl">
            <p className="fs-11 font-bold uppercase tracking-[0.3em] text-indigo-600">Prinsip kami</p>
            <h2 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">Dibangun untuk dipercaya.</h2>
          </Reveal>
          <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3">
            {PRINCIPLES.map((p, i) => (
              <Reveal key={p.title} delay={i * 0.1} className="lp-card lift rounded-[28px] p-8">
                <IconChip icon={p.icon} tone={p.tone} size="lg" />
                <h3 className="mt-6 font-serif text-2xl">{p.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">{p.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="cara-kerja" className="relative scroll-mt-24 px-5 py-24 sm:px-6 sm:py-32">
        <div className="mx-auto max-w-7xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="fs-11 font-bold uppercase tracking-[0.3em] text-indigo-600">Cara mulai</p>
            <h2 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">
              Tiga langkah menuju keuangan yang tenang.
            </h2>
          </Reveal>
          <div className="relative mt-16 grid grid-cols-1 gap-10 md:grid-cols-3">
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
                <span className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-indigo-200 bg-white shadow-sm font-serif text-xl text-indigo-600">
                  {s.n}
                </span>
                <h3 className="mt-6 font-serif text-2xl">{s.title}</h3>
                <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-slate-500">{s.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="harga" className="relative scroll-mt-24 px-5 py-24 sm:px-6 sm:py-32">
        <div className="mx-auto max-w-5xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="fs-11 font-bold uppercase tracking-[0.3em] text-indigo-600">Harga</p>
            <h2 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">Coba dulu. Lanjutkan kalau cocok.</h2>
          </Reveal>
          <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Reveal className="lp-card flex flex-col rounded-[32px] p-9">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Masa coba</p>
              <p className="mt-4 font-serif text-5xl">Rp 0</p>
              <p className="mt-1 text-sm text-slate-500">selama 14 hari · tanpa kartu kredit</p>
              <ul className="mt-8 flex-1 space-y-3 text-sm">
                {[
                  'Semua fitur aktif',
                  'Input Cepat: ketik, suara, foto struk',
                  'Tabungan, hutang, investasi',
                  'Aplikasi Android & web',
                ].map((x) => (
                  <li key={x} className="flex items-center gap-3">
                    <Check size={15} className="text-indigo-600" /> {x}
                  </li>
                ))}
              </ul>
              <Link
                href="/mulai"
                className="lp-btn mt-10 block rounded-full py-4 text-center text-sm font-bold transition-all hover:-translate-y-0.5"
              >
                Mulai gratis
              </Link>
            </Reveal>
            <Reveal
              delay={0.1}
              className="relative flex flex-col overflow-hidden rounded-[32px] border border-indigo-200 bg-gradient-to-b from-indigo-50 to-white p-9 shadow-[0_24px_60px_-32px_rgba(79,70,229,0.35)]"
            >
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">Pro</p>
              <p className="mt-4 font-serif text-4xl leading-tight">Semua fitur, tanpa batas waktu.</p>
              <p className="mt-3 text-sm text-slate-500">
                Lanjutkan setelah masa coba. Harga & cara pembayaran tersedia di dalam aplikasi.
              </p>
              <ul className="mt-8 flex-1 space-y-3 text-sm">
                {[
                  'Semua fitur tetap aktif',
                  'Pajak Center & laporan tahunan',
                  'Asisten AI',
                  'Pengingat & notifikasi',
                ].map((x) => (
                  <li key={x} className="flex items-center gap-3">
                    <Check size={15} className="text-indigo-600" /> {x}
                  </li>
                ))}
              </ul>
              <Link
                href="/hubungi-kami"
                className="mt-10 block rounded-full border border-indigo-200 bg-white py-4 text-center text-sm font-bold text-indigo-600 transition-colors hover:bg-indigo-50"
              >
                Tanya tim kami
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {developer?.photoUrl && (
        <section className="px-5 pb-8 sm:px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <div className="relative mx-auto h-24 w-24 overflow-hidden rounded-full ring-4 ring-white shadow-xl shadow-slate-200">
              <Image
                src={developer.photoUrl}
                alt={developer.name || 'Pendiri Leosiqra'}
                fill
                className="object-cover"
              />
            </div>
            <p className="mt-6 fs-10 font-bold uppercase tracking-[0.3em] text-indigo-600">Di balik Leosiqra</p>
            {developer.name && <h3 className="mt-2 font-serif text-3xl">{developer.name}</h3>}
            {developer.quote && (
              <p className="mt-5 font-serif text-xl italic leading-relaxed text-slate-600">
                &ldquo;{developer.quote}&rdquo;
              </p>
            )}
          </Reveal>
        </section>
      )}

      <section className="relative px-5 py-20 sm:px-6 sm:py-28">
        <Reveal className="relative mx-auto max-w-6xl overflow-hidden rounded-[40px] bg-gradient-to-br from-[#070d1f] via-[#0d1638] to-[#1b1150] px-6 py-16 text-center text-white shadow-[0_40px_100px_-40px_rgba(15,23,42,0.8)] sm:px-12 sm:py-24">
          <Aurora />
          <div className="relative">
            <h2 className="text-4xl font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-6xl">
              Mulai hari ini.
              <br />
              <span className="lp-gold">Tenang seterusnya.</span>
            </h2>
            <p className="mx-auto mt-6 max-w-md text-white/65">
              Buat akun gratis dan lihat kondisi keuangan Anda dengan jernih — dalam hitungan menit.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/mulai"
                className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-300 to-orange-400 px-9 py-4 text-sm font-extrabold text-slate-950 shadow-[0_16px_40px_-14px_rgba(251,191,36,0.85)] transition-all hover:-translate-y-0.5 sm:w-auto"
              >
                Daftar gratis{' '}
                <ArrowUpRight
                  size={17}
                  className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </Link>
              <Link
                href="/hubungi-kami"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/30 px-9 py-4 text-sm font-bold text-white transition-colors hover:bg-white/10 sm:w-auto"
              >
                <Globe2 size={16} /> Hubungi kami
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      <LandingFooter />
    </div>
  );
}
