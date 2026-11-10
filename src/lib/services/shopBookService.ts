import { cloudflareApi } from '../cloudflare-api';
import { notifyCollectionChanged } from '../cf-firestore';

// Usahaku › Buku usaha (Worker /api/member/shops/:id/{book,accounts,transfer,entries}, migrasi 0045).
// Uang usaha terpisah dari keuangan pribadi: kas usaha sendiri, penjualan & biaya tidak masuk statistik
// pribadi. Setor modal / ambil uang = transfer di sisi pribadi (bukan pemasukan/pengeluaran).

export type SaleBookInput = {
  channel: string;
  channelType: 'langsung' | 'marketplace';
  payMethod: string | null;
  fees: { label: string; amount: number }[];
  reseller: boolean;
  /** Marketplace: false = belum cair (belum masuk kas). Jualan langsung selalu langsung masuk kas. */
  settled: boolean;
  /** Kas usaha tujuan (wajib kalau sudah cair / jualan langsung). */
  accountId: string | null;
};

export type ShopAccount = {
  id: string;
  name: string;
  kind: string;
  balance: number;
  isDefault: boolean;
  archived: boolean;
};
export type BookEntryType = 'jual' | 'biaya' | 'setor' | 'ambil' | 'pindah' | 'saldo_awal';
export type BookEntry = {
  id: string;
  type: BookEntryType;
  date: string;
  amount: number;
  fee: number;
  net: number;
  accountId: string | null;
  toAccountId: string | null;
  channel: string | null;
  channelType: 'langsung' | 'marketplace' | null;
  payMethod: string | null;
  status: 'selesai' | 'menunggu';
  category: string | null;
  buyer: string | null;
  reseller: boolean;
  note: string | null;
  fees: { label: string; amount: number }[];
  product: string | null;
  byName: string | null;
  createdAt: string;
};
export type BookSum = { omzet: number; fee: number; biaya: number; nota: number };
export type ShopBook = {
  accounts: ShopAccount[];
  entries: BookEntry[];
  pending: BookEntry[];
  today: BookSum;
  month: BookSum;
  /** Ringkasan rentang yang ditarik (from–to). */
  period: BookSum;
  range: { from: string; to: string };
  truncated: boolean;
};

type Row = Record<string, unknown>;
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
const txt = (v: unknown) => (typeof v === 'string' && v ? v : null);
const accountFromRow = (r: Row): ShopAccount => ({
  id: String(r.id),
  name: String(r.name ?? ''),
  kind: String(r.kind ?? 'kas'),
  balance: num(r.balance),
  isDefault: num(r.is_default) === 1,
  archived: Boolean(r.archived_at),
});
const entryFromRow = (r: Row): BookEntry => {
  let p: Row = {};
  try {
    const v = typeof r.payload_json === 'string' ? JSON.parse(r.payload_json) : null;
    if (v && typeof v === 'object') p = v as Row;
  } catch {
    /* abaikan */
  }
  return {
    id: String(r.id),
    type: String(r.type) as BookEntryType,
    date: String(r.date ?? ''),
    amount: num(r.amount),
    fee: num(r.fee),
    net: num(r.net),
    accountId: txt(r.account_id),
    toAccountId: txt(r.to_account_id),
    channel: txt(r.channel),
    channelType: r.channel_type === 'marketplace' ? 'marketplace' : r.channel_type === 'langsung' ? 'langsung' : null,
    payMethod: txt(r.pay_method),
    status: r.status === 'menunggu' ? 'menunggu' : 'selesai',
    category: txt(r.category),
    buyer: txt(r.buyer),
    reseller: num(r.reseller) === 1,
    note: txt(r.note),
    fees: Array.isArray(p.fees)
      ? (p.fees as Row[]).map((f) => ({ label: String(f?.label ?? ''), amount: num(f?.amount) }))
      : [],
    product: txt(p.product),
    byName: txt(r.by_name),
    createdAt: String(r.created_at ?? ''),
  };
};
const sumOf = (v: unknown): BookSum => {
  const r = (v && typeof v === 'object' ? v : {}) as Row;
  return { omzet: num(r.omzet), fee: num(r.fee), biaya: num(r.biaya), nota: num(r.nota) };
};
const changed = () => {
  notifyCollectionChanged('shop_book');
  notifyCollectionChanged('shops');
};

