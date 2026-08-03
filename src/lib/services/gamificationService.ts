import { cloudflareApi } from '../cloudflare-api';

export interface GamificationBadge {
  id: string;
  label: string;
  description: string;
  unlocked: boolean;
}

export interface GamificationData {
  streakDays: number;
  surplusStreakMonths: number;
  badges: GamificationBadge[];
}

export const gamificationService = {
  async getUserGamification() {
    return cloudflareApi<GamificationData>('/api/member/gamification');
  }
};
