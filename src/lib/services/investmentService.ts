import { cloudflareApi } from '../cloudflare-api';
import { notifyCollectionChanged } from '../cf-firestore';
import { accountService } from './accountService';
import { updateMemberTotals } from './userService';

export interface Investment {
  id?: string;
  userId: string;
  name: string;
  type: 'Saham' | 'Deposito' | 'Lainnya';
  platform: string;
  amountInvested: number;
  amountIDR?: number;
  currentValue: number;
  currentValueIDR?: number;
  returnPercentage: number;
  taxPercentage?: number;
  currency: string;
  durationMonths?: number;
  transactionType?: string;
  category?: string;
  accountId?: string;
  logoUrl?: string;
  quantity?: number;
  unit?: string;
  pricePerUnit?: number;
  stockCode?: string;
  exchangeCode?: string;
  sharesCount?: number;
  pricePerShare?: number;
  dateInvested: Date;
  targetDate?: Date;
  durationDays?: number;
  status: 'Active' | 'Closed' | 'Planned';
  // Perlakuan otomatis saat deposito jatuh tempo (dieksekusi Cron Trigger
  // harian): 'cairkan' = pokok+bunga ke rekening; 'aro_bunga' = bunga cair,
  // pokok diperpanjang; 'aro_full' = pokok+bunga digulirkan (compound).
  maturityAction?: 'cairkan' | 'aro_bunga' | 'aro_full';
  // Menghubungkan baris proyeksi "(Hasil Akhir)" balik ke baris Penempatan aslinya.
  relatedInvestmentId?: string;
  createdAt: Date;
}

