'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, HandCoins, Loader2, Pencil, Store, Tag, X } from 'lucide-react';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { debtRemaining, paidByDebt } from '@/lib/services/debtService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { cn, formatIDR, toLocalDateString } from '@/lib/utils';

// "Cuan bulan ini" HANYA dari hasil Ladangku: penjualan Usahaku (related_type 'shop') + barang laku
// (related_type 'item' atau sub kategori 'Jual Barang'). Gaji & pemasukan lain sengaja TIDAK ikut.

export const isLadangCuan = (t: Transaction) =>
  t.type === 'pemasukan' && (t.relatedType === 'shop' || t.relatedType === 'item' || t.subCategory === 'Jual Barang');
const monthKey = (d: Date | string) => toLocalDateString(new Date(d)).slice(0, 7);
const amt = (t: Transaction) => Number(t.amountIDR) || Number(t.amount) || 0;
type Tab = 'usaha' | 'jual' | 'tagih';

export function RingkasView({
  variant,
  go,
  onToast,
}: {
  variant: 'web' | 'app';
  go: (t: Tab) => void;
  onToast: (m: string) => void;
}) {
  const [tx, setTx] = useState<Transaction[] | null>(null);
  const [shopCount, setShopCount] = useState(0);
  const [target, setTarget] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      transactionService
        .getUserTransactions('session')
        .then((v) => alive && setTx(v))
        .catch(() => alive && setTx((p) => p ?? []));
    void load();
    cloudflareApi<{ items: unknown[] }>('/api/member/shops')
      .then((r) => alive && setShopCount(r.items?.length ?? 0))
      .catch(() => undefined);
    cloudflareApi<{ item?: { cuanTarget?: number } }>('/api/member/preferences')
      .then((r) => alive && setTarget(r.item?.cuanTarget ?? 0))
      .catch(() => undefined);
    const unsub = subscribeToCollectionChanges('transactions', load);
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  const now = toLocalDateString().slice(0, 7);
  const { month, total, shopTotal, itemTotal, owed } = useMemo(() => {
    const list = tx ?? [];
    const m = list
      .filter((t) => isLadangCuan(t) && monthKey(t.date) === now)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const paid = paidByDebt(list);
    return {
      month: m,
      total: m.reduce((s, t) => s + amt(t), 0),
      shopTotal: m.filter((t) => t.relatedType === 'shop').reduce((s, t) => s + amt(t), 0),
      itemTotal: m.filter((t) => t.relatedType !== 'shop').reduce((s, t) => s + amt(t), 0),
      owed: list
        .filter((t) => t.type === 'debt' && t.category === 'Piutang' && (t.currency || 'IDR') === 'IDR')
        .reduce((s, t) => s + debtRemaining(t, paid), 0),
    };
  }, [tx, now]);

  const save = async (n: number) => {
    setBusy(true);
    try {
      await cloudflareApi('/api/member/preferences', { method: 'PUT', json: { cuanTarget: n } });
      setTarget(n);
      setEditing(false);
      onToast(n ? `Target cuan ${formatIDR(n)} per bulan.` : 'Target dihapus.');
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setBusy(false);
    }
  };

  if (tx === null) return <div className="h-48 animate-pulse rounded-[28px] bg-slate-200/70 dark:bg-slate-800" />;
  const app = variant === 'app';
  const card = app
    ? 'rounded-3xl bg-white ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800'
    : 'rounded-[26px] bg-white ring-1 ring-slate-100';
  const pct = target > 0 ? Math.min(100, (total / target) * 100) : 0;
  const ways: { id: Tab; icon: React.ElementType; title: string; sub: string; tone: string }[] = [
    {
      id: 'usaha',
      icon: Store,
      title: 'Usahaku',
      sub: shopCount
        ? `${shopCount} usaha · ${formatIDR(Math.round(shopTotal))} bulan ini`
        : 'Jadikan keahlianmu usaha sampingan',
      tone: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
    },
    {
      id: 'jual',
      icon: Tag,
      title: 'Jual barang',
      sub: itemTotal
        ? `${formatIDR(Math.round(itemTotal))} bulan ini`
        : 'Barang nganggur jadi uang, harga dari iklan asli',
      tone: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
    },
    {
      id: 'tagih',
      icon: HandCoins,
      title: 'Tagih',
      sub: owed > 0.5 ? `${formatIDR(Math.round(owed))} belum kembali` : 'Ingatkan teman lewat WhatsApp, patungan',
      tone: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-300',
    },
  ];

  return (
    <div className="space-y-4">
      <section className="web-keep relative overflow-hidden rounded-[28px] bg-[radial-gradient(120%_140%_at_100%_0%,#047857_0%,#064e3b_35%,#0b1220_80%)] p-5 text-white md:p-6">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[13px] font-semibold text-white/60">Cuan bulan ini</p>
          {!editing && (
            <button
              type="button"
              onClick={() => {
                setDraft(target ? String(target) : '');
                setEditing(true);
              }}
              className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold text-white/80 hover:bg-white/20"
            >
              <Pencil size={11} /> {target ? 'Target' : 'Pasang target'}
            </button>
          )}
        </div>
        <p className="mt-1 text-[32px] font-extrabold leading-none tracking-tight tabular-nums md:text-[40px]">
          {formatIDR(Math.round(total))}
        </p>
        {editing ? (
          <div className="mt-3 flex gap-2">
            <span className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-[14px] font-semibold">
              <span className="text-white/50">Rp</span>
              <input
                autoFocus
                value={draft ? Number(draft).toLocaleString('id-ID') : ''}
                onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 11))}
                inputMode="numeric"
                placeholder="Target per bulan"
                aria-label="Target cuan per bulan"
                className="min-w-0 flex-1 bg-transparent tabular-nums text-white outline-none placeholder:text-white/40"
              />
            </span>
            {target > 0 && (
              <button
                type="button"
                onClick={() => save(0)}
                disabled={busy}
                className="rounded-full bg-white/10 px-3 text-[12px] font-bold"
              >
                Hapus
              </button>
            )}
            <button
              type="button"
              onClick={() => setEditing(false)}
              aria-label="Batal"
              className="rounded-full bg-white/10 px-3"
            >
              <X size={15} />
            </button>
            <button
              type="button"
              onClick={() => save(Number(draft || '0'))}
              disabled={busy || !Number(draft)}
              aria-label="Simpan target"
              className="rounded-full bg-white px-3 text-slate-900 disabled:opacity-40"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            </button>
          </div>
        ) : target > 0 ? (
          <>
            <p className="mt-2 text-[13px] text-white/60">
              {total >= target
                ? `🎉 Target ${formatIDR(target)} tercapai!`
                : `dari target ${formatIDR(target)} · kurang ${formatIDR(Math.round(target - total))}`}
            </p>
            <div
              className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={target}
              aria-valuenow={Math.round(Math.min(total, target))}
              aria-label="Progres target cuan"
            >
              <div
                className={cn(
                  'h-full rounded-full',
                  total >= target ? 'bg-emerald-300' : 'bg-gradient-to-r from-emerald-300 to-lime-300',
                )}
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
          </>
        ) : (
          <p className="mt-2 text-[13px] text-white/60">
            Dari penjualan Usahaku & barang yang laku — gaji tidak dihitung.
          </p>
        )}
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {ways.map((w) => {
          const Icon = w.icon;
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => go(w.id)}
              className={cn(
                card,
                'flex items-center gap-3 p-4 text-left transition-transform active:scale-[0.99] md:flex-col md:items-start',
              )}
            >
              <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', w.tone)}>
                <Icon size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-extrabold text-slate-900 dark:text-white">{w.title}</span>
                <span className="block text-[12px] text-slate-500 dark:text-slate-400">{w.sub}</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-slate-300 md:hidden" />
            </button>
          );
        })}
      </section>

      <section className={cn(card, 'p-4')}>
        <h3 className="text-[15px] font-extrabold text-slate-900 dark:text-white">Uang masuk bulan ini</h3>
        {month.length === 0 ? (
          <p className="py-5 text-center text-[13px] text-slate-500 dark:text-slate-400">
            Belum ada. Catat penjualan pertamamu di Usahaku, atau jual barang nganggur.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
            {month.slice(0, 15).map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                    t.relatedType === 'shop'
                      ? 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300'
                      : 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
                  )}
                >
                  {t.relatedType === 'shop' ? <Store size={16} /> : <Tag size={16} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-slate-900 dark:text-white">
                    {(t.note || '').replace(/^\[([^\]]+)\]\s*(.*)$/, '$2 · $1') || 'Penjualan'}
                  </span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                    {new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }).format(
                      new Date(t.date),
                    )}
                  </span>
                </span>
                <span className="shrink-0 text-[13px] font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">
                  +{formatIDR(Math.round(amt(t)))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
