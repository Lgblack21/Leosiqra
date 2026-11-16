// Hitungan usaha Pinjaman (harian/mingguan) — docs/rancangan/usahaku-pinjaman.md bagian 4.
// Semua rupiah bulat. Jadwal dibuat di sini (melompati tanggal merah/Minggu) lalu dikunci server saat disimpan.
import { liburPada, parseYmd, tahunTersedia, ymd } from '@/lib/hariLibur';
import type { Loan, LoanPayment, LoanReport, LoanReportRow } from '@/lib/services/shopLoanService';

export type LiburOpsi = { minggu: boolean; cuti: boolean };

const plus = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
/** Hari ini tidak ditagih? (tanggal merah; cuti bersama & Minggu sesuai pilihan). */
export const isLiburTagih = (d: Date, o: LiburOpsi) =>
  (o.minggu && d.getDay() === 0) || liburPada(d).some((h) => h.jenis === 'libur' || (o.cuti && h.jenis === 'cuti'));

/**
 * Jadwal tagihan mulai `first` (tanggal angsuran pertama).
 * Harian: tiap hari yang bukan libur. Mingguan: tiap 7 hari dari tanggal pertama; kalau jatuh di hari libur,
 * digeser ke hari tagih berikutnya (minggu berikutnya tetap dihitung dari jadwal asal, tidak ikut bergeser).
 */
export function buatJadwal(first: string, count: number, frequency: 'harian' | 'mingguan', o: LiburOpsi): string[] {
  const out: string[] = [];
  if (!first || count < 1) return out;
  const start = parseYmd(first);
  if (frequency === 'harian') {
    let d = start;
    for (let guard = 0; out.length < count && guard < count * 3 + 60; guard++, d = plus(d, 1)) {
      if (!isLiburTagih(d, o)) out.push(ymd(d));
    }
    return out;
  }
  for (let i = 0; i < count; i++) {
    let d = plus(start, i * 7);
    for (let g = 0; g < 14 && isLiburTagih(d, o); g++) d = plus(d, 1);
    const s = ymd(d);
    // Geser bisa menabrak jadwal minggu berikutnya (libur panjang) — tetap urut naik & unik.
    out.push(out.length && s <= out[out.length - 1] ? ymd(plus(parseYmd(out[out.length - 1]), 1)) : s);
  }
  return out;
}
/** Tahun di jadwal yang belum punya data tanggal merah (peringatan, jadwal tetap dibuat). */
export const tahunTanpaData = (dates: string[]) => {
  const ada = new Set(tahunTersedia());
  return [...new Set(dates.map((d) => Number(d.slice(0, 4))))].filter((y) => !ada.has(y));
};

const hariAntara = (a: string, b: string) => Math.round((parseYmd(b).getTime() - parseYmd(a).getTime()) / 86400e3);

export type StatusPinjaman = {
  /** Jumlah tanggal tagihan s.d. hari ini. */
  jatuh: number;
  /** Seharusnya sudah dibayar s.d. hari ini. */
  seharusnya: number;
  /** Yang perlu dibayar hari ini (termasuk tunggakan). */
  tagihan: number;
  /** Berapa kali angsuran yang tertunggak sebelum hari ini. */
  nunggakKali: number;
  /** Hari ini ada jadwal tagihan? */
  jadwalHariIni: boolean;
  /** Hari telat dari tanggal tagihan tertua yang belum tertutup (0 = tepat waktu / jatuh hari ini). */
  telat: number;
  /** Lebih bayar di muka (> 0 = sudah bayar melebihi jadwal). */
  diMuka: number;
  /** Angsuran ke berapa berikutnya (1-based). */
  ke: number;
  sisa: number;
};
export function statusPinjaman(l: Loan, today: string): StatusPinjaman {
  const jatuh = l.dueDates.filter((d) => d <= today).length;
  const seharusnya = Math.min(l.total, l.installment * jatuh);
  const tagihan = l.status === 'lunas' ? 0 : Math.max(0, seharusnya - l.paid);
  const tertutup = Math.floor(l.paid / Math.max(1, l.installment));
  const oldest = tertutup < jatuh ? l.dueDates[tertutup] : null;
  const jadwalHariIni = l.dueDates.includes(today);
  const nunggakKali = Math.max(0, Math.ceil(tagihan / Math.max(1, l.installment)) - (jadwalHariIni && tagihan > 0 ? 1 : 0));
  return {
    jatuh,
    seharusnya,
    tagihan,
    nunggakKali,
    jadwalHariIni,
    telat: oldest && oldest < today && l.status !== 'lunas' ? hariAntara(oldest, today) : 0,
    diMuka: Math.max(0, l.paid - seharusnya),
    ke: Math.min(l.count, tertutup + 1),
    sisa: Math.max(0, l.total - l.paid),
  };
}
export const kelompokTelat = (telat: number) =>
  telat <= 0 ? 'lancar' : telat <= 7 ? '1–7 hari' : telat <= 30 ? '8–30 hari' : 'lebih dari 30 hari';

