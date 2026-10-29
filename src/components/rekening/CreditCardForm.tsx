"use client";

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, BellOff, Camera, ChevronDown, Loader2, ScanLine, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { NumberInput } from '@/components/ui/NumberInput';
import { useFeedback } from '@/components/ui/Feedback';
import { CardFace } from '@/components/rekening/CardFace';
import { accountService, type Account } from '@/lib/services/accountService';
import { CARD_NETWORK_OPTIONS, computeCreditUsage, creditBalanceFromUsed } from '@/lib/creditCard';
import { CARD_COLOR_OPTIONS } from '@/lib/cardColors';
import { matchIndonesianInstitutionLogo } from '@/lib/indonesianBanks';
import { imageFileToBase64 } from '@/lib/quick/ai';
import { cn, formatMoney } from '@/lib/utils';

// Form khusus kartu kredit (tambah & ubah) — menggantikan form rekening umum
// untuk jenis "Credit Card". Pratinjau kartu ikut berubah saat diisi; "Pindai
// kartu" mengisi bank, jaringan & 4 digit terakhir dari foto depan kartu
// (foto tidak disimpan, nomor lengkap tidak pernah dikirim balik server).
// Data disimpan ke rekening biasa (type 'Credit Card'): tagihan terpakai →
// balance negatif (creditBalanceFromUsed), siklus/identitas/pengingat di
// payload_json lewat accountService.

const BANKS = ['BCA', 'Mandiri', 'BNI', 'BRI', 'CIMB Niaga', 'Danamon', 'Permata', 'OCBC', 'Maybank', 'Mega', 'UOB', 'HSBC', 'Citibank', 'DBS', 'Panin', 'BTN', 'Sinarmas', 'Standard Chartered'];
const REMINDERS: { v: number; label: string }[] = [
  { v: 0, label: 'Mati' },
  { v: 1, label: 'H-1' },
  { v: 3, label: 'H-3' },
  { v: 5, label: 'H-5' },
  { v: 7, label: 'H-7' },
];
const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

type Form = {
  bank: string;
  name: string;
  logoUrl: string;
  last4: string;
  statementDay: number | null;
  dueDay: number | null;
  used: string;
  limit: string;
  minPct: string;
  minAmount: string;
  reminder: number;
  network: string;
  color: string;
};

const emptyForm: Form = { bank: '', name: '', logoUrl: '', last4: '', statementDay: null, dueDay: null, used: '', limit: '', minPct: '', minAmount: '', reminder: 3, network: '', color: 'slate' };

const BANK_ALIASES: Record<string, string> = { 'central asia': 'BCA', 'negara indonesia': 'BNI', 'rakyat indonesia': 'BRI', 'cimb': 'CIMB Niaga', 'ocbc nisp': 'OCBC', 'bank mega': 'Mega' };

const fromAccount = (a: Account): Form => ({
  bank: BANKS.find((b) => a.name.toLowerCase().startsWith(b.toLowerCase())) ?? '',
  name: a.name,
  logoUrl: a.logoUrl ?? '',
  last4: a.cardLast4 ?? '',
  statementDay: a.statementDay ?? null,
  dueDay: a.dueDay ?? null,
  used: String(Math.round(computeCreditUsage(a).used) || ''),
  limit: a.creditLimit ? String(a.creditLimit) : '',
  minPct: a.minPaymentPercent !== undefined ? String(a.minPaymentPercent) : '',
  minAmount: a.minPaymentAmount !== undefined ? String(a.minPaymentAmount) : '',
  reminder: a.reminderDays ?? 3,
  network: a.cardNetwork ?? '',
  color: a.cardColor || 'slate',
});

