"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { CalendarDays, ChevronDown, ChevronLeft, Plus, Repeat, Search, Trash2, X } from 'lucide-react';
import { cn, formatIDR, toLocalDateString } from '@/lib/utils';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { accountService, type Account } from '@/lib/services/accountService';
import { categoryService } from '@/lib/services/categoryService';
import { recurringService, type RecurringTransaction } from '@/lib/services/recurringService';
import { isCreditAccountType } from '@/lib/creditCard';
import { categoryEmoji } from '@/lib/categoryEmoji';
import { AccountLogo } from '@/components/ui/AccountLogo';
import { useFeedback } from '@/components/ui/Feedback';
import { ServiceLogo } from '@/components/subscriptions/ServiceLogo';
import {
  INTERVAL_LABEL,
  POPULAR_COUNT,
  SERVICES,
  SERVICE_CATEGORIES,
  serviceById,
  serviceCategoryOf,
  type BillingInterval,
  type CatalogService,
  type ServiceCategory,
} from '@/lib/subscriptionCatalog';

// Tambah / ubah langganan: (1) pilih layanan dari katalog atau ketik sendiri,
// (2) isi detail. Disimpan sebagai transaksi rutin "Pengeluaran" plus
// metadata layanan; "Catat otomatis tiap jatuh tempo" mati = cukup diingatkan.

export const INTERVALS: { id: BillingInterval; label: string }[] = [
  { id: 'Mingguan', label: 'Mingguan' },
  { id: 'Bulanan', label: 'Bulanan' },
  { id: '3 Bulanan', label: '3 bulan' },
  { id: 'Tahunan', label: 'Tahunan' },
];

export const addInterval = (d: Date, interval: BillingInterval) => {
  const r = new Date(d);
  if (interval === 'Mingguan') r.setDate(r.getDate() + 7);
  else if (interval === 'Tahunan') r.setFullYear(r.getFullYear() + 1);
  else {
    const day = r.getDate();
    r.setDate(1);
    r.setMonth(r.getMonth() + (interval === '3 Bulanan' ? 3 : 1));
    r.setDate(Math.min(day, new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate()));
  }
  return r;
};

type Draft = {
  service?: string;
  name: string;
  serviceCategory: ServiceCategory;
  amount: number;
  interval: BillingInterval;
  nextDate: string;
  autoRecord: boolean;
  accountId: string;
  category: string;
  since: string;
  note: string;
};

