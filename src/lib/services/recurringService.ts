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
import { cloudflareApi } from '../cloudflare-api';
import type { RecurringInterval } from '../recurringIntervals';

export interface RecurringTransaction {
  id?: string;
  userId: string;
  name: string;
  type: 'Pemasukan' | 'Pengeluaran' | 'Tabungan';
  category: string;
  accountId: string;
  amount: number;
  interval: RecurringInterval;
  nextDate: Date;
  note?: string;
  status: 'ACTIVE' | 'PAUSED';
  createdAt: Date;
  // Hanya relevan untuk type 'Tabungan' — target total goal (opsional),
  // disimpan backend di kolom payload_json (bukan kolom baru).
  targetAmount?: number;
}

const COLLECTION_NAME = 'recurring';

export const recurringService = {
  // Semua jadwal milik sesi langsung dari API — tidak bergantung auth.currentUser
  // (getUserRecurring menyaring userId di klien dan kosong kalau belum siap).
  async listMine(): Promise<RecurringTransaction[]> {
    const r = await cloudflareApi<{ items?: Record<string, unknown>[] }>('/api/member/recurring');
    return (r.items ?? []).map((x) => ({
      id: String(x.id),
      userId: String(x.user_id ?? ''),
      name: String(x.name ?? ''),
      type: x.type as RecurringTransaction['type'],
      category: String(x.category ?? ''),
      accountId: String(x.account_id ?? ''),
      amount: Number(x.amount) || 0,
      interval: x.interval as RecurringTransaction['interval'],
      nextDate: new Date(String(x.next_date ?? '')),
      note: x.note ? String(x.note) : undefined,
      status: x.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE',
      createdAt: new Date(String(x.created_at ?? '')),
    }));
  },

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
        nextDate: data.nextDate?.toDate?.() ?? new Date(),
        createdAt: data.createdAt?.toDate?.() ?? new Date()
      } as RecurringTransaction;
    });
  },

  async updateRecurring(id: string, data: Partial<Omit<RecurringTransaction, 'id' | 'createdAt'>>) {
    const docRef = doc(db, COLLECTION_NAME, id);
    const updates: Record<string, unknown> = { ...data };
    if (data.nextDate) updates.nextDate = Timestamp.fromDate(data.nextDate);
    await updateDoc(docRef, updates);
  },

  async deleteRecurring(id: string) {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  }
};

