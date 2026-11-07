'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Account } from '@/lib/services/accountService';
import type { Transaction } from '@/lib/services/transactionService';
import { budgetService, Budget } from '@/lib/services/budgetService';
import { investmentService, Investment } from '@/lib/services/investmentService';
import { savingsService, Saving } from '@/lib/services/savingsService';
import { exchangeRateService, ExchangeRates } from '@/lib/services/exchangeRateService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { computeHealthScore } from '@/lib/healthScore';
import { computeNetWorth } from '@/lib/netWorth';
import { HealthScoreCard } from '@/components/dashboard/HealthScoreCard';

// Skor Kesehatan Finansial di Beranda app HP — rumus & data sama dengan
// dashboard web (lib/healthScore + computeNetWorth), jadi angkanya sama.
export function AppHealthScore({ accounts, transactions }: { accounts: Account[]; transactions: Transaction[] }) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [savings, setSavings] = useState<Saving[]>([]);
  const [fxRates, setFxRates] = useState<ExchangeRates>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () =>
      Promise.all([
        budgetService.getUserBudgets('session').catch(() => [] as Budget[]),
        investmentService.getUserInvestments('session').catch(() => [] as Investment[]),
        savingsService.getUserSavings('session').catch(() => [] as Saving[]),
      ]).then(([b, i, s]) => {
        if (!active) return;
        setBudgets(b);
        setInvestments(i);
        setSavings(s);
        setReady(true);
      });
    load();
    exchangeRateService
      .getLatestRates()
      .then((r) => active && setFxRates(r))
      .catch(() => undefined);
    const unsubs = ['budgets', 'investments', 'savings'].map((c) => subscribeToCollectionChanges(c, load));
    return () => {
      active = false;
      unsubs.forEach((u) => u());
    };
  }, []);

  const result = useMemo(() => {
    const nw = computeNetWorth({
      accounts,
      transactions,
      investments,
      savings,
      toIdr: (amount, currency) => exchangeRateService.convert(amount, currency || 'IDR', 'IDR', fxRates),
    });
    return computeHealthScore({
      transactions,
      budgets,
      liquid: nw.totals.cash + nw.totals.savings,
      liabilities: nw.totals.liabilities,
    });
  }, [accounts, transactions, investments, savings, budgets, fxRates]);

  if (!ready) return null;
  return <HealthScoreCard result={result} compact />;
}
