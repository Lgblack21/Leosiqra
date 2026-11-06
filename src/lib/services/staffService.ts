import { cloudflareApi } from '../cloudflare-api';
import { shopFromRow, type Shop } from './shopService';

// Usahaku › Tim. Anggota tim (kasir) login dengan username "toko-nama" ke /tim —
// sesi terpisah dari akun pemilik (/api/staff/*). Pemilik mengelola akun lewat
// /api/member/staff.

export const STAFF_USERNAME_RE = /^[a-z0-9_.]{2,15}-[a-z0-9_.]{2,15}$/;
/** Tanda hubung tidak boleh di username pengguna biasa → identitas akun tim. */
export const looksLikeStaffUsername = (v: string) => STAFF_USERNAME_RE.test(v.trim().toLowerCase());

export type StaffSale = { id: string; shop_id: string; amount: number; note: string | null; created_at: string };
export type StaffMe = { staff: { id: string; name: string; username: string; role: string }; owner: string; account: string | null; shops: Shop[]; today: StaffSale[]; date: string };

export const staffService = {
  async login(username: string, password: string) {
    return cloudflareApi<{ ok: boolean; name: string }>('/api/staff/login', { method: 'POST', json: { username: username.trim().toLowerCase(), password } });
  },
  async logout() {
    await cloudflareApi('/api/staff/logout', { method: 'POST', json: {} });
  },
  async me(): Promise<StaffMe> {
    const r = await cloudflareApi<Omit<StaffMe, 'shops'> & { shops: Record<string, unknown>[] }>(`/api/staff/me?t=${Date.now()}`);
    return { ...r, shops: r.shops.map(shopFromRow) };
  },
  async sale(shopId: string, input: { requestId: string; amount: number; qty: number; product: string; buyer: string; items: { name: string; price: number; qty: number }[] }) {
    await cloudflareApi(`/api/staff/shops/${shopId}/sale`, { method: 'POST', json: { request_id: input.requestId, amount: input.amount, qty: input.qty, product: input.product, buyer: input.buyer, items: input.items } });
  },
  async changePassword(current: string, next: string) {
    await cloudflareApi('/api/staff/password', { method: 'POST', json: { current, next } });
  },
};

export type TeamMember = { id: string; username: string; name: string; role: string; shop_ids: string[]; account_id: string | null; disabled: boolean; last_login_at: string | null; created_at: string };

export const teamService = {
  async list() {
    return cloudflareApi<{ items: TeamMember[]; limit: number; plan: string }>('/api/member/staff');
  },
  async create(input: { name: string; username: string; password: string; shopIds: string[]; accountId: string }) {
    return cloudflareApi<{ id: string }>('/api/member/staff', { method: 'POST', json: { name: input.name, username: input.username.trim().toLowerCase(), password: input.password, shop_ids: input.shopIds, account_id: input.accountId } });
  },
  async update(id: string, input: Partial<{ name: string; password: string; shopIds: string[]; accountId: string; disabled: boolean }>) {
    await cloudflareApi(`/api/member/staff/${id}`, {
      method: 'PUT',
      json: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.password !== undefined ? { password: input.password } : {}),
        ...(input.shopIds !== undefined ? { shop_ids: input.shopIds } : {}),
        ...(input.accountId !== undefined ? { account_id: input.accountId } : {}),
        ...(input.disabled !== undefined ? { disabled: input.disabled } : {}),
      },
    });
  },
  async remove(id: string) {
    await cloudflareApi(`/api/member/staff/${id}`, { method: 'DELETE' });
  },
};
