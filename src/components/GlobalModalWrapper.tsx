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
import type { RecurringTransaction } from '@/lib/services/recurringService';
import { BudgetModal } from '@/components/modals/BudgetModal';
import { LedgerModal } from '@/components/modals/LedgerModal';
import { AccountModal } from '@/components/modals/AccountModal';
import { CardModal } from '@/components/modals/CardModal';
import { CurrencyModal } from '@/components/modals/CurrencyModal';
import { ImportTransactionsModal } from '@/components/modals/ImportTransactionsModal';
import { accountService } from '@/lib/services/accountService';
import { AiChatModal } from '@/components/ai/AiChatModal';
import type { Investment } from '@/lib/services/investmentService';

export const GlobalModalWrapper = () => {
  const { activeModal, modalData, closeModal } = useModal();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [accountTypes, setAccountTypes] = useState<string[]>([]);

  useEffect(() => {
    cloudflareApi<{ user?: { id: string } | null }>('/api/auth/me')
      .then((result) => setUser(result.user ?? null))
      .catch(() => setUser(null));
  }, []);

  // Jenis rekening custom yang pernah dipakai user, supaya muncul di dropdown
  // AccountModal saat dibuka dari quick-action header ("Tambah Bank").
  useEffect(() => {
    if (!user) return;
    accountService.getUserAccounts(user.id)
      .then((accs) => setAccountTypes(Array.from(new Set(accs.map((a) => a.type).filter(Boolean)))))
      .catch(() => {});
  }, [user]);

  if (!activeModal || !user) return null;

  // Tanya Leo (popup chat) — dirender sendiri, tidak perlu data rekening.
  if (activeModal === 'ai_chat') {
    return <AiChatModal open onClose={closeModal} prompt={typeof modalData?.prompt === 'string' ? modalData.prompt : undefined} />;
  }

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
        initialData={modalData ? (modalData as unknown as Investment) : undefined}
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
        // Isian awal tanpa id (mis. dari "Cek langganan") → tetap membuat baru.
        initialData={activeModal === 'recurring' && modalData?.prefill ? (modalData.prefill as RecurringTransaction) : null}
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
        existingTypes={accountTypes}
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

      <ImportTransactionsModal
        isOpen={activeModal === 'import_mutasi'}
        onClose={closeModal}
        userId={user.id}
      />
    </>
  );
};
