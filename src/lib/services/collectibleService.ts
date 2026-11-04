import { cloudflareApi } from '../cloudflare-api';
import { notifyCollectionChanged } from '../cf-firestore';
import type { Collectible, CollectibleCondition, CollectibleKind, HistoryPoint, TcgCard } from '@/lib/collectibles';

// Koleksiku — /api/member/collectibles (Worker, migrasi 0025).
type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
const num = (v: unknown) => (v == null || v === '' ? undefined : Number(v));
const fromRow = (r: Row): Collectible => ({
  id: String(r.id),
  kind: (str(r.kind) ?? 'lainnya') as CollectibleKind,
  refId: str(r.ref_id),
  name: String(r.name ?? ''),
  setName: str(r.set_name),
  number: str(r.number),
  rarity: str(r.rarity),
  variant: str(r.variant),
  imageUrl: str(r.image_url),
  hasPhoto: Number(r.has_photo) === 1,
  quantity: Number(r.quantity) || 1,
  purchasePrice: Number(r.purchase_price) || 0,
  manualValue: num(r.manual_value),
  marketPrice: num(r.market_price),
  marketCurrency: str(r.market_currency) as Collectible['marketCurrency'],
  marketUpdatedAt: str(r.market_updated_at),
  condition: str(r.condition) as CollectibleCondition | undefined,
  grade: str(r.grade),
  acquiredDate: str(r.acquired_date),
  note: str(r.note),
  createdAt: String(r.created_at ?? ''),
  updatedAt: String(r.updated_at ?? ''),
});

export type CollectibleInput = Partial<{
  kind: CollectibleKind; refId: string; name: string; variant: string | null; quantity: number; purchasePrice: number; manualValue: number | null;
  condition: CollectibleCondition | null; grade: string; acquiredDate: string | null; note: string;
}>;
const toBody = (i: CollectibleInput) => ({
  ...(i.kind !== undefined ? { kind: i.kind } : {}),
  ...(i.refId !== undefined ? { ref_id: i.refId } : {}),
  ...(i.name !== undefined ? { name: i.name } : {}),
  ...(i.variant !== undefined ? { variant: i.variant } : {}),
  ...(i.quantity !== undefined ? { quantity: i.quantity } : {}),
  ...(i.purchasePrice !== undefined ? { purchase_price: i.purchasePrice } : {}),
  ...(i.manualValue !== undefined ? { manual_value: i.manualValue } : {}),
  ...(i.condition !== undefined ? { condition: i.condition } : {}),
  ...(i.grade !== undefined ? { grade: i.grade } : {}),
  ...(i.acquiredDate !== undefined ? { acquired_date: i.acquiredDate } : {}),
  ...(i.note !== undefined ? { note: i.note } : {}),
});

export const collectibleService = {
  async list(): Promise<{ items: Collectible[]; history: HistoryPoint[] }> {
    const res = await cloudflareApi<{ items: Row[]; history: Row[] }>('/api/member/collectibles');
    return {
      items: (res.items ?? []).map(fromRow),
      history: (res.history ?? []).map((h) => ({ day: String(h.day), value: Number(h.value_idr) || 0, cost: Number(h.cost_idr) || 0 })),
    };
  },
  /** Perbarui harga kartu yang sudah lama + catat titik grafik hari ini. */
  async refresh(): Promise<number> {
    const res = await cloudflareApi<{ updated?: number }>('/api/member/collectibles/refresh', { method: 'POST', json: {} });
    return Number(res.updated) || 0;
  },
  async searchPokemon(q: string): Promise<TcgCard[]> {
    const res = await cloudflareApi<{ items: TcgCard[] }>(`/api/member/collectibles/pokemon/search?q=${encodeURIComponent(q)}`);
    return res.items ?? [];
  },
  async create(input: CollectibleInput): Promise<string> {
    const res = await cloudflareApi<{ id: string }>('/api/member/collectibles', { method: 'POST', json: toBody(input) });
    notifyCollectionChanged('collectibles');
    return res.id;
  },
  async update(id: string, input: CollectibleInput) {
    await cloudflareApi(`/api/member/collectibles/${id}`, { method: 'PUT', json: toBody(input) });
    notifyCollectionChanged('collectibles');
  },
  async remove(id: string) {
    await cloudflareApi(`/api/member/collectibles/${id}`, { method: 'DELETE' });
    notifyCollectionChanged('collectibles');
  },
  async setPhoto(id: string, imageBase64: string) {
    await cloudflareApi(`/api/member/collectibles/${id}/photo`, { method: 'PUT', json: { imageBase64 } });
    notifyCollectionChanged('collectibles');
  },
  photoUrl: (c: Pick<Collectible, 'id' | 'updatedAt'>) => `/api/member/collectibles/${c.id}/photo?v=${encodeURIComponent(c.updatedAt)}`,
};
