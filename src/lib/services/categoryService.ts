import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  Timestamp,
  notifyCollectionChanged
} from '@/lib/cf-firestore';
import { db } from '../cf-client';
import { cloudflareApi } from '../cloudflare-api';

export interface Category {
  id?: string;
  userId: string;
  category: string;     // e.g. Makanan, Transport
  subCategory: string;  // e.g. Makan Siang, Bensin
  status: 'VERIFIED' | 'PENDING';
  // Urutan tampil subkategori di dalam grup kategorinya (drag-to-reorder di
  // halaman Nama Akun) — lebih kecil tampil lebih dulu.
  sortOrder?: number;
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
  },

  // Simpan urutan baru hasil drag-and-drop sekaligus untuk satu grup kategori
  // — index tiap id di array jadi sort_order barunya.
  async reorderCategories(ids: string[]) {
    await cloudflareApi('/api/member/categories/reorder', {
      method: 'PUT',
      json: { ids },
    });
    notifyCollectionChanged(COLLECTION_NAME);
  }
};

