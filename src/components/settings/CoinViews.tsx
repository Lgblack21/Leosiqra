"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, Gift, Users, Crown, Banknote, Flame, Undo2, ArrowDownLeft, Share2, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { useFeedback } from '@/components/ui/Feedback';
import { PROFILE_UPDATED_EVENT } from '@/components/settings/ProfileEditView';

// Koin Leosiqra & referral (panel Pengaturan). Semua angka & aturan datang
// dari server (/api/member/coins → rules) — halaman ini tidak menghitung
// saldo sendiri, hanya menampilkan & mengirim permintaan.

export type CoinView = 'referral' | 'koin' | 'koin-riwayat';

type LedgerRow = { id: string; amount: number; kind: string; note: string | null; created_at: string };
type Withdrawal = { id: string; coins: number; amount_idr: number; method: string; status: 'MENUNGGU' | 'DIBAYAR' | 'DITOLAK'; admin_note: string | null; created_at: string };
type CoinRules = {
  signup: number; refActiveReferrer: number; refActiveReferee: number; refPro: number; streak: number;
  proMonthCost: number; withdrawMin: number; idrPerCoin: number; refWindowDays: number; activeMinTx: number; activeMinDays: number;
};
export type CoinData = {
  balance: number;
  cashable: number;
  code: string;
  referred: boolean;
  canApplyCode: boolean;
  friends: { total: number; active: number };
  earned: number;
  fromReferralIdr: number;
  history: LedgerRow[];
  withdrawals: Withdrawal[];
  rules: CoinRules;
};

const nf = (n: number) => n.toLocaleString('id-ID');
const rp = (n: number) => `Rp ${nf(n)}`;
const shortDate = (iso: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(iso));

const KIND: Record<string, { label: string; icon: React.ElementType }> = {
  signup: { label: 'Hadiah selamat datang', icon: Gift },
  ref_active: { label: 'Teman aktif mencatat', icon: Users },
  ref_active_referee: { label: 'Bonus dari kode teman', icon: Gift },
  ref_pro: { label: 'Teman berlangganan PRO', icon: Crown },
  streak: { label: 'Mencatat 30 hari berturut-turut', icon: Flame },
  redeem_pro: { label: 'Tukar ke PRO', icon: Sparkles },
  withdraw: { label: 'Tarik tunai', icon: Banknote },
  withdraw_refund: { label: 'Tarik tunai dikembalikan', icon: Undo2 },
};

export function CoinIcon({ size = 20 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 shadow-[inset_0_-2px_0_rgba(0,0,0,0.15)] ring-1 ring-amber-500/60"
      style={{ width: size, height: size, fontSize: size * 0.58 }}
    >
      🦁
    </span>
  );
}

// Satu sumber data untuk ketiga tampilan; dimuat ulang sesudah tukar/tarik.
export function useCoins() {
  const [data, setData] = useState<CoinData | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      setData(await cloudflareApi<CoinData>('/api/member/coins'));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat koin.');
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- muat data koin sekali saat dibuka
    void load();
  }, [load]);
  return { data, error, reload: load };
}

const Group = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('divide-y divide-slate-200/60 overflow-hidden rounded-[22px] bg-slate-50', className)}>{children}</div>
);
const Label = ({ children }: { children: React.ReactNode }) => <p className="px-1 pb-2 pt-1 text-[14px] text-slate-500">{children}</p>;

function HistoryList({ rows }: { rows: LedgerRow[] }) {
  if (!rows.length) return <p className="px-5 py-4 text-[14px] text-slate-500">Belum ada riwayat koin.</p>;
  return (
    <>
      {rows.map((r) => {
        const k = KIND[r.kind] ?? { label: r.note || 'Koin', icon: ArrowDownLeft };
        const Icon = k.icon;
        return (
          <div key={r.id} className="flex items-center gap-4 px-5 py-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
              <Icon size={18} className="text-slate-600" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium text-slate-900">{k.label}</span>
              <span className="block text-[13px] text-slate-500">{shortDate(r.created_at)}</span>
            </span>
            <span className={cn('flex items-center gap-1.5 text-[15px] font-semibold', r.amount > 0 ? 'text-emerald-600' : 'text-slate-700')}>
              {r.amount > 0 ? '+' : '−'} <CoinIcon size={16} /> {nf(Math.abs(r.amount))}
            </span>
          </div>
        );
      })}
    </>
  );
}