export function SubscriptionModal({ initial, prefill, onClose }: { initial?: RecurringTransaction; prefill?: Partial<RecurringTransaction>; onClose: () => void }) {
  const { toast, confirm } = useFeedback();
  const editing = Boolean(initial?.id);
  const [step, setStep] = useState<'pick' | 'form'>(initial || prefill ? 'form' : 'pick');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [userCats, setUserCats] = useState<string[]>([]);
  const [uid, setUid] = useState('');
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => {
    const src = initial ?? prefill;
    const interval = (src?.interval && src.interval !== 'Harian' ? src.interval : 'Bulanan') as BillingInterval;
    const svc = serviceById(src?.service);
    const sc = (src?.serviceCategory as ServiceCategory) ?? svc?.category ?? 'Lainnya';
    return {
      service: src?.service,
      name: src?.name ?? '',
      serviceCategory: sc,
      amount: src?.amount ?? 0,
      interval,
      nextDate: toLocalDateString(src?.nextDate ? new Date(src.nextDate) : addInterval(new Date(), interval)),
      autoRecord: src?.autoRecord !== false,
      accountId: src?.accountId ?? '',
      category: src?.category ?? serviceCategoryOf(sc).expense,
      since: src?.since ?? '',
      note: src?.note ?? '',
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
        if (id) categoryService.getUserCategories(id).then((l) => setUserCats([...new Set(l.filter((c) => (c as { scope?: string }).scope !== 'income').map((c) => c.category))])).catch(() => {});
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pick = (s: CatalogService | { name: string }) => {
    const svc = 'id' in s ? s : undefined;
    const interval = svc?.interval ?? 'Bulanan';
    const sc = svc?.category ?? 'Lainnya';
    setDraft((d) => ({
      ...d,
      service: svc?.id,
      name: s.name,
      serviceCategory: sc,
      amount: svc?.price ?? 0,
      interval,
      nextDate: toLocalDateString(addInterval(new Date(), interval)),
      category: serviceCategoryOf(sc).expense,
    }));
    setStep('form');
  };

  const expenseCats = useMemo(() => [...new Set([draft.category, ...SERVICE_CATEGORIES.map((c) => c.expense), ...userCats].filter(Boolean))], [draft.category, userCats]);

  const save = async () => {
    if (!draft.name.trim()) return toast.error('Nama langganan wajib diisi.');
    if (!(draft.amount > 0)) return toast.error('Isi nominal tiap tagihan.');
    if (!draft.accountId) return toast.error('Pilih rekening pembayarannya.');
    setSaving(true);
    const body = {
      name: draft.name.trim(),
      type: 'Pengeluaran' as const,
      category: draft.category,
      accountId: draft.accountId,
      amount: draft.amount,
      interval: draft.interval,
      nextDate: new Date(draft.nextDate),
      note: draft.note.trim(),
      service: draft.service ?? '',
      serviceCategory: draft.serviceCategory,
      since: draft.since,
      autoRecord: draft.autoRecord,
    };
    try {
      if (editing && initial?.id) await recurringService.updateRecurring(initial.id, body);
      else await recurringService.createRecurring({ ...body, userId: uid, status: 'ACTIVE' });
      toast.success(editing ? 'Langganan diperbarui' : `${body.name} ditambahkan`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan langganan.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!initial?.id) return;
    const ok = await confirm({ title: `Hapus ${initial.name}?`, message: 'Transaksi yang sudah tercatat tidak ikut terhapus.', confirmLabel: 'Hapus', danger: true });
    if (!ok) return;
    try {
      await recurringService.deleteRecurring(initial.id);
      toast.success('Langganan dihapus');
      onClose();
    } catch {
      toast.error('Gagal menghapus.');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={editing ? 'Ubah langganan' : 'Tambah langganan'}>
      <motion.div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 340, damping: 32 }}
        className="relative flex h-[min(860px,92dvh)] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:rounded-[28px]"
      >
        <AnimatePresence mode="wait" initial={false}>
          {step === 'pick' ? (
            <motion.div key="pick" className="flex min-h-0 flex-1 flex-col" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.18 }}>
              <Picker onPick={pick} onClose={onClose} />
            </motion.div>
          ) : (
            <motion.div key="form" className="flex min-h-0 flex-1 flex-col" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.18 }}>
              <div className="flex items-center gap-3 px-5 pb-2 pt-5">
                {editing ? (
                  <button type="button" onClick={onClose} aria-label="Tutup" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"><X size={18} /></button>
                ) : (
                  <button type="button" onClick={() => setStep('pick')} aria-label="Kembali" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"><ChevronLeft size={18} /></button>
                )}
                <p className="flex-1 text-lg font-extrabold text-slate-900">{editing ? 'Ubah langganan' : 'Langganan'}</p>
                {editing && (
                  <button type="button" onClick={remove} aria-label="Hapus langganan" className="flex h-10 w-10 items-center justify-center rounded-full text-rose-500 hover:bg-rose-50"><Trash2 size={17} /></button>
                )}
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-4">
                <div className="flex items-center gap-3 pt-1">
                  <ServiceLogo service={draft.service} name={draft.name || '?'} size={56} />
                  <div className="min-w-0">
                    <p className="truncate text-base font-extrabold text-slate-900">{draft.name || 'Langganan baru'}</p>
                    <p className="text-sm text-slate-500">{draft.serviceCategory}</p>
                    {!editing && <button type="button" onClick={() => setStep('pick')} className="text-sm font-bold text-indigo-600 hover:underline">Ganti</button>}
                  </div>
                </div>

                <label className="block text-center">
                  <span className="text-sm text-slate-500">Nominal per tagihan</span>
                  <span className="mt-1 flex items-baseline justify-center gap-2">
                    <span className="text-xl font-semibold text-slate-400">Rp</span>
                    <input
                      inputMode="numeric"
                      aria-label="Nominal tiap tagihan"
                      value={draft.amount ? draft.amount.toLocaleString('id-ID') : ''}
                      onChange={(e) => set({ amount: Number(e.target.value.replace(/\D/g, '')) || 0 })}
                      placeholder="0"
                      style={{ width: `${Math.max(1, (draft.amount ? draft.amount.toLocaleString('id-ID') : '0').length) + 0.6}ch` }}
                      className="min-w-0 bg-transparent text-left text-[40px] font-extrabold tracking-tight text-slate-900 outline-none tabular-nums placeholder:text-slate-300"
                    />
                  </span>
                </label>

                <Field label="Ditagih">
                  <LayoutGroup id="sub-interval">
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
                  <input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Netflix, kos, cicilan motor…" className={inputCls} />
                </Field>

                <Field label="Tagihan berikutnya">
                  <DateInput value={draft.nextDate} onChange={(v) => set({ nextDate: v })} />
                </Field>

                <Field label="Kategori">
                  <SelectBox
                    icon={<span>{serviceCategoryOf(draft.serviceCategory).emoji}</span>}
                    value={draft.serviceCategory}
                    onChange={(v) => set({ serviceCategory: v as ServiceCategory, category: draft.category === serviceCategoryOf(draft.serviceCategory).expense ? serviceCategoryOf(v).expense : draft.category })}
                    options={SERVICE_CATEGORIES.map((c) => ({ value: c.id, label: c.id }))}
                  />
                </Field>

                <button type="button" onClick={() => set({ autoRecord: !draft.autoRecord })} className="flex w-full items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-left ring-1 ring-slate-100" aria-pressed={draft.autoRecord}>
                  <Repeat size={17} className="shrink-0 text-slate-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-slate-800">Catat otomatis tiap jatuh tempo</span>
                    <span className="block text-xs text-slate-500">{draft.autoRecord ? 'Otomatis jadi pengeluaran di tanggal tagihannya' : 'Cuma diingatkan, saldo tidak dipotong otomatis'}</span>
                  </span>
                  <span className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', draft.autoRecord ? 'bg-emerald-500' : 'bg-slate-300')}>
                    <motion.span layout className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow', draft.autoRecord ? 'right-0.5' : 'left-0.5')} />
                  </span>
                </button>

                <Field label="Dibayar dari">
                  <SelectBox
                    icon={(() => { const a = accounts.find((x) => x.id === draft.accountId); return a ? <AccountLogo acc={a} size={24} /> : null; })()}
                    value={draft.accountId}
                    onChange={(v) => set({ accountId: v })}
                    options={accounts.map((a) => ({ value: a.id ?? '', label: a.name }))}
                  />
                </Field>

                <Field label="Kategori pengeluaran">
                  <SelectBox icon={<span>{categoryEmoji(draft.category)}</span>} value={draft.category} onChange={(v) => set({ category: v })} options={expenseCats.map((c) => ({ value: c, label: c }))} />
                </Field>

                <Field label="Mulai langganan">
                  <DateInput value={draft.since} onChange={(v) => set({ since: v })} placeholder="Opsional" />
                </Field>

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

export const inputCls = 'w-full rounded-2xl bg-slate-50 px-4 py-3 text-[15px] text-slate-800 outline-none ring-1 ring-slate-100 placeholder:text-slate-400 focus:bg-white focus:ring-indigo-300';

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 pl-1 text-[13px] font-semibold text-slate-500">{label}</p>
      {children}
    </div>
  );
}

