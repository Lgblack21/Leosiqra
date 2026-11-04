import type { ExchangeRates } from '@/lib/services/exchangeRateService';
import { exchangeRateService } from '@/lib/services/exchangeRateService';

// Koleksiku: koleksi yang nilainya mengikuti pasar. Kartu Pokémon → harga pasar
// TCGdex (USD TCGplayer / EUR Cardmarket) dikonversi ke Rupiah; item Steam (CS2)
// → median Skinport / Steam Market (USD); Lainnya → nilai diisi user (kosong =
// harga beli). Rumus = snapshotCollectibleValue di Worker.

export type CollectibleKind = 'pokemon' | 'steam' | 'lainnya';
export const isMarketKind = (k: CollectibleKind) => k === 'pokemon' || k === 'steam';
export const COLLECTIBLE_CONDITIONS = ['Segel', 'Mint', 'Near Mint', 'Bagus', 'Bekas', 'Rusak'] as const;
export type CollectibleCondition = (typeof COLLECTIBLE_CONDITIONS)[number];

export type Collectible = {
  id: string;
  kind: CollectibleKind;
  refId?: string;
  name: string;
  setName?: string;
  number?: string;
  rarity?: string;
  variant?: string;
  imageUrl?: string; // TCGdex (tanpa ekstensi; tambahkan /low.webp atau /high.webp) / URL CDN Steam
  hasPhoto: boolean;
  quantity: number;
  purchasePrice: number; // IDR per item
  manualValue?: number; // IDR per item (lainnya)
  marketPrice?: number; // per item, dalam marketCurrency
  marketCurrency?: 'USD' | 'EUR';
  marketUpdatedAt?: string;
  condition?: CollectibleCondition;
  grade?: string;
  acquiredDate?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export type HistoryPoint = { day: string; value: number; cost: number };
export type SteamLink = { id: string; syncedAt: string | null };
export type CollectibleSet = { id: string; name: string; logo: string | null; symbol: string | null; official: number; total: number; owned: number };
export type TcgCard = { id: string; name: string; set: string; number: string; rarity: string | null; image: string | null; prices: Record<string, { price: number; currency: 'USD' | 'EUR' }> };

const VARIANT_LABELS: Record<string, string> = {
  normal: 'Normal',
  holofoil: 'Holo',
  'reverse-holofoil': 'Reverse Holo',
  '1st-edition': '1st Edition',
  '1st-edition-holofoil': '1st Edition Holo',
  'unlimited-holofoil': 'Unlimited Holo',
  unlimited: 'Unlimited',
  cardmarket: 'Normal',
  'cardmarket-holo': 'Holo',
};
export const variantLabel = (v?: string) => (v ? VARIANT_LABELS[v] ?? v.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '');

export const tcgImage = (base: string | null | undefined, size: 'low' | 'high' = 'low') => (base ? `${base}/${size}.webp` : null);
/** Gambar resmi (kartu TCGdex / ikon Steam); null untuk "lainnya". */
export const marketImage = (c: Pick<Collectible, 'kind' | 'imageUrl'>, size: 'low' | 'high' = 'low') =>
  c.kind === 'pokemon' ? tcgImage(c.imageUrl, size) : c.kind === 'steam' && c.imageUrl?.startsWith('https://community.cloudflare.steamstatic.com/') ? c.imageUrl : null;

/** Nilai per item dalam IDR. */
export function unitValueIdr(c: Pick<Collectible, 'kind' | 'marketPrice' | 'marketCurrency' | 'manualValue' | 'purchasePrice'>, rates: ExchangeRates): number {
  // convert() mengembalikan angka mentah kalau kurs belum ada ($38 → "Rp 38") — wajib cek dulu.
  if (isMarketKind(c.kind) && c.marketPrice != null && c.marketCurrency && rates[c.marketCurrency] && rates.IDR) {
    const v = exchangeRateService.convert(c.marketPrice, c.marketCurrency, 'IDR', rates);
    if (Number.isFinite(v) && v > 0) return v;
  }
  return c.manualValue ?? c.purchasePrice ?? 0;
}

export const priceIdr = (price: number, currency: 'USD' | 'EUR', rates: ExchangeRates): number | null =>
  rates[currency] && rates.IDR ? exchangeRateService.convert(price, currency, 'IDR', rates) : null;
export const fmtForeign = (n: number, currency: 'USD' | 'EUR') => `${currency === 'USD' ? '$' : '€'}${n.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
