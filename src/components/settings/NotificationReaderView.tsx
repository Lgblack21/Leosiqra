"use client";

import { useEffect, useState } from 'react';
import { BellRing, MessageSquareText, Mail, Sparkles, CheckCircle2, ArrowRight, ClipboardPaste, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

// Panel Pengaturan → Pembaca Notifikasi. Leosiqra berjalan di browser/PWA dan
// tidak bisa membaca notifikasi aplikasi lain sendiri. Yang membaca adalah app
// Pintasan iPhone (Automasi › Aplikasi › "Saat menerima notifikasi", juga
// Automasi › Pesan untuk SMS), lalu membuka Input Cepat `?teks=`. Ditambah
// email bank lewat Kotak Masuk (Gmail) dan tempel teks notifikasi. User tetap
// cek & simpan sendiri — tidak ada yang tercatat otomatis tanpa dilihat.

type Platform = 'ios' | 'android' | 'desktop';

const detect = (): Platform => {
  const ua = navigator.userAgent;
  // iPadOS 13+ mengaku "Macintosh" — bedakan lewat layar sentuh.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
};

const SAMPLE = 'BCA: Transaksi debit Rp 45.000 di KOPI KENANGAN 28/10 12:30';

export function NotificationReaderView({ openShortcut, openHref }: { openShortcut: (recipe: string) => void; openHref: (href: string) => void }) {
  const [platform, setPlatform] = useState<Platform>('desktop');
  const [text, setText] = useState('');
  useEffect(() => setPlatform(detect()), []);

  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t.trim()) setText(t.trim().slice(0, 500));
    } catch {
      // Izin clipboard ditolak — user masih bisa tempel manual di kolom.
    }
  };
  const tryText = text.trim();

  const ways = [
    {
      id: 'notif',
      icon: BellRing,
      tint: 'bg-amber-500',
      title: 'Notifikasi aplikasi bank',
      status: platform === 'android' ? 'Khusus iPhone' : 'Otomatis di iPhone',
      ok: platform !== 'android',
      desc: 'Automasi Pintasan › Aplikasi: tiap notifikasi dari aplikasi bank/e-wallet, Leosiqra terbuka dengan isiannya.',
      cta: 'Pasang di Shortcut iPhone',
      onClick: () => openShortcut('notif'),
    },
    {
      id: 'sms',
      icon: MessageSquareText,
      tint: 'bg-emerald-500',
      title: 'SMS bank',
      status: platform === 'android' ? 'Khusus iPhone' : 'Otomatis di iPhone',
      ok: platform !== 'android',
      desc: 'Automasi Pintasan › Pesan: tiap SMS dari bank, Leosiqra terbuka dengan isian dari pesannya.',
      cta: 'Pasang di Shortcut iPhone',
      onClick: () => openShortcut('sms'),
    },
    {
      id: 'email',
      icon: Mail,
      tint: 'bg-rose-500',
      title: 'Email bank & e-wallet',
      status: 'Semua perangkat',
      ok: true,
      desc: 'Hubungkan Gmail: email transaksi masuk ke Kotak Masuk, dibaca AI, tinggal kamu setujui.',
      cta: 'Hubungkan Gmail',
      onClick: () => openHref('/membership/aplikasi'),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Alur: notifikasi → dibaca → kamu cek */}
      <div className="rounded-[24px] bg-gradient-to-br from-amber-50 via-white to-indigo-50 p-4 ring-1 ring-amber-100">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-amber-700">
          <BellRing size={15} /> Cara kerjanya
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            { icon: BellRing, label: 'Notifikasi bank masuk' },
            { icon: Sparkles, label: 'Leosiqra membaca nominal & tujuan' },
            { icon: CheckCircle2, label: 'Kamu cek, lalu Simpan' },
          ].map((s, i) => (
            <div key={i} className="relative flex flex-col items-center gap-1.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm ring-1 ring-slate-100"><s.icon size={20} /></span>
              <span className="text-[12px] leading-tight text-slate-600">{s.label}</span>
              {i < 2 && <ArrowRight size={14} className="absolute -right-2 top-3.5 text-slate-300" />}
            </div>
          ))}
        </div>
      </div>

      {/* Jalur yang tersedia */}
      <div className="space-y-3">
        <p className="px-1 text-[14px] text-slate-500">Jalur yang bisa dipakai</p>
        {ways.map((w) => (
          <div key={w.id} className="flex gap-3 rounded-[22px] bg-white p-4 ring-1 ring-slate-200">
            <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white', w.tint)}><w.icon size={20} /></span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] font-bold text-slate-900">{w.title}</span>
                <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', w.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>{w.status}</span>
              </div>
              <p className="mt-0.5 text-[13px] leading-snug text-slate-500">{w.desc}</p>
              <button type="button" onClick={w.onClick} className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-indigo-600 hover:underline">
                {w.cta} <ArrowRight size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Tempel teks notifikasi — jalur manual untuk notifikasi aplikasi */}
      <div className="rounded-[22px] bg-slate-50 p-4 ring-1 ring-slate-200">
        <p className="text-[15px] font-bold text-slate-900">Tempel teks notifikasi</p>
        <p className="mt-0.5 text-[13px] leading-snug text-slate-500">Belum pasang otomasi, atau pakai Android? Salin teks notifikasinya, tempel di sini, lalu Leosiqra mengisi formnya.</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 500))}
          rows={3}
          placeholder={SAMPLE}
          aria-label="Teks notifikasi"
          className="mt-3 w-full resize-none rounded-2xl bg-white p-3 text-[14px] text-slate-800 ring-1 ring-slate-200 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-300"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => void paste()} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[13px] font-semibold text-slate-700 ring-1 ring-slate-200">
            <ClipboardPaste size={14} /> Tempel
          </button>
          {!tryText && (
            <button type="button" onClick={() => setText(SAMPLE)} className="rounded-full px-3 py-2 text-[13px] font-medium text-slate-500 hover:text-slate-700">
              Pakai contoh
            </button>
          )}
          <button
            type="button"
            disabled={!tryText}
            onClick={() => openHref(`/input-cepat?teks=${encodeURIComponent(tryText)}`)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
          >
            Baca & isi form <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Batasan yang jujur */}
      <div className="flex gap-2.5 px-1 text-[12px] leading-relaxed text-slate-500">
        <Info size={15} className="mt-0.5 shrink-0 text-slate-400" />
        <p>
          {platform === 'android' ? (
            <>Membaca notifikasi aplikasi lain secara otomatis butuh izin khusus Android yang tidak bisa diberikan ke browser — belum tersedia di Leosiqra. Untuk sekarang pakai email (Gmail) atau tempel teks notifikasi.</>
          ) : (
            <>Notifikasi & SMS dibaca oleh app Pintasan di iPhone-mu, lalu Leosiqra terbuka dengan isiannya. Pastikan sudah login Leosiqra di Safari.</>
          )}
          {' '}Tidak ada yang tersimpan tanpa kamu cek dulu.
        </p>
      </div>
    </div>
  );
}
