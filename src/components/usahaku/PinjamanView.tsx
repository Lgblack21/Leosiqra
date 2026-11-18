'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronRight,
  HandCoins,
  IdCard,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { liburPada, liburStore, parseYmd } from '@/lib/hariLibur';
import { muatHariLibur } from '@/lib/hariLiburApi';
import type { Shop } from '@/lib/services/shopService';
import { shopBookService, type ShopBook } from '@/lib/services/shopBookService';
import { shopLoanService, type Borrower, type Frekuensi, type Loan, type LoanBook } from '@/lib/services/shopLoanService';
import {
  buatJadwal,
  isLiburTagih,
  kelompokTelat,
  modalDiLuar,
  pendapatan,
  statusPinjaman,
  tahunTanpaData,
  type StatusPinjaman,
  angsuranDariTotal,
} from '@/lib/usaha/pinjaman';
import { usePlan } from '@/lib/usePlan';
import { cn, formatIDR } from '@/lib/utils';
import { fieldCls, labelCls } from '@/components/ladang/UsahaView';
import { UsahaSheet } from './UsahaSheet';
import { AnggotaWizard, FotoAnggota, KartuAnggota } from './AnggotaView';
import { JaminanInput, JaminanSection, jaminanKosong } from './JaminanView';
import { usePetugas } from './petugas';

// Usahaku › jenis Pinjaman: Ringkasan · Tagihan hari ini · Pinjaman · Peminjam (Kas pakai BerandaUsaha view kas).
// Rancangan & ACC Bos: docs/rancangan/usahaku-pinjaman.md.
export type PinjamanTab = 'ringkasan' | 'tagihan' | 'pinjaman' | 'peminjam';

