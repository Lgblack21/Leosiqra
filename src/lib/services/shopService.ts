import { cloudflareApi } from '../cloudflare-api';
import { notifyCollectionChanged } from '../cf-firestore';

// Usahaku (Ladangku › Usaha) — /api/member/shops (Worker, migrasi 0027).
// Penjualan = transaksi pemasukan (related_type 'shop', related_id = id usaha).

export type ShopProduct = { name: string; price: number; unit: string };
export type ShopPlan = { modal: number | null; waktu: string; perBulan: [number, number] | null; alasan: string[]; langkah: string[]; pembeli: string; cariDi: string };
export type ShopIdea = { name: string; emoji: string; tagline: string; description: string; products: ShopProduct[]; plan: ShopPlan };
export type Shop = {
  id: string;
  name: string;
  tagline?: string;
  description?: string;
  emoji?: string;
  products: ShopProduct[];
  plan?: ShopPlan;
  contactWa?: string; // 62…
  paymentNote?: string;
  area?: string;
  linkUrl?: string;
  promotedAt?: string;
  createdAt: string;
  updatedAt: string;
};
export type ShopInput = Partial<{ name: string; tagline: string; description: string; emoji: string; products: ShopProduct[]; plan: ShopPlan | null; contactWa: string; paymentNote: string; area: string; linkUrl: string; promoted: boolean }>;

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
const parse = <T,>(v: unknown, fallback: T): T => { try { return typeof v === 'string' ? (JSON.parse(v) as T) : fallback; } catch { return fallback; } };
const fromRow = (r: Row): Shop => ({
  id: String(r.id),
  name: String(r.name ?? ''),
  tagline: str(r.tagline),
  description: str(r.description),
  emoji: str(r.emoji),
  products: parse<ShopProduct[]>(r.products_json, []),
  plan: parse<ShopPlan | undefined>(r.plan_json, undefined),
  contactWa: str(r.contact_wa),
  paymentNote: str(r.payment_note),
  area: str(r.area),
  linkUrl: str(r.link_url),
  promotedAt: str(r.promoted_at),
  createdAt: String(r.created_at ?? ''),
  updatedAt: String(r.updated_at ?? ''),
});
const toBody = (i: ShopInput) => ({
  ...(i.name !== undefined ? { name: i.name } : {}),
  ...(i.tagline !== undefined ? { tagline: i.tagline } : {}),
  ...(i.description !== undefined ? { description: i.description } : {}),
  ...(i.emoji !== undefined ? { emoji: i.emoji } : {}),
  ...(i.products !== undefined ? { products: i.products } : {}),
  ...(i.plan !== undefined ? { plan: i.plan } : {}),
  ...(i.contactWa !== undefined ? { contact_wa: i.contactWa } : {}),
  ...(i.paymentNote !== undefined ? { payment_note: i.paymentNote } : {}),
  ...(i.area !== undefined ? { area: i.area } : {}),
  ...(i.linkUrl !== undefined ? { link_url: i.linkUrl } : {}),
  ...(i.promoted ? { promoted: true } : {}),
});

