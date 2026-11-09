import type { Workbook, Worksheet } from 'exceljs';
import { periodeLabel, saleLines, tglPanjang, todayWIB, type ShopReport, type Summary } from './shopReport';

// Excel (.xlsx) laporan Usahaku. Dimuat lewat import() hanya saat tombol "Unduh Excel" diklik
// (exceljs ±1 MB). Pakai build browser exceljs (tanpa polyfill Node).

const RP = '"Rp" #,##0;[Red]-"Rp" #,##0';
const argb = (hex: string) => `FF${hex.replace('#', '').toUpperCase()}`;

function table(
  ws: Worksheet,
  headers: { h: string; w: number; num?: boolean }[],
  rows: (string | number | Date | null)[][],
  color: string,
  startRow = 1,
) {
  ws.columns = headers.map((c) => ({ width: c.w }));
  const head = ws.getRow(startRow);
  headers.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = c.h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(color) } };
    cell.alignment = { vertical: 'middle', horizontal: c.num ? 'right' : 'left' };
  });
  head.height = 22;
  rows.forEach((r, ri) => {
    const row = ws.getRow(startRow + 1 + ri);
    r.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v as never;
      if (headers[i].num)
        cell.numFmt = headers[i].h.toLowerCase().includes('qty') || headers[i].h === 'Jumlah' ? '#,##0' : RP;
      if (ri % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6F7FB' } };
    });
  });
  ws.views = [{ state: 'frozen', ySplit: startRow }];
  if (rows.length)
    ws.autoFilter = { from: { row: startRow, column: 1 }, to: { row: startRow + rows.length, column: headers.length } };
}

const asDate = (d: string) => new Date(`${d}T00:00:00`);

