'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, Check, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { cn, formatIDR, toLocalDateString } from '@/lib/utils';
import type { Account } from '@/lib/services/accountService';
import { subscriptionService } from '@/lib/services/subscriptionService';
import {
  SUB_CATALOG,
  SUB_CATEGORIES,
  type CatalogEntry,
  type SubCategory,
  type SubCycle,
} from '@/lib/subscriptionCatalog';
import { catalogFor, CYCLE_LABEL, nextCharge, type Subscription, type SubStatus } from '@/lib/subscriptions';
import { SubLogo } from '@/components/langganan/SubLogo';

// Tambah/ubah langganan (Langgananku). Baru: pilih dari katalog (logo &
// perkiraan harga otomatis) atau tulis sendiri → isi detail. Dipakai web
// (Modal) & app HP (BottomSheet); kelas dark: untuk /app, web pakai .web-dark.

const digits = (s: string) => s.replace(/\D/g, '').slice(0, 13);
const group = (s: string) => (s ? Number(s).toLocaleString('id-ID') : '');
const CYCLES: SubCycle[] = ['bulanan', 'tahunan', '3bulan', 'mingguan'];

export function SubEditor({
  sub,
  accounts,
  onDone,
}: {
  sub?: Subscription | null;
  accounts: Account[];
  onDone: (msg: string) => void;
}) {
  const [picked, setPicked] = useState<CatalogEntry | 'custom' | null>(sub ? (catalogFor(sub) ?? 'custom') : null);
  const [q, setQ] = useState('');
  if (!picked) return <CatalogPicker q={q} setQ={setQ} onPick={setPicked} />;
  return (
    <SubForm
      key={typeof picked === 'string' ? picked : picked.key}
      sub={sub}
      entry={picked === 'custom' ? null : picked}
      customName={picked === 'custom' && !sub ? q : ''}
      accounts={accounts}
      onBack={sub ? undefined : () => setPicked(null)}
      onDone={onDone}
    />
  );
}

function CatalogPicker({
  q,
  setQ,
  onPick,
}: {
  q: string;
  setQ: (v: string) => void;
  onPick: (e: CatalogEntry | 'custom') => void;
}) {
  const [cat, setCat] = useState<SubCategory | 'Semua'>('Semua');
  const needle = q.trim().toLowerCase();
  const list = SUB_CATALOG.filter(
    (c) =>
      (cat === 'Semua' || c.category === cat) &&
      (!needle || c.name.toLowerCase().includes(needle) || c.key.includes(needle)),
  );
  const cats = SUB_CATEGORIES.filter((c) => SUB_CATALOG.some((e) => e.category === c));
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 dark:bg-slate-800">
        <Search size={17} className="shrink-0 text-slate-400" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Netflix, Spotify, IndiHome, PLN…"
          aria-label="Cari layanan"
          className="min-w-0 flex-1 bg-transparent fs-15 font-semibold text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-400 dark:text-white"
        />
      </label>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 no-scrollbar">
        {(['Semua', ...cats] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 fs-12 font-bold',
              cat === c
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
            )}
          >
            {c}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onPick('custom')}
        className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 px-3 py-3 text-left hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800">
          <Plus size={20} />
        </span>
        <span className="min-w-0">
          <span className="block truncate fs-14 font-bold text-slate-900 dark:text-white">
            {needle ? `Tambah “${q.trim()}” sendiri` : 'Layanan lain (tulis sendiri)'}
          </span>
          <span className="block fs-12 text-slate-500 dark:text-slate-400">Gym, arisan, sewa, iuran, apa saja</span>
        </span>
      </button>
      <ul className="max-h-[52vh] space-y-1 overflow-y-auto pr-1">
        {list.map((c) => (
          <li key={c.key}>
            <button
              type="button"
              onClick={() => onPick(c)}
              className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <SubLogo name={c.name} domain={c.domain} color={c.color} size={44} />
              <span className="min-w-0 flex-1">
                <span className="block truncate fs-14 font-bold text-slate-900 dark:text-white">{c.name}</span>
                <span className="block truncate fs-12 text-slate-500 dark:text-slate-400">
                  {c.category} · mulai ±{formatIDR(c.price)}
                  {c.cycle === 'tahunan' ? '/thn' : '/bln'}
                </span>
              </span>
            </button>
          </li>
        ))}
        {list.length === 0 && (
          <li className="py-6 text-center fs-13 text-slate-500">
            Tidak ada di katalog — pakai “tulis sendiri” di atas.
          </li>
        )}
      </ul>
      <p className="px-1 fs-11 text-slate-400">Harga katalog = perkiraan paket umum, bisa diubah sesuai tagihanmu.</p>
    </div>
  );
}

