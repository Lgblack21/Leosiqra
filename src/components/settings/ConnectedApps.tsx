"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Sheet, CalendarDays, Zap, MonitorSmartphone, ShieldCheck, Copy, ExternalLink, RefreshCw, Unlink, ChevronRight, Loader2, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { useFeedback } from '@/components/ui/Feedback';
import { McpConnectCard } from '@/components/profile/McpConnectCard';

// Aplikasi terhubung (panel Pengaturan). Hanya integrasi yang benar-benar
// jalan: MCP untuk Claude/ChatGPT, tautan rahasia Google Sheets (CSV untuk
// =IMPORTDATA) & Google Calendar (iCal), Input Cepat, dan pasang aplikasi.

export type AppsView = 'ai' | 'app-mcp' | 'app-sheets' | 'app-calendar' | 'app-gmail';
type Feeds = { sheets: string | null; calendar: string | null };
const LEGACY_FEEDS_VISIBLE = false;

const Tile = ({ icon: Icon, cls }: { icon: React.ElementType; cls: string }) => (
  <span className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ring-1 ring-black/5', cls)}>
    <Icon size={26} strokeWidth={1.9} />
  </span>
);

function useFeeds() {
  const [feeds, setFeeds] = useState<Feeds | null>(null);
  const load = useCallback(async () => {
    try {
      setFeeds(await cloudflareApi<Feeds>('/api/member/feeds'));
    } catch {
      setFeeds({ sheets: null, calendar: null });
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- muat status koneksi sekali saat dibuka
    void load();
  }, [load]);
  return { feeds, reload: load };
}

function AppCard({ icon, tile, title, desc, connected, action, onClick, href }: {
  icon: React.ElementType; tile: string; title: string; desc: string; connected?: boolean; action: string; onClick?: () => void; href?: string;
}) {
  const inner = (
    <>
      <Tile icon={icon} cls={tile} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-[17px] font-semibold text-slate-900">
          {title}
          {connected && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Terhubung</span>}
        </span>
        <span className="mt-0.5 block text-[14px] leading-snug text-slate-500">{desc}</span>
      </span>
      <span className="hidden shrink-0 rounded-full bg-white px-4 py-2 text-[14px] font-semibold text-slate-800 ring-1 ring-slate-200 sm:block">{action}</span>
      <ChevronRight size={18} className="shrink-0 text-slate-400 sm:hidden" />
    </>
  );
  const cls = 'flex w-full items-center gap-4 rounded-[22px] bg-slate-50 p-4 text-left transition-colors hover:bg-slate-100';
  return href ? <a href={href} className={cls}>{inner}</a> : <button type="button" onClick={onClick} className={cls}>{inner}</button>;
}

// Status koneksi Composio. 403 = belum dibuka untuk akun ini (beta admin) →
// kartunya disembunyikan; error lain ditampilkan apa adanya di kartunya.
type ComposioApps = { state: 'loading' | 'hidden' | 'ready' | 'error'; items: Record<string, { connected: boolean }>; error?: string };
function useComposioApps() {
  const [apps, setApps] = useState<ComposioApps>({ state: 'loading', items: {} });
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/member/apps', { credentials: 'include' });
      const body = (await res.json().catch(() => ({}))) as { items?: ComposioApps['items']; error?: string };
      if (res.status === 403 || res.status === 401) setApps({ state: 'hidden', items: {} });
      else if (!res.ok) setApps({ state: 'error', items: {}, error: body.error || 'Belum tersedia.' });
      else setApps({ state: 'ready', items: body.items ?? {} });
    } catch {
      setApps({ state: 'error', items: {}, error: 'Gagal memuat status koneksi.' });
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- muat status koneksi sekali saat dibuka
    void load();
  }, [load]);
  return { apps, reload: load };
}

