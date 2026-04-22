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
    const newDoc = await addDoc(ref, {
      ...data,
      amountIDR: data.amountIDR || data.amount || 0,
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
        date: data.date.toDate(),
        createdAt: data.createdAt.toDate()
      } as Saving;
    });
  },

  async deleteSaving(id: string) {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  }
};

