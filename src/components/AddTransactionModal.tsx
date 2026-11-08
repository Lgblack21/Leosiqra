'use client';

import { useState, useEffect } from 'react';
import { currentPosition, placeService } from '@/lib/places';
import Link from 'next/link';
import { X, TrendingUp, TrendingDown, RefreshCw, CalendarDays, ChevronDown } from 'lucide-react';
import { AccountSelect } from './AccountSelect';
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
  // Lokasi opsional (pengeluaran): GPS diambil sekali saat tombol ditekan, bukan pelacakan.
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locMsg, setLocMsg] = useState('');

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
      accountService
        .getUserAccounts(userId)
        .then((list) => {
          setAccounts(list);
          // Rekening wajib: pilih otomatis rekening pertama (bukan kartu kredit) kalau belum ada
          // yang terpilih. Mata uang ikut rekening — lihat catatan di pickAccount.
          setFormData((prev) => {
            if (prev.accountId && list.some((a) => a.id === prev.accountId)) return prev;
            const first = list.find((a) => !a.creditLimit) ?? list[0];
            return first ? { ...prev, accountId: first.id ?? '', currency: first.currency || prev.currency } : prev;
          });
        })
        .catch(console.error);
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
    if (!formData.accountId) {
      setError('Pilih rekening dulu.');
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
      const newId = await transactionService.createTransaction({
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

      // Lokasi (Peta Belanja) non-fatal: transaksi sudah tersimpan walau lokasi gagal.
      if (loc && newId && type === 'pengeluaran') {
        await placeService
          .set(newId, { ...loc, name: formData.note || null, source: 'gps' })
          .catch((locErr) => console.error('Transaksi tersimpan, lokasi gagal disimpan:', locErr));
      }

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
      setLoc(null);
      setLocMsg('');
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
  const labelCls = 'mb-1.5 block text-[12px] font-semibold text-slate-500';
  const fieldCls =
    'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13.5px] font-semibold text-slate-800 outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5';
  const chipCls = (active: boolean) =>
    cn(
      'rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
      active ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
    );

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative flex max-h-[92dvh] w-full max-w-[440px] flex-col overflow-hidden rounded-t-[24px] bg-white shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200 sm:rounded-[24px]">
        <div className="shrink-0 px-5 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-extrabold tracking-tight text-slate-900">Catat transaksi</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={17} />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="tablist">
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
                    'flex h-8 items-center justify-center gap-1.5 rounded-lg text-[13px] font-bold transition-all',
                    active
                      ? cn('bg-white shadow-sm', t.id === 'pemasukan' ? 'text-emerald-600' : 'text-rose-600')
                      : 'text-slate-500 hover:text-slate-700',
                  )}
                >
                  <t.icon size={15} />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div
            className={cn(
              'mt-3 flex items-center gap-2 rounded-2xl px-3 py-2.5 ring-1 transition-colors',
              isIncome ? 'bg-emerald-50/70 ring-emerald-100' : 'bg-rose-50/70 ring-rose-100',
            )}
          >
            <div className="shrink-0 [&_select]:rounded-lg [&_select]:border-slate-200 [&_select]:bg-white [&_select]:py-1.5 [&_select]:pl-2.5 [&_select]:pr-7 [&_select]:text-[12.5px] [&_select]:font-bold">
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
              className={cn(
                'min-w-0 flex-1 border-0 bg-transparent p-0 text-right text-[26px] font-extrabold leading-tight tracking-tight outline-none placeholder:text-slate-300',
                isIncome ? 'text-emerald-700' : 'text-rose-700',
              )}
            />
            <AmountCalculatorButton
              value={formData.amount}
              onChange={(val) => setFormData((f) => ({ ...f, amount: val }))}
              className="h-9 w-9 shrink-0 rounded-lg border-slate-200 bg-white text-slate-500 hover:text-slate-800"
            />
          </div>
          {formData.currency !== 'IDR' && formData.amount ? (
            <p className="mt-1.5 flex items-center justify-end gap-1.5 text-[12px] font-medium text-slate-500">
              <RefreshCw size={11} /> ≈ {formatCurrency(convertedAmount, 'IDR')} · kurs terkini
            </p>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="custom-scrollbar min-h-0 flex-1 space-y-3.5 overflow-y-auto px-5 pb-4 pt-3.5">
            {error && (
              <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-[12.5px] font-semibold text-rose-600">
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
              {!isIncome ? (
                <div className="mt-1.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (loc) {
                        setLoc(null);
                        setLocMsg('');
                        return;
                      }
                      setLocMsg('Mencari lokasimu…');
                      try {
                        setLoc(await currentPosition());
                        setLocMsg('');
                      } catch (gpsErr) {
                        setLocMsg(gpsErr instanceof Error ? gpsErr.message : 'Lokasi belum bisa didapat.');
                      }
                    }}
                    className={chipCls(Boolean(loc))}
                  >
                    {loc ? '📍 Lokasi ditandai · hapus' : '📍 Tandai lokasi di sini'}
                  </button>
                  {locMsg ? <span className="text-[11.5px] text-slate-500">{locMsg}</span> : null}
                </div>
              ) : null}
            </div>

            <CategorySelect
              label="Kategori"
              size="sm"
              showBadge={false}
              value={formData.category}
              subValue={formData.subCategory}
              type={isIncome ? 'income' : 'expense'}
              onChange={(val) => setFormData((prev) => ({ ...prev, category: val }))}
              onSubCategoryChange={(sub) => setFormData((prev) => ({ ...prev, subCategory: sub }))}
            />

            <div>
              <span className={labelCls}>Tanggal</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { d: today, l: 'Hari ini' },
                  { d: yesterday, l: 'Kemarin' },
                ].map((o) => (
                  <button
                    key={o.l}
                    type="button"
                    onClick={() => setFormData({ ...formData, date: o.d })}
                    className={chipCls(formData.date === o.d)}
                  >
                    {o.l}
                  </button>
                ))}
                <label
                  className={cn(
                    chipCls(formData.date !== today && formData.date !== yesterday),
                    'flex items-center gap-1.5',
                  )}
                >
                  <CalendarDays size={13} />
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                    aria-label="Pilih tanggal"
                    className="w-[112px] bg-transparent text-[12.5px] font-semibold outline-none [color-scheme:light]"
                  />
                </label>
              </div>
            </div>

            <div>
              <span className={labelCls}>Rekening</span>
              {accounts.length ? (
                <AccountSelect accounts={accounts} value={formData.accountId} onChange={pickAccount} />
              ) : (
                <p className="rounded-xl border border-dashed border-slate-200 px-3.5 py-3 text-[12.5px] text-slate-500">
                  Belum ada rekening.{' '}
                  <Link
                    href="/membership/rekening"
                    onClick={onClose}
                    className="font-semibold text-slate-900 underline"
                  >
                    Tambah rekening
                  </Link>{' '}
                  dulu supaya saldonya ikut tercatat.
                </p>
              )}
            </div>

            {tagsPref.enabled && (
              <div>
                <span className={labelCls}>
                  Tag <span className="font-normal text-slate-400">(opsional)</span>
                </span>
                <TagPicker value={tags} onChange={setTags} />
              </div>
            )}

            <details className="group rounded-xl px-3.5 py-2.5 ring-1 ring-slate-200">
              <summary className="flex cursor-pointer list-none items-center justify-between text-[12.5px] font-semibold text-slate-500">
                Detail cicilan (opsional)
                <ChevronDown size={15} className="transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-2.5 grid grid-cols-3 gap-2">
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

          <div className="flex shrink-0 gap-2 border-t border-slate-100 px-5 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">
            <Button
              variant="secondary"
              className="h-11 rounded-xl px-4 text-[13.5px] font-semibold"
              type="button"
              onClick={onClose}
            >
              Batal
            </Button>
            <Button
              className={cn(
                'h-11 flex-1 rounded-xl text-[13.5px] font-bold text-white',
                isIncome ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700',
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