export function DateInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="relative flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100 focus-within:bg-white focus-within:ring-indigo-300">
      <CalendarDays size={17} className="shrink-0 text-slate-500" />
      <span className={cn('flex-1 text-[15px]', value ? 'text-slate-800' : 'text-slate-400')}>
        {value ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`)) : placeholder}
      </span>
      {value && placeholder && (
        <button type="button" onClick={(e) => { e.preventDefault(); onChange(''); }} aria-label="Kosongkan tanggal" className="relative z-10 rounded-full p-1 text-slate-400 hover:bg-slate-200"><X size={14} /></button>
      )}
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={placeholder ?? 'Tanggal'} />
    </label>
  );
}

export function SelectBox({ icon, value, onChange, options }: { icon?: React.ReactNode; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="relative flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100 focus-within:ring-indigo-300">
      {icon && <span className="flex shrink-0 items-center text-lg">{icon}</span>}
      <span className="flex-1 truncate text-[15px] text-slate-800">{options.find((o) => o.value === value)?.label ?? 'Pilih…'}</span>
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200/70 text-slate-500"><ChevronDown size={14} /></span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function Picker({ onPick, onClose }: { onPick: (s: CatalogService | { name: string }) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const needle = q.trim().toLowerCase();
  const list = needle ? SERVICES.filter((s) => s.name.toLowerCase().includes(needle) || s.category.toLowerCase().includes(needle)) : SERVICES;

  return (
    <>
      <div className="flex items-center justify-between px-5 pt-5">
        <p className="text-lg font-extrabold text-slate-900">Tambah langganan</p>
        <button type="button" onClick={onClose} aria-label="Tutup" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"><X size={18} /></button>
      </div>
      <div className="px-5 pt-4">
        <label className="flex items-center gap-2 rounded-full bg-slate-100 px-4 py-3 focus-within:bg-white focus-within:ring-1 focus-within:ring-indigo-300">
          <Search size={17} className="text-slate-400" />
          <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Netflix, Spotify, IndiHome…" aria-label="Cari layanan" className="w-full bg-transparent text-[15px] outline-none placeholder:text-slate-400" />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-3">
        {needle && (
          <button type="button" onClick={() => onPick({ name: q.trim() })} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-slate-50">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Plus size={18} /></span>
            <span className="text-[15px] font-semibold text-slate-800">Tambah “{q.trim()}”</span>
          </button>
        )}
        {!needle && <p className="px-2 pb-1 text-[13px] font-semibold text-slate-500">Populer</p>}
        {list.map((s, i) => (
          <div key={s.id}>
            {!needle && i === POPULAR_COUNT && <p className="px-2 pb-1 pt-4 text-[13px] font-semibold text-slate-500">Semua layanan</p>}
            <button type="button" onClick={() => onPick(s)} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition-colors hover:bg-slate-50">
              <ServiceLogo service={s.id} name={s.name} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-slate-800">{s.name}</span>
                <span className="block truncate text-[13px] text-slate-500">{s.category} · {formatIDR(s.price)} {INTERVAL_LABEL[s.interval ?? 'Bulanan']}</span>
              </span>
            </button>
          </div>
        ))}
        {needle && list.length === 0 && <p className="px-2 py-6 text-center text-sm text-slate-400">Tidak ada di katalog — pakai “Tambah” di atas.</p>}
        {!needle && <p className="pt-3 text-center text-xs text-slate-400">Cari di {SERVICES.length}+ layanan, atau ketik nama sendiri</p>}
      </div>
    </>
  );
}
