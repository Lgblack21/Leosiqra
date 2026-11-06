import { cloudflareApi } from '../cloudflare-api';
import { notifyCollectionChanged } from '../cf-firestore';

// Usahaku › Stok bahan (Worker: handleShopStock, migrasi 0033). Stok berubah lewat
// riwayat (masuk/pakai/opname manual, beli via catat biaya, jual via resep produk).

export type StockMaterial = { id: string; shop_id: string; name: string; unit: string; stock: number; min_stock: number | null; archived_at?: string | null; avg_cost?: number | null };
export type StockMove = { id: string; material_id: string; kind: 'awal' | 'beli' | 'masuk' | 'pakai' | 'jual' | 'opname'; qty: number; cost: number | null; note: string | null; by_name: string | null; date: string; created_at: string; reverted_at: string | null };
export type StockRecipe = { product_key: string; items: { m: string; q: number }[] };
export type StockData = { materials: StockMaterial[]; recipes: StockRecipe[]; moves: StockMove[] };

export const STOCK_UNITS = ['pcs', 'ml', 'liter', 'gram', 'kg', 'lembar', 'pak', 'meter'] as const;
export const MOVE_LABEL: Record<StockMove['kind'], string> = { awal: 'Stok awal', beli: 'Beli', masuk: 'Masuk', pakai: 'Pakai', jual: 'Terjual', opname: 'Hitung fisik' };

/** Angka stok tampil rapi: 1.910,5 — maksimal 3 desimal. */
export const fmtQty = (n: number) => (Math.round(n * 1000) / 1000).toLocaleString('id-ID', { maximumFractionDigits: 3 });
export const isLow = (m: StockMaterial) => m.stock <= 0 || (m.min_stock != null && m.stock <= m.min_stock);

const base = (shopId: string) => `/api/member/shops/${shopId}/stock`;
const changed = () => notifyCollectionChanged('shop_stock');

export const stockService = {
  async get(shopId: string) {
    return cloudflareApi<StockData>(`${base(shopId)}?t=${Date.now()}`);
  },
  async addMaterial(shopId: string, input: { name: string; unit: string; stock: number; min: number | null }) {
    const r = await cloudflareApi<{ id: string }>(`${base(shopId)}/materials`, { method: 'POST', json: input });
    changed();
    return r;
  },
  async updateMaterial(shopId: string, id: string, input: Partial<{ name: string; unit: string; min: number | null; archived: boolean }>) {
    await cloudflareApi(`${base(shopId)}/materials/${id}`, { method: 'PUT', json: input });
    changed();
  },
  async move(shopId: string, input: { requestId: string; materialId: string; kind: 'masuk' | 'pakai' | 'opname'; qty: number; note?: string }) {
    await cloudflareApi(`${base(shopId)}/moves`, { method: 'POST', json: { request_id: input.requestId, material_id: input.materialId, kind: input.kind, qty: input.qty, note: input.note } });
    changed();
  },
  async setRecipe(shopId: string, productKey: string, items: { materialId: string; qty: number }[]) {
    await cloudflareApi(`${base(shopId)}/recipes`, { method: 'PUT', json: { product_key: productKey, items: items.map((i) => ({ material_id: i.materialId, qty: i.qty })) } });
    changed();
  },
};
