import { 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot,
  updateDoc,
  increment 
} from '@/lib/cf-firestore';
import { db } from '../cf-client';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  role: 'admin' | 'user';
  plan: 'FREE' | 'PRO';
  status: 'AKTIF' | 'NONAKTIF' | 'GUEST' | 'PENDING';
  expiredAt?: string;
  createdAt: string;
  totalWealth: number;
  totalIncome: number;
  totalExpenses: number;
  totalSavings: number;
  totalInvestment: number;
  creditCardBills: number;
  otherDebts: number;
  currencyInitialized?: boolean;
}

const COLLECTION_NAME = 'users';

export const getUserProfile = async (uid: string) => {
  const docRef = doc(db, COLLECTION_NAME, uid);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { uid: docSnap.id, ...docSnap.data() } as UserProfile;
  }
  return null;
};

export const subscribeUserProfile = (uid: string, callback: (profile: UserProfile | null) => void) => {
  const docRef = doc(db, COLLECTION_NAME, uid);
  return onSnapshot(docRef, 
    (doc) => {
      if (doc.exists()) {
        callback({ uid: doc.id, ...doc.data() } as UserProfile);
      } else {
        callback(null);
      }
    },
    (error) => {
      console.warn("Permasalahan perizinan pada profile user (diabaikan):", error.message);
      callback(null);
    }
  );
};

export const updateUserProfile = async (uid: string, data: Partial<UserProfile>) => {
  const docRef = doc(db, COLLECTION_NAME, uid);
  return await setDoc(docRef, data, { merge: true });
};

export const updateMemberTotals = async (userId: string, type: string, actualAmount: number) => {
  const userRef = doc(db, COLLECTION_NAME, userId);
  
  const updates: any = {};
  
  if (type === 'pemasukan') updates.totalIncome = increment(actualAmount);
  if (type === 'pengeluaran') updates.totalExpenses = increment(actualAmount);
  if (type === 'tabungan') updates.totalSavings = increment(actualAmount);
  if (type === 'investasi') updates.totalInvestment = increment(actualAmount);
  
  // Calculate wealth (income - expenses)
  if (type === 'pemasukan') updates.totalWealth = increment(actualAmount);
  if (type === 'pengeluaran') updates.totalWealth = increment(-actualAmount);
  
  await updateDoc(userRef, updates);
};

