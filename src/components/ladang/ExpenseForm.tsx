"use client";

import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { accountService } from '@/lib/services/accountService';
import { SHOP_EXPENSE_KINDS, type Shop, type ShopExpenseInput } from '@/lib/services/shopService';
import { cn, formatIDR, toLocalDateString } from '@/lib/utils';
import { fieldCls, labelCls } from './UsahaView';

// Catat pengeluaran usaha (beli botol, dus, bahan…) dari kasir. Masuk sebagai
// pengeluaran "Biaya Usaha" yang ditautkan ke usaha ini — omzet tidak berkurang,
// tapi Usahaku menampilkan biaya & laba bersih. Akun tim: rekening & tanggal dikunci.

const QUICK: { label: string; kind: (typeof SHOP_EXPENSE_KINDS)[number] }[] = [
  { label: 'Botol', kind: 'Kemasan' },
  { label: 'Dus', kind: 'Kemasan' },
  { label: 'Plastik', kind: 'Kemasan' },
  { label: 'Bahan baku', kind: 'Bahan & Stok' },
  { label: 'Stok barang', kind: 'Bahan & Stok' },
  { label: 'Ongkir', kind: 'Operasional' },
  { label: 'Listrik/pulsa', kind: 'Operasional' },
];
const ACC_KEY = 'leosiqra-usaha-biaya-acc';

export function ExpenseForm({ shop, onSave, locked, onDone, onCancel }: {
  shop: Shop;
  onSave: (input: ShopExpenseInput & { accountId?: string; date?: string }) => Promise<void>;
  /** Akun tim: rekening dikunci pemilik, tanggal hari ini. */
  locked?: { accountName: string | null };
  onDone: (m: string) => void;
  onCancel?: () => void;
}) {
  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<string>('Kemasan');
  const [accounts, setAccounts] = useState<{ id: string; name: string }[] | null>(null);
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(toLocalDateString());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (locked) return;
    accountService.getUserAccounts('').then((list) => {
      const ok = list.filter((a) => a.id && (a.currency || 'IDR') === 'IDR').map((a) => ({ id: String(a.id), name: a.name }));
      setAccounts(ok);
      let saved = '';
      try { saved = localStorage.getItem(`${ACC_KEY}:${shop.id}`) ?? ''; } catch { /* abaikan */ }
      setAccountId(ok.some((a) => a.id === saved) ? saved : ok[0]?.id ?? '');
    }).catch(() => setAccounts([]));
  }, [shop.id, locked]);

  const value = Number(amount || '0');
  const save = async () => {
    if (!item.trim()) { setError('Tulis beli apa, mis. botol 50 pcs.'); return; }
    if (value < 1) { setError('Isi nominalnya.'); return; }
    if (locked && !locked.accountName) { setError('Pemilik usaha belum menentukan rekening untuk akunmu.'); return; }
    if (!locked && !accountId) { setError('Pilih rekening yang dipakai bayar.'); return; }
    setBusy(true);
    setError('');
    try {
      await onSave({ requestId, amount: value, item: item.trim(), kind, ...(locked ? {} : { accountId, date }) });
      if (!locked) { try { localStorage.setItem(`${ACC_KEY}:${shop.id}`, accountId); } catch { /* abaikan */ } }
      onDone(`Pengeluaran ${formatIDR(value)} (${item.trim()}) tercatat.`);
      setItem(''); setAmount(''); setRequestId(crypto.randomUUID());
    } catch (e) { setError(e instanceof Error && e.message ? e.message : 'Gagal mencatat.'); }
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</p>}
      <div>
        <span className={labelCls}>Beli apa</span>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {QUICK.map((q) => (
            <button key={q.label} type="button" onClick={() => { setItem(q.label); setKind(q.kind); }} className={cn('rounded-full px-3 py-1.5 text-[12px] font-bold', item === q.label ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300')}>{q.label}</button>
          ))}
        </div>
        <input value={item} onChange={(e) => setItem(e.target.value)} maxLength={80} placeholder="mis. Botol 250ml 50 pcs" className={fieldCls} />
      </div>
      <label className="block"><span className={labelCls}>Nominal</span>
        <span className="relative block"><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[14px] font-bold text-slate-400">Rp</span>
          <input inputMode="numeric" value={amount ? Number(amount).toLocaleString('id-ID') : ''} onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="0" className={cn(fieldCls, 'pl-11 text-[18px] font-extrabold tabular-nums')} />
        </span>
      </label>
      <div><span className={labelCls}>Jenis</span>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {SHOP_EXPENSE_KINDS.map((k) => <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k} className={cn('rounded-xl px-2 py-2 text-[12px] font-bold', kind === k ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}>{k}</button>)}
        </div>
      </div>
      {locked ? (
        <p className="rounded-2xl bg-slate-50 px-4 py-3 text-[13px] text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">Dibayar dari <b>{locked.accountName ?? '—'}</b> · hari ini</p>
      ) : (
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <label className="block min-w-0"><span className={labelCls}>Dibayar dari</span>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} disabled={!accounts?.length} className={fieldCls}>
              {accounts === null ? <option>Memuat…</option> : accounts.length ? accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>) : <option value="">Belum ada rekening Rupiah</option>}
            </select>
          </label>
          <label className="block"><span className={labelCls}>Tanggal</span><input type="date" value={date} max={toLocalDateString()} onChange={(e) => setDate(e.target.value)} className={cn(fieldCls, 'w-[150px]')} /></label>
        </div>
      )}
      <div className="flex gap-2">
        {onCancel && <button type="button" onClick={onCancel} className="rounded-full bg-slate-100 px-5 py-3 text-[14px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">Batal</button>}
        <button type="button" onClick={save} disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-rose-600 py-3 text-[14px] font-bold text-white hover:bg-rose-700 disabled:opacity-50">{busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Catat pengeluaran</button>
      </div>
      <p className="text-center text-[11px] text-slate-400">Masuk sebagai pengeluaran Biaya Usaha › {kind} — omzet tidak berkurang, laba bersih dihitung otomatis.</p>
    </div>
  );
}
