import type { Workbook } from 'exceljs';
import { RP, argb, table } from './shopReportXlsx';
import type { LoanReport } from './services/shopLoanService';
import type { RekapLaporan } from './usaha/pinjaman';

// Excel laporan usaha Pinjaman: Ringkasan · Peminjam · Angsuran. exceljs dimuat saat tombol diklik.
const asDate = (d: string) => new Date(`${d}T00:00:00`);

export async function buildPinjamanXlsx(shopName: string, r: LoanReport, k: RekapLaporan, color = '#059669'): Promise<Blob> {
  const mod = (await import('exceljs/dist/exceljs.min.js')) as unknown as {
    default?: { Workbook: new () => Workbook };
    Workbook?: new () => Workbook;
  };
  const ExcelJS = (mod.default ?? mod) as { Workbook: new () => Workbook };
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Leosiqra';
  wb.created = new Date();

  const ws = wb.addWorksheet('Ringkasan', { properties: { tabColor: { argb: argb(color) } } });
  ws.columns = [{ width: 36 }, { width: 22 }];
  ws.mergeCells('A1:B1');
  ws.getCell('A1').value = `${shopName} — laporan pinjaman`;
  ws.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(color) } };
  ws.getRow(1).height = 28;
  ws.getCell('A2').value = `Periode ${r.range.from} s.d. ${r.range.to}`;
  ws.getCell('A2').font = { italic: true, color: { argb: 'FF64748B' } };
  const lines: [string, number | string, boolean?][] = [
    ['Pinjaman keluar (jumlah)', k.cair.n],
    ['Pokok pinjaman keluar', k.cair.pokok, true],
    ['Uang diserahkan ke peminjam', k.cair.diserahkan, true],
    ['Angsuran masuk (jumlah)', k.masuk.n],
    ['Angsuran masuk', k.masuk.total, true],
    ['Pendapatan admin', k.admin, true],
    ['Pendapatan jasa', k.jasa, true],
    ['Total pendapatan', k.pendapatan, true],
    ['', ''],
    [`Uang beredar per ${r.range.to}`, k.beredar, true],
    [`Modal masih di luar per ${r.range.to}`, k.modal, true],
    ['Pinjaman aktif', k.aktif],
    ['Lunas di periode ini', k.lunasDiPeriode],
    ...k.telat.map((t) => [`Telat ${t.g} (orang)`, t.n] as [string, number]),
  ];
  lines.forEach(([label, v, money], i) => {
    const row = ws.getRow(4 + i);
    row.getCell(1).value = label;
    row.getCell(2).value = v;
    if (money) row.getCell(2).numFmt = RP;
    if (label === 'Total pendapatan') row.font = { bold: true };
  });
  ws.getRow(4 + lines.length + 1).getCell(1).value =
    'Pendapatan = admin + jasa. Uang diserahkan bukan biaya, angsuran bukan omzet. Jasa diakui bertahap tiap angsuran masuk.';
  ws.getRow(4 + lines.length + 1).getCell(1).font = { italic: true, size: 9, color: { argb: 'FF64748B' } };

  const wp = wb.addWorksheet('Peminjam');
  table(
    wp,
    [
      { h: 'Peminjam', w: 24 },
      { h: 'Cair', w: 12 },
      { h: 'Jadwal', w: 16 },
      { h: 'Pokok', w: 15, num: true },
      { h: 'Admin', w: 13, num: true },
      { h: 'Total kembali', w: 16, num: true },
      { h: 'Dibayar s.d. akhir', w: 18, num: true },
      { h: 'Masuk di periode', w: 17, num: true },
      { h: 'Jasa di periode', w: 16, num: true },
      { h: 'Sisa', w: 15, num: true },
      { h: 'Status', w: 18 },
    ],
    k.rows.map((x) => [
      x.l.borrowerName,
      asDate(x.l.disbursedOn),
      `${x.l.count}× ${x.l.frequency}`,
      x.l.principal,
      x.l.adminFee,
      x.l.total,
      x.l.paidTo,
      x.masuk,
      x.jasa,
      x.sisa,
      x.sisa === 0 ? 'Lunas' : x.st.telat > 0 ? `Telat ${x.st.telat} hari` : 'Lancar',
    ]),
    color,
  );
  wp.getColumn(2).numFmt = 'dd mmm yyyy';

  const names = new Map(r.loans.map((l) => [l.id, l.borrowerName]));
  const wa = wb.addWorksheet('Angsuran');
  table(
    wa,
    [
      { h: 'Tanggal', w: 14 },
      { h: 'Peminjam', w: 24 },
      { h: 'Nominal', w: 15, num: true },
    ],
    r.payments.map((p) => [asDate(p.date), names.get(p.loanId) ?? '—', p.amount]),
    color,
  );
  wa.getColumn(1).numFmt = 'dd mmm yyyy';

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
