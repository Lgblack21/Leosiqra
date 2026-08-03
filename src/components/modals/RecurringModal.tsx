"use client";

import { useState, useEffect } from 'react';
import { ChevronDown, Save } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { NumberInput } from '@/components/ui/NumberInput';
import { recurringService, RecurringTransaction } from '@/lib/services/recurringService';
import { accountService, Account } from '@/lib/services/accountService';
import { CategorySelect } from '@/components/CategorySelect';
import { getCurrencySymbol, toLocalDateString } from '@/lib/utils';
import { SAVING_GOALS } from '@/lib/savingsGoals';

interface RecurringModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  initialData?: RecurringTransaction | null;
  initialType?: RecurringTransaction['type'];
}

export const RecurringModal = ({ userId, isOpen, onClose, initialData = null, initialType = 'Pengeluaran' }: RecurringModalProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  
  const getToday = () => toLocalDateString();

  const [formData, setFormData] = useState({
    name: '',
    type: 'Pengeluaran' as RecurringTransaction['type'],
    category: '',
    accountId: '',
    amount: '',
    interval: 'Bulanan' as RecurringTransaction['interval'],
    nextDate: getToday(),
    note: '',
    targetAmount: ''
  });

  const isTabungan = formData.type === 'Tabungan';

  const selectedAccount = accounts.find(acc => acc.id === formData.accountId);
  const currencySymbol = getCurrencySymbol(selectedAccount?.currency || 'IDR');

  useEffect(() => {
    if (isOpen && userId) {
      setError('');
      accountService.getUserAccounts(userId).then(setAccounts).catch(console.error);
      if (initialData) {
        setFormData({
          name: initialData.name || '',
          type: initialData.type || 'Pengeluaran',
          category: initialData.category || '',
          accountId: initialData.accountId || '',
          amount: String(initialData.amount || ''),
          interval: initialData.interval || 'Bulanan',
          nextDate: toLocalDateString(new Date(initialData.nextDate)),
          note: initialData.note || '',
          targetAmount: initialData.targetAmount ? String(initialData.targetAmount) : ''
        });
      } else {
        setFormData({
          name: '',
          type: initialType,
          category: '',
          accountId: '',
          amount: '',
          interval: 'Bulanan',
          nextDate: getToday(),
          note: '',
          targetAmount: ''
        });
      }
    }
  }, [isOpen, userId, initialData, initialType]);

  const handleCreate = async () => {
    if (!userId || !formData.name || !formData.amount || !formData.nextDate) return;
    setError('');
    setLoading(true);

    try {
      const targetAmount = isTabungan && formData.targetAmount ? parseFloat(formData.targetAmount) : undefined;

      if (initialData?.id) {
        await recurringService.updateRecurring(initialData.id, {
          name: formData.name,
          type: formData.type,
          category: formData.category,
          accountId: formData.accountId || 'General',
          amount: parseFloat(formData.amount),
          interval: formData.interval,
          nextDate: new Date(formData.nextDate),
          note: formData.note,
          targetAmount,
        });
      } else {
        await recurringService.createRecurring({
          userId,
          name: formData.name,
          type: formData.type,
          category: formData.category,
          accountId: formData.accountId || 'General',
          amount: parseFloat(formData.amount),
          interval: formData.interval,
          nextDate: new Date(formData.nextDate),
          note: formData.note,
          status: 'ACTIVE',
          targetAmount,
        });
      }
      onClose();
      setFormData({
        name: '', type: 'Pengeluaran', category: '', accountId: '', amount: '', interval: 'Bulanan', nextDate: getToday(), note: '', targetAmount: ''
      });
    } catch (error) {
      console.error("Error creating recurring:", error);
      setError(error instanceof Error ? error.message : 'Gagal menyimpan transaksi berulang. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={initialData ? 'Edit Transaksi Berulang' : 'Set Ringkasan Transaksi Berulang'}
      maxWidth="max-w-xl"
    >
      <div className="space-y-5 px-1">
        {error && (
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 text-sm font-medium text-rose-600">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nama Transaksi</label>
          <input 
            type="text" 
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
            placeholder="Contoh: Langganan Netflix"
            className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 px-5 text-sm font-bold text-slate-700 transition-all"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Jenis</label>
            <div className="relative">
              <select
                value={formData.type}
                onChange={e => setFormData({...formData, type: e.target.value as RecurringTransaction['type'], category: ''})}
                className="w-full appearance-none bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 px-5 text-sm font-bold text-slate-700 transition-all cursor-pointer"
              >
                <option value="Pengeluaran">Pengeluaran</option>
                <option value="Pemasukan">Pemasukan</option>
                <option value="Tabungan">Tabungan (Goal Otomatis)</option>
              </select>
              <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Interval</label>
            <div className="relative">
              <select 
                value={formData.interval}
                onChange={e => setFormData({...formData, interval: e.target.value as RecurringTransaction['interval']})}
                className="w-full appearance-none bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 px-5 text-sm font-bold text-slate-700 transition-all cursor-pointer"
              >
                <option value="Harian">Harian</option>
                <option value="Mingguan">Mingguan</option>
                <option value="Bulanan">Bulanan</option>
                <option value="Tahunan">Tahunan</option>
              </select>
              <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nominal</label>
            <div className="relative">
              <span className="absolute left-5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">{currencySymbol}</span>
              <NumberInput
                value={formData.amount}
                onChange={val => setFormData({...formData, amount: val})}
                placeholder="0"
                className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 pl-12 pr-5 text-sm font-bold text-slate-700 transition-all"
              />
            </div>
          </div>
          {isTabungan ? (
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Goal Tabungan</label>
              <div className="relative">
                <select
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                  className="w-full appearance-none bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 px-5 text-sm font-bold text-slate-700 transition-all cursor-pointer"
                >
                  <option value="">Pilih Goal</option>
                  {SAVING_GOALS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              </div>
            </div>
          ) : (
            <CategorySelect
              label="Kategori"
              value={formData.category}
              type={formData.type === 'Pemasukan' ? 'income' : 'expense'}
              onChange={val => setFormData({...formData, category: val})}
              showBadge={true}
            />
          )}
        </div>

        {isTabungan && (
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Target Total (Opsional)</label>
            <div className="relative">
              <span className="absolute left-5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">{currencySymbol}</span>
              <NumberInput
                value={formData.targetAmount}
                onChange={val => setFormData({...formData, targetAmount: val})}
                placeholder="Contoh: 10000000"
                className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 pl-12 pr-5 text-sm font-bold text-slate-700 transition-all"
              />
            </div>
            <p className="text-[10px] font-medium text-slate-400 pl-1">Isi kalau mau lihat progress bar menuju target. Kosongkan kalau cuma mau setoran rutin tanpa target.</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Akun / Rekening</label>
            <div className="relative">
              <select 
                value={formData.accountId}
                onChange={e => setFormData({...formData, accountId: e.target.value})}
                className="w-full appearance-none bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 px-5 text-sm font-bold text-slate-700 transition-all cursor-pointer"
              >
                <option value="">Pilih Rekening</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency})</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Mulai Tanggal</label>
            <input 
              type="date" 
              value={formData.nextDate}
              onChange={e => setFormData({...formData, nextDate: e.target.value})}
              className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 px-5 text-sm font-bold text-slate-700 transition-all cursor-pointer select-none"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Catatan</label>
          <textarea 
            rows={2}
            value={formData.note}
            onChange={e => setFormData({...formData, note: e.target.value})}
            placeholder="Tambahkan detail tambahan..."
            className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-blue-100 rounded-xl py-3.5 px-5 text-sm font-bold text-slate-700 transition-all resize-none"
          />
        </div>

        <button 
          onClick={handleCreate}
          disabled={loading || !formData.name || !formData.amount || !formData.nextDate}
          className="w-full bg-indigo-600 disabled:bg-slate-300 text-white flex items-center justify-center gap-3 py-4 rounded-2xl text-sm font-black transition-all mt-6 shadow-xl shadow-indigo-100 group"
        >
          {loading ? 'Menyimpan...' : (
            <>
              <Save size={18} className="transition-transform group-hover:scale-110" />
              {initialData ? 'Simpan Perubahan' : 'Simpan Recurring'}
            </>
          )}
        </button>
      </div>
    </Modal>
  );
};
