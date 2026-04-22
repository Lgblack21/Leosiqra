import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatCurrency = (val: number, currency: string = 'IDR') => {
  return new Intl.NumberFormat('id-ID', { 
    style: 'currency', 
    currency: currency, 
    maximumFractionDigits: 0 
  }).format(val);
};
