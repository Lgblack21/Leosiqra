"use client";

import { InputHTMLAttributes } from 'react';

interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value: string;
  onChange: (rawValue: string) => void;
}

// Tampilkan angka dengan titik pemisah ribuan ala Indonesia (10.000.000) saat
// diketik, tapi `value` yang disimpan di state pemanggil tetap angka polos
// (mis. "10000000") supaya parseFloat/kalkulasi di form yang sudah ada tidak
// perlu diubah sama sekali — cuma tampilannya yang beda.
const formatDisplay = (raw: string) => {
  if (!raw) return '';
  const [intPart, decPart] = raw.split('.');
  const sign = intPart.startsWith('-') ? '-' : '';
  const digits = intPart.replace('-', '');
  const formattedInt = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decPart !== undefined ? `${sign}${formattedInt},${decPart}` : `${sign}${formattedInt}`;
};

// Terima input dengan titik (pemisah ribuan) dan koma (desimal ala Indonesia),
// kembalikan string angka polos berformat JS standar (titik = desimal).
const parseRaw = (display: string) => {
  const isNegative = display.trim().startsWith('-');
  const cleaned = display
    .replace(/-/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^0-9.]/g, '');
  return isNegative && cleaned ? `-${cleaned}` : cleaned;
};

export const NumberInput = ({ value, onChange, ...props }: NumberInputProps) => {
  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      value={formatDisplay(value)}
      onChange={(e) => onChange(parseRaw(e.target.value))}
    />
  );
};
