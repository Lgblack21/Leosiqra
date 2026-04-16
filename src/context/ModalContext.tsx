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
  modalData: any;
  openModal: (type: ModalType, data?: any) => void;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [modalData, setModalData] = useState<any>(null);

  const openModal = (type: ModalType, data?: any) => {
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
