import type { Account } from '@/lib/services/accountService';
import type { Transaction } from '@/lib/services/transactionService';
import type { Investment } from '@/lib/services/investmentService';
import type { Saving } from '@/lib/services/savingsService';
import { isCreditAccountType, computeCreditUsage } from '@/lib/creditCard';
import { isInvestmentFlow } from '@/lib/utils';

// Kekayaan bersih = aset − kewajiban, semua dalam IDR. Rumus mengikuti halaman
// yang sudah ada supaya angkanya sama di mana pun:
// - Kas: saldo rekening non-kartu-kredit (dikonversi kurs, seperti Rekening).
// - Tabungan: akumulasi setoran − penarikan (seperti Ringkasan) — uangnya
//   sudah keluar dari rekening sumber, jadi tidak terhitung dobel.
// - Investasi: posisi non-Planned, nilai kini (fallback modal), seperti Investasiku.
// - Piutang/Hutang: SISA setelah cicilan (relatedId), seperti panel Hutang.
// - Kartu kredit: terpakai (lib/creditCard). Hutang lama "Kartu Kredit" yang
//   menempel ke rekening kartu tidak dihitung lagi (sudah ada di kartu).

export type ToIdr = (amount: number, currency?: string) => number;

export type DebtRow = { id: string; name: string; note?: string; remaining: number; total: number; date: Date };
export type NetWorth = {
  cash: { account: Account; value: number }[];
  cards: { account: Account; used: number }[];
  savingsTotal: number;
  investments: { inv: Investment; value: number; cost: number }[];
  piutang: DebtRow[];
  hutang: DebtRow[];
  totals: { cash: number; savings: number; investments: number; piutang: number; cards: number; hutang: number; assets: number; liabilities: number; net: number };
};

const idrOf = (t: { amount: number; amountIDR?: number }) => Number(t.amountIDR) || Number(t.amount) || 0;

export function computeNetWorth(input: { accounts: Account[]; transactions: Transaction[]; investments: Investment[]; savings: Saving[]; toIdr: ToIdr }): NetWorth {
  const { accounts, transactions, investments, savings, toIdr } = input;
  const creditIds = new Set(accounts.filter((a) => isCreditAccountType(a.type)).map((a) => a.id));

  const cash = accounts.filter((a) => !isCreditAccountType(a.type)).map((account) => ({ account, value: toIdr(Number(account.balance) || 0, account.currency) }));
  const cards = accounts
    .filter((a) => isCreditAccountType(a.type))
    .map((account) => ({ account, used: toIdr(computeCreditUsage(account).used, account.currency) }));

  const savingsTotal = savings.reduce((s, item) => (item.transactionType === 'Penarikan' ? s - idrOf(item) : s + idrOf(item)), 0);

  const inv = investments
    .filter((i) => i.status !== 'Planned')
    .map((i) => {
      const cost = Number(i.amountIDR) || Number(i.amountInvested) || 0;
      const value = Number(i.currentValueIDR) || Number(i.currentValue) || cost;
      return { inv: i, value, cost };
    });

  const paid = new Map<string, number>();
  for (const p of transactions) {
    if (p.relatedType !== 'debt' || !p.relatedId) continue;
    paid.set(p.relatedId, (paid.get(p.relatedId) ?? 0) + (Number(p.amount) || 0));
  }
  const debtRows = (category: 'Hutang' | 'Piutang') =>
    transactions
      .filter((t) => t.type === 'debt' && t.category === category && t.id)
      .filter((t) => !(category === 'Hutang' && t.subCategory === 'Kartu Kredit' && t.accountId && creditIds.has(t.accountId)))
      .map((t) => {
        const remainingOrig = t.paymentStatus === 'lunas' ? 0 : Math.max(0, t.amount - (paid.get(t.id as string) ?? 0));
        const ratio = t.amount > 0 && Number(t.amountIDR) > 0 ? Number(t.amountIDR) / t.amount : 1;
        return { id: t.id as string, name: t.lenderName || t.note || category, note: t.subCategory && t.subCategory !== category ? t.subCategory : undefined, remaining: remainingOrig * ratio, total: idrOf(t), date: new Date(t.date) };
      })
      .filter((r) => r.remaining > 0.5)
      .sort((a, b) => b.remaining - a.remaining);
  const piutang = debtRows('Piutang');
  const hutang = debtRows('Hutang');

  const sum = <T,>(list: T[], f: (x: T) => number) => list.reduce((s, x) => s + f(x), 0);
  const totals = {
    cash: sum(cash, (c) => c.value),
    savings: savingsTotal,
    investments: sum(inv, (i) => i.value),
    piutang: sum(piutang, (p) => p.remaining),
    cards: sum(cards, (c) => c.used),
    hutang: sum(hutang, (h) => h.remaining),
  };
  const assets = totals.cash + totals.savings + totals.investments + totals.piutang;
  const liabilities = totals.cards + totals.hutang;
  return { cash, cards, savingsTotal, investments: inv, piutang, hutang, totals: { ...totals, assets, liabilities, net: assets - liabilities } };
}

/**
 * Jejak kekayaan N hari terakhir, dihitung MUNDUR dari angka hari ini memakai
 * pemasukan & pengeluaran yang tercatat (beli/jual investasi, transfer,
 * tabungan, dan cicilan hutang/piutang = pindah dana, tidak mengubah kekayaan).
 * Naik-turun harga investasi dan saldo yang diedit manual TIDAK ikut —
 * tampilkan sebagai perkiraan.
 */
export function netWorthTrail(net: number, transactions: Transaction[], days: number, today = new Date()) {
  const flows = transactions
    .filter((t) => (t.type === 'pemasukan' || t.type === 'pengeluaran') && !isInvestmentFlow(t) && t.relatedType !== 'debt')
    .map((t) => ({ at: new Date(t.date).getTime(), delta: t.type === 'pemasukan' ? idrOf(t) : -idrOf(t) }))
    .sort((a, b) => b.at - a.at);
  const points: { date: Date; value: number }[] = [];
  let i = 0;
  let after = 0; // jumlah arus setelah akhir hari yang sedang dihitung
  for (let d = 0; d <= days; d++) {
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() - d, 23, 59, 59, 999);
    while (i < flows.length && flows[i].at > end.getTime()) after += flows[i++].delta;
    points.push({ date: new Date(end.getFullYear(), end.getMonth(), end.getDate()), value: Math.round(net - after) });
  }
  return points.reverse();
}