export function AppsHub({ go }: { go: (v: AppsView) => void }) {
  const { feeds } = useFeeds();
  const { apps } = useComposioApps();
  // Kembali dari halaman login Google (callbackUrl ?terhubung=gmail) → langsung ke layar Gmail.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('terhubung') !== 'gmail') return;
    params.delete('terhubung');
    const rest = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : ''));
    go('app-gmail');
  }, [go]);
  return (
    <div className="space-y-3">
      <p className="px-1 pb-1 text-[15px] leading-relaxed text-slate-500">
        Hubungkan aplikasi yang sudah kamu pakai — asisten AI, pencatatan cepat dari HP, dan aplikasi lain yang menyusul.
      </p>
      {apps.state !== 'hidden' && apps.state !== 'loading' && (
        <AppCard
          icon={Mail}
          tile="bg-rose-50 text-rose-600"
          title="Gmail · Beta"
          desc={apps.state === 'error' ? apps.error ?? 'Belum tersedia.' : 'Hubungkan akun Gmail lewat mitra koneksi Composio. Pencatatan otomatis dari email menyusul.'}
          connected={Boolean(apps.items.gmail?.connected)}
          action={apps.items.gmail?.connected ? 'Atur' : 'Hubungkan'}
          onClick={() => go('app-gmail')}
        />
      )}
      <AppCard icon={Bot} tile="bg-indigo-50 text-indigo-600" title="Claude & ChatGPT" desc="Tanya & catat keuangan dari asisten AI lewat MCP." action="Atur" onClick={() => go('app-mcp')} />
      {/* Cara lama (tautan rahasia IMPORTDATA/iCal) disimpan sebagai cadangan
          kalau Composio bermasalah; kartunya hanya muncul untuk yang sudah
          terlanjur memakainya, supaya tidak dobel dengan versi Composio. */}
      {LEGACY_FEEDS_VISIBLE || feeds?.sheets ? <AppCard icon={Sheet} tile="bg-emerald-50 text-emerald-600" title="Google Sheets" desc="Salinan transaksimu di spreadsheet, ikut ter-update otomatis." connected={Boolean(feeds?.sheets)} action={feeds?.sheets ? 'Atur' : 'Hubungkan'} onClick={() => go('app-sheets')} /> : null}
      {LEGACY_FEEDS_VISIBLE || feeds?.calendar ? <AppCard icon={CalendarDays} tile="bg-sky-50 text-sky-600" title="Google Calendar" desc="Transaksi rutin & jatuh tempo kartu kredit muncul di kalendermu." connected={Boolean(feeds?.calendar)} action={feeds?.calendar ? 'Atur' : 'Hubungkan'} onClick={() => go('app-calendar')} /> : null}
      <AppCard icon={Zap} tile="bg-amber-50 text-amber-600" title="Input Cepat" desc="Catat dari layar utama HP — ketik, suara, atau foto struk." action="Buka" href="/input-cepat" />
      <AppCard icon={MonitorSmartphone} tile="bg-slate-100 text-slate-700" title="Leosiqra di HP, Mac & PC" desc="Pasang sebagai aplikasi, buka langsung dari layar utama atau taskbar." action="Pasang" href="/install" />
      <p className="px-1 pt-2 text-[13px] leading-relaxed text-slate-400">
        Leosiqra tidak pernah melihat kata sandi Google-mu. Memutuskan koneksi langsung mematikan tautannya.
      </p>
    </div>
  );
}

const FEED_COPY = {
  sheets: {
    title: 'Hubungkan Google Sheets',
    intro: 'Leosiqra membuat tautan rahasia berisi transaksimu (maks. 5.000 terbaru). Tempel di Google Sheets, dan isinya ikut ter-update sendiri — Google mengambil ulang tiap ±1 jam.',
    steps: ['Salin rumus di bawah.', 'Buka Google Sheets baru, klik sel A1, lalu tempel.', 'Selesai — transaksimu muncul dan ikut ter-update.'],
    open: { href: 'https://sheets.new', label: 'Buka Google Sheets baru' },
    copyLabel: 'Rumus untuk sel A1',
  },
  calendar: {
    title: 'Hubungkan Google Calendar',
    intro: 'Leosiqra membuat tautan kalender rahasia berisi transaksi rutin aktif dan jatuh tempo kartu kredit (dengan pengingat 2 hari sebelumnya). Juga bisa dipakai di Kalender iPhone & Outlook.',
    steps: ['Salin tautan di bawah.', 'Di Google Calendar (komputer): Setelan → Tambahkan kalender → Dari URL.', 'Tempel tautan, lalu Tambahkan kalender.'],
    open: { href: 'https://calendar.google.com/calendar/r/settings/addbyurl', label: 'Buka Google Calendar' },
    copyLabel: 'Tautan kalender',
  },
} as const;

