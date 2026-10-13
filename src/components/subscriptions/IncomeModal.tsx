"use client";

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { ChevronLeft, Pause, Play, Repeat, Trash2, X } from 'lucide-react';
import { cn, formatIDR, toLocalDateString } from '@/lib/utils';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { accountService, type Account } from '@/lib/services/accountService';
import { categoryService } from '@/lib/services/categoryService';
import { recurringService, type RecurringTransaction } from '@/lib/services/recurringService';
import { isCreditAccountType } from '@/lib/creditCard';
import { AccountLogo } from '@/components/ui/AccountLogo';
import { useFeedback } from '@/components/ui/Feedback';
import { INTERVALS, addInterval, Field, DateInput, SelectBox, inputCls } from '@/components/subscriptions/SubscriptionModal';
import type { BillingInterval } from '@/lib/subscriptionCatalog';

// Pemasukan rutin (gaji, sewa, freelance tetap…): jadwal "Pemasukan" yang
// dicatat otomatis tiap tanggalnya — atau cuma diingatkan kalau "Catat
// otomatis" dimatikan. Pengeluaran rutin ada di Langganan.

export const INCOME_PRESETS = [
  { id: 'gaji', name: 'Gaji', emoji: '💼', category: 'Gaji', hint: 'Gaji bulanan dari kantor' },
  { id: 'freelance', name: 'Freelance tetap', emoji: '🧑‍💻', category: 'Freelance', hint: 'Klien atau proyek bulanan' },
  { id: 'sewa', name: 'Sewa / kos', emoji: '🏠', category: 'Sewa', hint: 'Uang sewa yang kamu terima' },
  { id: 'tunjangan', name: 'Tunjangan', emoji: '🎁', category: 'Tunjangan', hint: 'Tunjangan, insentif tetap' },
  { id: 'bunga', name: 'Bunga / dividen', emoji: '📈', category: 'Bunga', hint: 'Deposito, obligasi, dividen' },
  { id: 'kiriman', name: 'Uang saku / kiriman', emoji: '💌', category: 'Kiriman', hint: 'Dari keluarga atau pasangan' },
  { id: 'pensiun', name: 'Pensiun', emoji: '🧓', category: 'Pensiun', hint: 'Dana pensiun bulanan' },
] as const;
export const incomeEmoji = (r: Pick<RecurringTransaction, 'name' | 'category'>) =>
  INCOME_PRESETS.find((p) => p.category.toLowerCase() === (r.category || '').toLowerCase() || r.name.toLowerCase().includes(p.category.toLowerCase()))?.emoji ?? '💰';

type Draft = { name: string; amount: number; interval: BillingInterval; nextDate: string; accountId: string; category: string; autoRecord: boolean; note: string };

