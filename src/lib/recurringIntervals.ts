// Pilihan selang transaksi rutin — harus sama dengan RECURRING_INTERVALS di Worker.
export const RECURRING_INTERVALS = ['Harian', 'Mingguan', 'Dua Mingguan', 'Bulanan', 'Dua Bulanan', 'Tiga Bulanan', 'Tahunan'] as const;
export type RecurringInterval = (typeof RECURRING_INTERVALS)[number];

export const INTERVAL_LABEL: Record<RecurringInterval, string> = {
  Harian: 'Tiap hari',
  Mingguan: 'Tiap minggu',
  'Dua Mingguan': 'Tiap 2 minggu',
  Bulanan: 'Tiap bulan',
  'Dua Bulanan': 'Tiap 2 bulan',
  'Tiga Bulanan': 'Tiap 3 bulan',
  Tahunan: 'Tiap tahun',
};

// Berapa kali per bulan (untuk perkiraan total bulanan).
export const PER_MONTH: Record<string, number> = {
  Harian: 30,
  Mingguan: 52 / 12,
  'Dua Mingguan': 26 / 12,
  Bulanan: 1,
  'Dua Bulanan': 1 / 2,
  'Tiga Bulanan': 1 / 3,
  Tahunan: 1 / 12,
};

// Sama dengan advanceNextDate di Worker (tanggal 31 → akhir bulan tujuan).
export const advanceDate = (d: Date, interval: string): Date => {
  const n = new Date(d);
  if (interval === 'Harian') n.setDate(n.getDate() + 1);
  else if (interval === 'Mingguan') n.setDate(n.getDate() + 7);
  else if (interval === 'Dua Mingguan') n.setDate(n.getDate() + 14);
  else if (interval === 'Tahunan') n.setFullYear(n.getFullYear() + 1);
  else {
    const months = interval === 'Dua Bulanan' ? 2 : interval === 'Tiga Bulanan' ? 3 : 1;
    const day = n.getDate();
    n.setDate(1);
    n.setMonth(n.getMonth() + months);
    n.setDate(Math.min(day, new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate()));
  }
  return n;
};