const money = (v: string) => Number(v.replace(/\D/g, '').slice(0, 11) || '0');
const moneyText = (n: number) => (n ? n.toLocaleString('id-ID') : '');
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const tgl = (s: string, hari = false) => {
  if (!s) return '—';
  const d = parseYmd(s);
  return `${hari ? `${HARI[d.getDay()]}, ` : ''}${d.getDate()} ${BULAN[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ''}`;
};
/** Tanggal yang sama bulan depan (tgl 29–31 → akhir bulan kalau bulannya lebih pendek). */
const addMonths = (s: string, n: number) => {
  const d = parseYmd(s);
  const last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate();
  const x = new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), last));
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const addDays = (s: string, n: number) => {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const waLink = (wa: string | null, text: string) => {
  const n = (wa ?? '').replace(/\D/g, '').replace(/^0/, '62');
  return `https://wa.me/${n.length >= 9 ? n : ''}?text=${encodeURIComponent(text)}`;
};
const ingatkanText = (nama: string, st: StatusPinjaman) =>
  `Halo ${nama}, mengingatkan angsuran hari ini ${formatIDR(st.tagihan)}${st.nunggakKali ? ` (termasuk ${st.nunggakKali}× yang belum terbayar)` : ''}. Terima kasih 🙏`;

type Form =
  | { k: 'loan'; borrowerId?: string }
  | { k: 'pay'; loan: Loan; st: StatusPinjaman }
  | { k: 'detail'; loanId: string }
  | { k: 'geser'; loanId: string }
  | { k: 'daftar'; b?: Borrower }
  | { k: 'kartu'; id: string }
  | { k: 'borrower'; b?: Borrower }
  | { k: 'tarik'; b: Borrower };

export function PinjamanView({
  shop,
  book,
  variant,
  view,
  onNav,
  onToast,
}: {
  shop: Shop;
  book: ShopBook;
  variant: 'web' | 'app';
  view: PinjamanTab;
  onNav: (v: PinjamanTab | 'kas') => void;
  onToast: (m: string) => void;
}) {
  const [data, setData] = useState<LoanBook | null>(null);
  const [error, setError] = useState('');
  const [notReady, setNotReady] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const petugas = usePetugas();
  const plan = usePlan(Boolean(petugas));
  // Petugas: paket PRO pemilik dicek di server; tombol "Pinjaman baru" memang tidak ada untuknya.
  const isPro = petugas ? true : plan;
  useSyncExternalStore(liburStore.subscribe, liburStore.versi, liburStore.versi);
  useEffect(() => {
    void muatHariLibur();
  }, []);

  const load = useCallback(async () => {
    try {
      setData(await shopLoanService.get(shop.id));
      setError('');
      setNotReady(false);
    } catch (e) {
      const m = e instanceof Error ? e.message : 'Gagal memuat data pinjaman.';
      if (/belum aktif|pembaruan database/i.test(m)) setNotReady(true);
      setError(m);
      setData((p) => p ?? { today: '', memberReady: false, collateralReady: false, loadedAt: 0, borrowers: [], loans: [], payments: [] });
    }
  }, [shop.id]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- muat data pinjaman saat toko dibuka
    void load();
    return subscribeToCollectionChanges('shop_book', load);
  }, [load]);

  const today = data?.today || book.range.to;
  const borrowerById = useMemo(() => new Map((data?.borrowers ?? []).map((b) => [b.id, b])), [data]);
  const aktif = useMemo(() => (data?.loans ?? []).filter((l) => l.status === 'aktif'), [data]);
  const rows = useMemo(
    () =>
      aktif
        .map((l) => ({ l, b: borrowerById.get(l.borrowerId), st: statusPinjaman(l, today) }))
        .sort((a, z) => z.st.telat - a.st.telat || (a.b?.name ?? '').localeCompare(z.b?.name ?? '')),
    [aktif, borrowerById, today],
  );
  const kas = book.accounts.filter((a) => !a.archived);
  const close = (m?: string) => {
    setForm(null);
    if (m) onToast(m);
  };

  if (!data) return <div className="h-72 animate-pulse rounded-[28px] bg-slate-200/70 dark:bg-slate-800" />;
  if (notReady)
    return (
      <p className="rounded-[26px] bg-amber-50 p-5 fs-14 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
        Fitur pinjaman sedang disiapkan di server (menunggu pembaruan database). Coba lagi sebentar lagi.
      </p>
    );

  const tagihanRows = rows.filter((r) => r.st.tagihan > 0);
  const totalTagihan = tagihanRows.reduce((a, r) => a + r.st.tagihan, 0);
  const diterimaHariIni = data.payments.filter((p) => p.date === today).reduce((a, p) => a + p.amount, 0);
  const libur = isLiburTagih(parseYmd(today), { minggu: true, cuti: true });
  const namaLibur = liburPada(today)[0]?.nama ?? (parseYmd(today).getDay() === 0 ? 'Hari Minggu' : '');
  const proGate = isPro === false && (
    <p className="rounded-2xl bg-violet-50 px-4 py-3 fs-13 text-violet-800 dark:bg-violet-500/10 dark:text-violet-200">
      Membuat pinjaman baru khusus <b>PRO</b>. Pinjaman yang sudah berjalan tetap bisa ditagih.
    </p>
  );
  const newLoanBtn = petugas ? null : (
    <button
      type="button"
      onClick={() => setForm({ k: 'loan' })}
      disabled={isPro === false}
      className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 fs-13 font-bold text-white hover:bg-slate-800 disabled:opacity-40 dark:bg-white dark:text-slate-900"
    >
      <Plus size={16} /> Pinjaman baru
    </button>
  );
  const terimaBtn = (l: Loan, st: StatusPinjaman, primary = true) => (
    <button
      type="button"
      onClick={() => setForm({ k: 'pay', loan: l, st })}
      className={cn(
        'rounded-full px-3.5 py-2 fs-12 font-bold',
        primary ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200',
      )}
    >
      Terima
    </button>
  );

  // ── Ringkasan ──
  const ringkasan = () => {
    const month = `${today.slice(0, 8)}01`;
    const pend = pendapatan(data.loans, data.payments, month, today);
    const beredar = aktif.reduce((a, l) => a + Math.max(0, l.total - l.paid), 0);
    const modal = aktif.reduce((a, l) => a + modalDiLuar(l), 0);
    const groups = ['1–7 hari', '8–30 hari', 'lebih dari 30 hari'].map((g) => ({
      g,
      list: rows.filter((r) => kelompokTelat(r.st.telat) === g),
    }));
    const stat = (label: string, value: string, hint?: string, tone = 'text-slate-900 dark:text-white') => (
      <div className="min-w-0 rounded-3xl bg-white p-4 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
        <p className="truncate fs-12 font-semibold text-slate-500 dark:text-slate-400">{label}</p>
        <p className={cn('truncate fsh-22 font-black tabular-nums tracking-tight', tone)}>{value}</p>
        {hint && <p className="truncate fs-11 text-slate-400">{hint}</p>}
      </div>
    );
    return (
      <div className="space-y-4">
        {proGate}
        <button
          type="button"
          onClick={() => onNav('tagihan')}
          className="flex w-full items-center gap-3 rounded-[26px] bg-gradient-to-r from-emerald-600 to-teal-600 p-4 text-left text-white shadow-lg shadow-emerald-600/20"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
            <HandCoins size={24} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block fs-12 text-white/75">Tagihan hari ini · {tgl(today, true)}</span>
            <span className="block fsh-22 font-black tabular-nums">{formatIDR(totalTagihan)}</span>
            <span className="block truncate fs-12 text-white/75">
              {tagihanRows.length} peminjam · sudah diterima {formatIDR(diterimaHariIni)}
            </span>
          </span>
          <ChevronRight size={20} />
        </button>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {stat('Uang beredar', formatIDR(beredar), `sisa tagihan ${aktif.length} pinjaman`)}
          {stat('Modal masih di luar', formatIDR(modal), 'pokok yang belum kembali')}
          {stat(
            `Pendapatan ${BULAN[parseYmd(today).getMonth()]}`,
            formatIDR(pend.total),
            `admin ${formatIDR(pend.admin)} · jasa ${formatIDR(pend.jasa)}`,
            'text-emerald-700 dark:text-emerald-300',
          )}
          {stat('Peminjam aktif', String(aktif.length), `${rows.filter((r) => r.st.telat > 0).length} nunggak`)}
          {data.borrowers.some((b) => b.savings > 0) &&
            stat(
              'Tabungan anggota',
              formatIDR(data.borrowers.reduce((a, b) => a + b.savings, 0)),
              'dipegang di kas, milik anggota',
            )}
        </div>
        <section className="rounded-[26px] bg-white p-4 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
          <div className="flex items-center justify-between gap-3">
            <p className="fs-15 font-extrabold text-slate-900 dark:text-white">Kelancaran</p>
            {newLoanBtn}
          </div>
          {rows.length === 0 ? (
            <p className="mt-3 fs-13 text-slate-500">Belum ada pinjaman aktif. Tambah peminjam, lalu buat pinjaman baru.</p>
          ) : (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              <li className="flex items-center justify-between rounded-2xl bg-emerald-50 px-3 py-2.5 dark:bg-emerald-500/10">
                <span className="fs-13 font-semibold text-emerald-800 dark:text-emerald-200">Lancar</span>
                <span className="fs-13 font-extrabold text-emerald-800 dark:text-emerald-200">
                  {rows.filter((r) => r.st.telat === 0).length} orang
                </span>
              </li>
              {groups.map(({ g, list }) => (
                <li key={g}>
                  <button
                    type="button"
                    onClick={() => onNav('tagihan')}
                    className={cn(
                      'flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left',
                      list.length ? (g === 'lebih dari 30 hari' ? 'bg-rose-50 dark:bg-rose-500/10' : 'bg-amber-50 dark:bg-amber-500/10') : 'bg-slate-50 dark:bg-slate-800/60',
                    )}
                  >
                    <span className="fs-13 font-semibold text-slate-700 dark:text-slate-200">Telat {g}</span>
                    <span className="fs-13 font-extrabold text-slate-900 dark:text-white">
                      {list.length} orang{list.length ? ` · ${formatIDR(list.reduce((a, r) => a + r.st.tagihan, 0))}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  };

  // ── Tagihan hari ini ──
  const tagihan = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
          <p className="fs-12 font-semibold text-slate-500">Harus ditagih hari ini</p>
          <p className="fsh-22 font-black tabular-nums text-slate-900 dark:text-white">{formatIDR(totalTagihan)}</p>
          <p className="fs-11 text-slate-400">{tagihanRows.length} peminjam</p>
        </div>
        <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
          <p className="fs-12 font-semibold text-slate-500">Sudah diterima hari ini</p>
          <p className="fsh-22 font-black tabular-nums text-emerald-700 dark:text-emerald-300">{formatIDR(diterimaHariIni)}</p>
          <p className="fs-11 text-slate-400">{data.payments.filter((p) => p.date === today).length} angsuran</p>
        </div>
      </div>
      {libur && (
        <p className="flex items-center gap-2 rounded-2xl bg-sky-50 px-4 py-3 fs-13 text-sky-800 dark:bg-sky-500/10 dark:text-sky-200">
          <CalendarDays size={16} className="shrink-0" /> Hari ini libur{namaLibur ? ` (${namaLibur})` : ''} — tidak ada tagihan
          baru. Tunggakan tetap tampil di bawah.
        </p>
      )}
      {tagihanRows.length === 0 ? (
        <p className="rounded-[26px] border-2 border-dashed border-slate-200 p-8 text-center fs-13 text-slate-400 dark:border-slate-800">
          {aktif.length ? 'Semua beres — tidak ada tagihan yang belum dibayar hari ini.' : 'Belum ada pinjaman aktif.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {tagihanRows.map(({ l, b, st }) => (
            <li key={l.id} className="rounded-2xl bg-white p-3.5 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
              <div className="flex items-start gap-3">
                <button type="button" onClick={() => setForm({ k: 'detail', loanId: l.id })} className="min-w-0 flex-1 text-left">
                  <span className="block truncate fs-15 font-extrabold text-slate-900 dark:text-white">{b?.name ?? 'Peminjam'}</span>
                  <span className="block fs-12 text-slate-500 dark:text-slate-400">
                    ke-{st.ke} dari {l.count} · {l.frequency}
                    {st.jadwalHariIni ? ` · hari ini ${formatIDR(Math.min(l.installment, st.tagihan))}` : ''}
                    {st.nunggakKali > 0 && <b className="text-rose-600"> + nunggak {st.nunggakKali}×</b>}
                  </span>
                  {st.telat > 0 && (
                    <span className={cn('mt-0.5 inline-block rounded-md px-1.5 py-0.5 fs-11 font-bold', st.telat > 30 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800')}>
                      telat {st.telat} hari
                    </span>
                  )}
                </button>
                <span className="shrink-0 text-right">
                  <span className="block fs-16 font-black tabular-nums text-slate-900 dark:text-white">{formatIDR(st.tagihan)}</span>
                  <span className="block fs-11 text-slate-400">sisa {formatIDR(st.sisa)}</span>
                </span>
              </div>
              <div className="mt-2.5 flex justify-end gap-2">
                <a
                  href={waLink(b?.wa ?? null, ingatkanText(b?.name ?? '', st))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-full bg-slate-100 px-3.5 py-2 fs-12 font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
                >
                  <MessageCircle size={13} /> Ingatkan
                </a>
                {terimaBtn(l, st)}
              </div>
            </li>
          ))}
        </ul>
      )}
      {rows.some((r) => r.st.tagihan === 0) && (
        <section className="rounded-[26px] bg-white p-4 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
          <p className="fs-14 font-extrabold text-slate-900 dark:text-white">Sudah beres hari ini</p>
          <ul className="mt-1 divide-y divide-slate-100 dark:divide-slate-800">
            {rows
              .filter((r) => r.st.tagihan === 0)
              .map(({ l, b, st }) => (
                <li key={l.id} className="flex items-center gap-3 py-2.5">
                  <Check size={16} className="shrink-0 text-emerald-600" />
                  <span className="min-w-0 flex-1 truncate fs-13 font-semibold text-slate-700 dark:text-slate-200">{b?.name}</span>
                  <span className="shrink-0 fs-12 text-slate-500">
                    {st.diMuka > 0 ? `bayar di muka ${formatIDR(st.diMuka)}` : `sisa ${formatIDR(st.sisa)}`}
                  </span>
                  {terimaBtn(l, st, false)}
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );

  // ── Pinjaman ──
  const pinjaman = () => {
    const lunas = (data.loans ?? []).filter((l) => l.status === 'lunas');
    const card = (l: Loan) => {
      const b = borrowerById.get(l.borrowerId);
      const st = statusPinjaman(l, today);
      const pct = Math.min(100, Math.round((l.paid / Math.max(1, l.total)) * 100));
      const next = l.dueDates.find((d) => d > today);
      return (
        <li key={l.id}>
          <button
            type="button"
            onClick={() => setForm({ k: 'detail', loanId: l.id })}
            className="w-full rounded-2xl bg-white p-3.5 text-left ring-1 ring-slate-100 hover:ring-slate-300 dark:bg-slate-900 dark:ring-slate-800"
          >
            <span className="flex items-start gap-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate fs-15 font-extrabold text-slate-900 dark:text-white">{b?.name ?? 'Peminjam'}</span>
                <span className="block fs-12 text-slate-500">
                  {formatIDR(l.principal)} · {l.count}× {formatIDR(l.installment)} {l.frequency} · cair {tgl(l.disbursedOn)}
                </span>
              </span>
              {l.collateral && !l.collateral.returnedAt && (
                <span title="Ada jaminan yang masih dipegang" className="rounded-md bg-sky-50 px-2 py-0.5 fs-11 font-bold text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                  Jaminan
                </span>
              )}
              {l.status === 'lunas' ? (
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 fs-11 font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">Lunas</span>
              ) : st.telat > 0 ? (
                <span className="rounded-md bg-amber-100 px-2 py-0.5 fs-11 font-bold text-amber-800">telat {st.telat} hr</span>
              ) : (
                <span className="rounded-md bg-slate-100 px-2 py-0.5 fs-11 font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">lancar</span>
              )}
            </span>
            <span className="mt-2.5 block h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
            </span>
            <span className="mt-1.5 flex justify-between fs-11 text-slate-500">
              <span>
                dibayar {formatIDR(l.paid)} dari {formatIDR(l.total)}
              </span>
              <span>{l.status === 'lunas' ? `lunas ${tgl((l.closedAt ?? '').slice(0, 10))}` : next ? `berikutnya ${tgl(next)}` : `selesai ${tgl(l.dueDates[l.dueDates.length - 1] ?? '')}`}</span>
            </span>
          </button>
        </li>
      );
    };
    return (
      <div className="space-y-4">
        {proGate}
        <div className="flex items-center justify-between gap-3">
          <p className="fs-13 text-slate-500">{aktif.length} pinjaman aktif</p>
          {newLoanBtn}
        </div>
        {aktif.length === 0 ? (
          <p className="rounded-[26px] border-2 border-dashed border-slate-200 p-8 text-center fs-13 text-slate-400 dark:border-slate-800">
            Belum ada pinjaman aktif.
          </p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">{rows.map((r) => card(r.l))}</ul>
        )}
        {lunas.length > 0 && (
          <details className="rounded-[26px] bg-white p-4 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
            <summary className="cursor-pointer fs-14 font-extrabold text-slate-900 dark:text-white">Sudah lunas ({lunas.length})</summary>
            <ul className="mt-3 grid gap-2 md:grid-cols-2">{lunas.map(card)}</ul>
          </details>
        )}
      </div>
    );
  };

  // ── Peminjam ──
  const peminjam = () => {
    const list = data.borrowers.filter((b) => !b.archived);
    const loanOf = (id: string) => aktif.find((l) => l.borrowerId === id);
    const anggota = data.memberReady;
    const belum = anggota ? list.filter((b) => !b.registered).length : 0;
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="fs-13 text-slate-500">
            {list.length} {anggota ? 'anggota' : 'peminjam'}
            {belum > 0 && <span className="text-amber-700"> · {belum} belum lengkap</span>}
          </p>
          <button
            type="button"
            onClick={() => setForm(anggota ? { k: 'daftar' } : { k: 'borrower' })}
            disabled={isPro === false}
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 fs-13 font-bold text-white hover:bg-slate-800 disabled:opacity-40 dark:bg-white dark:text-slate-900"
          >
            <UserPlus size={16} /> {anggota ? 'Daftar anggota baru' : 'Tambah peminjam'}
          </button>
        </div>
        {belum > 0 && (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 fs-13 text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
            Yang bertanda <b>Belum lengkap</b> perlu dilengkapi (alamat, foto diri, foto KTP) sebelum bisa diberi pinjaman
            berikutnya. Pinjaman yang sedang berjalan tetap jalan.
          </p>
        )}
        {list.length === 0 ? (
          <p className="rounded-[26px] border-2 border-dashed border-slate-200 p-8 text-center fs-13 text-slate-400 dark:border-slate-800">
            {anggota
              ? 'Belum ada anggota. Daftarkan dulu (data diri, foto, KTP) — setelah jadi anggota baru bisa diberi pinjaman.'
              : 'Belum ada peminjam. Tambah dulu, nomor WA opsional (dipakai tombol Ingatkan).'}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-[26px] bg-white px-4 ring-1 ring-slate-100 dark:divide-slate-800 dark:bg-slate-900 dark:ring-slate-800">
            {list.map((b) => {
              const l = loanOf(b.id);
              const st = l ? statusPinjaman(l, today) : null;
              const boleh = !anggota || b.registered;
              return (
                <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                  <FotoAnggota shopId={shop.id} b={b} className="h-11 w-11" />
                  <span className="min-w-0 flex-1 basis-40">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate fs-14 font-bold text-slate-900 dark:text-white">{b.name}</span>
                      {anggota &&
                        (b.registered ? (
                          <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 fs-10 font-bold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">{b.memberNo}</span>
                        ) : (
                          <span className="shrink-0 rounded-md bg-amber-100 px-1.5 py-0.5 fs-10 font-bold text-amber-800">Belum lengkap</span>
                        ))}
                    </span>
                    <span className="block truncate fs-12 text-slate-500">
                      {l && st ? `aktif · sisa ${formatIDR(st.sisa)}${st.telat ? ` · telat ${st.telat} hr` : ''}` : 'tidak ada pinjaman aktif'}
                      {b.wa ? ` · ${b.wa}` : ''}
                    </span>
                    {b.savings > 0 && (
                      <span className="mt-0.5 inline-block rounded-md bg-sky-50 px-1.5 py-0.5 fs-11 font-bold text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                        Tabungan {formatIDR(b.savings)}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {b.savings > 0 && !petugas && (
                      <button type="button" onClick={() => setForm({ k: 'tarik', b })} className="rounded-full bg-sky-50 px-3 py-1.5 fs-12 font-bold text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                        Tarik
                      </button>
                    )}
                    {anggota && !b.registered && (
                      <button type="button" onClick={() => setForm({ k: 'daftar', b })} disabled={isPro === false} className="rounded-full bg-amber-500 px-3 py-1.5 fs-12 font-bold text-white disabled:opacity-40">
                        Lengkapi
                      </button>
                    )}
                    {anggota && b.registered && (
                      <button type="button" onClick={() => setForm({ k: 'kartu', id: b.id })} className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 fs-12 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        <IdCard size={13} /> Kartu
                      </button>
                    )}
                    {l ? (
                      <button type="button" onClick={() => setForm({ k: 'detail', loanId: l.id })} className="rounded-full bg-slate-100 px-3 py-1.5 fs-12 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        Lihat
                      </button>
                    ) : (
                      boleh && !petugas && (
                        <button
                          type="button"
                          onClick={() => setForm({ k: 'loan', borrowerId: b.id })}
                          disabled={isPro === false}
                          className="rounded-full bg-emerald-600 px-3 py-1.5 fs-12 font-bold text-white disabled:opacity-40"
                        >
                          Pinjamkan
                        </button>
                      )
                    )}
                    <button type="button" onClick={() => setForm(anggota && b.registered ? { k: 'daftar', b } : { k: 'borrower', b })} aria-label={`Ubah ${b.name}`} className="p-1.5 text-slate-400 hover:text-slate-700">
                      <Pencil size={15} />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  };

  const detailLoan = form?.k === 'detail' ? data.loans.find((l) => l.id === form.loanId) : undefined;
  const title =
    form?.k === 'loan'
      ? 'Pinjaman baru'
      : form?.k === 'pay'
        ? `Terima angsuran · ${borrowerById.get(form.loan.borrowerId)?.name ?? ''}`
        : form?.k === 'geser'
          ? 'Geser jadwal'
          : form?.k === 'daftar'
            ? form.b
              ? form.b.registered
                ? `Ubah data ${form.b.name}`
                : `Lengkapi data ${form.b.name}`
              : 'Daftar anggota baru'
            : form?.k === 'kartu'
              ? 'Kartu anggota'
          : form?.k === 'tarik'
          ? `Tarik tabungan · ${form.b.name}`
          : form?.k === 'borrower'
          ? form.b
            ? 'Ubah peminjam'
            : 'Tambah peminjam'
          : detailLoan
            ? `Pinjaman ${borrowerById.get(detailLoan.borrowerId)?.name ?? ''}`
            : '';

  return (
    <div className="space-y-4">
      {error && !notReady && (
        <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 fs-13 font-semibold text-rose-600 dark:bg-rose-500/10">
          {error}
        </p>
      )}
      {view === 'ringkasan' && ringkasan()}
      {view === 'tagihan' && tagihan()}
      {view === 'pinjaman' && pinjaman()}
      {view === 'peminjam' && peminjam()}

      <UsahaSheet variant={variant} open={form !== null} onClose={() => setForm(null)} title={title} wide={form?.k === 'loan' || form?.k === 'detail' || form?.k === 'kartu'}>
        {form?.k === 'loan' && (
          <LoanForm shop={shop} data={data} kas={kas} today={today} initialBorrower={form.borrowerId} onDone={close} />
        )}
        {form?.k === 'pay' && <PayForm shop={shop} loan={form.loan} st={form.st} kas={kas} today={today} petugas={petugas} onDone={close} />}
        {form?.k === 'borrower' && <BorrowerForm shop={shop} b={form.b} onDone={close} />}
        {form?.k === 'tarik' && <TarikForm shop={shop} b={form.b} kas={kas} onDone={close} />}
        {form?.k === 'daftar' && (
          <AnggotaWizard
            key={form.b?.id ?? 'baru'}
            shop={shop}
            existing={form.b}
            onDone={(r) => {
              onToast(r.memberNo ? `${r.name} terdaftar · ${r.memberNo}` : `${r.name} tersimpan.`);
              setForm({ k: 'kartu', id: r.id });
            }}
          />
        )}
        {form?.k === 'kartu' &&
          (() => {
            const b = data.borrowers.find((x) => x.id === form.id);
            return b?.registered ? (
              <div className="space-y-3">
                <KartuAnggota shop={shop} b={b} />
                {!aktif.some((l) => l.borrowerId === b.id) && isPro !== false && !petugas && (
                  <button type="button" onClick={() => setForm({ k: 'loan', borrowerId: b.id })} className="w-full rounded-full bg-emerald-600 py-3 fs-14 font-extrabold text-white hover:bg-emerald-700">
                    Beri pinjaman ke {b.name}
                  </button>
                )}
              </div>
            ) : (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="animate-spin text-slate-400" />
              </div>
            );
          })()}
        {form?.k === 'geser' &&
          (() => {
            const l = data.loans.find((x) => x.id === form.loanId);
            return l ? <GeserForm shop={shop} loan={l} today={today} onDone={close} /> : null;
          })()}
        {form?.k === 'detail' && detailLoan && (
          <LoanDetail
            shop={shop}
            loan={detailLoan}
            borrower={borrowerById.get(detailLoan.borrowerId)}
            data={data}
            today={today}
            onPay={(st) => setForm({ k: 'pay', loan: detailLoan, st })}
            onGeser={petugas ? undefined : () => setForm({ k: 'geser', loanId: detailLoan.id })}
            petugas={Boolean(petugas)}
            onToast={onToast}
            onDone={close}
            onKas={
              petugas
                ? undefined
                : () => {
                    setForm(null);
                    onNav('kas');
                  }
            }
          />
        )}
      </UsahaSheet>
    </div>
  );
}

// ── Form: anggota mengambil tabungan (kas keluar) ─────────────────────────────────
function TarikForm({ shop, b, kas, onDone }: { shop: Shop; b: Borrower; kas: ShopBook['accounts']; onDone: (m?: string) => void }) {
  const [amount, setAmount] = useState(b.savings);
  const [accountId, setAccountId] = useState(kas.find((a) => a.isDefault)?.id ?? kas[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [requestId] = useState(() => crypto.randomUUID());
  const save = async () => {
    if (!amount) return setError('Isi berapa yang diambil.');
    if (amount > b.savings) return setError(`Tabungan ${b.name} cuma ${formatIDR(b.savings)}.`);
    setBusy(true);
    setError('');
    try {
      await shopLoanService.tarikTabungan(shop.id, b.id, { requestId, amount, accountId });
      onDone(`Tabungan ${formatIDR(amount)} diambil ${b.name}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.');
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-sky-50 p-3 fs-13 text-sky-800 dark:bg-sky-500/10 dark:text-sky-200">
        Saldo tabungan <b>{formatIDR(b.savings)}</b>
      </div>
      <label className="block">
        <span className={labelCls}>Diambil</span>
        <input value={moneyText(amount)} onChange={(e) => setAmount(money(e.target.value))} inputMode="numeric" className={cn(fieldCls, 'fsh-22 font-extrabold tabular-nums')} />
      </label>
      <label className="block">
        <span className={labelCls}>Uang keluar dari kas</span>
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={fieldCls}>
          {kas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {formatIDR(a.balance)}
            </option>
          ))}
        </select>
      </label>
      {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 fs-13 font-semibold text-rose-600 dark:bg-rose-500/10">{error}</p>}
      <button type="button" onClick={save} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-full bg-sky-600 py-3.5 fs-15 font-extrabold text-white hover:bg-sky-700 disabled:opacity-50">
        {busy ? <Loader2 size={18} className="animate-spin" /> : <Wallet size={18} />} Serahkan {amount > 0 ? formatIDR(amount) : 'tabungan'}
      </button>
    </div>
  );
}

// ── Form: peminjam ─────────────────────────────────────────────────────────────
function BorrowerForm({ shop, b, onDone }: { shop: Shop; b?: Borrower; onDone: (m?: string) => void }) {
  const petugas = usePetugas();
  const [name, setName] = useState(b?.name ?? '');
  const [wa, setWa] = useState(b?.wa ?? '');
  const [note, setNote] = useState(b?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    if (!name.trim()) return setError('Isi nama peminjam.');
    setBusy(true);
    setError('');
    try {
      const input = { name: name.trim(), wa: wa.trim() || undefined, note: note.trim() || undefined };
      if (b) await shopLoanService.updateBorrower(shop.id, b.id, input);
      else await shopLoanService.addBorrower(shop.id, input);
      onDone(b ? 'Peminjam diperbarui.' : `${name.trim()} ditambahkan.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.');
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!b || !window.confirm(`Hapus ${b.name} dari daftar peminjam? Riwayat pinjamannya tetap tersimpan.`)) return;
    setBusy(true);
    try {
      await shopLoanService.archiveBorrower(shop.id, b.id);
      onDone('Peminjam dihapus dari daftar.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghapus.');
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3">
      {error && <p role="alert" className="fs-13 font-semibold text-rose-600">{error}</p>}
      <label className="block">
        <span className={labelCls}>Nama</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Mis. Bu Rina" className={fieldCls} />
      </label>
      <label className="block">
        <span className={labelCls}>Nomor WhatsApp (opsional)</span>
        <input value={wa} onChange={(e) => setWa(e.target.value)} inputMode="tel" placeholder="08…" className={fieldCls} />
      </label>
      <label className="block">
        <span className={labelCls}>Catatan (opsional)</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} placeholder="Mis. alamat / patokan rumah" className={fieldCls} />
      </label>
      <button type="button" onClick={save} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 py-3 fs-14 font-extrabold text-white disabled:opacity-50">
        {busy ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />} Simpan
      </button>
      {b && !petugas && (
        <button type="button" onClick={remove} disabled={busy} className="flex w-full items-center justify-center gap-1.5 py-2 fs-13 font-bold text-rose-600">
          <Trash2 size={14} /> Hapus dari daftar
        </button>
      )}
    </div>
  );
}

// ── Form: pinjaman baru (pratinjau jadwal) ─────────────────────────────────────
function LoanForm({
  shop,
  data,
  kas,
  today,
  initialBorrower,
  onDone,
}: {
  shop: Shop;
  data: LoanBook;
  kas: ShopBook['accounts'];
  today: string;
  initialBorrower?: string;
  onDone: (m?: string) => void;
}) {
  const busyIds = new Set(data.loans.filter((l) => l.status === 'aktif').map((l) => l.borrowerId));
  // Fitur anggota aktif → hanya anggota terdaftar lengkap yang boleh diberi pinjaman (keputusan Bos 2026-11-16).
  const free = data.borrowers.filter((b) => !b.archived && !busyIds.has(b.id) && (!data.memberReady || b.registered));
  const belumLengkap = data.memberReady ? data.borrowers.filter((b) => !b.archived && !busyIds.has(b.id) && !b.registered).length : 0;
  const [borrowerId, setBorrowerId] = useState(initialBorrower ?? '');
  const [newName, setNewName] = useState('');
  const [newWa, setNewWa] = useState('');
  const [principal, setPrincipal] = useState(0);
  const [adminInput, setAdmin] = useState(0);
  // 'tanpa' = pinjaman tanpa biaya admin (disimpan sebagai admin 0, mode potong).
  const [adminMode, setAdminMode] = useState<'potong' | 'terpisah' | 'tanpa'>('potong');
  const admin = adminMode === 'tanpa' ? 0 : adminInput;
  const [frequency, setFrequency] = useState<Frekuensi>('harian');
  // Cara isi: angsuran per kali (lama), total kembali (mis. 1,1 jt), atau jasa % (bulanan: per bulan).
  const [cara, setCara] = useState<'angsuran' | 'total' | 'persen'>('angsuran');
  const [installmentIn, setInstallment] = useState(0);
  const [totalIn, setTotalIn] = useState(0);
  const [jasaPct, setJasaPct] = useState('');
  const [savings, setSavings] = useState(0);
  const [count, setCount] = useState(0);
  const [date, setDate] = useState(today);
  const [first, setFirst] = useState(addDays(today, 1));
  const [firstTouched, setFirstTouched] = useState(false);
  const [minggu, setMinggu] = useState(true);
  const [cuti, setCuti] = useState(true);
  const [accountId, setAccountId] = useState(kas.find((a) => a.isDefault)?.id ?? kas[0]?.id ?? '');
  const [showDates, setShowDates] = useState(false);
  const [jaminan, setJaminan] = useState(jaminanKosong);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [requestId] = useState(() => crypto.randomUUID());
  useSyncExternalStore(liburStore.subscribe, liburStore.versi, liburStore.versi);

  const firstDate = firstTouched ? first : frequency === 'bulanan' ? addMonths(date, 1) : addDays(date, frequency === 'harian' ? 1 : 7);
  const dates = useMemo(() => buatJadwal(firstDate, count, frequency, { minggu, cuti }), [firstDate, count, frequency, minggu, cuti]);
  const pct = Number(jasaPct.replace(',', '.')) || 0;
  const totalTarget =
    cara === 'total' ? totalIn : cara === 'persen' ? Math.round(principal * (1 + (pct / 100) * (frequency === 'bulanan' ? count : 1))) : 0;
  const installment = cara === 'angsuran' ? installmentIn : angsuranDariTotal(totalTarget, count);
  const total = cara === 'angsuran' ? installment * count : totalTarget;
  const last = total - installment * (count - 1);
  const handed = principal - (adminMode === 'potong' ? admin : 0) - savings;
  const untung = total - principal + admin;
  const per = frequency === 'harian' ? 'hari' : frequency === 'mingguan' ? 'minggu' : 'bulan';
  const skipped = useMemo(() => {
    if (!dates.length) return [] as string[];
    const out: string[] = [];
    for (let d = firstDate; d <= dates[dates.length - 1] && out.length < 60; d = addDays(d, 1)) {
      if (isLiburTagih(parseYmd(d), { minggu, cuti }) && (frequency === 'harian' || dates.some((x) => x > d && x <= addDays(d, 6)))) {
        const h = liburPada(d)[0];
        if (h || frequency === 'harian') out.push(h ? `${tgl(d)} (${h.nama})` : `${tgl(d)} (Minggu)`);
      }
    }
    return out;
  }, [dates, firstDate, minggu, cuti, frequency]);
  const noData = tahunTanpaData(dates);
  const bad =
    !principal
      ? 'Isi jumlah pinjaman.'
      : admin >= principal
        ? 'Admin harus lebih kecil dari pinjaman.'
        : handed < 1
          ? 'Admin + tabungan harus lebih kecil dari pinjaman.'
        : !installment || !count
          ? 'Isi angsuran per kali dan berapa kali.'
          : total < principal
            ? `Total angsuran (${formatIDR(total)}) lebih kecil dari pinjaman.`
            : count > 400
              ? 'Maksimal 400 kali angsuran.'
              : !accountId
                ? 'Pilih kas.'
                : '';

  const save = async () => {
    if (bad) return setError(bad);
    if (!borrowerId && (data.memberReady || !newName.trim())) return setError(data.memberReady ? 'Pilih anggota.' : 'Pilih atau tambah peminjam.');
    if (jaminan.on && !jaminan.ket.trim() && !jaminan.nilai) return setError('Isi keterangan jaminan (atau matikan "Ada jaminan").');
    setBusy(true);
    setError('');
    try {
      const bid = borrowerId || (await shopLoanService.addBorrower(shop.id, { name: newName.trim(), wa: newWa.trim() || undefined }));
      if (!borrowerId) setBorrowerId(bid);
      const r = await shopLoanService.createLoan(shop.id, {
        requestId,
        borrowerId: bid,
        principal,
        adminFee: admin,
        adminMode: adminMode === 'tanpa' ? 'potong' : adminMode,
        installment,
        count,
        frequency,
        date,
        dueDates: dates,
        accountId,
        ...(cara !== 'angsuran' ? { total } : {}),
        ...(savings > 0 ? { savings } : {}),
        ...(jaminan.on ? { collateral: { jenis: jaminan.jenis, ket: jaminan.ket.trim(), nilai: jaminan.nilai || null } } : {}),
      });
      // Foto jaminan diunggah setelah pinjaman tercatat. Gagal → pinjaman tetap tercatat, foto bisa ditambah dari detail.
      let fotoGagal = '';
      if (jaminan.on) {
        for (let i = 0; i < jaminan.photos.length; i++) {
          try {
            await shopLoanService.uploadCollateralPhoto(shop.id, r.id, i, jaminan.photos[i]);
          } catch (e) {
            fotoGagal = e instanceof Error ? e.message : 'gagal';
            break;
          }
        }
      }
      onDone(
        fotoGagal
          ? `Pinjaman tercatat, tapi foto jaminan gagal diunggah (${fotoGagal}). Tambahkan lagi dari detail pinjaman.`
          : `Pinjaman tercatat. Uang diserahkan ${formatIDR(r.handed)}.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.');
      setBusy(false);
    }
  };

  const seg = <T extends string>(value: T, set: (v: T) => void, opts: [T, string][]) => (
    <div className={cn('grid gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800', opts.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
      {opts.map(([v, l]) => (
        <button
          key={v}
          type="button"
          onClick={() => set(v)}
          className={cn('rounded-xl py-2 fs-13 font-bold', value === v ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-500')}
        >
          {l}
        </button>
      ))}
    </div>
  );
  const rupiah = (v: number, set: (n: number) => void, ph: string, label: string) => (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <input value={moneyText(v)} onChange={(e) => set(money(e.target.value))} inputMode="numeric" placeholder={ph} className={cn(fieldCls, 'tabular-nums')} />
    </label>
  );

  return (
    <div className="space-y-4">
      <label className="block">
        <span className={labelCls}>Peminjam</span>
        <select value={borrowerId} onChange={(e) => setBorrowerId(e.target.value)} className={fieldCls}>
          <option value="">{data.memberReady ? '— Pilih anggota —' : '+ Peminjam baru'}</option>
          {free.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        {busyIds.size > 0 && <span className="mt-1 block fs-11 text-slate-400">Yang masih punya pinjaman aktif tidak muncul di sini.</span>}
        {data.memberReady && (free.length === 0 || belumLengkap > 0) && (
          <span className="mt-1 block fs-12 text-amber-700">
            {free.length === 0 ? 'Belum ada anggota yang bisa diberi pinjaman. ' : ''}
            {belumLengkap > 0 ? `${belumLengkap} peminjam belum lengkap datanya. ` : ''}Daftarkan / lengkapi dulu di menu <b>Anggota</b>.
          </span>
        )}
      </label>
      {!borrowerId && !data.memberReady && (
        <div className="grid grid-cols-2 gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={60} placeholder="Nama peminjam" aria-label="Nama peminjam baru" className={fieldCls} />
          <input value={newWa} onChange={(e) => setNewWa(e.target.value)} inputMode="tel" placeholder="WA (opsional)" aria-label="WA peminjam baru" className={fieldCls} />
        </div>
      )}
      <div className={cn('grid gap-2', adminMode === 'tanpa' ? 'grid-cols-1' : 'grid-cols-2')}>
        {rupiah(principal, setPrincipal, 'Mis. 1.000.000', 'Jumlah pinjaman')}
        {adminMode !== 'tanpa' && rupiah(adminInput, setAdmin, 'Mis. 50.000', 'Admin')}
      </div>
      {seg(adminMode, setAdminMode, [
        ['potong', 'Admin dipotong'],
        ['terpisah', 'Admin terpisah'],
        ['tanpa', 'Tanpa admin'],
      ])}
      {seg(frequency, setFrequency, [
        ['harian', 'Harian'],
        ['mingguan', 'Mingguan'],
        ['bulanan', 'Bulanan'],
      ])}
      <div>
        <span className={labelCls}>Hitungan pengembalian</span>
        {seg(cara, setCara, [
          ['angsuran', `Angsuran per ${per}`],
          ['total', 'Total kembali'],
          ['persen', frequency === 'bulanan' ? 'Jasa %/bulan' : 'Jasa %'],
        ])}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {cara === 'angsuran' ? (
          rupiah(installmentIn, setInstallment, 'Mis. 100.000', `Angsuran per ${per}`)
        ) : cara === 'total' ? (
          rupiah(totalIn, setTotalIn, 'Mis. 1.100.000', 'Total yang dibayar balik')
        ) : (
          <label className="block">
            <span className={labelCls}>{frequency === 'bulanan' ? 'Jasa per bulan (%)' : 'Jasa (%) dari pinjaman'}</span>
            <input value={jasaPct} onChange={(e) => setJasaPct(e.target.value.replace(/[^\d.,]/g, '').slice(0, 6))} inputMode="decimal" placeholder="Mis. 10" className={cn(fieldCls, 'tabular-nums')} />
          </label>
        )}
        <label className="block">
          <span className={labelCls}>{frequency === 'bulanan' ? 'Berapa bulan' : 'Berapa kali'}</span>
          <input
            value={count || ''}
            onChange={(e) => setCount(Math.min(400, Number(e.target.value.replace(/\D/g, '').slice(0, 3)) || 0))}
            inputMode="numeric"
            placeholder="Mis. 12"
            className={cn(fieldCls, 'tabular-nums')}
          />
        </label>
      </div>
      {cara !== 'angsuran' && installment > 0 && count > 0 && (
        <p className="-mt-2 fs-12 text-slate-500">
          Angsuran {formatIDR(installment)} per {per}
          {last !== installment ? ` (yang terakhir ${formatIDR(last)})` : ''} · total {formatIDR(total)}
        </p>
      )}
      {rupiah(savings, setSavings, 'Kosongkan kalau tidak ada', 'Tabungan dipotong di awal (opsional)')}
      {savings > 0 && (
        <p className="-mt-2 fs-12 text-slate-500">
          Tabungan milik anggota — tetap di kas, bukan untung. Bisa diambil anggota kapan saja dari menu Anggota.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className={labelCls}>Tanggal uang diserahkan</span>
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} className={fieldCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Angsuran pertama</span>
          <input
            type="date"
            value={firstDate}
            min={addDays(date, 1)}
            onChange={(e) => {
              setFirst(e.target.value);
              setFirstTouched(Boolean(e.target.value));
            }}
            className={fieldCls}
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <label className="flex items-center gap-2 fs-13 font-semibold text-slate-700 dark:text-slate-200">
          <input type="checkbox" checked={minggu} onChange={(e) => setMinggu(e.target.checked)} className="h-4 w-4 accent-emerald-600" /> Minggu libur
        </label>
        <label className="flex items-center gap-2 fs-13 font-semibold text-slate-700 dark:text-slate-200">
          <input type="checkbox" checked={cuti} onChange={(e) => setCuti(e.target.checked)} className="h-4 w-4 accent-emerald-600" /> Cuti bersama libur
        </label>
        <span className="fs-12 text-slate-400">Tanggal merah selalu libur.</span>
      </div>
      {data.collateralReady && <JaminanInput value={jaminan} onChange={setJaminan} />}
      <label className="block">
        <span className={labelCls}>Uang diambil dari kas</span>
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={fieldCls}>
          {kas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {formatIDR(a.balance)}
            </option>
          ))}
        </select>
      </label>

      {principal > 0 && installment > 0 && count > 0 && (
        <section className="space-y-2 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/50">
          {[
            ['Uang diserahkan ke peminjam', formatIDR(Math.max(0, handed)), ''],
            ...(savings > 0 ? [['Tabungan anggota (dipotong)', formatIDR(savings), '']] : []),
            ['Total yang dibayar balik', last !== installment ? `${formatIDR(total)} (${count - 1}× ${formatIDR(installment)} + ${formatIDR(last)})` : `${formatIDR(total)} (${count}× ${formatIDR(installment)})`, ''],
            ['Untung', admin ? `${formatIDR(untung)} (admin ${formatIDR(admin)} + jasa ${formatIDR(total - principal)})` : `${formatIDR(untung)} (jasa saja, tanpa admin)`, untung < 0 ? 'text-rose-600' : 'text-emerald-700 dark:text-emerald-300'],
            ['Selesai', dates.length ? tgl(dates[dates.length - 1], true) : '—', ''],
          ].map(([k, v, c]) => (
            <p key={k} className="flex justify-between gap-3 fs-13">
              <span className="text-slate-500">{k}</span>
              <b className={cn('text-right tabular-nums text-slate-900 dark:text-white', c)}>{v}</b>
            </p>
          ))}
          {skipped.length > 0 && (
            <p className="fs-12 text-slate-500">
              Melewati {skipped.length} hari libur: {skipped.slice(0, 6).join(', ')}
              {skipped.length > 6 ? `, +${skipped.length - 6} lagi` : ''}.
            </p>
          )}
          {noData.length > 0 && (
            <p className="flex items-start gap-1.5 fs-12 text-amber-700">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> Tanggal merah {noData.join(', ')} belum tersedia — hanya Minggu yang
              dilewati untuk tahun itu.
            </p>
          )}
          <button type="button" onClick={() => setShowDates((v) => !v)} className="fs-12 font-bold text-violet-600 dark:text-violet-300">
            {showDates ? 'Sembunyikan jadwal' : `Lihat ${dates.length} tanggal tagihan`}
          </button>
          {showDates && (
            <ol className="grid max-h-56 grid-cols-2 gap-x-4 gap-y-1 overflow-y-auto fs-12 text-slate-600 sm:grid-cols-3 dark:text-slate-300">
              {dates.map((d, i) => (
                <li key={d} className="tabular-nums">
                  {i + 1}. {tgl(d, true)}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
      {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 fs-13 font-semibold text-rose-600 dark:bg-rose-500/10">{error}</p>}
      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 py-3.5 fs-15 font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {busy ? <Loader2 size={18} className="animate-spin" /> : <Wallet size={18} />} Serahkan {handed > 0 ? formatIDR(handed) : 'pinjaman'}
      </button>
    </div>
  );
}

// ── Form: terima angsuran ───────────────────────────────────────────────────────
function PayForm({
  shop,
  loan,
  st,
  kas,
  today,
  petugas,
  onDone,
}: {
  shop: Shop;
  loan: Loan;
  st: StatusPinjaman;
  kas: ShopBook['accounts'];
  today: string;
  /** Akun Petugas: kas & tanggal ditentukan server (kas pilihan pemilik, hari ini). */
  petugas?: { kasName: string | null } | null;
  onDone: (m?: string) => void;
}) {
  const [amountIn, setAmount] = useState(st.tagihan || Math.min(loan.installment, st.sisa));
  // Bayar lunas: bayar seluruh sisa sekaligus, boleh dengan potongan (khusus pemilik, maks sebesar jasa).
  const [lunas, setLunas] = useState(false);
  const [potongan, setPotongan] = useState(0);
  const maxPotongan = Math.max(0, loan.total - loan.principal);
  const amount = lunas ? Math.max(0, st.sisa - potongan) : amountIn;
  const [accountId, setAccountId] = useState(loan.accountId && kas.some((a) => a.id === loan.accountId) ? loan.accountId : (kas.find((a) => a.isDefault)?.id ?? kas[0]?.id ?? ''));
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [requestId] = useState(() => crypto.randomUUID());
  const save = async () => {
    if (lunas && potongan > maxPotongan) return setError(`Potongan maksimal sebesar jasanya, ${formatIDR(maxPotongan)}.`);
    if (!amount) return setError('Isi nominal yang dibayar.');
    if (amount > st.sisa) return setError(`Melebihi sisa pinjaman (${formatIDR(st.sisa)}).`);
    if (petugas && !petugas.kasName) return setError('Pemilik usaha belum menyiapkan kas usaha untuk angsuran.');
    setBusy(true);
    setError('');
    try {
      const r = await shopLoanService.pay(shop.id, loan.id, { requestId, amount, accountId, date, ...(lunas ? { settle: { discount: potongan } } : {}) });
      onDone(
        r.lunas
          ? lunas && potongan > 0
            ? `Lunas dengan potongan ${formatIDR(potongan)}. 🎉`
            : 'Angsuran diterima — pinjaman LUNAS. 🎉'
          : `Angsuran ${formatIDR(amount)} diterima.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.');
      setBusy(false);
    }
  };
  const chips = [...new Set([st.tagihan, loan.installment, st.sisa].filter((n) => n > 0 && n <= st.sisa))];
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-slate-50 p-3 fs-13 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
        Tagihan hari ini <b className="text-slate-900 dark:text-white">{formatIDR(st.tagihan)}</b>
        {st.nunggakKali > 0 ? ` (termasuk nunggak ${st.nunggakKali}×)` : ''} · sisa pinjaman {formatIDR(st.sisa)}
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
        {([
          [false, 'Angsuran biasa'],
          [true, 'Bayar lunas'],
        ] as const).map(([v, l]) => (
          <button
            key={l}
            type="button"
            onClick={() => {
              setLunas(v);
              setPotongan(0);
            }}
            className={cn('rounded-xl py-2 fs-13 font-bold', lunas === v ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-500')}
          >
            {l}
          </button>
        ))}
      </div>
      {lunas ? (
        <div className="space-y-3">
          {!petugas && maxPotongan > 0 && (
            <label className="block">
              <span className={labelCls}>Potongan pelunasan (opsional, maks {formatIDR(maxPotongan)})</span>
              <input value={moneyText(potongan)} onChange={(e) => setPotongan(Math.min(maxPotongan, money(e.target.value)))} inputMode="numeric" placeholder="Kosongkan kalau tanpa potongan" className={cn(fieldCls, 'tabular-nums')} />
            </label>
          )}
          <div className="rounded-2xl bg-emerald-50 p-3 dark:bg-emerald-500/10">
            <p className="fs-12 text-emerald-800 dark:text-emerald-200">Yang dibayar untuk melunasi</p>
            <p className="fsh-22 font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">{formatIDR(amount)}</p>
            <p className="fs-12 text-emerald-800/80 dark:text-emerald-200/80">
              Sisa {formatIDR(st.sisa)}
              {potongan > 0 ? ` − potongan ${formatIDR(potongan)} (jasa berkurang)` : ''} · pinjaman langsung lunas.
            </p>
          </div>
        </div>
      ) : (
      <>
      <label className="block">
        <span className={labelCls}>Dibayar</span>
        <input value={moneyText(amountIn)} onChange={(e) => setAmount(money(e.target.value))} inputMode="numeric" className={cn(fieldCls, 'fsh-22 font-extrabold tabular-nums')} />
      </label>
      <div className="flex flex-wrap gap-2">
        {chips.map((n) => (
          <button key={n} type="button" onClick={() => setAmount(n)} className="rounded-full bg-slate-100 px-3 py-1.5 fs-12 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {n === st.sisa ? `Lunasi ${formatIDR(n)}` : n === st.tagihan ? `Tagihan ${formatIDR(n)}` : `1× ${formatIDR(n)}`}
          </button>
        ))}
      </div>
      </>
      )}
      {petugas ? (
        <p className="rounded-2xl bg-slate-50 px-3 py-2.5 fs-12 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
          Masuk ke <b>{petugas.kasName ?? 'kas usaha'}</b> · tanggal hari ini · tercatat atas namamu.
        </p>
      ) : (
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className={labelCls}>Masuk ke kas</span>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={fieldCls}>
            {kas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Tanggal</span>
          <input type="date" value={date} min={loan.disbursedOn} max={today} onChange={(e) => setDate(e.target.value || today)} className={fieldCls} />
        </label>
      </div>
      )}
      {!lunas && amount > st.tagihan && st.tagihan >= 0 && amount <= st.sisa && (
        <p className="fs-12 text-slate-500">Lebihnya {formatIDR(amount - st.tagihan)} dihitung bayar di muka untuk tagihan berikutnya.</p>
      )}
      {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 fs-13 font-semibold text-rose-600 dark:bg-rose-500/10">{error}</p>}
      <button type="button" onClick={save} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 py-3.5 fs-15 font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50">
        {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Terima {formatIDR(amount)}
      </button>
    </div>
  );
}

// ── Detail pinjaman: jadwal, angsuran, hapus ─────────────────────────────────────
function LoanDetail({
  shop,
  loan,
  borrower,
  data,
  today,
  onPay,
  onGeser,
  petugas,
  onToast,
  onDone,
  onKas,
}: {
  shop: Shop;
  loan: Loan;
  borrower?: Borrower;
  data: LoanBook;
  today: string;
  onPay: (st: StatusPinjaman) => void;
  /** Tidak ada untuk Petugas (khusus pemilik). */
  onGeser?: () => void;
  petugas?: boolean;
  onToast: (m: string) => void;
  onDone: (m?: string) => void;
  onKas?: () => void;
}) {
  const st = statusPinjaman(loan, today);
  const pays = data.payments.filter((p) => p.loanId === loan.id).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const covered = Math.floor(loan.paid / Math.max(1, loan.installment));
  const removeLoan = async () => {
    if (!window.confirm(`Hapus pinjaman ${borrower?.name ?? ''}? Uang yang diserahkan kembali ke kas.`)) return;
    setBusy(true);
    try {
      await shopLoanService.removeLoan(shop.id, loan.id);
      onDone('Pinjaman dihapus, kas dikembalikan.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghapus.');
      setBusy(false);
    }
  };
  const removePay = async (id: string, amount: number) => {
    if (!window.confirm(`Hapus angsuran ${formatIDR(amount)}? Kas ikut berkurang.`)) return;
    setBusy(true);
    try {
      await shopBookService.removeEntry(shop.id, id);
      onDone('Angsuran dihapus.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghapus.');
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 fs-13 font-semibold text-rose-600 dark:bg-rose-500/10">{error}</p>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Pinjaman', formatIDR(loan.principal)],
          ['Admin', loan.adminFee ? `${formatIDR(loan.adminFee)}${loan.adminMode === 'potong' ? ' (dipotong)' : ''}` : 'Tanpa admin'],
          ['Dibayar', `${formatIDR(loan.paid)} / ${formatIDR(loan.total)}`],
          ['Sisa', formatIDR(st.sisa)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/50">
            <p className="fs-11 text-slate-500">{k}</p>
            <p className="fs-14 font-extrabold tabular-nums text-slate-900 dark:text-white">{v}</p>
          </div>
        ))}
      </div>
      <p className="fs-13 text-slate-600 dark:text-slate-300">
        {loan.count}× {formatIDR(loan.installment)} {loan.frequency} · cair {tgl(loan.disbursedOn)} ·{' '}
        {loan.status === 'lunas' ? <b className="text-emerald-700">lunas</b> : st.telat ? <b className="text-rose-600">telat {st.telat} hari</b> : 'lancar'}
        {borrower?.wa ? ` · WA ${borrower.wa}` : ''}
        {loan.savings > 0 ? ` · tabungan dipotong ${formatIDR(loan.savings)}` : ''}
        {loan.discount > 0 ? ` · potongan pelunasan ${formatIDR(loan.discount)}` : ''}
      </p>
      {loan.status === 'aktif' && (
        <button type="button" onClick={() => onPay(st)} className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 py-3 fs-14 font-extrabold text-white hover:bg-emerald-700">
          <HandCoins size={17} /> Terima angsuran{st.tagihan ? ` · tagihan ${formatIDR(st.tagihan)}` : ''}
        </button>
      )}
      {loan.status === 'aktif' && onGeser && (
        <button
          type="button"
          onClick={onGeser}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-100 py-2.5 fs-13 font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
        >
          <CalendarDays size={15} /> Geser jadwal (sakit, pulang kampung, dll.)
        </button>
      )}
      {data.collateralReady && <JaminanSection key={loan.id} shop={shop} loan={loan} v={data.loadedAt} onToast={onToast} readOnly={petugas} />}
      <details className="rounded-2xl bg-white ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800" open={loan.status === 'aktif'}>
        <summary className="cursor-pointer px-4 py-3 fs-14 font-extrabold text-slate-900 dark:text-white">Jadwal ({loan.dueDates.length} tanggal)</summary>
        <ol className="grid max-h-64 grid-cols-2 gap-x-4 gap-y-1 overflow-y-auto px-4 pb-4 fs-12 sm:grid-cols-3">
          {loan.dueDates.map((d, i) => {
            const done = i < covered;
            const late = !done && d < today;
            return (
              <li key={d} className={cn('flex items-center gap-1 tabular-nums', done ? 'text-emerald-700 dark:text-emerald-300' : late ? 'font-bold text-rose-600' : d === today ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-500')}>
                {done ? <Check size={12} /> : <span className="w-3" />} {i + 1}. {tgl(d, true)}
              </li>
            );
          })}
        </ol>
      </details>
      <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
        <p className="fs-14 font-extrabold text-slate-900 dark:text-white">Angsuran masuk ({pays.length})</p>
        {pays.length === 0 ? (
          <p className="mt-1 fs-13 text-slate-500">Belum ada.</p>
        ) : (
          <ul className="mt-1 divide-y divide-slate-100 dark:divide-slate-800">
            {pays.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2">
                <span className="flex-1 fs-13 text-slate-600 dark:text-slate-300">{tgl(p.date, true)}</span>
                <span className="fs-13 font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">+{formatIDR(p.amount)}</span>
                {!petugas && (
                  <button type="button" onClick={() => removePay(p.id, p.amount)} disabled={busy} aria-label="Hapus angsuran" className="p-1 text-slate-300 hover:text-rose-500">
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {onKas && loan.paid > pays.reduce((a, p) => a + p.amount, 0) && (
          <button type="button" onClick={onKas} className="mt-1 fs-12 font-bold text-violet-600">
            Angsuran lebih lama ada di riwayat Kas →
          </button>
        )}
      </section>
      {!petugas && pays.length === 0 && loan.paid === 0 && (
        <button type="button" onClick={removeLoan} disabled={busy} className="flex w-full items-center justify-center gap-1.5 py-2 fs-13 font-bold text-rose-600">
          <Trash2 size={14} /> Hapus pinjaman (salah input)
        </button>
      )}
    </div>
  );
}

// ── Geser jadwal: yang sudah dibayar tetap, sisanya disusun ulang dari tanggal baru ────────
function GeserForm({ shop, loan, today, onDone }: { shop: Shop; loan: Loan; today: string; onDone: (m?: string) => void }) {
  const covered = Math.min(loan.dueDates.length, Math.floor(loan.paid / Math.max(1, loan.installment)));
  const kept = loan.dueDates.slice(0, covered);
  const firstOld = loan.dueDates[covered] ?? today;
  const lastKept = kept[kept.length - 1] ?? loan.disbursedOn;
  const minStart = [today, addDays(lastKept, 1), addDays(loan.disbursedOn, 1)].sort().pop() as string;
  // Sudah nunggak → paling masuk akal mulai lagi dari tanggal tertentu (mis. besok); belum → mundurkan N hari.
  const [mode, setMode] = useState<'mundur' | 'mulai'>(firstOld < today ? 'mulai' : 'mundur');
  const [days, setDays] = useState(loan.frequency === 'harian' ? 3 : loan.frequency === 'bulanan' ? 30 : 7);
  const [start, setStart] = useState(addDays(today, 1) > minStart ? addDays(today, 1) : minStart);
  const [minggu, setMinggu] = useState(true);
  const [cuti, setCuti] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useSyncExternalStore(liburStore.subscribe, liburStore.versi, liburStore.versi);
  const rest = loan.count - covered;
  const from = mode === 'mundur' ? addDays(firstOld, Math.max(0, days)) : start;
  const effFrom = from < minStart ? minStart : from;
  const baru = useMemo(() => buatJadwal(effFrom, rest, loan.frequency, { minggu, cuti }), [effFrom, rest, loan.frequency, minggu, cuti]);
  const dates = [...kept, ...baru];
  const oldEnd = loan.dueDates[loan.dueDates.length - 1] ?? '';
  const newEnd = dates[dates.length - 1] ?? '';
  const save = async () => {
    if (rest <= 0 || baru.length !== rest) return setError('Tidak ada jadwal yang bisa digeser.');
    setBusy(true);
    setError('');
    try {
      await shopLoanService.reschedule(shop.id, loan.id, { dueDates: dates, expectedPaid: loan.paid });
      onDone(`Jadwal digeser. Selesai sekarang ${tgl(newEnd, true)}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.');
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <p className="rounded-2xl bg-slate-50 p-3 fs-13 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
        {covered > 0 && `${covered} angsuran yang sudah dibayar tidak berubah. `}Yang digeser: <b>{rest} angsuran</b> mulai jadwal{' '}
        {tgl(firstOld, true)}.
        Angsuran yang belum dibayar (termasuk yang nunggak) pindah ke tanggal baru, jadi tidak ditagih sebelum tanggal itu.
        Total yang harus dibayar tetap sama.
      </p>
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
        {(
          [
            ['mundur', 'Mundurkan beberapa hari'],
            ['mulai', 'Mulai lagi dari tanggal'],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => setMode(v)}
            className={cn('rounded-xl py-2 fs-13 font-bold', mode === v ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-500')}
          >
            {l}
          </button>
        ))}
      </div>
      {mode === 'mundur' ? (
        <label className="block">
          <span className={labelCls}>Mundur berapa hari</span>
          <input
            value={days || ''}
            onChange={(e) => setDays(Math.min(365, Number(e.target.value.replace(/\D/g, '').slice(0, 3)) || 0))}
            inputMode="numeric"
            className={cn(fieldCls, 'tabular-nums')}
          />
        </label>
      ) : (
        <label className="block">
          <span className={labelCls}>Angsuran berikutnya mulai</span>
          <input type="date" value={start} min={minStart} onChange={(e) => setStart(e.target.value || minStart)} className={fieldCls} />
        </label>
      )}
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <label className="flex items-center gap-2 fs-13 font-semibold text-slate-700 dark:text-slate-200">
          <input type="checkbox" checked={minggu} onChange={(e) => setMinggu(e.target.checked)} className="h-4 w-4 accent-emerald-600" /> Minggu libur
        </label>
        <label className="flex items-center gap-2 fs-13 font-semibold text-slate-700 dark:text-slate-200">
          <input type="checkbox" checked={cuti} onChange={(e) => setCuti(e.target.checked)} className="h-4 w-4 accent-emerald-600" /> Cuti bersama libur
        </label>
      </div>
      <section className="space-y-1.5 rounded-2xl bg-slate-50 p-4 fs-13 dark:bg-slate-800/50">
        <p className="flex justify-between gap-3">
          <span className="text-slate-500">Angsuran berikutnya</span>
          <b className="tabular-nums text-slate-900 dark:text-white">
            {tgl(firstOld, true)} → {baru[0] ? tgl(baru[0], true) : '—'}
          </b>
        </p>
        <p className="flex justify-between gap-3">
          <span className="text-slate-500">Selesai</span>
          <b className="tabular-nums text-slate-900 dark:text-white">
            {tgl(oldEnd, true)} → {newEnd ? tgl(newEnd, true) : '—'}
          </b>
        </p>
        {from < minStart && <p className="fs-12 text-amber-700">Tanggal paling awal yang bisa dipilih {tgl(minStart, true)}.</p>}
      </section>
      {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 fs-13 font-semibold text-rose-600 dark:bg-rose-500/10">{error}</p>}
      <button
        type="button"
        onClick={save}
        disabled={busy || rest <= 0}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 py-3.5 fs-15 font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {busy ? <Loader2 size={18} className="animate-spin" /> : <CalendarDays size={18} />} Simpan jadwal baru
      </button>
    </div>
  );
}
