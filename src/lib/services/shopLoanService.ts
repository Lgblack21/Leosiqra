import { cloudflareApi } from '../cloudflare-api';

// Akun pemilik → /api/member/shops; akun tim Petugas (/tim) → /api/staff/shops (izin terbatas di Worker).
let ROOT = '/api/member/shops';
export const setLoanApiRoot = (root: '/api/member/shops' | '/api/staff/shops') => {
  ROOT = root;
};
import { notifyCollectionChanged } from '../cf-firestore';

// Usahaku › jenis Pinjaman (Worker /api/member/shops/:id/pinjaman, migrasi 0048).
// Uang lewat buku usaha (kas): pinjam_cair (kas −), pinjam_admin (kas +), angsuran (kas +).

export type Borrower = {
  id: string;
  name: string;
  wa: string | null;
  note: string | null;
  archived: boolean;
  /** Anggota (migrasi 0049). registered = sudah daftar lengkap & setuju → boleh diberi pinjaman. */
  memberNo: string | null;
  address: string | null;
  job: string | null;
  registered: boolean;
  registeredAt: string | null;
  hasPhoto: boolean;
  hasKtp: boolean;
  updatedAt: string;
};
export type MemberFile = 'foto' | 'ktp';
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
  /** Jaminan (opsional, migrasi 0049). Foto privat — hanya jumlahnya yang dikirim. */
  collateral: Collateral | null;
};
export type Collateral = { jenis: string; ket: string; nilai: number | null; photoCount: number; returnedAt: string | null };
export const JENIS_JAMINAN: [string, string][] = [
  ['bpkb_motor', 'BPKB motor'],
  ['bpkb_mobil', 'BPKB mobil'],
  ['sertifikat', 'Sertifikat tanah/rumah'],
  ['elektronik', 'Barang elektronik'],
  ['emas', 'Emas / perhiasan'],
  ['lainnya', 'Lainnya'],
];
export type LoanPayment = { id: string; loanId: string; date: string; amount: number; accountId: string | null; createdAt: string };
export type LoanReportRow = Loan & { borrowerName: string; borrowerWa: string | null; paidBefore: number; paidTo: number };
export type LoanReport = { range: { from: string; to: string }; today: string; loans: LoanReportRow[]; payments: LoanPayment[]; truncated: boolean };
export type LoanBook = { today: string; memberReady: boolean; collateralReady: boolean; loadedAt: number; borrowers: Borrower[]; loans: Loan[]; payments: LoanPayment[] };

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
    collateral:
      r.collateral && typeof r.collateral === 'object'
        ? (() => {
            const c = r.collateral as Row;
            return { jenis: String(c.jenis ?? 'lainnya'), ket: String(c.ket ?? ''), nilai: c.nilai ? num(c.nilai) : null, photoCount: num(c.photoCount), returnedAt: str(c.returnedAt) };
          })()
        : null,
  };
};
const changed = () => notifyCollectionChanged('shop_book');

