'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Check, Coins, Loader2, MessageCircle, Plus, Share2, Users } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { accountService } from '@/lib/services/accountService';
import { debtRemaining, debtService, paidByDebt, type SplitResult } from '@/lib/services/debtService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { isCreditAccountType } from '@/lib/creditCard';
import { CATEGORY_TEMPLATE } from '@/lib/defaultCategories';
import { dueLabel } from '@/lib/debtDue';
import { cn, formatIDR, toLocalDateString } from '@/lib/utils';

// "Ingatkan via WA" lewat wa.me (tanpa API berbayar); Patungan = satu tagihan → piutang per orang, atomik di server.

const TONES = [
  { id: 'santai', label: 'Santai' },
  { id: 'sopan', label: 'Sopan' },
  { id: 'tegas', label: 'Tegas halus' },
] as const;
type Tone = (typeof TONES)[number]['id'];
const firstName = (s: string) => s.trim().split(/\s+/)[0] || s;
const cleanNote = (s?: string) => (s ?? '').replace(/^\[Patungan\]\s*/, '').trim();

export const reminderText = (tone: Tone, name: string, amount: number, note?: string) => {
  const n = firstName(name);
  const what = cleanNote(note);
  const rp = formatIDR(Math.round(amount));
  if (tone === 'santai')
    return `Halo ${n}! 😄 Mau ngingetin aja nih, yang ${what ? `buat ${what} ` : ''}${rp} kemarin. Kalau udah longgar, boleh ditransfer ya. Makasih banyak! 🙏`;
  if (tone === 'tegas')
    return `Halo ${n}, aku mau konfirmasi soal ${what ? `${what} ` : ''}sebesar ${rp} yang belum kembali. Bisa tolong dibayar minggu ini? Kabari aja kalau ada kendala ya. Terima kasih.`;
  return `Halo ${n}, semoga sehat selalu. Aku mau mengingatkan ${what ? `untuk ${what} ` : ''}sebesar ${rp}. Kalau sudah ada rezekinya, boleh ditransfer ya. Terima kasih banyak 🙏`;
};
const waUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

