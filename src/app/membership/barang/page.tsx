"use client";

import { ItemsPage } from '@/components/items/ItemsPage';

const CATEGORIES = [
  { name: 'Elektronik', emoji: '📱' },
  { name: 'Komputer', emoji: '💻' },
  { name: 'Kendaraan', emoji: '🛵' },
  { name: 'Perabot', emoji: '🛋️' },
  { name: 'Fashion', emoji: '👜' },
  { name: 'Jam & perhiasan', emoji: '⌚' },
  { name: 'Hobi', emoji: '🎸' },
  { name: 'Lainnya', emoji: '📦' },
];

export default function BarangPage() {
  return <ItemsPage kind="barang" title="Barang" intro="HP, laptop, motor, jam tangan — lengkap dengan nilai dan masa garansinya." categories={CATEGORIES} />;
}
