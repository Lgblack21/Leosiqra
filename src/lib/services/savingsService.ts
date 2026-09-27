import {
  collection, getDocs, query, orderBy, notifyCollectionChanged
} from '@/lib/cf-firestore';
import { db } from '../cf-client';
import { cloudflareApi } from '../cloudflare-api';

export interface Saving {
  id?: string;
  userId: string;
  description: string;
  amount: number;
  amountIDR?: number;
  currency: string;
  category: string;  // 'Dana Darurat', 'Liburan', dll
  subCategory?: string;
  fromAccount: string;
  toGoal: string;
  // 'Setoran' (default) = dana masuk ke pos tabungan, keluar dari fromAccount;
  // 'Penarikan' = dana ditarik dari pos tabungan, kembali ke fromAccount.
  transactionType?: 'Setoran' | 'Penarikan';
  date: Date;
  displayDate?: string;
  createdAt: Date;
}

const COLLECTION_NAME = 'savings';

export const savingsService = {
  // Simpan setoran/penarikan + ubah saldo rekening sumber dalam satu batch
  // atomik di server (apply_balance) — dulu dua request terpisah, jadi kalau
  // yang kedua gagal setoran tercatat tapi saldo tidak berubah.
  async createSaving(data: Omit<Saving, 'id' | 'createdAt' | 'userId'> & { userId?: string }) {
    // Kalau amountIDR tidak berhasil dihitung di klien (mis. fetch kurs gagal),
    // jangan kirim amount mentah sebagai IDR final — biarkan backend hitung
    // ulang lewat resolveIdrAmount.
    const { amountIDR } = data;
    const result = await cloudflareApi<{ id: string }>('/api/member/savings', {
      method: 'POST',
      json: {
        description: data.description,
        amount: data.amount,
        ...(typeof amountIDR === 'number' && Number.isFinite(amountIDR) ? { amount_idr: amountIDR } : {}),
        currency: data.currency,
        category: data.category,
        sub_category: data.subCategory ?? null,
        from_account: data.fromAccount,
        to_goal: data.toGoal,
        transaction_type: data.transactionType ?? 'Setoran',
        date: data.date.toISOString(),
        display_date: data.displayDate,
        apply_balance: true,
      },
    });
    notifyCollectionChanged('savings');
    notifyCollectionChanged('accounts');
    return result.id;
  },

  async getUserSavings(_userId: string) {
    void _userId;
    // /api/member/savings (dipanggil lewat readApiCollection di cf-firestore)
    // sudah di-scope ke user sesi yang login di backend — filter where('userId')
    // di sini cuma akan cocok kalau caller kebetulan mengoper UID asli yang
    // sama persis, dan diam-diam mengembalikan array kosong kalau dioper
    // placeholder seperti 'session' (konvensi dipakai getUserTransactions/
    // getUserInvestments). Makanya di sini query-nya dibiarkan tanpa filter
    // userId, konsisten dengan cara service lain menangani ini.
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('date', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        date: data.date?.toDate?.() ?? new Date(),
        createdAt: data.createdAt?.toDate?.() ?? new Date()
      } as Saving;
    });
  },

  // Hapus + balikkan saldo rekening sumber secara atomik di server (?reverse=1).
  async deleteSaving(saving: Saving) {
    if (!saving.id) return;
    await cloudflareApi(`/api/member/savings/${saving.id}?reverse=1`, { method: 'DELETE' });
    notifyCollectionChanged('savings');
    notifyCollectionChanged('accounts');
  }
};

