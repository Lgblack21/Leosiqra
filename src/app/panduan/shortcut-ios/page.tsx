"use client";

import Link from 'next/link';
import {
  Smartphone,
  KeyRound,
  Type,
  Send,
  BellRing,
  Sparkles,
  HelpCircle,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { LandingFooter } from '@/components/LandingFooter';
import { cn } from '@/lib/utils';

type StepKind = 'input' | 'network' | 'logic' | 'output';

const KIND_STYLES: Record<StepKind, { label: string; icon: string; card: string; badge: string }> = {
  input: {
    label: 'Input',
    icon: 'bg-amber-50 text-amber-600',
    card: 'border-l-amber-400',
    badge: 'bg-amber-50 text-amber-600',
  },
  network: {
    label: 'Network',
    icon: 'bg-indigo-50 text-indigo-600',
    card: 'border-l-indigo-500',
    badge: 'bg-indigo-50 text-indigo-600',
  },
  logic: {
    label: 'Logic',
    icon: 'bg-violet-50 text-violet-600',
    card: 'border-l-violet-400',
    badge: 'bg-violet-50 text-violet-600',
  },
  output: {
    label: 'Output',
    icon: 'bg-emerald-50 text-emerald-600',
    card: 'border-l-emerald-500',
    badge: 'bg-emerald-50 text-emerald-600',
  },
};

interface Step {
  n: number;
  kind: StepKind;
  Icon: typeof Type;
  title: string;
  desc: string;
  recipe: { k: string; v: string }[];
}

const steps: Step[] = [
  {
    n: 1,
    kind: 'network',
    Icon: Send,
    title: 'Get Contents of URL',
    desc: 'Ini satu-satunya action inti. Tambahkan action "Get Contents of URL", tempel URL-nya, lalu tap "Show More" untuk memunculkan Method, Headers, dan Request Body.',
    recipe: [
      { k: 'URL', v: 'https://www.leosiqra.com/api/member/quick-transaction' },
      { k: 'Method', v: 'POST' },
      { k: 'Header 1', v: 'Authorization  →  Bearer TOKEN_ANDA' },
      { k: 'Header 2', v: 'Content-Type  →  application/json' },
      { k: 'Request Body', v: 'JSON (lihat kartu di bawah)' },
    ],
  },
  {
    n: 2,
    kind: 'output',
    Icon: BellRing,
    title: 'Show Notification (opsional)',
    desc: 'Biar ada konfirmasi setelah transaksi terkirim. Boleh dilewati kalau tidak mau.',
    recipe: [
      { k: 'Title', v: 'Leosiqra' },
      { k: 'Body', v: 'Transaksi berhasil dicatat ✓' },
    ],
  },
];

const faqs = [
  {
    q: 'Kok cuma 1 action? Nggak perlu Ask for Input berlapis?',
    a: 'Tidak. Setiap field di Request Body diisi "Ask Each Time" — Shortcuts otomatis menanyakannya tiap kali dijalankan. Jadi tidak perlu action Ask for Input, Choose from Menu, atau Set Variable terpisah.',
  },
  {
    q: 'Respons error 401 / Unauthorized',
    a: 'Token salah ketik atau sudah dicabut. Cek lagi header Authorization (harus "Bearer " lalu token), atau buat token baru dari Profile → Akses API.',
  },
  {
    q: 'Respons error "Akun tidak ditemukan"',
    a: 'Nama akun yang diketik tidak cocok dengan rekening manapun. Errornya menyebutkan daftar nama akun yang tersedia — cek ejaannya, atau cukup ketik sebagian nama yang unik (mis. "BCA" untuk "BCA Utama").',
  },
  {
    q: 'Untuk field "type" harus ketik apa?',
    a: 'Ketik persis "pengeluaran" atau "pemasukan" (huruf kecil semua). Spasi & huruf besar ditoleransi server, tapi selain dua kata itu akan ditolak.',
  },
];

function StepCard({ step }: { step: Step }) {
  const style = KIND_STYLES[step.kind];
  return (
    <div className={cn('relative bg-white rounded-[24px] border border-slate-100 border-l-[3px] shadow-sm p-6 md:p-7', style.card)}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-4">
          <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center shrink-0', style.icon)}>
            <step.Icon size={18} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Langkah {step.n}</p>
            <h3 className="text-base font-black text-slate-900 tracking-tight">{step.title}</h3>
          </div>
        </div>
        <span className={cn('shrink-0 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest', style.badge)}>
          {style.label}
        </span>
      </div>
      <p className="text-sm text-slate-500 font-medium leading-relaxed mb-4">{step.desc}</p>
      {step.recipe.length > 0 && (
        <div className="bg-slate-50 rounded-xl p-4 space-y-2">
          {step.recipe.map((r, i) => (
            <div key={i} className="grid grid-cols-[90px_1fr] gap-3 text-xs">
              <span className="font-bold text-slate-400">{r.k}</span>
              <span className="font-mono text-slate-700 break-words">{r.v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ShortcutIosGuidePage() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-indigo-500/10">
      <Navbar />

      <section className="relative pt-40 pb-16 px-6 overflow-hidden">
        <div className="hero-aurora" aria-hidden />
        <div className="dot-grid" aria-hidden />
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2.5 pl-2.5 pr-4 py-1.5 rounded-full bg-white/70 backdrop-blur border border-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-[0.2em] mb-8 shadow-sm mx-auto">
            <Smartphone size={13} />
            Panduan Shortcut iOS · cukup 1 action
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-black tracking-tight mb-6 text-slate-900 leading-[1.1]">
            Input transaksi harian <span className="text-gradient">tanpa buka aplikasi</span>
          </h1>
          <p className="max-w-2xl mx-auto text-slate-500 text-base sm:text-lg font-medium leading-relaxed">
            Rakit satu Shortcut sederhana di iPhone — <strong className="text-slate-700">cuma satu action</strong> &quot;Get Contents of URL&quot; —
            yang langsung mengirim transaksi ke akun Leosiqra kamu. Tinggal tap dari Home Screen atau Action Button,
            isi nominal/kategori/akun, selesai. Server yang mencocokkan akunnya, jadi tidak perlu langkah berlapis.
          </p>
        </div>
      </section>

      <section className="px-6 pb-8">
        <div className="max-w-4xl mx-auto bg-slate-900 rounded-[32px] p-6 md:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 text-white/5 hidden md:block">
            <KeyRound size={100} />
          </div>
          <h2 className="text-[11px] font-black text-white/50 uppercase tracking-widest mb-5 relative z-10">Sebelum mulai</h2>
          <ol className="space-y-4 relative z-10">
            <li className="flex gap-4">
              <span className="w-6 h-6 rounded-lg bg-white/10 text-white flex items-center justify-center text-[11px] font-black shrink-0 mt-0.5">1</span>
              <p className="text-sm text-white/80 font-medium leading-relaxed">
                Masuk ke akun Leosiqra kamu, lalu buka <strong className="text-white">Profile → Akses API</strong>, tap tombol tambah, beri nama <em>&quot;iPhone Shortcut&quot;</em>, lalu <strong className="text-white">Buat Token</strong>.
              </p>
            </li>
            <li className="flex gap-4">
              <span className="w-6 h-6 rounded-lg bg-white/10 text-white flex items-center justify-center text-[11px] font-black shrink-0 mt-0.5">2</span>
              <p className="text-sm text-white/80 font-medium leading-relaxed">
                Salin token yang muncul — hanya tampil <strong className="text-white">satu kali</strong>. Tempel sementara ke Notes supaya gampang dipakai lagi di bawah. Token ini disebut <code className="bg-white/10 text-emerald-300 px-1.5 py-0.5 rounded text-[12px] font-mono">TOKEN_ANDA</code> di seluruh panduan.
              </p>
            </li>
            <li className="flex gap-4">
              <span className="w-6 h-6 rounded-lg bg-white/10 text-white flex items-center justify-center text-[11px] font-black shrink-0 mt-0.5">3</span>
              <p className="text-sm text-white/80 font-medium leading-relaxed">
                Buka app <strong className="text-white">Shortcuts</strong> di iPhone → tab Shortcuts → tombol <strong className="text-white">+</strong> → beri nama <em>&quot;Input Transaksi Leosiqra&quot;</em>.
              </p>
            </li>
          </ol>
        </div>
      </section>

      <section className="px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Rakit Shortcut-nya</span>
            <div className="h-px flex-1 bg-slate-100" />
          </div>
          <div className="space-y-4">
            <StepCard step={steps[0]} />

            <div className="bg-slate-900 rounded-[24px] p-6 md:p-7">
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-3">Request Body — pilih JSON, tambah 5 field</p>
              <div className="space-y-2">
                {[
                  { k: 'type', t: 'Text', a: 'Ask Each Time' },
                  { k: 'amount', t: 'Number', a: 'Ask Each Time' },
                  { k: 'category', t: 'Text', a: 'Ask Each Time' },
                  { k: 'account', t: 'Text', a: 'Ask Each Time' },
                  { k: 'note', t: 'Text', a: 'Ask Each Time' },
                ].map((f) => (
                  <div key={f.k} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 text-[12px] font-mono">
                    <span className="text-emerald-300">{f.k}</span>
                    <span className="text-white/30 text-[10px] uppercase tracking-wider">{f.t}</span>
                    <span className="px-2 py-0.5 rounded-md bg-white/10 text-white/70 text-[10px] font-sans font-bold">{f.a}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-white/40 font-medium mt-4 leading-relaxed">
                Tiap field: ketik nama key (mis. <span className="font-mono text-white/60">amount</span>), set tipenya, lalu tap kolom nilainya → pilih <strong className="text-white/70">&quot;Ask Each Time&quot;</strong>. Shortcuts otomatis menanyakannya tiap dijalankan — jadi tidak perlu action Ask for Input terpisah.
              </p>
            </div>

            <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-100 rounded-2xl p-5">
              <ShieldAlert size={18} className="text-emerald-500 shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-emerald-800 leading-relaxed">
                <strong>Otomatis di server:</strong> tidak perlu kirim <code className="bg-emerald-100/70 px-1.5 py-0.5 rounded text-[11px] font-mono">account_id</code>, <code className="bg-emerald-100/70 px-1.5 py-0.5 rounded text-[11px] font-mono">currency</code>, <code className="bg-emerald-100/70 px-1.5 py-0.5 rounded text-[11px] font-mono">amount_idr</code>, atau <code className="bg-emerald-100/70 px-1.5 py-0.5 rounded text-[11px] font-mono">date</code>. Server mencocokkan nama akun ke rekening asli kamu, mengambil mata uangnya, mengonversi ke IDR pakai kurs live kalau bukan IDR, dan memakai tanggal hari ini secara otomatis.
              </p>
            </div>

            <StepCard step={steps[1]} />
          </div>
        </div>
      </section>

      <section className="px-6 py-8">
        <div className="max-w-4xl mx-auto bg-gradient-to-br from-indigo-50 to-white rounded-[32px] border border-indigo-100 p-6 md:p-8">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles size={18} className="text-indigo-500" />
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Bikin sekali tap</h2>
          </div>
          <ul className="space-y-2.5 text-sm text-slate-600 font-medium leading-relaxed">
            <li className="flex gap-2"><ArrowRight size={14} className="text-indigo-400 shrink-0 mt-1" /><span><strong className="text-slate-900">Home Screen</strong> — tombol Share di editor Shortcut → &quot;Add to Home Screen&quot; untuk ikon sendiri.</span></li>
            <li className="flex gap-2"><ArrowRight size={14} className="text-indigo-400 shrink-0 mt-1" /><span><strong className="text-slate-900">Action Button</strong> (iPhone 15 Pro ke atas) — Settings → Action Button → Shortcut → pilih shortcut ini.</span></li>
            <li className="flex gap-2"><ArrowRight size={14} className="text-indigo-400 shrink-0 mt-1" /><span><strong className="text-slate-900">Siri</strong> — otomatis bisa dipanggil lewat nama shortcut-nya, atau atur frasa custom di pengaturan shortcut.</span></li>
          </ul>
        </div>
      </section>

      <section className="px-6 py-8 pb-20">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <HelpCircle size={16} className="text-slate-400" />
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Kalau ada yang gagal</span>
          </div>
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <p className="text-sm font-black text-slate-900 mb-1.5">{f.q}</p>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <p className="text-sm text-slate-400 font-medium mb-4">Belum punya akun Leosiqra?</p>
            <Link
              href="/auth/register"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-[#0F172A] to-indigo-700 text-white hover:shadow-indigo-500/30 hover:-translate-y-0.5 transition-all font-bold text-sm shadow-lg shadow-slate-200"
            >
              Daftar Gratis <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
