'use client';

import { useEffect, useState } from 'react';
import { accountService, type Account } from '@/lib/services/accountService';
import { transactionService, type Transaction } from '@/lib/services/transactionService';
import { investmentService, type Investment } from '@/lib/services/investmentService';
import { savingsService, type Saving } from '@/lib/services/savingsService';
import { exchangeRateService, type ExchangeRates } from '@/lib/services/exchangeRateService';
import { itemService } from '@/lib/services/itemService';
import { collectibleService } from '@/lib/services/collectibleService';
import { itemCurrentValue, type Item } from '@/lib/itemValue';
import { unitValueIdr, type Collectible } from '@/lib/collectibles';
import { computeNetWorth } from '@/lib/netWorth';
import { computeMetrics, type Metrics } from '@/lib/kanvas/data';

// Data keuangan untuk angka "Dari catatanmu" (sama dengan Kekayaan & Ringkasan).
export function useFinance() {
  const [data, setData] = useState<{ tx: Transaction[]; accounts: Account[]; metrics: Metrics } | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const [accounts, tx, inv, sav, items, cols, fx] = await Promise.all([
        accountService.getUserAccounts('session').catch(() => [] as Account[]),
        transactionService.getUserTransactions('session').catch(() => [] as Transaction[]),
        investmentService.getUserInvestments('session').catch(() => [] as Investment[]),
        savingsService.getUserSavings('session').catch(() => [] as Saving[]),
        itemService.list().catch(() => [] as Item[]),
        collectibleService
          .list()
          .then((r) => r.items)
          .catch(() => [] as Collectible[]),
        exchangeRateService.getLatestRates().catch(() => ({}) as ExchangeRates),
      ]);
      const toIdr = (n: number, c?: string) => exchangeRateService.convert(n, c || 'IDR', 'IDR', fx);
      const nw = computeNetWorth({
        accounts,
        transactions: tx,
        investments: inv,
        savings: sav,
        toIdr,
        itemsValueIdr: items
          .filter((i) => i.status === 'aktif')
          .reduce((s, it) => s + toIdr(itemCurrentValue(it), it.currency), 0),
        collectiblesValueIdr: cols.reduce((s, c) => s + unitValueIdr(c, fx) * c.quantity, 0),
      });
      if (alive) setData({ tx, accounts, metrics: computeMetrics(tx, nw) });
    })();
    return () => {
      alive = false;
    };
  }, []);
  return data;
}
