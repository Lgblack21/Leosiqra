import { cloudflareApi } from '../cloudflare-api';
import { notifyCollectionChanged } from '../cf-firestore';

// Usahaku › jenis Pinjaman (Worker /api/member/shops/:id/pinjaman, migrasi 0048).
// Uang lewat buku usaha (kas): pinjam_cair (kas −), pinjam_admin (kas +), angsuran (kas +).

export type Borrower = { id: string; name: string; wa: string | null; note: string | null; archived: boolean };
export type Loan = {
  id: string;
  borrowerId: string;
  principal: number;
  adminFee: number;
  adminMode: 'potong' | 'terpisah';
  installment: number;
  count: number;
  total: number;
  frequency: 'harian' | 'mingguan';
  disbursedOn: string;
  dueDates: string[];
  accountId: string | null;
  status: 'aktif' | 'lunas';
  note: string | null;
  createdAt: string;
  closedAt: string | null;
  paid: number;
  lastPaid: string | null;
};
export type LoanPayment = { id: string; loanId: string; date: string; amount: number; accountId: string | null; createdAt: string };
export type LoanBook = { today: string; borrowers: Borrower[]; loans: Loan[]; payments: LoanPayment[] };

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : null);
const num = (v: unknown) => Number(v) || 0;
const loanFromRow = (r: Row): Loan => {
  let dueDates: string[] = [];
  try {
    const v = JSON.parse(String(r.due_dates_json ?? '[]'));
    if (Array.isArray(v)) dueDates = v.filter((d): d is string => typeof d === 'string');
  } catch {
    /* jadwal rusak → kosong */
  }
  return {
    id: String(r.id),
    borrowerId: String(r.borrower_id),
    principal: num(r.principal),
    adminFee: num(r.admin_fee),
    adminMode: r.admin_mode === 'terpisah' ? 'terpisah' : 'potong',
    installment: num(r.installment),
    count: num(r.count),
    total: num(r.total),
    frequency: r.frequency === 'mingguan' ? 'mingguan' : 'harian',
    disbursedOn: String(r.disbursed_on ?? ''),
    dueDates,
    accountId: str(r.account_id),
    status: r.status === 'lunas' ? 'lunas' : 'aktif',
    note: str(r.note),
    createdAt: String(r.created_at ?? ''),
    closedAt: str(r.closed_at),
    paid: num(r.paid),
    lastPaid: str(r.last_paid),
  };
};
const changed = () => notifyCollectionChanged('shop_book');

export const shopLoanService = {
  async get(shopId: string): Promise<LoanBook> {
    const r = await cloudflareApi<Row>(`/api/member/shops/${shopId}/pinjaman`);
    return {
      today: String(r.today ?? ''),
      borrowers: ((r.borrowers as Row[]) ?? []).map((b) => ({
        id: String(b.id),
        name: String(b.name ?? ''),
        wa: str(b.wa),
        note: str(b.note),
        archived: Boolean(b.archived_at),
      })),
      loans: ((r.loans as Row[]) ?? []).map(loanFromRow),
      payments: ((r.payments as Row[]) ?? []).map((p) => ({
        id: String(p.id),
        loanId: String(p.ref_id ?? ''),
        date: String(p.date ?? ''),
        amount: num(p.amount),
        accountId: str(p.account_id),
        createdAt: String(p.created_at ?? ''),
      })),
    };
  },
  async addBorrower(shopId: string, input: { name: string; wa?: string; note?: string }) {
    const r = await cloudflareApi<{ id: string }>(`/api/member/shops/${shopId}/pinjaman/peminjam`, { method: 'POST', json: input });
    changed();
    return r.id;
  },
  async updateBorrower(shopId: string, id: string, input: { name: string; wa?: string; note?: string }) {
    await cloudflareApi(`/api/member/shops/${shopId}/pinjaman/peminjam/${id}`, { method: 'PUT', json: input });
    changed();
  },
  async archiveBorrower(shopId: string, id: string) {
    await cloudflareApi(`/api/member/shops/${shopId}/pinjaman/peminjam/${id}`, { method: 'DELETE' });
    changed();
  },
  async createLoan(
    shopId: string,
    input: {
      requestId: string;
      borrowerId: string;
      principal: number;
      adminFee: number;
      adminMode: 'potong' | 'terpisah';
      installment: number;
      count: number;
      frequency: 'harian' | 'mingguan';
      date: string;
      dueDates: string[];
      accountId: string;
      note?: string;
    },
  ) {
    const r = await cloudflareApi<{ id: string; handed: number }>(`/api/member/shops/${shopId}/pinjaman/loans`, {
      method: 'POST',
      json: {
        request_id: input.requestId,
        borrower_id: input.borrowerId,
        principal: input.principal,
        admin_fee: input.adminFee,
        admin_mode: input.adminMode,
        installment: input.installment,
        count: input.count,
        frequency: input.frequency,
        date: input.date,
        due_dates: input.dueDates,
        shop_account_id: input.accountId,
        note: input.note,
      },
    });
    changed();
    return r;
  },
  async pay(shopId: string, loanId: string, input: { requestId: string; amount: number; accountId: string; date?: string }) {
    const r = await cloudflareApi<{ id: string; lunas: boolean }>(`/api/member/shops/${shopId}/pinjaman/loans/${loanId}/pay`, {
      method: 'POST',
      json: { request_id: input.requestId, amount: input.amount, shop_account_id: input.accountId, date: input.date },
    });
    changed();
    return r;
  },
  async removeLoan(shopId: string, loanId: string) {
    await cloudflareApi(`/api/member/shops/${shopId}/pinjaman/loans/${loanId}`, { method: 'DELETE' });
    changed();
  },
};
