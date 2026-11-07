import { cloudflareApi } from '@/lib/cloudflare-api';

// Makanku — catatan makan harian (Worker: /api/member/meals, migrasi 0037).

export type MealSlot = 'sarapan' | 'siang' | 'malam' | 'camilan';
export type MealItem = {
  name: string;
  portion: string;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};
export type Meal = {
  id: string;
  date: string;
  time: string;
  slot: MealSlot;
  name: string;
  items: MealItem[];
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  score: number | null;
  tip: string | null;
  price: number | null;
  recorded: number;
  note: string | null;
  ai: number;
  has_photo: number;
  updated_at: string;
};
export type MealDay = {
  ready: boolean;
  date: string;
  today: string;
  items: Meal[];
  week: { date: string; count: number; kcal: number; spend: number }[];
  streak: number;
  target: number;
  foodSpendWeek: number;
  accounts: { id: string; name: string }[];
  ai: { used: number; limit: number; pro: boolean; proLimit: number };
};
export type MealAnalysis = {
  name: string;
  emoji: string;
  items: MealItem[];
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  price_estimate: number | null;
  score: number | null;
  tip: string;
};
export type NewMeal = {
  request_id: string;
  date: string;
  time: string;
  slot: MealSlot;
  name: string;
  items: MealItem[];
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  score: number | null;
  tip: string | null;
  price: number | null;
  record_expense: boolean;
  account_id: string | null;
  note: string | null;
  photoBase64: string | null;
  ai: boolean;
};

export const SLOTS: { id: MealSlot; label: string; emoji: string; tint: string }[] = [
  { id: 'sarapan', label: 'Sarapan', emoji: '🌅', tint: 'from-amber-100 to-orange-100 text-amber-700' },
  { id: 'siang', label: 'Makan siang', emoji: '☀️', tint: 'from-yellow-100 to-lime-100 text-lime-700' },
  { id: 'malam', label: 'Makan malam', emoji: '🌙', tint: 'from-indigo-100 to-violet-100 text-indigo-700' },
  { id: 'camilan', label: 'Camilan', emoji: '🍪', tint: 'from-pink-100 to-rose-100 text-rose-700' },
];
export const slotOf = (id: string) => SLOTS.find((s) => s.id === id) ?? SLOTS[3];
export const slotForTime = (time: string): MealSlot => {
  const h = Number(time.slice(0, 2));
  return h >= 4 && h < 10 ? 'sarapan' : h >= 10 && h < 15 ? 'siang' : h >= 17 && h < 22 ? 'malam' : 'camilan';
};
export const nowTimeWIB = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(11, 16);
export const mealPhotoUrl = (id: string, v: string) => `/api/member/meals/${id}/photo?v=${encodeURIComponent(v)}`;
export const newRequestId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));

export const mealService = {
  day: (date: string) => cloudflareApi<MealDay>(`/api/member/meals?date=${date}`, { cache: 'no-store' }),
  analyze: (imageBase64: string, hint?: string) =>
    cloudflareApi<MealAnalysis>('/api/member/meals/analyze', { method: 'POST', json: { imageBase64, hint } }),
  create: (meal: NewMeal) =>
    cloudflareApi<{ ok: true; id: string; tx_id?: string | null; duplicate?: boolean }>('/api/member/meals', {
      method: 'POST',
      json: meal,
    }),
  update: (
    id: string,
    patch: Partial<Pick<Meal, 'name' | 'slot' | 'time' | 'kcal' | 'protein' | 'carbs' | 'fat' | 'note'>>,
  ) => cloudflareApi<{ ok: true }>(`/api/member/meals/${id}`, { method: 'PATCH', json: patch }),
  remove: (id: string) =>
    cloudflareApi<{ ok: true; tx_kept: boolean }>(`/api/member/meals/${id}`, { method: 'DELETE' }),
  setTarget: (kcal: number) =>
    cloudflareApi<{ ok: true; target: number }>('/api/member/meals/target', { method: 'PUT', json: { kcal } }),
};
