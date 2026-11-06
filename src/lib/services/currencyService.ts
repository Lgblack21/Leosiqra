import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot,
  doc,
  deleteDoc,
  getDocs
} from '@/lib/cf-firestore';
import { db } from '../cf-client';

export interface Currency {
  id?: string;
  userId: string;
  code: string;
  name: string;
  symbol: string;
  isDefault?: boolean;
  createdAt: Date;
}

export const currencyService = {
  getUserCurrencies: (userId: string, callback: (currencies: Currency[]) => void) => {
    const q = query(
      collection(db, 'currencies'),
      where('userId', '==', userId),
    );
    
    return onSnapshot(q, (snapshot) => {
      const currencies = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Currency[];
      callback(currencies);
    });
  },

  addCurrency: async (currency: Omit<Currency, 'id' | 'createdAt'>) => {
    return await addDoc(collection(db, 'currencies'), {
      ...currency,
      createdAt: new Date()
    });
  },

  deleteCurrency: async (id: string) => {
    const docRef = doc(db, 'currencies', id);
    await deleteDoc(docRef);
  },

  // Admin use: all currencies across users, deduplicated by code (first wins).
  getAllUniqueCurrencies: async (): Promise<Currency[]> => {
    const snap = await getDocs(collection(db, 'currencies'));
    const all = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Currency[];
    const seen = new Set<string>();
    return all.filter(c => {
      if (seen.has(c.code)) return false;
      seen.add(c.code);
      return true;
    });
  },

  initializeDefaults: async (userId: string) => {
    const curRef = collection(db, 'currencies');
    const q = query(curRef, where('userId', '==', userId));
    const snap = await getDocs(q);
    
    if (snap.empty) {
      const defaults = [
        { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', isDefault: true },
        { code: 'USD', name: 'US Dollar', symbol: '$' },
        { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
        { code: 'EUR', name: 'Euro', symbol: 'EUR' }
      ];
      
      for (const d of defaults) {
        await addDoc(curRef, { ...d, userId, createdAt: new Date() });
      }
    }
  }
};

