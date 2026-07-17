import { 
  collection, doc, addDoc, deleteDoc,
  getDocs, query, where, orderBy, Timestamp 
} from '@/lib/cf-firestore';
import { db } from '../cf-client';

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

  async getUserSavings(userId: string) {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', userId),
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

  async deleteSaving(id: string) {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  }
};

