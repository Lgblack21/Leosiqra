import { cloudflareApi } from '../cloudflare-api';
import { notifyCollectionChanged } from '../cf-firestore';
import type { Item, ItemCategory, ItemStatus, ItemValueMode } from '@/lib/itemValue';

// Barangku — /api/member/items (Worker, migrasi 0023). Foto lewat
// /api/member/items/:id/photo (hanya pemilik; ?v= untuk buang cache).
type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

const fromRow = (r: Row): Item => ({
  id: String(r.id),
  name: String(r.name ?? ''),
  brand: str(r.brand),
  variant: str(r.variant),
  category: (str(r.category) ?? 'Lainnya') as ItemCategory,
  purchasePrice: Number(r.purchase_price) || 0,
  currency: str(r.currency) ?? 'IDR',
  purchaseDate: str(r.purchase_date),
  warrantyUntil: str(r.warranty_until),
  valueMode: (str(r.value_mode) ?? 'auto') as ItemValueMode,
  manualValue: r.manual_value == null ? undefined : Number(r.manual_value),
  note: str(r.note),
  status: (str(r.status) ?? 'aktif') as ItemStatus,
  hasPhoto: Number(r.has_photo) === 1,
  createdAt: String(r.created_at ?? ''),
  updatedAt: String(r.updated_at ?? ''),
});

export type ItemInput = {
  name: string;
  brand?: string;
  variant?: string;
  category: ItemCategory;
  purchasePrice: number;
  currency?: string;
  purchaseDate?: string | null;
  warrantyUntil?: string | null;
  valueMode: ItemValueMode;
  manualValue?: number | null;
  note?: string;
};

const toBody = (i: Partial<ItemInput> & { status?: ItemStatus }) => ({
  ...(i.name !== undefined ? { name: i.name } : {}),
  ...(i.brand !== undefined ? { brand: i.brand } : {}),
  ...(i.variant !== undefined ? { variant: i.variant } : {}),
  ...(i.category !== undefined ? { category: i.category } : {}),
  ...(i.purchasePrice !== undefined ? { purchase_price: i.purchasePrice } : {}),
  ...(i.currency !== undefined ? { currency: i.currency } : {}),
  ...(i.purchaseDate !== undefined ? { purchase_date: i.purchaseDate || null } : {}),
  ...(i.warrantyUntil !== undefined ? { warranty_until: i.warrantyUntil || null } : {}),
  ...(i.valueMode !== undefined ? { value_mode: i.valueMode } : {}),
  ...(i.manualValue !== undefined ? { manual_value: i.manualValue } : {}),
  ...(i.note !== undefined ? { note: i.note } : {}),
  ...(i.status !== undefined ? { status: i.status } : {}),
});

export const itemService = {
  async list(): Promise<Item[]> {
    const res = await cloudflareApi<{ items: Row[] }>('/api/member/items');
    return (res.items ?? []).map(fromRow);
  },
  async create(input: ItemInput): Promise<string> {
    const res = await cloudflareApi<{ id: string }>('/api/member/items', { method: 'POST', json: toBody(input) });
    notifyCollectionChanged('items');
    return res.id;
  },
  async update(id: string, input: Partial<ItemInput> & { status?: ItemStatus }) {
    await cloudflareApi(`/api/member/items/${id}`, { method: 'PUT', json: toBody(input) });
    notifyCollectionChanged('items');
  },
  async remove(id: string) {
    await cloudflareApi(`/api/member/items/${id}`, { method: 'DELETE' });
    notifyCollectionChanged('items');
  },
  async setPhoto(id: string, imageBase64: string) {
    await cloudflareApi(`/api/member/items/${id}/photo`, { method: 'PUT', json: { imageBase64 } });
    notifyCollectionChanged('items');
  },
  async removePhoto(id: string) {
    await cloudflareApi(`/api/member/items/${id}/photo`, { method: 'DELETE' });
    notifyCollectionChanged('items');
  },
  photoUrl: (item: Pick<Item, 'id' | 'updatedAt'>) => `/api/member/items/${item.id}/photo?v=${encodeURIComponent(item.updatedAt)}`,
};
