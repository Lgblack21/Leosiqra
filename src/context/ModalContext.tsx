"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

export type ModalType = 
  | null 
  | 'harian' 
  | 'saham' 
  | 'deposito' 
  | 'investasi_lain' 
  | 'tabungan' 
  | 'hutang_piutang' 
  | 'topup_transfer' 
  | 'budget_target' 
  | 'recurring'
  | 'ledger'
  | 'rekening'
  | 'kartu'
  | 'currency';

interface ModalContextType {
  activeModal: ModalType;
  modalData: Record<string, unknown> | null;
  openModal: (type: ModalType, data?: Record<string, unknown> | null) => void;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [modalData, setModalData] = useState<Record<string, unknown> | null>(null);

  const openModal = (type: ModalType, data?: Record<string, unknown> | null) => {
    setModalData(data || null);
    setActiveModal(type);
  };
  
  const closeModal = () => {
    setActiveModal(null);
    setModalData(null);
  };

  return (
    <ModalContext.Provider value={{ activeModal, modalData, openModal, closeModal }}>
      {children}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}
