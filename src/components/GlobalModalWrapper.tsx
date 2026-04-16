"use client";

import { useModal } from '@/context/ModalContext';
import { AddTransactionModal } from '@/components/AddTransactionModal';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useEffect, useState } from 'react';

// Extracted Modals
import { StockInvestmentModal } from '@/components/modals/StockInvestmentModal';
import { DepositModal } from '@/components/modals/DepositModal';
import { OtherInvestmentModal } from '@/components/modals/OtherInvestmentModal';
import { SavingsModal } from '@/components/modals/SavingsModal';
import { DebtModal } from '@/components/modals/DebtModal';
import { TopUpModal } from '@/components/modals/TopUpModal';
import { RecurringModal } from '@/components/modals/RecurringModal';
import { BudgetModal } from '@/components/modals/BudgetModal';
import { LedgerModal } from '@/components/modals/LedgerModal';
import { AccountModal } from '@/components/modals/AccountModal';
import { CardModal } from '@/components/modals/CardModal';
import { CurrencyModal } from '@/components/modals/CurrencyModal';

export const GlobalModalWrapper = () => {
  const { activeModal, modalData, closeModal } = useModal();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  if (!activeModal || !user) return null;

  return (
    <>
      <AddTransactionModal 
        isOpen={activeModal === 'harian'} 
        onClose={closeModal} 
        userId={user.uid} 
      />
      
      <StockInvestmentModal 
        isOpen={activeModal === 'saham'} 
        onClose={closeModal} 
        userId={user.uid} 
        initialData={modalData}
      />

      <DepositModal 
        isOpen={activeModal === 'deposito'} 
        onClose={closeModal} 
        userId={user.uid} 
      />

      <OtherInvestmentModal 
        isOpen={activeModal === 'investasi_lain'} 
        onClose={closeModal} 
        userId={user.uid} 
      />

      <SavingsModal 
        isOpen={activeModal === 'tabungan'} 
        onClose={closeModal} 
        userId={user.uid} 
      />

      <DebtModal 
        isOpen={activeModal === 'hutang_piutang'} 
        onClose={closeModal} 
        userId={user.uid} 
      />

      <TopUpModal 
        isOpen={activeModal === 'topup_transfer'} 
        onClose={closeModal} 
        userId={user.uid} 
      />

      <BudgetModal 
        isOpen={activeModal === 'budget_target'} 
        onClose={closeModal} 
        userId={user.uid} 
      />

      <RecurringModal 
        isOpen={activeModal === 'recurring'} 
        onClose={closeModal} 
        userId={user.uid} 
      />

      <LedgerModal 
        isOpen={activeModal === 'ledger'} 
        onClose={closeModal} 
        userId={user.uid} 
      />

      <AccountModal 
        isOpen={activeModal === 'rekening'} 
        onClose={closeModal} 
        userId={user.uid} 
      />

      <CardModal 
        isOpen={activeModal === 'kartu'} 
        onClose={closeModal} 
        userId={user.uid} 
      />
      
      <CurrencyModal 
        isOpen={activeModal === 'currency'} 
        onClose={closeModal} 
      />
    </>
  );
};
