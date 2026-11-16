import { cloudflareApi } from '../cloudflare-api';
import { shopFromRow, type Shop, type ShopExpenseInput } from './shopService';
import type { StockData, StockMaterial } from './stockService';

// Usahaku › Tim. Anggota tim (kasir) login dengan username "toko-nama" ke /tim —
// sesi terpisah dari akun pemilik (/api/staff/*). Pemilik mengelola akun lewat
// /api/member/staff.

/** "@cxa-rina", " CXA-Rina " → "cxa-rina" — @ di depan dibuang otomatis. */
export const normStaffUsername = (v: string) => v.trim().toLowerCase().replace(/^@+/, '');

export const STAFF_USERNAME_RE = /^[a-z0-9_.]{2,15}-[a-z0-9_.]{2,15}$/;
/** Tanda hubung tidak boleh di username pengguna biasa → identitas akun tim. */
export const looksLikeStaffUsername = (v: string) => STAFF_USERNAME_RE.test(normStaffUsername(v));

export type StaffSale = {
  id: string;
  shop_id: string;
  type: 'pemasukan' | 'pengeluaran';
  amount: number;
  note: string | null;
  created_at: string;
};
export type StaffMe = {
  staff: { id: string; name: string; username: string; role: string; staff_no?: string | null; title?: string | null; has_photo?: boolean };
  owner: string;
  account: string | null;
  shops: Shop[];
  today: StaffSale[];
  materials?: StockMaterial[];
  date: string;
  /** Nama kas usaha tujuan per usaha (kas pilihan pemilik untuk akun ini). */
  kasNames: Record<string, string | null>;
};

export const staffService = {
  async login(username: string, password: string) {
    return cloudflareApi<{ ok: boolean; name: string }>('/api/staff/login', {
      method: 'POST',
      json: { username: normStaffUsername(username), password },
    });
  },
  async logout() {
    await cloudflareApi('/api/staff/logout', { method: 'POST', json: {} });
  },
  async me(): Promise<StaffMe> {
    const r = await cloudflareApi<Omit<StaffMe, 'shops' | 'kasNames'> & { shops: Record<string, unknown>[] }>(
      `/api/staff/me?t=${Date.now()}`,
    );
    const kasNames = Object.fromEntries(r.shops.map((s) => [String(s.id), s.kas_name ? String(s.kas_name) : null]));
    return { ...r, shops: r.shops.map(shopFromRow), kasNames };
  },
  async sale(
    shopId: string,
    input: {
      requestId: string;
      amount: number;
      qty: number;
      product: string;
      buyer: string;
      items: { name: string; price: number; qty: number; key?: string }[];
    },
  ) {
    await cloudflareApi(`/api/staff/shops/${shopId}/sale`, {
      method: 'POST',
      json: {
        request_id: input.requestId,
        amount: input.amount,
        qty: input.qty,
        product: input.product,
        buyer: input.buyer,
        items: input.items,
      },
    });
  },
  async expense(shopId: string, input: ShopExpenseInput) {
    await cloudflareApi(`/api/staff/shops/${shopId}/expense`, {
      method: 'POST',
      json: {
        request_id: input.requestId,
        amount: input.amount,
        item: input.item,
        kind: input.kind,
        ...(input.stock ? { stock: { material_id: input.stock.materialId, qty: input.stock.qty } } : {}),
      },
    });
  },
  async changePassword(current: string, next: string) {
    await cloudflareApi('/api/staff/password', { method: 'POST', json: { current, next } });
  },
  /** Penagih: pinjaman aktif usaha ini (tanpa alamat/KTP/jaminan). */
  async tagihan(shopId: string): Promise<StaffTagihan> {
    const r = await cloudflareApi<{ today: string; kas_name: string | null; loans: Record<string, unknown>[] }>(
      `/api/staff/shops/${shopId}/tagihan?t=${Date.now()}`,
    );
    return {
      today: r.today,
      kasName: r.kas_name,
      loans: r.loans.map((l) => {
        let dueDates: string[] = [];
        try {
          const v = JSON.parse(String(l.due_dates_json ?? '[]'));
          if (Array.isArray(v)) dueDates = v.filter((d): d is string => typeof d === 'string');
        } catch {
          /* jadwal rusak → anggap kosong */
        }
        return {
          id: String(l.id),
          name: String(l.borrower_name ?? 'Peminjam'),
          wa: l.borrower_wa ? String(l.borrower_wa) : null,
          memberNo: l.member_no ? String(l.member_no) : null,
          installment: Number(l.installment) || 0,
          total: Number(l.total) || 0,
          count: Number(l.count) || 0,
          frequency: l.frequency === 'mingguan' ? 'mingguan' : 'harian',
          dueDates,
          paid: Number(l.paid) || 0,
          paidByMeToday: Number(l.paid_by_me_today) || 0,
        } as TagihanLoan;
      }),
    };
  },
  async terima(shopId: string, loanId: string, input: { requestId: string; amount: number }) {
    return cloudflareApi<{ ok: boolean; lunas: boolean }>(`/api/staff/shops/${shopId}/tagihan/${loanId}/bayar`, {
      method: 'POST',
      json: { request_id: input.requestId, amount: input.amount },
    });
  },
};