/** Jasa yang sudah diakui untuk total dibayar `paid` (proporsional, kumulatif → pas saat lunas). */
export const jasaDiakui = (l: Pick<Loan, 'principal' | 'total'>, paid: number) =>
  l.total > 0 ? Math.round((Math.min(paid, l.total) * (l.total - l.principal)) / l.total) : 0;
/** Modal (pokok) yang masih di luar. */
export const modalDiLuar = (l: Loan) => (l.status === 'lunas' ? 0 : Math.max(0, l.principal - (l.paid - jasaDiakui(l, l.paid))));

/**
 * Pendapatan dalam rentang [from, to]: admin pinjaman yang cair di rentang + jasa dari angsuran di rentang.
 * Jasa per angsuran = jasa diakui (kumulatif setelah) − (sebelum), urut tanggal.
 */
export function pendapatan(loans: Loan[], payments: LoanPayment[], from: string, to: string) {
  let admin = 0;
  let jasa = 0;
  const byLoan = new Map<string, LoanPayment[]>();
  for (const p of payments) byLoan.set(p.loanId, [...(byLoan.get(p.loanId) ?? []), p]);
  for (const l of loans) {
    if (l.disbursedOn >= from && l.disbursedOn <= to) admin += l.adminFee;
    const list = (byLoan.get(l.id) ?? []).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
    // Angsuran lebih lama dari jendela data (400 hari) sudah termasuk di l.paid.
    let cum = l.paid - list.reduce((a, p) => a + p.amount, 0);
    for (const p of list) {
      const before = jasaDiakui(l, cum);
      cum += p.amount;
      if (p.date >= from && p.date <= to) jasa += jasaDiakui(l, cum) - before;
    }
  }
  return { admin, jasa, total: admin + jasa };
}

// ── Laporan per periode (data dari /pinjaman/laporan) ─────────────────────────
export type BarisLaporan = {
  l: LoanReportRow;
  /** Angsuran masuk di periode. */
  masuk: number;
  /** Jasa yang diakui di periode. */
  jasa: number;
  /** Admin yang diakui di periode (pinjaman cair di periode). */
  admin: number;
  /** Sisa tagihan di akhir periode. */
  sisa: number;
  /** Pokok yang masih di luar di akhir periode. */
  modal: number;
  /** Status di akhir periode (telat dihitung per tanggal akhir periode). */
  st: StatusPinjaman;
};
export function rekapLaporan(r: LoanReport) {
  const { from, to } = r.range;
  const rows: BarisLaporan[] = r.loans.map((l) => {
    const cairDiPeriode = l.disbursedOn >= from && l.disbursedOn <= to;
    const asOf: Loan = { ...l, paid: l.paidTo, status: l.paidTo >= l.total ? 'lunas' : 'aktif' };
    return {
      l,
      masuk: l.paidTo - l.paidBefore,
      jasa: jasaDiakui(l, l.paidTo) - jasaDiakui(l, l.paidBefore),
      admin: cairDiPeriode ? l.adminFee : 0,
      sisa: Math.max(0, l.total - l.paidTo),
      modal: modalDiLuar(asOf),
      st: statusPinjaman(asOf, to),
    };
  });
  const cair = rows.filter((x) => x.l.disbursedOn >= from && x.l.disbursedOn <= to);
  const sum = (list: BarisLaporan[], f: (x: BarisLaporan) => number) => list.reduce((a, x) => a + f(x), 0);
  const aktifAkhir = rows.filter((x) => x.sisa > 0);
  return {
    rows,
    cair: {
      n: cair.length,
      pokok: sum(cair, (x) => x.l.principal),
      diserahkan: sum(cair, (x) => (x.l.adminMode === 'potong' ? x.l.principal - x.l.adminFee : x.l.principal)),
    },
    admin: sum(rows, (x) => x.admin),
    jasa: sum(rows, (x) => x.jasa),
    pendapatan: sum(rows, (x) => x.admin + x.jasa),
    masuk: { n: r.payments.length, total: r.payments.reduce((a, p) => a + p.amount, 0) },
    beredar: sum(aktifAkhir, (x) => x.sisa),
    modal: sum(aktifAkhir, (x) => x.modal),
    aktif: aktifAkhir.length,
    lunasDiPeriode: rows.filter((x) => x.sisa === 0 && x.l.paidBefore < x.l.total && x.l.paidTo >= x.l.total).length,
    telat: ['1–7 hari', '8–30 hari', 'lebih dari 30 hari'].map((g) => {
      const list = aktifAkhir.filter((x) => kelompokTelat(x.st.telat) === g);
      return { g, n: list.length, tagihan: sum(list, (x) => x.st.tagihan) };
    }),
  };
}
export type RekapLaporan = ReturnType<typeof rekapLaporan>;
