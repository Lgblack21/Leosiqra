"use client";

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Bot, CalendarDays, Check, ChevronRight, Mail, MonitorSmartphone, ShieldCheck, Sparkles, Zap, Sheet, NotebookText, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LeoAvatarSvg, DEFAULT_AVATAR } from '@/components/profile/LeoAvatar';
import { McpConnectCard } from '@/components/profile/McpConnectCard';
import { CalendarSyncCard, ComposioAppView, SheetsSyncCard, useComposioApps, type AppAccess } from '@/components/settings/ConnectedApps';
import { InboxControls, useInbox } from '@/components/inbox/InboxControls';

function GmailInboxSection() {
  const inbox = useInbox();
  return <InboxControls inbox={inbox} showLink />;
}

// Aplikasi terhubung — halaman sendiri (bukan panel). Daftar aplikasi
// beserta fungsinya; detail tiap aplikasi dibuka di halaman yang sama lewat
// ?app=<id> supaya tombol Kembali browser & tautan balik dari Composio jalan.

type AppId = 'gmail' | 'googlecalendar' | 'googlesheets' | 'mcp';

type AppInfo = {
  id: AppId;
  name: string;
  icon: React.ElementType;
  tile: string;
  tagline: string;
  bullets: string[];
  beta?: boolean;
  steps: string[];
};

const APPS: Record<AppId, AppInfo> = {
  gmail: {
    id: 'gmail',
    name: 'Gmail',
    icon: Mail,
    tile: 'bg-rose-50 text-rose-600',
    tagline: 'Catatan dari email pembayaran, tanpa ketik ulang.',
    bullets: ['Membaca email dari bank, e-wallet & toko', 'Diusulkan jadi transaksi — kamu yang menyetujui', 'Teks email tidak disimpan setelah dibaca'],
    steps: ['Hubungkan akun Gmail lewat Google.', 'Nyalakan "Baca email pembayaran otomatis" atau tekan Periksa email sekarang.', 'Buka Kotak Masuk, cek usulannya, lalu Simpan atau Abaikan.'],
  },
  googlecalendar: {
    id: 'googlecalendar',
    name: 'Google Calendar',
    icon: CalendarDays,
    tile: 'bg-sky-50 text-sky-600',
    tagline: 'Jadwal transaksi berulang & jatuh tempo kartu muncul di kalendermu.',
    bullets: ['Transaksi berulang (gaji, langganan, tabungan) jadi pengingat', 'Jatuh tempo kartu kredit tiap bulan', 'Hanya pengingat — pencatatan tetap otomatis di Leosiqra'],
    steps: ['Hubungkan Google Calendar.', 'Tekan "Salin jadwal ke kalender".', 'Selesai — Leosiqra memperbaruinya sendiri tiap hari.'],
  },
  googlesheets: {
    id: 'googlesheets',
    name: 'Google Sheets',
    icon: Sheet,
    tile: 'bg-emerald-50 text-emerald-600',
    tagline: 'Salinan semua transaksimu di spreadsheet, selalu ter-update.',
    bullets: ['Spreadsheet "Leosiqra — Transaksi" di Drive-mu', 'Ikut berubah saat transaksi diedit/dihapus', 'Enak untuk olah data, pivot & laporan sendiri'],
    steps: ['Hubungkan Google Sheets.', 'Tekan "Buat spreadsheet & salin".', 'Selesai — Leosiqra memperbaruinya sendiri tiap hari.'],
  },
  mcp: {
    id: 'mcp',
    name: 'Claude & ChatGPT',
    icon: Bot,
    tile: 'bg-indigo-50 text-indigo-600',
    tagline: 'Tanya & catat keuangan langsung dari asisten AI favoritmu.',
    bullets: ['"Pengeluaran makan bulan ini berapa?"', '"Catat kopi 25rb pakai BCA"', 'Akses bisa dicabut kapan saja'],
    steps: ['Buka Claude atau ChatGPT, tambahkan connector Leosiqra.', 'Masuk dengan akun Leosiqra & izinkan.', 'Mulai bertanya atau mencatat dari chat.'],
  },
};

const StatusChip = ({ on }: { on: boolean }) =>
  on ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[12px] font-semibold text-emerald-700">
      <Check size={12} strokeWidth={3} /> Terhubung
    </span>
  ) : null;

