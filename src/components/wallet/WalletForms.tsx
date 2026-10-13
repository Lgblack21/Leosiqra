"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeftRight, Check, ChevronDown, ImageIcon, Loader2, ScanLine, X } from 'lucide-react';
import { cn, formatIDR, formatMoney, toLocalDateString } from '@/lib/utils';
import { accountService, type Account } from '@/lib/services/accountService';
import { transferService } from '@/lib/services/transferService';
import type { CardCycle } from '@/lib/creditCycle';
import { AccountLogo } from '@/components/ui/AccountLogo';
import { matchIndonesianInstitutionLogo } from '@/lib/indonesianBanks';
import { useFeedback } from '@/components/ui/Feedback';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { imageFileToBase64 } from '@/lib/quick/ai';

// Form "Tambah dompet" dan "Kartu kredit baru" gaya baru (popup).
// Logo bank/e-wallet dikenali otomatis dari nama — tidak perlu unggah.
// Kartu kredit: saldo disimpan negatif (= tagihan terpakai), sama dengan
// AccountModal/CardModal lama; tanggal cetak & jatuh tempo, 4 digit, jaringan,
// pengingat, dan warna dititipkan di payload_json oleh Worker.

const KINDS = [
  { id: 'Cash', label: 'Tunai', emoji: '💵', bg: '#10b981' },
  { id: 'Bank Account', label: 'Bank', emoji: '🏦', bg: '#2563eb' },
  { id: 'E-Wallet', label: 'E-wallet', emoji: '📱', bg: '#0ea5e9' },
  { id: 'Credit Card', label: 'Kredit', emoji: '💳', bg: '#f97316' },
] as const;
type KindId = (typeof KINDS)[number]['id'];

// Bank penerbit (urutan: paling umum dulu). "Bank lain" = ketik sendiri.
export const CARD_BANKS = [
  'BCA', 'Bank Mandiri', 'BRI', 'BNI', 'BSI', 'BTN', 'CIMB Niaga', 'Permata', 'Danamon', 'OCBC', 'Maybank', 'Bank Mega', 'Panin',
  'UOB', 'HSBC', 'Standard Chartered', 'Citibank', 'DBS', 'KB Bank', 'Sinarmas',
  'Bank Jago', 'Jenius', 'SeaBank', 'blu by BCA', 'Allo Bank', 'Bank Neo Commerce', 'Superbank', 'Krom', 'Hibank', 'Line Bank', 'Bank Raya',
  'BCA Syariah', 'Bank Muamalat', 'Bank Mega Syariah',
  'Bank DKI', 'BJB', 'Bank Jatim', 'Bank Jateng', 'Bank Sumut', 'Bank Nagari', 'BPD Bali', 'Bank Aceh', 'Bank Kalbar', 'Bank Sulselbar',
  'MNC Bank', 'Bank Mayapada', 'Bank Victoria', 'Bank Artha Graha', 'QNB', 'ICBC', 'Commonwealth', 'Nobu', 'Bank Sampoerna', 'Amar Bank', 'Bank Mantap',
];
const OTHER_BANK = 'Bank lain';
const NETWORKS = ['Visa', 'Mastercard', 'JCB', 'Amex', 'GPN'];
const CARD_COLORS = [
  'linear-gradient(135deg,#374151,#6b7280)',
  'linear-gradient(135deg,#0f172a,#334155)',
  'linear-gradient(135deg,#1e3a8a,#2563eb)',
  'linear-gradient(135deg,#4338ca,#818cf8)',
  'linear-gradient(135deg,#115e59,#14b8a6)',
  'linear-gradient(135deg,#991b1b,#ef4444)',
  'linear-gradient(135deg,#a16207,#eab308)',
  'linear-gradient(135deg,#475569,#94a3b8)',
];
const REMINDERS = [
  { v: -1, label: 'Mati' },
  { v: 1, label: '1 hari sebelumnya' },
  { v: 3, label: '3 hari sebelumnya' },
  { v: 5, label: '5 hari sebelumnya' },
  { v: 7, label: '7 hari sebelumnya' },
];
const logoFor = (name: string, type: string) => matchIndonesianInstitutionLogo(name, type === 'Credit Card' ? 'Credit Card' : type) ?? null;
const digits = (s: string) => Number(s.replace(/\D/g, '')) || 0;

