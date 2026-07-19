"use client";

import { InputHTMLAttributes, useLayoutEffect, useRef } from 'react';

interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value: string;
  onChange: (rawValue: string) => void;
}

const DIGIT_RE = /[0-9]/;

// "10000000.5" -> "10,000,000.5" untuk tampilan (koma ribuan, titik desimal —
// gaya internasional, supaya nominal desimal seperti mata uang asing mis.
// USD "4.5" gampang diketik apa adanya); state pemanggil tetap angka polos.
const formatDisplay = (raw: string) => {
  if (!raw) return '';
  const [intPart, decPart] = raw.split('.');
  const sign = intPart.startsWith('-') ? '-' : '';
  const digits = intPart.replace('-', '');
  const formattedInt = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart !== undefined ? `${sign}${formattedInt}.${decPart}` : `${sign}${formattedInt}`;
};

const countDigitsBefore = (str: string, pos: number) => (str.slice(0, pos).match(/[0-9]/g) || []).length;

interface RawParts {
  negative: boolean;
  intPart: string;
  hasDot: boolean;
  fracPart: string;
}

const splitRaw = (raw: string): RawParts => {
  const negative = raw.startsWith('-');
  const body = negative ? raw.slice(1) : raw;
  const dotIdx = body.indexOf('.');
  if (dotIdx === -1) return { negative, intPart: body, hasDot: false, fracPart: '' };
  return { negative, intPart: body.slice(0, dotIdx), hasDot: true, fracPart: body.slice(dotIdx + 1) };
};

const joinRaw = ({ negative, intPart, hasDot, fracPart }: RawParts) =>
  `${negative ? '-' : ''}${intPart}${hasDot ? `.${fracPart}` : ''}`;

// Fallback buat kasus jarang (paste, select-all lalu ganti): titik ATAU koma
// dianggap desimal, dipakai yang paling terakhir muncul.
const parseRawFallback = (display: string) => {
  const isNegative = display.trim().startsWith('-');
  const noSign = display.replace(/-/g, '');
  const decimalIndex = Math.max(noSign.lastIndexOf('.'), noSign.lastIndexOf(','));
  const cleaned = decimalIndex === -1
    ? noSign.replace(/[^0-9]/g, '')
    : `${noSign.slice(0, decimalIndex).replace(/[^0-9]/g, '')}.${noSign.slice(decimalIndex + 1).replace(/[^0-9]/g, '')}`;
  return isNegative && cleaned ? `-${cleaned}` : cleaned;
};

