import {
  collection, doc, addDoc, deleteDoc,
  getDocs, query, orderBy, Timestamp
} from '@/lib/cf-firestore';
import { db } from '../cf-client';
import { accountService } from './accountService';

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
  async createSaving(data: Omit<Saving, 'id' | 'createdAt'>) {
    const ref = collection(db, COLLECTION_NAME);
    // Kalau amountIDR tidak berhasil dihitung di klien (mis. fetch kurs gagal),
    // jangan kirim amount mentah sebagai IDR final — biarkan backend hitung
    // ulang lewat resolveIdrAmount (server-side, tidak kena hambatan
    // CORS/firewall seperti fetch dari browser).
    const { amountIDR, ...rest } = data;
    const newDoc = await addDoc(ref, {
      ...rest,
      ...(typeof amountIDR === 'number' && Number.isFinite(amountIDR) ? { amountIDR } : {}),
      date: Timestamp.fromDate(data.date),
      createdAt: Timestamp.now()
    });
    return newDoc.id;
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

  // Balikkan saldo rekening dulu sebelum hapus — kebalikan dari efek saat dibuat.
  async deleteSaving(saving: Saving) {
    if (saving.fromAccount && saving.fromAccount !== 'General') {
      try {
        const amount = Number(saving.amount) || 0;
        const balanceDelta = saving.transactionType === 'Penarikan' ? -amount : amount;
        await accountService.updateAccountBalance(saving.fromAccount, balanceDelta);
      } catch (e) {
        console.error('Gagal membalikkan saldo sebelum hapus setoran:', e);
      }
    }
    if (!saving.id) return;
    await deleteDoc(doc(db, COLLECTION_NAME, saving.id));
  }
};

