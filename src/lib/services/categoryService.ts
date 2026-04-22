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
} from '@/lib/cf-firestore';
import { db } from '../cf-client';

export interface Category {
  id?: string;
  userId: string;
  category: string;     // e.g. Makanan, Transport
  subCategory: string;  // e.g. Makan Siang, Bensin
  status: 'VERIFIED' | 'PENDING';
  createdAt: Date;
}

const COLLECTION_NAME = 'categories';

export const categoryService = {
  async createCategory(data: Omit<Category, 'id' | 'createdAt'>) {
    const ref = collection(db, COLLECTION_NAME);
    const newDoc = await addDoc(ref, {
      ...data,
      createdAt: Timestamp.now()
    });
    return newDoc.id;
  },

  async getUserCategories(userId: string) {
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
        createdAt: data.createdAt?.toDate?.() ?? new Date()
      } as Category;
    });
  },

  async updateCategory(id: string, data: Partial<Omit<Category, 'id' | 'createdAt'>>) {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, data);
  },

  async deleteCategory(id: string) {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  }
};