// Hitung raw value baru dari SATU keystroke (insert atau hapus satu
// karakter), bukan dengan re-parse string yang sudah diformat secara utuh.
// Ini penting: kalau cuma re-parse string penuh tiap keystroke, koma ribuan
// yang sudah kesisip dari keystroke SEBELUMNYA (mis. "1,800") ikut kebaca
// ulang dan disalahartikan sebagai titik desimal begitu digit baru nempel
// setelahnya (jadi "1.8000"). Dengan pendekatan diff-per-keystroke ini, cuma
// karakter yang BENERAN baru diketik/dihapus yang memengaruhi raw value.
const computeNewRaw = (value: string, rawInput: string, cursorPos: number): string => {
  const prevFormatted = formatDisplay(value);
  const parts = splitRaw(value);
  const { negative, intPart, hasDot, fracPart } = parts;
  const dotPosFormatted = prevFormatted.indexOf('.');

  // Kasus umum: satu karakter baru disisipkan.
  if (rawInput.length === prevFormatted.length + 1) {
    const insertBeforePos = cursorPos - 1;
    const insertedChar = rawInput[insertBeforePos];
    const reconstructed = rawInput.slice(0, insertBeforePos) + rawInput.slice(insertBeforePos + 1);
    if (reconstructed === prevFormatted) {
      if (DIGIT_RE.test(insertedChar)) {
        if (dotPosFormatted === -1 || insertBeforePos <= dotPosFormatted) {
          const digitsBefore = countDigitsBefore(prevFormatted, insertBeforePos);
          const newIntPart = intPart.slice(0, digitsBefore) + insertedChar + intPart.slice(digitsBefore);
          return joinRaw({ negative, intPart: newIntPart, hasDot, fracPart });
        }
        const relPos = insertBeforePos - (dotPosFormatted + 1);
        const digitsBefore = countDigitsBefore(prevFormatted.slice(dotPosFormatted + 1), relPos);
        const newFracPart = fracPart.slice(0, digitsBefore) + insertedChar + fracPart.slice(digitsBefore);
        return joinRaw({ negative, intPart, hasDot: true, fracPart: newFracPart });
      }
      if (insertedChar === '.' || insertedChar === ',') {
        if (hasDot) return value; // sudah ada titik desimal, abaikan yang kedua
        const digitsBefore = countDigitsBefore(prevFormatted, insertBeforePos);
        return joinRaw({
          negative,
          intPart: intPart.slice(0, digitsBefore),
          hasDot: true,
          fracPart: intPart.slice(digitsBefore)
        });
      }
      if (insertedChar === '-') {
        return insertBeforePos === 0 ? (negative ? value.slice(1) : `-${value}`) : value;
      }
      return value;
    }
  }

  // Kasus umum: satu karakter dihapus (backspace/delete).
  if (rawInput.length === prevFormatted.length - 1) {
    const reconstructed = prevFormatted.slice(0, cursorPos) + prevFormatted.slice(cursorPos + 1);
    if (reconstructed === rawInput) {
      const removedChar = prevFormatted[cursorPos];
      if (DIGIT_RE.test(removedChar)) {
        if (dotPosFormatted === -1 || cursorPos < dotPosFormatted) {
          const digitsBefore = countDigitsBefore(prevFormatted, cursorPos);
          const newIntPart = intPart.slice(0, digitsBefore) + intPart.slice(digitsBefore + 1);
          return joinRaw({ negative, intPart: newIntPart, hasDot, fracPart });
        }
        const relPos = cursorPos - (dotPosFormatted + 1);
        const digitsBefore = countDigitsBefore(prevFormatted.slice(dotPosFormatted + 1), relPos);
        const newFracPart = fracPart.slice(0, digitsBefore) + fracPart.slice(digitsBefore + 1);
        return joinRaw({ negative, intPart, hasDot, fracPart: newFracPart });
      }
      if (removedChar === '.') {
        return joinRaw({ negative, intPart: intPart + fracPart, hasDot: false, fracPart: '' });
      }
      if (removedChar === ',') {
        // Backspace tepat di atas koma ribuan → hapus digit sebelumnya
        // (perilaku umum di input nominal berformat).
        const digitIndexToRemove = countDigitsBefore(prevFormatted, cursorPos) - 1;
        const newIntPart = intPart.slice(0, digitIndexToRemove) + intPart.slice(digitIndexToRemove + 1);
        return joinRaw({ negative, intPart: newIntPart, hasDot, fracPart });
      }
      return value;
    }
  }

  // Kasus jarang (paste / select-all lalu ganti) — fallback ke parse penuh.
  return parseRawFallback(rawInput);
};

// Setelah raw value baru terbentuk, cari posisi kursor yang tetap "nempel"
// di digit yang sama pada string hasil format ulang.
const mapCursorToFormatted = (rawInput: string, cursorPos: number, formatted: string) => {
  const charBeforeCursor = rawInput[cursorPos - 1];
  if ((charBeforeCursor === '.' || charBeforeCursor === ',') && formatted.includes('.')) {
    return formatted.indexOf('.') + 1;
  }
  const digitsBeforeCursor = countDigitsBefore(rawInput, cursorPos);
  if (digitsBeforeCursor === 0) return 0;
  let count = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (DIGIT_RE.test(formatted[i])) {
      count++;
      if (count === digitsBeforeCursor) return i + 1;
    }
  }
  return formatted.length;
};

export const NumberInput = ({ value, onChange, ...props }: NumberInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCursorRef = useRef<number | null>(null);

  // Terapkan posisi kursor SETELAH React selesai menuliskan value baru ke
  // DOM (di event handler, value yang dirender masih yang lama).
  useLayoutEffect(() => {
    if (pendingCursorRef.current !== null && inputRef.current) {
      inputRef.current.setSelectionRange(pendingCursorRef.current, pendingCursorRef.current);
      pendingCursorRef.current = null;
    }
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawInput = e.target.value;
    const cursorPos = e.target.selectionStart ?? rawInput.length;
    const newRaw = computeNewRaw(value, rawInput, cursorPos);
    const newFormatted = formatDisplay(newRaw);
    pendingCursorRef.current = mapCursorToFormatted(rawInput, cursorPos, newFormatted);
    onChange(newRaw);
  };

  return (
    <input
      {...props}
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={formatDisplay(value)}
      onChange={handleChange}
    />
  );
};
