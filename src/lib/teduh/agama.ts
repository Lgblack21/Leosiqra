// Teduh — ruang tenang untuk semua agama yang diakui di Indonesia.
// Pilihan agama = data pribadi spesifik (UU PDP) → HANYA disimpan di perangkat (localStorage), tidak ke server.
export type AgamaId = 'islam' | 'kristen' | 'katolik' | 'hindu' | 'buddha' | 'konghucu';
export type Agama = {
  id: AgamaId;
  nama: string;
  kitab: string;
  emoji: string;
  siap: boolean;
  /** Cara memberi yang dikenal tiap agama — untuk kaitan ke catatan keuangan. */
  memberi: string;
  tint: string;
};
export const AGAMA: Agama[] = [
  {
    id: 'islam',
    nama: 'Islam',
    kitab: "Al-Qur'an",
    emoji: '🌙',
    siap: true,
    memberi: 'Sedekah',
    tint: 'from-emerald-50 to-teal-100 text-emerald-800',
  },
  {
    id: 'kristen',
    nama: 'Kristen',
    kitab: 'Alkitab',
    emoji: '✝️',
    siap: false,
    memberi: 'Persembahan',
    tint: 'from-sky-50 to-indigo-100 text-indigo-800',
  },
  {
    id: 'katolik',
    nama: 'Katolik',
    kitab: 'Alkitab (Deuterokanonika)',
    emoji: '⛪',
    siap: false,
    memberi: 'Kolekte',
    tint: 'from-amber-50 to-orange-100 text-amber-900',
  },
  {
    id: 'hindu',
    nama: 'Hindu',
    kitab: 'Weda & Bhagawad Gita',
    emoji: '🕉️',
    siap: false,
    memberi: 'Dana punia',
    tint: 'from-orange-50 to-rose-100 text-orange-900',
  },
  {
    id: 'buddha',
    nama: 'Buddha',
    kitab: 'Tipitaka (Dhammapada)',
    emoji: '☸️',
    siap: false,
    memberi: 'Dana',
    tint: 'from-yellow-50 to-amber-100 text-amber-900',
  },
  {
    id: 'konghucu',
    nama: 'Konghucu',
    kitab: 'Si Shu (Kitab Yang Empat)',
    emoji: '☯️',
    siap: false,
    memberi: 'Dana kebajikan',
    tint: 'from-rose-50 to-red-100 text-red-900',
  },
];
const KEY = 'leosiqra-teduh-agama';
export const agamaPilihan = {
  get(): AgamaId | null {
    try {
      const v = localStorage.getItem(KEY);
      return AGAMA.some((a) => a.id === v) ? (v as AgamaId) : null;
    } catch {
      return null;
    }
  },
  set(v: AgamaId | null) {
    try {
      if (v) localStorage.setItem(KEY, v);
      else localStorage.removeItem(KEY);
    } catch {
      /* penyimpanan diblokir */
    }
  },
};
