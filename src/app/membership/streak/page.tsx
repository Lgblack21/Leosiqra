"use client";

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Coins, Flame, Moon, Shield, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { streakService, type DayKind, type StreakSummary } from '@/lib/services/streakService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { accountService, type Account } from '@/lib/services/accountService';
import { CloseDayDialog } from '@/components/streak/CloseDay';
import { LeoMascot } from '@/components/mascot/LeoMascot';
import { useFeedback } from '@/components/ui/Feedback';
import { Skeleton } from '@/components/ui/Skeleton';
import { GamificationStrip } from '@/components/GamificationStrip';

const KIND_STYLE: Record<DayKind, string> = {
  closed: 'bg-orange-500 text-white',
  late: 'bg-orange-200 text-orange-800',
  shield: 'bg-sky-100 text-sky-700 ring-1 ring-sky-300',
};
const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

const ymOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const fmtDay = (day: string) =>
  new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'short' }).format(new Date(`${day}T12:00:00`));

export default function StreakPage() {
  const { toast } = useFeedback();
  const [month, setMonth] = useState(() => ymOf(new Date()));
  const [data, setData] = useState<StreakSummary | null>(null);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState(false);
  const [busyDay, setBusyDay] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    const load = () =>
      streakService
        .get(month)
        .then((d) => {
          setData(d);
          setError('');
        })
        .catch((e) => setError(e instanceof Error ? e.message : 'Gagal memuat streak.'));
    load();
    return subscribeToCollectionChanges('streak', load);
  }, [month]);

  useEffect(() => {
    const load = () => transactionService.getUserTransactions('session').then(setTransactions).catch(() => {});
    load();
    accountService.getUserAccounts('session').then(setAccounts).catch(() => {});
    return subscribeToCollectionChanges('transactions', load);
  }, []);

  const fillDay = async (day: string) => {
    setBusyDay(day);
    try {
      setData(await streakService.close(day));
      toast.success(`${fmtDay(day)} diisi belakangan.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal mengisi hari.');
    } finally {
      setBusyDay(null);
    }
  };

  if (error) {
    return (
      <div className="mx-auto max-w-xl rounded-[24px] border border-slate-100 bg-white p-8 text-center">
        <LeoMascot mood="sad" size={110} className="mx-auto" />
        <p className="mt-3 font-bold text-slate-900">Streak belum bisa dibuka</p>
        <p className="mt-1 text-sm text-slate-500">{error}</p>
      </div>
    );
  }

  // Kalender: kotak kosong sebelum tanggal 1 (minggu mulai Senin).
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const lead = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(y, m, 0).getDate();
  const kinds = new Map((data?.days ?? []).map((d) => [d.day, d.kind]));
  const todayStr = data?.today ?? '';
  const missed = new Set(data?.missed ?? []);
  const isCurrent = month === todayStr.slice(0, 7);
  const nowLocal = new Date();
  const todayTrx = transactions.filter((t) => {
    const d = new Date(t.date);
    return t.type !== 'debt' && d.getFullYear() === nowLocal.getFullYear() && d.getMonth() === nowLocal.getMonth() && d.getDate() === nowLocal.getDate();
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      {/* Ringkasan streak */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-orange-500 via-amber-500 to-rose-500 p-6 text-white shadow-xl shadow-orange-500/20 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-white/85">Streak tutup hari</p>
            {data ? (
              <p className="mt-1 flex items-end gap-2">
                <span className="text-6xl font-extrabold leading-none tabular-nums">{data.streak}</span>
                <span className="pb-1.5 text-lg font-bold">hari beruntun</span>
              </p>
            ) : (
              <span className="mt-2 block h-14 w-40 animate-pulse rounded-2xl bg-white/25" />
            )}
            <p className="mt-2 text-sm text-white/85">
              {data?.todayKind ? 'Hari ini sudah ditutup. Mantap! 🔥' : 'Tutup hari ini supaya streak-mu bertambah.'}
            </p>
            {data && !data.todayKind && (
              <button
                type="button"
                onClick={() => setDialog(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-orange-600 shadow-lg shadow-orange-900/20 transition-transform hover:-translate-y-0.5"
              >
                <Moon size={16} /> Cek & tutup hari ini
              </button>
            )}
          </div>
          <LeoMascot mood={data?.todayKind ? 'happy' : 'idle'} size={140} interactive className="self-end md:self-auto" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { icon: Trophy, tone: 'bg-amber-50 text-amber-600', label: 'Rekor terpanjang', value: data ? `${data.best} hari` : null },
          { icon: Coins, tone: 'bg-yellow-50 text-yellow-600', label: 'Koin Leo', value: data ? `${data.coins}` : null },
          { icon: Shield, tone: 'bg-sky-50 text-sky-600', label: 'Perisai siap', value: data ? `${data.shields} / ${data.maxShields}` : null },
          { icon: Flame, tone: 'bg-orange-50 text-orange-600', label: 'Minggu ini', value: data ? `${data.week.closed} / ${data.week.target} hari` : null },
        ].map((s) => (
          <div key={s.label} className="rounded-[22px] border border-slate-100 bg-white p-4 shadow-sm">
            <span className={cn('flex h-9 w-9 items-center justify-center rounded-2xl', s.tone)}><s.icon size={17} /></span>
            <p className="mt-3 text-xs font-semibold text-slate-400">{s.label}</p>
            {s.value === null ? <Skeleton className="mt-1 h-6 w-20" /> : <p className="text-xl font-extrabold text-slate-900 tabular-nums">{s.value}</p>}
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Kalender */}
        <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm md:p-6 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <button type="button" onClick={() => setMonth(ymOf(new Date(y, m - 2, 1)))} aria-label="Bulan sebelumnya" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><ChevronLeft size={18} /></button>
            <p className="font-extrabold text-slate-900">{new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(first)}</p>
            <button type="button" onClick={() => setMonth(ymOf(new Date(y, m, 1)))} disabled={isCurrent} aria-label="Bulan berikutnya" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ChevronRight size={18} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {WEEKDAYS.map((w) => <span key={w} className="pb-1 text-xs font-semibold text-slate-400">{w}</span>)}
            {Array.from({ length: lead }, (_, i) => <span key={`l${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = `${month}-${String(i + 1).padStart(2, '0')}`;
              const kind = kinds.get(day);
              const isToday = day === todayStr;
              const future = todayStr && day > todayStr;
              return (
                <span
                  key={day}
                  title={kind === 'shield' ? 'Ditutup perisai' : kind === 'late' ? 'Diisi belakangan' : kind ? 'Ditutup' : missed.has(day) ? 'Terlewat' : undefined}
                  className={cn(
                    'mx-auto flex aspect-square w-full max-w-[44px] items-center justify-center rounded-full text-sm font-bold tabular-nums',
                    kind ? KIND_STYLE[kind] : missed.has(day) ? 'text-rose-500 ring-1 ring-rose-200' : future ? 'text-slate-300' : 'text-slate-500',
                    isToday && !kind && 'ring-2 ring-slate-800'
                  )}
                >
                  {i + 1}
                </span>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-orange-500" /> Ditutup</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-orange-200" /> Diisi belakangan</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-sky-100 ring-1 ring-sky-300" /> Perisai</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full ring-1 ring-rose-300" /> Terlewat</span>
          </div>
        </div>

        <div className="space-y-5 lg:col-span-2">
          {/* Target mingguan */}
          <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="font-bold text-slate-900">Target minggu ini</p>
              <span className="flex items-center gap-1 text-sm font-bold text-yellow-600"><Coins size={14} /> +20</span>
            </div>
            <p className="mt-0.5 text-sm text-slate-500">Tutup {data?.week.target ?? 5} hari dalam seminggu (Sen–Min).</p>
            <div className="mt-3 flex gap-1.5">
              {Array.from({ length: data?.week.target ?? 5 }, (_, i) => (
                <span key={i} className={cn('h-2.5 flex-1 rounded-full', data && i < data.week.closed ? 'bg-orange-500' : 'bg-slate-100')} />
              ))}
            </div>
          </div>

          {/* Perisai */}
          <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm">
            <p className="flex items-center gap-2 font-bold text-slate-900"><Shield size={17} className="text-sky-600" /> {data?.shields ?? 0} perisai siap</p>
            <p className="mt-1 text-sm text-slate-500">
              Kalau kamu lupa menutup satu hari, perisai otomatis menjaganya supaya streak tidak putus. Dapat perisai baru tiap minggu target tercapai (maks {data?.maxShields ?? 2}).
            </p>
          </div>

          {/* Hari terlewat */}
          <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm">
            <p className="font-bold text-slate-900">Isi hari yang terlewat</p>
            {!data || data.missed.length === 0 ? (
              <p className="mt-1 text-sm text-slate-500">Tidak ada yang perlu diisi. Hari yang terlewat muncul di sini selama seminggu.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {data.missed.map((d) => (
                  <li key={d} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3.5 py-2.5">
                    <span className="text-sm font-semibold capitalize text-slate-700">{fmtDay(d)}</span>
                    <button type="button" onClick={() => fillDay(d)} disabled={busyDay !== null} className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-orange-600 shadow-sm ring-1 ring-orange-200 hover:bg-orange-50 disabled:opacity-50">
                      {busyDay === d ? 'Mengisi…' : 'Isi & tutup'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-slate-400">Tiap hari yang ditutup sendiri memberi 3 koin, dan minggu dengan 5 hari ditutup memberi 20 koin lagi.</p>
          </div>
        </div>
      </div>

      {/* Level & lencana (dipindah dari Dashboard supaya Dashboard ringkas) */}
      <GamificationStrip />

      <CloseDayDialog open={dialog} onClose={() => setDialog(false)} today={todayTrx} accounts={accounts} onClosed={setData} />
    </div>
  );
}
