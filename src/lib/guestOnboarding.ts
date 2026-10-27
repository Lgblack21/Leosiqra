// Onboarding tanpa akun (/mulai): pilihan & catatan pertama disimpan dulu di
// browser ini, lalu dibawa ke akun setelah daftar (GuestCarryOver). Tidak ada
// yang dikirim ke server sebelum user punya akun.
import type { QuickType } from '@/lib/quick/parse';

export const GUEST_GOALS = [
  { id: 'arus_uang', label: 'Tahu uangku lari ke mana' },
  { id: 'budget', label: 'Biar nggak boncos' },
  { id: 'nabung', label: 'Nabung buat sesuatu' },
  { id: 'hutang', label: 'Beresin hutang & cicilan' },
  { id: 'pajak', label: 'Siap lapor SPT' },
  { id: 'aset', label: 'Pantau semua aset' },
] as const;
export type GuestGoal = (typeof GUEST_GOALS)[number]['id'];

export const GUEST_INPUT_MODES = ['ketik', 'suara', 'foto'] as const;
export type GuestInputMode = (typeof GUEST_INPUT_MODES)[number];

export interface GuestNote {
  text: string;
  type: QuickType;
  amount: number;
  note: string;
  category?: string;
  subCategory?: string;
  createdAt: string;
}

export interface GuestOnboarding {
  goals: GuestGoal[];
  inputMode: GuestInputMode | null;
  reminder: { on: boolean; time: string };
  note: GuestNote | null;
  /** true setelah layar "Awal yang bagus" — dipakai untuk menawarkan simpan setelah daftar. */
  done: boolean;
}

const KEY = 'leosiqra-guest-onboarding';
export const EMPTY_GUEST: GuestOnboarding = { goals: [], inputMode: null, reminder: { on: false, time: '20:00' }, note: null, done: false };

export const loadGuest = (): GuestOnboarding | null => {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<GuestOnboarding>;
    return {
      goals: Array.isArray(v.goals) ? v.goals.filter((g): g is GuestGoal => GUEST_GOALS.some((x) => x.id === g)) : [],
      inputMode: GUEST_INPUT_MODES.includes(v.inputMode as GuestInputMode) ? (v.inputMode as GuestInputMode) : null,
      reminder: {
        on: v.reminder?.on === true,
        time: typeof v.reminder?.time === 'string' && /^([01]\d|2[0-3]):(00|30)$/.test(v.reminder.time) ? v.reminder.time : '20:00',
      },
      note:
        v.note && typeof v.note.amount === 'number' && v.note.amount > 0 && (v.note.type === 'pengeluaran' || v.note.type === 'pemasukan')
          ? v.note
          : null,
      done: v.done === true,
    };
  } catch {
    return null;
  }
};

export const saveGuest = (v: GuestOnboarding) => {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    // mode privat / penyimpanan penuh — alur tetap jalan, cuma tidak terbawa ke akun
  }
};

export const clearGuest = () => {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // abaikan
  }
};
