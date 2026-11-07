'use client';

import { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, RefreshCw, Wallet, CalendarDays, ChevronDown, Landmark } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { NumberInput } from '@/components/ui/NumberInput';
import { AmountCalculatorButton } from '@/components/ui/AmountCalculator';
import { CategorySelect } from './CategorySelect';
import { CurrencySelect } from './CurrencySelect';
import { transactionService, TransactionType } from '@/lib/services/transactionService';
import { updateMemberTotals } from '@/lib/services/userService';
import { accountService, Account } from '@/lib/services/accountService';
import { exchangeRateService, ExchangeRates } from '@/lib/services/exchangeRateService';
import { cn, formatCurrency, toLocalDateString } from '@/lib/utils';
import { useTags } from '@/lib/useTags';
import { TagPicker } from '@/components/tags/TagPicker';

interface AddTransactionModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const AddTransactionModal = ({ userId, isOpen, onClose }: AddTransactionModalProps) => {
  const [type, setType] = useState<TransactionType>('pemasukan');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [convertedAmount, setConvertedAmount] = useState<number>(0);
  const { tags: tagsPref } = useTags();
  const [tags, setTags] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    date: toLocalDateString(),
    note: '',
    currency: 'IDR',
    amount: '',
    category: '',
    subCategory: '',
    accountId: '',
    installmentTenor: '',
    monthlyInterest: '',
    totalInterest: '',
  });

  useEffect(() => {
    if (isOpen && userId) {
      setError('');
      accountService.getUserAccounts(userId).then(setAccounts).catch(console.error);
      exchangeRateService.getLatestRates().then(setRates).catch(console.error);
    }
  }, [isOpen, userId]);

  useEffect(() => {
    if (formData.amount && formData.currency && rates) {
      const amount = parseFloat(formData.amount);
      if (formData.currency === 'IDR') {
        setConvertedAmount(amount);
      } else {
        const idrValue = exchangeRateService.convert(amount, formData.currency, 'IDR', rates);
        setConvertedAmount(idrValue);
      }
    } else {
      setConvertedAmount(0);
    }
  }, [formData.amount, formData.currency, rates]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const amountNum = parseFloat(formData.amount);
    if (!formData.category) {
      setError('Kategori wajib dipilih.');
      return;
    }
    if (!amountNum || amountNum <= 0) {
      setError('Nominal harus lebih dari 0.');
      return;
    }

    setLoading(true);
    try {
      // Kirim amountIDR cuma kalau memang berhasil dikonversi (IDR asli, atau
      // rates sudah termuat dan punya kurs currency ini). Kalau tidak, biarkan
      // undefined supaya backend yang menghitung ulang lewat kurs sendiri —
      // jangan pernah kirim amount mentah sebagai amountIDR, nanti backend
      // menganggapnya nilai IDR final dan tidak akan dikoreksi lagi.
      const canConvert = formData.currency === 'IDR' || Boolean(rates && rates[formData.currency] && rates['IDR']);

      // Penyimpanan inti — jika ini gagal, tidak ada apa pun yang tersimpan
      // dan aman untuk user mencoba lagi.
      await transactionService.createTransaction({
        userId,
        type: type === 'pemasukan' || type === 'pengeluaran' ? type : 'pemasukan',
        amount: amountNum,
        amountIDR: canConvert ? convertedAmount : undefined,
        category: formData.category,
        subCategory: formData.subCategory,
        currency: formData.currency,
        accountId: formData.accountId || 'General',
        installmentTenor: parseInt(formData.installmentTenor) || 0,
        monthlyInterest: parseFloat(formData.monthlyInterest) || 0,
        totalInterest: parseFloat(formData.totalInterest) || 0,
        date: new Date(formData.date),
        note: formData.note,
        status: 'VERIFIED',
        tags,
      });

      // Sinkronisasi lanjutan (ringkasan & saldo akun) bersifat non-fatal —
      // transaksinya sendiri sudah tersimpan, jadi kegagalan di sini tidak
      // boleh membuat modal terlihat "gagal total" dan memicu submit ulang
      // yang bisa menghasilkan transaksi dobel.
      try {
        await updateMemberTotals(userId, type, amountNum);
        if (formData.accountId) {
          const balanceChange = type === 'pemasukan' ? amountNum : -amountNum;
          await accountService.updateAccountBalance(formData.accountId, balanceChange);
        }
      } catch (syncErr) {
        console.error('Transaksi tersimpan, tapi gagal sinkronisasi ringkasan/saldo:', syncErr);
      }

      onClose();

      setTags([]);
      setFormData({
        date: toLocalDateString(),
        note: '',
        currency: 'IDR',
        amount: '',
        category: '',
        subCategory: '',
        accountId: '',
        installmentTenor: '',
        monthlyInterest: '',
        totalInterest: '',
      });
    } catch (err) {
      console.error('Error adding transaction:', err);
      setError(err instanceof Error ? err.message : 'Gagal menyimpan transaksi. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const isIncome = type === 'pemasukan';
  const amountNum = parseFloat(formData.amount) || 0;
  const today = toLocalDateString();
  const yesterday = toLocalDateString(new Date(Date.now() - 86400000));
  const pickAccount = (id: string) => {
    const selectedAccount = accounts.find((acc) => acc.id === id);
    setFormData((prev) => ({
      ...prev,
      accountId: id,
      // Transaksi selalu dalam mata uang rekening yang dipilih — tanpa ini,
      // currency picker (independen dari rekening) bisa ketinggalan di IDR
      // meski rekeningnya USD/KHR/dll, bikin amount tersimpan seolah IDR
      // padahal harusnya dikonversi (saldo rekening tetap benar terpotong,
      // tapi laporan pengeluaran jadi salah besar).
      currency: selectedAccount?.currency || prev.currency,
    }));
  };
  const labelCls = 'mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-slate-400';
  const fieldCls =
    'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[14px] font-semibold text-slate-800 outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5';

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex max-h-[94dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[32px] bg-slate-50 shadow-2xl animate-in fade-in slide-in-from-bottom-6 duration-300 sm:rounded-[32px]">
        {/* Header berwarna sesuai jenis transaksi + nominal besar */}
        <div
          className={cn(
            'relative shrink-0 overflow-hidden px-6 pb-6 pt-5 text-white transition-colors duration-500',
            isIncome
              ? 'bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500'
              : 'bg-gradient-to-br from-orange-500 via-rose-500 to-pink-500',
          )}
        >
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-20 left-10 h-44 w-44 rounded-full bg-black/10"
            aria-hidden
          />
          <div className="relative flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[19px] font-black tracking-tight">Catat transaksi</h2>
              <p className="text-[12px] font-medium text-white/80">Tersimpan ke laporan & saldo rekeningmu</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 hover:bg-white/30"
            >
              <X size={18} />
            </button>
          </div>

          <div
            className="relative mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-black/15 p-1 backdrop-blur"
            role="tablist"
          >
            {(
              [
                { id: 'pemasukan', label: 'Pemasukan', icon: TrendingUp },
                { id: 'pengeluaran', label: 'Pengeluaran', icon: TrendingDown },
              ] as const
            ).map((t) => {
              const active = type === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setType(t.id as TransactionType)}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-xl py-2.5 text-[13.5px] font-bold transition-all',
                    active ? 'bg-white text-slate-900 shadow-md' : 'text-white/85 hover:bg-white/10',
                  )}
                >
                  <t.icon
                    size={16}
                    className={active ? (t.id === 'pemasukan' ? 'text-emerald-600' : 'text-rose-600') : ''}
                  />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="relative mt-5 flex items-end gap-2">
            <div className="shrink-0 [&_select]:rounded-xl [&_select]:border-0 [&_select]:bg-white/20 [&_select]:py-2 [&_select]:text-[13px] [&_select]:font-bold [&_select]:text-white">
              <CurrencySelect
                value={formData.currency}
                onChange={(val) => setFormData({ ...formData, currency: val })}
                compact
              />
            </div>
            <NumberInput
              placeholder="0"
              value={formData.amount}
              onChange={(val) => setFormData({ ...formData, amount: val })}
              required
              aria-label="Nominal"
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-right text-[40px] font-black leading-none tracking-tight text-white outline-none placeholder:text-white/40"
            />
            <AmountCalculatorButton
              value={formData.amount}
              onChange={(val) => setFormData((f) => ({ ...f, amount: val }))}
              className="h-11 w-11 shrink-0 rounded-xl border-0 bg-white/20 text-white hover:bg-white/30"
            />
          </div>
          {formData.currency !== 'IDR' && formData.amount ? (
            <p className="relative mt-2 flex items-center justify-end gap-1.5 text-[12.5px] font-semibold text-white/90">
              <RefreshCw size={12} /> ≈ {formatCurrency(convertedAmount, 'IDR')} · kurs terkini
            </p>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="custom-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {error && (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-3.5 text-[13px] font-semibold text-rose-600">
                {error}
              </div>
            )}

            <div>
              <span className={labelCls}>Untuk apa?</span>
              <input
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                placeholder={isIncome ? 'mis. Gaji November' : 'mis. Makan siang kantor'}
                required
                className={fieldCls}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <CategorySelect
                label="Kategori"
                value={formData.category}
                type={isIncome ? 'income' : 'expense'}
                onChange={(val) => setFormData((prev) => ({ ...prev, category: val }))}
                onSubCategoryChange={(sub) => setFormData((prev) => ({ ...prev, subCategory: sub }))}
              />
              <div>
                <span className={labelCls}>Sub kategori</span>
                <input
                  type="text"
                  placeholder="Otomatis dari kategori"
                  value={formData.subCategory}
                  onChange={(e) => setFormData((prev) => ({ ...prev, subCategory: e.target.value }))}
                  className={fieldCls}
                />
              </div>
            </div>

            <div>
              <span className={labelCls}>Tanggal</span>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { d: today, l: 'Hari ini' },
                  { d: yesterday, l: 'Kemarin' },
                ].map((o) => (
                  <button
                    key={o.l}
                    type="button"
                    onClick={() => setFormData({ ...formData, date: o.d })}
                    className={cn(
                      'rounded-full px-3.5 py-2 text-[13px] font-bold transition-colors',
                      formData.date === o.d
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100',
                    )}
                  >
                    {o.l}
                  </button>
                ))}
                <label
                  className={cn(
                    'relative flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold ring-1',
                    formData.date !== today && formData.date !== yesterday
                      ? 'bg-slate-900 text-white ring-slate-900'
                      : 'bg-white text-slate-600 ring-slate-200',
                  )}
                >
                  <CalendarDays size={14} />
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                    aria-label="Pilih tanggal"
                    className="w-[118px] bg-transparent text-[13px] font-bold outline-none [color-scheme:light]"
                  />
                </label>
              </div>
            </div>

            <div>
              <span className={labelCls}>Rekening</span>
              <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1">
                {[{ id: '', name: 'Tanpa rekening', currency: '' }, ...accounts].map((acc) => {
                  const active = formData.accountId === acc.id;
                  return (
                    <button
                      key={acc.id || 'none'}
                      type="button"
                      onClick={() => pickAccount(acc.id ?? '')}
                      className={cn(
                        'flex min-w-[132px] shrink-0 items-center gap-2.5 rounded-2xl p-3 text-left transition-all',
                        active
                          ? isIncome
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25'
                            : 'bg-rose-600 text-white shadow-lg shadow-rose-600/25'
                          : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
                          active ? 'bg-white/20' : 'bg-slate-100 text-slate-500',
                        )}
                      >
                        {acc.id ? <Landmark size={15} /> : <Wallet size={15} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block max-w-[120px] truncate text-[13px] font-bold">{acc.name}</span>
                        {acc.currency ? (
                          <span
                            className={cn(
                              'block text-[11px] font-semibold',
                              active ? 'text-white/80' : 'text-slate-400',
                            )}
                          >
                            {acc.currency}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {tagsPref.enabled && (
              <div>
                <span className={labelCls}>
                  Tag <span className="font-medium normal-case tracking-normal">(opsional)</span>
                </span>
                <TagPicker value={tags} onChange={setTags} />
              </div>
            )}

            <details className="group rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <summary className="flex cursor-pointer list-none items-center justify-between text-[13px] font-bold text-slate-600">
                Detail cicilan (opsional)
                <ChevronDown size={16} className="transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <Input
                  label="Tenor (bln)"
                  placeholder="0"
                  type="number"
                  value={formData.installmentTenor}
                  onChange={(e) => setFormData({ ...formData, installmentTenor: e.target.value })}
                />
                <Input
                  label="Bunga / bln"
                  placeholder="0"
                  type="number"
                  value={formData.monthlyInterest}
                  onChange={(e) => setFormData({ ...formData, monthlyInterest: e.target.value })}
                />
                <Input
                  label="Total bunga"
                  placeholder="0"
                  type="number"
                  value={formData.totalInterest}
                  onChange={(e) => setFormData({ ...formData, totalInterest: e.target.value })}
                />
              </div>
            </details>
          </div>

          <div className="flex shrink-0 gap-3 border-t border-slate-200/70 bg-white px-6 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4">
            <Button variant="secondary" className="h-13 rounded-2xl px-5 font-bold" type="button" onClick={onClose}>
              Batal
            </Button>
            <Button
              className={cn(
                'h-13 flex-1 rounded-2xl font-bold text-white shadow-xl',
                isIncome
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-emerald-500/25 hover:brightness-110'
                  : 'bg-gradient-to-r from-orange-500 to-rose-500 shadow-rose-500/25 hover:brightness-110',
              )}
              isLoading={loading}
            >
              {amountNum > 0 ? `Simpan ${formatCurrency(amountNum, formData.currency)}` : 'Simpan transaksi'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