function Shell({ title, onClose, children, footer, label }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode; label: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={label}>
      <motion.div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 340, damping: 32 }}
        className="relative flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:rounded-[28px]"
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <p className="text-lg font-extrabold text-slate-900">{title}</p>
          <button type="button" onClick={onClose} aria-label="Tutup" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"><X size={18} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        <div className="border-t border-slate-100 px-5 py-4">{footer}</div>
      </motion.div>
    </div>
  );
}

const fieldCls = 'w-full rounded-2xl bg-slate-100 px-4 py-3 text-[15px] text-slate-800 outline-none placeholder:text-slate-400 focus:bg-white focus:ring-1 focus:ring-indigo-300';
const Label = ({ children }: { children: React.ReactNode }) => <p className="mb-1.5 pl-1 text-[13px] font-semibold text-slate-500">{children}</p>;

// Daftar pilihan (radio) sebagai lapisan di atas form.
function PickList<T extends string | number>({ title, options, value, onPick, onClose, searchable }: { title: string; options: { v: T; label: string; icon?: React.ReactNode }[]; value: T | null; onPick: (v: T) => void; onClose: () => void; searchable?: boolean }) {
  const [q, setQ] = useState('');
  const shown = q.trim() ? options.filter((o) => o.label.toLowerCase().includes(q.trim().toLowerCase())) : options;
  return (
    <motion.div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/20 p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }} className="flex max-h-[70vh] w-full max-w-sm flex-col overflow-hidden rounded-3xl bg-white p-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <p className="px-2 pb-2 pt-1 font-bold text-slate-900">{title}</p>
        {searchable && (
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari bank…" aria-label="Cari bank" className="mb-2 w-full rounded-full bg-slate-100 px-4 py-2.5 text-sm outline-none focus:bg-white focus:ring-1 focus:ring-indigo-300" />
        )}
        <ul className="overflow-y-auto rounded-2xl bg-slate-50">
          {shown.length === 0 && <li className="px-3 py-4 text-center text-sm text-slate-400">Tidak ketemu — pilih “Bank lain”.</li>}
          {shown.map((o) => (
            <li key={String(o.v)} className="border-b border-slate-100 last:border-0">
              <button type="button" onClick={() => { onPick(o.v); onClose(); }} className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-slate-100">
                <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2', value === o.v ? 'border-slate-900' : 'border-slate-300')}>{value === o.v && <span className="h-2.5 w-2.5 rounded-full bg-slate-900" />}</span>
                {o.icon}
                <span className="text-[15px] text-slate-800">{o.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </motion.div>
    </motion.div>
  );
}

function Logo({ src, fallback, bg, size }: { src: string | null; fallback: string; bg: string; size: number }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (src && failed !== src) {
    return (
      <span className="flex items-center justify-center overflow-hidden rounded-[22%] bg-white shadow-sm ring-1 ring-slate-100" style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="h-full w-full object-contain" onError={() => setFailed(src)} onLoad={(e) => e.currentTarget.naturalWidth <= 16 && setFailed(src)} />
      </span>
    );
  }
  return <span className="flex items-center justify-center rounded-full" style={{ width: size, height: size, background: bg, fontSize: size * 0.45 }}>{fallback}</span>;
}

// ================= Tambah dompet =================
export function WalletAddModal({ onClose, onCredit }: { onClose: () => void; onCredit: () => void }) {
  const { toast } = useFeedback();
  const [kind, setKind] = useState<KindId>('Bank Account');
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const k = KINDS.find((x) => x.id === kind)!;
  const logo = name.trim() ? logoFor(name, kind) : null;

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const b = digits(balance);
      await accountService.createAccount({ userId: '', name: name.trim(), type: kind, currency: 'IDR', balance: b, initialBalance: b, baseValue: 0, creditLimit: 0, ...(logo ? { logoUrl: logo } : {}) });
      toast.success(`${name.trim()} ditambahkan`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menambah dompet.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Shell
      title="Tambah dompet"
      label="Tambah dompet"
      onClose={onClose}
      footer={<button type="button" onClick={save} disabled={!name.trim() || saving} className="h-12 w-full rounded-full bg-slate-900 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400">{saving ? 'Menyimpan…' : 'Tambah dompet'}</button>}
    >
      <p className="mb-2 pl-1 text-[13px] font-semibold text-slate-500">Detail dompet</p>
      <div className="space-y-4 rounded-3xl bg-slate-50 p-4">
        <div className="flex justify-center py-2">
          <AnimatePresence mode="wait">
            <motion.span key={logo ?? kind} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 24 }}>
              <Logo src={logo} fallback={k.emoji} bg={k.bg} size={84} />
            </motion.span>
          </AnimatePresence>
        </div>
        <div>
          <Label>Jenis dompet</Label>
          <button type="button" onClick={() => setPicking(true)} className="flex w-full items-center gap-3 rounded-2xl bg-slate-100 px-4 py-3 text-left hover:bg-slate-200/70">
            <span>{k.emoji}</span><span className="flex-1 text-[15px] text-slate-800">{k.label}</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-slate-500"><ChevronDown size={14} /></span>
          </button>
        </div>
        <div>
          <Label>Nama dompet</Label>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="BCA Utama, Tunai, GoPay" className={fieldCls} />
        </div>
        <div>
          <Label>Saldo saat ini</Label>
          <label className="flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 focus-within:bg-white focus-within:ring-1 focus-within:ring-indigo-300">
            <span className="text-slate-400">Rp</span>
            <input inputMode="numeric" value={digits(balance) ? digits(balance).toLocaleString('id-ID') : ''} onChange={(e) => setBalance(e.target.value)} placeholder="0" className="w-full bg-transparent text-[15px] font-semibold text-slate-800 outline-none" />
          </label>
        </div>
      </div>
      <AnimatePresence>
        {picking && (
          <PickList
            title="Jenis dompet"
            value={kind}
            options={KINDS.map((x) => ({ v: x.id, label: x.label, icon: <span>{x.emoji}</span> }))}
            onPick={(v) => (v === 'Credit Card' ? onCredit() : setKind(v))}
            onClose={() => setPicking(false)}
          />
        )}
      </AnimatePresence>
    </Shell>
  );
}

