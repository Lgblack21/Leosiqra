"use client";

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, X, Check, Pencil, CalendarDays, Repeat, Wallet, Sparkles } from 'lucide-react';
import { cn, formatIDR, formatCurrency, toLocalDateString } from '@/lib/utils';
import { NumberInput } from '@/components/ui/NumberInput';
import { accountService, type Account } from '@/lib/services/accountService';
import { savingsService } from '@/lib/services/savingsService';
import type { SavingsGoal } from '@/lib/services/savingsGoalService';
import {
  TARGET_COLORS, TARGET_ICONS, DEFAULT_TARGET_COLOR, DEFAULT_TARGET_ICON,
  monthsUntil, neededPerMonth, targetService, type TargetInput,
} from '@/lib/targets';
import { useFeedback } from '@/components/ui/Feedback';

// Form Tambah/Ubah target. Beda dari Transaksi Rutin: target berdiri sendiri
// (nama, nominal, tanggal, ikon & warna); setoran otomatis dan dana awal
// opsional. Dana awal = setoran tabungan biasa (saldo rekening dipotong
// atomik di server), dicatat setelah target tersimpan.

export type TargetPreset = { name?: string; targetAmount?: number; icon?: string; color?: string };

const INTERVALS: SavingsGoal['interval'][] = ['Harian', 'Mingguan', 'Bulanan', 'Tahunan'];
const inAYear = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return toLocalDateString(d);
};
const longDate = (s: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${s}T00:00:00`));

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="px-1 text-[13px] font-medium text-slate-500">{label}</span>
      {children}
      {hint && <span className="block px-1 text-[12px] text-slate-500">{hint}</span>}
    </label>
  );
}

const inputCls = 'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-[16px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100';

type Props = {
  open: boolean;
  onClose: () => void;
  // Diisi = ubah target ini; kosong = target baru.
  goal?: SavingsGoal | null;
  preset?: TargetPreset | null;
  onSaved?: () => void;
};

export function TargetFormModal(props: Props) {
  return <AnimatePresence>{props.open && <TargetForm key={props.goal?.id ?? props.preset?.name ?? 'baru'} {...props} />}</AnimatePresence>;
}

// Dipasang ulang tiap kali dibuka → state awal langsung dari props.
function TargetForm({ onClose, goal, preset, onSaved }: Props) {
  const { toast } = useFeedback();
  const editing = Boolean(goal);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const hasAuto = Boolean(goal && goal.monthlyAmount > 0);
  const [name, setName] = useState(goal?.name ?? preset?.name ?? '');
  const [amount, setAmount] = useState(goal?.targetAmount ? String(goal.targetAmount) : preset?.targetAmount ? String(preset.targetAmount) : '');
  const [date, setDate] = useState(goal?.targetDate ?? inAYear());
  const [icon, setIcon] = useState(goal?.icon ?? preset?.icon ?? DEFAULT_TARGET_ICON);
  const [color, setColor] = useState(goal?.color ?? preset?.color ?? DEFAULT_TARGET_COLOR);
  const [auto, setAuto] = useState(hasAuto);
  const [autoAmount, setAutoAmount] = useState(hasAuto && goal ? String(goal.monthlyAmount) : '');
  const [interval, setIntervalValue] = useState<SavingsGoal['interval']>(goal?.interval ?? 'Bulanan');
  const [autoAccount, setAutoAccount] = useState(goal?.accountId ?? '');
  const [nextDate, setNextDate] = useState(goal?.nextDate ? goal.nextDate.slice(0, 10) : toLocalDateString());
  const [initAccount, setInitAccount] = useState('');
  const [initAmount, setInitAmount] = useState('');

  useEffect(() => {
    accountService.getUserAccounts('session').then((list) => {
      setAccounts(list);
      setInitAccount((v) => v || list[0]?.id || '');
    }).catch(() => setAccounts([]));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (picking) setPicking(false);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picking, onClose]);

  const target = Number(amount) || 0;
  const saved = goal?.currentTotal ?? 0;
  const need = neededPerMonth(target, saved + (Number(initAmount) || 0), date);
  const months = monthsUntil(date);
  const initAcc = accounts.find((a) => a.id === initAccount);
  const initValue = Number(initAmount) || 0;
  const initTooBig = Boolean(initAcc && initValue > 0 && !(initAcc.creditLimit && initAcc.creditLimit > 0) && initValue > initAcc.balance);
  const autoValue = Number(autoAmount) || 0;

  const problem = useMemo(() => {
    if (!name.trim()) return 'Isi nama target';
    if (target <= 0) return 'Isi jumlah target';
    if (!date || (months === 0 && !editing)) return 'Tanggal target harus di masa depan';
    if (auto && autoValue <= 0) return 'Isi nominal setoran otomatis';
    if (auto && !autoAccount) return 'Pilih rekening untuk setoran otomatis';
    if (initValue > 0 && !initAccount) return 'Pilih rekening dana awal';
    if (initTooBig) return 'Dana awal melebihi saldo rekening';
    return '';
  }, [name, target, date, months, editing, auto, autoValue, autoAccount, initValue, initAccount, initTooBig]);

  const submit = async () => {
    if (problem || saving) return;
    setSaving(true);
    setError('');
    const input: TargetInput = {
      name: name.trim(),
      targetAmount: target,
      targetDate: date,
      icon,
      color,
      autoAmount: auto ? autoValue : 0,
      interval,
      accountId: auto ? autoAccount : '',
      nextDate,
    };
    try {
      if (goal) {
        await targetService.update(goal.id, input);
      } else {
        await targetService.create(input);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan target.');
      setSaving(false);
      return;
    }
    if (!goal && initValue > 0 && initAcc) {
      try {
        const now = new Date();
        await savingsService.createSaving({
          description: `Dana awal ${input.name}`,
          amount: initValue,
          amountIDR: (initAcc.currency || 'IDR') === 'IDR' ? initValue : undefined,
          currency: initAcc.currency || 'IDR',
          category: input.name,
          fromAccount: initAcc.id ?? '',
          toGoal: input.name,
          transactionType: 'Setoran',
          date: now,
          displayDate: now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }),
        });
      } catch (e) {
        toast.error(`Target dibuat, tapi dana awal gagal disetor: ${e instanceof Error ? e.message : 'coba setor manual.'}`);
        setSaving(false);
        onSaved?.();
        onClose();
        return;
      }
    }
    toast.success(goal ? 'Target diperbarui.' : `Target ${input.name} dibuat.`);
    setSaving(false);
    onSaved?.();
    onClose();
  };

  return (
        <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} onClick={onClose} className="absolute inset-0 bg-slate-900/45" />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={editing ? 'Ubah target' : 'Target baru'}
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 32 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[28px] bg-[#f6f7fb] shadow-2xl sm:max-w-xl sm:rounded-[28px]"
          >
            <div className="flex items-center gap-3 bg-white px-5 py-4">
              <button type="button" onClick={onClose} aria-label="Kembali" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200">
                <ChevronLeft size={20} />
              </button>
              <h2 className="flex-1 text-[19px] font-bold text-slate-900">{editing ? 'Ubah target' : 'Target baru'}</h2>
              <button type="button" onClick={onClose} aria-label="Tutup" className="hidden h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 sm:flex">
                <X size={19} />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-5 pt-4">
              {/* Kartu identitas: ikon + warna, pratinjau langsung. */}
              <section className="overflow-hidden rounded-[24px] bg-white">
                <div className="relative flex items-center gap-4 p-4" style={{ background: `linear-gradient(135deg, ${color}1f, ${color}05)` }}>
                  <button
                    type="button"
                    onClick={() => setPicking((v) => !v)}
                    aria-expanded={picking}
                    aria-label="Ganti ikon & warna"
                    className="relative flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-[22px] text-[34px] shadow-lg transition-transform active:scale-95"
                    style={{ background: color, boxShadow: `0 10px 24px -10px ${color}` }}
                  >
                    <span aria-hidden>{icon}</span>
                    <span className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-700 shadow ring-2 ring-white"><Pencil size={13} /></span>
                  </button>
                  <div className="min-w-0">
                    <p className="truncate text-[17px] font-bold text-slate-900">{name.trim() || 'Nama targetmu'}</p>
                    <p className="text-[13px] text-slate-600">
                      {target > 0 ? formatIDR(target) : 'Rp —'}{date ? ` · ${longDate(date)}` : ''}
                    </p>
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {picking && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden border-t border-slate-100">
                      <div className="space-y-3 p-4">
                        <div className="flex flex-wrap gap-2">
                          {TARGET_COLORS.map((c) => (
                            <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Warna ${c}`} className={cn('flex h-9 w-9 items-center justify-center rounded-xl transition-transform hover:scale-105', color === c && 'ring-2 ring-offset-2')} style={{ background: c, ['--tw-ring-color' as string]: c }}>
                              {color === c && <Check size={16} className="text-white" strokeWidth={3} />}
                            </button>
                          ))}
                        </div>
                        {TARGET_ICONS.map((g) => (
                          <div key={g.group}>
                            <p className="mb-1.5 text-[12px] font-medium text-slate-500">{g.group}</p>
                            <div className="grid grid-cols-10 gap-1">
                              {g.items.map((e) => (
                                <button key={e} type="button" onClick={() => setIcon(e)} aria-label={`Ikon ${e}`} className={cn('flex aspect-square items-center justify-center rounded-xl text-[22px] transition hover:bg-slate-100', icon === e && 'bg-slate-100 ring-2 ring-slate-300')}>
                                  {e}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                        <button type="button" onClick={() => setPicking(false)} className="w-full rounded-full bg-slate-900 py-2.5 text-[14px] font-semibold text-white">Pakai ini</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-4 p-4 pt-3">
                  <Field label="Nama target">
                    <input value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} placeholder="Mis. Liburan Jepang, DP rumah" className={inputCls} />
                  </Field>
                  <Field label="Jumlah target">
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">Rp</span>
                      <NumberInput value={amount} onChange={setAmount} placeholder="0" inputMode="numeric" className={cn(inputCls, 'pl-12 tabular-nums')} />
                    </div>
                  </Field>
                  <Field
                    label="Tercapai pada"
                    hint={need ? <span className="flex items-center gap-1.5 text-indigo-600"><Sparkles size={13} /> Sisihkan ± {formatIDR(need)}/bulan selama {months} bulan</span> : undefined}
                  >
                    <div className="relative">
                      <CalendarDays size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input type="date" value={date} min={toLocalDateString()} onChange={(e) => setDate(e.target.value)} className={cn(inputCls, 'pl-11')} />
                    </div>
                  </Field>
                </div>
              </section>

              {/* Setoran otomatis (opsional). */}
              <section className="rounded-[24px] bg-white p-4">
                <button type="button" onClick={() => { setAuto((v) => !v); if (!autoAmount && need) setAutoAmount(String(need)); }} className="flex w-full items-center gap-3 text-left" aria-pressed={auto}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><Repeat size={18} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-slate-900">Setoran otomatis</span>
                    <span className="block text-[12px] text-slate-500">Leosiqra menyetor sendiri tiap periode</span>
                  </span>
                  <span className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors', auto ? 'bg-indigo-600' : 'bg-slate-200')}>
                    <span className={cn('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all', auto ? 'left-6' : 'left-1')} />
                  </span>
                </button>
                {auto && (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Field label="Nominal per setoran">
                        <div className="relative">
                          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">Rp</span>
                          <NumberInput value={autoAmount} onChange={setAutoAmount} placeholder="0" inputMode="numeric" className={cn(inputCls, 'pl-12 tabular-nums')} />
                        </div>
                      </Field>
                    </div>
                    <Field label="Setiap">
                      <select value={interval} onChange={(e) => setIntervalValue(e.target.value as SavingsGoal['interval'])} className={inputCls}>
                        {INTERVALS.map((i) => <option key={i} value={i}>{i.replace('an', '')}</option>)}
                      </select>
                    </Field>
                    <Field label="Mulai">
                      <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} className={inputCls} />
                    </Field>
                    <div className="col-span-2">
                      <Field label="Dari rekening">
                        <select value={autoAccount} onChange={(e) => setAutoAccount(e.target.value)} className={inputCls}>
                          <option value="">Pilih rekening</option>
                          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
                        </select>
                      </Field>
                    </div>
                  </div>
                )}
              </section>

              {/* Dana awal (hanya saat membuat). */}
              {!editing && (
                <section className="rounded-[24px] bg-white p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><Wallet size={18} /></span>
                    <span>
                      <span className="block text-[15px] font-semibold text-slate-900">Dana awal <span className="font-normal text-slate-400">· opsional</span></span>
                      <span className="block text-[12px] text-slate-500">Langsung dipindah dari rekening ke target ini</span>
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Dari rekening" hint={initAcc ? `Tersedia ${formatCurrency(initAcc.balance, initAcc.currency || 'IDR')}` : undefined}>
                      <select value={initAccount} onChange={(e) => setInitAccount(e.target.value)} className={inputCls}>
                        {accounts.length === 0 && <option value="">Belum ada rekening</option>}
                        {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </Field>
                    <Field label="Jumlah disisihkan" hint={initTooBig ? <span className="text-rose-600">Melebihi saldo rekening</span> : undefined}>
                      <NumberInput value={initAmount} onChange={setInitAmount} placeholder="0" inputMode="decimal" className={cn(inputCls, 'tabular-nums', initTooBig && 'border-rose-300')} />
                    </Field>
                  </div>
                </section>
              )}

              {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-[14px] text-rose-700">{error}</p>}
            </div>

            <div className="border-t border-slate-200/70 bg-white px-5 py-4">
              <button
                type="button"
                onClick={() => void submit()}
                disabled={Boolean(problem) || saving}
                className="w-full rounded-full py-3.5 text-[16px] font-bold text-white transition disabled:bg-slate-200 disabled:text-slate-500"
                style={problem || saving ? undefined : { background: `linear-gradient(135deg, ${color}, #4f46e5)` }}
              >
                {saving ? 'Menyimpan…' : problem || (editing ? 'Simpan perubahan' : 'Simpan target')}
              </button>
            </div>
          </motion.div>
        </div>
  );
}