export async function buildShopXlsx(r: ShopReport, s: Summary, color: string): Promise<Blob> {
  const mod = (await import('exceljs/dist/exceljs.min.js')) as unknown as {
    default?: { Workbook: new () => Workbook };
    Workbook?: new () => Workbook;
  };
  const ExcelJS = (mod.default ?? mod) as { Workbook: new () => Workbook };
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Leosiqra';
  wb.created = new Date();

  // ── Ringkasan
  const ws = wb.addWorksheet('Ringkasan', { properties: { tabColor: { argb: argb(color) } } });
  ws.columns = [{ width: 30 }, { width: 24 }, { width: 4 }, { width: 26 }, { width: 20 }];
  ws.mergeCells('A1:E1');
  ws.getCell('A1').value = `${r.shop.emoji ? `${r.shop.emoji} ` : ''}${r.shop.name}`;
  ws.getCell('A1').font = { size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(color) } };
  ws.getRow(1).height = 32;
  ws.mergeCells('A2:E2');
  ws.getCell('A2').value =
    `Laporan usaha · ${periodeLabel(r.range.from, r.range.to)} · dibuat ${tglPanjang(todayWIB())}`;
  ws.getCell('A2').font = { italic: true, color: { argb: 'FF64748B' } };
  if (r.shop.tagline) {
    ws.mergeCells('A3:E3');
    ws.getCell('A3').value = r.shop.tagline;
  }
  const kpi: [string, number, string][] = [
    ['Omzet', s.omzet, RP],
    ['Biaya usaha', s.biaya, RP],
    ['Laba kotor', s.laba, RP],
    ['Margin', s.margin, '0.0%'],
    ['Jumlah transaksi', s.trx, '#,##0'],
    ['Item terjual', s.unit, '#,##0'],
    ['Rata-rata per transaksi', s.avg, RP],
    ['Rata-rata omzet per hari', s.perHari, RP],
  ];
  kpi.forEach(([k, v, f], i) => {
    const row = ws.getRow(5 + i);
    row.getCell(1).value = k;
    row.getCell(1).font = { bold: true };
    row.getCell(2).value = v;
    row.getCell(2).numFmt = f;
    if (k === 'Laba kotor') row.getCell(2).font = { bold: true, color: { argb: v < 0 ? 'FFE11D48' : 'FF059669' } };
  });
  ws.getCell('D5').value = 'Biaya per jenis';
  ws.getCell('D5').font = { bold: true };
  s.costs.forEach((c, i) => {
    ws.getCell(`D${6 + i}`).value = c.kind;
    ws.getCell(`E${6 + i}`).value = c.amount;
    ws.getCell(`E${6 + i}`).numFmt = RP;
  });

  // ── Penjualan (satu baris per item)
  const sales = wb.addWorksheet('Penjualan');
  table(
    sales,
    [
      { h: 'Tanggal', w: 13 },
      { h: 'No. transaksi', w: 14 },
      { h: 'Item', w: 30 },
      { h: 'Qty', w: 8, num: true },
      { h: 'Harga', w: 14, num: true },
      { h: 'Subtotal', w: 15, num: true },
      { h: 'Total transaksi', w: 16, num: true },
      { h: 'Pembeli', w: 18 },
      { h: 'Kasir', w: 16 },
      { h: 'Sumber', w: 10 },
      { h: 'Rekening', w: 16 },
    ],
    r.sales.flatMap((x, n) =>
      saleLines(x).map((l, i) => [
        asDate(x.date),
        `#${String(n + 1).padStart(4, '0')}`,
        l.name,
        l.qty,
        x.items.length ? l.price : null,
        x.items.length ? l.price * l.qty : x.amount,
        i === 0 ? x.amount : null,
        x.buyer,
        x.source === 'website' ? 'Website' : x.staff || 'Pemilik',
        x.source === 'website' ? 'Website' : 'Kasir',
        x.account,
      ]),
    ),
    color,
  );
  sales.getColumn(1).numFmt = 'dd/mm/yyyy';

  // ── Produk
  table(
    wb.addWorksheet('Produk'),
    [
      { h: 'Peringkat', w: 10, num: true },
      { h: 'Produk', w: 32 },
      { h: 'Qty terjual', w: 13, num: true },
      { h: 'Omzet', w: 16, num: true },
      { h: 'Porsi omzet', w: 13 },
    ],
    s.products.map((p, i) => [
      i + 1,
      p.name,
      p.qty,
      p.omzet,
      s.omzet ? `${((p.omzet / s.omzet) * 100).toFixed(1)}%` : '',
    ]),
    color,
  );

  // ── Biaya
  const exp = wb.addWorksheet('Biaya');
  table(
    exp,
    [
      { h: 'Tanggal', w: 13 },
      { h: 'Untuk', w: 30 },
      { h: 'Jenis', w: 16 },
      { h: 'Dicatat oleh', w: 16 },
      { h: 'Rekening', w: 16 },
      { h: 'Nominal', w: 15, num: true },
    ],
    r.expenses.map((e) => [asDate(e.date), e.item || e.kind, e.kind, e.staff || 'Pemilik', e.account, e.amount]),
    '#E11D48',
  );
  exp.getColumn(1).numFmt = 'dd/mm/yyyy';

  // ── Per hari / bulan
  table(
    wb.addWorksheet(s.monthly ? 'Per bulan' : 'Per hari'),
    [
      { h: s.monthly ? 'Bulan' : 'Tanggal', w: 14 },
      { h: 'Omzet', w: 16, num: true },
      { h: 'Biaya', w: 16, num: true },
      { h: 'Selisih', w: 16, num: true },
    ],
    s.buckets.map((b) => [s.monthly ? b.label : b.key, b.omzet, b.biaya, b.omzet - b.biaya]),
    color,
  );

  // ── Stok
  if (r.materials.length) {
    const names = new Map(r.materials.map((m) => [m.id, m.name]));
    const st = wb.addWorksheet('Stok');
    table(
      st,
      [
        { h: 'Bahan', w: 26 },
        { h: 'Satuan', w: 10 },
        { h: 'Stok sekarang', w: 14, num: true },
        { h: 'Batas minimum', w: 14, num: true },
        { h: 'Status', w: 16 },
      ],
      r.materials.map((m) => [
        m.name,
        m.unit,
        m.stock,
        m.min_stock,
        m.stock <= 0 ? 'Habis' : m.min_stock !== null && m.stock <= m.min_stock ? 'Hampir habis' : 'Aman',
      ]),
      color,
    );
    st.getColumn(3).numFmt = '#,##0.###';
    st.getColumn(4).numFmt = '#,##0.###';
    if (r.moves.length) {
      const start = r.materials.length + 4;
      st.getCell(`A${start - 1}`).value = 'Riwayat stok pada periode ini';
      st.getCell(`A${start - 1}`).font = { bold: true };
      const KIND: Record<string, string> = {
        beli: 'Beli',
        awal: 'Stok awal',
        opname: 'Hitung fisik',
        jual: 'Terpakai (jual)',
        pakai: 'Dipakai',
      };
      r.moves.forEach((m, i) => {
        const row = st.getRow(start + i);
        row.values = [names.get(m.material_id) ?? '—', KIND[m.kind] ?? m.kind, m.qty, m.cost ?? null, m.date];
        row.getCell(3).numFmt = '#,##0.###';
        row.getCell(4).numFmt = RP;
      });
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
