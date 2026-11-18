'use client';

import { useRef } from 'react';
import { Check, Printer } from 'lucide-react';
import type { Shop } from '@/lib/services/shopService';
import type { Borrower, Loan, LoanPayment } from '@/lib/services/shopLoanService';
import { statusPinjaman } from '@/lib/usaha/pinjaman';
import { parseYmd } from '@/lib/hariLibur';
import { cn, formatIDR } from '@/lib/utils';
import { LogoUsaha } from './LogoUsaha';

// Kartu Pinjaman (3.46) — tampilan seperti kartu angsuran kertas koperasi: data peminjam, rincian pinjaman, tanda
// terima simpanan, dan kotak Ke-1 … Ke-N yang terisi otomatis (tanggal bayar + siapa yang menerima). Bisa dicetak.

const NAVY = '#0f2a5c';
const GOLD = '#c9a227';
const tglPendek = (ymd: string | null | undefined) => {
  if (!ymd) return '—';
  const d = parseYmd(ymd);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`;
};

type Kotak = {
  ke: number;
  jadwal: string | null;
  nominal: number;
  /** Tanggal angsuran ini tertutup penuh (null = belum). */
  lunasPada: string | null;
  oleh: string | null;
  dariSimpanan: boolean;
  /** Sudah dibayar sebagian (rupiah). */
  sebagian: number;
};

/** Bagi uang yang sudah masuk ke kotak angsuran berurutan (Ke-1 dulu), catat kapan tiap kotak tertutup. */
export function kotakAngsuran(loan: Loan, payments: LoanPayment[]): Kotak[] {
  const pays = payments
    .filter((p) => p.loanId === loan.id)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  // Angsuran yang lebih lama dari jendela data (400 hari) sudah termasuk di loan.paid → dianggap "lama".
  const awal = Math.max(0, loan.paid - pays.reduce((a, p) => a + p.amount, 0));
  let cum = awal;
  let pi = 0;
  let terakhir: LoanPayment | null = null;
  const out: Kotak[] = [];
  for (let i = 1; i <= loan.count; i++) {
    const sebelum = Math.min(loan.total, loan.installment * (i - 1));
    const batas = Math.min(loan.total, loan.installment * i);
    // Ambil pembayaran berikutnya sampai kotak ini tertutup; satu pembayaran besar bisa menutup beberapa kotak.
    while (cum < batas && pi < pays.length) {
      terakhir = pays[pi++];
      cum += terakhir.amount;
    }
    const tutup = cum >= batas;
    const lama = tutup && awal >= batas;
    out.push({
      ke: i,
      jadwal: loan.dueDates[i - 1] ?? null,
      nominal: batas - sebelum,
      lunasPada: tutup ? (lama ? 'lama' : (terakhir?.date ?? null)) : null,
      oleh: tutup && !lama ? (terakhir?.byName ?? null) : null,
      dariSimpanan: tutup && !lama ? Boolean(terakhir?.fromSavings) : false,
      sebagian: tutup ? 0 : Math.max(0, cum - sebelum),
    });
  }
  return out;
}

const PERUNTUKAN: Record<string, string> = {
  lunas: 'Dikembalikan setelah lunas',
  akhir: 'Bayar cicilan terakhir',
  bebas: 'Tabungan',
};

export function KartuPinjaman({
  shop,
  loan,
  borrower,
  payments,
  today,
}: {
  shop: Shop;
  loan: Loan;
  borrower?: Borrower;
  payments: LoanPayment[];
  today: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const st = statusPinjaman(loan, today);
  const kotak = kotakAngsuran(loan, payments);
  const diterima = loan.principal - (loan.adminMode === 'potong' ? loan.adminFee : 0) - loan.savings;
  const jasa = Math.max(0, loan.total - loan.principal);
  const noPinjaman = `PJ-${loan.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
  const saldoSimpanan = Math.max(0, loan.savings - loan.savingsUsed);

  const cetak = () => {
    const el = ref.current;
    if (!el) return;
    const w = window.open('', '_blank', 'noopener=no');
    if (!w) return;
    const css = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((n) => n.outerHTML)
      .join('');
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>Kartu Pinjaman ${borrower?.name ?? ''}</title>${css}<style>@page{size:A4;margin:10mm}body{background:#fff;margin:0}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>${el.outerHTML}<script>setTimeout(function(){window.print()},600)<\/script></body></html>`,
    );
    w.document.close();
  };

  const baris = (label: string, isi: React.ReactNode) => (
    <div className="grid grid-cols-[112px_10px_1fr] items-baseline gap-1 border-b border-dashed border-slate-200 py-1.5 fs-13 last:border-0 sm:grid-cols-[140px_10px_1fr]">
      <span className="text-slate-600">{label}</span>
      <span className="text-slate-400">:</span>
      <span className="min-w-0 break-words font-semibold text-slate-900">{isi}</span>
    </div>
  );

  return (
    <div className="space-y-3">
      <div ref={ref} data-kartu-pinjaman className="overflow-hidden rounded-[22px] bg-white text-slate-900 shadow-sm ring-1 ring-slate-200">
        {/* Kepala: pita biru tua + garis emas */}
        <div className="relative overflow-hidden px-4 pb-4 pt-4 sm:px-6" style={{ background: NAVY }}>
          <span aria-hidden className="absolute -right-12 top-0 h-full w-20 -skew-x-[30deg] sm:-right-10 sm:w-36" style={{ background: `linear-gradient(90deg, ${GOLD}, #f3d77a)` }} />
          <span aria-hidden className="absolute -right-4 top-0 h-full w-6 -skew-x-[30deg] bg-white/90 sm:-right-2 sm:w-10" />
          <div className="relative flex items-center gap-3 pr-10 sm:pr-28">
            <LogoUsaha src={shop.style.logoUrl} alt="" fallback={<span className="text-2xl">{shop.emoji || '🤝'}</span>} className="h-14 w-14 rounded-2xl bg-white sm:h-16 sm:w-16" />
            <div className="min-w-0">
              <p className="truncate fs-18 font-black uppercase tracking-wide text-white sm:fs-22">{shop.name}</p>
              <p className="fs-12 font-extrabold uppercase tracking-[0.2em]" style={{ color: GOLD }}>
                Kartu Pinjaman
              </p>
            </div>
          </div>
        </div>
        <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${GOLD}, #f3d77a, ${GOLD})` }} />

        <div className="space-y-4 p-4 sm:p-5">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-lg px-2 py-1 fs-12 font-bold text-white" style={{ background: NAVY }}>
                {noPinjaman}
              </span>
              {borrower?.memberNo && (
                <span className="rounded-lg px-2 py-1 fs-12 font-bold" style={{ background: `${GOLD}22`, color: NAVY }}>
                  No. Anggota {borrower.memberNo}
                </span>
              )}
              <span
                className={cn(
                  'rounded-lg px-2 py-1 fs-12 font-bold',
                  loan.status === 'lunas' ? 'bg-emerald-100 text-emerald-800' : st.telat > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700',
                )}
              >
                {loan.status === 'lunas' ? 'LUNAS' : st.telat > 0 ? `Telat ${st.telat} hari` : 'Lancar'}
              </span>
            </div>
            {baris('Nama', borrower?.name ?? '—')}
            {baris('Alamat', borrower?.address || '—')}
            {baris('No. HP', borrower?.wa || '—')}
            {baris(
              'Jenis pinjaman',
              <span className="flex flex-wrap gap-3 font-semibold">
                {(['harian', 'mingguan', 'bulanan'] as const).map((f) => (
                  <span key={f} className="flex items-center gap-1">
                    <span className={cn('flex h-4 w-4 items-center justify-center rounded border', loan.frequency === f ? 'border-transparent text-white' : 'border-slate-300')} style={loan.frequency === f ? { background: NAVY } : undefined}>
                      {loan.frequency === f && <Check size={11} />}
                    </span>
                    <span className="capitalize">{f}</span>
                  </span>
                ))}
              </span>,
            )}
            {baris('Jumlah pinjaman', formatIDR(loan.principal))}
            {baris('Jasa', `${formatIDR(jasa)}${loan.discount ? ` (potongan ${formatIDR(loan.discount)})` : ''}`)}
            {baris('Admin', loan.adminFee ? `${formatIDR(loan.adminFee)}${loan.adminMode === 'potong' ? ' (dipotong)' : ' (terpisah)'}` : 'Tanpa admin')}
            {baris('Total kembali', `${formatIDR(loan.total)} · ${loan.count}× ${formatIDR(loan.installment)}`)}
            {baris('Total terima', formatIDR(Math.max(0, diterima)))}
            {baris('Tanggal pinjam', tglPendek(loan.disbursedOn))}
            {baris('Jatuh tempo', tglPendek(loan.dueDates[loan.dueDates.length - 1]))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200">
              <p className="px-3 py-2 fs-12 font-extrabold uppercase tracking-wider text-white" style={{ background: NAVY }}>
                Tanda terima simpanan
              </p>
              <div className="space-y-1.5 p-3 fs-13">
                {loan.savings > 0 ? (
                  <>
                    <p className="flex justify-between gap-2">
                      <span className="text-slate-600">Simpanan</span>
                      <b className="tabular-nums">{formatIDR(loan.savings)}</b>
                    </p>
                    <p className="flex justify-between gap-2">
                      <span className="text-slate-600">Untuk</span>
                      <b className="text-right">{PERUNTUKAN[loan.savingsPolicy ?? 'bebas']}</b>
                    </p>
                    {loan.savingsUsed > 0 && (
                      <p className="flex justify-between gap-2">
                        <span className="text-slate-600">Dipakai bayar</span>
                        <b className="tabular-nums">{formatIDR(loan.savingsUsed)}</b>
                      </p>
                    )}
                    <p className="flex justify-between gap-2 border-t border-slate-200 pt-1.5">
                      <span className="text-slate-600">Sisa simpanan</span>
                      <b className="tabular-nums">{formatIDR(saldoSimpanan)}</b>
                    </p>
                  </>
                ) : (
                  <p className="text-slate-500">Tanpa simpanan.</p>
                )}
              </div>
            </div>
            <div className="rounded-2xl p-3 fs-13" style={{ background: `${GOLD}18` }}>
              <p className="flex justify-between gap-2">
                <span className="text-slate-600">Sudah dibayar</span>
                <b className="tabular-nums">{formatIDR(loan.paid)}</b>
              </p>
              <p className="flex justify-between gap-2">
                <span className="text-slate-600">Sisa</span>
                <b className="tabular-nums">{formatIDR(st.sisa)}</b>
              </p>
              {loan.status === 'aktif' && st.tagihan > 0 && (
                <p className="flex justify-between gap-2 text-rose-700">
                  <span>Tagihan hari ini</span>
                  <b className="tabular-nums">{formatIDR(st.tagihan)}</b>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Kotak angsuran Ke-1 … Ke-N */}
        <div className="grid grid-cols-3 gap-2 px-4 pb-4 sm:grid-cols-4 sm:px-5 sm:pb-5">
          {kotak.map((k) => {
            const lunas = Boolean(k.lunasPada);
            const telat = !lunas && k.jadwal !== null && k.jadwal < today;
            const hariIni = !lunas && k.jadwal === today;
            return (
              <div
                key={k.ke}
                className={cn(
                  'relative overflow-hidden rounded-xl ring-1',
                  lunas ? 'bg-emerald-50/60 ring-emerald-200' : telat ? 'ring-rose-200' : hariIni ? 'ring-2 ring-amber-400' : 'ring-slate-200',
                )}
              >
                <p className="flex items-center justify-center gap-1 py-1 fs-14 font-black" style={{ background: lunas ? '#d1fae5' : '#e8eefb', color: NAVY }}>
                  Ke-{k.ke}
                  {lunas && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white" aria-label="lunas">
                      <Check size={11} strokeWidth={3} />
                    </span>
                  )}
                </p>
                <div className="space-y-0.5 px-2 py-1.5 fs-11 leading-tight">
                  <p className="flex justify-between gap-1">
                    <span className="text-slate-500">Jadwal</span>
                    <span className={cn('font-semibold tabular-nums', telat && 'text-rose-600')}>{tglPendek(k.jadwal)}</span>
                  </p>
                  <p className="flex justify-between gap-1">
                    <span className="text-slate-500">Tgl</span>
                    <span className="font-semibold tabular-nums">{lunas ? (k.lunasPada === 'lama' ? '✓' : tglPendek(k.lunasPada)) : '……'}</span>
                  </p>
                  <p className="flex justify-between gap-1">
                    <span className="text-slate-500">Paraf</span>
                    <span className="truncate font-semibold">{lunas ? (k.dariSimpanan ? 'simpanan' : k.oleh || '✓') : '……'}</span>
                  </p>
                  {!lunas && k.sebagian > 0 && (
                    <p className="rounded-md bg-amber-50 px-1 py-0.5 text-center font-bold text-amber-700">kurang {formatIDR(k.nominal - k.sebagian)}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="h-3" style={{ background: `linear-gradient(90deg, ${NAVY} 70%, ${GOLD} 70%, #f3d77a 85%, ${NAVY} 85%)` }} />
      </div>
      <button
        type="button"
        onClick={cetak}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-100 py-2.5 fs-13 font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
      >
        <Printer size={15} /> Cetak / simpan PDF
      </button>
    </div>
  );
}