function AppCard({ app, connected, onOpen, disabledNote, price }: { app: AppInfo; connected?: boolean; onOpen: () => void; disabledNote?: string; price?: string }) {
  const Icon = app.icon;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex h-full flex-col rounded-[24px] bg-white p-5 text-left ring-1 ring-slate-100 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-12px_rgba(79,70,229,0.25)] hover:ring-indigo-100"
    >
      <div className="flex items-start gap-4">
        <span className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl', app.tile)}>
          <Icon size={26} strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[18px] font-bold text-slate-900">{app.name}</span>
            {app.beta && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-700">Beta</span>}
            <StatusChip on={Boolean(connected)} />
          </div>
          {price && <p className="mt-1 text-[12px] font-semibold text-indigo-600">{price}</p>}
          <p className="mt-1 text-[14px] leading-snug text-slate-500">{app.tagline}</p>
          {disabledNote && <p className="mt-1 text-[12px] font-medium text-rose-500">{disabledNote}</p>}
        </div>
      </div>
      <ul className="mt-4 flex-1 space-y-2">
        {app.bullets.map((b) => (
          <li key={b} className="flex items-start gap-2 text-[14px] text-slate-600">
            <Check size={16} className="mt-0.5 shrink-0 text-indigo-500" /> {b}
          </li>
        ))}
      </ul>
      <span
        className={cn(
          'mt-5 inline-flex items-center justify-center gap-1.5 rounded-full py-2.5 text-[14px] font-bold transition-colors',
          connected ? 'bg-slate-100 text-slate-800 group-hover:bg-slate-200' : 'bg-slate-900 text-white group-hover:bg-indigo-600'
        )}
      >
        {connected ? 'Atur' : 'Hubungkan'} <ChevronRight size={16} />
      </span>
    </button>
  );
}

const LinkCard = ({ href, icon: Icon, tile, title, desc, action }: { href: string; icon: React.ElementType; tile: string; title: string; desc: string; action: string }) => (
  <a href={href} className="flex items-center gap-4 rounded-[22px] bg-white p-4 ring-1 ring-slate-100 transition-colors hover:ring-indigo-100">
    <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl', tile)}>
      <Icon size={22} strokeWidth={1.9} />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-[16px] font-semibold text-slate-900">{title}</span>
      <span className="block text-[13px] leading-snug text-slate-500">{desc}</span>
    </span>
    <span className="hidden shrink-0 rounded-full bg-slate-100 px-4 py-2 text-[13px] font-semibold text-slate-800 sm:block">{action}</span>
    <ChevronRight size={18} className="shrink-0 text-slate-400 sm:hidden" />
  </a>
);

const priceLabel = (a?: AppAccess) => {
  if (!a) return undefined;
  if (a.reason === 'pro') return 'Gratis untuk member PRO';
  if (a.reason === 'beta') return 'Gratis selama beta';
  if (a.reason === 'coins' && a.until) return `Aktif sampai ${new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(a.until))}`;
  return `${a.price.toLocaleString('id-ID')} koin / ${a.days} hari · gratis untuk PRO`;
};

function Hub({ open }: { open: (id: AppId) => void }) {
  const { apps } = useComposioApps();
  const composioNote = apps.state === 'error' ? apps.error : undefined;
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-600 p-6 text-white md:p-9">
        <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-center gap-6">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-indigo-200">Aplikasi terhubung</p>
            <h1 className="mt-2 text-[28px] font-extrabold leading-tight tracking-tight md:text-[38px]">Biar Leosiqra kerja sendiri.</h1>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-indigo-100">
              Sambungkan aplikasi yang sudah kamu pakai. Leosiqra bisa menaruh jadwal keuanganmu di kalender, membaca email pembayaran, dan menjawab pertanyaan keuanganmu dari asisten AI.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                [CalendarDays, 'Jadwal di kalender'],
                [Mail, 'Catat dari email'],
                [Sparkles, 'Tanya dari AI'],
              ].map(([Icon, label]) => {
                const I = Icon as React.ElementType;
                return (
                  <span key={label as string} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[13px] font-medium backdrop-blur">
                    <I size={14} /> {label as string}
                  </span>
                );
              })}
            </div>
          </div>
          <LeoAvatarSvg config={DEFAULT_AVATAR} className="hidden h-36 w-36 shrink-0 drop-shadow-xl sm:block md:h-44 md:w-44" />
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-[18px] font-bold text-slate-900">Otomatis dari aplikasimu</h2>
        <p className="mb-4 text-[14px] text-slate-500">Lewat mitra koneksi Composio — kamu masuk di situs Google, Leosiqra tidak pernah melihat kata sandimu.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <AppCard app={APPS.googlecalendar} connected={apps.items.googlecalendar?.connected} onOpen={() => open('googlecalendar')} disabledNote={composioNote} price={priceLabel(apps.access?.googlecalendar)} />
          <AppCard app={APPS.gmail} connected={apps.items.gmail?.connected} onOpen={() => open('gmail')} disabledNote={composioNote} price={priceLabel(apps.access?.gmail)} />
          <AppCard app={APPS.googlesheets} connected={apps.items.googlesheets?.connected} onOpen={() => open('googlesheets')} disabledNote={composioNote} price={priceLabel(apps.access?.googlesheets)} />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-[18px] font-bold text-slate-900">Asisten AI</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <AppCard app={APPS.mcp} onOpen={() => open('mcp')} />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-[18px] font-bold text-slate-900">Catat lebih cepat</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <LinkCard href="/input-cepat" icon={Zap} tile="bg-amber-50 text-amber-600" title="Input Cepat" desc="Catat dari layar utama HP — ketik, suara, atau foto struk." action="Buka" />
          <LinkCard href="/install" icon={MonitorSmartphone} tile="bg-slate-100 text-slate-700" title="Leosiqra di HP, Mac & PC" desc="Pasang sebagai aplikasi, buka dari layar utama atau taskbar." action="Pasang" />
        </div>
      </section>

      <section className="rounded-[24px] bg-slate-50 p-5">
        <p className="text-[14px] font-semibold text-slate-700">Menyusul</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            [NotebookText, 'Notion — laporan bulanan otomatis'],
            [Hash, 'Slack — catat dari pesan channel'],
          ].map(([Icon, label]) => {
            const I = Icon as React.ElementType;
            return (
              <span key={label as string} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[13px] text-slate-500 ring-1 ring-slate-200">
                <I size={14} /> {label as string}
              </span>
            );
          })}
        </div>
      </section>

      <p className="flex items-start gap-2 px-1 text-[13px] leading-relaxed text-slate-400">
        <ShieldCheck size={16} className="mt-0.5 shrink-0" />
        Koneksi dijaga Composio (SOC 2 Type II). Leosiqra tidak pernah melihat kata sandimu, dan kamu bisa memutus aplikasi kapan saja.
      </p>
    </div>
  );
}