// ================= Kartu kredit baru =================
export function CardAddModal({ onClose }: { onClose: () => void }) {
  const { toast } = useFeedback();
  const [bank, setBank] = useState<string | null>(null);
  const [name, setName] = useState('Kartu kredit');
  const [nameTouched, setNameTouched] = useState(false);
  const [last4, setLast4] = useState('');
  const [statementDay, setStatementDay] = useState<number | null>(null);
  const [dueDay, setDueDay] = useState<number | null>(null);
  const [bill, setBill] = useState('');
  const [limit, setLimit] = useState('');
  const [reminder, setReminder] = useState(3);
  const [network, setNetwork] = useState<string | null>(null);
  const [color, setColor] = useState(CARD_COLORS[0]);
  const [picking, setPicking] = useState<null | 'bank' | 'cetak' | 'tempo'>(null);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const logo = bank && bank !== OTHER_BANK ? logoFor(bank, 'Bank Account') : name.trim() ? logoFor(name, 'Bank Account') : null;

  // Isi otomatis dari foto: foto → AI baca bank, jaringan, 4 digit. Foto tidak disimpan.
  const scan = async (file?: File) => {
    if (!file) return;
    setScanning(true);
    try {
      const r = await cloudflareApi<{ ok?: boolean; bank?: string | null; network?: string | null; last4?: string | null; error?: string }>('/api/member/ai/parse-card', {
        method: 'POST',
        json: { imageBase64: await imageFileToBase64(file, 1200, 0.8) },
      });
      if (r.bank) pickBank(r.bank);
      if (r.network) setNetwork(r.network);
      if (r.last4) setLast4(r.last4);
      toast.success(`Kartu terbaca${r.bank ? ` · ${r.bank}` : ''}${r.last4 ? ` •••• ${r.last4}` : ''}. Cek lagi sebelum disimpan.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kartu tidak terbaca. Isi manual saja.');
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  const days = useMemo(() => Array.from({ length: 28 }, (_, i) => ({ v: i + 1, label: `Tanggal ${i + 1}` })), []);

  const pickBank = (b: string) => {
    if (b === OTHER_BANK) {
      // Ketik sendiri: nama kartu dikosongkan supaya diisi nama banknya.
      setBank(OTHER_BANK);
      if (!nameTouched) setName('');
      return;
    }
    setBank(b);
    if (!nameTouched) setName(b.replace(/^Bank /, ''));
    // Warna default mengikuti bank (bisa diganti).
    const auto: Record<string, number> = { BCA: 2, 'Bank Mandiri': 6, BRI: 2, BNI: 4, BSI: 4, CIMB: 5, 'CIMB Niaga': 5, OCBC: 5, Danamon: 6, 'Bank Jago': 6, Jenius: 3, SeaBank: 6 };
    if (auto[b] !== undefined) setColor(CARD_COLORS[auto[b]]);
  };

  const save = async () => {
    if (!name.trim()) return toast.error('Isi nama kartunya.');
    if (last4 && !/^\d{4}$/.test(last4)) return toast.error('4 digit terakhir harus 4 angka.');
    if ((statementDay === null) !== (dueDay === null)) return toast.error('Isi tanggal cetak dan jatuh tempo sekaligus (atau kosongkan keduanya).');
    setSaving(true);
    try {
      const used = digits(bill);
      await accountService.createAccount({
        userId: '',
        name: name.trim(),
        type: 'Credit Card',
        currency: 'IDR',
        balance: -used,
        initialBalance: -used,
        baseValue: 0,
        creditLimit: digits(limit),
        cardColor: color,
        ...(logo ? { logoUrl: logo } : {}),
        ...(statementDay && dueDay ? { statementDay, dueDay } : {}),
        ...(last4 ? { last4 } : {}),
        ...(network ? { network } : {}),
        reminderDays: reminder,
      });
      toast.success(`${name.trim()} ditambahkan`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan kartu.');
    } finally {
      setSaving(false);
    }
  };

  const dueLabel = dueDay ? `Jatuh tempo tgl ${dueDay}` : 'Belum ada tanggal';
  const used = digits(bill);

  return (
    <Shell
      title="Kartu kredit baru"
      label="Kartu kredit baru"
      onClose={onClose}
      footer={<button type="button" onClick={save} disabled={saving} className="h-12 w-full rounded-full bg-slate-900 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60">{saving ? 'Menyimpan…' : 'Simpan kartu'}</button>}
    >
      {/* Pratinjau kartu (ikut berubah saat diisi) */}
      <motion.div layout className="mx-auto mb-5 mt-1 aspect-[1.6] w-full max-w-[320px] overflow-hidden rounded-2xl p-4 text-white shadow-xl transition-[background] duration-500" style={{ background: color }}>
        <div className="relative flex h-full flex-col">
          <span className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10" />
          {scanning && (
            <motion.span
              className="pointer-events-none absolute -inset-x-4 h-10 bg-gradient-to-b from-transparent via-white/50 to-transparent"
              initial={{ top: '-20%' }}
              animate={{ top: ['-20%', '100%'] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          <div className="flex items-center gap-2">
            {logo ? <Logo src={logo} fallback="💳" bg="transparent" size={26} /> : <span className="flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-white/20 text-sm">💳</span>}
            <span className="flex-1 truncate text-sm font-bold">{name || 'Kartu kredit'}</span>
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold">{dueLabel}</span>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <span className="h-7 w-10 rounded-md bg-gradient-to-br from-amber-200 to-amber-400 shadow-inner" />
            <span className="font-mono text-sm tracking-[0.2em]">{last4 ? `•••• ${last4}` : ''}</span>
          </div>
          <div className="mt-auto flex items-end justify-between">
            <span>
              <span className="block text-[10px] text-white/70">Tagihan saat ini</span>
              <span className="text-lg font-extrabold tabular-nums">{formatIDR(used)}</span>
            </span>
            {network && <span className="text-sm font-extrabold italic">{network.toUpperCase()}</span>}
          </div>
        </div>
      </motion.div>

      <div className="mb-4 rounded-3xl bg-slate-50 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600"><ScanLine size={20} /></span>
          <span>
            <span className="block font-bold text-slate-900">Isi otomatis dari foto</span>
            <span className="block text-[13px] leading-snug text-slate-500">Foto bagian depan kartu: Leo membaca bank, jaringan, dan 4 digit terakhirnya. Fotonya tidak disimpan, dan nomor lengkap tidak pernah dicatat.</span>
          </span>
        </div>
        <button type="button" disabled={scanning} onClick={() => fileRef.current?.click()} className="ml-14 mt-3 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-[13px] font-bold text-white hover:bg-slate-800 disabled:opacity-60">
          {scanning ? <><Loader2 size={14} className="animate-spin" /> Membaca kartu…</> : <><ImageIcon size={14} /> Pilih foto</>}
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void scan(e.target.files?.[0])} />
      </div>

      <div className="space-y-4 rounded-3xl bg-slate-50 p-4">
        <div>
          <Label>Bank</Label>
          <button type="button" onClick={() => setPicking('bank')} className="flex w-full items-center gap-3 rounded-2xl bg-slate-100 px-4 py-3 text-left hover:bg-slate-200/70">
            {logo && <Logo src={logo} fallback="🏦" bg="#e2e8f0" size={22} />}
            <span className={cn('flex-1 text-[15px]', bank ? 'text-slate-800' : 'text-slate-400')}>{bank ?? 'Pilih bank'}</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-slate-500"><ChevronDown size={14} /></span>
          </button>
        </div>
        <div>
          <Label>Nama kartu</Label>
          <input value={name} onChange={(e) => { setName(e.target.value); setNameTouched(true); }} placeholder={bank === OTHER_BANK ? 'Nama bank / kartu, mis. Bank Ganesha' : 'Kartu kredit'} autoFocus={bank === OTHER_BANK} className={fieldCls} />
        </div>
        <div>
          <Label>4 digit terakhir</Label>
          <input inputMode="numeric" maxLength={4} value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="4821" className={fieldCls} />
          <p className="mt-1 pl-1 text-[11px] text-slate-400">Supaya transaksi dari notifikasi/mutasi bisa dicocokkan ke kartu ini. Jangan isi nomor lengkap.</p>
        </div>
      </div>

      <p className="mb-2 mt-5 pl-1 font-bold text-slate-900">Tanggal & tagihan</p>
      <div className="space-y-4 rounded-3xl bg-slate-50 p-4">
        <div className="grid grid-cols-2 gap-3">
          {(['cetak', 'tempo'] as const).map((w) => {
            const v = w === 'cetak' ? statementDay : dueDay;
            return (
              <div key={w}>
                <Label>{w === 'cetak' ? 'Tanggal cetak' : 'Jatuh tempo'}</Label>
                <button type="button" onClick={() => setPicking(w)} className="flex w-full items-center justify-between rounded-2xl bg-slate-100 px-4 py-3 text-left hover:bg-slate-200/70">
                  <span className={cn('text-[15px]', v ? 'text-slate-800' : 'text-slate-400')}>{v ? `Tanggal ${v}` : 'Pilih tanggal'}</span>
                  <ChevronDown size={14} className="text-slate-400" />
                </button>
              </div>
            );
          })}
        </div>
        <p className="-mt-2 pl-1 text-[11px] text-slate-400">Keduanya ada di lembar tagihan atau aplikasi bank. Dibatasi 1–28 supaya ada di semua bulan.</p>
        <div>
          <Label>Tagihan saat ini</Label>
          <label className="flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 focus-within:bg-white focus-within:ring-1 focus-within:ring-indigo-300">
            <span className="text-slate-400">Rp</span>
            <input inputMode="numeric" value={used ? used.toLocaleString('id-ID') : ''} onChange={(e) => setBill(e.target.value)} placeholder="0" className="w-full bg-transparent text-[15px] font-semibold text-slate-800 outline-none" />
          </label>
          <p className="mt-1 pl-1 text-[11px] text-slate-400">Yang terpakai di kartu hari ini. Isi 0 kalau sudah lunas.</p>
        </div>
        <div>
          <Label>Limit kartu · opsional</Label>
          <label className="flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 focus-within:bg-white focus-within:ring-1 focus-within:ring-indigo-300">
            <span className="text-slate-400">Rp</span>
            <input inputMode="numeric" value={digits(limit) ? digits(limit).toLocaleString('id-ID') : ''} onChange={(e) => setLimit(e.target.value)} placeholder="0" className="w-full bg-transparent text-[15px] font-semibold text-slate-800 outline-none" />
          </label>
        </div>
      </div>

      <p className="mb-2 mt-5 pl-1 font-bold text-slate-900">Pengingat jatuh tempo</p>
      <div className="flex flex-wrap gap-2">
        {REMINDERS.map((r) => (
          <button key={r.v} type="button" onClick={() => setReminder(r.v)} className={cn('rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors', reminder === r.v ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')}>{r.label}</button>
        ))}
      </div>
      <p className="mt-1.5 pl-1 text-[11px] text-slate-400">Notifikasi sebelum tiap jatuh tempo (dan di hari H). Perlu tanggal cetak & jatuh tempo.</p>

      <p className="mb-2 mt-5 pl-1 font-bold text-slate-900">Jaringan</p>
      <div className="flex flex-wrap gap-2">
        {NETWORKS.map((n) => (
          <button key={n} type="button" onClick={() => setNetwork(network === n ? null : n)} className={cn('rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors', network === n ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')}>{n}</button>
        ))}
      </div>

      <p className="mb-2 mt-5 pl-1 font-bold text-slate-900">Warna kartu</p>
      <div className="flex flex-wrap gap-2.5 pb-2">
        {CARD_COLORS.map((c, i) => (
          <button key={c} type="button" aria-label={`Warna ${i + 1}`} onClick={() => setColor(c)} className={cn('flex h-10 w-10 items-center justify-center rounded-full ring-offset-2 transition-transform hover:scale-110', color === c && 'ring-2 ring-slate-900')} style={{ background: c }}>
            {color === c && <Check size={16} className="text-white" />}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {picking === 'bank' && (
          <PickList
            title="Pilih bank"
            value={bank}
            searchable
            options={[...CARD_BANKS.map((b) => ({ v: b, label: b, icon: <Logo src={logoFor(b, 'Bank Account')} fallback="🏦" bg="#e2e8f0" size={26} /> })), { v: OTHER_BANK, label: 'Bank lain (ketik sendiri)', icon: <span className="flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-slate-200 text-sm">✏️</span> }]}
            onPick={pickBank}
            onClose={() => setPicking(null)}
          />
        )}
        {(picking === 'cetak' || picking === 'tempo') && (
          <PickList title={picking === 'cetak' ? 'Tanggal cetak' : 'Jatuh tempo'} value={picking === 'cetak' ? statementDay : dueDay} options={days} onPick={(v) => (picking === 'cetak' ? setStatementDay(v) : setDueDay(v))} onClose={() => setPicking(null)} />
        )}
      </AnimatePresence>
    </Shell>
  );
}

// ================= Bayar tagihan kartu kartu =================
// Bayar tagihan = transfer dari rekening biasa ke kartu lewat
// POST /api/member/transfer (atomik di server, kurs dikonversi server) — sama
// dengan PayCardSheet di aplikasi HP. Bukan pengeluaran: belanjanya sudah
// dihitung waktu kartu dipakai.
export function PayBillModal({ card, used, cycle, sources, onClose }: {
  card: Account;
  used: number;
  cycle: CardCycle | null;
  sources: Account[];
  onClose: () => void;
}) {
  const { toast } = useFeedback();
  const [fromId, setFromId] = useState(sources[0]?.id ?? '');
  const [mode, setMode] = useState<'tagihan' | 'min' | 'semua' | 'lain'>(cycle && cycle.amountDue > 0 ? 'tagihan' : 'semua');
  const [other, setOther] = useState('');
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const from = sources.find((a) => a.id === fromId);
  const cardCur = card.currency || 'IDR';
  const sameCur = (from?.currency || 'IDR') === cardCur;
  const stmtMonth = cycle ? new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(new Date(`${cycle.statementDate}T00:00:00`)) : '';
  const fmtDay = (d: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(`${d}T00:00:00`));
  const shortRp = (n: number) => (n >= 1e6 ? `Rp${(n / 1e6).toFixed(2).replace('.', ',').replace(/,?0+$/, '')} jt` : formatMoney(n, cardCur));
  const options = [
    cycle && cycle.amountDue > 0 ? { id: 'tagihan' as const, label: `Tagihan ${stmtMonth} · ${shortRp(cycle.amountDue)}`, v: cycle.amountDue } : null,
    cycle && cycle.minPayment > 0 && cycle.minPayment < cycle.amountDue ? { id: 'min' as const, label: `Minimum · ${shortRp(cycle.minPayment)}`, v: cycle.minPayment } : null,
    used > 0 ? { id: 'semua' as const, label: `Lunasi semua · ${shortRp(used)}`, v: used } : null,
    { id: 'lain' as const, label: 'Jumlah lain', v: 0 },
  ].filter(Boolean) as { id: 'tagihan' | 'min' | 'semua' | 'lain'; label: string; v: number }[];
  const amount = mode === 'lain' ? digits(other) : options.find((o) => o.id === mode)?.v ?? 0;

  const save = async () => {
    if (!from?.id || !card.id || amount <= 0) return toast.error('Pilih rekening dan jumlahnya.');
    setSaving(true);
    try {
      await transferService.createTransfer({ fromAccountId: from.id, toAccountId: card.id, amount, note: `Bayar tagihan ${card.name}`, date: toLocalDateString() });
      toast.success(`Pembayaran ${card.name} ${formatMoney(amount, from.currency || 'IDR')} tercatat`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan pembayaran.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Shell
      title="Bayar tagihan kartu"
      label="Bayar tagihan kartu"
      onClose={onClose}
      footer={<button type="button" onClick={save} disabled={saving || amount <= 0 || !from} className="h-12 w-full rounded-full bg-slate-900 text-sm font-bold text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400">{saving ? 'Menyimpan…' : 'Simpan pembayaran'}</button>}
    >
      <div className="flex items-center gap-3 rounded-3xl bg-slate-50 p-4">
        <AccountLogo acc={card} size={40} />
        <span className="min-w-0">
          <span className="block truncate font-bold text-slate-900">{card.name}</span>
          <span className="block truncate text-[13px] text-slate-500">
            {cycle ? `Tagihan ${stmtMonth} ${formatMoney(cycle.amountDue, cardCur)} · Jatuh tempo ${fmtDay(cycle.dueDate)}` : `Terpakai ${formatMoney(used, cardCur)}`}
          </span>
        </span>
      </div>

      <div className="mt-4 space-y-4 rounded-3xl bg-slate-50 p-4">
        <div>
          <Label>Dibayar dari</Label>
          <button type="button" onClick={() => setPicking(true)} className="flex w-full items-center gap-3 rounded-2xl bg-slate-100 px-4 py-3 text-left hover:bg-slate-200/70">
            {from && <AccountLogo acc={from} size={22} />}
            <span className={cn('flex-1 text-[15px]', from ? 'text-slate-800' : 'text-slate-400')}>{from?.name ?? 'Pilih rekening'}</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-slate-500"><ChevronDown size={14} /></span>
          </button>
        </div>
        <div>
          <Label>Jumlah</Label>
          <div className="flex flex-wrap gap-2">
            {options.map((o) => (
              <button key={o.id} type="button" onClick={() => setMode(o.id)} className={cn('rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors', mode === o.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')}>{o.label}</button>
            ))}
          </div>
          <AnimatePresence initial={false}>
            {mode === 'lain' && (
              <motion.label initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-3 flex items-center gap-2 overflow-hidden rounded-2xl bg-slate-100 px-4 py-3 focus-within:bg-white focus-within:ring-1 focus-within:ring-indigo-300">
                <span className="text-slate-400">Rp</span>
                <input autoFocus inputMode="numeric" aria-label="Jumlah lain" value={digits(other) ? digits(other).toLocaleString('id-ID') : ''} onChange={(e) => setOther(e.target.value)} placeholder="0" className="w-full bg-transparent text-[15px] font-semibold text-slate-800 outline-none" />
              </motion.label>
            )}
          </AnimatePresence>
          {!sameCur && <p className="mt-2 text-xs text-amber-600">Mata uang berbeda — jumlah dikonversi otomatis di server.</p>}
        </div>
      </div>

      <div className="mt-4 flex gap-3 rounded-3xl bg-indigo-50 p-4 text-[13px] text-indigo-900">
        <ArrowLeftRight size={16} className="mt-0.5 shrink-0 text-indigo-500" />
        <span>Bayar tagihan tidak dihitung sebagai pengeluaran baru — belanjanya sudah tercatat saat kartu dipakai. Ini hanya memindahkan saldo.</span>
      </div>

      <AnimatePresence>
        {picking && (
          <PickList title="Dibayar dari" value={fromId} options={sources.map((a) => ({ v: a.id ?? '', label: `${a.name} · ${formatMoney(a.balance || 0, a.currency || 'IDR')}`, icon: <AccountLogo acc={a} size={26} /> }))} onPick={setFromId} onClose={() => setPicking(false)} />
        )}
      </AnimatePresence>
    </Shell>
  );
}
