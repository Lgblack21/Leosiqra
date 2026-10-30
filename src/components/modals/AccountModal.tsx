"use client";

import { useState, useEffect } from 'react';
import { Camera, Check, Loader2 } from 'lucide-react';
import { cn, formatMoney } from '@/lib/utils';
import { LogoImage } from '@/components/ui/LogoImage';
import { Modal } from '@/components/ui/Modal';
import { useFeedback } from '@/components/ui/Feedback';
import { accountService, Account } from '@/lib/services/accountService';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { CurrencySelect } from '@/components/CurrencySelect';
import { NumberInput } from '@/components/ui/NumberInput';
import { CARD_COLOR_OPTIONS, getCardGradientClass } from '@/lib/cardColors';
import { CARD_NETWORK_OPTIONS } from '@/lib/creditCard';
import { matchIndonesianInstitutionLogo } from '@/lib/indonesianBanks';
import { isCreditAccountType, computeCreditUsage, creditBalanceFromUsed } from '@/lib/creditCard';
import { CardCycleFields, emptyCardCycleForm, cardCycleFromForm, cardCycleToForm } from './CardCycleFields';
import { useRef } from 'react';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  initialType?: Account['type'];
  title?: string;
  initialData?: Account | null;
  // Jenis rekening custom yang sudah pernah dipakai user (mis. "Reksadana",
  // "Emas Digital"), supaya bisa dipilih ulang tanpa mengetik lagi.
  existingTypes?: string[];
  // Kartu kredit punya form khusus (CreditCardForm): kalau diisi, memilih
  // jenis "Credit Card" saat menambah rekening baru pindah ke form itu.
  onCreditCard?: () => void;
  /** Isian awal untuk rekening BARU (mis. dari pemilih bank di Kekayaan). */
  preset?: { name?: string; type?: string; logoUrl?: string } | null;
}

// 'Investment Account' tidak ditawarkan lagi (investasi dicatat di Investasiku);
// rekening lama berjenis itu tetap tampil saat diedit.
const BUILT_IN_TYPES = ['Bank Account', 'E-Wallet', 'Cash', 'Credit Card'];
const HIDDEN_TYPES = new Set(['Investment Account']);
const CUSTOM_TYPE_VALUE = '__custom__';
// Tampilan form (2026-10-30): pratinjau kartu langsung, jenis sebagai tombol,
// pilihan cepat bank/e-wallet berlogo. Logika simpan tidak berubah.
const TYPE_META: Record<string, { emoji: string; label: string }> = {
  'Bank Account': { emoji: '🏦', label: 'Bank' },
  'E-Wallet': { emoji: '📱', label: 'E-wallet' },
  Cash: { emoji: '💵', label: 'Tunai' },
  'Investment Account': { emoji: '📈', label: 'Investasi' },
  'Credit Card': { emoji: '💳', label: 'Kartu kredit' },
};
const QUICK_PICKS: Record<string, string[]> = {
  'Bank Account': ['BCA', 'Mandiri', 'BRI', 'BNI', 'BSI', 'CIMB Niaga', 'Jago', 'SeaBank', 'blu', 'Jenius', 'Permata', 'Danamon'],
  'E-Wallet': ['GoPay', 'OVO', 'DANA', 'ShopeePay', 'LinkAja', 'Flip'],
};

