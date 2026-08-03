// Parser CSV minimal (RFC4180-ish): dukung field yang dikutip tanda petik
// ganda (bisa mengandung koma/baris baru di dalamnya) tanpa perlu dependensi
// eksternal — cukup untuk export mutasi bank/e-wallet yang formatnya sederhana.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',' || char === ';') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char === '\r') {
      // diabaikan, \n yang menutup baris
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

// Nominal dari mutasi bank Indonesia bisa berformat "1.234.567,89" (titik =
// ribuan, koma = desimal) atau gaya internasional "1,234,567.89" — deteksi
// dari pemisah mana yang muncul terakhir/paling banyak.
export function parseIndoNumber(raw: string): number {
  let s = String(raw ?? '').trim().replace(/[^0-9.,-]/g, '');
  if (!s) return 0;

  const negative = s.includes('-');
  s = s.replace(/-/g, '');

  const commaCount = (s.match(/,/g) || []).length;
  const dotCount = (s.match(/\./g) || []).length;

  if (commaCount > 0 && dotCount > 0) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (commaCount > 1) {
    s = s.replace(/,/g, '');
  } else if (dotCount > 1) {
    s = s.replace(/\./g, '');
  } else if (commaCount === 1) {
    const parts = s.split(',');
    s = parts[1] && parts[1].length <= 2 ? s.replace(',', '.') : s.replace(',', '');
  } else if (dotCount === 1) {
    // Satu titik, tanpa koma sama sekali — ambigu antara desimal ("1234.5")
    // dan pemisah ribuan gaya Indonesia ("50.000" = 50 ribu). Rupiah nyaris
    // tidak pernah pakai desimal, jadi 3 digit persis di belakang titik
    // ditebak sebagai ribuan, bukan desimal.
    const parts = s.split('.');
    if (parts[1] && parts[1].length === 3) {
      s = s.replace('.', '');
    }
  }

  const value = parseFloat(s) || 0;
  return negative ? -value : value;
}

// Beberapa bank (mis. BCA/KlikBCA) menaruh kode DB (debit/keluar) atau CR
// (kredit/masuk) sebagai akhiran di kolom nominal yang sama alih-alih tanda
// +/- atau kolom debit/kredit terpisah — misalnya "50.000,00 DB". Deteksi ini
// duluan; kalau tidak ketemu, caller jatuh balik ke tanda +/- pada angkanya.
export function detectDbCrType(raw: string): 'pemasukan' | 'pengeluaran' | null {
  const s = String(raw ?? '').trim().toLowerCase();
  if (/\b(cr|kredit|credit|masuk)\b/.test(s)) return 'pemasukan';
  if (/\b(db|debit|keluar)\b/.test(s)) return 'pengeluaran';
  return null;
}

// Coba beberapa format tanggal umum di export mutasi bank Indonesia sebelum
// jatuh ke Date.parse bawaan. Mengembalikan null kalau semuanya gagal supaya
// caller bisa menandai baris tsb sebagai "perlu dicek manual".
export function parseFlexibleDate(raw: string): Date | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;

  // DD/MM/YYYY atau DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // YYYY-MM-DD
  const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymd) {
    const [, y, m, d] = ymd;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const fallback = new Date(s);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}
