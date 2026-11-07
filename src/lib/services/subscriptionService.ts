import { cloudflareApi } from '../cloudflare-api';
import { notifyCollectionChanged } from '../cf-firestore';
import type { Subscription, SubStatus } from '@/lib/subscriptions';
import type { SubCategory, SubCycle } from '@/lib/subscriptionCatalog';

// Langgananku — /api/member/subscriptions (Worker, migrasi 0024).
type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
const fromRow = (r: Row): Subscription => ({
  id: String(r.id),
  name: String(r.name ?? ''),
  serviceKey: str(r.service_key),
  domain: str(r.domain),
  category: (str(r.category) ?? 'Lainnya') as SubCategory,
  amount: Number(r.amount) || 0,
  currency: str(r.currency) ?? 'IDR',
  cycle: (str(r.cycle) ?? 'bulanan') as SubCycle,
  anchorDate: String(r.anchor_date ?? ''),
  accountId: str(r.account_id),
  status: (str(r.status) ?? 'aktif') as SubStatus,
  trialEnd: str(r.trial_end),
  note: str(r.note),
  createdAt: String(r.created_at ?? ''),
});

export type SubInput = {
  name: string;
  serviceKey?: string | null;
  domain?: string | null;
  category: SubCategory;
  amount: number;
  cycle: SubCycle;
  anchorDate: string;
  accountId?: string | null;
  status?: SubStatus;
  trialEnd?: string | null;
  note?: string;
};

const toBody = (i: Partial<SubInput>) => ({
  ...(i.name !== undefined ? { name: i.name } : {}),
  ...(i.serviceKey !== undefined ? { service_key: i.serviceKey } : {}),
  ...(i.domain !== undefined ? { domain: i.domain } : {}),
  ...(i.category !== undefined ? { category: i.category } : {}),
  ...(i.amount !== undefined ? { amount: i.amount } : {}),
  ...(i.cycle !== undefined ? { cycle: i.cycle } : {}),
  ...(i.anchorDate !== undefined ? { anchor_date: i.anchorDate } : {}),
  ...(i.accountId !== undefined ? { account_id: i.accountId } : {}),
  ...(i.status !== undefined ? { status: i.status } : {}),
  ...(i.trialEnd !== undefined ? { trial_end: i.trialEnd } : {}),
  ...(i.note !== undefined ? { note: i.note } : {}),
});

export const subscriptionService = {
  async list(): Promise<Subscription[]> {
    const res = await cloudflareApi<{ items: Row[] }>('/api/member/subscriptions');
    return (res.items ?? []).map(fromRow);
  },
  async create(input: SubInput): Promise<string> {
    const res = await cloudflareApi<{ id: string }>('/api/member/subscriptions', {
      method: 'POST',
      json: toBody(input),
    });
    notifyCollectionChanged('subscriptions');
    return res.id;
  },
  async update(id: string, input: Partial<SubInput>) {
    await cloudflareApi(`/api/member/subscriptions/${id}`, { method: 'PUT', json: toBody(input) });
    notifyCollectionChanged('subscriptions');
  },
  async remove(id: string) {
    await cloudflareApi(`/api/member/subscriptions/${id}`, { method: 'DELETE' });
    notifyCollectionChanged('subscriptions');
  },
};
