"use client";

import { useModal } from '@/context/ModalContext';
import { AddTransactionModal } from '@/components/AddTransactionModal';
import { useEffect, useState } from 'react';
import { cloudflareApi } from '@/lib/cloudflare-api';

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
  const [user, setUser] = useState<{ id: string } | null>(null);

  useEffect(() => {
    cloudflareApi<{ user?: { id: string } | null }>('/api/auth/me')
      .then((result) => setUser(result.user ?? null))
      .catch(() => setUser(null));
  }, []);

  if (!activeModal || !user) return null;

  return (
    <>
      <AddTransactionModal 
        isOpen={activeModal === 'harian'} 
        onClose={closeModal} 
        userId={user.id} 
      />
      
      <StockInvestmentModal 
        isOpen={activeModal === 'saham'} 
        onClose={closeModal} 
        userId={user.id} 
        initialData={modalData}
      />

      <DepositModal 
        isOpen={activeModal === 'deposito'} 
        onClose={closeModal} 
        userId={user.id} 
      />

      <OtherInvestmentModal 
        isOpen={activeModal === 'investasi_lain'} 
        onClose={closeModal} 
        userId={user.id} 
      />

      <SavingsModal 
        isOpen={activeModal === 'tabungan'} 
        onClose={closeModal} 
        userId={user.id} 
      />

      <DebtModal 
        isOpen={activeModal === 'hutang_piutang'} 
        onClose={closeModal} 
        userId={user.id} 
      />

      <TopUpModal 
        isOpen={activeModal === 'topup_transfer'} 
        onClose={closeModal} 
        userId={user.id} 
      />

      <BudgetModal 
        isOpen={activeModal === 'budget_target'} 
        onClose={closeModal} 
        userId={user.id} 
      />

      <RecurringModal 
        isOpen={activeModal === 'recurring'} 
        onClose={closeModal} 
        userId={user.id} 
      />

      <LedgerModal 
        isOpen={activeModal === 'ledger'} 
        onClose={closeModal} 
        userId={user.id} 
      />

      <AccountModal 
        isOpen={activeModal === 'rekening'} 
        onClose={closeModal} 
        userId={user.id} 
      />

      <CardModal 
        isOpen={activeModal === 'kartu'} 
        onClose={closeModal} 
        userId={user.id} 
      />
      
      <CurrencyModal 
        isOpen={activeModal === 'currency'} 
        onClose={closeModal} 
      />
    </>
  );
};
