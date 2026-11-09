import type { Workbook, Worksheet } from 'exceljs';
import { NAMA_BULAN, ymdOf, type hitungSpt, type Tenggat, type UmkmBulan } from './rules';
import type { TaxSettings } from './settings';

// Excel Pajak Center (dimuat lewat import() saat tombol diklik). Build browser exceljs.

const RP = '"Rp" #,##0;[Red]-"Rp" #,##0';
const INDIGO = 'FF4F46E5';

function head(ws: Worksheet, row: number, labels: string[], color = INDIGO) {
  const r = ws.getRow(row);
  labels.forEach((l, i) => {
    const c = r.getCell(i + 1);
    c.value = l;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
  });
  r.height = 20;
}

export async function buildPajakXlsx(d: {
  year: number;
  s: TaxSettings;
  spt: ReturnType<typeof hitungSpt>;
  umkm: UmkmBulan[] | null;
  omzet: number[];
  harta: { name: string; type: string; value: number }[];
  utang: { name: string; value: number }[];
  piutang: { name: string; value: number }[];
  tenggat: Tenggat[];
}): Promise<Blob> {
  const mod = (await import('exceljs/dist/exceljs.min.js')) as unknown as {
    default?: { Workbook: new () => Workbook };
    Workbook?: new () => Workbook;
  };
  const ExcelJS = (mod.default ?? mod) as { Workbook: new () => Workbook };
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Leosiqra';

  // ── SPT
  const ws = wb.addWorksheet('SPT Tahunan', { properties: { tabColor: { argb: INDIGO } } });
  ws.columns = [{ width: 46 }, { width: 22 }];
  ws.mergeCells('A1:B1');
  ws.getCell('A1').value = `Estimasi SPT Tahunan PPh Orang Pribadi — tahun pajak ${d.year}`;
  ws.getCell('A1').font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } };
  ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INDIGO } };
  ws.getRow(1).height = 28;
  ws.getCell('A2').value = 'Estimasi dari Leosiqra — cocokkan dengan bukti potong & Coretax DJP.';
  ws.getCell('A2').font = { italic: true, color: { argb: 'FF64748B' } };
  const rows: [string, number | string, boolean?][] = [
    ['Status PTKP', `${d.s.status}/${d.s.tanggungan}`],
    ['Penghasilan bruto gaji', d.spt.brutoGaji],
    ['Biaya jabatan', -d.spt.biayaJabatan],
    ['Iuran pensiun / JHT', -d.spt.iuran],
    ['Neto dari gaji', d.spt.netoGaji, true],
    ['Laba usaha (pembukuan)', d.spt.netoUsaha],
    ['Penghasilan neto lain', d.spt.lain],
    ['Zakat resmi', -d.spt.zakat],
    ['Penghasilan neto', d.spt.neto, true],
    ['PTKP', -d.spt.ptkp],
    ['Penghasilan kena pajak', d.spt.pkp, true],
    ...d.spt.lapisan.map(
      (l) => [`  Tarif ${Math.round(l.rate * 100)}% × ${l.kena.toLocaleString('id-ID')}`, l.pajak] as [string, number],
    ),
    ['PPh terutang (Pasal 17)', d.spt.pphTerutang, true],
    ['Kredit pajak (PPh 21 dipotong)', -d.spt.kredit],
    [
      d.spt.status === 'kurang' ? 'KURANG BAYAR' : d.spt.status === 'lebih' ? 'LEBIH BAYAR' : 'NIHIL',
      Math.abs(d.spt.selisih),
      true,
    ],
  ];
  rows.forEach(([k, v, b], i) => {
    const r = ws.getRow(4 + i);
    r.getCell(1).value = k;
    r.getCell(2).value = v;
    if (typeof v === 'number') r.getCell(2).numFmt = RP;
    if (b) r.font = { bold: true };
  });

  // ── UMKM
  if (d.umkm) {
    const u = wb.addWorksheet('PPh final UMKM');
    u.columns = [{ width: 14 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 16 }, { width: 14 }];
    head(u, 1, ['Masa', 'Omzet', 'Kumulatif', 'Kena pajak', 'PPh 0,5%', 'Status setor']);
    d.umkm.forEach((b, i) => {
      const r = u.getRow(2 + i);
      const k = String(b.bulan).padStart(2, '0');
      r.values = [
        NAMA_BULAN[b.bulan - 1],
        b.omzet,
        b.kumulatif,
        b.kenaPajak,
        b.pph,
        b.pph ? (d.s.umkmSetor[k]?.paid ? 'Sudah' : 'Belum') : '—',
      ];
      [2, 3, 4, 5].forEach((c) => (r.getCell(c).numFmt = RP));
    });
    const t = u.getRow(14);
    t.values = [
      'Total',
      d.umkm.reduce((a, b) => a + b.omzet, 0),
      null,
      d.umkm.reduce((a, b) => a + b.kenaPajak, 0),
      d.umkm.reduce((a, b) => a + b.pph, 0),
    ];
    t.font = { bold: true };
    [2, 4, 5].forEach((c) => (t.getCell(c).numFmt = RP));
    u.views = [{ state: 'frozen', ySplit: 1 }];
  }

  // ── Harta & utang
  const h = wb.addWorksheet('Harta & Utang');
  h.columns = [{ width: 34 }, { width: 18 }, { width: 20 }];
  head(h, 1, ['Harta', 'Jenis', 'Nilai']);
  d.harta.forEach((x, i) => {
    h.getRow(2 + i).values = [x.name, x.type, x.value];
    h.getRow(2 + i).getCell(3).numFmt = RP;
  });
  let r = d.harta.length + 3;
  head(h, r, ['Utang', '', 'Sisa'], 'FFE11D48');
  d.utang.forEach((x) => {
    r++;
    h.getRow(r).values = [x.name, '', x.value];
    h.getRow(r).getCell(3).numFmt = RP;
  });
  r += 2;
  head(h, r, ['Piutang', '', 'Nilai'], 'FF059669');
  d.piutang.forEach((x) => {
    r++;
    h.getRow(r).values = [x.name, '', x.value];
    h.getRow(r).getCell(3).numFmt = RP;
  });

  // ── Kalender
  const k = wb.addWorksheet('Kalender');
  k.columns = [{ width: 14 }, { width: 46 }, { width: 16 }, { width: 12 }];
  head(k, 1, ['Tanggal', 'Tenggat', 'Nominal', 'Status']);
  d.tenggat.forEach((t, i) => {
    k.getRow(2 + i).values = [ymdOf(t.date), t.title, t.amount ?? null, t.done ? 'Beres' : 'Belum'];
    k.getRow(2 + i).getCell(3).numFmt = RP;
  });

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
