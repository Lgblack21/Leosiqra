'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, Coins, Crown, ImageIcon, MessageCircle, Search, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminStatCard } from '@/components/admin/AdminStatCard';
import { FeedbackProvider, useFeedback } from '@/components/ui/Feedback';

type Status = 'MENUNGGU' | 'DISETUJUI' | 'DITOLAK' | 'GAGAL';
type PaymentRow = {
  id: string;
  user_id?: string;
  user_email?: string;
  user_name?: string;
  user_whatsapp?: string | null;
  user_photo_url?: string | null;
  package_id?: string | null;
  package_name?: string | null;
  package_duration_months?: number | null;
  amount?: number;
  method?: string | null;
  ref?: string | null;
  note?: string | null;
  proof_image_url?: string | null;
  package_json?: string | null;
  status: Status;
  created_at?: string | null;
};

// Detail paket disimpan server di kolom package_json (nama, durasi, harga resmi
// paket saat diajukan; top up koin juga membawa kind 'coin' + jumlah koin).
const packageInfo = (row: PaymentRow) => {
  let pkg: {
    id?: string;
    name?: string;
    durationMonths?: number;
    expectedPrice?: number;
    method?: string;
    ref?: string;
    kind?: string;
    coins?: number;
  } = {};
  try {
    pkg = row.package_json ? JSON.parse(row.package_json) : {};
  } catch {
    pkg = {};
  }
  const expected = Number(pkg.expectedPrice) || 0;
  const isCoin = pkg.kind === 'coin' || String(pkg.id ?? '').startsWith('koin-');
  return {
    isCoin,
    coins: Number(pkg.coins) || 0,
    name: pkg.name || row.package_name || row.package_id || 'PRO',
    months: Number(pkg.durationMonths) || row.package_duration_months || null,
    method: pkg.method || row.method || null,
    ref: pkg.ref || row.ref || null,
    expected,
    mismatch: expected > 0 && Math.round(row.amount || 0) !== Math.round(expected),
  };
};

const num = (n: number) => Number(n || 0).toLocaleString('id-ID');
const rp = (n: number) => `Rp ${num(n)}`;
const when = (iso?: string | null) =>
  iso
    ? new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso))
    : '';
const waLink = (n?: string | null) => {
  const d = String(n ?? '')
    .replace(/\D/g, '')
    .replace(/^0/, '62');
  return d.length >= 9 ? `https://wa.me/${d}` : null;
};

