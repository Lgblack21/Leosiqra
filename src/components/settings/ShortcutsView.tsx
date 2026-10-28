"use client";

import { useState } from 'react';
import { Mic, ScanLine, MessageSquareText, Copy, Check, ChevronDown, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFeedback } from '@/components/ui/Feedback';

// Panel Pengaturan → Shortcut iPhone. Leosiqra berjalan di browser/PWA, jadi
// Shortcuts cukup MEMBUKA Input Cepat lewat tautan (sesi login ikut dari
// Safari) — tanpa token. Semua jalur hanya mengisi form; user tetap mengecek
// lalu menyimpan sendiri.

const base = () => (typeof window !== 'undefined' ? window.location.origin : 'https://www.leosiqra.com');

type Item = {
  id: string;
  icon: React.ElementType;
  tint: string;
  title: string;
  desc: string;
  steps: string[];
  url: (o: string) => string;
  urlLabel: string;
};

const ITEMS: Item[] = [
  {
    id: 'suara',
    icon: Mic,
    tint: 'bg-rose-50 text-rose-600',
    title: 'Catat dengan suara',
    desc: 'Lewat Siri, Ketuk Bagian Belakang, atau Action Button — langsung mendengarkan.',
    steps: [
      'Buka app Pintasan → ketuk + → Tambah Tindakan → "Buka URL".',
      'Tempel tautan di bawah, beri nama "Catat Leosiqra", lalu Selesai.',
      'Pasang di Pengaturan › Aksesibilitas › Sentuh › Ketuk Bagian Belakang, atau di Action Button. Bisa juga: "Hai Siri, Catat Leosiqra".',
    ],
    url: (o) => `${o}/input-cepat?mulai=suara`,
    urlLabel: 'Tautan suara',
  },
  {
    id: 'layar',
    icon: ScanLine,
    tint: 'bg-violet-50 text-violet-600',
    title: 'Baca tangkapan layar',
    desc: 'Di layar bukti transfer/pembayaran mana pun: jepret, lalu AI membaca nominal & tujuannya.',
    steps: [
      'Pintasan baru → tindakan "Ambil Jepretan Layar", lalu "Salin ke Papan Klip".',
      'Tambahkan "Buka URL" dengan tautan di bawah, lalu Selesai.',
      'Pasang di Ketuk Bagian Belakang › Ketuk Tiga Kali. Di Leosiqra ketuk "Tempel tangkapan layar".',
    ],
    url: (o) => `${o}/input-cepat?mulai=tempel`,
    urlLabel: 'Tautan tangkapan layar',
  },
  {
    id: 'sms',
    icon: MessageSquareText,
    tint: 'bg-emerald-50 text-emerald-600',
    title: 'SMS bank otomatis',
    desc: 'Tiap SMS dari bank masuk, Leosiqra terbuka dengan isian dari pesannya.',
    steps: [
      'Pintasan › Automasi › + › Pesan → pilih pengirim (mis. BCA, BRI), centang "Jalankan Segera".',
      'Tindakan "Buka URL": tempel tautan di bawah, lalu taruh variabel "Isi Pesan" tepat setelah teks=.',
      'Saat SMS masuk, cek isiannya lalu ketuk Simpan.',
    ],
    url: (o) => `${o}/input-cepat?teks=`,
    urlLabel: 'Tautan SMS (+ Isi Pesan)',
  },
];

function CopyRow({ text, label }: { text: string; label: string }) {
  const { toast } = useFeedback();
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      toast.error('Gagal menyalin — tahan lama tautannya lalu Salin.');
    }
  };
  return (
    <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-200">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate text-[13px] text-slate-700">{text}</code>
        <button type="button" onClick={() => void copy()} className={cn('flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold', done ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-900 text-white')}>
          {done ? <Check size={13} /> : <Copy size={13} />} {done ? 'Tersalin' : 'Salin'}
        </button>
      </div>
    </div>
  );
}

export function ShortcutsView() {
  const [open, setOpen] = useState<string | null>(null);
  const origin = base();
  return (
    <div className="space-y-4">
      <p className="px-1 text-[14px] text-slate-600">Catat tanpa membuka menu: pasang sekali di app <b>Pintasan</b> iPhone. Tanpa token — memakai login Leosiqra di Safari. Hasilnya selalu kamu cek dulu sebelum tersimpan.</p>
      <div className="space-y-3">
        {ITEMS.map((it) => {
          const on = open === it.id;
          const url = it.url(origin);
          return (
            <div key={it.id} className={cn('overflow-hidden rounded-[22px] transition', on ? 'bg-slate-50 ring-2 ring-indigo-200' : 'bg-white ring-1 ring-slate-200')}>
              <button type="button" onClick={() => setOpen(on ? null : it.id)} aria-expanded={on} className="flex w-full items-center gap-3 p-4 text-left">
                <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl', it.tint)}><it.icon size={22} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold text-slate-900">{it.title}</span>
                  <span className="block text-[13px] leading-snug text-slate-500">{it.desc}</span>
                </span>
                <ChevronDown size={18} className={cn('shrink-0 text-slate-400 transition-transform', on && 'rotate-180')} />
              </button>
              {on && (
                <div className="space-y-3 px-4 pb-4">
                  <ol className="space-y-2.5">
                    {it.steps.map((s, i) => (
                      <li key={i} className="flex gap-3 text-[14px] leading-snug text-slate-700">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[12px] font-bold text-white">{i + 1}</span>
                        <span className="pt-0.5">{s}</span>
                      </li>
                    ))}
                  </ol>
                  <CopyRow text={url} label={it.urlLabel} />
                  {it.id !== 'sms' && (
                    <a href={url} className="inline-flex items-center gap-1.5 px-1 text-[13px] font-semibold text-indigo-600 hover:underline">
                      Coba sekarang <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="px-1 text-[12px] leading-relaxed text-slate-500">Pastikan sudah login Leosiqra di Safari (atau aplikasi Leosiqra terpasang). Di Android, pakai widget Input Cepat di layar utama.</p>
    </div>
  );
}
