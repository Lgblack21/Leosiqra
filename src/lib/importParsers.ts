import { parseCsv, parseIndoNumber, parseFlexibleDate, detectDbCrType } from './csvImport';
import { toLocalDateString } from './utils';

// Pembaca file mutasi untuk halaman Impor: CSV & Excel jadi tabel (header +
// baris), lalu dipetakan ke baris transaksi lewat pemetaan kolom yang bisa
// dikoreksi user. PDF/gambar dibaca di halaman (parser BCA / AI).

export type ImportType = 'pemasukan' | 'pengeluaran';
export type ParsedRow = { date: string; note: string; amount: number; type: ImportType };
export type Table = { headers: string[]; rows: string[][] };
export type AmountMode = 'single' | 'debit_credit';
export type ColumnMapping = { date: string; note: string; mode: AmountMode; amount: string; debit: string; credit: string };

const HEADER_HINTS = ['tanggal', 'date', 'tgl', 'keterangan', 'deskripsi', 'description', 'nominal', 'amount', 'jumlah', 'debit', 'kredit', 'credit', 'mutasi'];

// File bank sering diawali beberapa baris info (nama, no. rekening, periode)
// sebelum header tabel — pakai baris pertama yang paling mirip header.
const toTable = (all: string[][]): Table => {
  const clean = all.filter((r) => r.some((c) => String(c ?? '').trim() !== ''));
  let headerIdx = clean.findIndex(
    (r) => r.filter((c) => HEADER_HINTS.some((h) => String(c ?? '').toLowerCase().includes(h))).length >= 2
  );
  if (headerIdx < 0) headerIdx = 0;
  const headers = (clean[headerIdx] ?? []).map((h, i) => String(h ?? '').trim() || `Kolom ${i + 1}`);
  return { headers, rows: clean.slice(headerIdx + 1) };
};

export const tableFromCsv = (text: string) => toTable(parseCsv(text.replace(/^﻿/, '')));

export async function tableFromXlsx(file: File): Promise<Table> {
  const { readSheet } = await import('read-excel-file/browser');
  const data = await readSheet(file);
  return toTable(
    data.map((row) =>
      row.map((cell) => {
        if (cell === null || cell === undefined) return '';
        if (cell instanceof Date) return toLocalDateString(cell);
        return String(cell);
      })
    )
  );
}

export function guessMapping(headers: string[]): ColumnMapping {
  const find = (needles: string[]) => headers.find((h) => needles.some((n) => h.toLowerCase().includes(n))) ?? '';
  const debit = find(['debit', 'keluar', 'withdrawal', 'pengeluaran']);
  const credit = find(['kredit', 'credit', 'masuk', 'deposit', 'pemasukan']);
  const amount = find(['nominal', 'amount', 'jumlah', 'mutasi']);
  return {
    date: find(['tanggal', 'date', 'tgl']),
    note: find(['keterangan', 'deskripsi', 'description', 'remark', 'uraian', 'catatan', 'note']),
    mode: (debit || credit) && !amount ? 'debit_credit' : 'single',
    amount,
    debit,
    credit,
  };
}

export const mappingReady = (m: ColumnMapping) => Boolean(m.date && (m.mode === 'single' ? m.amount : m.debit || m.credit));

export function rowsFromTable(table: Table, m: ColumnMapping): ParsedRow[] {
  if (!mappingReady(m)) return [];
  const idx = (col: string) => (col ? table.headers.indexOf(col) : -1);
  const [d, n, a, deb, cred] = [idx(m.date), idx(m.note), idx(m.amount), idx(m.debit), idx(m.credit)];
  return table.rows.map((r) => {
    const parsedDate = parseFlexibleDate(r[d] ?? '');
    const note = n >= 0 ? String(r[n] ?? '').trim() : '';
    let amount = 0;
    let type: ImportType = 'pengeluaran';
    if (m.mode === 'single') {
      const cell = String(r[a] ?? '0');
      const raw = parseIndoNumber(cell);
      // Sebagian bank menandai arah lewat "DB"/"CR" di kolom nominal yang sama.
      type = detectDbCrType(cell) ?? (raw >= 0 ? 'pemasukan' : 'pengeluaran');
      amount = Math.abs(raw);
    } else {
      const debit = deb >= 0 ? Math.abs(parseIndoNumber(String(r[deb] ?? '0'))) : 0;
      const credit = cred >= 0 ? Math.abs(parseIndoNumber(String(r[cred] ?? '0'))) : 0;
      type = credit > 0 ? 'pemasukan' : 'pengeluaran';
      amount = credit > 0 ? credit : debit;
    }
    return { date: parsedDate ? toLocalDateString(parsedDate) : '', note, amount, type };
  });
}

// Teks PDF dipotong per ±12rb karakter di batas baris supaya muat sekali baca AI.
export function chunkText(text: string, size = 12_000, maxChunks = 5): string[] {
  const lines = text.split('\n');
  const chunks: string[] = [];
  let current = '';
  for (const line of lines) {
    if (current.length + line.length + 1 > size && current) {
      chunks.push(current);
      current = '';
      if (chunks.length >= maxChunks) break;
    }
    current += `${line}\n`;
  }
  if (current.trim() && chunks.length < maxChunks) chunks.push(current);
  return chunks;
}

// Gambar diperkecil (sisi terpanjang 1600px, JPEG) sebelum dikirim ke AI —
// hemat kuota & tetap terbaca untuk tangkapan layar aplikasi bank.
export async function imageToJpegBase64(file: File, maxSide = 1600): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Gambar tidak bisa dibuka.'));
      el.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Gambar tidak bisa diproses.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85).replace(/^data:[^,]*,/, '');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const IMPORT_CSV_TEMPLATE = 'Tanggal,Keterangan,Nominal\n2026-10-01,Gaji Oktober,8000000\n2026-10-02,Makan siang,-45000\n2026-10-03,Bensin,-50000\n';