export const shopLoanService = {
  async get(shopId: string): Promise<LoanBook> {
    const r = await cloudflareApi<Row>(`${ROOT}/${shopId}/pinjaman`);
    return {
      today: String(r.today ?? ''),
      memberReady: Boolean(r.memberReady),
      collateralReady: Boolean(r.collateralReady),
      loadedAt: Date.now(),
      borrowers: ((r.borrowers as Row[]) ?? []).map((b) => ({
        id: String(b.id),
        name: String(b.name ?? ''),
        wa: str(b.wa),
        note: str(b.note),
        archived: Boolean(b.archived_at),
        memberNo: str(b.member_no),
        address: str(b.address),
        job: str(b.job),
        registered: Boolean(b.registered_at && b.member_no),
        registeredAt: str(b.registered_at),
        hasPhoto: Boolean(b.has_photo),
        hasKtp: Boolean(b.has_ktp),
        updatedAt: String(b.updated_at ?? b.created_at ?? ''),
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
  async laporan(shopId: string, range: { from: string; to: string } | null): Promise<LoanReport> {
    const q = range ? `?from=${range.from}&to=${range.to}` : '';
    const r = await cloudflareApi<Row>(`${ROOT}/${shopId}/pinjaman/laporan${q}`);
    const rg = (r.range as { from: string; to: string }) ?? { from: '', to: '' };
    return {
      range: rg,
      today: String(r.today ?? ''),
      truncated: Boolean(r.truncated),
      loans: ((r.loans as Row[]) ?? []).map((x) => ({
        ...loanFromRow(x),
        paid: num(x.paid_to),
        borrowerName: String(x.borrower_name ?? 'Peminjam'),
        borrowerWa: str(x.borrower_wa),
        paidBefore: num(x.paid_before),
        paidTo: num(x.paid_to),
      })),
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
  /** Foto diri / KTP anggota (R2 privat, hanya pemilik yang login). v = penanda versi supaya tidak pakai cache lama. */
  memberFileUrl: (shopId: string, b: Pick<Borrower, 'id' | 'updatedAt'>, kind: MemberFile) =>
    `${ROOT}/${shopId}/pinjaman/peminjam/${b.id}/${kind}?v=${encodeURIComponent(b.updatedAt)}`,
  async uploadMemberFile(shopId: string, id: string, kind: MemberFile, imageBase64: string) {
    await cloudflareApi(`${ROOT}/${shopId}/pinjaman/peminjam/${id}/${kind}`, { method: 'PUT', json: { imageBase64 } });
    changed();
  },
  async register(shopId: string, id: string) {
    const r = await cloudflareApi<{ member_no: string | null }>(`${ROOT}/${shopId}/pinjaman/peminjam/${id}/daftar`, {
      method: 'POST',
      json: { consent: true },
    });
    changed();
    return r.member_no;
  },
  async addBorrower(shopId: string, input: { name: string; wa?: string; note?: string; address?: string; job?: string }) {
    const r = await cloudflareApi<{ id: string }>(`${ROOT}/${shopId}/pinjaman/peminjam`, { method: 'POST', json: input });
    changed();
    return r.id;
  },
  async updateBorrower(shopId: string, id: string, input: { name: string; wa?: string; note?: string; address?: string; job?: string }) {
    await cloudflareApi(`${ROOT}/${shopId}/pinjaman/peminjam/${id}`, { method: 'PUT', json: input });
    changed();
  },
  async archiveBorrower(shopId: string, id: string) {
    await cloudflareApi(`${ROOT}/${shopId}/pinjaman/peminjam/${id}`, { method: 'DELETE' });
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
      collateral?: { jenis: string; ket: string; nilai: number | null };
    },
  ) {
    const r = await cloudflareApi<{ id: string; handed: number }>(`${ROOT}/${shopId}/pinjaman/loans`, {
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
        collateral: input.collateral,
      },
    });
    changed();
    return r;
  },
  async pay(shopId: string, loanId: string, input: { requestId: string; amount: number; accountId: string; date?: string }) {
    const r = await cloudflareApi<{ id: string; lunas: boolean }>(`${ROOT}/${shopId}/pinjaman/loans/${loanId}/pay`, {
      method: 'POST',
      json: { request_id: input.requestId, amount: input.amount, shop_account_id: input.accountId, date: input.date },
    });
    changed();
    return r;
  },
  async reschedule(shopId: string, loanId: string, input: { dueDates: string[]; expectedPaid: number }) {
    await cloudflareApi(`${ROOT}/${shopId}/pinjaman/loans/${loanId}/jadwal`, {
      method: 'PUT',
      json: { due_dates: input.dueDates, expected_paid: input.expectedPaid },
    });
    changed();
  },
  collateralPhotoUrl: (shopId: string, loanId: string, n: number, v: number) =>
    `${ROOT}/${shopId}/pinjaman/loans/${loanId}/jaminan/foto/${n}?v=${v}`,
  async saveCollateral(shopId: string, loanId: string, c: { jenis: string; ket: string; nilai: number | null }) {
    await cloudflareApi(`${ROOT}/${shopId}/pinjaman/loans/${loanId}/jaminan`, { method: 'PUT', json: c });
    changed();
  },
  async removeCollateral(shopId: string, loanId: string) {
    await cloudflareApi(`${ROOT}/${shopId}/pinjaman/loans/${loanId}/jaminan`, { method: 'DELETE' });
    changed();
  },
  async uploadCollateralPhoto(shopId: string, loanId: string, n: number, imageBase64: string) {
    await cloudflareApi(`${ROOT}/${shopId}/pinjaman/loans/${loanId}/jaminan/foto/${n}`, { method: 'PUT', json: { imageBase64 } });
    changed();
  },
  async deleteCollateralPhoto(shopId: string, loanId: string, n: number) {
    await cloudflareApi(`${ROOT}/${shopId}/pinjaman/loans/${loanId}/jaminan/foto/${n}`, { method: 'DELETE' });
    changed();
  },
  async returnCollateral(shopId: string, loanId: string, undo = false) {
    await cloudflareApi(`${ROOT}/${shopId}/pinjaman/loans/${loanId}/jaminan/kembali`, { method: 'POST', json: { undo } });
    changed();
  },
  async removeLoan(shopId: string, loanId: string) {
    await cloudflareApi(`${ROOT}/${shopId}/pinjaman/loans/${loanId}`, { method: 'DELETE' });
    changed();
  },
};