const STATUS: Record<Status, { label: string; tone: string; icon: typeof Clock }> = {
  MENUNGGU: { label: 'Menunggu', tone: 'bg-orange-50 text-orange-700', icon: Clock },
  DISETUJUI: { label: 'Disetujui', tone: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
  DITOLAK: { label: 'Ditolak', tone: 'bg-rose-50 text-rose-700', icon: XCircle },
  GAGAL: { label: 'Gagal', tone: 'bg-rose-50 text-rose-700', icon: XCircle },
};
type StatusFilter = 'Menunggu' | 'Disetujui' | 'Ditolak' | 'Semua';
type TypeFilter = 'semua' | 'pro' | 'koin';

function AdminPembayaranContent() {
  const { toast, confirm } = useFeedback();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [statusF, setStatusF] = useState<StatusFilter>('Menunggu');
  const [typeF, setTypeF] = useState<TypeFilter>('semua');
  const [proof, setProof] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    cloudflareApi<{ items: PaymentRow[] }>('/api/admin/payments')
      .then((res) => setPayments(res.items || []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Gagal memuat pembayaran.'))
      .finally(() => setLoading(false));
  }, []);

  const setStatus = (id: string, status: Status) =>
    setPayments((list) => list.map((p) => (p.id === id ? { ...p, status } : p)));

  const approve = async (row: PaymentRow) => {
    const info = packageInfo(row);
    const who = row.user_name || row.user_email || 'pengguna';
    const ok = await confirm({
      title: info.isCoin ? `Tambahkan ${num(info.coins)} koin?` : `Aktifkan ${info.name}?`,
      message: `${who} · transfer ${rp(row.amount || 0)}${info.mismatch ? ` (harga paket ${rp(info.expected)} — cek dulu!)` : ''}. Setujui hanya kalau uangnya sudah masuk rekening.`,
      confirmLabel: info.isCoin ? 'Tambahkan koin' : 'Aktifkan PRO',
    });
    if (!ok) return;
    setBusy(row.id);
    try {
      await cloudflareApi(`/api/admin/payments/${row.id}`, { method: 'PATCH', json: { status: 'DISETUJUI' } });
      setStatus(row.id, 'DISETUJUI');
      toast.success(info.isCoin ? `${num(info.coins)} koin masuk ke ${who}.` : `PRO ${who} aktif.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memproses pembayaran.');
    } finally {
      setBusy(null);
    }
  };

  const reject = async (row: PaymentRow) => {
    const ok = await confirm({
      title: 'Tolak pembayaran ini?',
      message: `${row.user_name || row.user_email} · ${rp(row.amount || 0)}. Member akan melihat status Ditolak.`,
      confirmLabel: 'Tolak',
      danger: true,
    });
    if (!ok) return;
    setBusy(row.id);
    try {
      await cloudflareApi(`/api/admin/payments/${row.id}`, { method: 'PATCH', json: { status: 'DITOLAK' } });
      setStatus(row.id, 'DITOLAK');
      toast.info('Pembayaran ditolak.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menolak pembayaran.');
    } finally {
      setBusy(null);
    }
  };

  const stats = useMemo(() => {
    const ok = payments.filter((p) => p.status === 'DISETUJUI');
    const wait = payments.filter((p) => p.status === 'MENUNGGU');
    const sum = (l: PaymentRow[]) => l.reduce((a, p) => a + (p.amount || 0), 0);
    return {
      wait: wait.length,
      waitSum: sum(wait),
      ok: ok.length,
      failed: payments.filter((p) => p.status === 'DITOLAK' || p.status === 'GAGAL').length,
      proRevenue: sum(ok.filter((p) => !packageInfo(p).isCoin)),
      coinRevenue: sum(ok.filter((p) => packageInfo(p).isCoin)),
    };
  }, [payments]);

  const filtered = payments.filter((p) => {
    const term = q.trim().toLowerCase();
    const info = packageInfo(p);
    if (
      term &&
      ![p.user_name, p.user_email, p.id, info.ref, info.name].some((v) =>
        String(v ?? '')
          .toLowerCase()
          .includes(term),
      )
    )
      return false;
    if (typeF === 'pro' && info.isCoin) return false;
    if (typeF === 'koin' && !info.isCoin) return false;
    if (statusF === 'Menunggu') return p.status === 'MENUNGGU';
    if (statusF === 'Disetujui') return p.status === 'DISETUJUI';
    if (statusF === 'Ditolak') return p.status === 'DITOLAK' || p.status === 'GAGAL';
    return true;
  });

  return (
    <>
      <div className="mx-auto max-w-[1400px] space-y-6 pb-16">
        <AdminPageHeader
          title="Verifikasi Pembayaran"
          description="Cek bukti transfer, lalu aktifkan PRO atau tambahkan koin member."
        />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <AdminStatCard
            label="Menunggu"
            value={stats.wait}
            note={rp(stats.waitSum)}
            icon={Clock}
            color="text-orange-600"
            bg="bg-orange-50"
          />
          <AdminStatCard
            label="Pendapatan PRO"
            value={rp(stats.proRevenue)}
            note="Langganan disetujui"
            icon={Crown}
            color="text-indigo-600"
            bg="bg-indigo-50"
          />
          <AdminStatCard
            label="Pendapatan koin"
            value={rp(stats.coinRevenue)}
            note="Top up disetujui"
            icon={Coins}
            color="text-amber-600"
            bg="bg-amber-50"
          />
          <AdminStatCard
            label="Disetujui / ditolak"
            value={`${stats.ok} / ${stats.failed}`}
            icon={CheckCircle2}
            color="text-emerald-600"
            bg="bg-emerald-50"
          />
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm md:p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl bg-slate-50 p-1">
              {(
                [
                  { id: 'Menunggu', count: stats.wait },
                  { id: 'Disetujui', count: stats.ok },
                  { id: 'Ditolak', count: stats.failed },
                  { id: 'Semua', count: payments.length },
                ] as { id: StatusFilter; count: number }[]
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setStatusF(t.id)}
                  className={cn(
                    'flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-black transition',
                    statusF === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600',
                  )}
                >
                  {t.id}
                  <span
                    className={cn(
                      'min-w-5 rounded-full px-1.5 py-0.5 text-[10px]',
                      statusF === t.id ? 'bg-orange-50 text-orange-600' : 'bg-slate-100 text-slate-400',
                    )}
                  >
                    {t.count}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex gap-1 rounded-xl bg-slate-50 p-1">
              {(
                [
                  { id: 'semua', label: 'Semua jenis' },
                  { id: 'pro', label: 'PRO' },
                  { id: 'koin', label: 'Koin' },
                ] as { id: TypeFilter; label: string }[]
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTypeF(t.id)}
                  className={cn(
                    'rounded-lg px-3 py-2 text-xs font-black transition',
                    typeF === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 lg:ml-auto lg:w-72">
              <Search size={15} className="text-slate-300" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari nama, email, ref…"
                className="w-full bg-transparent text-[13px] outline-none placeholder:text-slate-300"
              />
            </label>
          </div>

          {loading ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Memuat antrean…</p>
            </div>
          ) : error ? (
            <p className="py-10 text-center text-sm text-rose-600">{error}</p>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <CheckCircle2 className="mx-auto text-emerald-300" size={32} />
              <p className="mt-2 text-sm font-bold text-slate-500">
                {statusF === 'Menunggu'
                  ? 'Antrean bersih — tidak ada yang menunggu.'
                  : 'Tidak ada pembayaran yang cocok.'}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {filtered.map((row) => {
                const info = packageInfo(row);
                const st = STATUS[row.status] ?? STATUS.GAGAL;
                const StIcon = st.icon;
                const wa = waLink(row.user_whatsapp);
                return (
                  <div
                    key={row.id}
                    className={cn(
                      'flex gap-4 rounded-2xl border p-4 transition',
                      row.status === 'MENUNGGU' ? 'border-orange-100 bg-orange-50/30' : 'border-slate-100',
                    )}
                  >
                    {row.proof_image_url ? (
                      <button
                        type="button"
                        onClick={() => setProof(row.proof_image_url ?? null)}
                        className="group relative h-20 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 hover:border-indigo-400"
                        aria-label="Lihat bukti"
                      >
                        <Image src={row.proof_image_url} alt="Bukti" fill className="object-cover" />
                        <span className="absolute inset-0 bg-indigo-600/0 transition group-hover:bg-indigo-600/30" />
                      </button>
                    ) : (
                      <div className="grid h-20 w-16 shrink-0 place-items-center rounded-xl border border-dashed border-slate-200 text-center text-[9px] font-bold leading-tight text-slate-300">
                        tanpa
                        <br />
                        bukti
                      </div>
                    )}
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide',
                            info.isCoin ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800',
                          )}
                        >
                          {info.isCoin ? <Coins size={11} /> : <Crown size={11} />}
                          {info.isCoin ? 'Koin' : 'PRO'}
                        </span>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black',
                            st.tone,
                          )}
                        >
                          <StIcon size={11} /> {st.label}
                        </span>
                        <span className="w-full text-[10px] font-medium text-slate-400 sm:ml-auto sm:w-auto">
                          {when(row.created_at)} · #{row.id.slice(-6).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="truncate text-sm font-black text-slate-900">{row.user_name || 'Tanpa nama'}</p>
                        <p className="truncate text-xs text-slate-400">{row.user_email}</p>
                      </div>
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                        <p className="text-lg font-black tabular-nums text-slate-900">{rp(row.amount || 0)}</p>
                        <p className="text-xs font-bold text-slate-500">
                          {info.isCoin
                            ? `${num(info.coins)} koin`
                            : `${info.name}${info.months ? ` · ${info.months} bln` : ''}`}
                        </p>
                      </div>
                      {info.mismatch && (
                        <p className="text-[11px] font-bold text-amber-600">
                          ⚠ Nominal beda dari harga paket ({rp(info.expected)})
                        </p>
                      )}
                      <p className="text-[11px] text-slate-500">
                        {info.method || 'Transfer'}
                        {info.ref ? (
                          <>
                            {' '}
                            · ref <span className="font-mono">{info.ref}</span>
                          </>
                        ) : null}
                      </p>
                      {row.note && (
                        <p className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600">“{row.note}”</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {row.status === 'MENUNGGU' && (
                          <>
                            <button
                              type="button"
                              disabled={busy === row.id}
                              onClick={() => void approve(row)}
                              className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-black text-white transition hover:bg-emerald-600 disabled:opacity-60"
                            >
                              {info.isCoin ? 'Tambahkan koin' : 'Aktifkan PRO'}
                            </button>
                            <button
                              type="button"
                              disabled={busy === row.id}
                              onClick={() => void reject(row)}
                              className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-500 transition hover:border-rose-200 hover:text-rose-600 disabled:opacity-60"
                            >
                              Tolak
                            </button>
                          </>
                        )}
                        {wa && (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50"
                          >
                            <MessageCircle size={13} /> WhatsApp
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {proof && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
          onClick={() => setProof(null)}
        >
          <div className="relative w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setProof(null)}
              className="absolute -top-12 right-0 rounded-full bg-white/20 p-2 text-white transition hover:bg-white/40"
              aria-label="Tutup"
            >
              <X size={20} />
            </button>
            <div className="overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center gap-2.5 border-b border-slate-100 p-4">
                <ImageIcon size={16} className="text-indigo-500" />
                <h4 className="text-[13px] font-black uppercase tracking-widest text-slate-900">Bukti Pembayaran</h4>
              </div>
              <Image
                src={proof}
                alt="Bukti Pembayaran"
                width={1400}
                height={900}
                className="h-auto max-h-[70vh] w-full bg-slate-50 object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Layout admin tidak memasang FeedbackProvider — halaman ini membawanya sendiri.
export default function AdminPembayaranPage() {
  return (
    <FeedbackProvider>
      <AdminPembayaranContent />
    </FeedbackProvider>
  );
}
