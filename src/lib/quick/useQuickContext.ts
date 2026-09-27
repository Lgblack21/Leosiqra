"use client";

import { useEffect, useMemo, useState } from 'react';
import { categoryService } from '@/lib/services/categoryService';
import type { Account } from '@/lib/services/accountService';
import type { Transaction } from '@/lib/services/transactionService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { toLocalDateString } from '@/lib/utils';
import type { ParseContext } from './parse';

// Konteks bersama Input Cepat (halaman /input-cepat & tombol + di /app):
// kategori milik user + riwayat transaksi untuk parser ketik pintar.
export const useQuickContext = (userId: string, accounts: Account[], transactions: Transaction[]) => {
  const [categories, setCategories] = useState<ParseContext['categories']>([]);

  useEffect(() => {
    if (!userId) return;
    const load = () =>
      categoryService
        .getUserCategories(userId)
        .then((rows) => setCategories(rows.map((c) => ({ category: c.category, subCategory: c.subCategory ?? '' }))))
        .catch(() => {});
    load();
    return subscribeToCollectionChanges('categories', load);
  }, [userId]);

  const ctx = useMemo<ParseContext>(() => {
    const recent = [...transactions]
      .filter((t) => t.type === 'pengeluaran' || t.type === 'pemasukan')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 300)
      .map((t) => ({ type: t.type, category: t.category, subCategory: t.subCategory, note: t.note }));
    return {
      accounts: accounts.map((a) => ({ id: a.id, name: a.name })),
      categories,
      history: recent,
      today: toLocalDateString(),
    };
  }, [accounts, categories, transactions]);

  return { ctx };
};