export const AccountModal = ({ isOpen, onClose, userId, initialType = 'Bank Account', title = 'Tambah Rekening Baru', initialData = null, existingTypes = [], onCreditCard, preset = null }: AccountModalProps) => {
  const { toast } = useFeedback();
  const [formData, setFormData] = useState({
    name: '',
    logoUrl: '',
    type: initialType,
    currency: 'IDR',
    balance: '',
    initialBalance: '',
    baseValue: '',
    creditLimit: '',
    cardColor: '',
    cardLast4: '',
    cardNetwork: ''
  });
  const [cycleForm, setCycleForm] = useState(emptyCardCycleForm);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isCustomTypeMode, setIsCustomTypeMode] = useState(false);
  // Lacak apakah logo saat ini hasil auto-match (boleh ditimpa lagi kalau nama
  // diganti) atau hasil upload manual/data lama (jangan pernah ditimpa diam-diam).
  const [logoIsAuto, setLogoIsAuto] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Gabungan jenis bawaan + jenis custom yang pernah dipakai user + jenis akun
  // yang sedang diedit (kalau custom), supaya semuanya tetap terpilih di dropdown.
  const typeOptions = (() => {
    const set = new Set<string>(BUILT_IN_TYPES);
    existingTypes.forEach((t) => t && !HIDDEN_TYPES.has(t) && set.add(t));
    if (formData.type) set.add(formData.type);
    return Array.from(set);
  })();

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      setFormData(prev => ({ ...prev, logoUrl: url }));
      setLogoIsAuto(false);
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Gagal mengunggah logo. Coba file lain atau ulangi sebentar lagi.");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setIsCustomTypeMode(false);
    // Auto-logo hanya untuk rekening baru — jangan pernah menimpa diam-diam
    // logo yang sudah ada di rekening yang sedang diedit.
    setLogoIsAuto(!initialData);
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        logoUrl: initialData.logoUrl || '',
        type: initialData.type || initialType,
        currency: initialData.currency || 'IDR',
        // Kartu kredit: field ini berarti "Tagihan Terpakai Saat Ini" (positif),
        // sedangkan `balance` kartu disimpan sebagai −tagihan.
        balance: isCreditAccountType(initialData.type)
          ? String(computeCreditUsage(initialData).used)
          : String(initialData.balance ?? ''),
        initialBalance: String(initialData.initialBalance ?? ''),
        baseValue: String(initialData.baseValue ?? ''),
        creditLimit: initialData.creditLimit ? String(initialData.creditLimit) : '',
        cardColor: initialData.cardColor || '',
        cardLast4: initialData.cardLast4 || '',
        cardNetwork: initialData.cardNetwork || ''
      });
      setCycleForm(cardCycleToForm(initialData));
    } else if (preset) {
      setCycleForm(emptyCardCycleForm);
      setFormData({ name: preset.name ?? '', logoUrl: preset.logoUrl ?? '', type: preset.type || initialType, currency: 'IDR', balance: '', initialBalance: '', baseValue: '', creditLimit: '', cardColor: '', cardLast4: '', cardNetwork: '' });
    } else {
      setCycleForm(emptyCardCycleForm);
      setFormData(prev => ({
        ...prev,
        type: initialType
      }));
    }
  }, [isOpen, initialType, initialData, preset]);

  const handleCreate = async () => {
    if (!userId || !formData.name) return;
    setError('');
    setSaving(true);
    try {
      const enteredValue = parseFloat(formData.balance) || 0;
      const isCredit = isCreditAccountType(formData.type);
      const balanceToStore = isCredit ? creditBalanceFromUsed(enteredValue) : enteredValue;
      if (isCredit && cycleForm.statementDay && cycleForm.statementDay === cycleForm.dueDay) {
        setError('Tanggal cetak dan jatuh tempo tidak boleh sama.');
        setSaving(false);
        return;
      }
      // Field siklus cuma dikirim untuk kartu kredit.
      if (isCredit && formData.cardLast4 && !/^\d{4}$/.test(formData.cardLast4)) {
        setError('4 digit terakhir kartu harus tepat 4 angka.');
        setSaving(false);
        return;
      }
      // Field siklus & identitas kartu cuma dikirim untuk kartu kredit.
      const cycle = isCredit ? { ...cardCycleFromForm(cycleForm), cardLast4: formData.cardLast4, cardNetwork: formData.cardNetwork } : {};
      if (initialData?.id) {
        // initialBalance sengaja TIDAK dikirim saat edit — dulu tiap edit
        // (termasuk sekadar ganti nama/warna) menimpanya dengan saldo saat
        // ini, sehingga nilai awal rekening hilang dan tagihan kartu kredit
        // ikut bergeser.
        await accountService.updateAccount(initialData.id, {
          name: formData.name,
          logoUrl: formData.logoUrl,
          type: formData.type,
          currency: formData.currency,
          balance: balanceToStore,
          baseValue: parseFloat(formData.baseValue) || 0,
          creditLimit: parseFloat(formData.creditLimit) || 0,
          cardColor: formData.cardColor,
          ...cycle,
        });
      } else {
        await accountService.createAccount({
          userId: userId,
          name: formData.name,
          logoUrl: formData.logoUrl,
          type: formData.type,
          currency: formData.currency,
          balance: balanceToStore,
          // Catatan nilai awal saat rekening dibuat (saldo awal / tagihan awal).
          initialBalance: enteredValue,
          baseValue: parseFloat(formData.baseValue) || 0,
          creditLimit: parseFloat(formData.creditLimit) || 0,
          cardColor: formData.cardColor,
          ...cycle,
        });
      }
      onClose();
      setFormData({ name: '', logoUrl: '', type: initialType, currency: 'IDR', balance: '', initialBalance: '', baseValue: '', creditLimit: '', cardColor: '', cardLast4: '', cardNetwork: '' });
      setIsCustomTypeMode(false);
    } catch (err) {
      console.error("Error saving account:", err);
      setError(err instanceof Error ? err.message : 'Gagal menyimpan rekening. Silakan coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  const isCredit = formData.type === 'Credit Card';
  const typeMeta = (t: string) => TYPE_META[t] ?? { emoji: '🗂️', label: t };
  const picks = !initialData ? QUICK_PICKS[formData.type] ?? [] : [];
  const pickName = (name: string) => {
    const logo = matchIndonesianInstitutionLogo(name, formData.type);
    setFormData({ ...formData, name, logoUrl: logo && (logoIsAuto || !formData.logoUrl) ? logo : formData.logoUrl });
    if (logo && (logoIsAuto || !formData.logoUrl)) setLogoIsAuto(true);
  };
  const chooseType = (newType: string) => {
    if (newType === CUSTOM_TYPE_VALUE) {
      setIsCustomTypeMode(true);
      setFormData({ ...formData, type: '' });
      return;
    }
    setIsCustomTypeMode(false);
    if (newType === 'Credit Card' && !initialData && onCreditCard) {
      onCreditCard();
      return;
    }
    const matched = !initialData ? matchIndonesianInstitutionLogo(formData.name, newType) : null;
    if (matched && (logoIsAuto || !formData.logoUrl)) {
      setFormData({ ...formData, type: newType, logoUrl: matched });
      setLogoIsAuto(true);
    } else {
      setFormData({ ...formData, type: newType });
    }
  };
  const balanceNum = parseFloat(formData.balance) || 0;
  const label = 'pl-1 text-[12px] font-semibold text-slate-500';
  const field = 'w-full rounded-2xl border-none bg-slate-50 px-4 py-3 text-[15px] font-semibold text-slate-800 ring-1 ring-transparent transition-all placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:ring-slate-300';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Ubah rekening' : title}
      maxWidth="max-w-lg"
    >
      <div className="space-y-5">
        {error && <div className="rounded-2xl border border-rose-100 bg-rose-50 p-3.5 text-sm font-medium text-rose-600">{error}</div>}

        {/* Pratinjau */}
        <div className={cn('relative overflow-hidden rounded-[24px] p-5 text-white shadow-[0_18px_40px_-20px_rgba(15,23,42,0.6)] transition-colors duration-300', getCardGradientClass(formData.cardColor, formData.type))}>
          <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10" />
          <div className="relative flex items-center gap-3">
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} aria-label={formData.logoUrl ? 'Ganti logo' : 'Unggah logo'} className="group relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white text-[22px] ring-2 ring-white/30">
              {uploading ? <Loader2 className="animate-spin text-slate-400" size={18} /> : formData.logoUrl ? (
                <LogoImage src={formData.logoUrl} alt={formData.name || 'Logo'} fallbackText={(formData.name || '?').slice(0, 3).toUpperCase()} className="h-full w-full object-contain p-1" />
              ) : <span aria-hidden>{typeMeta(formData.type).emoji}</span>}
              <span className="absolute inset-0 flex items-center justify-center bg-slate-900/50 opacity-0 transition-opacity group-hover:opacity-100"><Camera size={16} /></span>
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[17px] font-bold">{formData.name || 'Nama rekening'}</p>
              <p className="text-[12px] text-white/70">{typeMeta(formData.type).label || 'Jenis rekening'}{formData.currency !== 'IDR' ? ` · ${formData.currency}` : ''}</p>
            </div>
          </div>
          <p className="relative mt-5 text-[11px] text-white/60">{isCredit ? 'Tagihan terpakai' : 'Saldo'}</p>
          <p className="relative text-[26px] font-extrabold tabular-nums leading-tight">{formatMoney(isCredit ? -balanceNum : balanceNum, formData.currency)}</p>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
        </div>

        {/* Jenis */}
        <div className="space-y-2">
          <p className={label}>Jenis</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {[...typeOptions.filter((t) => t), CUSTOM_TYPE_VALUE].map((t) => {
              const active = t === CUSTOM_TYPE_VALUE ? isCustomTypeMode : !isCustomTypeMode && formData.type === t;
              const meta = t === CUSTOM_TYPE_VALUE ? { emoji: '➕', label: 'Lainnya' } : typeMeta(t);
              return (
                <button key={t} type="button" onClick={() => chooseType(t)} aria-pressed={active} className={cn('flex flex-col items-center gap-1 rounded-2xl px-2 py-2.5 text-center transition-all', active ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-50 text-slate-700 hover:bg-slate-100')}>
                  <span aria-hidden className="text-[20px] leading-none">{meta.emoji}</span>
                  <span className="line-clamp-1 text-[12px] font-semibold">{meta.label}</span>
                </button>
              );
            })}
          </div>
          {isCustomTypeMode && (
            <input autoFocus type="text" value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} placeholder="Nama jenis, mis. Reksadana atau Emas Digital" className={field} />
          )}
        </div>

        {/* Nama */}
        <div className="space-y-2">
          <label htmlFor="acc-name" className={label}>Nama</label>
          <input
            id="acc-name"
            type="text"
            value={formData.name}
            onChange={(e) => {
              const newName = e.target.value;
              const matched = !initialData ? matchIndonesianInstitutionLogo(newName, formData.type) : null;
              if (matched && (logoIsAuto || !formData.logoUrl)) {
                setFormData({ ...formData, name: newName, logoUrl: matched });
                setLogoIsAuto(true);
              } else {
                setFormData({ ...formData, name: newName });
              }
            }}
            placeholder={formData.type === 'E-Wallet' ? 'mis. GoPay' : formData.type === 'Cash' ? 'mis. Dompet' : 'mis. BCA Tabungan'}
            className={field}
          />
          {picks.length > 0 && (
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 no-scrollbar">
              {picks.map((n) => (
                <button key={n} type="button" onClick={() => pickName(n)} className={cn('flex shrink-0 items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-[12px] font-semibold ring-1 transition-colors', formData.name === n ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50')}>
                  <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-white">
                    <LogoImage src={matchIndonesianInstitutionLogo(n, formData.type) ?? undefined} alt={n} fallbackText={n.slice(0, 2).toUpperCase()} className="h-full w-full object-contain" />
                  </span>
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Saldo */}
        <div className="space-y-2">
          <label className={label}>{isCredit ? 'Tagihan terpakai sekarang' : 'Saldo sekarang'}</label>
          <div className="flex items-stretch gap-2">
            <div className="relative flex-1">
              <NumberInput value={formData.balance} onChange={(val) => setFormData({ ...formData, balance: val })} placeholder="0" className={cn(field, 'py-3.5 text-[22px] font-extrabold tabular-nums')} />
            </div>
            <CurrencySelect compact value={formData.currency} onChange={(val) => setFormData({ ...formData, currency: val })} className="w-[104px] shrink-0 [&>div]:h-full" />
          </div>
          <p className="pl-1 text-[12px] leading-relaxed text-slate-400">
            {isCredit ? 'Isi 0 kalau belum ada. Belanja pakai kartu ini otomatis menambah tagihan.' : 'Samakan dengan saldo di aplikasi bank/dompet. Transaksi berikutnya mengubahnya otomatis.'}
          </p>
        </div>

        {isCredit && (
          <div className="space-y-4 rounded-[22px] bg-slate-50 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className={label}>Limit</label>
                <NumberInput value={formData.creditLimit} onChange={(val) => setFormData({ ...formData, creditLimit: val })} placeholder="0" className={cn(field, 'bg-white')} />
              </div>
              <div className="space-y-2">
                <label className={label}>4 digit terakhir</label>
                <input inputMode="numeric" maxLength={4} value={formData.cardLast4} onChange={(e) => setFormData({ ...formData, cardLast4: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="4821" className={cn(field, 'bg-white tracking-[0.3em]')} />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CARD_NETWORK_OPTIONS.map((n) => (
                <button key={n.key} type="button" onClick={() => setFormData({ ...formData, cardNetwork: formData.cardNetwork === n.key ? '' : n.key })} className={cn('rounded-full px-3 py-1.5 text-xs font-bold transition-all', formData.cardNetwork === n.key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100')}>
                  {n.label}
                </button>
              ))}
            </div>
            <CardCycleFields value={cycleForm} onChange={setCycleForm} />
          </div>
        )}

        {/* Warna */}
        <div className="space-y-2">
          <p className={label}>Warna kartu</p>
          <div className="flex flex-wrap gap-2.5">
            <button type="button" onClick={() => setFormData({ ...formData, cardColor: '' })} title="Otomatis sesuai jenis" aria-label="Warna otomatis" className={cn('flex h-9 w-9 items-center justify-center rounded-full border-2 border-dashed border-slate-300 text-[10px] font-bold text-slate-400', !formData.cardColor && 'ring-2 ring-slate-900 ring-offset-2')}>A</button>
            {CARD_COLOR_OPTIONS.map((opt) => (
              <button key={opt.key} type="button" onClick={() => setFormData({ ...formData, cardColor: opt.key })} title={opt.label} aria-label={`Warna ${opt.label}`} className={cn('flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-110', opt.swatch, formData.cardColor === opt.key && 'ring-2 ring-slate-900 ring-offset-2')}>
                {formData.cardColor === opt.key && <Check size={14} className="text-white" />}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleCreate}
          disabled={saving || !formData.name || !formData.type}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-6 py-4 text-[15px] font-bold text-white transition-all hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400"
        >
          {saving && <Loader2 className="animate-spin" size={16} />}
          {saving ? 'Menyimpan…' : initialData ? 'Simpan perubahan' : 'Simpan rekening'}
        </button>
      </div>
    </Modal>
  );
};
