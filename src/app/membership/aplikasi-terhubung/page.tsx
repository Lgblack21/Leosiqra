"use client";

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CalendarDays, Check, Copy, FileSpreadsheet, Link2, MessageCircle, Send, Smartphone, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { connectService, type ConnectLink, type ConnectPurpose } from '@/lib/services/connectService';
import { useFeedback } from '@/components/ui/Feedback';

// Aplikasi terhubung lewat link rahasia (tanpa login Google): Shortcuts →
// Kotak masuk, Google Calendar (langganan iCal), Google Sheets (IMPORTDATA).
// Link hanya ditampilkan sekali; buat ulang = link lama langsung mati.

type Card = {
  purpose: ConnectPurpose;
  title: string;
  desc: string;
  icon: typeof Smartphone;
  tone: string;
  steps: (url: string) => React.ReactNode[];
  copyValue: (url: string) => string;
  copyLabel: string;
  warn?: string;
};

const CARDS: Card[] = [
  {
    purpose: 'inbox',
    title: 'Shortcuts (iPhone) & HTTP Shortcuts (Android)',
    desc: 'Catat dari HP tanpa buka aplikasi — ucapkan “kopi 25rb pakai gopay”, langsung masuk ke Kotak masuk untuk ditinjau.',
    icon: Smartphone,
    tone: 'bg-indigo-50 text-indigo-600',
    copyValue: (u) => u,
    copyLabel: 'Salin link',
    steps: () => [
      <>iPhone: buka app <b>Shortcuts</b> → buat shortcut baru → tambah aksi <b>Dikte Teks</b> (atau <b>Minta Input</b>).</>,
      <>Tambah aksi <b>Dapatkan Isi URL</b>: tempel link di atas, metode <b>POST</b>, isi permintaan <b>File</b> = hasil dikte.</>,
      <>Android: pasang <b>HTTP Shortcuts</b> → shortcut baru → metode POST ke link di atas, isi body dari variabel teks.</>,
      <>Coba ucapkan “bakso 25 ribu” — drafnya muncul di <b>Kotak masuk</b>.</>,
    ],
  },
  {
    purpose: 'calendar',
    title: 'Google Calendar',
    desc: 'Tagihan dan transaksi rutin muncul sebagai acara di kalendermu, lengkap dengan pengulangannya.',
    icon: CalendarDays,
    tone: 'bg-sky-50 text-sky-600',
    copyValue: (u) => u,
    copyLabel: 'Salin link kalender',
    steps: () => [
      <>Buka <b>calendar.google.com</b> di laptop.</>,
      <>Di kiri, klik <b>+</b> di samping “Kalender lain” → <b>Dari URL</b>.</>,
      <>Tempel link di atas → <b>Tambahkan kalender</b>. Google memperbarui isinya otomatis beberapa jam sekali.</>,
    ],
  },
  {
    purpose: 'sheets',
    title: 'Google Sheets',
    desc: 'Transaksi 12 bulan terakhir tersalin ke spreadsheet dan ikut diperbarui otomatis.',
    icon: FileSpreadsheet,
    tone: 'bg-emerald-50 text-emerald-600',
    copyValue: (u) => `=IMPORTDATA("${u}")`,
    copyLabel: 'Salin rumus',
    warn: 'Siapa pun yang punya link ini bisa melihat transaksimu. Jangan bagikan spreadsheet-nya ke orang lain — kalau terlanjur, buat ulang link.',
    steps: () => [
      <>Buat spreadsheet baru di <b>sheets.google.com</b>.</>,
      <>Klik sel <b>A1</b>, tempel rumus di atas, tekan Enter.</>,
      <>Data terisi otomatis dan diperbarui berkala oleh Google.</>,
    ],
  },
];

const fmt = (s?: string | null) => (s ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(s)) : null);

