"use client";

import { ItemsPage } from '@/components/items/ItemsPage';

const CATEGORIES = [
  { name: 'Kartu', emoji: '🃏' },
  { name: 'Sneakers', emoji: '👟' },
  { name: 'Figur & mainan', emoji: '🧸' },
  { name: 'Koin & uang kuno', emoji: '🪙' },
  { name: 'Item game', emoji: '🎮' },
  { name: 'Seni', emoji: '🖼️' },
  { name: 'Barang mewah', emoji: '💎' },
  { name: 'Lainnya', emoji: '✨' },
];

export default function KoleksiPage() {
  return <ItemsPage kind="koleksi" title="Koleksi" intro="Kartu, sneakers, figur, koin — catat nilainya supaya tahu koleksimu sekarang berapa." categories={CATEGORIES} />;
}