function SubForm({
  sub,
  entry,
  customName,
  accounts,
  onBack,
  onDone,
}: {
  sub?: Subscription | null;
  entry: CatalogEntry | null;
  customName: string;
  accounts: Account[];
  onBack?: () => void;
  onDone: (msg: string) => void;
}) {
  const today = toLocalDateString();
  const [name, setName] = useState(sub?.name ?? entry?.name ?? customName);
  const [amount, setAmount] = useState(sub ? String(Math.round(sub.amount)) : entry ? String(entry.price) : '');
  const [cycle, setCycle] = useState<SubCycle>(sub?.cycle ?? entry?.cycle ?? 'bulanan');
  const [anchor, setAnchor] = useState(sub?.anchorDate ?? today);
  const [category, setCategory] = useState<SubCategory>(sub?.category ?? entry?.category ?? 'Lainnya');
  const [accountId, setAccountId] = useState(sub?.accountId ?? '');
  const [status, setStatus] = useState<SubStatus>(sub?.status ?? 'aktif');
  const [trialEnd, setTrialEnd] = useState(sub?.trialEnd ?? '');
  const [note, setNote] = useState(sub?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const next = useMemo(() => (anchor ? nextCharge(anchor, cycle, today) : ''), [anchor, cycle, today]);
  const nextLabel = next
    ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
        new Date(`${next}T00:00:00Z`),
      )
    : '';
  const cashAccounts = accounts.filter((a) => a.type !== 'Investment Account');

  const save = async () => {
    if (!name.trim() || busy) return;
    if (status === 'coba' && !trialEnd) {
      setError('Isi kapan masa coba gratisnya habis.');
      return;
    }
    setBusy(true);
    setError('');
    const input = {
      name: name.trim(),
      serviceKey: entry?.key ?? null,
      domain: entry?.domain ?? null,
      category,
      amount: Number(amount || '0'),
      cycle,
      anchorDate: anchor,
      accountId: accountId || null,
      status,
      trialEnd: status === 'coba' ? trialEnd : null,
      note: note.trim(),
    };
    try {
      if (sub) await subscriptionService.update(sub.id, input);
      else await subscriptionService.create(input);
      onDone(sub ? 'Perubahan disimpan.' : `${input.name} masuk Langgananku.`);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Gagal menyimpan.');
      setBusy(false);
    }
  };

  const setStatusNow = async (st: SubStatus) => {
    if (!sub) return;
    setBusy(true);
    try {
      await subscriptionService.update(sub.id, { status: st });
      onDone(st === 'batal' ? `${sub.name} ditandai berhenti — tidak dihitung lagi.` : `${sub.name} aktif lagi.`);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Gagal mengubah status.');
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!sub) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    try {
      await subscriptionService.remove(sub.id);
      onDone('Langganan dihapus.');
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Gagal menghapus.');
      setBusy(false);
    }
  };

  const label = 'mb-1.5 block fs-12 font-semibold text-slate-500 dark:text-slate-400';
  const input =
    'w-full rounded-2xl bg-slate-100 px-4 py-3 fs-15 font-semibold text-slate-900 outline-none ring-2 ring-transparent placeholder:font-medium placeholder:text-slate-400 focus:bg-white focus:ring-indigo-500 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-900';
  const chip = (on: boolean) =>
    cn(
      'rounded-full px-3 py-1.5 fs-12 font-bold transition-colors',
      on
        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
    );

  return (
    <div className="space-y-4">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 fs-13 font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400"
        >
          <ArrowLeft size={15} /> Pilih layanan lain
        </button>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-2xl bg-rose-50 px-4 py-3 fs-13 font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
        >
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <SubLogo name={name || '?'} domain={entry?.domain} color={entry?.color} size={56} />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nama langganan"
          aria-label="Nama langganan"
          maxLength={60}
          className={cn(input, 'fs-17 font-bold')}
          autoFocus={!entry && !sub}
        />
      </div>

      <div className="rounded-3xl bg-slate-50 p-4 text-center dark:bg-slate-800/60">
        <span className="fs-12 font-semibold text-slate-500 dark:text-slate-400">Harga per tagihan</span>
        <label className="mt-1 flex items-baseline justify-center gap-1.5">
          <span className="fs-18 font-bold text-slate-400">Rp</span>
          <input
            value={group(amount)}
            onChange={(e) => setAmount(digits(e.target.value))}
            inputMode="numeric"
            placeholder="0"
            aria-label="Harga"
            className="w-[60%] bg-transparent text-center fsh-34 font-extrabold tabular-nums text-slate-900 outline-none dark:text-white"
          />
        </label>
        {entry && !sub && <p className="fs-11 text-slate-400">Perkiraan paket umum — sesuaikan dengan tagihanmu.</p>}
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {CYCLES.map((c) => (
            <button key={c} type="button" onClick={() => setCycle(c)} className={chip(cycle === c)}>
              {CYCLE_LABEL[c]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={label}>Tanggal tagih</span>
          <input
            type="date"
            value={anchor}
            onChange={(e) => e.target.value && setAnchor(e.target.value)}
            className={input}
          />
        </label>
        <label className="block">
          <span className={label}>Dibayar dari</span>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={input}>
            <option value="">Belum dipilih</option>
            {cashAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {nextLabel && status !== 'batal' && (
        <p className="-mt-2 px-1 fs-12 font-semibold text-indigo-600 dark:text-indigo-400">
          {next === today ? 'Ditagih hari ini.' : `Tagihan berikutnya ${nextLabel} — diingatkan sehari sebelumnya.`}
        </p>
      )}

      <div>
        <span className={label}>Status</span>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setStatus('aktif')} className={chip(status === 'aktif')}>
            Aktif berbayar
          </button>
          <button type="button" onClick={() => setStatus('coba')} className={chip(status === 'coba')}>
            Masa coba gratis
          </button>
        </div>
        {status === 'coba' && (
          <label className="mt-2 block">
            <span className={label}>Masa coba habis</span>
            <input
              type="date"
              value={trialEnd}
              min={today}
              onChange={(e) => setTrialEnd(e.target.value)}
              className={input}
            />
            <span className="mt-1 block px-1 fs-11 text-slate-400">
              Diingatkan 2 hari sebelumnya, biar sempat batal kalau tidak mau lanjut.
            </span>
          </label>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={label}>Kategori</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as SubCategory)} className={input}>
            {SUB_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={label}>Catatan</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder="Paket, akun…"
            className={input}
          />
        </label>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={busy || !name.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 py-3.5 fs-15 font-bold text-white hover:bg-slate-800 disabled:opacity-40 dark:bg-indigo-600"
      >
        {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}{' '}
        {sub ? 'Simpan perubahan' : `Simpan${amount ? ` · ${formatIDR(Number(amount))}` : ''}`}
      </button>

      {sub && (
        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          {sub.status === 'batal' ? (
            <button type="button" onClick={() => setStatusNow('aktif')} disabled={busy} className={chip(false)}>
              Langganan lagi
            </button>
          ) : (
            <button type="button" onClick={() => setStatusNow('batal')} disabled={busy} className={chip(false)}>
              Sudah berhenti langganan
            </button>
          )}
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className={cn(
              'ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 fs-12 font-bold',
              confirmDelete
                ? 'bg-rose-500 text-white'
                : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
            )}
          >
            <Trash2 size={13} /> {confirmDelete ? 'Yakin hapus?' : 'Hapus'}
          </button>
        </div>
      )}
    </div>
  );
}
