'use client';

import { useModal } from '@/context/ModalContext';
import { AddTransactionModal } from '@/components/AddTransactionModal';
import { useEffect, useState } from 'react';
import { cloudflareApi } from '@/lib/cloudflare-api';

import { StockInvestmentModal } from '@/components/modals/StockInvestmentModal';
import { DepositModal } from '@/components/modals/DepositModal';
import { AddInvestmentModal } from '@/components/kekayaan/AddInvestmentModal';
import { SavingsModal } from '@/components/modals/SavingsModal';
import { DebtModal } from '@/components/modals/DebtModal';
import { TopUpModal } from '@/components/modals/TopUpModal';
import { RecurringModal } from '@/components/modals/RecurringModal';
import { BudgetModal } from '@/components/modals/BudgetModal';
import { LedgerModal } from '@/components/modals/LedgerModal';
import { AccountModal } from '@/components/modals/AccountModal';
import { CreditCardForm } from '@/components/rekening/CreditCardForm';
import { CurrencyModal } from '@/components/modals/CurrencyModal';
import { accountService } from '@/lib/services/accountService';
import type { Investment } from '@/lib/services/investmentService';

export const GlobalModalWrapper = () => {
  const { activeModal, modalData, openModal, closeModal } = useModal();
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
    accountService
      .getUserAccounts(user.id)
      .then((accs) => setAccountTypes(Array.from(new Set(accs.map((a) => a.type).filter(Boolean)))))
      .catch(() => {});
  }, [user]);

  if (!activeModal || !user) return null;

  return (
    <>
      <AddTransactionModal isOpen={activeModal === 'harian'} onClose={closeModal} userId={user.id} />

      {/* Jual saham (ada data) tetap di form lama; tambah investasi baru pakai form yang lebih ramah (3.43). */}
      <StockInvestmentModal
        isOpen={activeModal === 'saham' && Boolean(modalData)}
        onClose={closeModal}
        userId={user.id}
        initialData={modalData ? (modalData as unknown as Investment) : undefined}
      />
      <AddInvestmentModal
        isOpen={(activeModal === 'saham' && !modalData) || activeModal === 'investasi_lain'}
        initialKind={activeModal === 'saham' ? 'idx' : 'emas'}
        onClose={closeModal}
        onDeposito={() => openModal('deposito')}
      />

      <DepositModal isOpen={activeModal === 'deposito'} onClose={closeModal} userId={user.id} />


      <SavingsModal isOpen={activeModal === 'tabungan'} onClose={closeModal} userId={user.id} />

      <DebtModal isOpen={activeModal === 'hutang_piutang'} onClose={closeModal} userId={user.id} />

      <TopUpModal isOpen={activeModal === 'topup_transfer'} onClose={closeModal} userId={user.id} />

      <BudgetModal isOpen={activeModal === 'budget_target'} onClose={closeModal} userId={user.id} />

      <RecurringModal isOpen={activeModal === 'recurring'} onClose={closeModal} userId={user.id} />

      <LedgerModal isOpen={activeModal === 'ledger'} onClose={closeModal} userId={user.id} />

      <AccountModal
        isOpen={activeModal === 'rekening'}
        onClose={closeModal}
        userId={user.id}
        existingTypes={accountTypes}
        onCreditCard={() => openModal('kartu')}
        preset={
          activeModal === 'rekening' ? (modalData as { name?: string; type?: string; logoUrl?: string } | null) : null
        }
      />

      <CreditCardForm isOpen={activeModal === 'kartu'} onClose={closeModal} userId={user.id} />

      <CurrencyModal isOpen={activeModal === 'currency'} onClose={closeModal} />
    </>
  );
};
