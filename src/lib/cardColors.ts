export interface CardColorOption {
  key: string;
  label: string;
  gradient: string;
  swatch: string;
}

export const CARD_COLOR_OPTIONS: CardColorOption[] = [
  { key: 'slate', label: 'Hitam', gradient: 'bg-gradient-to-br from-slate-800 to-slate-900', swatch: 'bg-slate-900' },
  { key: 'indigo', label: 'Indigo', gradient: 'bg-gradient-to-br from-indigo-500 to-indigo-700', swatch: 'bg-indigo-600' },
  { key: 'blue', label: 'Biru', gradient: 'bg-gradient-to-br from-blue-500 to-blue-700', swatch: 'bg-blue-600' },
  { key: 'emerald', label: 'Hijau', gradient: 'bg-gradient-to-br from-emerald-500 to-emerald-700', swatch: 'bg-emerald-600' },
  { key: 'rose', label: 'Merah Muda', gradient: 'bg-gradient-to-br from-rose-500 to-rose-700', swatch: 'bg-rose-500' },
  { key: 'amber', label: 'Kuning', gradient: 'bg-gradient-to-br from-amber-500 to-amber-700', swatch: 'bg-amber-500' },
  { key: 'purple', label: 'Ungu', gradient: 'bg-gradient-to-br from-purple-500 to-purple-700', swatch: 'bg-purple-600' },
  { key: 'teal', label: 'Teal', gradient: 'bg-gradient-to-br from-teal-500 to-teal-700', swatch: 'bg-teal-600' },
];

const DEFAULT_TYPE_GRADIENTS: Record<string, string> = {
  'Bank Account': 'bg-gradient-to-br from-slate-800 to-slate-900',
  'E-Wallet': 'bg-gradient-to-br from-indigo-500 to-indigo-700',
  'Cash': 'bg-gradient-to-br from-emerald-500 to-emerald-700',
  'Credit Card': 'bg-gradient-to-br from-rose-500 to-rose-700',
};

export const getCardGradientClass = (cardColor: string | undefined | null, type: string): string => {
  const custom = CARD_COLOR_OPTIONS.find((c) => c.key === cardColor);
  if (custom) return custom.gradient;
  return DEFAULT_TYPE_GRADIENTS[type] || 'bg-gradient-to-br from-indigo-600 to-indigo-800';
};
