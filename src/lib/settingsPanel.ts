import type { View } from '@/components/settings/SettingsPanel';

// Buka panel Pengaturan dari mana pun di /membership (mis. tautan "Atur
// anggaran" di Ringkasan). Halaman lain/di luar layout cukup menaut ke
// /membership/dashboard?pengaturan=<view> — layout membaca parameter itu.
export const OPEN_SETTINGS_EVENT = 'leosiqra:open-settings';

export const openSettings = (view: View = 'menu') => {
  window.dispatchEvent(new CustomEvent<View>(OPEN_SETTINGS_EVENT, { detail: view }));
};

export const SETTINGS_VIEWS_FROM_URL = ['menu', 'profil', 'paket', 'bantuan', 'umum', 'privasi', 'legal', 'kategori', 'mata-uang', 'kontak', 'notifikasi', 'ai', 'lainnya', 'referral', 'koin', 'fitur'] as const;
