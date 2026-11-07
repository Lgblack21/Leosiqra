'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownRight,
  ArrowUpRight,
  Coins,
  Gift,
  History,
  Search,
  Settings2,
  ShoppingBag,
  Sparkles,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminStatCard } from '@/components/admin/AdminStatCard';
import { FeedbackProvider, useFeedback } from '@/components/ui/Feedback';

// Admin › Koin: ekonomi koin (1 koin = Rp 1, tidak bisa dicairkan).
// Data dari /api/admin/coins/* (Worker: handleAdminCoins).

type Group = 'beli' | 'hadiah' | 'pakai' | 'tarik' | 'admin';
type Summary = {
  circulating: number;
  holders: number;
  bought: number;
  rewards: number;
  spent: number;
  adjusted: number;
  month: { key: string; bought: number; rewards: number; spent: number };
  byKind: { kind: string; n: number; total: number }[];
  pendingWithdrawals: number;
  pendingTopups: { count: number; amount: number };
  rules: Record<string, number>;
  packages: { id: string; name: string; price: number; coins: number }[];
  aiLimits: Record<string, { FREE: number; PRO: number }>;
};
type CoinUser = {
  id: string;
  name: string | null;
  email: string;
  plan: string | null;
  expired_at: string | null;
  balance: number;
  last_at: string | null;
};
type LedgerRow = {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  amount: number;
  kind: string;
  note: string | null;
  created_at: string;
};
type WithdrawalRow = {
  id: string;
  user_name: string | null;
  user_email: string | null;
  coins: number;
  amount_idr: number;
  method: string;
  account_name: string;
  account_number: string;
  status: 'MENUNGGU' | 'DIBAYAR' | 'DITOLAK';
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;
};

const KIND: Record<string, { label: string; group: Group }> = {
  topup: { label: 'Top up', group: 'beli' },
  signup: { label: 'Bonus daftar', group: 'hadiah' },
  ref_active: { label: 'Referral aktif', group: 'hadiah' },
  ref_active_referee: { label: 'Bonus diundang', group: 'hadiah' },
  ref_pro: { label: 'Referral PRO', group: 'hadiah' },
  streak: { label: 'Streak', group: 'hadiah' },
  story_ai_refund: { label: 'Refund ilustrasi AI', group: 'pakai' },
  redeem_pro: { label: 'Tukar PRO', group: 'pakai' },
  story_ai: { label: 'Ilustrasi AI', group: 'pakai' },
  meal_ai: { label: 'Analisis makanan', group: 'pakai' },
  meal_ai_refund: { label: 'Refund analisis makanan', group: 'pakai' },
  app_activation: { label: 'Aktivasi app', group: 'pakai' },
  withdraw: { label: 'Tarik tunai', group: 'tarik' },
  withdraw_refund: { label: 'Refund tarik tunai', group: 'tarik' },
  admin_adjust: { label: 'Penyesuaian admin', group: 'admin' },
};
const GROUPS: { id: Group; label: string; tone: string }[] = [
  { id: 'beli', label: 'Dibeli', tone: 'bg-sky-50 text-sky-700' },
  { id: 'hadiah', label: 'Hadiah', tone: 'bg-amber-50 text-amber-700' },
  { id: 'pakai', label: 'Dipakai', tone: 'bg-violet-50 text-violet-700' },
  { id: 'tarik', label: 'Tarik tunai', tone: 'bg-slate-100 text-slate-600' },
  { id: 'admin', label: 'Admin', tone: 'bg-emerald-50 text-emerald-700' },
];
const kindLabel = (k: string) => KIND[k]?.label ?? k;
const groupTone = (k: string) => GROUPS.find((g) => g.id === KIND[k]?.group)?.tone ?? 'bg-slate-100 text-slate-600';