export default function AplikasiTerhubungPage() {
  const { toast, confirm } = useFeedback();
  const [links, setLinks] = useState<ConnectLink[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [fresh, setFresh] = useState<Partial<Record<ConnectPurpose, string>>>({});
  const [copied, setCopied] = useState<ConnectPurpose | null>(null);
  const [busy, setBusy] = useState<ConnectPurpose | null>(null);

  const load = useCallback(() => {
    connectService
      .list()
      .then(setLinks)
      .catch(() => {
        setLinks([]);
        setUnavailable(true);
      });
  }, []);
  useEffect(load, [load]);

  const create = async (purpose: ConnectPurpose, existing: boolean) => {
    if (existing) {
      const ok = await confirm({ title: 'Buat ulang link?', message: 'Link lama langsung tidak berlaku. Kamu perlu menempel link baru di aplikasi yang sudah terhubung.', confirmLabel: 'Buat ulang' });
      if (!ok) return;
    }
    setBusy(purpose);
    try {
      const url = await connectService.create(purpose);
      setFresh((f) => ({ ...f, [purpose]: url }));
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal membuat link.');
    } finally {
      setBusy(null);
    }
  };
  const revoke = async (purpose: ConnectPurpose) => {
    const ok = await confirm({ title: 'Putuskan?', message: 'Link berhenti bekerja dan aplikasi yang memakainya tidak bisa mengakses datamu lagi.', confirmLabel: 'Putuskan', danger: true });
    if (!ok) return;
    setBusy(purpose);
    try {
      await connectService.revoke(purpose);
      setFresh((f) => ({ ...f, [purpose]: undefined }));
      load();
    } catch {
      toast.error('Gagal memutuskan.');
    } finally {
      setBusy(null);
    }
  };
  const copy = async (purpose: ConnectPurpose, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(purpose);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      toast.error('Gagal menyalin.');
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-12">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Aplikasi terhubung</h1>
        <p className="mt-0.5 text-sm text-slate-500">Hubungkan aplikasi yang sudah kamu pakai lewat link pribadi. Leosiqra tidak pernah meminta kata sandi akun lain.</p>
      </div>

      {unavailable && <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">Fitur ini belum aktif. Coba lagi nanti ya.</div>}

      {CARDS.map((c) => {
        const link = links?.find((l) => l.purpose === c.purpose);
        const url = fresh[c.purpose];
        return (
          <div key={c.purpose} className="rounded-[26px] border border-slate-100 bg-white p-5 shadow-[0_8px_30px_-18px_rgba(49,46,129,0.25)] md:p-6">
            <div className="flex flex-wrap items-start gap-4">
              <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl', c.tone)}><c.icon size={22} /></span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-bold text-slate-900">
                  {c.title}
                  {link && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-600">Terhubung</span>}
                </p>
                <p className="mt-0.5 text-sm text-slate-500">{c.desc}</p>
                {link && (
                  <p className="mt-1 text-xs text-slate-400">
                    Dibuat {fmt(link.created_at)}{link.last_used_at ? ` · terakhir dipakai ${fmt(link.last_used_at)}` : ' · belum pernah dipakai'}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                {link && (
                  <button type="button" onClick={() => revoke(c.purpose)} disabled={busy !== null || unavailable} aria-label={`Putuskan ${c.title}`} className="rounded-xl p-2.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500">
                    <Trash2 size={16} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => create(c.purpose, Boolean(link))}
                  disabled={busy !== null || unavailable}
                  className={cn('flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold', link ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-slate-900 text-white hover:bg-slate-800')}
                >
                  <Link2 size={15} /> {busy === c.purpose ? 'Sebentar…' : link ? 'Buat ulang link' : 'Hubungkan'}
                </button>
              </div>
            </div>

            {url && (
              <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
                <p className="text-xs font-semibold text-indigo-700">Simpan sekarang — link ini hanya ditampilkan sekali.</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-xl bg-white px-3 py-2 text-xs text-slate-700 ring-1 ring-indigo-100">{c.copyValue(url)}</code>
                  <button type="button" onClick={() => copy(c.purpose, c.copyValue(url))} className="flex shrink-0 items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700">
                    {copied === c.purpose ? <><Check size={13} /> Tersalin</> : <><Copy size={13} /> {c.copyLabel}</>}
                  </button>
                </div>
                <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
                  {c.steps(url).map((s, i) => <li key={i}>{s}</li>)}
                </ol>
              </div>
            )}
            {c.warn && (link || url) && (
              <p className="mt-3 flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {c.warn}
              </p>
            )}
          </div>
        );
      })}

      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { icon: MessageCircle, title: 'WhatsApp Leo', desc: 'Catat & tanya keuangan langsung dari chat WhatsApp.' },
          { icon: Send, title: 'Gmail', desc: 'Pembayaran dari email bank & toko tercatat sendiri.' },
        ].map((x) => (
          <div key={x.title} className="flex items-start gap-3 rounded-[22px] border border-dashed border-slate-200 bg-white/60 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><x.icon size={18} /></span>
            <div>
              <p className="flex items-center gap-2 text-sm font-bold text-slate-700">{x.title} <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">Segera hadir</span></p>
              <p className="text-xs text-slate-500">{x.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
