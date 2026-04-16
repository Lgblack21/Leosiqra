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

export interface Budget {
  id?: string;
  userId: string;
  type: 'pemasukan' | 'pengeluaran';
  category: string;
  amount: number;
  period: 'monthly' | 'yearly';
  createdAt: Date;
}

const COLLECTION_NAME = 'budgets';

export const budgetService = {
  async createBudget(data: Omit<Budget, 'id' | 'createdAt'>) {
    const ref = collection(db, COLLECTION_NAME);
    const newDoc = await addDoc(ref, {
      ...data,
      createdAt: Timestamp.now()
    });
    return newDoc.id;
  },

  async getUserBudgets(userId: string) {
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
        createdAt: data.createdAt.toDate()
      } as Budget;
    });
  },

  async updateBudget(id: string, data: Partial<Omit<Budget, 'id' | 'createdAt'>>) {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, data);
  },

  async deleteBudget(id: string) {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  }
};
