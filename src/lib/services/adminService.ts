import { 
  collection, 
  doc, 
  getDoc, 
  getDocs,
  setDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  addDoc,
  serverTimestamp,
  updateDoc
} from '@/lib/cf-firestore';
import { db } from '../cf-client';

// TYPES
export interface ProPackage {
  id: string;
  name: string;
  durationMonths: number;
  price: number;
  isPopular?: boolean;
}

export interface AppSettings {
  billingEmail?: string;
  whatsapp?: string;
  proPrice?: number;
  bankName?: string;
  bankAccountName?: string;
  bankNumber?: string;
  qrisText?: string;
  qrisURL?: string;
  freePlanDays?: number;
  proPackages?: ProPackage[];
  maintenance?: {
    isActive: boolean;
    message?: string;
    type?: 'code' | 'image';
    code?: string;
    imageUrl?: string;
  };
  marketData?: {
    userCovered: number;
    fxUpdate: number;
    cryptoUpdate: number;
    stockUpdate: number;
    lastUpdate: string;
  };
}

export interface AdminLog {
  id?: string;
  timestamp: any;
  adminEmail: string;
  action: string;
  target: string;
  note: string;
  color?: 'indigo' | 'orange' | 'emerald' | 'rose';
}

const SETTINGS_COLLECTION = 'admin_settings';
const LOGS_COLLECTION = 'admin_logs';
const USERS_COLLECTION = 'users';
const PAYMENTS_COLLECTION = 'payments';

// 1. APP SETTINGS SERVICE
export const getAppSettings = async () => {
  const docRef = doc(db, SETTINGS_COLLECTION, 'global_config');
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data() as AppSettings;
  }
  return null;
};

export const subscribeAppSettings = (callback: (settings: AppSettings | null) => void) => {
  const docRef = doc(db, SETTINGS_COLLECTION, 'global_config');
  return onSnapshot(docRef, 
    (doc) => {
      if (doc.exists()) {
        callback(doc.data() as AppSettings);
      } else {
        callback(null);
      }
    },
    (error) => {
      console.warn("Permasalahan perizinan pada settings (diabaikan):", error.message);
      callback(null);
    }
  );
};

export const saveAppSettings = async (data: Partial<AppSettings>) => {
  const docRef = doc(db, SETTINGS_COLLECTION, 'global_config');
  return await setDoc(docRef, data, { merge: true });
};

// 2. LOGGING SERVICE
export const addAdminLog = async (log: Omit<AdminLog, 'timestamp' | 'id'>) => {
  const colRef = collection(db, LOGS_COLLECTION);
  return await addDoc(colRef, {
    ...log,
    timestamp: serverTimestamp()
  });
};

export const subscribeAdminLogs = (limitCount: number = 20, callback: (logs: AdminLog[]) => void) => {
  const colRef = collection(db, LOGS_COLLECTION);
  const q = query(colRef, orderBy('timestamp', 'desc'), limit(limitCount));
  
  return onSnapshot(q, 
    (snapshot) => {
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AdminLog[];
      callback(logs);
    },
    (error) => {
      console.warn("Permasalahan perizinan pada admin_logs (diabaikan):", error.message);
      callback([]);
    }
  );
};

// 3. USER MANAGEMENT (FETCHING)
export const subscribeAllUsers = (callback: (users: any[]) => void) => {
  const colRef = collection(db, USERS_COLLECTION);
  const q = query(colRef, orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, 
    (snapshot) => {
      const users = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(users);
    },
    (error) => {
      console.warn("Permasalahan perizinan pada users (diabaikan):", error.message);
      callback([]);
    }
  );
};

// 4. PAYMENT QUEUE (FETCHING)
export const subscribeAllPayments = (callback: (payments: any[]) => void) => {
  const colRef = collection(db, PAYMENTS_COLLECTION);
  const q = query(colRef, orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, 
    (snapshot) => {
      const payments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(payments);
    },
    (error) => {
      console.warn("Permasalahan perizinan pada payments (diabaikan):", error.message);
      callback([]);
    }
  );
};

// 5. ADMIN PROFILE MANAGEMENT
export const updateAdminProfile = async (uid: string, data: any) => {
  const docRef = doc(db, USERS_COLLECTION, uid);
  return await updateDoc(docRef, data);
};

