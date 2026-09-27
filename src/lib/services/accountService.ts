import { cloudflareApi } from '../cloudflare-api';
import { notifyCollectionChanged } from '../cf-firestore';

export interface Account {
  id?: string;
  userId: string;
  name: string;
  type: 'Bank Account' | 'E-Wallet' | 'Cash' | 'Investment Account' | 'Credit Card' | string;
  currency: string;
  balance: number;
  initialBalance: number;
  baseValue?: number;
  creditLimit?: number; // plafon kartu kredit / paylater (0 = bukan kartu kredit)
  logoUrl?: string;
  logoLabel?: string;
  cardColor?: string;
  // Siklus tagihan kartu kredit (lihat lib/creditCycle.ts) — opsional.
  statementDay?: number;
  dueDay?: number;
  minPaymentPercent?: number;
  minPaymentAmount?: number;
  // Urutan tampil rekening (drag-to-reorder di Kartu Saya) — dipakai semua
  // halaman/dropdown yang menampilkan daftar rekening.
  sortOrder?: number;
  createdAt: Date;
}

export interface AccountPayloadFields {
  cardColor?: string;
  creditLimit: number;
  statementDay?: number;
  dueDay?: number;
  minPaymentPercent?: number;
  minPaymentAmount?: number;
}

// Satu-satunya parser payload_json rekening — dipakai service ini dan
// halaman yang membaca rekening langsung lewat onSnapshot (Rekening, Kartu
// Saya), supaya field baru tidak ketinggalan di salah satu tempat.
export const parseAccountPayload = (payloadJson: unknown): AccountPayloadFields => {
  if (typeof payloadJson !== 'string' || !payloadJson) return { creditLimit: 0 };
  try {
    const p = JSON.parse(payloadJson) as Record<string, unknown>;
    const num = (v: unknown) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? undefined : Number(v));
    return {
      cardColor: typeof p.cardColor === 'string' ? p.cardColor : undefined,
      creditLimit: Number(p.creditLimit) || 0,
      statementDay: num(p.statementDay),
      dueDay: num(p.dueDay),
      minPaymentPercent: num(p.minPaymentPercent),
      minPaymentAmount: num(p.minPaymentAmount),
    };
  } catch {
    // payload_json tidak valid JSON — abaikan.
    return { creditLimit: 0 };
  }
};

// Field siklus tagihan untuk dikirim ke API (null = hapus pengaturan).
const cycleFieldsForApi = (data: Partial<Account>) => ({
  ...('statementDay' in data ? { statement_day: data.statementDay ?? null } : {}),
  ...('dueDay' in data ? { due_day: data.dueDay ?? null } : {}),
  ...('minPaymentPercent' in data ? { min_payment_percent: data.minPaymentPercent ?? null } : {}),
  ...('minPaymentAmount' in data ? { min_payment_amount: data.minPaymentAmount ?? null } : {}),
});

export const accountService = {
  async createAccount(data: Omit<Account, 'id' | 'createdAt'>) {
    const result = await cloudflareApi<{ id: string }>('/api/member/accounts', {
      method: 'POST',
      json: {
        name: data.name,
        type: data.type,
        currency: data.currency,
        balance: Number(data.balance) || 0,
        initial_balance: Number(data.initialBalance) || 0,
        base_value: Number(data.baseValue) || 0,
        credit_limit: Number(data.creditLimit) || 0,
        logo_url: data.logoUrl || null,
        logo_label: data.logoLabel || null,
        ...(data.cardColor ? { card_color: data.cardColor } : {}),
        ...cycleFieldsForApi(data),
      },
    });
    notifyCollectionChanged('accounts');
    return result.id;
  },

  async getUserAccounts(_userId: string) {
    void _userId;
    const result = await cloudflareApi<{ items: Record<string, unknown>[] }>('/api/member/accounts');
    return result.items.map((data) => {
      const extra = parseAccountPayload(data.payload_json);
      return {
        ...data,
        id: String(data.id ?? ''),
        userId: String(data.user_id ?? ''),
        initialBalance: Number(data.initial_balance) || 0,
        baseValue: Number(data.base_value) || 0,
        ...extra,
        logoUrl: (data.logo_url as string | undefined) ?? undefined,
        logoLabel: (data.logo_label as string | undefined) ?? undefined,
        sortOrder: Number(data.sort_order) || 0,
        createdAt: data.created_at ? new Date(String(data.created_at)) : new Date(),
      } as Account;
    });
  },

  async updateAccount(id: string, data: Partial<Omit<Account, 'id' | 'createdAt'>>) {
    await cloudflareApi(`/api/member/accounts/${id}`, {
      method: 'PUT',
      json: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.type ? { type: data.type } : {}),
        ...(data.currency ? { currency: data.currency } : {}),
        ...(typeof data.balance === 'number' ? { balance: data.balance } : {}),
        ...(typeof data.initialBalance === 'number' ? { initial_balance: data.initialBalance } : {}),
        ...(typeof data.baseValue === 'number' ? { base_value: data.baseValue } : {}),
        ...(typeof data.creditLimit === 'number' ? { credit_limit: data.creditLimit } : {}),
        ...(data.logoUrl !== undefined ? { logo_url: data.logoUrl } : {}),
        ...(data.logoLabel !== undefined ? { logo_label: data.logoLabel } : {}),
        ...(data.cardColor !== undefined ? { card_color: data.cardColor } : {}),
        ...cycleFieldsForApi(data),
      },
    });
    notifyCollectionChanged('accounts');
  },

  async deleteAccount(id: string) {
    await cloudflareApi(`/api/member/accounts/${id}`, { method: 'DELETE' });
    notifyCollectionChanged('accounts');
  },

  async updateAccountBalance(id: string, amountChange: number) {
    await cloudflareApi(`/api/member/accounts/${id}/balance`, {
      method: 'POST',
      json: {
        delta: amountChange,
      },
    });
    notifyCollectionChanged('accounts');
  },

  // Simpan urutan baru hasil drag-and-drop sekaligus — index tiap id di array
  // jadi sort_order barunya. Order ini dipakai di semua halaman/dropdown yang
  // menampilkan daftar rekening (bukan cuma di Kartu Saya).
  async reorderAccounts(ids: string[]) {
    await cloudflareApi('/api/member/accounts/reorder', {
      method: 'PUT',
      json: { ids },
    });
    notifyCollectionChanged('accounts');
  }
};
