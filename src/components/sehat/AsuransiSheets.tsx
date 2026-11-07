'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Building2, ExternalLink, Globe, Loader2, Mail, MessageCircle, Phone, Search, Trash2, X } from 'lucide-react';
import {
  CLAIM_STEPS,
  COST_SUBS,
  healthService,
  PERIODS,
  POLICY_KINDS,
  type Claim,
  type ClaimStatus,
  type Policy,
  type PolicyInput,
  type PolicyKind,
  type PolicyPeriod,
} from '@/lib/health';
import { INSURERS, insurerByKey, prettyPhone, telHref, waHref, type Insurer } from '@/lib/insurers';
import { newRequestId } from '@/lib/meals';
import { cn, formatIDR } from '@/lib/utils';

export const inputCls =
  'w-full rounded-xl bg-slate-100 px-3 py-2.5 text-[14px] font-semibold text-slate-800 outline-none placeholder:font-medium placeholder:text-slate-400 focus:ring-2 focus:ring-teal-300 dark:bg-slate-800 dark:text-slate-100';
const digits = (s: string) => Number(s.replace(/\D/g, '')) || 0;
const fmt = (n: number) => (n ? new Intl.NumberFormat('id-ID').format(n) : '');

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11.5px] text-slate-400">{hint}</span> : null}
    </label>
  );
}

export function MoneyInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] font-bold text-slate-400">
        Rp
      </span>
      <input
        inputMode="numeric"
        value={fmt(digits(value))}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 11))}
        placeholder={placeholder ?? '0'}
        className={cn(inputCls, 'pl-10')}
      />
    </div>
  );
}

export function InsurerTile({ insurer, name, size = 44 }: { insurer: Insurer | null; name: string; size?: number }) {
  const initials =
    insurer?.initials ??
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  if (insurer?.logo)
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70"
        style={{ width: size, height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ikon kecil statis di /public, export statis */}
        <img src={insurer.logo} alt="" className="object-contain" style={{ width: size * 0.74, height: size * 0.74 }} />
      </span>
    );
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-2xl font-black text-white shadow-sm',
        insurer?.color ?? 'bg-teal-600',
      )}
      style={{ width: size, height: size, fontSize: size * (initials.length > 2 ? 0.26 : 0.32) }}
      aria-hidden
    >
      {initials || '?'}
    </span>
  );
}

