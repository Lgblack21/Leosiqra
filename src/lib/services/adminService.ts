import { 
  collection, 
  doc, 
  getDoc, 
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
  timestamp: unknown;
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

// Backend menyimpan settings sebagai kolom datar snake_case (mis.
// maintenance_is_active), sedangkan UI memakai bentuk bertingkat camelCase
// (maintenance.isActive). Tanpa mapper ini, generic camelCase->snake_case
// dari cf-firestore tidak bisa merekonstruksi objek bertingkat, jadi seluruh
// tab Maintenance/Market selalu gagal simpan — begitu juga proPackages yang
// memang belum punya kolom khusus, disimpan sebagai JSON di value_json.
const mapRowToAppSettings = (row: Record<string, unknown> | null): AppSettings | null => {
  if (!row) return null;

  let proPackages: ProPackage[] = [];
  if (Array.isArray(row.pro_packages)) {
    proPackages = row.pro_packages as ProPackage[];
  } else if (typeof row.value_json === 'string' && row.value_json) {
    try {
      const parsed = JSON.parse(row.value_json) as { proPackages?: ProPackage[] };
      if (Array.isArray(parsed.proPackages)) proPackages = parsed.proPackages;
    } catch {
      // value_json lama tidak valid JSON — abaikan.
    }
  }

  return {
    billingEmail: (row.billing_email as string) || undefined,
    whatsapp: (row.whatsapp as string) || undefined,
    proPrice: row.pro_price != null ? Number(row.pro_price) : undefined,
    bankName: (row.bank_name as string) || undefined,
    bankAccountName: (row.bank_account_name as string) || undefined,
    bankNumber: (row.bank_number as string) || undefined,
    qrisText: (row.qris_text as string) || undefined,
    qrisURL: (row.qris_url as string) || undefined,
    freePlanDays: row.free_plan_days != null ? Number(row.free_plan_days) : undefined,
    proPackages,
    maintenance: {
      isActive: Boolean(row.maintenance_is_active),
      type: (row.maintenance_type as 'code' | 'image') || 'code',
      code: (row.maintenance_code as string) || '',
      imageUrl: (row.maintenance_image_url as string) || '',
    },
    marketData: {
      userCovered: Number(row.market_user_covered) || 0,
      fxUpdate: Number(row.market_fx_update) || 0,
      cryptoUpdate: Number(row.market_crypto_update) || 0,
      stockUpdate: Number(row.market_stock_update) || 0,
      lastUpdate: (row.market_last_update as string) || '-',
    },
  };
};

const mapAppSettingsToPayload = (data: Partial<AppSettings>): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};
  if (data.billingEmail !== undefined) payload.billing_email = data.billingEmail;
  if (data.whatsapp !== undefined) payload.whatsapp = data.whatsapp;
  if (data.proPrice !== undefined) payload.pro_price = data.proPrice;
  if (data.bankName !== undefined) payload.bank_name = data.bankName;
  if (data.bankAccountName !== undefined) payload.bank_account_name = data.bankAccountName;
  if (data.bankNumber !== undefined) payload.bank_number = data.bankNumber;
  if (data.qrisText !== undefined) payload.qris_text = data.qrisText;
  if (data.qrisURL !== undefined) payload.qris_url = data.qrisURL;
  if (data.freePlanDays !== undefined) payload.free_plan_days = data.freePlanDays;
  if (data.maintenance) {
    if (data.maintenance.isActive !== undefined) payload.maintenance_is_active = data.maintenance.isActive;
    if (data.maintenance.type !== undefined) payload.maintenance_type = data.maintenance.type;
    if (data.maintenance.code !== undefined) payload.maintenance_code = data.maintenance.code;
    if (data.maintenance.imageUrl !== undefined) payload.maintenance_image_url = data.maintenance.imageUrl;
  }
  if (data.marketData) {
    if (data.marketData.userCovered !== undefined) payload.market_user_covered = data.marketData.userCovered;
    if (data.marketData.fxUpdate !== undefined) payload.market_fx_update = data.marketData.fxUpdate;
    if (data.marketData.cryptoUpdate !== undefined) payload.market_crypto_update = data.marketData.cryptoUpdate;
    if (data.marketData.stockUpdate !== undefined) payload.market_stock_update = data.marketData.stockUpdate;
    if (data.marketData.lastUpdate !== undefined) payload.market_last_update = data.marketData.lastUpdate;
  }
  if (data.proPackages !== undefined) payload.pro_packages = data.proPackages;
  return payload;
};

// 1. APP SETTINGS SERVICE
export const getAppSettings = async () => {
  const docRef = doc(db, SETTINGS_COLLECTION, 'global_config');
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return mapRowToAppSettings(docSnap.data() as Record<string, unknown>);
  }
  return null;
};

export const subscribeAppSettings = (callback: (settings: AppSettings | null) => void) => {
  const docRef = doc(db, SETTINGS_COLLECTION, 'global_config');
  return onSnapshot(docRef,
    (doc) => {
      if (doc.exists()) {
        callback(mapRowToAppSettings(doc.data() as Record<string, unknown>));
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
  return await setDoc(docRef, mapAppSettingsToPayload(data), { merge: true });
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
export const subscribeAllUsers = (callback: (users: Record<string, unknown>[]) => void) => {
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
export const subscribeAllPayments = (callback: (payments: Record<string, unknown>[]) => void) => {
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
export const updateAdminProfile = async (uid: string, data: Record<string, unknown>) => {
  const docRef = doc(db, USERS_COLLECTION, uid);
  return await updateDoc(docRef, data);
};

