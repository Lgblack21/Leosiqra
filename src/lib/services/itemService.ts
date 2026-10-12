import { cloudflareApi } from '../cloudflare-api';
import { notifyCollectionChanged } from '../cf-firestore';

export type ItemKind = 'barang' | 'koleksi';
export interface Item {
  id: string;
  kind: ItemKind;
  name: string;
  category: string | null;
  purchase_price: number;
  current_value: number;
  purchase_date: string | null;
  warranty_until: string | null;
  for_sale: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}
export type ItemInput = {
  name: string;
  category?: string | null;
  purchase_price?: number;
  current_value?: number;
  purchase_date?: string | null;
  warranty_until?: string | null;
  for_sale?: boolean;
  note?: string | null;
};

// Barang & Koleksi (Worker /api/member/items, tabel br_items).
export const itemService = {
  async list(kind?: ItemKind) {
    const r = await cloudflareApi<{ items: Item[] }>(`/api/member/items${kind ? `?kind=${kind}` : ''}`);
    return r.items;
  },
  async create(kind: ItemKind, data: ItemInput) {
    const r = await cloudflareApi<{ ok: boolean; id: string }>('/api/member/items', { method: 'POST', json: { kind, ...data } });
    notifyCollectionChanged('items');
    return r.id;
  },
  async update(id: string, data: ItemInput) {
    await cloudflareApi(`/api/member/items/${id}`, { method: 'PUT', json: data });
    notifyCollectionChanged('items');
  },
  async remove(id: string) {
    await cloudflareApi(`/api/member/items/${id}`, { method: 'DELETE' });
    notifyCollectionChanged('items');
  },
};
