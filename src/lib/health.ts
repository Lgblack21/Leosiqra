import { cloudflareApi } from '@/lib/cloudflare-api';

// Sehatku › Asuransi (Worker: /api/member/health/*, migrasi 0038).

export type PolicyKind = 'kesehatan' | 'jiwa' | 'kritis' | 'kantor' | 'lainnya';
export type PolicyPeriod = 'bulanan' | 'triwulan' | 'semester' | 'tahunan' | 'sekali';
export type ClaimStatus = 'diajukan' | 'disetujui' | 'ditolak' | 'cair';

export type Policy = {
  id: string;
  insurer_key: string | null;
  insurer_name: string;
  kind: PolicyKind;
  product: string | null;
  policy_no: string | null;
  premium: number | null;
  period: PolicyPeriod;
  next_due: string | null;
  coverage: number | null;
  account_id: string | null;
  call_center: string | null;
  claim_note: string | null;
  hospitals_note: string | null;
  note: string | null;
  updated_at: string;
};
export type Claim = {
  id: string;
  policy_id: string | null;
  title: string;
  amount: number;
  approved_amount: number | null;
  status: ClaimStatus;
  submitted_at: string;
  paid_at: string | null;
  note: string | null;
  recorded: number;
  insurer_name: string | null;
};
export type HealthSummary = {
  ready: boolean;
  year: string;
  today: string;
  costs: {
    total: number;
    bySub: { sub: string; total: number }[];
    byMonth: number[];
    recent: { id: string; amount: number; sub: string | null; note: string | null; date: string }[];
  };
  policies: Policy[];
  claims: Claim[];
  accounts: { id: string; name: string }[];
};
export type PolicyInput = Partial<Omit<Policy, 'id' | 'updated_at'>>;

export const POLICY_KINDS: { id: PolicyKind; label: string }[] = [
  { id: 'kesehatan', label: 'Kesehatan' },
  { id: 'jiwa', label: 'Jiwa' },
  { id: 'kritis', label: 'Penyakit kritis' },
  { id: 'kantor', label: 'Dari kantor' },
  { id: 'lainnya', label: 'Lainnya' },
];
export const PERIODS: { id: PolicyPeriod; label: string; perYear: number }[] = [
  { id: 'bulanan', label: 'Bulanan', perYear: 12 },
  { id: 'triwulan', label: 'Per 3 bulan', perYear: 4 },
  { id: 'semester', label: 'Per 6 bulan', perYear: 2 },
  { id: 'tahunan', label: 'Tahunan', perYear: 1 },
  { id: 'sekali', label: 'Sekali bayar', perYear: 0 },
];
export const COST_SUBS = ['Obat', 'Dokter', 'Rumah Sakit', 'Lab', 'Asuransi', 'Lainnya'] as const;
export const CLAIM_STEPS: { id: ClaimStatus; label: string }[] = [
  { id: 'diajukan', label: 'Diajukan' },
  { id: 'disetujui', label: 'Disetujui' },
  { id: 'cair', label: 'Cair' },
];

export const daysUntil = (date: string, today: string) =>
  Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);

export const healthService = {
  summary: (year?: string) =>
    cloudflareApi<HealthSummary>(`/api/member/health/summary${year ? `?year=${year}` : ''}`, { cache: 'no-store' }),
  addCost: (body: {
    request_id: string;
    amount: number;
    sub: string;
    note: string;
    account_id: string;
    date: string;
  }) => cloudflareApi<{ ok: true; tx_id?: string }>('/api/member/health/costs', { method: 'POST', json: body }),
  addPolicy: (body: PolicyInput) =>
    cloudflareApi<{ ok: true; id: string }>('/api/member/health/policies', { method: 'POST', json: body }),
  updatePolicy: (id: string, body: PolicyInput) =>
    cloudflareApi<{ ok: true }>(`/api/member/health/policies/${id}`, { method: 'PATCH', json: body }),
  removePolicy: (id: string) => cloudflareApi<{ ok: true }>(`/api/member/health/policies/${id}`, { method: 'DELETE' }),
  payPremium: (id: string, body: { request_id: string; account_id: string; amount: number }) =>
    cloudflareApi<{ ok: true; next_due?: string | null; duplicate?: boolean }>(
      `/api/member/health/policies/${id}/pay`,
      {
        method: 'POST',
        json: body,
      },
    ),
  addClaim: (body: { title: string; amount: number; policy_id: string | null; submitted_at: string; note: string }) =>
    cloudflareApi<{ ok: true; id: string }>('/api/member/health/claims', { method: 'POST', json: body }),
  updateClaim: (
    id: string,
    body: { status?: ClaimStatus; approved_amount?: number | null; account_id?: string | null; note?: string },
  ) => cloudflareApi<{ ok: true; tx_id?: string }>(`/api/member/health/claims/${id}`, { method: 'PATCH', json: body }),
  removeClaim: (id: string) =>
    cloudflareApi<{ ok: true; tx_kept: boolean }>(`/api/member/health/claims/${id}`, { method: 'DELETE' }),
};
