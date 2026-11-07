'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, ChevronDown, Eye, EyeOff, Plus, Radar as RadarIcon, Repeat } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { SubEditor } from '@/components/langganan/SubEditor';
import { RadarScan } from '@/components/langganan/RadarScan';
import { SubLogo } from '@/components/langganan/SubLogo';
import { subscriptionService } from '@/lib/services/subscriptionService';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { accountService, type Account } from '@/lib/services/accountService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import {
  chargesBetween,
  catalogFor,
  CYCLE_LABEL,
  CYCLE_SHORT,
  daysBetween,
  addDaysStr,
  monthlyEquivalent,
  nextCharge,
  radarScan,
  type Subscription,
} from '@/lib/subscriptions';
import { cn, formatIDR, toLocalDateString } from '@/lib/utils';

// Hanya memantau langganan — bukan Transaksi Rutin, tidak mencatat transaksi.

const HIDE_KEY = 'leosiqra-hide-balance';
const fmtDay = (d: string) =>
  new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${d}T00:00:00Z`),
  );
const whenLabel = (n: number, d: string) =>
  n === 0 ? 'hari ini' : n === 1 ? 'besok' : n <= 7 ? `${n} hari lagi` : fmtDay(d);

export function LanggananView({ variant, toast }: { variant: 'web' | 'app'; toast?: (m: string) => void }) {
  const today = toLocalDateString();
  const [subs, setSubs] = useState<Subscription[] | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState('');
  const [hidden, setHidden] = useState(false);
  const [sheet, setSheet] = useState<{ kind: 'add' } | { kind: 'edit'; sub: Subscription } | { kind: 'radar' } | null>(
    null,
  );
  const [showStopped, setShowStopped] = useState(false);
  const [flash, setFlash] = useState('');

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- preferensi lokal baru terbaca setelah hydrate (static export)
      setHidden(localStorage.getItem(HIDE_KEY) === '1');
    } catch {
      /* diblokir */
    }
    let alive = true;
    const load = () =>
      subscriptionService
        .list()
        .then((v) => {
          if (alive) {
            setSubs(v);
            setError('');
          }
        })
        .catch((e) => {
          if (alive) {
            setSubs((p) => p ?? []);
            setError(e instanceof Error ? e.message : 'Gagal memuat langganan.');
          }
        });
    const loadTx = () =>
      transactionService
        .getUserTransactions('session')
        .then((v) => alive && setTransactions(v))
        .catch(() => undefined);
    load();
    loadTx();
    accountService
      .getUserAccounts('session')
      .then((v) => alive && setAccounts(v))
      .catch(() => undefined);
    const u1 = subscribeToCollectionChanges('subscriptions', load);
    const u2 = subscribeToCollectionChanges('transactions', loadTx);
    return () => {
      alive = false;
      u1();
      u2();
    };
  }, []);

  const toggleHidden = () =>
    setHidden((h) => {
      try {
        localStorage.setItem(HIDE_KEY, h ? '0' : '1');
      } catch {
        /* abaikan */
      }
      return !h;
    });
  const money = (n: number) => (hidden ? 'Rp ••••' : formatIDR(Math.round(n)));

  const list = useMemo(
    () =>
      (subs ?? []).map((s) => {
        const next = s.status === 'batal' ? null : nextCharge(s.anchorDate, s.cycle, today);
        return {
          s,
          next,
          inDays: next ? daysBetween(today, next) : null,
          monthly: monthlyEquivalent(s.amount, s.cycle),
        };
      }),
    [subs, today],
  );
  const running = list.filter((x) => x.s.status !== 'batal').sort((a, b) => (a.next ?? '').localeCompare(b.next ?? ''));
  const paying = running.filter((x) => x.s.status === 'aktif');
  const stopped = list.filter((x) => x.s.status === 'batal');
  const monthly = paying.reduce((s, x) => s + x.monthly, 0);
  const savedMonthly = stopped.reduce((s, x) => s + x.monthly, 0);
  const nextUp = paying[0];
  const top = [...paying].sort((a, b) => b.monthly - a.monthly)[0];

  // Radar diam-diam: berapa kandidat baru menunggu (untuk ajakan).
  const pending = useMemo(() => (subs ? radarScan(transactions, subs, today) : []), [transactions, subs, today]);

  const horizon = addDaysStr(today, 29);
  const upcoming = paying
    .flatMap((x) => chargesBetween(x.s.anchorDate, x.s.cycle, today, horizon).map((d) => ({ d, x })))
    .sort((a, b) => a.d.localeCompare(b.d));
  const upcomingTotal = upcoming.reduce((s, u) => s + u.x.s.amount, 0);

  const done = (msg: string) => {
    setSheet(null);
    if (toast) toast(msg);
    else {
      setFlash(msg);
      window.setTimeout(() => setFlash(''), 3500);
    }
  };
  const app = variant === 'app';
  const card = app
    ? 'rounded-3xl bg-white ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800'
    : 'rounded-[26px] bg-white ring-1 ring-slate-100';

  if (subs === null) {
    return (
      <div className="space-y-3">
        <div className="h-48 animate-pulse rounded-[28px] bg-slate-200/70 dark:bg-slate-800" />
        <div className="h-24 animate-pulse rounded-3xl bg-white dark:bg-slate-900" />
      </div>
    );
  }

  const sheetTitle =
    sheet?.kind === 'radar' ? 'Radar langganan' : sheet?.kind === 'edit' ? 'Ubah langganan' : 'Tambah langganan';
  const sheetBody =
    sheet &&
    (sheet.kind === 'radar' ? (
      <RadarScan transactions={transactions} subs={subs} onDone={done} />
    ) : (
      <SubEditor
        key={sheet.kind === 'edit' ? sheet.sub.id : 'baru'}
        sub={sheet.kind === 'edit' ? sheet.sub : null}
        accounts={accounts}
        onDone={done}
      />
    ));

  return (
    <div className="space-y-4">
      {flash && (
        <div
          role="status"
          className="rounded-2xl bg-emerald-50 px-4 py-3 text-[13px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
        >
          {flash}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-2xl bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
        >
          {error}
        </div>
      )}

      <section className="web-keep relative overflow-hidden rounded-[28px] bg-[radial-gradient(120%_130%_at_100%_0%,#1e1b4b_0%,#0b1220_60%)] p-5 text-white md:p-6">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full border border-white/10"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full border border-white/5"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-white/60">
              Langgananmu per bulan
              <button
                type="button"
                onClick={toggleHidden}
                aria-label={hidden ? 'Tampilkan angka' : 'Sembunyikan angka'}
                className="rounded-full p-1 text-white/60 hover:bg-white/10 hover:text-white"
              >
                {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </p>
            <p className="mt-1 text-[34px] font-extrabold leading-none tracking-tight tabular-nums md:text-[44px]">
              {money(monthly)}
            </p>
            <p className="mt-2 text-[13px] text-white/60">
              {paying.length} aktif · {money(monthly * 12)}/tahun
              {savedMonthly > 0 && (
                <span className="text-emerald-300"> · hemat {money(savedMonthly)}/bln dari yang dihentikan</span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSheet({ kind: 'add' })}
            className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-[13px] font-bold text-slate-900 hover:bg-white/90"
          >
            <Plus size={16} strokeWidth={2.6} /> Tambah
          </button>
        </div>
        {nextUp?.next && (
          <div className="relative mt-4 flex items-center gap-3 rounded-2xl bg-white/[0.07] px-3 py-2.5">
            <SubLogo name={nextUp.s.name} domain={nextUp.s.domain} color={catalogFor(nextUp.s)?.color} size={34} />
            <p className="min-w-0 flex-1 text-[13px]">
              <span className="text-white/60">Berikutnya</span> <b className="font-bold">{nextUp.s.name}</b>{' '}
              <span className="text-white/60">{whenLabel(nextUp.inDays ?? 0, nextUp.next)}</span>
            </p>
            <span className="text-[14px] font-extrabold tabular-nums">{money(nextUp.s.amount)}</span>
          </div>
        )}
      </section>

      <button
        type="button"
        onClick={() => setSheet({ kind: 'radar' })}
        className={cn(card, 'group flex w-full items-center gap-3 p-4 text-left')}
      >
        <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
          <RadarIcon size={22} />
          {pending.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-extrabold text-white">
              {pending.length}
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-extrabold text-slate-900 dark:text-white">Nyalakan radar</span>
          <span className="block text-[12px] text-slate-500 dark:text-slate-400">
            {pending.length > 0
              ? `${pending.length} kemungkinan langganan di 30 hari terakhir belum tercatat`
              : 'Pindai pembayaran 30 hari terakhir, temukan langganan yang terlupa'}
          </span>
        </span>
        {pending.length > 0 && (
          <span className="hidden -space-x-2 sm:flex">
            {pending.slice(0, 3).map((h) => (
              <span key={h.id} className="rounded-[10px] ring-2 ring-white dark:ring-slate-900">
                <SubLogo name={h.name} domain={h.domain} color={h.color} size={28} />
              </span>
            ))}
          </span>
        )}
      </button>

      {upcoming.length > 0 && (
        <section className={cn(card, 'p-4')}>
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-[15px] font-extrabold text-slate-900 dark:text-white">
              <CalendarClock size={16} className="text-indigo-500" /> 30 hari ke depan
            </h3>
            <span className="text-[13px] font-bold tabular-nums text-slate-500 dark:text-slate-400">
              {money(upcomingTotal)}
            </span>
          </div>
          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar">
            {upcoming.map(({ d, x }) => {
              const n = daysBetween(today, d);
              return (
                <button
                  key={`${x.s.id}-${d}`}
                  type="button"
                  onClick={() => setSheet({ kind: 'edit', sub: x.s })}
                  className={cn(
                    'flex w-[84px] shrink-0 flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-center',
                    n <= 2
                      ? 'bg-amber-50 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-500/30'
                      : 'bg-slate-50 dark:bg-slate-800/60',
                  )}
                >
                  <span
                    className={cn(
                      'text-[11px] font-bold',
                      n <= 2 ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400',
                    )}
                  >
                    {whenLabel(n, d)}
                  </span>
                  <SubLogo name={x.s.name} domain={x.s.domain} color={catalogFor(x.s)?.color} size={36} />
                  <span className="w-full truncate text-[11px] font-bold text-slate-800 dark:text-slate-100">
                    {x.s.name}
                  </span>
                  <span className="text-[11px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                    {hidden ? '••••' : formatIDR(x.s.amount)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {running.length === 0 && stopped.length === 0 ? (
        <section className={cn(card, 'px-5 py-10 text-center')}>
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
            <Repeat size={26} />
          </span>
          <h3 className="mt-4 text-[18px] font-extrabold text-slate-900 dark:text-white">
            Belum ada langganan dipantau
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-[13px] text-slate-500 dark:text-slate-400">
            Netflix, Spotify, internet, pulsa, iCloud… lihat totalnya per bulan & tahun, dan diingatkan sehari sebelum
            ditagih.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setSheet({ kind: 'radar' })}
              className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-emerald-700"
            >
              <RadarIcon size={15} /> Nyalakan radar
            </button>
            <button
              type="button"
              onClick={() => setSheet({ kind: 'add' })}
              className="flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2.5 text-[13px] font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
            >
              <Plus size={15} /> Tambah manual
            </button>
          </div>
        </section>
      ) : (
        <section className={cn(card, 'overflow-hidden')}>
          <div className="flex items-baseline justify-between px-4 pb-1 pt-4">
            <h3 className="text-[15px] font-extrabold text-slate-900 dark:text-white">Semua langganan</h3>
            {top && paying.length > 1 && monthly > 0 && (
              <span className="text-[12px] text-slate-500 dark:text-slate-400">
                Termahal: {top.s.name} ({Math.round((top.monthly / monthly) * 100)}%)
              </span>
            )}
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {running.map((x) => (
              <SubRow key={x.s.id} x={x} money={money} onOpen={() => setSheet({ kind: 'edit', sub: x.s })} />
            ))}
          </ul>
          {stopped.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowStopped((v) => !v)}
                className="flex w-full items-center justify-between border-t border-slate-100 px-4 py-3 text-[13px] font-bold text-slate-500 dark:border-slate-800 dark:text-slate-400"
              >
                Sudah berhenti ({stopped.length}){' '}
                <ChevronDown size={15} className={cn('transition-transform', showStopped && 'rotate-180')} />
              </button>
              {showStopped && (
                <ul className="divide-y divide-slate-100 opacity-70 dark:divide-slate-800">
                  {stopped.map((x) => (
                    <SubRow key={x.s.id} x={x} money={money} onOpen={() => setSheet({ kind: 'edit', sub: x.s })} />
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      )}
      <p className="px-1 text-[11px] text-slate-400">
        Langgananku hanya memantau — tidak mencatat transaksi otomatis. Untuk pencatatan otomatis, pakai Transaksi
        Rutin.
      </p>

      {app ? (
        <BottomSheet isOpen={Boolean(sheet)} onClose={() => setSheet(null)} title={sheetTitle}>
          <div className="pb-[calc(env(safe-area-inset-bottom)+16px)]">{sheetBody}</div>
        </BottomSheet>
      ) : (
        <Modal
          isOpen={Boolean(sheet)}
          onClose={() => setSheet(null)}
          title={sheetTitle}
          maxWidth={sheet?.kind === 'radar' ? 'max-w-xl' : 'max-w-lg'}
        >
          {sheetBody}
        </Modal>
      )}
    </div>
  );
}

function SubRow({
  x,
  money,
  onOpen,
}: {
  x: { s: Subscription; next: string | null; inDays: number | null; monthly: number };
  money: (n: number) => string;
  onOpen: () => void;
}) {
  const { s, next, inDays } = x;
  const trialDays = s.status === 'coba' && s.trialEnd ? daysBetween(toLocalDateString(), s.trialEnd) : null;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
      >
        <SubLogo name={s.name} domain={s.domain} color={catalogFor(s)?.color} size={44} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-bold text-slate-900 dark:text-white">{s.name}</span>
            {s.status === 'coba' && (
              <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                Masa coba
              </span>
            )}
          </span>
          <span
            className={cn(
              'block truncate text-[12px]',
              inDays !== null && inDays <= 2 && s.status === 'aktif'
                ? 'font-semibold text-amber-600 dark:text-amber-400'
                : 'text-slate-500 dark:text-slate-400',
            )}
          >
            {s.status === 'batal'
              ? 'Sudah berhenti'
              : s.status === 'coba' && trialDays !== null
                ? trialDays < 0
                  ? 'Masa coba sudah lewat — mulai ditagih?'
                  : `Gratis sampai ${fmtDay(s.trialEnd!)} (${trialDays} hari)`
                : `${CYCLE_LABEL[s.cycle]} · ditagih ${next ? whenLabel(inDays ?? 0, next) : '—'}`}
          </span>
        </span>
        <span className="text-right">
          <span className="block whitespace-nowrap text-[15px] font-extrabold tabular-nums text-slate-900 dark:text-white">
            {money(s.amount)}
            <span className="text-[11px] font-semibold text-slate-400">{CYCLE_SHORT[s.cycle]}</span>
          </span>
          {s.cycle !== 'bulanan' && (
            <span className="block text-[11px] tabular-nums text-slate-400">≈ {money(x.monthly)}/bln</span>
          )}
        </span>
      </button>
    </li>
  );
}
