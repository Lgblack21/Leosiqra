import { cloudflareApi } from '../cloudflare-api';

// Dompet Bersama (Mode Keluarga/Patungan) — buku kas terpisah dari data
// pribadi. Semua nominal INTEGER rupiah utuh. Lihat docs/rancangan/shared-wallet.md.

export type SharedWalletRole = 'owner' | 'editor' | 'viewer';
export type SharedTxType = 'pemasukan' | 'pengeluaran';

export interface SharedWalletSummary {
  id: string;
  name: string;
  currency: string;
  archived_at: string | null;
  role: SharedWalletRole;
  member_count: number;
  balance: number;
}

export interface SharedWalletLimits {
  wallets: number;
  members: number;
  plan: 'FREE' | 'PRO';
  ownedActive: number;
}

export interface SharedWalletMember {
  user_id: string;
  display_name: string;
  role: SharedWalletRole;
  joined_at: string;
}

export interface SharedWalletInvite {
  id: string;
  role: 'editor' | 'viewer';
  max_uses: number;
  used_count: number;
  expires_at: string;
  created_at: string;
}

export interface SharedWalletDetail {
  wallet: { id: string; name: string; currency: string; archived_at: string | null; role: SharedWalletRole; me: string };
  month: string;
  balance: number;
  income: number;
  expense: number;
  members: SharedWalletMember[];
  memberLimit: number;
  budgets: { category: string; amount: number; spent: number }[];
  invites: SharedWalletInvite[];
  activity: { action: string; target_id: string | null; created_at: string; actor_name: string }[];
}

export interface SharedTx {
  id: string;
  type: SharedTxType;
  amount: number;
  category: string;
  note: string | null;
  date: string;
  created_by: string | null;
  created_by_name: string;
  created_at: string;
}

export interface SharedTxInput {
  type: SharedTxType;
  amount: number;
  category: string;
  note?: string;
  date: string;
}

const base = '/api/member/shared-wallets';
const w = (id: string) => `${base}/${encodeURIComponent(id)}`;

export const sharedWalletService = {
  list() {
    return cloudflareApi<{ items: SharedWalletSummary[]; limits: SharedWalletLimits }>(base);
  },
  create(name: string) {
    return cloudflareApi<{ ok: true; id: string }>(base, { method: 'POST', json: { name } });
  },
  detail(id: string) {
    return cloudflareApi<SharedWalletDetail>(w(id));
  },
  update(id: string, patch: { name?: string; archived?: boolean }) {
    return cloudflareApi<{ ok: true }>(w(id), { method: 'PATCH', json: patch });
  },
  remove(id: string) {
    return cloudflareApi<{ ok: true }>(w(id), { method: 'DELETE' });
  },
  async transactions(id: string, month: string) {
    const r = await cloudflareApi<{ items: SharedTx[] }>(`${w(id)}/transactions?month=${encodeURIComponent(month)}`);
    return r.items;
  },
  // clientRequestId sama untuk percobaan ulang → server tidak mencatat dobel.
  addTransaction(id: string, input: SharedTxInput, clientRequestId: string) {
    return cloudflareApi<{ ok: true; id: string; duplicate?: boolean }>(`${w(id)}/transactions`, {
      method: 'POST',
      json: { ...input, clientRequestId },
    });
  },
  updateTransaction(id: string, txId: string, patch: Partial<SharedTxInput>) {
    return cloudflareApi<{ ok: true }>(`${w(id)}/transactions/${encodeURIComponent(txId)}`, { method: 'PATCH', json: patch });
  },
  deleteTransaction(id: string, txId: string) {
    return cloudflareApi<{ ok: true }>(`${w(id)}/transactions/${encodeURIComponent(txId)}`, { method: 'DELETE' });
  },
  setBudget(id: string, category: string, amount: number) {
    return cloudflareApi<{ ok: true }>(`${w(id)}/budgets`, { method: 'PUT', json: { category, amount } });
  },
  createInvite(id: string, role: 'editor' | 'viewer', maxUses: number) {
    return cloudflareApi<{ ok: true; id: string; token: string; expiresAt: string }>(`${w(id)}/invites`, {
      method: 'POST',
      json: { role, maxUses, expiresDays: 7 },
    });
  },
  revokeInvite(id: string, inviteId: string) {
    return cloudflareApi<{ ok: true }>(`${w(id)}/invites/${encodeURIComponent(inviteId)}`, { method: 'DELETE' });
  },
  join(token: string) {
    return cloudflareApi<{ ok: true; walletId: string; alreadyMember?: boolean }>(`${base}/join`, { method: 'POST', json: { token } });
  },
  setMemberRole(id: string, userId: string, role: SharedWalletRole) {
    return cloudflareApi<{ ok: true }>(`${w(id)}/members/${encodeURIComponent(userId)}`, { method: 'PATCH', json: { role } });
  },
  removeMember(id: string, userId: string) {
    return cloudflareApi<{ ok: true }>(`${w(id)}/members/${encodeURIComponent(userId)}`, { method: 'DELETE' });
  },
};
