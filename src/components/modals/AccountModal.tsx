"use client";

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { ChevronDown, Image as ImageIcon, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { accountService, Account } from '@/lib/services/accountService';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { CurrencySelect } from '@/components/CurrencySelect';
import { NumberInput } from '@/components/ui/NumberInput';
import { CARD_COLOR_OPTIONS } from '@/lib/cardColors';
import { matchIndonesianInstitutionLogo } from '@/lib/indonesianBanks';
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
}

const BUILT_IN_TYPES = ['Bank Account', 'E-Wallet', 'Cash', 'Investment Account', 'Credit Card'];
const CUSTOM_TYPE_VALUE = '__custom__';

export const AccountModal = ({ isOpen, onClose, userId, initialType = 'Bank Account', title = 'Tambah Rekening Baru', initialData = null, existingTypes = [] }: AccountModalProps) => {
  const [formData, setFormData] = useState({
    name: '',
    logoUrl: '',
    type: initialType,
    currency: 'IDR',
    balance: '',
    initialBalance: '',
    baseValue: '',
    creditLimit: '',
    cardColor: ''
  });
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
    existingTypes.forEach((t) => t && set.add(t));
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
      alert("Gagal mengunggah logo.");
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
        balance: String(initialData.balance ?? ''),
        initialBalance: String(initialData.initialBalance ?? ''),
        baseValue: String(initialData.baseValue ?? ''),
        creditLimit: initialData.creditLimit ? String(initialData.creditLimit) : '',
        cardColor: initialData.cardColor || ''
      });
    } else {
      setFormData(prev => ({
        ...prev,
        type: initialType
      }));
    }
  }, [isOpen, initialType, initialData]);

  const handleCreate = async () => {
    if (!userId || !formData.name) return;
    setError('');
    setSaving(true);
    try {
      if (initialData?.id) {
        await accountService.updateAccount(initialData.id, {
          name: formData.name,
          logoUrl: formData.logoUrl,
          type: formData.type,
          currency: formData.currency,
          balance: parseFloat(formData.balance) || 0,
          initialBalance: parseFloat(formData.balance) || 0,
          baseValue: parseFloat(formData.baseValue) || 0,
          creditLimit: parseFloat(formData.creditLimit) || 0,
          cardColor: formData.cardColor
        });
      } else {
        await accountService.createAccount({
          userId: userId,
          name: formData.name,
          logoUrl: formData.logoUrl,
          type: formData.type,
          currency: formData.currency,
          balance: parseFloat(formData.balance) || 0,
          initialBalance: parseFloat(formData.balance) || 0,
          baseValue: parseFloat(formData.baseValue) || 0,
          creditLimit: parseFloat(formData.creditLimit) || 0,
          cardColor: formData.cardColor
        });
      }
      onClose();
      setFormData({ name: '', logoUrl: '', type: initialType, currency: 'IDR', balance: '', initialBalance: '', baseValue: '', creditLimit: '', cardColor: '' });
      setIsCustomTypeMode(false);
    } catch (err) {
      console.error("Error saving account:", err);
      setError(err instanceof Error ? err.message : 'Gagal menyimpan rekening. Silakan coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit Rekening' : title}
      maxWidth="max-w-xl"
    >
      <div className="space-y-6">
        {error && (
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 text-sm font-medium text-rose-600">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nama Rekening</label>
            <input
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
              placeholder="Contoh: BCA Personal"
              className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 transition-all"
            />
            {!initialData && (
              <p className="text-[10px] font-medium text-slate-400 pl-1">Logo bank/e-wallet Indonesia terisi otomatis. Bank luar negeri tetap perlu upload logo manual.</p>
            )}
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Logo Rekening</label>
            <div className="flex items-center gap-4">
              <div className="relative w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 shrink-0">
                {formData.logoUrl ? (
                  <Image src={formData.logoUrl} alt="Logo Preview" fill className="object-contain" />
                ) : (
                  <ImageIcon className="text-slate-300" size={20} />
                )}
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleLogoUpload} 
              />
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl py-3 px-4 text-xs font-bold text-slate-600 transition-all flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    Mengunggah...
                  </>
                ) : (
                  <>
                    <ImageIcon size={14} />
                    {formData.logoUrl ? 'Ganti Logo' : 'Upload Logo'}
                  </>
                )}
              </button>
            </div>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Jenis Rekening</label>
            {isCustomTypeMode ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  placeholder="mis. Reksadana, Emas Digital, Dompet Digital"
                  className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 transition-all"
                />
                <button
                  type="button"
                  onClick={() => { setIsCustomTypeMode(false); setFormData({ ...formData, type: initialData?.type || initialType }); }}
                  className="shrink-0 px-3 py-3 rounded-xl bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all text-[10px] font-black uppercase tracking-widest"
                >
                  Batal
                </button>
              </div>
            ) : (
              <div className="relative">
                <select
                  value={formData.type}
                  onChange={(e) => {
                    if (e.target.value === CUSTOM_TYPE_VALUE) {
                      setIsCustomTypeMode(true);
                      setFormData({ ...formData, type: '' });
                      return;
                    }
                    const newType = e.target.value as Account['type'];
                    const matched = !initialData ? matchIndonesianInstitutionLogo(formData.name, newType) : null;
                    if (matched && (logoIsAuto || !formData.logoUrl)) {
                      setFormData({ ...formData, type: newType, logoUrl: matched });
                      setLogoIsAuto(true);
                    } else {
                      setFormData({ ...formData, type: newType });
                    }
                  }}
                  className="w-full appearance-none bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 transition-all cursor-pointer"
                >
                  {typeOptions.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                  <option value={CUSTOM_TYPE_VALUE}>+ Tambah Jenis Baru...</option>
                </select>
                <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              </div>
            )}
          </div>

          <CurrencySelect 
            label="Mata Uang"
            value={formData.currency}
            onChange={(val) => setFormData({...formData, currency: val})}
          />

          {formData.type === 'Credit Card' && (
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 text-indigo-500">Limit Kredit</label>
              <NumberInput
                value={formData.creditLimit}
                onChange={(val) => setFormData({...formData, creditLimit: val})}
                placeholder="0"
                className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-indigo-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 transition-all"
              />
              <p className="text-[10px] font-medium text-slate-400 pl-1">Plafon maksimal dari aplikasi (Akulaku, ShopeePayLater, Paylater BCA, KK, dll).</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
              {formData.type === 'Credit Card' ? 'Tagihan Terpakai Saat Ini' : 'Saldo Saat Ini'}
            </label>
            <NumberInput
              value={formData.balance}
              onChange={(val) => setFormData({...formData, balance: val})}
              placeholder="0"
              className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 transition-all"
            />
            <p className="text-[10px] font-medium text-slate-400 pl-1 leading-relaxed">
              {formData.type === 'Credit Card'
                ? 'Tagihan yang SUDAH terpakai sekarang (isi 0 kalau belum ada). Tiap pengeluaran dari kartu ini otomatis menambah terpakai & mengurangi sisa limit.'
                : 'Isi saldo rekening kamu sekarang (sesuai bank/dompet). Transaksi yang kamu catat berikutnya akan otomatis menambah/mengurangi saldo ini.'}
            </p>
          </div>
          {/* Field "Saldo Awal (Initial)" & "Nilai Base" digabung/dihapus: satu
              nilai "Saldo Saat Ini" mengisi balance sekaligus initialBalance (base
              yang dipakai kartu), dan nilai IDR akun mata uang asing dihitung
              otomatis via kurs live. */}
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Warna Kartu</label>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, cardColor: '' })}
              title="Default sesuai jenis rekening"
              className={cn(
                "w-9 h-9 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:border-slate-400 transition-all",
                !formData.cardColor && "ring-2 ring-offset-2 ring-slate-400"
              )}
            >
              <span className="text-[9px] font-black">A</span>
            </button>
            {CARD_COLOR_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setFormData({ ...formData, cardColor: opt.key })}
                title={opt.label}
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110",
                  opt.swatch,
                  formData.cardColor === opt.key && "ring-2 ring-offset-2 ring-slate-900"
                )}
              >
                {formData.cardColor === opt.key && <Check size={14} className="text-white" />}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={saving || !formData.name || !formData.type}
          className="w-full bg-blue-600 disabled:bg-slate-300 text-white px-6 py-4 rounded-xl text-xs font-black shadow-lg shadow-blue-100 disabled:shadow-none transition-all mt-6"
        >
          {saving
            ? 'Menyimpan...'
            : initialData
              ? 'Simpan Perubahan'
              : title === 'Tambah Kartu Baru' ? 'Simpan Kartu Baru' : 'Simpan Rekening Baru'}
        </button>
      </div>
    </Modal>
  );
};
