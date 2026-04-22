import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  where, 
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';

export interface RecurringTransaction {
  id?: string;
  userId: string;
  name: string;
  type: 'Pemasukan' | 'Pengeluaran' | 'Transfer';
  category: string;
  accountId: string;
  amount: number;
  interval: 'Harian' | 'Mingguan' | 'Bulanan' | 'Tahunan';
  nextDate: Date;
  note?: string;
  status: 'ACTIVE' | 'PAUSED';
  createdAt: Date;
}

const COLLECTION_NAME = 'recurring';

export const recurringService = {
  async createRecurring(data: Omit<RecurringTransaction, 'id' | 'createdAt'>) {
    const ref = collection(db, COLLECTION_NAME);
    const newDoc = await addDoc(ref, {
      ...data,
      nextDate: Timestamp.fromDate(data.nextDate),
      createdAt: Timestamp.now()
    });
    return newDoc.id;
  },

  async getUserRecurring(userId: string) {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', userId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        nextDate: data.nextDate.toDate(),
        createdAt: data.createdAt.toDate()
      } as RecurringTransaction;
    });
  },

  async updateRecurring(id: string, data: Partial<Omit<RecurringTransaction, 'id' | 'createdAt'>>) {
    const docRef = doc(db, COLLECTION_NAME, id);
    const updates: any = { ...data };
    if (data.nextDate) updates.nextDate = Timestamp.fromDate(data.nextDate);
    await updateDoc(docRef, updates);
  },

  async deleteRecurring(id: string) {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  }
};