export const shopBookService = {
  async get(shopId: string, range?: { from: string; to: string }): Promise<ShopBook> {
    const q = range ? `?from=${range.from}&to=${range.to}` : '';
    const r = await cloudflareApi<Row>(`/api/member/shops/${shopId}/book${q}`);
    return {
      accounts: ((r.accounts as Row[]) ?? []).map(accountFromRow),
      entries: ((r.entries as Row[]) ?? []).map(entryFromRow),
      pending: ((r.pending as Row[]) ?? []).map(entryFromRow),
      today: sumOf(r.today),
      month: sumOf(r.month),
      period: sumOf(r.period ?? r.month),
      range: (r.range as { from: string; to: string }) ?? { from: '', to: '' },
      truncated: r.truncated === true,
    };
  },
  async createAccount(shopId: string, input: { name: string; kind: string; opening: number; requestId: string }) {
    const r = await cloudflareApi<{ id: string }>(`/api/member/shops/${shopId}/accounts`, {
      method: 'POST',
      json: { name: input.name, kind: input.kind, opening: input.opening, request_id: input.requestId },
    });
    changed();
    return r.id;
  },
  async updateAccount(shopId: string, accountId: string, input: { name?: string; kind?: string; isDefault?: boolean }) {
    await cloudflareApi(`/api/member/shops/${shopId}/accounts/${accountId}`, {
      method: 'PUT',
      json: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.kind !== undefined ? { kind: input.kind } : {}),
        ...(input.isDefault ? { is_default: true } : {}),
      },
    });
    changed();
  },
  async removeAccount(shopId: string, accountId: string) {
    await cloudflareApi(`/api/member/shops/${shopId}/accounts/${accountId}`, { method: 'DELETE' });
    changed();
  },
  /** setor = rekening pribadi → kas usaha; ambil = kas usaha → rekening pribadi; pindah = antar kas usaha. */
  async transfer(
    shopId: string,
    input: {
      direction: 'setor' | 'ambil' | 'pindah';
      amount: number;
      shopAccountId: string;
      toAccountId?: string;
      personalAccountId?: string;
      note?: string;
      date?: string;
      requestId: string;
    },
  ) {
    await cloudflareApi(`/api/member/shops/${shopId}/transfer`, {
      method: 'POST',
      json: {
        direction: input.direction,
        amount: input.amount,
        shop_account_id: input.shopAccountId,
        to_account_id: input.toAccountId,
        personal_account_id: input.personalAccountId,
        note: input.note,
        date: input.date,
        request_id: input.requestId,
      },
    });
    changed();
    notifyCollectionChanged('transactions');
    notifyCollectionChanged('accounts');
  },
  /** Penjualan marketplace cair → masuk kas; net boleh beda dari perkiraan (selisih jadi potongan). */
  async settle(shopId: string, entryId: string, input: { accountId: string; net: number }) {
    await cloudflareApi(`/api/member/shops/${shopId}/entries/${entryId}/settle`, {
      method: 'POST',
      json: { shop_account_id: input.accountId, net: input.net },
    });
    changed();
  },
  async removeEntry(shopId: string, entryId: string) {
    await cloudflareApi(`/api/member/shops/${shopId}/entries/${entryId}`, { method: 'DELETE' });
    changed();
    notifyCollectionChanged('shop_stock');
    notifyCollectionChanged('transactions');
    notifyCollectionChanged('accounts');
  },
  /** Omzet & biaya buku usaha per bulan (semua usaha) — Pajak Center. */
  async omzet(year: number): Promise<{ month: number; omzet: number; biaya: number }[]> {
    try {
      const r = await cloudflareApi<{ months: Row[] }>(`/api/member/shops/omzet?year=${year}`);
      return (r.months ?? []).map((m) => ({ month: Number(m.m), omzet: num(m.omzet), biaya: num(m.biaya) }));
    } catch {
      return [];
    }
  },
};
