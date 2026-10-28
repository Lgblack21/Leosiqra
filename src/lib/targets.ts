import { cloudflareApi } from './cloudflare-api';
import { notifyCollectionChanged } from './cf-firestore';
import type { SavingsGoal } from './services/savingsGoalService';

// Target tabungan = baris `recurring` bertipe Tabungan dengan targetAmount di
// payload_json (+ icon, color, targetDate). Nominal 0 = tanpa setoran otomatis.
// Progres dihitung server dari tabel `savings` per kategori — kategori target
// dikunci saat dibuat (= nama awal) supaya mengganti nama tidak memutus
// riwayat setorannya.

export const TARGET_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e', '#f97316',
  '#f59e0b', '#84cc16', '#10b981', '#14b8a6', '#0ea5e9', '#64748b',
];

export const TARGET_ICONS: { group: string; items: string[] }[] = [
  { group: 'Impian', items: ['🎯', '🏝️', '✈️', '🏡', '🚗', '🛵', '💍', '🎓', '👶', '🕋'] },
  { group: 'Barang', items: ['📱', '💻', '🎮', '📷', '⌚', '🎧', '🛋️', '🚲', '👟', '🎁'] },
  { group: 'Aman', items: ['🛟', '🏥', '🛡️', '💰', '🏦', '📈', '🐷', '🌱', '🔧', '🐾'] },
];

export const DEFAULT_TARGET_ICON = '🎯';
export const DEFAULT_TARGET_COLOR = TARGET_COLORS[0];

export const targetIcon = (g: Pick<SavingsGoal, 'icon'>) => g.icon || DEFAULT_TARGET_ICON;
export const targetColor = (g: Pick<SavingsGoal, 'color'>) => g.color || DEFAULT_TARGET_COLOR;

// Bulan penuh tersisa sampai tanggal target (minimal 1 kalau masih di depan).
export const monthsUntil = (date: string | null | undefined, from = new Date()) => {
  if (!date) return null;
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const months = (d.getFullYear() - from.getFullYear()) * 12 + (d.getMonth() - from.getMonth()) - (d.getDate() < from.getDate() ? 1 : 0);
  if (d.getTime() <= from.getTime()) return 0;
  return Math.max(1, months);
};

// Setoran per bulan yang dibutuhkan supaya tepat waktu (dibulatkan ke atas ke ribuan).
export const neededPerMonth = (target: number, saved: number, date: string | null | undefined) => {
  const m = monthsUntil(date);
  const remaining = target - saved;
  if (!m || remaining <= 0) return null;
  return Math.ceil(remaining / m / 1000) * 1000;
};

export type TargetInput = {
  name: string;
  targetAmount: number;
  targetDate: string;
  icon: string;
  color: string;
  // Setoran otomatis; amount 0 = tanpa.
  autoAmount: number;
  interval: SavingsGoal['interval'];
  accountId: string;
  nextDate: string;
};

export const targetService = {
  async create(input: TargetInput) {
    const res = await cloudflareApi<{ id: string }>('/api/member/recurring', {
      method: 'POST',
      json: {
        name: input.name,
        type: 'Tabungan',
        category: input.name,
        account_id: input.autoAmount > 0 ? input.accountId : '',
        amount: input.autoAmount,
        interval: input.interval,
        next_date: input.nextDate,
        status: 'ACTIVE',
        target_amount: input.targetAmount,
        target_date: input.targetDate,
        icon: input.icon,
        color: input.color,
      },
    });
    notifyCollectionChanged('recurring');
    return res.id;
  },

  // Kategori sengaja tidak diubah (lihat catatan di atas).
  async update(id: string, input: TargetInput) {
    await cloudflareApi(`/api/member/recurring/${id}`, {
      method: 'PUT',
      json: {
        name: input.name,
        account_id: input.autoAmount > 0 ? input.accountId : '',
        amount: input.autoAmount,
        interval: input.interval,
        next_date: input.nextDate,
        target_amount: input.targetAmount,
        target_date: input.targetDate,
        icon: input.icon,
        color: input.color,
      },
    });
    notifyCollectionChanged('recurring');
  },
};
