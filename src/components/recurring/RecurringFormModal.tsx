"use client";

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, X, CalendarDays, Info } from 'lucide-react';
import { cn, formatCurrency, getCurrencySymbol, toLocalDateString } from '@/lib/utils';
import { NumberInput } from '@/components/ui/NumberInput';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { notifyCollectionChanged } from '@/lib/cf-firestore';
import { accountService, type Account } from '@/lib/services/accountService';
import type { RecurringTransaction } from '@/lib/services/recurringService';
import { categoryVisual, useCategoryKinds, useCategoryStyles } from '@/lib/categoryEmoji';
import { RECURRING_INTERVALS, INTERVAL_LABEL, PER_MONTH, advanceDate, type RecurringInterval } from '@/lib/recurringIntervals';
import { useFeedback } from '@/components/ui/Feedback';

// Form Transaksi rutin (Pemasukan/Pengeluaran) — dicatat otomatis oleh cron
// Worker tiap jatuh tempo, saldo rekening ikut berubah. Tabungan otomatis
// diatur dari Target, bukan di sini.

type Kind = 'Pengeluaran' | 'Pemasukan';
const SHORT: Record<RecurringInterval, string> = {
  Harian: 'Harian', Mingguan: 'Mingguan', 'Dua Mingguan': '2 minggu', Bulanan: 'Bulanan', 'Dua Bulanan': '2 bulan', 'Tiga Bulanan': '3 bulan', Tahunan: 'Tahunan',
};
const fmtDay = (d: Date) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);

type Props = { open: boolean; onClose: () => void; item?: RecurringTransaction | null; onSaved?: () => void };

export function RecurringFormModal(props: Props) {
  return <AnimatePresence>{props.open && <RecurringForm key={props.item?.id ?? 'baru'} {...props} />}</AnimatePresence>;
}