export function CreditCardForm({
  isOpen,
  onClose,
  userId,
  initialData,
  onDeleted,
}: {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  initialData?: Account | null;
  onDeleted?: () => void;
}) {
  const { toast, confirm } = useFeedback();
  const [f, setF] = useState<Form>(emptyForm);
  const [picker, setPicker] = useState<'statement' | 'due' | null>(null);
  const [showMin, setShowMin] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const editing = Boolean(initialData?.id);
  const currency = initialData?.currency || 'IDR';

  useEffect(() => {
    if (!isOpen) return;
    setF(initialData ? fromAccount(initialData) : emptyForm);
    setPicker(null);
    setShowMin(Boolean(initialData?.minPaymentPercent !== undefined || initialData?.minPaymentAmount !== undefined));
    setScanned([]);
    setError('');
  }, [isOpen, initialData]);

  const set = (patch: Partial<Form>) => setF((cur) => ({ ...cur, ...patch }));
  // Pilih bank: logo ikut, nama terisi kalau masih kosong/nama bank sebelumnya.
  const pickBank = (bank: string, cur: Form): Partial<Form> => ({
    bank,
    logoUrl: matchIndonesianInstitutionLogo(bank, 'Credit Card') ?? cur.logoUrl,
    name: !cur.name || cur.name === cur.bank ? bank : cur.name,
  });

  const onScanFile = async (file: File | undefined) => {
    if (!file) return;
    setScanning(true);
    setError('');
    try {
      const base64 = await imageFileToBase64(file, 1280, 0.82);
      const res = await accountService.scanCard(base64);
      // "Bank Mandiri", "PT Bank Central Asia" → cocokkan tanpa awalan umum.
      const bankText = (res.bank ?? '').toLowerCase().replace(/^(pt\.?\s+)?(bank\s+)/, '').trim();
      const known = bankText
        ? BANKS.find((b) => bankText.startsWith(b.toLowerCase()) || b.toLowerCase().startsWith(bankText)) ??
          Object.entries(BANK_ALIASES).find(([alias]) => bankText.startsWith(alias))?.[1]
        : undefined;
      const found = [
        known ?? res.bank,
        res.network ? CARD_NETWORK_OPTIONS.find((n) => n.key === res.network)?.label ?? res.network : null,
        res.last4 ? `•••• ${res.last4}` : null,
      ].filter((x): x is string => Boolean(x));
      setF((cur) => {
        let next: Form = { ...cur };
        if (known) next = { ...next, ...pickBank(known, next) };
        else if (res.bank) next.name = next.name || res.bank;
        if (res.network) next.network = res.network;
        if (res.last4) next.last4 = res.last4;
        return next;
      });
      setScanned(found);
      toast.success(found.length ? `Terbaca: ${found.join(' · ')}` : 'Kartu terbaca.');
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error && e.message ? e.message : 'Kartu tidak terbaca. Isi manual ya.');
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = async () => {
    setError('');
    const name = f.name.trim();
    if (!name) return setError('Isi nama kartu.');
    if (f.last4 && !/^\d{4}$/.test(f.last4)) return setError('4 digit terakhir harus tepat 4 angka.');
    if (f.statementDay && f.statementDay === f.dueDay) return setError('Tanggal cetak dan jatuh tempo tidak boleh sama.');
    const used = Number(f.used) || 0;
    const fields = {
      name,
      logoUrl: f.logoUrl,
      type: 'Credit Card',
      currency,
      balance: creditBalanceFromUsed(used),
      creditLimit: Number(f.limit) || 0,
      cardColor: f.color,
      statementDay: f.statementDay ?? undefined,
      dueDay: f.dueDay ?? undefined,
      minPaymentPercent: f.minPct.trim() === '' ? undefined : Number(f.minPct),
      minPaymentAmount: f.minAmount.trim() === '' ? undefined : Number(f.minAmount),
      cardLast4: f.last4,
      cardNetwork: f.network,
      reminderDays: f.reminder,
    };
    setSaving(true);
    try {
      if (initialData?.id) await accountService.updateAccount(initialData.id, fields);
      else await accountService.createAccount({ userId, ...fields, initialBalance: used, baseValue: 0 });
      toast.success(editing ? 'Kartu diperbarui.' : `Kartu ${name} ditambahkan.`);
      onClose();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error && e.message ? e.message : 'Gagal menyimpan kartu. Coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!initialData?.id) return;
    const ok = await confirm({
      title: `Hapus kartu ${initialData.name}?`,
      message: 'Kartu hanya bisa dihapus kalau belum punya transaksi. Tindakan ini tidak bisa dibatalkan.',
      confirmLabel: 'Hapus kartu',
      danger: true,
    });
    if (!ok) return;
    setSaving(true);
    try {
      await accountService.deleteAccount(initialData.id);
      toast.success(`Kartu ${initialData.name} dihapus.`);
      onClose();
      onDeleted?.();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error && e.message ? e.message : 'Gagal menghapus kartu.');
    } finally {
      setSaving(false);
    }
  };

  const dueHint =
    f.statementDay && f.dueDay
      ? f.dueDay > f.statementDay
        ? `Tagihan dicetak tgl ${f.statementDay}, bayar paling lambat tgl ${f.dueDay} bulan yang sama.`
        : `Tagihan dicetak tgl ${f.statementDay}, bayar paling lambat tgl ${f.dueDay} bulan berikutnya.`
      : 'Ada di lembar tagihan atau aplikasi bankmu. Tanpa ini, tagihan & pengingat tidak dihitung.';

  const section = 'space-y-3 rounded-[20px] bg-slate-50 p-4';
  const label = 'text-[12px] font-semibold text-slate-500';
  const input = 'w-full rounded-2xl bg-white px-4 py-2.5 text-[15px] font-semibold text-slate-900 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-400 placeholder:font-normal placeholder:text-slate-400';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editing ? 'Ubah kartu kredit' : 'Kartu kredit baru'} maxWidth="max-w-lg">
      <div className="space-y-4">
        {/* Pratinjau langsung */}
        <div className="mx-auto w-full max-w-[340px]">
          <CardFace
            name={f.name}
            logoUrl={f.logoUrl}
            last4={f.last4}
            network={f.network}
            color={f.color}
            chip={f.statementDay && f.dueDay ? `Cetak ${f.statementDay} · tempo ${f.dueDay}` : 'Belum ada tanggal'}
            amountLabel="Tagihan saat ini"
            amount={formatMoney(Number(f.used) || 0, currency)}
            className="shadow-[0_22px_40px_-20px_rgba(15,23,42,0.7)]"
            overlay={
              <AnimatePresence>
                {scanning && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/55">
                    <motion.span aria-hidden className="absolute inset-x-4 h-0.5 rounded-full bg-emerald-300 shadow-[0_0_12px_2px_rgba(110,231,183,0.8)]" animate={{ top: ['12%', '88%', '12%'] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }} />
                    <p className="relative text-[13px] font-semibold">Leo lagi baca kartumu…</p>
                  </motion.div>
                )}
              </AnimatePresence>
            }
          />
        </div>

        {/* Pindai */}
        <div className="flex items-center gap-3 rounded-[20px] border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-indigo-600"><ScanLine size={20} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold text-slate-900">Pindai kartu</p>
            <p className="text-[12px] leading-snug text-slate-500">
              {scanned.length ? `Terisi: ${scanned.join(' · ')}` : 'Foto depan kartu → bank, jaringan & 4 digit terakhir terisi otomatis. Foto tidak disimpan.'}
            </p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void onScanFile(e.target.files?.[0])} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={scanning || saving} className="flex shrink-0 items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-2 text-[13px] font-bold text-white disabled:opacity-50">
            {scanning ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />} Foto
          </button>
        </div>

        {error && <p className="rounded-2xl bg-rose-50 px-4 py-2.5 text-[13px] font-medium text-rose-600 ring-1 ring-rose-100">{error}</p>}

        {/* Kartu */}
        <div className={section}>
          <p className={label}>Bank</p>
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 no-scrollbar">
            {BANKS.map((b) => (
              <button key={b} type="button" onClick={() => setF((cur) => ({ ...cur, ...pickBank(b, cur) }))} className={cn('shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold ring-1 transition-colors', f.bank === b ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-100')}>
                {b}
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <label className="block min-w-0">
              <span className={label}>Nama kartu</span>
              <input value={f.name} onChange={(e) => set({ name: e.target.value })} maxLength={60} placeholder="mis. BCA Visa Platinum" className={cn(input, 'mt-1')} />
            </label>
            <label className="block">
              <span className={label}>4 digit terakhir</span>
              <input
                inputMode="numeric"
                value={f.last4}
                onChange={(e) => set({ last4: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                placeholder="4821"
                aria-label="4 digit terakhir"
                className={cn(input, 'mt-1 text-center font-mono tracking-[0.3em] sm:w-[120px]')}
              />
            </label>
          </div>
          <p className="text-[11px] text-slate-400">Hanya 4 digit terakhir yang disimpan — nomor lengkap tidak pernah diminta.</p>
        </div>

        {/* Tanggal */}
        <div className={section}>
          <div className="grid grid-cols-2 gap-2">
            {([['statement', 'Tanggal cetak', f.statementDay], ['due', 'Jatuh tempo', f.dueDay]] as const).map(([key, text, value]) => (
              <button key={key} type="button" onClick={() => setPicker((p) => (p === key ? null : key))} className={cn('rounded-2xl bg-white px-4 py-2.5 text-left ring-1', picker === key ? 'ring-2 ring-indigo-400' : 'ring-slate-200')}>
                <span className={label}>{text}</span>
                <span className="flex items-center justify-between text-[15px] font-bold text-slate-900">
                  {value ? `Tgl ${value}` : <span className="font-normal text-slate-400">Pilih</span>}
                  <ChevronDown size={16} className={cn('text-slate-400 transition-transform', picker === key && 'rotate-180')} />
                </span>
              </button>
            ))}
          </div>
          <AnimatePresence initial={false}>
            {picker && (
              <motion.div key="day-grid" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="grid grid-cols-7 gap-1 rounded-2xl bg-white p-2 ring-1 ring-slate-200">
                  {DAYS.map((d) => {
                    const active = (picker === 'statement' ? f.statementDay : f.dueDay) === d;
                    const other = (picker === 'statement' ? f.dueDay : f.statementDay) === d;
                    return (
                      <button
                        key={d}
                        type="button"
                        disabled={other}
                        onClick={() => {
                          set(picker === 'statement' ? { statementDay: d } : { dueDay: d });
                          setPicker(picker === 'statement' && !f.dueDay ? 'due' : null);
                        }}
                        className={cn('aspect-square rounded-xl text-[13px] font-semibold transition-colors', active ? 'bg-slate-900 text-white' : other ? 'text-slate-300 line-through' : 'text-slate-700 hover:bg-indigo-50')}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <p className="text-[12px] text-slate-500">{dueHint}</p>
        </div>

        {/* Tagihan & limit */}
        <div className={section}>
          <div className="grid grid-cols-2 gap-2">
            <label className="min-w-0">
              <span className={label}>Tagihan saat ini</span>
              <NumberInput value={f.used} onChange={(v) => set({ used: v })} placeholder="0" className={cn(input, 'mt-1')} />
            </label>
            <label className="min-w-0">
              <span className={label}>Limit · opsional</span>
              <NumberInput value={f.limit} onChange={(v) => set({ limit: v })} placeholder="0" className={cn(input, 'mt-1')} />
            </label>
          </div>
          <p className="text-[11px] text-slate-400">Tagihan = yang sudah terpakai hari ini (lihat aplikasi bank). Isi 0 kalau lunas.</p>
          <button type="button" onClick={() => setShowMin((v) => !v)} className="flex items-center gap-1 text-[12px] font-bold text-indigo-600">
            Minimum bayar <ChevronDown size={14} className={cn('transition-transform', showMin && 'rotate-180')} />
          </button>
          {showMin && (
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className={label}>Persen (%)</span>
                <input type="number" inputMode="decimal" min={0} max={100} step="0.5" value={f.minPct} onChange={(e) => set({ minPct: e.target.value })} placeholder="10" className={cn(input, 'mt-1')} />
              </label>
              <label>
                <span className={label}>Paling sedikit</span>
                <NumberInput value={f.minAmount} onChange={(v) => set({ minAmount: v })} placeholder="50.000" className={cn(input, 'mt-1')} />
              </label>
            </div>
          )}
        </div>

        {/* Pengingat */}
        <div className={section}>
          <p className={cn(label, 'flex items-center gap-1.5')}>{f.reminder ? <Bell size={13} /> : <BellOff size={13} />} Ingatkan aku sebelum jatuh tempo</p>
          <div className="flex rounded-full bg-slate-200/70 p-1">
            {REMINDERS.map((r) => (
              <button key={r.v} type="button" onClick={() => set({ reminder: r.v })} className={cn('flex-1 rounded-full py-1.5 text-[13px] font-semibold transition-colors', f.reminder === r.v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>
                {r.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-400">
            {f.reminder ? `Notifikasi mulai ${f.reminder} hari sebelum jatuh tempo${f.reminder > 1 ? ', lalu H-1' : ''} dan di hari H — kalau masih ada tagihan.` : 'Tidak ada notifikasi jatuh tempo untuk kartu ini.'}
          </p>
        </div>

        {/* Tampilan */}
        <div className={section}>
          <p className={label}>Jaringan</p>
          <div className="flex flex-wrap gap-1.5">
            {CARD_NETWORK_OPTIONS.map((n) => (
              <button key={n.key} type="button" onClick={() => set({ network: f.network === n.key ? '' : n.key })} className={cn('rounded-full px-3 py-1.5 text-[13px] font-semibold ring-1', f.network === n.key ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-100')}>
                {n.label}
              </button>
            ))}
          </div>
          <p className={label}>Warna kartu</p>
          <div className="flex flex-wrap gap-2.5">
            {CARD_COLOR_OPTIONS.map((c) => (
              <button key={c.key} type="button" onClick={() => set({ color: c.key })} aria-label={`Warna ${c.label}`} aria-pressed={f.color === c.key} className={cn('h-9 w-9 rounded-full transition-transform hover:scale-110', c.gradient, f.color === c.key && 'ring-2 ring-slate-900 ring-offset-2')} />
            ))}
          </div>
        </div>

        <div className="space-y-2 pt-1">
          <button type="button" onClick={() => void save()} disabled={saving || scanning} className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 py-3 text-[15px] font-bold text-white disabled:opacity-50">
            {saving && <Loader2 size={16} className="animate-spin" />} {editing ? 'Simpan perubahan' : 'Simpan kartu'}
          </button>
          {editing && (
            <button type="button" onClick={() => void remove()} disabled={saving} className="flex w-full items-center justify-center gap-1.5 py-1.5 text-[13px] font-semibold text-rose-600 disabled:opacity-50">
              <Trash2 size={14} /> Hapus kartu
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
