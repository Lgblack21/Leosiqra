'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Bot,
  Building2,
  Check,
  CheckCircle2,
  Clock3,
  Coins,
  Copy,
  Crown,
  ImageIcon,
  Loader2,
  MessageCircle,
  QrCode,
  ScanLine,
  Sparkles,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { getMemberPaymentInfo, type AppSettings, type ProPackage } from '@/lib/services/adminService';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { cn } from '@/lib/utils';

// Pembayaran: Langganan PRO & Top up koin. Paket & harga dari server
// (/api/member/payment-info: paket PRO pengaturan admin + paket koin "koin-N").
// Bayar manual (transfer / QRIS) → kirim bukti → admin memverifikasi.
// ?package=koin-10 / ?tab=koin membuka tab & paket itu langsung.
type Tab = 'pro' | 'koin';
type MyPayment = {
  id: string;
  amount: number;
  package_json: string | null;
  status: 'MENUNGGU' | 'DISETUJUI' | 'DITOLAK' | 'GAGAL';
  created_at: string;
  approved_at: string | null;
};
const rp = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`;
const nf = (n: number) => Math.round(n).toLocaleString('id-ID');
const isCoin = (p: { id: string }) => String(p.id).startsWith('koin-');
const PRO_PERKS = [
  { icon: Bot, text: 'Chat Leo 50×/hari, scan struk 30×, catat suara 40×' },
  { icon: Sparkles, text: '10 ilustrasi AI gratis tiap bulan di Cerita Hari Ini' },
  { icon: Users, text: 'Sampai 5 akun tim kasir & dompet bersama lebih banyak' },
  { icon: ScanLine, text: 'Aplikasi terhubung & catat lewat Claude/ChatGPT' },
];

export default function PembayaranPage() {
  const reduce = useReducedMotion();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('pro');
  const [pkgId, setPkgId] = useState('');
  const [method, setMethod] = useState<'transfer' | 'qris'>('transfer');
  const [ref, setRef] = useState('');
  const [note, setNote] = useState('');
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [copied, setCopied] = useState('');
  const [me, setMe] = useState<{ name?: string; email?: string; plan?: string; expiredAt?: string | null } | null>(
    null,
  );
  const [balance, setBalance] = useState<number | null>(null);
  const [history, setHistory] = useState<MyPayment[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadHistory = () =>
    cloudflareApi<{ items: MyPayment[] }>('/api/member/payments', { cache: 'no-store' })
      .then((r) => setHistory(r.items ?? []))
      .catch(() => undefined);
  useEffect(() => {
    getMemberPaymentInfo()
      .then(setSettings)
      .catch(() => setSettings(null))
      .finally(() => setLoading(false));
    cloudflareApi<{ user?: { name?: string; email?: string; plan?: string; expiredAt?: string | null } }>(
      '/api/auth/me',
    )
      .then((r) => setMe(r.user ?? null))
      .catch(() => undefined);
    cloudflareApi<{ balance?: number }>('/api/member/coins')
      .then((r) => setBalance(r.balance ?? 0))
      .catch(() => undefined);
    void loadHistory();
  }, []);

  const all = useMemo(() => (settings?.proPackages ?? []) as (ProPackage & { coins?: number })[], [settings]);
  const proPkgs = all.filter((p) => !isCoin(p));
  const coinPkgs = all.filter(isCoin);
  const list = tab === 'pro' ? proPkgs : coinPkgs;

  // Paket awal: ?package= / ?tab=, lalu paket pertama tab aktif.
  useEffect(() => {
    if (!all.length || pkgId) return;
    const qs = new URLSearchParams(window.location.search);
    const wanted = all.find((p) => p.id === qs.get('package'));
    const t: Tab = wanted ? (isCoin(wanted) ? 'koin' : 'pro') : qs.get('tab') === 'koin' ? 'koin' : 'pro';
    setTab(t);
    setPkgId(
      wanted?.id ?? (t === 'koin' ? coinPkgs[0]?.id : (proPkgs.find((p) => p.isPopular)?.id ?? proPkgs[0]?.id)) ?? '',
    );
  }, [all, pkgId, coinPkgs, proPkgs]);
  const switchTab = (t: Tab) => {
    setTab(t);
    const l = t === 'pro' ? proPkgs : coinPkgs;
    setPkgId((t === 'pro' ? l.find((p) => p.isPopular)?.id : undefined) ?? l[0]?.id ?? '');
  };
  const pkg = all.find((p) => p.id === pkgId) ?? null;
  const hasBank = Boolean(settings?.bankNumber);
  const hasQris = Boolean(settings?.qrisURL);
  const wa = useMemo(() => {
    let d = (settings?.whatsapp ?? '').replace(/\D/g, '');
    if (!d) return null;
    if (d.startsWith('0')) d = `62${d.slice(1)}`;
    else if (!d.startsWith('62')) d = `62${d}`;
    return d;
  }, [settings?.whatsapp]);
  const isPro = me?.plan === 'PRO' && (!me.expiredAt || new Date(me.expiredAt).getTime() > Date.now());

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(''), 1600);
    } catch {
      /* tidak didukung */
    }
  };
  const onProof = async (f: File | undefined) => {
    if (!f) return;
    setError('');
    setProofPreview(URL.createObjectURL(f));
    setUploading(true);
    try {
      setProofUrl(await uploadToCloudinary(f));
    } catch (e) {
      setProofPreview(null);
      setProofUrl(null);
      setError(e instanceof Error ? e.message : 'Gagal mengunggah bukti.');
    } finally {
      setUploading(false);
    }
  };
  const submit = async () => {
    if (!pkg) return;
    if (!proofUrl && !ref.trim()) {
      setError('Unggah bukti transfer atau isi nomor referensinya.');
      return;
    }
    setSending(true);
    setError('');
    try {
      await cloudflareApi('/api/member/payments', {
        method: 'POST',
        json: {
          package: { id: pkg.id },
          amount: pkg.price,
          method: method === 'qris' ? 'QRIS' : `Transfer ${settings?.bankName ?? 'Bank'}`,
          ref: ref.trim() || null,
          note: note.trim() || null,
          proof_image_url: proofUrl,
        },
      });
      setDone(pkg.name);
      setRef('');
      setNote('');
      setProofUrl(null);
      setProofPreview(null);
      void loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengirim konfirmasi.');
    } finally {
      setSending(false);
    }
  };

  const card = 'rounded-[28px] bg-white ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800';
  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-12">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-slate-900 dark:text-white md:text-[30px]">
            Upgrade & Top up
          </h1>
          <p className="text-[14px] text-slate-500">
            Langganan PRO atau isi koin — bayar transfer / QRIS, admin verifikasi maks. 1×24 jam.
          </p>
        </div>
        <div className="flex gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold',
              isPro
                ? 'bg-gradient-to-r from-amber-300 to-yellow-200 text-amber-950'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
            )}
          >
            <Crown size={15} />{' '}
            {isPro
              ? `PRO s.d. ${me?.expiredAt ? new Date(me.expiredAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}`
              : 'Paket FREE'}
          </span>
          {balance !== null && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3.5 py-2 text-[13px] font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              <Coins size={15} /> {nf(balance)} koin
            </span>
          )}
        </div>
      </div>

      {done && (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 rounded-[24px] bg-emerald-50 p-4 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:ring-emerald-500/20"
        >
          <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-emerald-600" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold text-emerald-900 dark:text-emerald-200">Konfirmasi {done} terkirim</p>
            <p className="text-[13px] text-emerald-800/80 dark:text-emerald-300/80">
              Admin memverifikasi maks. 1×24 jam. Status bisa dilihat di Riwayat di bawah.
            </p>
            {wa && (
              <a
                href={`https://wa.me/${wa}?text=${encodeURIComponent(`Halo admin Leosiqra, saya sudah kirim konfirmasi pembayaran ${done} (${me?.email ?? ''}).`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-1.5 text-[12px] font-bold text-white"
              >
                <MessageCircle size={14} /> Kabari admin via WhatsApp
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={() => setDone(null)}
            aria-label="Tutup"
            className="rounded-full p-1 text-emerald-700/70 hover:bg-emerald-100"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <section className="space-y-4">
          <div className="flex rounded-full bg-slate-100 p-1 dark:bg-slate-800">
            {(
              [
                ['pro', 'Langganan PRO', Crown],
                ['koin', 'Top up koin', Coins],
              ] as const
            ).map(([k, label, Icon]) => (
              <button
                key={k}
                type="button"
                onClick={() => switchTab(k)}
                aria-pressed={tab === k}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-[14px] font-bold transition-colors',
                  tab === k ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-500',
                )}
              >
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-32 animate-pulse rounded-[24px] bg-slate-100 dark:bg-slate-800" />
              ))}
            </div>
          ) : !list.length ? (
            <p className={cn(card, 'p-6 text-center text-[14px] text-slate-500')}>
              {tab === 'pro' ? 'Paket PRO belum diatur admin.' : 'Paket koin belum tersedia.'}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {list.map((p) => {
                const on = p.id === pkgId;
                const months = Number(p.durationMonths) || 1;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPkgId(p.id)}
                    aria-pressed={on}
                    className={cn(
                      'relative flex flex-col items-start rounded-[24px] p-4 text-left transition-all',
                      on
                        ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/20 ring-2 ring-slate-900 dark:bg-white dark:text-slate-900 dark:ring-white'
                        : 'bg-white ring-1 ring-slate-200 hover:ring-slate-300 dark:bg-slate-900 dark:ring-slate-700',
                    )}
                  >
                    {p.isPopular && (
                      <span className="absolute -top-2 right-3 rounded-full bg-gradient-to-r from-amber-400 to-pink-400 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-white shadow">
                        Populer
                      </span>
                    )}
                    <span
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-xl',
                        on
                          ? 'bg-white/15'
                          : tab === 'pro'
                            ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15'
                            : 'bg-amber-50 text-amber-600 dark:bg-amber-500/15',
                      )}
                    >
                      {tab === 'pro' ? <Crown size={18} /> : <Coins size={18} />}
                    </span>
                    <span className="mt-3 text-[15px] font-bold leading-tight">
                      {tab === 'pro' ? p.name : `${nf(p.coins ?? p.price)} koin`}
                    </span>
                    <span className="mt-1 text-[22px] font-black tracking-tight">{rp(p.price)}</span>
                    <span className={cn('text-[12px]', on ? 'text-white/70 dark:text-slate-500' : 'text-slate-500')}>
                      {tab === 'pro'
                        ? months > 1
                          ? `${rp(p.price / months)}/bulan · ${months} bulan`
                          : '1 bulan'
                        : '1 koin = Rp1'}
                    </span>
                    {on && (
                      <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400 text-slate-900">
                        <Check size={14} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className={cn(card, 'p-4 md:p-5')}>
            {tab === 'pro' ? (
              <>
                <p className="flex items-center gap-2 text-[14px] font-bold text-slate-900 dark:text-white">
                  <Crown size={16} className="text-amber-500" /> Yang kamu dapat dengan PRO
                </p>
                <ul className="mt-3 space-y-2.5">
                  {PRO_PERKS.map(({ icon: Icon, text }) => (
                    <li key={text} className="flex items-start gap-2.5 text-[13px] text-slate-600 dark:text-slate-300">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15">
                        <Icon size={14} />
                      </span>
                      {text}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[12px] text-slate-400">
                  FREE tetap bisa mencatat tanpa batas; AI dibatasi 5 chat, 3 scan & 5 catat suara per hari.
                </p>
              </>
            ) : (
              <>
                <p className="flex items-center gap-2 text-[14px] font-bold text-slate-900 dark:text-white">
                  <Coins size={16} className="text-amber-500" /> Koin dipakai untuk
                </p>
                <ul className="mt-3 space-y-2 text-[13px] text-slate-600 dark:text-slate-300">
                  <li>✨ Ilustrasi AI Cerita Hari Ini — 1.000 koin / gambar</li>
                  <li>👑 Tukar PRO — 15.000 koin / bulan</li>
                  <li>🔌 Aktivasi aplikasi terhubung</li>
                </ul>
                <p className="mt-3 text-[12px] text-slate-400">
                  Koin tidak bisa dicairkan jadi uang & tidak bisa dipindah ke akun lain.
                </p>
              </>
            )}
          </div>
        </section>

        <section className={cn(card, 'h-fit space-y-4 p-4 md:p-5 lg:sticky lg:top-6')}>
          <div className="flex items-center justify-between rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-4 text-white">
            <div className="min-w-0">
              <p className="text-[12px] text-white/70">Total bayar</p>
              <p className="text-[28px] font-black leading-tight tracking-tight">{pkg ? rp(pkg.price) : '—'}</p>
              <p className="truncate text-[12px] text-white/80">
                {pkg ? (isCoin(pkg) ? `${nf(pkg.coins ?? pkg.price)} koin` : pkg.name) : 'Pilih paket'}
              </p>
            </div>
            {pkg && (
              <button
                type="button"
                onClick={() => copy(String(Math.round(pkg.price)), 'amount')}
                className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-bold hover:bg-white/25"
              >
                {copied === 'amount' ? <Check size={13} /> : <Copy size={13} />}{' '}
                {copied === 'amount' ? 'Disalin' : 'Salin'}
              </button>
            )}
          </div>

          <div>
            <p className="mb-2 text-[13px] font-bold text-slate-800 dark:text-slate-100">1. Bayar ke</p>
            <div className="mb-2 flex rounded-full bg-slate-100 p-1 dark:bg-slate-800">
              {(
                [
                  ['transfer', 'Transfer bank', Building2],
                  ['qris', 'QRIS', QrCode],
                ] as const
              ).map(([k, label, Icon]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setMethod(k)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[13px] font-bold',
                    method === k
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                      : 'text-slate-500',
                  )}
                >
                  <Icon size={15} /> {label}
                </button>
              ))}
            </div>
            {method === 'transfer' ? (
              hasBank ? (
                <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3.5 dark:bg-slate-800/60">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm dark:bg-slate-900">
                    <Building2 size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-slate-500">{settings?.bankName}</p>
                    <p className="text-[18px] font-black tabular-nums tracking-wide text-slate-900 dark:text-white">
                      {settings?.bankNumber}
                    </p>
                    <p className="truncate text-[12px] text-slate-500">a.n. {settings?.bankAccountName}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copy(settings!.bankNumber!, 'bank')}
                    className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[12px] font-bold text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200"
                  >
                    {copied === 'bank' ? <Check size={13} /> : <Copy size={13} />}{' '}
                    {copied === 'bank' ? 'Disalin' : 'Salin'}
                  </button>
                </div>
              ) : (
                <p className="rounded-2xl bg-amber-50 p-3 text-[13px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                  Rekening tujuan belum diatur admin. Pakai QRIS atau hubungi admin.
                </p>
              )
            ) : hasQris ? (
              <div className="flex flex-col items-center gap-2 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                <div className="relative h-52 w-52 overflow-hidden rounded-2xl bg-white p-2 shadow-sm">
                  <Image
                    src={settings!.qrisURL!}
                    alt="QRIS Leosiqra"
                    fill
                    sizes="208px"
                    className="object-contain"
                    unoptimized
                  />
                </div>
                <p className="text-center text-[12px] text-slate-500">
                  {settings?.qrisText || 'Scan dengan aplikasi bank / e-wallet, bayar sesuai total.'}
                </p>
              </div>
            ) : (
              <p className="rounded-2xl bg-amber-50 p-3 text-[13px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                QRIS belum diatur admin. Pakai transfer bank.
              </p>
            )}
          </div>

          <div className="space-y-2.5">
            <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100">2. Kirim bukti</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onProof(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={cn(
                'relative flex w-full items-center gap-3 overflow-hidden rounded-2xl p-3 text-left ring-1 transition-colors',
                proofPreview
                  ? 'bg-white ring-emerald-200 dark:bg-slate-900'
                  : 'border-2 border-dashed border-slate-200 bg-slate-50 ring-transparent hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-800/60',
              )}
            >
              {proofPreview ? (
                // eslint-disable-next-line @next/next/no-img-element -- pratinjau file lokal (blob)
                <img src={proofPreview} alt="Bukti transfer" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm dark:bg-slate-900">
                  <ImageIcon size={22} />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold text-slate-800 dark:text-slate-100">
                  {uploading ? 'Mengunggah…' : proofUrl ? 'Bukti terunggah' : 'Unggah screenshot bukti bayar'}
                </span>
                <span className="block text-[12px] text-slate-500">
                  {proofUrl ? 'Ketuk untuk mengganti' : 'JPG / PNG, maks. 5 MB'}
                </span>
              </span>
              {uploading ? (
                <Loader2 size={18} className="animate-spin text-indigo-500" />
              ) : proofUrl ? (
                <CheckCircle2 size={20} className="text-emerald-500" />
              ) : null}
            </button>
            <input
              value={ref}
              onChange={(e) => setRef(e.target.value.slice(0, 80))}
              placeholder="No. referensi transaksi (opsional jika ada bukti)"
              className="w-full rounded-2xl bg-slate-50 px-4 py-3 text-[14px] outline-none ring-1 ring-slate-100 placeholder:text-slate-400 focus:bg-white focus:ring-indigo-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 300))}
              placeholder="Catatan untuk admin (opsional)"
              className="w-full rounded-2xl bg-slate-50 px-4 py-3 text-[14px] outline-none ring-1 ring-slate-100 placeholder:text-slate-400 focus:bg-white focus:ring-indigo-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700"
            />
          </div>

          {error && (
            <p role="alert" className="text-[13px] font-semibold text-rose-600">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={!pkg || sending || uploading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-4 text-[15px] font-bold text-white shadow-lg shadow-slate-900/15 transition-transform active:scale-[0.98] disabled:opacity-50 dark:bg-white dark:text-slate-900"
          >
            {sending ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />} Kirim konfirmasi pembayaran
          </button>
          <p className="text-center text-[11px] text-slate-400">
            Atas nama akun {me?.name || me?.email || 'kamu'}
            {me?.email && me?.name ? ` · ${me.email}` : ''}.{' '}
            {settings?.billingEmail ? `Kendala? ${settings.billingEmail}` : ''}
          </p>
        </section>
      </div>

      {history.length > 0 && (
        <section className={cn(card, 'p-4 md:p-5')}>
          <p className="mb-2 text-[15px] font-bold text-slate-900 dark:text-white">Riwayat pembayaranku</p>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {history.map((h) => {
              let info: { name?: string; kind?: string } = {};
              try {
                info = JSON.parse(h.package_json ?? '{}');
              } catch {
                info = {};
              }
              const st =
                h.status === 'DISETUJUI'
                  ? { label: 'Disetujui', cls: 'bg-emerald-50 text-emerald-700', Icon: CheckCircle2 }
                  : h.status === 'MENUNGGU'
                    ? { label: 'Menunggu', cls: 'bg-amber-50 text-amber-700', Icon: Clock3 }
                    : { label: 'Ditolak', cls: 'bg-rose-50 text-rose-700', Icon: XCircle };
              return (
                <li key={h.id} className="flex items-center gap-3 py-2.5">
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                      info.kind === 'coin' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600',
                    )}
                  >
                    {info.kind === 'coin' ? <Coins size={16} /> : <Crown size={16} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-slate-800 dark:text-slate-100">
                      {info.name ?? 'Pembayaran'}
                    </span>
                    <span className="block text-[12px] text-slate-400">
                      {new Date(h.created_at).toLocaleString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      · {rp(h.amount)}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold',
                      st.cls,
                    )}
                  >
                    <st.Icon size={13} /> {st.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
