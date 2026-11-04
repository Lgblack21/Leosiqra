"use client";

import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Pencil, Target } from 'lucide-react';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { cn, formatIDR, toLocalDateString } from '@/lib/utils';

// Ladangku › Target: cuan sampingan bulan ini = semua pemasukan DI LUAR gaji &
// hasil investasi (jual barang, freelance, hadiah, lain-lain), tanpa pelunasan
// piutang/transfer (related_type). Target per bulan disimpan di prefs.cuanTarget.

const NOT_SIDE = new Set(['Gaji', 'Hasil Investasi']);
export const isSideIncome = (t: Transaction) =>
  t.type === 'pemasukan' && !/^(debt|transfer|investasi)$/.test(t.relatedType ?? '') && !NOT_SIDE.has(t.category ?? '') && !/investasi|deposito|saham|reksa/i.test(t.category ?? '');
const monthKey = (d: Date | string) => toLocalDateString(new Date(d)).slice(0, 7);
const PRESETS = [500_000, 1_000_000, 2_500_000, 5_000_000];
const digits = (s: string) => s.replace(/\D/g, '').slice(0, 11);

export function TargetView({ variant, onToast }: { variant: 'web' | 'app'; onToast: (m: string) => void }) {
  const [tx, setTx] = useState<Transaction[] | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () => transactionService.getUserTransactions('session').then((v) => alive && setTx(v)).catch(() => alive && setTx((p) => p ?? []));
    void load();
    cloudflareApi<{ item?: { cuanTarget?: number } }>('/api/member/preferences').then((r) => alive && setTarget(r.item?.cuanTarget ?? 0)).catch(() => alive && setTarget(0));
    const unsub = subscribeToCollectionChanges('transactions', load);
    return () => { alive = false; unsub(); };
  }, []);

  const now = toLocalDateString().slice(0, 7);
  const prev = (() => { const [y, m] = now.split('-').map(Number); const d = new Date(y, m - 2, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })();
  const { thisMonth, lastMonth, bySource, months } = useMemo(() => {
    const side = (tx ?? []).filter(isSideIncome);
    const amt = (t: Transaction) => Number(t.amountIDR) || Number(t.amount) || 0;
    const cur = side.filter((t) => monthKey(t.date) === now);
    const src = new Map<string, number>();
    for (const t of cur) {
      const k = t.subCategory === 'Jual Barang' ? 'Jual barang' : t.category || 'Lainnya';
      src.set(k, (src.get(k) ?? 0) + amt(t));
    }
    const per = new Map<string, number>();
    for (const t of side) per.set(monthKey(t.date), (per.get(monthKey(t.date)) ?? 0) + amt(t));
    const keys: string[] = [];
    const [y, m] = now.split('-').map(Number);
    for (let i = 5; i >= 0; i--) { const d = new Date(y, m - 1 - i, 1); keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }
    return {
      thisMonth: cur.reduce((s, t) => s + amt(t), 0),
      lastMonth: per.get(prev) ?? 0,
      bySource: [...src.entries()].sort((a, b) => b[1] - a[1]),
      months: keys.map((k) => ({ k, v: per.get(k) ?? 0 })),
    };
  }, [tx, now, prev]);

  const save = async (n: number) => {
    setBusy(true);
    try {
      await cloudflareApi('/api/member/preferences', { method: 'PUT', json: { cuanTarget: n } });
      setTarget(n);
      setEditing(false);
      onToast(n ? `Target cuan ${formatIDR(n)} per bulan.` : 'Target cuan dihapus.');
    } catch (e) {
      onToast(e instanceof Error && e.message ? e.message : 'Gagal menyimpan target.');
    } finally {
      setBusy(false);
    }
  };

  if (tx === null || target === null) return <div className="h-48 animate-pulse rounded-[28px] bg-slate-200/70 dark:bg-slate-800" />;
  const app = variant === 'app';
  const card = app ? 'rounded-3xl bg-white ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800' : 'rounded-[26px] bg-white ring-1 ring-slate-100';
  const pct = target > 0 ? Math.min(100, (thisMonth / target) * 100) : 0;
  const reached = target > 0 && thisMonth >= target;
  const [ty, tm] = now.split('-').map(Number);
  const daysLeft = new Date(ty, tm, 0).getDate() - new Date().getDate();
  const maxBar = Math.max(1, ...months.map((x) => x.v), target);
  const monthName = (k: string) => new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(new Date(`${k}-01T00:00:00`));

  return (
    <div className="space-y-4">
      <section className="web-keep relative overflow-hidden rounded-[28px] bg-[radial-gradient(120%_140%_at_100%_0%,#a16207_0%,#713f12_35%,#0b1220_80%)] p-5 text-white md:p-6">
        <Target aria-hidden size={150} strokeWidth={1} className="pointer-events-none absolute -bottom-8 -right-6 text-amber-300/10" />
        <p className="text-[13px] font-semibold text-white/60">Cuan sampingan bulan ini</p>
        <p className="mt-1 text-[32px] font-extrabold leading-none tracking-tight tabular-nums md:text-[40px]">{formatIDR(Math.round(thisMonth))}</p>
        <p className="mt-2 text-[13px] text-white/60">
          {target > 0 ? (reached ? `🎉 Target ${formatIDR(target)} tercapai!` : `dari target ${formatIDR(target)} · kurang ${formatIDR(Math.round(target - thisMonth))}, ${daysLeft} hari lagi`) : 'Belum ada target — pasang biar semangat.'}
        </p>
        {target > 0 && (
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.round(Math.min(thisMonth, target))} aria-label="Progres target cuan">
            <div className={cn('h-full rounded-full transition-all', reached ? 'bg-emerald-400' : 'bg-gradient-to-r from-amber-300 to-orange-400')} style={{ width: `${Math.max(pct, 2)}%` }} />
          </div>
        )}
        <p className="relative mt-3 text-[11px] text-white/45">Bulan lalu {formatIDR(Math.round(lastMonth))} · dihitung dari pemasukan selain gaji & hasil investasi</p>
      </section>

      <section className={cn(card, 'p-4')}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[15px] font-extrabold text-slate-900 dark:text-white">Target per bulan</h3>
          {!editing && <button type="button" onClick={() => { setDraft(target ? String(target) : ''); setEditing(true); }} className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-[12px] font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"><Pencil size={12} /> {target ? 'Ubah' : 'Pasang target'}</button>}
        </div>
        {editing ? (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap gap-1.5">{PRESETS.map((p) => <button key={p} type="button" onClick={() => setDraft(String(p))} className={cn('rounded-full px-3 py-1.5 text-[12px] font-bold', Number(draft) === p ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700')}>{formatIDR(p)}</button>)}</div>
            <span className="flex items-center gap-1.5 rounded-2xl bg-slate-100 px-4 py-3 text-[15px] font-semibold text-slate-900 dark:bg-slate-800 dark:text-white">
              <span className="text-slate-400">Rp</span>
              <input value={draft ? Number(draft).toLocaleString('id-ID') : ''} onChange={(e) => setDraft(digits(e.target.value))} inputMode="numeric" placeholder="0" aria-label="Target cuan per bulan" className="min-w-0 flex-1 bg-transparent tabular-nums outline-none" />
            </span>
            <div className="flex gap-2">
              {target > 0 && <button type="button" onClick={() => save(0)} disabled={busy} className="rounded-full bg-slate-100 px-4 py-2.5 text-[13px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">Hapus</button>}
              <button type="button" onClick={() => setEditing(false)} disabled={busy} className="rounded-full bg-slate-100 px-4 py-2.5 text-[13px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">Batal</button>
              <button type="button" onClick={() => save(Number(draft || '0'))} disabled={busy || !Number(draft)} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-amber-500 py-2.5 text-[13px] font-bold text-amber-950 hover:bg-amber-400 disabled:opacity-40">{busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Simpan</button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex h-28 gap-2" role="img" aria-label="Cuan 6 bulan terakhir">
            {months.map(({ k, v }) => (
              <div key={k} className="flex flex-1 flex-col items-center gap-1">
                <div className="relative flex w-full flex-1 items-end">
                  {target > 0 && <span aria-hidden className="absolute inset-x-0 border-t border-dashed border-amber-400/70" style={{ bottom: `${(target / maxBar) * 100}%` }} />}
                  <div className={cn('w-full rounded-t-lg', k === now ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-700')} style={{ height: `${Math.max(3, (v / maxBar) * 100)}%` }} title={formatIDR(Math.round(v))} />
                </div>
                <span className={cn('text-[10px] font-semibold', k === now ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400')}>{monthName(k)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={cn(card, 'p-4')}>
        <h3 className="text-[15px] font-extrabold text-slate-900 dark:text-white">Dari mana saja bulan ini</h3>
        {bySource.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-slate-500 dark:text-slate-400">Belum ada cuan sampingan bulan ini. Coba jual barang nganggur di tab Jual.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {bySource.map(([k, v]) => (
              <li key={k}>
                <div className="flex justify-between text-[13px]"><span className="font-semibold text-slate-700 dark:text-slate-200">{k}</span><span className="font-bold tabular-nums text-slate-900 dark:text-white">{formatIDR(Math.round(v))}</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.max(3, (v / Math.max(1, thisMonth)) * 100)}%` }} /></div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
