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

export interface RecurringTransaction {
  id?: string;
  userId: string;
  name: string;
  type: 'Pemasukan' | 'Pengeluaran' | 'Tabungan';
  category: string;
  accountId: string;
  amount: number;
  interval: 'Harian' | 'Mingguan' | 'Bulanan' | '3 Bulanan' | 'Tahunan';
  nextDate: Date;
  note?: string;
  status: 'ACTIVE' | 'PAUSED';
  createdAt: Date;
  // Hanya relevan untuk type 'Tabungan' — target total goal (opsional),
  // disimpan backend di kolom payload_json (bukan kolom baru).
  targetAmount?: number;
  // Metadata langganan (juga di payload_json): layanan dari katalog,
  // kategori layanannya, mulai berlangganan (YYYY-MM-DD), dan
  // autoRecord=false = cukup diingatkan, tidak dicatat otomatis.
  service?: string;
  serviceCategory?: string;
  since?: string;
  autoRecord?: boolean;
}

// Biaya rata-rata per bulan dari satu jadwal.
export const recurringPerMonth = (r: Pick<RecurringTransaction, 'amount' | 'interval'>) =>
  r.interval === 'Tahunan' ? r.amount / 12 : r.interval === '3 Bulanan' ? r.amount / 3 : r.interval === 'Mingguan' ? (r.amount * 52) / 12 : r.interval === 'Harian' ? r.amount * 30 : r.amount;

const parseMeta = (raw: unknown): Partial<RecurringTransaction> => {
  if (typeof raw !== 'string' || !raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
};

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
      const meta = parseMeta(data.payloadJson);
      return {
        ...data,
        service: meta.service,
        serviceCategory: meta.serviceCategory,
        since: meta.since,
        autoRecord: meta.autoRecord !== false,
        targetAmount: data.targetAmount ?? meta.targetAmount,
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

