import { cloudflareApi } from '../cloudflare-api';

export interface UserInsight {
  id: string;
  type: 'anomaly' | 'budget_pace' | 'trend';
  severity: 'info' | 'warning';
  title: string;
  body: string;
}

export const insightService = {
  async getUserInsights() {
    const result = await cloudflareApi<{ items: UserInsight[] }>('/api/member/insights');
    return result.items;
  }
};