export const investmentService = {
  async createInvestment(data: Omit<Investment, 'id' | 'createdAt'>) {
    const result = await cloudflareApi<{ id: string }>('/api/member/investments', {
      method: 'POST',
      json: {
        name: data.name,
        type: data.type,
        platform: data.platform,
        amount_invested: Number(data.amountInvested) || 0,
        // Kalau amountIDR/currentValueIDR tidak berhasil dihitung di klien
        // (mis. fetch kurs gagal), jangan kirim angka mentah sebagai IDR final —
        // biarkan backend hitung ulang lewat resolveIdrAmount (server-side, tidak
        // kena hambatan CORS/firewall seperti fetch dari browser).
        ...(typeof data.amountIDR === 'number' && Number.isFinite(data.amountIDR)
          ? { amount_idr: data.amountIDR }
          : {}),
        current_value: Number(data.currentValue) || 0,
        ...(typeof data.currentValueIDR === 'number' && Number.isFinite(data.currentValueIDR)
          ? { current_value_idr: data.currentValueIDR }
          : {}),
        return_percentage: Number(data.returnPercentage) || 0,
        tax_percentage: Number(data.taxPercentage) || 0,
        currency: data.currency,
        duration_months: Number(data.durationMonths) || 0,
        transaction_type: data.transactionType || null,
        category: data.category || null,
        account_id: data.accountId || null,
        logo_url: data.logoUrl || null,
        quantity: Number(data.quantity) || 0,
        unit: data.unit || null,
        price_per_unit: Number(data.pricePerUnit) || 0,
        stock_code: data.stockCode || null,
        exchange_code: data.exchangeCode || null,
        shares_count: Number(data.sharesCount) || 0,
        price_per_share: Number(data.pricePerShare) || 0,
        date_invested: data.dateInvested.toISOString(),
        target_date: data.targetDate ? data.targetDate.toISOString() : null,
        duration_days: Number(data.durationDays) || null,
        status: data.status,
        maturity_action: data.maturityAction || null,
        related_investment_id: data.relatedInvestmentId || null,
      },
    });
    notifyCollectionChanged('investments');
    return result.id;
  },

  async getUserInvestments(_userId: string) {
    void _userId;
    const result = await cloudflareApi<{ items: Record<string, unknown>[] }>('/api/member/investments');
    return result.items
      .map((data) => {
        return {
          ...data,
          id: String(data.id ?? ''),
          userId: String(data.user_id ?? ''),
          amountInvested: Number(data.amount_invested) || 0,
          amountIDR: Number(data.amount_idr) || 0,
          currentValue: Number(data.current_value) || 0,
          currentValueIDR: Number(data.current_value_idr) || 0,
          returnPercentage: Number(data.return_percentage) || 0,
          taxPercentage: Number(data.tax_percentage) || 0,
          durationMonths: Number(data.duration_months) || 0,
          transactionType: (data.transaction_type as string | undefined) ?? undefined,
          accountId: (data.account_id as string | undefined) ?? undefined,
          logoUrl: (data.logo_url as string | undefined) ?? undefined,
          pricePerUnit: Number(data.price_per_unit) || 0,
          stockCode: (data.stock_code as string | undefined) ?? undefined,
          exchangeCode: (data.exchange_code as string | undefined) ?? undefined,
          sharesCount: Number(data.shares_count) || 0,
          pricePerShare: Number(data.price_per_share) || 0,
          dateInvested: data.date_invested ? new Date(String(data.date_invested)) : new Date(),
          targetDate: data.target_date ? new Date(String(data.target_date)) : undefined,
          durationDays: Number(data.duration_days) || 0,
          maturityAction: (data.maturity_action as Investment['maturityAction']) ?? undefined,
          relatedInvestmentId: (data.related_investment_id as string | undefined) ?? undefined,
          createdAt: data.created_at ? new Date(String(data.created_at)) : new Date()
        } as Investment;
      })
      // Deposito "Penempatan" otomatis punya baris proyeksi "(Hasil Akhir)"
      // berstatus Planned (dibuat DepositModal) — bukan posisi nyata, jadi
      // dikeluarkan di sini supaya semua konsumen (Dashboard, AI Leosiqra)
      // tidak perlu ingat memfilternya sendiri-sendiri.
      .filter((inv) => inv.status !== 'Planned');
  },

  async getInvestmentsByType(userId: string, type: string) {
    const result = await cloudflareApi<{ items: Record<string, unknown>[] }>(`/api/member/investments?type=${encodeURIComponent(type)}`);
    return result.items.map((data) => ({
      ...(data as unknown as Investment),
      id: String(data.id ?? ''),
      userId: String(data.user_id ?? ''),
      amountInvested: Number(data.amount_invested) || 0,
      dateInvested: data.date_invested ? new Date(String(data.date_invested)) : new Date(),
      createdAt: data.created_at ? new Date(String(data.created_at)) : new Date(),
    }));
  },

  async updateInvestment(id: string, data: Partial<Omit<Investment, 'id' | 'createdAt'>>) {
    await cloudflareApi(`/api/member/investments/${id}`, {
      method: 'PUT',
      json: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.type ? { type: data.type } : {}),
        ...(data.platform ? { platform: data.platform } : {}),
        ...(typeof data.amountInvested === 'number' ? { amount_invested: data.amountInvested } : {}),
        ...(typeof data.amountIDR === 'number' ? { amount_idr: data.amountIDR } : {}),
        ...(typeof data.currentValue === 'number' ? { current_value: data.currentValue } : {}),
        ...(typeof data.currentValueIDR === 'number' ? { current_value_idr: data.currentValueIDR } : {}),
        ...(typeof data.returnPercentage === 'number' ? { return_percentage: data.returnPercentage } : {}),
        ...(typeof data.taxPercentage === 'number' ? { tax_percentage: data.taxPercentage } : {}),
        ...(data.currency ? { currency: data.currency } : {}),
        ...(typeof data.durationMonths === 'number' ? { duration_months: data.durationMonths } : {}),
        ...(data.transactionType !== undefined ? { transaction_type: data.transactionType } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.accountId !== undefined ? { account_id: data.accountId } : {}),
        ...(data.logoUrl !== undefined ? { logo_url: data.logoUrl } : {}),
        ...(typeof data.quantity === 'number' ? { quantity: data.quantity } : {}),
        ...(data.unit !== undefined ? { unit: data.unit } : {}),
        ...(typeof data.pricePerUnit === 'number' ? { price_per_unit: data.pricePerUnit } : {}),
        ...(data.stockCode !== undefined ? { stock_code: data.stockCode } : {}),
        ...(data.exchangeCode !== undefined ? { exchange_code: data.exchangeCode } : {}),
        ...(typeof data.sharesCount === 'number' ? { shares_count: data.sharesCount } : {}),
        ...(typeof data.pricePerShare === 'number' ? { price_per_share: data.pricePerShare } : {}),
        ...(data.dateInvested ? { date_invested: data.dateInvested.toISOString() } : {}),
        ...(data.targetDate !== undefined ? { target_date: data.targetDate ? data.targetDate.toISOString() : null } : {}),
        ...(typeof data.durationDays === 'number' ? { duration_days: data.durationDays } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.maturityAction !== undefined ? { maturity_action: data.maturityAction } : {}),
        ...(data.relatedInvestmentId !== undefined ? { related_investment_id: data.relatedInvestmentId } : {}),
      },
    });
    notifyCollectionChanged('investments');
  },

  // Balikkan dulu efek saldo/total sebelum hapus — kebalikan dari efek saat
  // posisi ini dibuat (Penempatan/Beli/Pembelian menarik saldo keluar & catat
  // investasi; Penarikan/Jual/Penjualan/Bunga mengembalikan saldo & catat
  // pemasukan). Baris proyeksi ("Hasil Deposito", dll) tidak punya efek nyata.
  async hardDeleteInvestment(inv: Investment) {
    if (!inv.id) return;
    const invested = Number(inv.amountInvested) || 0;
    const current = Number(inv.currentValue) || 0;
    const isOutflow = inv.transactionType === 'Penempatan' || inv.transactionType === 'Beli' || inv.transactionType === 'Pembelian';
    const isInflow = inv.transactionType === 'Penarikan' || inv.transactionType === 'Jual' || inv.transactionType === 'Penjualan' || inv.transactionType === 'Bunga';

    try {
      if (isOutflow && inv.accountId && inv.accountId !== 'General') {
        await accountService.updateAccountBalance(inv.accountId, invested);
        await updateMemberTotals(inv.userId, 'pengeluaran', -invested);
        await updateMemberTotals(inv.userId, 'investasi', -invested);
      } else if (isInflow && inv.accountId && inv.accountId !== 'General') {
        await accountService.updateAccountBalance(inv.accountId, -current);
        await updateMemberTotals(inv.userId, 'pemasukan', -current);
        // Jual/Penjualan mencatat modal (cost basis) di amountInvested — kembalikan ke total investasi.
        if (inv.transactionType === 'Jual' || inv.transactionType === 'Penjualan') {
          await updateMemberTotals(inv.userId, 'investasi', invested);
        }
      }
    } catch (e) {
      console.error('Gagal membalikkan saldo sebelum hapus investasi:', e);
    }

    await cloudflareApi(`/api/member/investments/${inv.id}`, { method: 'DELETE' });
    notifyCollectionChanged('investments');
  },

  // Harga live saham (via proksi Yahoo Finance di backend, lihat handleStockPrice).
  async getStockPrice(symbol: string, exchangeCode: string) {
    return cloudflareApi<{ price: number; currency: string; changePercent: number }>(
      `/api/member/stock-price?symbol=${encodeURIComponent(symbol)}&exchange=${encodeURIComponent(exchangeCode || 'IDX')}`
    );
  },

  // Cari kode saham (via proksi Yahoo Finance di backend, lihat handleStockSearch)
  // untuk combobox "Kode Saham" — auto-isi nama/bursa/logo saat dipilih.
  async searchStocks(q: string) {
    const res = await cloudflareApi<{ items: StockSearchResult[] }>(
      `/api/member/stock-search?q=${encodeURIComponent(q)}`
    );
    return res.items;
  }
};

export interface StockSearchResult {
  symbol: string;
  name: string;
  exchangeCode: string;
  logoUrl: string;
}