function Unavailable({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="space-y-3 rounded-[22px] bg-slate-50 p-5 text-center">
      <p className="text-[14px] text-slate-600">{error}</p>
      <button type="button" onClick={onRetry} className="rounded-full bg-white px-4 py-2 text-[14px] font-semibold text-slate-800 ring-1 ring-slate-200">Coba lagi</button>
    </div>
  );
}

function CodeInput({ onApplied }: { onApplied: () => void }) {
  const { toast } = useFeedback();
  const [chars, setChars] = useState<string[]>(Array(6).fill(''));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const code = chars.join('');

  const setAt = (i: number, raw: string) => {
    const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setErr('');
    if (clean.length > 1) {
      // Tempel kode utuh.
      const next = clean.slice(0, 6).split('');
      setChars([...next, ...Array(6 - next.length).fill('')]);
      refs.current[Math.min(next.length, 5)]?.focus();
      return;
    }
    setChars((c) => c.map((v, j) => (j === i ? clean : v)));
    if (clean && i < 5) refs.current[i + 1]?.focus();
  };

  const apply = async () => {
    setBusy(true);
    try {
      await cloudflareApi('/api/member/coins/apply-code', { method: 'POST', json: { code } });
      toast.success('Kode dipakai! Bonus cair setelah kamu aktif mencatat.');
      onApplied();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal memakai kode.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-[22px] bg-slate-50 p-4">
      <div className="flex justify-center gap-2">
        {chars.map((v, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            value={v}
            onChange={(e) => setAt(i, e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Backspace' && !v && i > 0) refs.current[i - 1]?.focus(); }}
            maxLength={6}
            aria-label={`Karakter kode ${i + 1}`}
            autoCapitalize="characters"
            className="h-12 w-11 rounded-xl bg-white text-center text-[18px] font-bold uppercase text-slate-900 ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-indigo-400"
          />
        ))}
      </div>
      <p className={cn('text-center text-[13px]', err ? 'text-rose-600' : 'text-slate-500')}>{err || 'Kode bisa ditambahkan dalam 30 hari pertama akunmu.'}</p>
      <button type="button" onClick={apply} disabled={code.length !== 6 || busy} className="w-full rounded-full bg-slate-900 py-3 text-[15px] font-bold text-white disabled:bg-slate-200 disabled:text-slate-400">
        {busy ? 'Memproses…' : 'Pakai kode'}
      </button>
    </div>
  );
}

function ReferralView({ coins, go, openPaket }: { coins: ReturnType<typeof useCoins>; go: (v: CoinView) => void; openPaket: () => void }) {
  const { toast } = useFeedback();
  const { data, error, reload } = coins;
  if (!data) return error ? <Unavailable error={error} onRetry={reload} /> : <p className="py-10 text-center text-[14px] text-slate-400">Memuat…</p>;
  const r = data.rules;

  const share = async () => {
    const link = `${window.location.origin}/auth/register?ref=${data.code}`;
    const text = `Yuk catat keuangan bareng Leosiqra! Daftar lewat link ini & pakai kode ${data.code} biar dapat bonus koin.`;
    try {
      if (navigator.share) await navigator.share({ title: 'Leosiqra', text, url: link });
      else {
        await navigator.clipboard.writeText(`${text} ${link}`);
        toast.success('Link ajakan disalin.');
      }
    } catch {
      // dibatalkan user — tidak apa-apa
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-3 pb-1 pt-2">
        <p className="text-[15px] text-slate-500">Saldo koin</p>
        <p className="flex items-center gap-3 text-[52px] font-bold leading-none tracking-tight text-slate-900">
          {nf(data.balance)} <CoinIcon size={46} />
        </p>
        <button type="button" onClick={openPaket} className="flex items-center gap-1 rounded-full bg-slate-100 px-4 py-1.5 text-[14px] text-slate-600 hover:bg-slate-200">
          Lihat paket <ChevronRight size={15} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={share} className="flex items-center justify-center gap-2 rounded-full bg-slate-900 py-3.5 text-[15px] font-bold text-white">
          <Share2 size={16} /> Ajak teman
        </button>
        <button type="button" onClick={() => go('koin')} className="rounded-full bg-slate-100 py-3.5 text-[15px] font-bold text-slate-800 hover:bg-slate-200">
          Kelola koin
        </button>
      </div>
      <div className="flex items-center justify-between rounded-[22px] bg-indigo-50 px-5 py-3.5">
        <span className="text-[14px] text-indigo-900/70">Kode kamu</span>
        <span className="font-mono text-[18px] font-bold tracking-[0.2em] text-indigo-700">{data.code}</span>
      </div>

      <Group>
        <div className="flex items-center gap-3 px-5 py-3.5">
          <CoinIcon size={20} />
          <span className="flex-1 text-[15px] text-slate-600">Hadiah</span>
          <span className="text-[15px] font-semibold text-slate-900">
            {data.friends.total ? `${data.friends.total} teman · ${data.friends.active} aktif` : 'Belum ada teman'}
          </span>
        </div>
        <div className="grid grid-cols-2 divide-x divide-slate-200/60 py-4 text-center">
          <div>
            <p className="text-[13px] text-slate-500">Koin didapat</p>
            <p className="mt-1 text-[24px] font-bold text-slate-900">{nf(data.earned)}</p>
          </div>
          <div>
            <p className="text-[13px] text-slate-500">Dari referral</p>
            <p className="mt-1 text-[24px] font-bold text-slate-900">{rp(data.fromReferralIdr)}</p>
          </div>
        </div>
      </Group>

      <Label>Cara dapat koin</Label>
      <Group>
        {[
          ['Teman pakai kodemu & aktif mencatat', `+${nf(r.refActiveReferrer)}`, `Aktif = ${r.activeMinTx} transaksi di ${r.activeMinDays} hari berbeda. Temanmu dapat +${nf(r.refActiveReferee)}.`],
          ['Teman berlangganan PRO', `+${nf(r.refPro)}`, 'Bisa ditarik tunai. Sekali per teman.'],
          ['Mencatat 30 hari berturut-turut', `+${nf(r.streak)}`, 'Maksimal sekali per bulan.'],
        ].map(([t, v, d]) => (
          <div key={t} className="flex items-center gap-4 px-5 py-3.5">
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium text-slate-900">{t}</span>
              <span className="block text-[13px] leading-snug text-slate-500">{d}</span>
            </span>
            <span className="flex items-center gap-1.5 text-[15px] font-semibold text-emerald-600">{v} <CoinIcon size={16} /></span>
          </div>
        ))}
      </Group>

      <Label>Riwayat koin</Label>
      <Group>
        <HistoryList rows={data.history.slice(0, 3)} />
        {data.history.length > 3 && (
          <button type="button" onClick={() => go('koin-riwayat')} className="flex w-full items-center px-5 py-4 text-left text-[15px] text-slate-900 hover:bg-slate-100/70">
            <span className="flex-1">Lihat semua</span> <ChevronRight size={18} className="text-slate-400" />
          </button>
        )}
      </Group>

      {data.canApplyCode && (
        <>
          <Label>Punya kode referral?</Label>
          <CodeInput onApplied={reload} />
        </>
      )}
    </div>
  );
}

function KelolaKoinView({ coins }: { coins: ReturnType<typeof useCoins> }) {
  const { toast, confirm } = useFeedback();
  const { data, error, reload } = coins;
  const [months, setMonths] = useState(1);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ coins: '', method: '', accountName: '', accountNumber: '' });
  const [wErr, setWErr] = useState('');
  if (!data) return error ? <Unavailable error={error} onRetry={reload} /> : <p className="py-10 text-center text-[14px] text-slate-400">Memuat…</p>;
  const r = data.rules;
  const cost = r.proMonthCost * months;
  const pending = data.withdrawals.some((w) => w.status === 'MENUNGGU');

  const redeem = async () => {
    const ok = await confirm({ title: `Tukar ${nf(cost)} koin?`, message: `PRO ${months} bulan langsung aktif (ditambahkan ke masa aktif sekarang).`, confirmLabel: 'Tukar' });
    if (!ok) return;
    setBusy(true);
    try {
      await cloudflareApi('/api/member/coins/redeem-pro', { method: 'POST', json: { months } });
      toast.success(`PRO ${months} bulan aktif!`);
      window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menukar koin.');
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    setWErr('');
    const n = Math.floor(Number(form.coins.replace(/\D/g, '')));
    if (!n || n < r.withdrawMin) { setWErr(`Minimal ${nf(r.withdrawMin)} koin.`); return; }
    if (n > data.cashable) { setWErr(`Koin yang bisa ditarik: ${nf(data.cashable)}.`); return; }
    const ok = await confirm({ title: `Tarik ${rp(n * r.idrPerCoin)}?`, message: `Ke ${form.method} ${form.accountNumber} a.n. ${form.accountName}. Koin dikunci sampai admin memproses (biasanya 1–3 hari kerja).`, confirmLabel: 'Ajukan' });
    if (!ok) return;
    setBusy(true);
    try {
      await cloudflareApi('/api/member/coins/withdraw', { method: 'POST', json: { ...form, coins: n } });
      toast.success('Pengajuan tarik tunai terkirim.');
      setForm({ coins: '', method: '', accountName: '', accountNumber: '' });
      await reload();
    } catch (e) {
      setWErr(e instanceof Error ? e.message : 'Gagal mengajukan.');
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full rounded-2xl bg-white px-4 py-3 text-[15px] ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-indigo-400';
  const STATUS = { MENUNGGU: 'bg-amber-100 text-amber-700', DIBAYAR: 'bg-emerald-100 text-emerald-700', DITOLAK: 'bg-rose-100 text-rose-700' } as const;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[22px] bg-slate-50 p-4">
          <p className="text-[13px] text-slate-500">Saldo koin</p>
          <p className="mt-1 flex items-center gap-2 text-[24px] font-bold text-slate-900">{nf(data.balance)} <CoinIcon size={20} /></p>
        </div>
        <div className="rounded-[22px] bg-slate-50 p-4">
          <p className="text-[13px] text-slate-500">Bisa ditarik</p>
          <p className="mt-1 text-[24px] font-bold text-slate-900">{rp(data.cashable * r.idrPerCoin)}</p>
        </div>
      </div>

      <Label>Tukar ke PRO</Label>
      <div className="space-y-3 rounded-[22px] bg-slate-50 p-4">
        <div className="grid grid-cols-3 gap-2">
          {[1, 3, 6].map((m) => (
            <button key={m} type="button" onClick={() => setMonths(m)} className={cn('rounded-2xl px-2 py-3 text-center ring-1', months === m ? 'bg-white ring-2 ring-slate-900' : 'bg-white/60 ring-slate-200')}>
              <span className="block text-[15px] font-bold text-slate-900">{m} bulan</span>
              <span className="mt-0.5 flex items-center justify-center gap-1 text-[13px] text-slate-500">{nf(r.proMonthCost * m)} <CoinIcon size={13} /></span>
            </button>
          ))}
        </div>
        <button type="button" onClick={redeem} disabled={busy || data.balance < cost} className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-[15px] font-bold text-white disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Crown size={16} />}
          {data.balance < cost ? `Kurang ${nf(cost - data.balance)} koin` : `Tukar jadi PRO ${months} bulan`}
        </button>
      </div>

      <Label>Tarik tunai</Label>
      <div className="space-y-3 rounded-[22px] bg-slate-50 p-4">
        <p className="text-[13px] leading-snug text-slate-500">
          1 koin = Rp {nf(r.idrPerCoin)}, minimal {nf(r.withdrawMin)} koin. Hanya koin dari teman yang berlangganan PRO yang bisa ditarik; koin bonus lain bisa ditukar PRO. Ditransfer manual oleh admin.
        </p>
        {pending ? (
          <p className="rounded-2xl bg-amber-50 p-3 text-[14px] text-amber-800">Ada penarikan yang sedang diproses. Ajukan lagi setelah selesai.</p>
        ) : data.cashable < r.withdrawMin ? (
          <p className="rounded-2xl bg-white p-3 text-[14px] text-slate-500 ring-1 ring-slate-200">
            Kumpulkan {nf(r.withdrawMin - data.cashable)} koin tunai lagi untuk bisa menarik.
          </p>
        ) : (
          <>
            <input value={form.coins} onChange={(e) => setForm((f) => ({ ...f, coins: e.target.value }))} inputMode="numeric" placeholder={`Jumlah koin (maks ${nf(data.cashable)})`} className={input} />
            <input value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))} placeholder="Bank / e-wallet (mis. BCA, DANA)" className={input} />
            <input value={form.accountNumber} onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))} inputMode="numeric" placeholder="Nomor rekening / HP e-wallet" className={input} />
            <input value={form.accountName} onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))} placeholder="Nama pemilik" className={input} />
            {wErr && <p className="text-[13px] text-rose-600">{wErr}</p>}
            <button type="button" onClick={withdraw} disabled={busy} className="w-full rounded-full bg-slate-900 py-3.5 text-[15px] font-bold text-white disabled:opacity-60">Ajukan tarik tunai</button>
          </>
        )}
      </div>

      {data.withdrawals.length > 0 && (
        <>
          <Label>Riwayat tarik tunai</Label>
          <Group>
            {data.withdrawals.map((w) => (
              <div key={w.id} className="flex items-center gap-4 px-5 py-3.5">
                <Banknote size={20} className="shrink-0 text-slate-500" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium text-slate-900">{rp(w.amount_idr)} · {w.method}</span>
                  <span className="block text-[13px] text-slate-500">{shortDate(w.created_at)}{w.admin_note ? ` · ${w.admin_note}` : ''}</span>
                </span>
                <span className={cn('rounded-full px-2.5 py-1 text-[12px] font-semibold', STATUS[w.status])}>{w.status === 'MENUNGGU' ? 'Diproses' : w.status === 'DIBAYAR' ? 'Dibayar' : 'Ditolak'}</span>
              </div>
            ))}
          </Group>
        </>
      )}
    </div>
  );
}