export type TagihanLoan = {
  id: string;
  name: string;
  wa: string | null;
  memberNo: string | null;
  installment: number;
  total: number;
  count: number;
  frequency: 'harian' | 'mingguan';
  dueDates: string[];
  paid: number;
  paidByMeToday: number;
};
export type StaffTagihan = { today: string; kasName: string | null; loans: TagihanLoan[] };

// Stok usaha untuk akun tim: lihat, tambah bahan, pakai/masuk/hitung fisik (tanpa harga beli).
export const staffStockService = {
  async get(shopId: string) {
    return cloudflareApi<StockData>(`/api/staff/shops/${shopId}/stock?t=${Date.now()}`);
  },
  async addMaterial(shopId: string, input: { name: string; unit: string; stock: number; min: number | null }) {
    return cloudflareApi<{ id: string }>(`/api/staff/shops/${shopId}/stock/materials`, { method: 'POST', json: input });
  },
  async revert(shopId: string, moveId: string) {
    await cloudflareApi(`/api/staff/shops/${shopId}/stock/moves/${moveId}/revert`, { method: 'POST', json: {} });
  },
  async move(
    shopId: string,
    input: { requestId: string; materialId: string; kind: 'masuk' | 'pakai' | 'opname'; qty: number; note?: string },
  ) {
    await cloudflareApi(`/api/staff/shops/${shopId}/stock/moves`, {
      method: 'POST',
      json: {
        request_id: input.requestId,
        material_id: input.materialId,
        kind: input.kind,
        qty: input.qty,
        note: input.note,
      },
    });
  },
};

export type TeamMember = {
  id: string;
  username: string;
  name: string;
  role: string;
  shop_ids: string[];
  account_id: string | null;
  disabled: boolean;
  last_login_at: string | null;
  created_at: string;
  /** Migrasi 0049: kas usaha per toko (toko → kas), nomor staf, jabatan tambahan, foto. */
  kas?: Record<string, string>;
  staff_no?: string | null;
  title?: string | null;
  has_photo?: boolean;
  updated_at?: string;
};
export type KasOption = { id: string; shop_id: string; name: string; kind: string; is_default: number };
export type TeamList = { items: TeamMember[]; limit: number; plan: string; kas_options?: KasOption[]; extras?: boolean };

export const teamService = {
  async list() {
    return cloudflareApi<TeamList>('/api/member/staff');
  },
  async create(input: { name: string; username: string; password: string; shopIds: string[]; accountId: string; role?: string; kas?: Record<string, string> }) {
    return cloudflareApi<{ id: string }>('/api/member/staff', {
      method: 'POST',
      json: {
        name: input.name,
        username: normStaffUsername(input.username),
        password: input.password,
        shop_ids: input.shopIds,
        account_id: input.accountId || undefined,
        ...(input.role ? { role: input.role } : {}),
        ...(input.kas ? { kas: input.kas } : {}),
      },
    });
  },
  async update(
    id: string,
    input: Partial<{ name: string; password: string; shopIds: string[]; accountId: string; disabled: boolean; role: string; kas: Record<string, string> }>,
  ) {
    await cloudflareApi(`/api/member/staff/${id}`, {
      method: 'PUT',
      json: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.password !== undefined ? { password: input.password } : {}),
        ...(input.shopIds !== undefined ? { shop_ids: input.shopIds } : {}),
        ...(input.accountId !== undefined ? { account_id: input.accountId } : {}),
        ...(input.disabled !== undefined ? { disabled: input.disabled } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.kas !== undefined ? { kas: input.kas } : {}),
      },
    });
  },
  photoUrl: (m: Pick<TeamMember, 'id' | 'updated_at' | 'created_at'>) => `/api/member/staff/${m.id}/foto?v=${encodeURIComponent(m.updated_at ?? m.created_at)}`,
  async setPhoto(id: string, imageBase64: string) {
    await cloudflareApi(`/api/member/staff/${id}/foto`, { method: 'PUT', json: { imageBase64 } });
  },
  async removePhoto(id: string) {
    await cloudflareApi(`/api/member/staff/${id}/foto`, { method: 'DELETE' });
  },
  async remove(id: string) {
    await cloudflareApi(`/api/member/staff/${id}`, { method: 'DELETE' });
  },
};