export const shopService = {
  async list(): Promise<Shop[]> {
    const res = await cloudflareApi<{ items: Row[] }>('/api/member/shops');
    return (res.items ?? []).map(fromRow);
  },
  async ideas(text: string, exclude: string[] = []): Promise<{ ideas: ShopIdea[]; remaining: number }> {
    return cloudflareApi<{ ideas: ShopIdea[]; remaining: number }>('/api/member/shops/ideas', { method: 'POST', json: { text, exclude } });
  },
  async create(i: ShopInput): Promise<string> {
    const res = await cloudflareApi<{ id: string }>('/api/member/shops', { method: 'POST', json: toBody(i) });
    notifyCollectionChanged('shops');
    return res.id;
  },
  async update(id: string, i: ShopInput) {
    await cloudflareApi(`/api/member/shops/${id}`, { method: 'PUT', json: toBody(i) });
    notifyCollectionChanged('shops');
  },
  async remove(id: string) {
    await cloudflareApi(`/api/member/shops/${id}`, { method: 'DELETE' });
    notifyCollectionChanged('shops');
  },
  /** AI membaca daftar harga di website (USULAN — belum disimpan). */
  async importPrices(id: string, url?: string): Promise<{ products: ShopProduct[]; source: string; via: 'langsung' | 'pembaca'; shopName: string | null }> {
    return cloudflareApi(`/api/member/shops/${id}/import-prices`, { method: 'POST', json: url ? { url } : {} });
  },
  async sale(id: string, input: { requestId: string; amount: number; qty: number; product?: string; accountId: string; date?: string }) {
    await cloudflareApi(`/api/member/shops/${id}/sale`, { method: 'POST', json: { request_id: input.requestId, amount: input.amount, qty: input.qty, product: input.product, account_id: input.accountId, date: input.date } });
    notifyCollectionChanged('transactions');
    notifyCollectionChanged('accounts');
  },
};

/** Nomor tampilan: 62812… → 0812-…-… */
export const prettyWa = (wa?: string) => {
  if (!wa) return '';
  const local = wa.startsWith('62') ? `0${wa.slice(2)}` : wa;
  return local.replace(/^(\d{4})(\d{4})(\d+)$/, '$1-$2-$3');
};
export const catalogText = (s: Shop, fmt: (n: number) => string) => {
  const lines = [`${s.emoji ? `${s.emoji} ` : ''}*${s.name}*`, s.tagline, '', ...s.products.map((p) => `• ${p.name} — ${fmt(p.price)}${p.unit ? ` ${p.unit}` : ''}`)];
  if (s.paymentNote) lines.push('', `Bayar: ${s.paymentNote}`);
  if (s.area) lines.push(`Area: ${s.area}`);
  if (s.contactWa) lines.push('', `Pesan: https://wa.me/${s.contactWa}?text=${encodeURIComponent(`Halo ${s.name}, mau pesan`)}`);
  if (s.linkUrl) lines.push(`Toko: ${s.linkUrl}`);
  return lines.filter((l) => l !== undefined).join('\n').replace(/\n{3,}/g, '\n\n');
};

export const PABRIK_AI_URL = 'https://app.vantis.sh';
/** Brief untuk dibuatkan website oleh AI builder (Pabrik.AI) — tanpa data keuangan. */
export const websiteBrief = (s: Shop, fmt: (n: number) => string) => {
  const order = s.contactWa ? `https://wa.me/${s.contactWa}?text=${encodeURIComponent(`Halo ${s.name}, mau pesan`)}` : '';
  return [
    `# Buatkan website toko: ${s.name}`,
    s.tagline && `Tagline: ${s.tagline}`,
    s.description && `Tentang: ${s.description}`,
    '',
    '## Produk & harga',
    ...(s.products.length ? s.products.map((p) => `- ${p.name} — ${fmt(p.price)}${p.unit ? ` ${p.unit}` : ''}`) : ['- (isi produk di sini)']),
    '',
    '## Cara pesan & bayar',
    order ? `- Semua tombol "Pesan" membuka WhatsApp: ${order}` : '- Tombol "Pesan" membuka WhatsApp penjual',
    s.paymentNote && `- Cara bayar: ${s.paymentNote}`,
    s.area && `- Area layanan: ${s.area}`,
    '',
    '## Ketentuan',
    '- Satu halaman, mobile-first (kebanyakan pembeli buka dari HP), bahasa Indonesia, cepat dimuat.',
    '- Tampilkan daftar produk dengan harga dalam Rupiah sebagai teks biasa (bukan gambar).',
    '- Tanpa login, tanpa keranjang/payment gateway — pemesanan cukup lewat WhatsApp.',
    '- Setelah jadi, berikan tautan PUBLIK yang bisa dibuka pembeli (bukan tautan editor).',
  ].filter((l) => typeof l === 'string').join('\n').replace(/\n{3,}/g, '\n\n').trim();
};