const num = (n: number) => Number(n || 0).toLocaleString('id-ID');
const rp = (n: number) => `Rp ${num(n)}`;
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${num(Math.abs(n))}`;
const when = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
const monthName = (key: string) =>
  new Date(`${key}-01T00:00:00Z`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const isPro = (u: Pick<CoinUser, 'plan' | 'expired_at'>) =>
  u.plan === 'PRO' && (!u.expired_at || u.expired_at > new Date().toISOString());
const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));

type Tab = 'ringkasan' | 'pengguna' | 'riwayat' | 'aturan' | 'tarik';
const TABS: { id: Tab; label: string; icon: typeof Coins }[] = [
  { id: 'ringkasan', label: 'Ringkasan', icon: Sparkles },
  { id: 'pengguna', label: 'Pengguna', icon: Users },
  { id: 'riwayat', label: 'Riwayat', icon: History },
  { id: 'aturan', label: 'Aturan', icon: Settings2 },
  { id: 'tarik', label: 'Tarik tunai (lama)', icon: Wallet },
];

const Card = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={cn('rounded-2xl border border-slate-100 bg-white p-5 shadow-sm md:p-6', className)}>{children}</div>
);
const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="py-8 text-center text-sm text-slate-400">{children}</p>
);

function LedgerList({ rows, showUser = true }: { rows: LedgerRow[]; showUser?: boolean }) {
  if (!rows.length) return <Empty>Belum ada catatan.</Empty>;
  return (
    <div className="divide-y divide-slate-100">
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-3 py-3">
          <div
            className={cn(
              'grid h-9 w-9 shrink-0 place-items-center rounded-xl',
              r.amount >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600',
            )}
          >
            {r.amount >= 0 ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide',
                  groupTone(r.kind),
                )}
              >
                {kindLabel(r.kind)}
              </span>
              {showUser && (
                <span className="truncate text-sm font-bold text-slate-800">{r.user_name || r.user_email || '—'}</span>
              )}
            </div>
            <p className="truncate text-xs text-slate-400">
              {when(r.created_at)}
              {showUser && r.user_name && r.user_email ? ` · ${r.user_email}` : ''}
              {r.note ? ` · ${r.note}` : ''}
            </p>
          </div>
          <p
            className={cn(
              'shrink-0 text-sm font-black tabular-nums',
              r.amount >= 0 ? 'text-emerald-600' : 'text-rose-600',
            )}
          >
            {signed(r.amount)}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Ringkasan ───────────────────────────────────────────────────────────────
function SummaryTab({ s, goTab }: { s: Summary; goTab: (t: Tab) => void }) {
  const flows = [
    { label: 'Dibeli (top up)', value: s.bought, color: 'bg-sky-400' },
    { label: 'Hadiah', value: s.rewards, color: 'bg-amber-400' },
    { label: 'Penyesuaian admin', value: Math.max(0, s.adjusted), color: 'bg-emerald-400' },
  ];
  const inTotal = flows.reduce((a, f) => a + f.value, 0) || 1;
  const kinds = [...s.byKind].sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 p-6 text-white shadow-lg shadow-orange-200/60 md:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/15" />
        <div className="pointer-events-none absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-white/10" />
        <p className="text-xs font-black uppercase tracking-widest text-white/80">Koin beredar</p>
        <p className="mt-1 text-4xl font-black tracking-tight md:text-5xl">{num(s.circulating)}</p>
        <p className="mt-1 text-sm font-semibold text-white/85">
          ≈ {rp(s.circulating)} nilai pakai · dipegang {num(s.holders)} pengguna
        </p>
        <p className="mt-4 inline-flex rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold">
          1 koin = Rp 1 · tidak bisa dicairkan
        </p>
      </div>

      {(s.pendingTopups.count > 0 || s.pendingWithdrawals > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          {s.pendingTopups.count > 0 && (
            <Link
              href="/admin/pembayaran"
              className="flex items-center gap-3 rounded-2xl border border-sky-100 bg-sky-50 p-4 transition hover:bg-sky-100"
            >
              <ShoppingBag className="text-sky-600" size={20} />
              <div className="flex-1">
                <p className="text-sm font-black text-sky-900">{s.pendingTopups.count} top up menunggu dicek</p>
                <p className="text-xs text-sky-700">Total {rp(s.pendingTopups.amount)} — buka Pembayaran</p>
              </div>
            </Link>
          )}
          {s.pendingWithdrawals > 0 && (
            <button
              type="button"
              onClick={() => goTab('tarik')}
              className="flex items-center gap-3 rounded-2xl border border-orange-100 bg-orange-50 p-4 text-left transition hover:bg-orange-100"
            >
              <Wallet className="text-orange-600" size={20} />
              <div className="flex-1">
                <p className="text-sm font-black text-orange-900">
                  {s.pendingWithdrawals} tarik tunai lama belum diproses
                </p>
                <p className="text-xs text-orange-700">Pengajuan sebelum penarikan ditutup</p>
              </div>
            </button>
          )}
        </div>
      )}

      <div>
        <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">{monthName(s.month.key)}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <AdminStatCard
            label="Dibeli"
            value={num(s.month.bought)}
            note={`≈ ${rp(s.month.bought)} pemasukan`}
            icon={ShoppingBag}
            color="text-sky-600"
            bg="bg-sky-50"
          />
          <AdminStatCard
            label="Hadiah keluar"
            value={num(s.month.rewards)}
            note="Daftar, referral, streak"
            icon={Gift}
            color="text-amber-600"
            bg="bg-amber-50"
          />
          <AdminStatCard
            label="Dipakai"
            value={num(s.month.spent)}
            note="PRO, ilustrasi AI, dll."
            icon={Sparkles}
            color="text-violet-600"
            bg="bg-violet-50"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <p className="text-sm font-black text-slate-900">Asal koin (sepanjang waktu)</p>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-100">
            {flows.map((f) => (
              <div key={f.label} className={f.color} style={{ width: `${(f.value / inTotal) * 100}%` }} />
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {flows.map((f) => (
              <div key={f.label} className="flex items-center gap-2 text-sm">
                <span className={cn('h-2.5 w-2.5 rounded-full', f.color)} />
                <span className="flex-1 text-slate-600">{f.label}</span>
                <span className="font-bold tabular-nums text-slate-900">{num(f.value)}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 border-t border-slate-100 pt-2 text-sm">
              <span className="h-2.5 w-2.5 rounded-full bg-violet-400" />
              <span className="flex-1 text-slate-600">Sudah dipakai</span>
              <span className="font-bold tabular-nums text-slate-900">{num(s.spent)}</span>
            </div>
            {s.adjusted < 0 && <p className="text-xs text-slate-400">Pengurangan admin: {num(Math.abs(s.adjusted))}</p>}
          </div>
        </Card>
        <Card>
          <p className="text-sm font-black text-slate-900">Per jenis transaksi</p>
          {kinds.length === 0 ? (
            <Empty>Belum ada transaksi koin.</Empty>
          ) : (
            <div className="mt-3 divide-y divide-slate-100">
              {kinds.map((k) => (
                <div key={k.kind} className="flex items-center gap-2 py-2.5 text-sm">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide',
                      groupTone(k.kind),
                    )}
                  >
                    {kindLabel(k.kind)}
                  </span>
                  <span className="flex-1 text-xs text-slate-400">{num(k.n)}×</span>
                  <span className={cn('font-bold tabular-nums', k.total >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                    {signed(k.total)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ── Pengguna ────────────────────────────────────────────────────────────────
function UsersTab({ onChanged }: { onChanged: () => void }) {
  const { toast, confirm } = useFeedback();
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<CoinUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<CoinUser | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[] | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [reqId, setReqId] = useState(uuid);
  const [busy, setBusy] = useState(false);

  const search = useCallback(
    async (term: string) => {
      setLoading(true);
      try {
        const res = await cloudflareApi<{ items: CoinUser[] }>(`/api/admin/coins/users?q=${encodeURIComponent(term)}`);
        setUsers(res.items || []);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Gagal memuat pengguna.');
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );
  useEffect(() => {
    const t = setTimeout(() => void search(q), 300);
    return () => clearTimeout(t);
  }, [q, search]);

  const openUser = async (u: CoinUser) => {
    setSel(u);
    setLedger(null);
    setAmount('');
    setNote('');
    setDir(1);
    setReqId(uuid());
    try {
      const res = await cloudflareApi<{ items: LedgerRow[] }>(
        `/api/admin/coins/ledger?user=${encodeURIComponent(u.id)}`,
      );
      setLedger(res.items || []);
    } catch {
      setLedger([]);
    }
  };

  const value = Math.floor(Number(amount.replace(/\D/g, '')) || 0);
  const submit = async () => {
    if (!sel || !value) return;
    if (note.trim().length < 3) {
      toast.error('Tulis alasannya dulu.');
      return;
    }
    const delta = dir * value;
    const ok = await confirm({
      title: `${dir > 0 ? 'Tambah' : 'Kurangi'} ${num(value)} koin?`,
      message: `${sel.name || sel.email} — saldo ${num(sel.balance)} → ${num(sel.balance + delta)}. Alasan: ${note.trim()}`,
      confirmLabel: dir > 0 ? 'Tambahkan' : 'Kurangi',
      danger: dir < 0,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await cloudflareApi<{ ok: true; balance: number }>('/api/admin/coins/adjust', {
        method: 'POST',
        json: { user_id: sel.id, amount: delta, note: note.trim(), request_id: reqId },
      });
      toast.success(`Saldo baru: ${num(res.balance)} koin.`);
      const next = { ...sel, balance: res.balance, last_at: new Date().toISOString() };
      setUsers((list) => list.map((x) => (x.id === sel.id ? next : x)));
      await openUser(next);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <Card className="p-0 md:p-0">
        <div className="border-b border-slate-100 p-4">
          <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
            <Search size={16} className="text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari nama atau email…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </label>
        </div>
        {loading && !users.length ? (
          <Empty>Memuat…</Empty>
        ) : !users.length ? (
          <Empty>Tidak ada pengguna yang cocok.</Empty>
        ) : (
          <div className="max-h-[640px] divide-y divide-slate-100 overflow-y-auto">
            {users.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => void openUser(u)}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50',
                  sel?.id === u.id && 'bg-amber-50/70 hover:bg-amber-50',
                )}
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-100 to-orange-100 text-sm font-black text-orange-700">
                  {(u.name || u.email).slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-bold text-slate-900">
                    {u.name || '—'}
                    {isPro(u) && (
                      <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[9px] font-black text-indigo-600">
                        PRO
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-slate-400">{u.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black tabular-nums text-slate-900">{num(u.balance)}</p>
                  <p className="text-[10px] text-slate-400">{u.last_at ? when(u.last_at) : 'belum ada'}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      <div className="lg:sticky lg:top-6 lg:self-start">
        {!sel ? (
          <Card className="text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-600">
              <Coins size={22} />
            </div>
            <p className="mt-3 text-sm font-bold text-slate-700">Pilih pengguna</p>
            <p className="mt-1 text-xs text-slate-400">
              Lihat riwayat koin dan tambah/kurangi saldo (kompensasi, koreksi top up).
            </p>
          </Card>
        ) : (
          <Card className="space-y-5">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-black text-slate-900">{sel.name || '—'}</p>
                <p className="truncate text-xs text-slate-400">{sel.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setSel(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                aria-label="Tutup"
              >
                <X size={16} />
              </button>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 p-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-orange-500">Saldo</p>
              <p className="text-3xl font-black tabular-nums text-slate-900">
                {num(sel.balance)} <span className="text-sm font-bold text-slate-400">koin</span>
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Penyesuaian</p>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                {([1, -1] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDir(d)}
                    className={cn(
                      'rounded-lg py-2 text-sm font-bold transition',
                      dir === d
                        ? d > 0
                          ? 'bg-white text-emerald-600 shadow-sm'
                          : 'bg-white text-rose-600 shadow-sm'
                        : 'text-slate-500',
                    )}
                  >
                    {d > 0 ? '+ Tambah' : '− Kurangi'}
                  </button>
                ))}
              </div>
              <input
                inputMode="numeric"
                value={value ? num(value) : ''}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Jumlah koin"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold tabular-nums outline-none focus:border-amber-400"
              />
              <div className="flex flex-wrap gap-1.5">
                {[1000, 5000, 15000].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setAmount(String(n))}
                    className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-200"
                  >
                    {num(n)}
                  </button>
                ))}
              </div>
              <input
                value={note}
                maxLength={120}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Alasan (dilihat di riwayat pengguna)"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-amber-400"
              />
              {dir < 0 && value > sel.balance && (
                <p className="text-xs font-semibold text-rose-600">Melebihi saldo — server akan menolak.</p>
              )}
              <button
                type="button"
                disabled={busy || !value || note.trim().length < 3}
                onClick={() => void submit()}
                className={cn(
                  'w-full rounded-xl py-3 text-sm font-black text-white transition disabled:opacity-50',
                  dir > 0 ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700',
                )}
              >
                {busy ? 'Menyimpan…' : `${dir > 0 ? 'Tambah' : 'Kurangi'} ${value ? num(value) : ''} koin`}
              </button>
            </div>

            <div>
              <p className="mb-1 text-xs font-black uppercase tracking-widest text-slate-400">Riwayat</p>
              <div className="max-h-[320px] overflow-y-auto">
                {ledger === null ? <Empty>Memuat…</Empty> : <LedgerList rows={ledger} showUser={false} />}
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ── Riwayat ─────────────────────────────────────────────────────────────────
function LedgerTab() {
  const [group, setGroup] = useState<Group | ''>('');
  const [rows, setRows] = useState<LedgerRow[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    cloudflareApi<{ items: LedgerRow[] }>(`/api/admin/coins/ledger${group ? `?group=${group}` : ''}`)
      .then((res) => {
        if (alive) {
          setRows(res.items || []);
          setError('');
        }
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : 'Gagal memuat riwayat.');
      });
    return () => {
      alive = false;
    };
  }, [group]);
  const total = useMemo(() => (rows ?? []).reduce((a, r) => a + r.amount, 0), [rows]);
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        {[{ id: '' as const, label: 'Semua', tone: '' }, ...GROUPS].map((g) => (
          <button
            key={g.id || 'all'}
            type="button"
            onClick={() => {
              setRows(null);
              setGroup(g.id);
            }}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-bold transition',
              group === g.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            {g.label}
          </button>
        ))}
        {rows && rows.length > 0 && (
          <span className="ml-auto text-xs text-slate-400">
            {num(rows.length)} baris · bersih{' '}
            <b className={total >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{signed(total)}</b>
          </span>
        )}
      </div>
      <div className="mt-3">
        {error ? (
          <p className="py-6 text-sm text-rose-600">{error}</p>
        ) : rows === null ? (
          <Empty>Memuat…</Empty>
        ) : (
          <LedgerList rows={rows} />
        )}
      </div>
      {rows && rows.length >= 300 && (
        <p className="mt-2 text-center text-xs text-slate-400">Menampilkan 300 terbaru.</p>
      )}
    </Card>
  );
}

// ── Aturan ──────────────────────────────────────────────────────────────────
function RulesTab({ s }: { s: Summary }) {
  const r = s.rules;
  const rows: { label: string; value: string; note?: string }[] = [
    { label: 'Bonus daftar', value: `${num(r.signup)} koin` },
    {
      label: 'Referral aktif (pengundang)',
      value: `${num(r.refActiveReferrer)} koin`,
      note: `Teman ≥ ${r.activeMinTx} transaksi di ≥ ${r.activeMinDays} hari, dalam ${r.refWindowDays} hari · maks ${r.refActiveMonthlyCap}/bulan`,
    },
    { label: 'Referral aktif (yang diundang)', value: `${num(r.refActiveReferee)} koin` },
    { label: 'Referral jadi PRO', value: `${num(r.refPro)} koin` },
    { label: 'Streak', value: `${num(r.streak)} koin` },
    { label: 'Tukar PRO', value: `${num(r.proMonthCost)} koin / bulan` },
    {
      label: 'Ilustrasi AI Cerita',
      value: `${num(r.storyAiPrice)} koin`,
      note: `PRO dapat ${r.storyAiFreePro} gratis per bulan`,
    },
  ];
  const AI_LABEL: Record<string, string> = {
    chat: 'Chat Leo',
    scan: 'Scan struk',
    voice: 'Catat lewat suara',
    meal: 'Analisis makanan',
  };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <p className="text-sm font-black text-slate-900">Hadiah & harga</p>
        <div className="mt-3 divide-y divide-slate-100">
          {rows.map((x) => (
            <div key={x.label} className="py-2.5">
              <div className="flex items-center gap-2 text-sm">
                <span className="flex-1 text-slate-600">{x.label}</span>
                <span className="font-black text-slate-900">{x.value}</span>
              </div>
              {x.note && <p className="mt-0.5 text-xs text-slate-400">{x.note}</p>}
            </div>
          ))}
        </div>
      </Card>
      <div className="space-y-6">
        <Card>
          <p className="text-sm font-black text-slate-900">Paket top up</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {s.packages.map((p) => (
              <div key={p.id} className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
                <p className="text-lg font-black text-slate-900">{num(p.coins)}</p>
                <p className="text-xs text-slate-500">koin · {rp(p.price)}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <p className="text-sm font-black text-slate-900">Kuota AI harian</p>
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-100">
            <div className="grid grid-cols-3 bg-slate-50 px-3 py-2 text-[11px] font-black uppercase tracking-widest text-slate-400">
              <span>Fitur</span>
              <span className="text-right">FREE</span>
              <span className="text-right">PRO</span>
            </div>
            {Object.entries(s.aiLimits).map(([k, v]) => (
              <div key={k} className="grid grid-cols-3 border-t border-slate-100 px-3 py-2 text-sm">
                <span className="text-slate-600">{AI_LABEL[k] ?? k}</span>
                <span className="text-right font-bold">{v.FREE}</span>
                <span className="text-right font-bold text-indigo-600">{v.PRO}</span>
              </div>
            ))}
          </div>
        </Card>
        <p className="px-1 text-xs text-slate-400">
          Aturan ini tertulis di server (Worker). Mengubahnya butuh deploy — biar gak bisa diubah sembarangan dari
          panel.
        </p>
      </div>
    </div>
  );
}

// ── Tarik tunai (lama) ──────────────────────────────────────────────────────
// Penarikan sudah ditutup; pengajuan lama tetap diproses di sini. "Tolak"
// mengembalikan koin otomatis (sekali saja).
function WithdrawTab({ onChanged }: { onChanged: () => void }) {
  const { toast, confirm } = useFeedback();
  const [rows, setRows] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await cloudflareApi<{ items: WithdrawalRow[] }>('/api/admin/coin-withdrawals');
      setRows(res.items || []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const act = async (row: WithdrawalRow, status: 'DIBAYAR' | 'DITOLAK') => {
    let note: string | null = null;
    if (status === 'DIBAYAR') {
      const ok = await confirm({
        title: `Sudah transfer ${rp(row.amount_idr)}?`,
        message: `Ke ${row.method} ${row.account_number} a.n. ${row.account_name}. Tandai dibayar hanya setelah uangnya benar-benar terkirim.`,
        confirmLabel: 'Sudah dibayar',
      });
      if (!ok) return;
    } else {
      note = window.prompt('Alasan penolakan (dilihat member):', 'Penarikan koin sudah ditutup — koin dikembalikan');
      if (note === null) return;
    }
    setBusy(row.id);
    try {
      await cloudflareApi(`/api/admin/coin-withdrawals/${row.id}`, { method: 'PATCH', json: { status, note } });
      toast.success(status === 'DIBAYAR' ? 'Ditandai dibayar.' : 'Ditolak — koin dikembalikan.');
      await load();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memproses.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <p className="mb-2 text-xs text-slate-400">
        Penarikan koin sudah ditutup untuk member. Pengajuan lama yang masih menunggu diproses di sini.
      </p>
      {loading ? (
        <Empty>Memuat…</Empty>
      ) : error ? (
        <p className="py-6 text-sm text-rose-600">{error}</p>
      ) : rows.length === 0 ? (
        <Empty>Tidak ada pengajuan tarik tunai.</Empty>
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map((r) => (
            <div key={r.id} className="flex flex-col gap-3 py-4 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900">
                  {r.user_name || '—'} <span className="font-medium text-slate-400">· {r.user_email}</span>
                </p>
                <p className="text-sm text-slate-600">
                  <span className="font-bold">{rp(r.amount_idr)}</span> ({num(r.coins)} koin) → {r.method}{' '}
                  <span className="font-mono">{r.account_number}</span> a.n. {r.account_name}
                </p>
                <p className="text-xs text-slate-400">
                  Diajukan {when(r.created_at)}
                  {r.processed_at ? ` · diproses ${when(r.processed_at)}` : ''}
                  {r.admin_note ? ` · ${r.admin_note}` : ''}
                </p>
              </div>
              {r.status === 'MENUNGGU' ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy === r.id}
                    onClick={() => act(r, 'DIBAYAR')}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                  >
                    Sudah dibayar
                  </button>
                  <button
                    type="button"
                    disabled={busy === r.id}
                    onClick={() => act(r, 'DITOLAK')}
                    className="rounded-xl bg-rose-50 px-4 py-2 text-sm font-bold text-rose-600 disabled:opacity-60"
                  >
                    Tolak & kembalikan
                  </button>
                </div>
              ) : (
                <span
                  className={cn(
                    'self-start rounded-full px-3 py-1 text-xs font-bold md:self-center',
                    r.status === 'DIBAYAR' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700',
                  )}
                >
                  {r.status === 'DIBAYAR' ? 'Dibayar' : 'Ditolak'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function AdminKoinContent() {
  const [tab, setTab] = useState<Tab>('ringkasan');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');

  const loadSummary = useCallback(async () => {
    try {
      const res = await cloudflareApi<Summary>('/api/admin/coins/summary');
      setSummary(res);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat ringkasan koin.');
    }
  }, []);
  useEffect(() => {
    let alive = true;
    cloudflareApi<Summary>('/api/admin/coins/summary')
      .then((res) => {
        if (alive) setSummary(res);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : 'Gagal memuat ringkasan koin.');
      });
    return () => {
      alive = false;
    };
  }, []);

  const needsSummary = tab === 'ringkasan' || tab === 'aturan';
  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-16">
      <AdminPageHeader
        title="Koin"
        description="Ekonomi koin Leosiqra: saldo pengguna, riwayat, penyesuaian manual, dan aturan hadiah."
      />

      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {TABS.filter(
          (t) =>
            t.id !== 'tarik' ||
            (summary?.pendingWithdrawals ?? 0) > 0 ||
            tab === 'tarik' ||
            (summary?.byKind ?? []).some((k) => k.kind === 'withdraw'),
        ).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition',
                tab === t.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 ring-1 ring-slate-100 hover:bg-slate-50',
              )}
            >
              <Icon size={15} />
              {t.label}
              {t.id === 'tarik' && (summary?.pendingWithdrawals ?? 0) > 0 && (
                <span className="rounded-full bg-orange-500 px-1.5 text-[10px] text-white">
                  {summary?.pendingWithdrawals}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {needsSummary &&
        (error ? (
          <Card>
            <p className="text-sm text-rose-600">{error}</p>
          </Card>
        ) : !summary ? (
          <Card>
            <Empty>Memuat…</Empty>
          </Card>
        ) : tab === 'ringkasan' ? (
          <SummaryTab s={summary} goTab={setTab} />
        ) : (
          <RulesTab s={summary} />
        ))}
      {tab === 'pengguna' && <UsersTab onChanged={() => void loadSummary()} />}
      {tab === 'riwayat' && <LedgerTab />}
      {tab === 'tarik' && <WithdrawTab onChanged={() => void loadSummary()} />}
    </div>
  );
}

// Layout admin tidak memasang FeedbackProvider — halaman ini membawanya sendiri.
export default function AdminKoinPage() {
  return (
    <FeedbackProvider>
      <AdminKoinContent />
    </FeedbackProvider>
  );
}
