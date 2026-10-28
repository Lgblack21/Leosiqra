import { cloudflareApi } from '../cloudflare-api';
import type { RecurringInterval } from '../recurringIntervals';

export interface SavingsGoal {
  id: string;
  name: string;
  category: string;
  accountId: string | null;
  monthlyAmount: number;
  interval: RecurringInterval;
  nextDate: string;
  status: 'ACTIVE' | 'PAUSED';
  targetAmount: number | null;
  currentTotal: number;
  progressPercent: number | null;
  icon?: string | null;
  color?: string | null;
  targetDate?: string | null;
}

export const savingsGoalService = {
  async getUserSavingsGoals() {
    const result = await cloudflareApi<{ items: SavingsGoal[] }>('/api/member/savings-goals');
    return result.items;
  }
};