export function SheetShell({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  return createPortal(
    <motion.div
      className="fixed inset-0 z-[85] flex items-end justify-center sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <button
        type="button"
        aria-label="Tutup"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:max-w-[500px] sm:rounded-[28px] dark:bg-slate-900"
        initial={reduce ? { opacity: 0 } : { y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      >
        <div className="flex shrink-0 items-center justify-between px-5 pb-2 pt-4">
          <h2 className="text-[17px] font-black text-slate-900 dark:text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-4">{children}</div>
        {footer ? (
          <div className="flex shrink-0 items-center gap-2 border-t border-slate-100 px-5 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3 dark:border-slate-800">
            {footer}
          </div>
        ) : null}
      </motion.div>
    </motion.div>,
    document.body,
  );
}

export function PrimaryButton({
  busy,
  disabled,
  onClick,
  children,
}: {
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={busy || disabled}
      onClick={onClick}
      className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-[15px] font-bold text-white shadow-lg shadow-emerald-500/25 disabled:opacity-60"
    >
      {busy ? <Loader2 size={18} className="animate-spin" /> : null}
      {children}
    </button>
  );
}

function AccountSelect({
  accounts,
  value,
  onChange,
}: {
  accounts: { id: string; name: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  if (!accounts.length)
    return <p className="text-[12.5px] text-slate-500">Tambah rekening Rupiah dulu supaya bisa dicatat.</p>;
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Rekening" className={inputCls}>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </select>
  );
}
function Err({ msg }: { msg: string }) {
  return msg ? (
    <p className="rounded-2xl bg-rose-50 px-3.5 py-2.5 text-[13px] font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
      {msg}
    </p>
  ) : null;
}
function Chips<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i) => (
        <button
          key={i.id}
          type="button"
          onClick={() => onChange(i.id)}
          className={cn(
            'rounded-full px-3 py-1.5 text-[13px] font-bold transition-colors',
            value === i.id
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
          )}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

// ── Catat biaya kesehatan ──────────────────────────────────────────────────
export function CostSheet({
  accounts,
  today,
  onClose,
  onSaved,
}: {
  accounts: { id: string; name: string }[];
  today: string;
  onClose: () => void;
  onSaved: (m: string) => void;
}) {
  const rid = useRef(newRequestId());
  const [amount, setAmount] = useState('');
  const [sub, setSub] = useState<string>('Obat');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(today);
  const [acc, setAcc] = useState(accounts[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    if (!digits(amount)) return setErr('Isi nominal biayanya.');
    if (!acc) return setErr('Pilih rekening.');
    setBusy(true);
    setErr('');
    try {
      await healthService.addCost({
        request_id: rid.current,
        amount: digits(amount),
        sub,
        note,
        account_id: acc,
        date,
      });
      onSaved(`${formatIDR(digits(amount))} dicatat sebagai biaya kesehatan.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menyimpan.');
      setBusy(false);
    }
  };
  return (
    <SheetShell
      title="Catat biaya kesehatan"
      onClose={onClose}
      footer={
        <PrimaryButton busy={busy} onClick={() => void save()}>
          Simpan biaya
        </PrimaryButton>
      }
    >
      <Err msg={err} />
      <Field label="Nominal">
        <MoneyInput value={amount} onChange={setAmount} />
      </Field>
      <div>
        <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-slate-400">Untuk</span>
        <Chips items={COST_SUBS.map((s) => ({ id: s, label: s }))} value={sub} onChange={setSub} />
      </div>
      <Field label="Keterangan (opsional)">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={120}
          placeholder="mis. Obat flu di apotek"
          className={inputCls}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Tanggal">
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Dari rekening">
          <AccountSelect accounts={accounts} value={acc} onChange={setAcc} />
        </Field>
      </div>
      <p className="text-[12px] text-slate-500 dark:text-slate-400">
        Masuk ke Transaksi sebagai pengeluaran kategori Kesehatan, dan saldo rekeningnya ikut berkurang.
      </p>
    </SheetShell>
  );
}

// ── Pilih perusahaan asuransi ──────────────────────────────────────────────
function InsurerPicker({
  onPick,
  onClose,
}: {
  onPick: (i: Insurer | null, name?: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const list = useMemo(() => INSURERS.filter((i) => i.name.toLowerCase().includes(q.trim().toLowerCase())), [q]);
  return (
    <SheetShell title="Pilih asuransimu" onClose={onClose}>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari asuransi"
          className={cn(inputCls, 'pl-9')}
        />
      </div>
      <div className="space-y-1">
        {list.map((i) => (
          <button
            key={i.key}
            type="button"
            onClick={() => onPick(i)}
            className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <InsurerTile insurer={i} name={i.name} size={40} />
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-bold text-slate-800 dark:text-slate-100">{i.name}</span>
              <span className="block text-[12px] text-slate-500">{i.tags.join(' · ')}</span>
            </span>
          </button>
        ))}
        {q.trim() ? (
          <button
            type="button"
            onClick={() => onPick(null, q.trim())}
            className="w-full rounded-2xl bg-slate-50 p-3 text-left text-[13px] font-bold text-teal-700 dark:bg-slate-800 dark:text-teal-300"
          >
            + Pakai “{q.trim()}”
          </button>
        ) : null}
      </div>
    </SheetShell>
  );
}

// ── Tambah / ubah polis ────────────────────────────────────────────────────
export function PolicySheet({
  policy,
  preset,
  accounts,
  onClose,
  onSaved,
}: {
  policy?: Policy | null;
  preset?: Insurer | null;
  accounts: { id: string; name: string }[];
  onClose: () => void;
  onSaved: (m: string) => void;
}) {
  const [insurer, setInsurer] = useState<Insurer | null>(policy ? insurerByKey(policy.insurer_key) : (preset ?? null));
  const [insurerName, setInsurerName] = useState(policy?.insurer_name ?? preset?.name ?? '');
  const [picking, setPicking] = useState(false);
  const [kind, setKind] = useState<PolicyKind>(policy?.kind ?? (preset?.key === 'bpjs' ? 'kesehatan' : 'kesehatan'));
  const [product, setProduct] = useState(policy?.product ?? (preset?.key === 'bpjs' ? 'JKN' : ''));
  const [policyNo, setPolicyNo] = useState(policy?.policy_no ?? '');
  const [premium, setPremium] = useState(policy?.premium ? String(policy.premium) : '');
  const [period, setPeriod] = useState<PolicyPeriod>(policy?.period ?? 'bulanan');
  const [nextDue, setNextDue] = useState(policy?.next_due ?? '');
  const [coverage, setCoverage] = useState(policy?.coverage ? String(policy.coverage) : '');
  const [acc, setAcc] = useState(policy?.account_id ?? accounts[0]?.id ?? '');
  const [callCenter, setCallCenter] = useState(policy?.call_center ?? '');
  const [claimNote, setClaimNote] = useState(policy?.claim_note ?? '');
  const [hospitals, setHospitals] = useState(policy?.hospitals_note ?? '');
  const [note, setNote] = useState(policy?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);

  const save = async () => {
    if (!insurerName.trim()) return setErr('Pilih asuransinya dulu.');
    setBusy(true);
    setErr('');
    const body: PolicyInput = {
      insurer_key: insurer?.key ?? null,
      insurer_name: insurerName.trim(),
      kind,
      product: product.trim() || null,
      policy_no: policyNo.trim() || null,
      premium: digits(premium) || null,
      period,
      next_due: nextDue || null,
      coverage: digits(coverage) || null,
      account_id: acc || null,
      call_center: callCenter.trim() || null,
      claim_note: claimNote.trim() || null,
      hospitals_note: hospitals.trim() || null,
      note: note.trim() || null,
    };
    try {
      if (policy) await healthService.updatePolicy(policy.id, body);
      else await healthService.addPolicy(body);
      onSaved(policy ? 'Polis diperbarui.' : `${insurerName.trim()} ditambahkan ke Polisku.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menyimpan.');
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!policy) return;
    setBusy(true);
    try {
      await healthService.removePolicy(policy.id);
      onSaved('Polis dihapus. Riwayat bayar premi tetap ada di Transaksi.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menghapus.');
      setBusy(false);
    }
  };

  if (picking)
    return (
      <InsurerPicker
        onClose={() => setPicking(false)}
        onPick={(i, name) => {
          setInsurer(i);
          setInsurerName(i?.name ?? name ?? '');
          if (i?.key === 'bpjs') {
            setKind('kesehatan');
            if (!product) setProduct('JKN');
          }
          setPicking(false);
        }}
      />
    );

  return (
    <SheetShell
      title={policy ? 'Ubah polis' : 'Tambah asuransi'}
      onClose={onClose}
      footer={
        <>
          {policy ? (
            confirmDel ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void remove()}
                className="flex h-12 items-center gap-1.5 rounded-2xl bg-rose-600 px-4 text-[14px] font-bold text-white"
              >
                <Trash2 size={16} /> Yakin hapus
              </button>
            ) : (
              <button
                type="button"
                aria-label="Hapus polis"
                onClick={() => setConfirmDel(true)}
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300"
              >
                <Trash2 size={18} />
              </button>
            )
          ) : null}
          <PrimaryButton busy={busy} onClick={() => void save()}>
            {policy ? 'Simpan perubahan' : 'Simpan polis'}
          </PrimaryButton>
        </>
      }
    >
      <Err msg={err} />
      <Field label="Asuransi">
        <button
          type="button"
          onClick={() => setPicking(true)}
          className={cn(inputCls, 'flex items-center gap-3 text-left')}
        >
          {insurerName ? <InsurerTile insurer={insurer} name={insurerName} size={30} /> : null}
          <span className={cn('flex-1', !insurerName && 'font-medium text-slate-400')}>
            {insurerName || 'Pilih asuransimu'}
          </span>
        </button>
      </Field>
      <div>
        <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-slate-400">Jenis</span>
        <Chips items={POLICY_KINDS} value={kind} onChange={setKind} />
      </div>
      <Field label="Produk">
        <input
          value={product}
          onChange={(e) => setProduct(e.target.value)}
          maxLength={80}
          placeholder="Seperti tertulis di polis"
          className={inputCls}
        />
      </Field>
      <Field label="Nomor polis atau kartu" hint="Hanya kamu yang bisa melihatnya.">
        <input
          value={policyNo}
          onChange={(e) => setPolicyNo(e.target.value)}
          maxLength={60}
          placeholder="Boleh dikosongkan"
          className={inputCls}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Premi">
          <MoneyInput value={premium} onChange={setPremium} />
        </Field>
        <Field label="Dibayar">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as PolicyPeriod)}
            aria-label="Periode premi"
            className={inputCls}
          >
            {PERIODS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Jatuh tempo berikutnya">
          <input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Bayar dari">
          <AccountSelect accounts={accounts} value={acc} onChange={setAcc} />
        </Field>
      </div>
      <Field label="Uang pertanggungan (opsional)">
        <MoneyInput value={coverage} onChange={setCoverage} placeholder="mis. 500.000.000" />
      </Field>
      <details
        className="rounded-2xl bg-slate-50 p-3.5 dark:bg-slate-800/50"
        open={Boolean(policy?.call_center || policy?.claim_note)}
      >
        <summary className="cursor-pointer text-[13px] font-bold text-slate-700 dark:text-slate-200">
          Catatan pribadi (agen, cara klaim, RS langganan)
        </summary>
        <div className="mt-3 space-y-3">
          <Field
            label="Call center / agen"
            hint={insurer?.phone ? `Kosongkan untuk pakai nomor resmi ${prettyPhone(insurer.phone)}.` : undefined}
          >
            <input
              value={callCenter}
              onChange={(e) => setCallCenter(e.target.value)}
              maxLength={80}
              placeholder="mis. Agen Rina 0812…"
              className={cn(inputCls, 'bg-white dark:bg-slate-900')}
            />
          </Field>
          <Field label="Cara klaim versi polismu">
            <textarea
              value={claimNote}
              onChange={(e) => setClaimNote(e.target.value)}
              maxLength={600}
              rows={3}
              placeholder="mis. Cashless pakai kartu, reimburse maks 30 hari lewat aplikasi"
              className={cn(inputCls, 'bg-white dark:bg-slate-900')}
            />
          </Field>
          <Field label="RS rekanan langganan">
            <input
              value={hospitals}
              onChange={(e) => setHospitals(e.target.value)}
              maxLength={300}
              placeholder="mis. RS Siloam Kebon Jeruk"
              className={cn(inputCls, 'bg-white dark:bg-slate-900')}
            />
          </Field>
          <Field label="Catatan lain">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              className={cn(inputCls, 'bg-white dark:bg-slate-900')}
            />
          </Field>
        </div>
      </details>
    </SheetShell>
  );
}

// ── Bayar premi ────────────────────────────────────────────────────────────
export function PaySheet({
  policy,
  accounts,
  onClose,
  onSaved,
}: {
  policy: Policy;
  accounts: { id: string; name: string }[];
  onClose: () => void;
  onSaved: (m: string) => void;
}) {
  const rid = useRef(newRequestId());
  const [amount, setAmount] = useState(policy.premium ? String(policy.premium) : '');
  const [acc, setAcc] = useState(policy.account_id ?? accounts[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pay = async () => {
    if (!digits(amount)) return setErr('Isi nominal preminya.');
    if (!acc) return setErr('Pilih rekening.');
    setBusy(true);
    setErr('');
    try {
      const r = await healthService.payPremium(policy.id, {
        request_id: rid.current,
        account_id: acc,
        amount: digits(amount),
      });
      onSaved(
        r.duplicate
          ? 'Pembayaran ini sudah tercatat.'
          : `Premi ${formatIDR(digits(amount))} tercatat${r.next_due ? ` · jatuh tempo berikutnya ${r.next_due.split('-').reverse().join('/')}` : ''}.`,
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal mencatat.');
      setBusy(false);
    }
  };
  return (
    <SheetShell
      title={`Bayar premi · ${policy.insurer_name}`}
      onClose={onClose}
      footer={
        <PrimaryButton busy={busy} onClick={() => void pay()}>
          Catat pembayaran
        </PrimaryButton>
      }
    >
      <Err msg={err} />
      <Field label="Nominal premi">
        <MoneyInput value={amount} onChange={setAmount} />
      </Field>
      <Field label="Dari rekening">
        <AccountSelect accounts={accounts} value={acc} onChange={setAcc} />
      </Field>
      <p className="text-[12px] text-slate-500 dark:text-slate-400">
        Dicatat sebagai pengeluaran Kesehatan › Asuransi, saldo berkurang, dan jatuh temponya maju satu periode.
      </p>
    </SheetShell>
  );
}

// ── Klaim ──────────────────────────────────────────────────────────────────
export function ClaimSheet({
  claim,
  policies,
  accounts,
  today,
  onClose,
  onSaved,
}: {
  claim?: Claim | null;
  policies: Policy[];
  accounts: { id: string; name: string }[];
  today: string;
  onClose: () => void;
  onSaved: (m: string) => void;
}) {
  const [title, setTitle] = useState(claim?.title ?? '');
  const [amount, setAmount] = useState(claim ? String(claim.amount) : '');
  const [policyId, setPolicyId] = useState(claim?.policy_id ?? policies[0]?.id ?? '');
  const [date, setDate] = useState(claim?.submitted_at ?? today);
  const [note, setNote] = useState(claim?.note ?? '');
  const [status, setStatus] = useState<ClaimStatus>(claim?.status ?? 'diajukan');
  const [approved, setApproved] = useState(claim?.approved_amount ? String(claim.approved_amount) : '');
  const [acc, setAcc] = useState(accounts[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const willRecord = Boolean(claim) && status === 'cair' && !claim?.recorded;

  const save = async () => {
    setBusy(true);
    setErr('');
    try {
      if (!claim) {
        if (!title.trim()) throw new Error('Tulis untuk apa klaimnya.');
        if (!digits(amount)) throw new Error('Isi nominal yang diklaim.');
        await healthService.addClaim({
          title: title.trim(),
          amount: digits(amount),
          policy_id: policyId || null,
          submitted_at: date,
          note,
        });
        onSaved('Klaim dicatat. Ubah statusnya saat ada kabar dari asuransi.');
      } else {
        const r = await healthService.updateClaim(claim.id, {
          status,
          approved_amount: digits(approved) || null,
          note,
          ...(willRecord ? { account_id: acc || null } : {}),
        });
        onSaved(
          r.tx_id
            ? `Klaim cair · ${formatIDR(digits(approved) || claim.amount)} masuk sebagai pemasukan.`
            : 'Status klaim diperbarui.',
        );
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menyimpan.');
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!claim) return;
    setBusy(true);
    try {
      const r = await healthService.removeClaim(claim.id);
      onSaved(r.tx_kept ? 'Klaim dihapus. Pemasukannya tetap ada di Transaksi.' : 'Klaim dihapus.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menghapus.');
      setBusy(false);
    }
  };
  return (
    <SheetShell
      title={claim ? claim.title : 'Catat klaim'}
      onClose={onClose}
      footer={
        <>
          {claim ? (
            confirmDel ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void remove()}
                className="flex h-12 items-center gap-1.5 rounded-2xl bg-rose-600 px-4 text-[14px] font-bold text-white"
              >
                <Trash2 size={16} /> Yakin hapus
              </button>
            ) : (
              <button
                type="button"
                aria-label="Hapus klaim"
                onClick={() => setConfirmDel(true)}
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300"
              >
                <Trash2 size={18} />
              </button>
            )
          ) : null}
          <PrimaryButton busy={busy} onClick={() => void save()}>
            {claim ? (willRecord ? 'Simpan & catat pemasukan' : 'Simpan status') : 'Catat klaim'}
          </PrimaryButton>
        </>
      }
    >
      <Err msg={err} />
      {!claim ? (
        <>
          <Field label="Untuk apa">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="mis. Rawat inap RS, kacamata, gigi"
              className={inputCls}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Nominal diklaim">
              <MoneyInput value={amount} onChange={setAmount} />
            </Field>
            <Field label="Tanggal diajukan">
              <input
                type="date"
                value={date}
                max={today}
                onChange={(e) => setDate(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Polis">
            <select
              value={policyId}
              onChange={(e) => setPolicyId(e.target.value)}
              aria-label="Polis"
              className={inputCls}
            >
              <option value="">Tanpa polis</option>
              {policies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.insurer_name}
                  {p.product ? ` · ${p.product}` : ''}
                </option>
              ))}
            </select>
          </Field>
        </>
      ) : (
        <>
          <p className="text-[13px] text-slate-500 dark:text-slate-400">
            Diklaim {formatIDR(claim.amount)}
            {claim.insurer_name ? ` · ${claim.insurer_name}` : ''} · diajukan{' '}
            {claim.submitted_at.split('-').reverse().join('/')}
          </p>
          <div>
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-slate-400">Status</span>
            <Chips
              items={[...CLAIM_STEPS, { id: 'ditolak' as ClaimStatus, label: 'Ditolak' }]}
              value={status}
              onChange={setStatus}
            />
          </div>
          {status === 'disetujui' || status === 'cair' ? (
            <Field label="Nominal disetujui" hint="Kosongkan kalau sama dengan yang diklaim.">
              <MoneyInput value={approved} onChange={setApproved} placeholder={fmt(claim.amount)} />
            </Field>
          ) : null}
          {willRecord ? (
            <Field label="Uang masuk ke rekening">
              <AccountSelect accounts={accounts} value={acc} onChange={setAcc} />
            </Field>
          ) : null}
          {claim.recorded ? (
            <p className="rounded-2xl bg-emerald-50 px-3.5 py-2.5 text-[13px] font-semibold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
              Uang klaim sudah tercatat sebagai pemasukan.
            </p>
          ) : null}
        </>
      )}
      <Field label="Catatan (opsional)">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          placeholder="mis. nomor klaim, dokumen yang kurang"
          className={inputCls}
        />
      </Field>
    </SheetShell>
  );
}

// ── Detail perusahaan asuransi ─────────────────────────────────────────────
export function InsurerSheet({
  insurer,
  onClose,
  onMine,
}: {
  insurer: Insurer;
  onClose: () => void;
  onMine: () => void;
}) {
  const host = (u: string) => u.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const actions = [
    insurer.phone
      ? { icon: Phone, label: 'Telepon', sub: prettyPhone(insurer.phone), href: telHref(insurer.phone) }
      : null,
    insurer.whatsapp
      ? { icon: MessageCircle, label: 'WhatsApp', sub: prettyPhone(insurer.whatsapp), href: waHref(insurer.whatsapp) }
      : null,
    insurer.email ? { icon: Mail, label: 'Email', sub: insurer.email, href: `mailto:${insurer.email}` } : null,
    { icon: Globe, label: 'Situs', sub: host(insurer.website), href: insurer.website },
  ].filter((a): a is { icon: typeof Phone; label: string; sub: string; href: string } => a !== null);
  return (
    <SheetShell
      title={insurer.name}
      onClose={onClose}
      footer={<PrimaryButton onClick={onMine}>+ Ini asuransiku</PrimaryButton>}
    >
      <div className={cn('-mx-5 -mt-1 flex items-center gap-3 px-5 py-4 text-white', insurer.color)}>
        <InsurerTile insurer={insurer} name={insurer.name} size={56} />
        <div className="flex flex-wrap gap-1.5">
          {insurer.tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-white/20 px-2.5 py-0.5 text-[12px] font-bold text-white backdrop-blur"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {actions.map((a) => (
          <a
            key={a.label}
            href={a.href}
            target={a.href.startsWith('http') ? '_blank' : undefined}
            rel="noreferrer"
            className="flex flex-col items-center gap-1 rounded-2xl bg-slate-50 px-2 py-3 text-center ring-1 ring-slate-100 hover:bg-slate-100 dark:bg-slate-800/60 dark:ring-slate-800"
          >
            <a.icon size={19} className="text-teal-600 dark:text-teal-300" />
            <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100">{a.label}</span>
            <span className="w-full truncate text-[11px] text-slate-500">{a.sub}</span>
          </a>
        ))}
      </div>
      {insurer.phoneNote || insurer.hours || insurer.whatsappNote ? (
        <div className="space-y-1 text-[13px] text-slate-600 dark:text-slate-300">
          {insurer.phoneNote ? <p>📞 {insurer.phoneNote}</p> : null}
          {insurer.hours ? <p>🕘 {insurer.hours}</p> : null}
          {insurer.whatsappNote ? <p>💬 WhatsApp: {insurer.whatsappNote}</p> : null}
        </div>
      ) : null}
      {insurer.claimUrl || insurer.hospitalsUrl ? (
        <div className="space-y-2">
          {insurer.claimUrl ? (
            <a
              href={insurer.claimUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3.5 dark:bg-slate-800/60"
            >
              <ExternalLink size={18} className="text-teal-600" />
              <span className="flex-1 text-[14px] font-bold text-slate-800 dark:text-slate-100">
                Cara & formulir klaim (resmi)
              </span>
            </a>
          ) : null}
          {insurer.hospitalsUrl ? (
            <a
              href={insurer.hospitalsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3.5 dark:bg-slate-800/60"
            >
              <Building2 size={18} className="text-teal-600" />
              <span className="flex-1 text-[14px] font-bold text-slate-800 dark:text-slate-100">
                Daftar rumah sakit rekanan
              </span>
            </a>
          ) : null}
        </div>
      ) : null}
      {insurer.facts?.length ? (
        <div>
          <h3 className="mb-2 text-[14px] font-black text-slate-900 dark:text-white">Angka yang dipublikasikan</h3>
          <div className="grid grid-cols-2 gap-2">
            {insurer.facts.map((f) => (
              <div key={f.label} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
                <div className="text-[11.5px] text-slate-500">{f.label}</div>
                <div className="text-[17px] font-black text-slate-900 dark:text-white">{f.value}</div>
                {f.note ? <div className="mt-0.5 text-[11px] text-slate-400">{f.note}</div> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {insurer.notes?.length ? (
        <ul className="space-y-2">
          {insurer.notes.map((n) => (
            <li key={n} className="relative pl-4 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
              <span className="absolute left-0 top-[0.6em] h-1.5 w-1.5 rounded-full bg-teal-500" aria-hidden />
              {n}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-[11.5px] leading-relaxed text-slate-400">
        {insurer.readNote
          ? insurer.readNote
          : insurer.verified
            ? `Dibaca ${insurer.readAt?.split('-').reverse().join('/')} dari ${insurer.source}. Bisa berubah sewaktu-waktu — cek situs resminya bila ragu.`
            : 'Kontak belum kami verifikasi dari situs resminya. Lihat nomor di kartu polismu atau situs resmi, lalu simpan di catatan polismu.'}
      </p>
    </SheetShell>
  );
}