export function TagihView({ variant, onToast }: { variant: 'web' | 'app'; onToast: (m: string) => void }) {
  const [tx, setTx] = useState<Transaction[] | null>(null);
  const [error, setError] = useState('');
  const [tone, setTone] = useState<Tone>('sopan');
  const [split, setSplit] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [cicil, setCicil] = useState<{ id: string; value: string } | null>(null); // form nyicil yang terbuka
  const pathname = usePathname() ?? '';
  const isApp = pathname.startsWith('/app');

  useEffect(() => {
    let alive = true;
    const load = () =>
      transactionService
        .getUserTransactions('session')
        .then((v) => {
          if (alive) {
            setTx(v);
            setError('');
          }
        })
        .catch((e) => {
          if (alive) {
            setTx((p) => p ?? []);
            setError(e instanceof Error ? e.message : 'Gagal memuat piutang.');
          }
        });
    void load();
    const unsub = subscribeToCollectionChanges('transactions', load);
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  const open = useMemo(() => {
    const list = tx ?? [];
    const paid = paidByDebt(list);
    return list
      .filter((t) => t.type === 'debt' && t.category === 'Piutang')
      .map((t) => ({ t, left: debtRemaining(t, paid) }))
      .filter((x) => x.left > 0.5 && (x.t.currency || 'IDR') === 'IDR')
      .sort((a, b) => b.left - a.left);
  }, [tx]);
  const total = open.reduce((s, x) => s + x.left, 0);
  const people = new Set(open.map((x) => (x.t.lenderName || '').toLowerCase())).size;

  // amount < left = cicilan; server memotong nominal yang melebihi sisa & menandai lunas kalau habis.
  const settle = async (t: Transaction, left: number, amount = left) => {
    if (!t.id || busyId || amount <= 0) return;
    setBusyId(t.id);
    try {
      const r = await debtService.pay(t.id, { amount, date: toLocalDateString() });
      setCicil(null);
      onToast(
        r.settled
          ? `${t.lenderName || 'Piutang'} lunas — ${formatIDR(Math.round(r.paid))} masuk ke rekening.`
          : `Cicilan ${formatIDR(Math.round(r.paid))} dari ${t.lenderName || 'piutang'} tercatat. Sisa ${formatIDR(Math.round(r.remaining))}.`,
      );
    } catch (e) {
      onToast(e instanceof Error && e.message ? e.message : 'Gagal menandai lunas.');
    } finally {
      setBusyId('');
    }
  };

  const app = variant === 'app';
  const card = app
    ? 'rounded-3xl bg-white ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800'
    : 'rounded-[26px] bg-white ring-1 ring-slate-100';
  const body = split && (
    <SplitForm
      onDone={(m) => {
        setSplit(false);
        onToast(m);
      }}
    />
  );

  if (tx === null) return <div className="h-48 animate-pulse rounded-[28px] bg-slate-200/70 dark:bg-slate-800" />;

  return (
    <div className="space-y-4">
      {error && (
        <div
          role="alert"
          className="rounded-2xl bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
        >
          {error}
        </div>
      )}
      <section className="web-keep relative overflow-hidden rounded-[28px] bg-[radial-gradient(120%_140%_at_100%_0%,#0e7490_0%,#164e63_35%,#0b1220_80%)] p-5 text-white md:p-6">
        <p className="text-[13px] font-semibold text-white/60">Belum kembali</p>
        <p className="mt-1 text-[32px] font-extrabold leading-none tracking-tight tabular-nums md:text-[40px]">
          {formatIDR(Math.round(total))}
        </p>
        <p className="mt-2 text-[13px] text-white/60">
          {people ? `${people} orang berutang padamu` : 'Belum ada yang berutang padamu'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSplit(true)}
            className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-[13px] font-bold text-slate-900 hover:bg-white/90"
          >
            <Users size={15} /> Patungan
          </button>
          <Link
            href={isApp ? '/app/debts' : '/membership/kekayaan#hutang'}
            className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-white/20"
          >
            <Plus size={15} /> Catat piutang
          </Link>
        </div>
      </section>

      {open.length === 0 ? (
        <section className={cn(card, 'px-5 py-8 text-center')}>
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
            <Check size={24} />
          </span>
          <p className="mt-3 text-[14px] font-bold text-slate-900 dark:text-white">
            Semua piutang sudah kembali. Mantap!
          </p>
          <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
            Habis bayarin teman? Pakai Patungan biar langsung terbagi rata.
          </p>
        </section>
      ) : (
        <section className={cn(card, 'p-4')}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[15px] font-extrabold text-slate-900 dark:text-white">Ingatkan via WhatsApp</h3>
            <div
              className="flex gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800"
              role="radiogroup"
              aria-label="Nada pesan"
            >
              {TONES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={tone === t.id}
                  onClick={() => setTone(t.id)}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[11px] font-bold',
                    tone === t.id
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                      : 'text-slate-500 dark:text-slate-400',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
            {open.map(({ t, left }) => {
              const due = t.due ? dueLabel(t.due) : null;
              return (
                <li key={t.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-[15px] font-extrabold text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300">
                    {(t.lenderName || '?').charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-bold text-slate-900 dark:text-white">
                      {t.lenderName || 'Tanpa nama'}
                    </span>
                    <span
                      className={cn(
                        'block truncate text-[12px]',
                        due?.urgent
                          ? 'font-semibold text-rose-600 dark:text-rose-400'
                          : 'text-slate-500 dark:text-slate-400',
                      )}
                    >
                      {[cleanNote(t.note), due?.text].filter(Boolean).join(' · ') || 'Piutang'}
                    </span>
                  </span>
                  <span className="shrink-0 text-[14px] font-extrabold tabular-nums text-slate-900 dark:text-white">
                    {formatIDR(Math.round(left))}
                  </span>
                  <span className="flex w-full gap-2 sm:w-auto">
                    <a
                      href={waUrl(reminderText(tone, t.lenderName || '', left, t.note))}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-emerald-600 px-3 py-2 text-[12px] font-bold text-white hover:bg-emerald-700 sm:flex-none"
                    >
                      <MessageCircle size={14} /> Ingatkan
                    </a>
                    <button
                      type="button"
                      onClick={() => setCicil(cicil?.id === t.id ? null : { id: t.id!, value: '' })}
                      aria-expanded={cicil?.id === t.id}
                      className={cn(
                        'flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-bold sm:flex-none',
                        cicil?.id === t.id
                          ? 'bg-cyan-600 text-white'
                          : 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100 dark:bg-cyan-500/15 dark:text-cyan-300',
                      )}
                    >
                      <Coins size={14} /> Nyicil
                    </button>
                    <button
                      type="button"
                      onClick={() => settle(t, left)}
                      disabled={busyId === t.id}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-slate-100 px-3 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50 sm:flex-none dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      {busyId === t.id && !cicil ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}{' '}
                      Sudah bayar
                    </button>
                  </span>
                  {t.amount - left > 0.5 && (
                    <span className="block w-full">
                      <span className="block h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <span
                          className="block h-full rounded-full bg-cyan-500"
                          style={{ width: `${Math.min(100, ((t.amount - left) / t.amount) * 100)}%` }}
                        />
                      </span>
                      <span className="mt-1 block text-[11px] text-slate-500 dark:text-slate-400">
                        Sudah kembali {formatIDR(Math.round(t.amount - left))} dari {formatIDR(Math.round(t.amount))}
                      </span>
                    </span>
                  )}
                  {cicil && cicil.id === t.id && (
                    <CicilForm
                      left={left}
                      value={cicil.value}
                      busy={busyId === t.id}
                      onChange={(v) => setCicil({ id: t.id!, value: v })}
                      onSave={(n) => settle(t, left, n)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[11px] text-slate-400">
            WhatsApp terbuka dengan pesan siap kirim — kamu pilih kontaknya sendiri. &ldquo;Nyicil&rdquo; = bayar
            sebagian, &ldquo;Sudah bayar&rdquo; = lunas penuh — uang masuk ke rekening asal piutang & tercatat di
            Kekayaan.
          </p>
        </section>
      )}

      {app ? (
        <BottomSheet isOpen={split} onClose={() => setSplit(false)} title="Patungan">
          <div className="pb-[calc(env(safe-area-inset-bottom)+16px)]">{body}</div>
        </BottomSheet>
      ) : (
        <Modal isOpen={split} onClose={() => setSplit(false)} title="Patungan" maxWidth="max-w-lg">
          {body}
        </Modal>
      )}
    </div>
  );
}

const digits = (s: string) => s.replace(/\D/g, '').slice(0, 12);
const group = (s: string) => (s ? Number(s).toLocaleString('id-ID') : '');
const EXPENSE_CATS = CATEGORY_TEMPLATE.filter((c) => c.kind === 'pengeluaran').map((c) => c.category);

function SplitForm({ onDone }: { onDone: (msg: string) => void }) {
  const [total, setTotal] = useState('');
  const [note, setNote] = useState('');
  const [namesRaw, setNamesRaw] = useState('');
  const [includeMe, setIncludeMe] = useState(true);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[] | null>(null);
  const [accountId, setAccountId] = useState('');
  const [applyBalance, setApplyBalance] = useState(true);
  const [myCategory, setMyCategory] = useState('Makanan & Minuman');
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<SplitResult | null>(null);
  const [requestId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    accountService
      .getUserAccounts('')
      .then((list) => {
        const ok = list
          .filter((a) => a.id && !isCreditAccountType(a.type) && (a.currency || 'IDR') === 'IDR')
          .map((a) => ({ id: String(a.id), name: a.name }));
        setAccounts(ok);
        if (ok[0]) setAccountId(ok[0].id);
      })
      .catch(() => setAccounts([]));
  }, []);

  const names = useMemo(() => {
    const seen = new Set<string>();
    return namesRaw
      .split(/[,\n;]+/)
      .map((n) => n.trim())
      .filter((n) => n && !seen.has(n.toLowerCase()) && seen.add(n.toLowerCase()))
      .slice(0, 20);
  }, [namesRaw]);
  const amount = Number(total || '0');
  const parts = names.length + (includeMe ? 1 : 0);
  const per = parts > 0 ? Math.floor(amount / parts) : 0;
  const first = parts > 0 ? per + (amount - per * parts) : 0;

  const save = async () => {
    if (busy) return;
    if (amount < 1) {
      setError('Isi total tagihannya.');
      return;
    }
    if (!names.length) {
      setError('Isi minimal satu nama.');
      return;
    }
    if (!accountId) {
      setError('Pilih rekening.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const r = await debtService.split({
        requestId,
        total: amount,
        note: note.trim(),
        names,
        includeMe,
        accountId,
        applyBalance,
        myCategory,
        due: due ? { date: due } : null,
      });
      setDone(r);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Gagal mencatat patungan.');
    } finally {
      setBusy(false);
    }
  };

  const label = 'mb-1.5 block text-[12px] font-semibold text-slate-500 dark:text-slate-400';
  const input =
    'w-full rounded-2xl bg-slate-100 px-4 py-3 text-[15px] font-semibold text-slate-900 outline-none ring-2 ring-transparent placeholder:font-medium placeholder:text-slate-400 focus:bg-white focus:ring-cyan-500 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-900';
  const chip = (on: boolean) =>
    cn(
      'rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors',
      on
        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
    );

  if (done) {
    const what = note.trim() || 'patungan';
    const group = `Patungan ${what} 🧾\nTotal ${formatIDR(amount)} dibagi ${parts} orang:\n${done.shares.map((s) => `• ${s.name}: ${formatIDR(s.amount)}`).join('\n')}${done.myShare ? `\n• Aku: ${formatIDR(done.myShare)}` : ''}\n\nTransfer ke aku ya, makasih! 🙏`;
    return (
      <div className="space-y-4">
        <p className="text-[18px] font-extrabold text-slate-900 dark:text-white">
          ✅ Tercatat — {done.shares.length} piutang
        </p>
        <a
          href={waUrl(group)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 py-3.5 text-[15px] font-bold text-white hover:bg-emerald-700"
        >
          <Share2 size={17} /> Kirim rincian ke grup WA
        </a>
        <ul className="divide-y divide-slate-100 rounded-2xl ring-1 ring-slate-100 dark:divide-slate-800 dark:ring-slate-800">
          {done.shares.map((s) => (
            <li key={s.name} className="flex items-center gap-3 px-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-slate-900 dark:text-white">
                {s.name}
              </span>
              <span className="text-[13px] font-extrabold tabular-nums text-slate-700 dark:text-slate-200">
                {formatIDR(s.amount)}
              </span>
              <a
                href={waUrl(reminderText('santai', s.name, s.amount, what))}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Kirim ke ${s.name}`}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
              >
                <MessageCircle size={15} />
              </a>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => onDone(`Patungan ${what} tercatat.`)}
          className="w-full rounded-full bg-slate-100 py-3 text-[14px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          Selesai
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div
          role="alert"
          className="rounded-2xl bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
        >
          {error}
        </div>
      )}
      <label className="block">
        <span className={label}>Total tagihan</span>
        <span
          className={cn(
            input,
            'flex items-center gap-1.5 focus-within:bg-white focus-within:ring-cyan-500 dark:focus-within:bg-slate-900',
          )}
        >
          <span className="text-slate-400">Rp</span>
          <input
            value={group(total)}
            onChange={(e) => setTotal(digits(e.target.value))}
            inputMode="numeric"
            placeholder="0"
            aria-label="Total tagihan"
            autoFocus
            className="min-w-0 flex-1 bg-transparent text-[18px] font-extrabold tabular-nums outline-none"
          />
        </span>
      </label>
      <label className="block">
        <span className={label}>Untuk apa</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={120}
          placeholder="Makan di Bandar Djakarta"
          className={input}
        />
      </label>
      <label className="block">
        <span className={label}>Siapa saja yang patungan</span>
        <textarea
          value={namesRaw}
          onChange={(e) => setNamesRaw(e.target.value)}
          rows={2}
          placeholder="Andi, Budi, Citra"
          className={cn(input, 'resize-none')}
        />
        <span className="mt-1 block px-1 text-[11px] text-slate-400">
          Pisahkan dengan koma atau baris baru. Maks 20 orang.
        </span>
      </label>
      <div className="flex gap-1.5">
        <button type="button" onClick={() => setIncludeMe(true)} className={chip(includeMe)}>
          Termasuk aku
        </button>
        <button type="button" onClick={() => setIncludeMe(false)} className={chip(!includeMe)}>
          Tanpa aku
        </button>
      </div>
      {amount > 0 && names.length > 0 && (
        <div className="rounded-2xl bg-cyan-50 px-4 py-3 text-[13px] text-cyan-900 dark:bg-cyan-500/10 dark:text-cyan-200">
          <b className="tabular-nums">{formatIDR(per)}</b> per orang × {parts}
          {first !== per ? ` (${names[0]} ${formatIDR(first)} — sisa pembulatan)` : ''}
        </div>
      )}
      <label className="block">
        <span className={label}>Dibayar pakai rekening</span>
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          disabled={accounts === null}
          className={input}
        >
          {(accounts ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
        <input
          type="checkbox"
          checked={applyBalance}
          onChange={(e) => setApplyBalance(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-cyan-600"
        />
        <span className="text-[13px] text-slate-700 dark:text-slate-200">
          <b>Potong saldo sekarang</b> — total {amount ? formatIDR(amount) : ''} keluar dari rekening ini
          {includeMe ? ', bagianku dicatat sebagai pengeluaran' : ''}.
          <span className="block text-[11px] text-slate-400">Matikan kalau tagihannya sudah kamu catat sendiri.</span>
        </span>
      </label>
      {applyBalance && includeMe && (
        <label className="block">
          <span className={label}>Kategori bagianku</span>
          <select value={myCategory} onChange={(e) => setMyCategory(e.target.value)} className={input}>
            {EXPENSE_CATS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block">
        <span className={label}>Tagih paling lambat (opsional)</span>
        <input
          type="date"
          value={due}
          min={toLocalDateString()}
          onChange={(e) => setDue(e.target.value)}
          className={input}
        />
      </label>
      <button
        type="button"
        onClick={save}
        disabled={busy || amount < 1 || !names.length || !accountId}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-cyan-600 py-3.5 text-[15px] font-bold text-white hover:bg-cyan-700 disabled:opacity-40"
      >
        {busy ? <Loader2 size={18} className="animate-spin" /> : <Users size={18} />} Tagih mereka
      </button>
      {due && <p className="text-center text-[11px] text-slate-400">Kamu diingatkan H-3 & H-1 sebelum tanggal itu.</p>}
    </div>
  );
}

// Bayar sebagian (cicilan) — nominal di atas sisa dipotong server jadi pelunasan.
function CicilForm({
  left,
  value,
  busy,
  onChange,
  onSave,
}: {
  left: number;
  value: string;
  busy: boolean;
  onChange: (v: string) => void;
  onSave: (n: number) => void;
}) {
  const n = Number(value || '0');
  return (
    <span className="block w-full rounded-2xl bg-cyan-50/70 p-3 dark:bg-cyan-500/10">
      <span className="mb-1.5 block text-[12px] font-semibold text-cyan-900/70 dark:text-cyan-200/70">
        Berapa yang dibayar sekarang?
      </span>
      <span className="flex gap-2">
        <span className="flex min-w-0 flex-1 items-center gap-1.5 rounded-2xl bg-white px-3 py-2.5 ring-2 ring-transparent focus-within:ring-cyan-500 dark:bg-slate-900">
          <span className="text-[13px] text-slate-400">Rp</span>
          <input
            value={n ? n.toLocaleString('id-ID') : ''}
            onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 11))}
            inputMode="numeric"
            autoFocus
            aria-label="Nominal cicilan"
            placeholder="0"
            className="min-w-0 flex-1 bg-transparent text-[15px] font-bold tabular-nums text-slate-900 outline-none dark:text-white"
          />
        </span>
        <button
          type="button"
          onClick={() => onSave(n)}
          disabled={!n || busy}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-cyan-600 px-4 text-[13px] font-bold text-white hover:bg-cyan-700 disabled:opacity-40"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Catat
        </button>
      </span>
      <span className="mt-2 flex flex-wrap gap-1.5">
        {[0.25, 0.5].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onChange(String(Math.round(left * f)))}
            className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-cyan-700 dark:bg-slate-900 dark:text-cyan-300"
          >
            {f * 100}% · {formatIDR(Math.round(left * f))}
          </button>
        ))}
      </span>
      {n > left && (
        <span className="mt-1.5 block text-[11px] font-semibold text-amber-700 dark:text-amber-300">
          Lebih dari sisa — yang dicatat cukup {formatIDR(Math.round(left))} (lunas).
        </span>
      )}
    </span>
  );
}
