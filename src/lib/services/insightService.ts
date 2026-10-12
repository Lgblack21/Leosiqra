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

export interface WeeklyInsight {
  id: string;
  tone: 'warning' | 'positive' | 'info';
  title: string;
  body: string;
  cta: { label: string; web: string; app: string };
}

export const weeklyInsightService = {
  async getWeeklyInsights() {
    const result = await cloudflareApi<{ period: { start: string; end: string }; items: WeeklyInsight[] }>(
      '/api/member/insights/weekly'
    );
    return Array.isArray(result.items) ? result.items : [];
  }
};