function Detail({ id, back }: { id: AppId; back: () => void }) {
  const app = APPS[id];
  const Icon = app.icon;
  return (
    <div className="space-y-6">
      <button type="button" onClick={back} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[14px] font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
        <ArrowLeft size={16} /> Aplikasi terhubung
      </button>
      <div className="flex items-center gap-4">
        <span className={cn('flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px]', app.tile)}>
          <Icon size={30} strokeWidth={1.9} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[26px] font-extrabold tracking-tight text-slate-900 md:text-[32px]">{app.name}</h1>
            {app.beta && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-700">Beta</span>}
          </div>
          <p className="text-[15px] text-slate-500">{app.tagline}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 rounded-[24px] bg-white p-4 ring-1 ring-slate-100 md:p-6">
          {id === 'mcp' ? <McpConnectCard /> : id === 'googlesheets' ? (
            <ComposioAppView toolkit="googlesheets"><SheetsSyncCard /></ComposioAppView>
          ) : id === 'googlecalendar' ? (
            <ComposioAppView toolkit="googlecalendar"><CalendarSyncCard /></ComposioAppView>
          ) : (
            <ComposioAppView toolkit="gmail"><GmailInboxSection /></ComposioAppView>
          )}
        </div>
        <aside className="space-y-4">
          <div className="rounded-[24px] bg-white p-5 ring-1 ring-slate-100">
            <p className="text-[15px] font-bold text-slate-900">Fungsinya</p>
            <ul className="mt-3 space-y-2.5">
              {app.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2 text-[14px] text-slate-600">
                  <Check size={16} className="mt-0.5 shrink-0 text-indigo-500" /> {b}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[24px] bg-white p-5 ring-1 ring-slate-100">
            <p className="text-[15px] font-bold text-slate-900">Cara pakai</p>
            <ol className="mt-3 space-y-3">
              {app.steps.map((s, i) => (
                <li key={s} className="flex gap-3 text-[14px] leading-snug text-slate-600">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[12px] font-bold text-indigo-700">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function AplikasiTerhubungPage() {
  const [app, setApp] = useState<AppId | null>(null);

  // ?app=<id> di URL (juga tautan balik dari Composio) → buka detailnya.
  useEffect(() => {
    const read = () => {
      const p = new URLSearchParams(window.location.search).get('app');
      setApp(p && p in APPS ? (p as AppId) : null);
    };
    read();
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, []);

  const open = useCallback((id: AppId) => {
    window.history.pushState(null, '', `/membership/aplikasi?app=${id}`);
    setApp(id);
    window.scrollTo({ top: 0 });
  }, []);
  const back = useCallback(() => {
    window.history.pushState(null, '', '/membership/aplikasi');
    setApp(null);
  }, []);

  return <div className="mx-auto max-w-5xl pb-12">{app ? <Detail id={app} back={back} /> : <Hub open={open} />}</div>;
}
