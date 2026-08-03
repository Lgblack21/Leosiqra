import { parseIndoNumber } from './csvImport';

export interface BcaTransaction {
  date: string; // "YYYY-MM-DD"
  note: string;
  amount: number;
  type: 'pemasukan' | 'pengeluaran';
  balance: number | null;
}

const INDO_MONTHS: Record<string, number> = {
  JANUARI: 1, FEBRUARI: 2, MARET: 3, APRIL: 4, MEI: 5, JUNI: 6,
  JULI: 7, AGUSTUS: 8, SEPTEMBER: 9, OKTOBER: 10, NOVEMBER: 11, DESEMBER: 12,
};

// Header e-statement BCA selalu punya baris "PERIODE : <BULAN> <TAHUN>" —
// baris tabel mutasi cuma punya "DD/MM" tanpa tahun, jadi tahunnya harus
// diambil dari sini.
export function extractStatementPeriod(text: string): { year: number; month: number } | null {
  const m = text.match(/PERIODE\s*:?\s*([A-Za-z]+)\s+(\d{4})/i);
  if (!m) return null;
  const month = INDO_MONTHS[m[1].toUpperCase()];
  if (!month) return null;
  return { year: Number(m[2]), month };
}

// Nominal kolom MUTASI/SALDO di e-statement BCA SELALU pakai koma sebagai
// pemisah ribuan dan 2 digit desimal (mis. "10,500,000.00") — beda dengan
// baris duplikat mentah tanpa koma yang kadang nyelip di kolom KETERANGAN
// (mis. "10500000.00", catatan transfer apa adanya). Cek koma di sini
// supaya dua hal ini tidak pernah tertukar.
const isFormattedAmountToken = (token: string) => /^\d{1,3}(,\d{3})+\.\d{2}$/.test(token);

const DATE_LINE_RE = /^(\d{1,2})\/(\d{1,2})\b(.*)$/;

// Parse teks hasil ekstraksi PDF (lihat extractPdfText) jadi daftar transaksi.
// Tiap transaksi di e-statement BCA multi-baris: baris pertama "DD/MM <keterangan> <kode
// referensi>", diikuti 0+ baris detail (nama lawan transaksi, baris duplikat
// mentah, dst), lalu satu baris nominal ber-koma (+ opsional "DB" kalau
// debit, + opsional saldo berjalan). Baris tanpa "DB" berarti kredit (CR).
export function parseBcaStatementText(text: string): BcaTransaction[] {
  const period = extractStatementPeriod(text);
  if (!period) return [];

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const results: BcaTransaction[] = [];

  let i = 0;
  while (i < lines.length) {
    const head = lines[i].match(DATE_LINE_RE);
    if (!head) {
      i++;
      continue;
    }

    const day = Number(head[1]);
    const month = Number(head[2]);
    const blockLines = [head[3].trim()];

    let j = i + 1;
    while (j < lines.length && !DATE_LINE_RE.test(lines[j])) {
      blockLines.push(lines[j]);
      j++;
    }

    let amount: number | null = null;
    let isDebit = false;
    let balance: number | null = null;
    let amountLineIdx = -1;

    for (let k = 0; k < blockLines.length; k++) {
      const tokens = blockLines[k].split(/\s+/);
      const formatted = tokens.filter(isFormattedAmountToken);
      if (formatted.length === 0) continue;
      amount = parseIndoNumber(formatted[0]);
      isDebit = /\bDB\b/.test(blockLines[k]);
      if (formatted.length > 1) balance = parseIndoNumber(formatted[1]);
      amountLineIdx = k;
      break;
    }

    const description = blockLines
      .slice(0, amountLineIdx === -1 ? undefined : amountLineIdx)
      // Buang baris duplikat mentah tanpa koma ribuan (mis. "10500000.00")
      // yang kadang muncul di kolom keterangan transfer.
      .filter((l) => !/^-?\d+(\.\d+)?$/.test(l) && l !== '-')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    const isOpeningBalance = description.toUpperCase().startsWith('SALDO AWAL');

    if (amount !== null && amount > 0 && !isOpeningBalance) {
      const dateStr = `${period.year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      results.push({
        date: dateStr,
        note: description || '-',
        amount,
        type: isDebit ? 'pengeluaran' : 'pemasukan',
        balance,
      });
    }

    i = j;
  }

  return results;
}
