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

export interface Investment {
  id?: string;
  userId: string;
  name: string;
  type: 'Saham' | 'Deposito' | 'Lainnya';
  platform: string;
  amountInvested: number;
  amountIDR?: number;
  currentValue: number;
  currentValueIDR?: number;
  returnPercentage: number;
  taxPercentage?: number;
  currency: string;
  durationMonths?: number;
  transactionType?: string;
  category?: string;
  accountId?: string;
  logoUrl?: string;
  quantity?: number;
  unit?: string;
  pricePerUnit?: number;
  stockCode?: string;
  exchangeCode?: string;
  sharesCount?: number;
  pricePerShare?: number;
  dateInvested: Date;
  targetDate?: Date;
  durationDays?: number;
  status: 'Active' | 'Closed' | 'Planned';
  createdAt: Date;
}

const COLLECTION_NAME = 'investments';

export const investmentService = {
  async createInvestment(data: Omit<Investment, 'id' | 'createdAt'>) {
    const ref = collection(db, COLLECTION_NAME);
    const newDoc = await addDoc(ref, {
      ...data,
      amountIDR: data.amountIDR || data.amountInvested || 0,
      currentValueIDR: data.currentValueIDR || data.currentValue || 0,
      durationMonths: Number(data.durationMonths) || 0,
      quantity: Number(data.quantity) || 0,
      pricePerUnit: Number(data.pricePerUnit) || 0,
      taxPercentage: Number(data.taxPercentage) || 0,
      sharesCount: Number(data.sharesCount) || 0,
      pricePerShare: Number(data.pricePerShare) || 0,
      dateInvested: Timestamp.fromDate(data.dateInvested),
      targetDate: data.targetDate ? Timestamp.fromDate(data.targetDate) : null,
      createdAt: Timestamp.now()
    });
    return newDoc.id;
  },

  async getUserInvestments(userId: string) {
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
        dateInvested: data.dateInvested.toDate(),
        targetDate: data.targetDate?.toDate?.() || null,
        createdAt: data.createdAt.toDate()
      } as Investment;
    });
  },

  async getInvestmentsByType(userId: string, type: string) {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', userId),
      where('type', '==', type)
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        dateInvested: data.dateInvested.toDate(),
        createdAt: data.createdAt.toDate()
      } as Investment;
    });
  },

  async updateInvestment(id: string, data: Partial<Omit<Investment, 'id' | 'createdAt'>>) {
    const docRef = doc(db, COLLECTION_NAME, id);
    const updates: any = { ...data };
    if (data.dateInvested) {
      updates.dateInvested = Timestamp.fromDate(data.dateInvested);
    }
    await updateDoc(docRef, updates);
  },

  async hardDeleteInvestment(id: string, userId: string) {
    // 1. Get Investment data first to know what to revert
    const docRef = doc(db, COLLECTION_NAME, id);
    const snap = await getDocs(query(collection(db, COLLECTION_NAME), where('userId', '==', userId)));
    const investment = snap.docs.find(d => d.id === id)?.data() as Investment;
    
    if (!investment) return;

    // 2. Find and delete related transactions
    const qTrx = query(
      collection(db, 'transactions'),
      where('userId', '==', userId),
      where('relatedId', '==', id)
    );
    const trxSnap = await getDocs(qTrx);
    
    for (const trxDoc of trxSnap.docs) {
      const trxData = trxDoc.data();
      const amount = Number(trxData.amount) || 0;
      const type = trxData.type; // 'pemasukan' or 'pengeluaran'
      const accountId = trxData.accountId;

      // a. Revert member totals impact of this transaction
      // Import these dynamically or pass as params to avoid circular dep if any
      const { updateMemberTotals } = await import('./userService');
      const financeType = type; // e.g. 'pemasukan'
      await updateMemberTotals(userId, financeType, -amount);
      
      // b. Revert investment total in memberTotals
      // For purchases (pengeluaran), it added to investasi. For sales (pemasukan), it subtracted.
      await updateMemberTotals(userId, 'investasi', type === 'pemasukan' ? amount : -amount);

      // c. Revert account balance
      if (accountId) {
        const { accountService } = await import('./accountService');
        // If it was pengeluaran, add back. If it was pemasukan, subtract.
        const balanceRevert = type === 'pemasukan' ? -amount : amount;
        await accountService.updateAccountBalance(accountId, balanceRevert);
      }

      // d. Delete Transaction
      await deleteDoc(trxDoc.ref);
    }

    // 3. Delete the investment document
    await deleteDoc(docRef);
  }
};
