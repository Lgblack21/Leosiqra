"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, ArrowRight, Check, Copy, Download, Laptop, MessageCircle, Smartphone } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { LandingFooter } from '@/components/LandingFooter';
import { InstallAnimation, APP_INFO, type InstallApp } from '@/components/install/InstallAnimation';
import { useInstallPrompt, detectPlatform, isInAppBrowser, isNativeApp, type Platform } from '@/lib/pwaInstall';
import { cn } from '@/lib/utils';

const APPS: Record<InstallApp, { tagline: string; points: string[]; when: string }> = {
  leosiqra: {
    tagline: 'Aplikasi lengkap',
    points: ['Saldo semua rekening & kartu', 'Tabungan, budget, investasi, hutang', 'Statistik, laporan & asisten AI'],
    when: 'Untuk melihat & mengatur seluruh keuangan.',
  },
  'input-cepat': {
    tagline: 'Catat kilat',
    points: ['Langsung terbuka di form catat', 'Ketik “25rb kopi”, suara, atau foto struk', 'Ringan — beberapa detik selesai'],
    when: 'Untuk mencatat transaksi secepat mungkin, kapan saja.',
  },
};

export default function InstallPage() {
  const reduce = useReducedMotion();
  const { state: promptState, promptInstall } = useInstallPrompt();
  const [platform, setPlatform] = useState<Platform>('android');
  const [env, setEnv] = useState({ inApp: false, native: false, detected: 'android' as Platform });
  const [tutorialApp, setTutorialApp] = useState<InstallApp>('leosiqra');
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const detected = detectPlatform();
    // Nilai-nilai ini hanya ada di browser — dibaca sekali setelah hydrate.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deteksi perangkat hanya bisa di browser (halaman diprerender statis)
    setPlatform(detected === 'ios' ? 'ios' : 'android');
    setEnv({ inApp: isInAppBrowser(), native: isNativeApp(), detected });
    const q = new URLSearchParams(window.location.search).get('app');
    if (q === 'input-cepat' || q === 'leosiqra') setTutorialApp(q);
  }, []);

  const showTutorial = (app: InstallApp) => {
    setTutorialApp(app);
    document.getElementById('cara-pasang')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  const installLeosiqra = async () => {
    // Dialog install bawaan browser hanya bisa memasang aplikasi milik halaman
    // ini (manifest utama) — tersedia di Chrome/Edge Android & komputer.
    const result = await promptInstall();
    if (result === 'accepted') setNotice('Leosiqra sedang dipasang — cek layar utama HP kamu.');
    else if (result === 'unavailable') showTutorial('leosiqra');
  };

  const pageUrl = 'https://www.leosiqra.com/install';
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard diblokir — user bisa salin manual dari teks di layar */
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f8fb] text-slate-900">
      <Navbar />

      <header className="relative overflow-hidden px-5 pb-10 pt-36 sm:px-6 sm:pt-44">
        <div aria-hidden className="hero-aurora" />
        <div aria-hidden className="dot-grid" />
        <motion.div
          className="relative mx-auto max-w-3xl text-center"
          initial={reduce ? false : { opacity: 0, y: 20, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-indigo-600">Pasang aplikasi</p>
          <h1 className="mt-4 font-serif text-4xl leading-tight sm:text-6xl">
            Leosiqra di <span className="lp-shine italic">layar utama</span> HP-mu
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-500">
            Tanpa Play Store atau App Store, gratis, dan selalu versi terbaru. Ada dua aplikasi — pilih salah satu atau
            pasang keduanya, ikonnya berbeda jadi tidak tertukar.
          </p>
        </motion.div>
      </header>

      <main className="relative flex-1 px-5 pb-24 sm:px-6">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Peringatan kondisi khusus */}
          {env.native && (
            <Callout tone="emerald" icon={Check}>
              Kamu sedang memakai aplikasi Leosiqra — tidak perlu dipasang lagi. Input Cepat tetap bisa dipasang dari
              browser HP (Chrome/Safari).
            </Callout>
          )}
          {env.inApp && (
            <Callout tone="amber" icon={AlertTriangle}>
              Halaman ini terbuka di dalam aplikasi lain (mis. Instagram atau WhatsApp) yang tidak bisa memasang aplikasi.
              Buka <b>leosiqra.com/install</b> di <b>{platform === 'ios' ? 'Safari' : 'Chrome'}</b> dulu.
            </Callout>
          )}
          {env.detected === 'desktop' && (
            <Callout tone="indigo" icon={Laptop}>
              Kamu membuka dari komputer. Aplikasi ini untuk HP — kirim link halaman ini ke HP kamu:
              <span className="mt-3 flex flex-wrap gap-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent('Pasang Leosiqra di HP: ' + pageUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white"
                >
                  <MessageCircle size={14} /> Kirim lewat WhatsApp
                </a>
                <button type="button" onClick={copyLink} className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                  {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />} {copied ? 'Tersalin' : 'Salin link'}
                </button>
              </span>
            </Callout>
          )}
          {notice && (
            <Callout tone="emerald" icon={Check}>
              {notice}
            </Callout>
          )}

          {/* Dua pilihan aplikasi */}
          <div className="grid gap-5 md:grid-cols-2">
            {(['leosiqra', 'input-cepat'] as InstallApp[]).map((app, i) => {
              const info = APP_INFO[app];
              const meta = APPS[app];
              return (
                <motion.div
                  key={app}
                  initial={reduce ? false : { opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.15 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                  className="lp-card flex flex-col rounded-[28px] p-7"
                >
                  <div className="flex items-center gap-4">
                    <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[18px] bg-white shadow-lg ring-1 ring-slate-100">
                      <Image src={info.icon} alt={`Ikon ${info.name}`} fill sizes="64px" className="object-cover" />
                    </span>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-600">{meta.tagline}</p>
                      <h2 className="font-serif text-3xl leading-tight">{info.name}</h2>
                    </div>
                  </div>
                  <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-600">
                    {meta.points.map((p) => (
                      <li key={p} className="flex items-start gap-2">
                        <Check size={16} className="mt-0.5 shrink-0 text-emerald-500" /> {p}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500">{meta.when}</p>
                  <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                    {app === 'leosiqra' ? (
                      promptState === 'installed' ? (
                        <span className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-50 px-5 py-3.5 text-sm font-bold text-emerald-700">
                          <Check size={16} /> Sudah terpasang
                        </span>
                      ) : promptState === 'available' ? (
                        <button type="button" onClick={installLeosiqra} className="lp-btn inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-bold">
                          <Download size={16} /> Pasang Leosiqra
                        </button>
                      ) : (
                        <a href="/app" className="lp-btn inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-bold">
                          <Smartphone size={16} /> Buka Leosiqra
                        </a>
                      )
                    ) : (
                      <a href="/input-cepat?install=1" className="lp-btn inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-bold">
                        <Download size={16} /> Pasang Input Cepat
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => showTutorial(app)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-slate-700 hover:border-slate-300"
                    >
                      Lihat caranya <ArrowRight size={15} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Berdampingan */}
          <div className="lp-card flex flex-col items-center gap-6 rounded-[28px] p-7 sm:flex-row sm:p-8">
            <div className="flex shrink-0 items-end gap-4 rounded-3xl bg-gradient-to-b from-indigo-300 via-violet-300 to-rose-200 px-6 pb-4 pt-6">
              {(['leosiqra', 'input-cepat'] as InstallApp[]).map((app, i) => (
                <motion.div
                  key={app}
                  initial={reduce ? false : { scale: 0, rotate: -10 }}
                  whileInView={{ scale: 1, rotate: 0 }}
                  viewport={{ once: true }}
                  transition={{ type: 'spring', stiffness: 260, damping: 14, delay: i * 0.2 }}
                  className="flex flex-col items-center gap-1.5"
                >
                  <span className="relative block h-14 w-14 overflow-hidden rounded-[16px] bg-white shadow-lg">
                    <Image src={APP_INFO[app].icon} alt="" fill sizes="56px" className="object-cover" />
                  </span>
                  <span className="text-[10px] font-bold text-white drop-shadow">{APP_INFO[app].name}</span>
                </motion.div>
              ))}
            </div>
            <div>
              <h2 className="font-serif text-2xl">Boleh pasang dua-duanya</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Keduanya aplikasi terpisah dengan ikon berbeda — <b>Leosiqra</b> untuk melihat & mengatur semua keuangan,
                <b> Input Cepat</b> untuk mencatat dalam hitungan detik. Datanya sama dan selalu sinkron, jadi transaksi dari
                Input Cepat langsung muncul di Leosiqra.
              </p>
            </div>
          </div>

          {/* Tutorial beranimasi */}
          <section id="cara-pasang" className="lp-card scroll-mt-28 rounded-[28px] p-6 sm:p-9">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-serif text-3xl">Cara memasang</h2>
              <div className="flex flex-wrap gap-2">
                <Segmented
                  value={tutorialApp}
                  onChange={(v) => setTutorialApp(v as InstallApp)}
                  options={[
                    ['leosiqra', 'Leosiqra'],
                    ['input-cepat', 'Input Cepat'],
                  ]}
                />
                <Segmented
                  value={platform}
                  onChange={(v) => setPlatform(v as Platform)}
                  options={[
                    ['android', 'Android'],
                    ['ios', 'iPhone'],
                  ]}
                />
              </div>
            </div>
            <div className="mt-8">
              <InstallAnimation key={`${tutorialApp}-${platform}`} platform={platform} app={tutorialApp} />
            </div>
          </section>

          {/* Tanya-jawab */}
          <section className="lp-card rounded-[28px] p-6 sm:p-9">
            <h2 className="font-serif text-3xl">Kalau ada kendala</h2>
            <div className="mt-5 divide-y divide-slate-100">
              {[
                ['Menu “Instal aplikasi” / “Tambahkan ke Layar Utama” tidak ada', 'Pastikan halaman dibuka di Chrome (Android) atau Safari (iPhone), bukan dari dalam Instagram, WhatsApp, atau aplikasi lain. Di iPhone, pemasangan hanya bisa lewat Safari.'],
                ['Aplikasinya sudah terpasang tapi ingin memasang lagi', 'Hapus ikonnya dari layar utama terlebih dahulu, lalu ulangi langkah pemasangan.'],
                ['Apakah perlu login di tiap aplikasi?', 'Login sekali di masing-masing aplikasi setelah dipasang. Setelah itu kamu tetap masuk sampai memilih keluar.'],
                ['Apakah memakan banyak memori?', 'Tidak. Aplikasinya ringan dan diperbarui otomatis setiap kali dibuka — tidak ada update manual.'],
              ].map(([q, a]) => (
                <details key={q} className="group py-4">
                  <summary className="cursor-pointer list-none font-semibold text-slate-900">
                    <span className="mr-2 inline-block text-indigo-500 transition-transform group-open:rotate-45">+</span>
                    {q}
                  </summary>
                  <p className="mt-2 pl-5 text-sm leading-relaxed text-slate-600">{a}</p>
                </details>
              ))}
            </div>
            <p className="mt-6 text-sm text-slate-500">
              Masih bingung? <Link href="/hubungi-kami" className="font-bold text-indigo-600 hover:underline">Hubungi kami</Link>.
            </p>
          </section>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}

function Callout({ tone, icon: Icon, children }: { tone: 'amber' | 'emerald' | 'indigo'; icon: React.ElementType; children: React.ReactNode }) {
  const tones = {
    amber: 'bg-amber-50 text-amber-900 ring-amber-100',
    emerald: 'bg-emerald-50 text-emerald-900 ring-emerald-100',
    indigo: 'bg-indigo-50 text-indigo-900 ring-indigo-100',
  };
  return (
    <div className={cn('flex gap-3 rounded-2xl p-4 text-sm leading-relaxed ring-1', tones[tone])}>
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="inline-flex rounded-full bg-slate-100 p-1">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn('rounded-full px-4 py-1.5 text-xs font-bold transition-all', value === v ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