export function IncomeModal({ initial, onClose }: { initial?: RecurringTransaction; onClose: () => void }) {
  const { toast, confirm } = useFeedback();
  const editing = Boolean(initial?.id);
  const [step, setStep] = useState<'pick' | 'form'>(initial ? 'form' : 'pick');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [userCats, setUserCats] = useState<string[]>([]);
  const [uid, setUid] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(initial?.status ?? 'ACTIVE');
  const [draft, setDraft] = useState<Draft>(() => {
    const interval = (initial?.interval && initial.interval !== 'Harian' ? initial.interval : 'Bulanan') as BillingInterval;
    return {
      name: initial?.name ?? '',
      amount: initial?.amount ?? 0,
      interval,
      nextDate: toLocalDateString(initial?.nextDate ? new Date(initial.nextDate) : addInterval(new Date(), interval)),
      accountId: initial?.accountId ?? '',
      category: initial?.category ?? 'Gaji',
      autoRecord: initial?.autoRecord !== false,
      note: initial?.note ?? '',
    };
  });
  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  useEffect(() => {
    accountService.getUserAccounts('session').then((list) => {
      setAccounts(list);
      setDraft((d) => (d.accountId ? d : { ...d, accountId: list.find((a) => !isCreditAccountType(a.type))?.id ?? list[0]?.id ?? '' }));
    }).catch(() => {});
    cloudflareApi<{ user?: { id?: string } | null }>('/api/auth/me')
      .then((r) => {
        const id = r.user?.id ?? '';
        setUid(id);
        if (id) categoryService.getUserCategories(id).then((l) => setUserCats([...new Set(l.filter((c) => (c as { scope?: string }).scope === 'income').map((c) => c.category))])).catch(() => {});
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const cats = useMemo(() => [...new Set([draft.category, ...INCOME_PRESETS.map((p) => p.category), ...userCats, 'Lainnya'].filter(Boolean))], [draft.category, userCats]);

  const pick = (p?: (typeof INCOME_PRESETS)[number]) => {
    set({ name: p?.name === 'Gaji' ? 'Gaji' : p?.name ?? '', category: p?.category ?? 'Lainnya' });
    setStep('form');
  };

  const save = async () => {
    if (!draft.name.trim()) return toast.error('Nama pemasukan wajib diisi.');
    if (!(draft.amount > 0)) return toast.error('Isi nominal yang diterima.');
    if (!draft.accountId) return toast.error('Pilih rekening tujuannya.');
    setSaving(true);
    const body = {
      name: draft.name.trim(),
      type: 'Pemasukan' as const,
      category: draft.category,
      accountId: draft.accountId,
      amount: draft.amount,
      interval: draft.interval,
      nextDate: new Date(draft.nextDate),
      note: draft.note.trim(),
      autoRecord: draft.autoRecord,
    };
    try {
      if (editing && initial?.id) await recurringService.updateRecurring(initial.id, { ...body, status });
      else await recurringService.createRecurring({ ...body, userId: uid, status: 'ACTIVE' });
      toast.success(editing ? 'Pemasukan rutin diperbarui' : `${body.name} ditambahkan`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!initial?.id) return;
    if (!(await confirm({ title: `Hapus ${initial.name}?`, message: 'Pemasukan yang sudah tercatat tidak ikut terhapus.', confirmLabel: 'Hapus', danger: true }))) return;
    try {
      await recurringService.deleteRecurring(initial.id);
      toast.success('Dihapus');
      onClose();
    } catch {
      toast.error('Gagal menghapus.');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={editing ? 'Ubah pemasukan rutin' : 'Tambah pemasukan rutin'}>
      <motion.div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 340, damping: 32 }}
        className="relative flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:rounded-[28px]"
      >
        <AnimatePresence mode="wait" initial={false}>
          {step === 'pick' ? (
            <motion.div key="pick" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.18 }} className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-lg font-extrabold text-slate-900">Tambah pemasukan rutin</p>
                <button type="button" onClick={onClose} aria-label="Tutup" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"><X size={18} /></button>
              </div>
              <p className="mt-1 text-sm text-slate-500">Uang yang masuk dengan jumlah tetap tiap periode.</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {INCOME_PRESETS.map((p, i) => (
                  <motion.button
                    key={p.id}
                    type="button"
                    onClick={() => pick(p)}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 text-left ring-1 ring-slate-100 transition-colors hover:bg-emerald-50 hover:ring-emerald-200"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-2xl shadow-sm">{p.emoji}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-bold text-slate-800">{p.name}</span>
                      <span className="block truncate text-xs text-slate-500">{p.hint}</span>
                    </span>
                  </motion.button>
                ))}
                <button type="button" onClick={() => pick()} className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 p-3 text-left text-slate-500 transition-colors hover:border-emerald-300 hover:text-emerald-700">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl">✏️</span>
                  <span className="text-[15px] font-bold">Lainnya, isi sendiri</span>
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="form" className="flex min-h-0 flex-1 flex-col" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.18 }}>
              <div className="flex items-center gap-3 px-5 pb-2 pt-5">
                <button type="button" onClick={() => (editing ? onClose() : setStep('pick'))} aria-label={editing ? 'Tutup' : 'Kembali'} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200">
                  {editing ? <X size={18} /> : <ChevronLeft size={18} />}
                </button>
                <p className="flex-1 text-lg font-extrabold text-slate-900">{editing ? 'Ubah pemasukan rutin' : 'Pemasukan rutin'}</p>
                {editing && (
                  <>
                    <button type="button" onClick={() => setStatus((s) => (s === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'))} className="flex h-10 items-center gap-1.5 rounded-full bg-slate-100 px-3 text-xs font-bold text-slate-600 hover:bg-slate-200">
                      {status === 'ACTIVE' ? <><Pause size={13} /> Jeda</> : <><Play size={13} /> Aktifkan</>}
                    </button>
                    <button type="button" onClick={remove} aria-label="Hapus" className="flex h-10 w-10 items-center justify-center rounded-full text-rose-500 hover:bg-rose-50"><Trash2 size={17} /></button>
                  </>
                )}
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-4">
                {status === 'PAUSED' && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">Dijeda — tidak dicatat sampai diaktifkan lagi (berlaku setelah Simpan).</p>}
                <div className="flex items-center gap-3">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-3xl">{incomeEmoji({ name: draft.name, category: draft.category })}</span>
                  <div className="min-w-0">
                    <p className="truncate text-base font-extrabold text-slate-900">{draft.name || 'Pemasukan baru'}</p>
                    <p className="text-sm text-slate-500">{draft.category}</p>
                  </div>
                </div>

                <label className="block text-center">
                  <span className="text-sm text-slate-500">Tiap diterima</span>
                  <span className="mt-1 flex items-baseline justify-center gap-2">
                    <span className="text-xl font-semibold text-slate-400">Rp</span>
                    <input
                      inputMode="numeric"
                      aria-label="Nominal tiap diterima"
                      value={draft.amount ? draft.amount.toLocaleString('id-ID') : ''}
                      onChange={(e) => set({ amount: Number(e.target.value.replace(/\D/g, '')) || 0 })}
                      placeholder="0"
                      style={{ width: `${Math.max(1, (draft.amount ? draft.amount.toLocaleString('id-ID') : '0').length) + 0.6}ch` }}
                      className="min-w-0 bg-transparent text-left text-[40px] font-extrabold tracking-tight text-emerald-600 outline-none tabular-nums placeholder:text-slate-300"
                    />
                  </span>
                </label>

                <Field label="Diterima">
                  <LayoutGroup id="inc-interval">
                    <div className="flex rounded-full bg-slate-100 p-1">
                      {INTERVALS.map((it) => (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => set({ interval: it.id, nextDate: editing ? draft.nextDate : toLocalDateString(addInterval(new Date(), it.id)) })}
                          className={cn('relative flex-1 rounded-full py-2 text-sm font-semibold transition-colors', draft.interval === it.id ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700')}
                        >
                          {draft.interval === it.id && <motion.span layoutId="pill" className="absolute inset-0 rounded-full bg-white shadow-sm" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
                          <span className="relative">{it.label}</span>
                        </button>
                      ))}
                    </div>
                  </LayoutGroup>
                </Field>

                <Field label="Nama">
                  <input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Gaji PT Maju, sewa kos lantai 2…" className={inputCls} />
                </Field>

                <Field label="Diterima berikutnya">
                  <DateInput value={draft.nextDate} onChange={(v) => set({ nextDate: v })} />
                </Field>

                <Field label="Masuk ke">
                  <SelectBox
                    icon={(() => { const a = accounts.find((x) => x.id === draft.accountId); return a ? <AccountLogo acc={a} size={24} /> : null; })()}
                    value={draft.accountId}
                    onChange={(v) => set({ accountId: v })}
                    options={accounts.filter((a) => !isCreditAccountType(a.type)).map((a) => ({ value: a.id ?? '', label: a.name }))}
                  />
                </Field>

                <Field label="Kategori pemasukan">
                  <SelectBox icon={<span>{incomeEmoji({ name: '', category: draft.category })}</span>} value={draft.category} onChange={(v) => set({ category: v })} options={cats.map((c) => ({ value: c, label: c }))} />
                </Field>

                <button type="button" onClick={() => set({ autoRecord: !draft.autoRecord })} aria-pressed={draft.autoRecord} className="flex w-full items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-left ring-1 ring-slate-100">
                  <Repeat size={17} className="shrink-0 text-slate-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-slate-800">Catat otomatis</span>
                    <span className="block text-xs text-slate-500">{draft.autoRecord ? 'Otomatis jadi pemasukan di tanggalnya' : 'Cuma diingatkan, saldo tidak ditambah otomatis'}</span>
                  </span>
                  <span className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', draft.autoRecord ? 'bg-emerald-500' : 'bg-slate-300')}>
                    <motion.span layout className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow', draft.autoRecord ? 'right-0.5' : 'left-0.5')} />
                  </span>
                </button>

                <Field label="Catatan">
                  <textarea value={draft.note} onChange={(e) => set({ note: e.target.value })} rows={2} placeholder="Opsional" className={cn(inputCls, 'resize-none')} />
                </Field>

                {draft.amount > 0 && draft.interval !== 'Bulanan' && (
                  <p className="text-center text-xs text-slate-400">
                    ≈ {formatIDR(draft.interval === 'Mingguan' ? (draft.amount * 52) / 12 : draft.interval === '3 Bulanan' ? draft.amount / 3 : draft.amount / 12)} per bulan
                  </p>
                )}
              </div>

              <div className="border-t border-slate-100 px-5 py-4">
                <button type="button" onClick={save} disabled={saving} className="h-12 w-full rounded-full bg-slate-900 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-60">
                  {saving ? 'Menyimpan…' : 'Simpan'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