function FeedView({ kind }: { kind: 'sheets' | 'calendar' }) {
  const { toast, confirm } = useFeedback();
  const { feeds, reload } = useFeeds();
  const [busy, setBusy] = useState(false);
  const c = FEED_COPY[kind];
  const url = feeds?.[kind] ?? null;
  const value = url ? (kind === 'sheets' ? `=IMPORTDATA("${url}")` : url) : '';

  const create = async (again: boolean) => {
    if (again) {
      const ok = await confirm({ title: 'Buat tautan baru?', message: 'Tautan lama langsung mati — spreadsheet/kalender yang memakainya harus diganti ke tautan baru.', confirmLabel: 'Buat ulang', danger: true });
      if (!ok) return;
    }
    setBusy(true);
    try {
      await cloudflareApi(`/api/member/feeds/${kind}`, { method: 'POST' });
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal membuat tautan.');
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    const ok = await confirm({ title: 'Putuskan koneksi?', message: 'Tautan langsung mati. Data yang sudah tersalin di Google tidak ikut terhapus.', confirmLabel: 'Putuskan', danger: true });
    if (!ok) return;
    setBusy(true);
    try {
      await cloudflareApi(`/api/member/feeds/${kind}`, { method: 'DELETE' });
      await reload();
      toast.success('Koneksi diputus.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memutus koneksi.');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Disalin.');
    } catch {
      toast.error('Gagal menyalin — tekan lama tautannya untuk menyalin manual.');
    }
  };

  if (!feeds) return <p className="py-10 text-center text-[14px] text-slate-400">Memuat…</p>;

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-[22px] bg-slate-50 p-5">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white ring-1 ring-slate-200">
          <ShieldCheck size={22} className="text-slate-700" />
        </span>
        <p className="text-[19px] font-semibold text-slate-900">{c.title}</p>
        <p className="text-[14px] leading-relaxed text-slate-600">{c.intro}</p>
        <p className="text-[14px] leading-relaxed text-slate-600">
          Siapa pun yang memegang tautan ini bisa membaca isinya — jangan dibagikan. Kamu bisa membuat ulang atau memutusnya kapan saja.
        </p>
      </div>

      {!url ? (
        <button type="button" onClick={() => create(false)} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 py-3.5 text-[16px] font-bold text-white disabled:opacity-60">
          {busy && <Loader2 size={16} className="animate-spin" />} Buat tautan
        </button>
      ) : (
        <>
          <ol className="space-y-2 rounded-[22px] bg-slate-50 p-5">
            {c.steps.map((s, i) => (
              <li key={s} className="flex gap-3 text-[14px] leading-snug text-slate-700">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[12px] font-bold text-slate-900 ring-1 ring-slate-200">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
          <div className="space-y-2">
            <p className="px-1 text-[14px] text-slate-500">{c.copyLabel}</p>
            <div className="flex items-center gap-2 rounded-2xl bg-white p-2 pl-4 ring-1 ring-slate-200">
              <code className="min-w-0 flex-1 truncate text-[13px] text-slate-700">{value}</code>
              <button type="button" onClick={copy} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-[13px] font-semibold text-white">
                <Copy size={14} /> Salin
              </button>
            </div>
          </div>
          <a href={c.open.href} target="_blank" rel="noopener noreferrer" className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 py-3.5 text-[16px] font-bold text-white">
            {c.open.label} <ExternalLink size={16} />
          </a>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => create(true)} disabled={busy} className="flex items-center justify-center gap-2 rounded-full bg-slate-100 py-3 text-[14px] font-semibold text-slate-800 hover:bg-slate-200 disabled:opacity-60">
              <RefreshCw size={15} /> Buat ulang
            </button>
            <button type="button" onClick={disconnect} disabled={busy} className="flex items-center justify-center gap-2 rounded-full bg-rose-50 py-3 text-[14px] font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-60">
              <Unlink size={15} /> Putuskan
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Layar satu aplikasi Composio: penjelasan & persetujuan → login di situs
// aplikasinya → kembali ke sini, lalu periksa koneksi (panggilan baca-saja).
function GmailView() {
  const { toast, confirm } = useFeedback();
  const { apps, reload } = useComposioApps();
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState<{ ok: boolean; text: string; logId?: string } | null>(null);
  const connected = Boolean(apps.items.gmail?.connected);

  const runCheck = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/member/apps/gmail/check', { method: 'POST', credentials: 'include' });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; summary?: string; error?: string; logId?: string };
      setCheck({ ok: Boolean(body.ok), text: body.summary || body.error || 'Gagal memeriksa koneksi.', logId: body.logId });
    } catch {
      setCheck({ ok: false, text: 'Gagal memeriksa koneksi.' });
    } finally {
      setBusy(false);
    }
  }, []);

  // Sekali saja setelah status terhubung terbaca (mis. baru kembali dari Google).
  const checked = useRef(false);
  useEffect(() => {
    if (!connected || checked.current) return;
    checked.current = true;
    void runCheck();
  }, [connected, runCheck]);

  const connect = async () => {
    setBusy(true);
    try {
      const res = await cloudflareApi<{ redirectUrl: string }>('/api/member/apps/gmail/connect', { method: 'POST' });
      window.location.href = res.redirectUrl;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal membuka halaman Google.');
      setBusy(false);
    }
  };

  const disconnect = async () => {
    const ok = await confirm({ title: 'Putuskan Gmail?', message: 'Akses Leosiqra ke Gmail-mu dicabut. Transaksi yang sudah tercatat tidak terhapus.', confirmLabel: 'Putuskan', danger: true });
    if (!ok) return;
    setBusy(true);
    try {
      await cloudflareApi('/api/member/apps/gmail', { method: 'DELETE' });
      setCheck(null);
      checked.current = false;
      await reload();
      toast.success('Gmail diputus.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memutus.');
    } finally {
      setBusy(false);
    }
  };

  if (apps.state === 'loading') return <p className="py-10 text-center text-[14px] text-slate-400">Memuat…</p>;
  if (apps.state !== 'ready') return <p className="rounded-[22px] bg-slate-50 p-5 text-[14px] text-slate-600">{apps.error ?? 'Belum tersedia.'}</p>;

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-[22px] bg-slate-50 p-5">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white ring-1 ring-slate-200">
          <ShieldCheck size={22} className="text-slate-700" />
        </span>
        <p className="text-[19px] font-semibold text-slate-900">Hubungkan Gmail</p>
        <p className="text-[14px] leading-relaxed text-slate-600">
          Setelah ini kamu akan melihat nama mitra koneksi kami, <b>Composio</b>, layanan bersertifikat SOC 2 Type II yang menjaga koneksi ini tetap aman. Leosiqra tidak pernah melihat kata sandi Google-mu.
        </p>
        <p className="text-[14px] leading-relaxed text-slate-600">
          Tahap beta: Leosiqra baru memeriksa akun yang terhubung. Nanti Leosiqra membaca email pembayaran (bank, e-wallet, toko) untuk diusulkan sebagai transaksi — selalu kamu tinjau dulu sebelum tercatat.
        </p>
      </div>

      {connected ? (
        <>
          <div className={cn('rounded-[22px] p-4 text-[15px]', check?.ok === false ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-800')}>
            {busy && !check ? 'Memeriksa koneksi…' : check?.text ?? 'Terhubung'}
            {check?.logId && <span className="mt-1 block font-mono text-[11px] opacity-60">log {check.logId}</span>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => void runCheck()} disabled={busy} className="flex items-center justify-center gap-2 rounded-full bg-slate-100 py-3 text-[14px] font-semibold text-slate-800 hover:bg-slate-200 disabled:opacity-60">
              <RefreshCw size={15} className={cn(busy && 'animate-spin')} /> Periksa
            </button>
            <button type="button" onClick={disconnect} disabled={busy} className="flex items-center justify-center gap-2 rounded-full bg-rose-50 py-3 text-[14px] font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-60">
              <Unlink size={15} /> Putuskan
            </button>
          </div>
        </>
      ) : (
        <button type="button" onClick={connect} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 py-3.5 text-[16px] font-bold text-white disabled:opacity-60">
          {busy && <Loader2 size={16} className="animate-spin" />} Lanjutkan ke Google
        </button>
      )}
    </div>
  );
}

export function AppsSection({ view, go }: { view: AppsView; go: (v: AppsView) => void }) {
  if (view === 'app-gmail') return <GmailView />;
  if (view === 'app-mcp') return <McpConnectCard />;
  if (view === 'app-sheets') return <FeedView kind="sheets" />;
  if (view === 'app-calendar') return <FeedView kind="calendar" />;
  return <AppsHub go={go} />;
}