// Ketiga tampilan berbagi satu pemuatan data supaya pindah tampilan tidak
// memuat ulang; dipasang oleh SettingsPanel.
export function CoinSection({ view, go, openPaket }: { view: CoinView; go: (v: CoinView) => void; openPaket: () => void }) {
  const coins = useCoins();
  if (view === 'koin') return <KelolaKoinView coins={coins} />;
  if (view === 'koin-riwayat') {
    if (!coins.data) return coins.error ? <Unavailable error={coins.error} onRetry={coins.reload} /> : <p className="py-10 text-center text-[14px] text-slate-400">Memuat…</p>;
    return <Group><HistoryList rows={coins.data.history} /></Group>;
  }
  return <ReferralView coins={coins} go={go} openPaket={openPaket} />;
}

// Baris ringkas di tampilan Profil: saldo + pintu ke Referral.
export function CoinProfileRows({ go }: { go: (v: CoinView) => void }) {
  const { data } = useCoins();
  return (
    <Group>
      <button type="button" onClick={() => go('koin')} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-slate-100/70">
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] text-slate-900">Koin Leosiqra</span>
          <span className="block text-[13px] text-slate-500">Tukar jadi PRO atau tarik tunai</span>
        </span>
        <span className="flex items-center gap-1.5 text-[16px] font-semibold text-slate-900"><CoinIcon size={18} /> {data ? nf(data.balance) : '—'}</span>
        <ChevronRight size={18} className="text-slate-400" />
      </button>
      <button type="button" onClick={() => go('referral')} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-slate-100/70">
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] text-slate-900">Referral</span>
          <span className="block text-[13px] text-slate-500">Ajak teman ke Leosiqra</span>
        </span>
        <ChevronRight size={18} className="text-slate-400" />
      </button>
    </Group>
  );
}
