import type { Transaction } from '@/lib/services/transactionService';

// Asal sebuah transaksi untuk filter "Sumber" & detail. Diambil dari:
// - payload_json.source (Input Cepat: ketik/suara/struk, Kotak masuk, Tutup hari, Duplikat)
// - related_type (rutin, impor, hutang, investasi, tabungan)
// - selain itu = form manual (termasuk transaksi lama sebelum fitur ini ada).
export type TxSource = 'ketik' | 'suara' | 'struk' | 'kotak_masuk' | 'tutup_hari' | 'duplikat' | 'impor' | 'rutin' | 'hutang' | 'investasi' | 'manual';

export const TX_SOURCES: { id: TxSource; label: string; emoji: string }[] = [
  { id: 'manual', label: 'Form manual', emoji: '📝' },
  { id: 'ketik', label: 'Ketik cepat', emoji: '⌨️' },
  { id: 'suara', label: 'Suara', emoji: '🎙️' },
  { id: 'struk', label: 'Struk', emoji: '🧾' },
  { id: 'kotak_masuk', label: 'Kotak masuk', emoji: '📥' },
  { id: 'tutup_hari', label: 'Tutup hari', emoji: '🌙' },
  { id: 'duplikat', label: 'Duplikat', emoji: '📄' },
  { id: 'impor', label: 'Impor mutasi', emoji: '📤' },
  { id: 'rutin', label: 'Transaksi rutin', emoji: '🔁' },
  { id: 'hutang', label: 'Hutang & piutang', emoji: '🤝' },
  { id: 'investasi', label: 'Investasi & tabungan', emoji: '📈' },
];

export const txSourceOf = (t: Transaction): TxSource => {
  const raw = (t as Transaction & { payloadJson?: string | null }).payloadJson;
  if (raw) {
    try {
      const s = (JSON.parse(raw) as { source?: string }).source;
      if (s && TX_SOURCES.some((x) => x.id === s)) return s as TxSource;
    } catch {
      /* payload_json tidak valid — abaikan */
    }
  }
  const rel = (t as unknown as { relatedType?: string | null }).relatedType;
  if (rel === 'recurring') return 'rutin';
  if (rel === 'import') return 'impor';
  if (rel === 'debt') return 'hutang';
  if (rel === 'investasi' || rel === 'tabungan') return 'investasi';
  return 'manual';
};

export const txSourceLabel = (s: TxSource) => TX_SOURCES.find((x) => x.id === s) ?? TX_SOURCES[0];

// Tag transaksi (disimpan server di payload_json.tags).
export const txTags = (t: Transaction): string[] => {
  const raw = (t as Transaction & { payloadJson?: string | null }).payloadJson;
  if (!raw) return [];
  try {
    const v = (JSON.parse(raw) as { tags?: unknown }).tags;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};
export const normalizeTag = (s: string) => s.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 24);