function RecurringForm({ onClose, item, onSaved }: Props) {
  const { toast } = useFeedback();
  useCategoryStyles();
  const kinds = useCategoryKinds();
  const editing = Boolean(item?.id);
  const originalDate = item ? toLocalDateString(new Date(item.nextDate)) : '';

  const [type, setType] = useState<Kind>(item?.type === 'Pemasukan' ? 'Pemasukan' : 'Pengeluaran');
  const [amount, setAmount] = useState(item?.amount ? String(item.amount) : '');
  const [name, setName] = useState(item?.name ?? '');
  const [category, setCategory] = useState(item?.category ?? '');
  const [accountId, setAccountId] = useState(item?.accountId ?? '');
  const [start, setStart] = useState(originalDate || toLocalDateString());
  const [interval, setIntervalValue] = useState<RecurringInterval>((item?.interval as RecurringInterval) ?? 'Bulanan');
  const [note, setNote] = useState(item?.note ?? '');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    accountService.getUserAccounts('session').then((list) => {
      setAccounts(list);
      setAccountId((v) => v || list[0]?.id || '');
    }).catch(() => setAccounts([]));
    // Langsung ke API (sudah di-scope ke sesi) — tidak bergantung auth.currentUser.
    cloudflareApi<{ items?: { category?: string }[] }>('/api/member/categories').then((r) => {
      setCategories([...new Set((r.items ?? []).map((c) => String(c.category ?? '')).filter(Boolean))]);
    }).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const wantKind = type === 'Pemasukan' ? 'pemasukan' : 'pengeluaran';
  const shownCategories = categories.filter((c) => c === category || !kinds[c] || kinds[c] === wantKind);
  const account = accounts.find((a) => a.id === accountId);
  const currency = account?.currency || 'IDR';
  const value = Number(amount) || 0;
  const today = toLocalDateString();
  const pastDate = start < today && start !== originalDate;

  const upcoming = useMemo(() => {
    if (!start) return [];
    const out: Date[] = [];
    let d = new Date(`${start}T00:00:00`);
    for (let i = 0; i < 3; i++) {
      out.push(d);
      d = advanceDate(d, interval);
    }
    return out;
  }, [start, interval]);

  const problem = !value
    ? 'Isi nominal'
    : !name.trim()
      ? 'Isi nama transaksi'
      : !category
        ? 'Pilih kategori'
        : !account
          ? 'Pilih rekening'
          : pastDate
            ? 'Tanggal mulai sudah lewat'
            : '';

  const submit = async () => {
    if (problem || saving) return;
    setSaving(true);
    setError('');
    const body = {
      name: name.trim(),
      type,
      category,
      account_id: accountId,
      amount: value,
      interval,
      note: note.trim() || null,
      ...(start !== originalDate ? { next_date: start } : {}),
    };
    try {
      if (item?.id) {
        await cloudflareApi(`/api/member/recurring/${item.id}`, { method: 'PUT', json: body });
      } else {
        await cloudflareApi('/api/member/recurring', { method: 'POST', json: { ...body, next_date: start, status: 'ACTIVE' } });
      }
      notifyCollectionChanged('recurring');
      toast.success(editing ? 'Transaksi rutin diperbarui.' : `${name.trim()} akan dicatat ${INTERVAL_LABEL[interval].toLowerCase()}.`);
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.');
      setSaving(false);
    }
  };

  const tone = type === 'Pemasukan'
    ? { text: 'text-emerald-600', bg: 'bg-emerald-600', soft: 'bg-emerald-50', ring: 'ring-emerald-200' }
    : { text: 'text-rose-600', bg: 'bg-rose-600', soft: 'bg-rose-50', ring: 'ring-rose-200' };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} onClick={onClose} className="absolute inset-0 bg-slate-900/45" />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={editing ? 'Ubah transaksi rutin' : 'Transaksi rutin baru'}
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 32 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:max-w-xl sm:rounded-[28px]"
      >
        <div className="flex items-center gap-3 px-5 pb-2 pt-4">
          <button type="button" onClick={onClose} aria-label="Kembali" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200">
            <ChevronLeft size={20} />
          </button>
          <h2 className="flex-1 text-[19px] font-bold text-slate-900">{editing ? 'Ubah transaksi rutin' : 'Transaksi rutin baru'}</h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="hidden h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 sm:flex">
            <X size={19} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-5 pt-2">
          {/* Jenis: dua kartu, bukan pil. */}
          <div className="grid grid-cols-2 gap-2">
            {(['Pengeluaran', 'Pemasukan'] as Kind[]).map((k) => {
              const on = type === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setType(k)}
                  aria-pressed={on}
                  className={cn(
                    'rounded-2xl px-4 py-3 text-left transition',
                    on ? (k === 'Pemasukan' ? 'bg-emerald-50 ring-2 ring-emerald-400' : 'bg-rose-50 ring-2 ring-rose-400') : 'bg-slate-50 ring-1 ring-slate-200 hover:bg-slate-100'
                  )}
                >
                  <span className={cn('block text-[15px] font-bold', on ? (k === 'Pemasukan' ? 'text-emerald-700' : 'text-rose-700') : 'text-slate-700')}>{k === 'Pemasukan' ? '↓ Uang masuk' : '↑ Uang keluar'}</span>
                  <span className="block text-[12px] text-slate-500">{k === 'Pemasukan' ? 'Gaji, sewa diterima' : 'Langganan, cicilan, kos'}</span>
                </button>
              );
            })}
          </div>

          {/* Nominal besar. */}
          <div className={cn('rounded-[24px] px-4 py-5 text-center', tone.soft)}>
            <div className="flex items-baseline justify-center gap-2">
              <span className={cn('text-[22px] font-semibold', tone.text)}>{type === 'Pemasukan' ? '+' : '−'}{getCurrencySymbol(currency)}</span>
              <NumberInput
                value={amount}
                onChange={setAmount}
                placeholder="0"
                inputMode="decimal"
                aria-label="Nominal"
                style={{ width: `${Math.max(2, Math.min(14, amount.replace(/\..*/, '').length * 1.33 + 1))}ch` }}
                className={cn('min-w-0 bg-transparent text-left text-[40px] font-extrabold tabular-nums outline-none placeholder:text-slate-300', tone.text)}
              />
            </div>
            {value > 0 && (
              <p className="mt-1 text-[13px] text-slate-600">
                ≈ {formatCurrency(Math.round(value * (PER_MONTH[interval] ?? 1)), currency)} per bulan
              </p>
            )}
          </div>

          <label className="block space-y-1.5">
            <span className="px-1 text-[13px] font-medium text-slate-500">Nama</span>
            <input value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} placeholder={type === 'Pemasukan' ? 'Mis. Gaji bulanan' : 'Mis. Netflix, kos, cicilan motor'} className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 text-[16px] outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" />
          </label>

          <div className="space-y-2">
            <span className="px-1 text-[13px] font-medium text-slate-500">Kategori</span>
            {shownCategories.length === 0 ? (
              <p className="px-1 text-[13px] text-slate-400">Belum ada kategori. Tambahkan di Pengaturan → Kategori & Anggaran.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {shownCategories.map((c) => {
                  const v = categoryVisual(c, type.toLowerCase());
                  const on = category === c;
                  return (
                    <button key={c} type="button" onClick={() => setCategory(c)} aria-pressed={on} className={cn('flex items-center gap-1.5 rounded-full py-1.5 pl-1.5 pr-3 text-[14px] transition', on ? cn('font-semibold text-slate-900 ring-2', tone.ring, tone.soft) : 'bg-slate-50 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100')}>
                      <span className={cn('flex h-7 w-7 items-center justify-center rounded-full text-[15px]', v.tile)} aria-hidden>{v.emoji}</span>
                      {c}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <label className="block space-y-1.5">
            <span className="px-1 text-[13px] font-medium text-slate-500">{type === 'Pemasukan' ? 'Masuk ke rekening' : 'Dari rekening'}</span>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-[16px] outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100">
              {accounts.length === 0 && <option value="">Belum ada rekening</option>}
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {formatCurrency(a.balance, a.currency || 'IDR')}</option>)}
            </select>
          </label>

          {/* Jadwal. */}
          <div className="space-y-3 rounded-[24px] bg-slate-50 p-4">
            <div className="flex flex-wrap gap-2">
              {RECURRING_INTERVALS.map((i) => (
                <button key={i} type="button" onClick={() => setIntervalValue(i)} aria-pressed={interval === i} className={cn('rounded-full px-3.5 py-2 text-[14px] transition', interval === i ? 'bg-slate-900 font-semibold text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100')}>
                  {SHORT[i]}
                </button>
              ))}
            </div>
            <label className="block space-y-1.5">
              <span className="px-1 text-[13px] font-medium text-slate-500">{editing ? 'Jadwal berikutnya' : 'Mulai'}</span>
              <div className="relative">
                <CalendarDays size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="date" value={start} min={editing ? undefined : today} onChange={(e) => setStart(e.target.value)} className={cn('w-full rounded-2xl border bg-white py-3.5 pl-11 pr-4 text-[16px] outline-none focus:ring-4 focus:ring-indigo-100', pastDate ? 'border-rose-300' : 'border-slate-200')} />
              </div>
            </label>
            {upcoming.length > 0 && !pastDate && (
              <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-slate-600">
                <span>Dicatat:</span>
                {upcoming.map((d) => <span key={d.toISOString()} className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">{fmtDay(d)}</span>)}
                <span>…</span>
              </div>
            )}
            {start === today && !editing && (
              <p className="flex items-start gap-1.5 text-[12px] text-slate-500"><Info size={13} className="mt-0.5 shrink-0" /> Mulai hari ini: dicatat otomatis pada pengecekan berikutnya (paling lambat besok pagi) dengan tanggal hari ini.</p>
            )}
          </div>

          <label className="block space-y-1.5">
            <span className="px-1 text-[13px] font-medium text-slate-500">Catatan <span className="text-slate-400">· opsional</span></span>
            <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 200))} rows={2} className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-[15px] outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" />
          </label>

          {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-[14px] text-rose-700">{error}</p>}
        </div>

        <div className="border-t border-slate-100 px-5 py-4">
          <button type="button" onClick={() => void submit()} disabled={Boolean(problem) || saving} className={cn('w-full rounded-full py-3.5 text-[16px] font-bold text-white transition disabled:bg-slate-200 disabled:text-slate-500', tone.bg)}>
            {saving ? 'Menyimpan…' : problem || (editing ? 'Simpan perubahan' : `Simpan · ${INTERVAL_LABEL[interval].toLowerCase()}`)}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
