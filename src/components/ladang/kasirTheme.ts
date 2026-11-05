// Tema kasir (kelas literal untuk Tailwind). Nama = pilihan `theme` di Worker.
export const KASIR_THEME: Record<string, { label: string; swatch: string; header: string; chip: string }> = {
  ungu: { label: 'Ungu', swatch: '#7c3aed', header: 'bg-[radial-gradient(120%_140%_at_100%_0%,#7c3aed_0%,#4c1d95_38%,#0b1220_82%)]', chip: 'bg-violet-600 text-white' },
  hijau: { label: 'Hijau', swatch: '#059669', header: 'bg-[radial-gradient(120%_140%_at_100%_0%,#10b981_0%,#065f46_38%,#03140f_82%)]', chip: 'bg-emerald-600 text-white' },
  biru: { label: 'Biru', swatch: '#2563eb', header: 'bg-[radial-gradient(120%_140%_at_100%_0%,#3b82f6_0%,#1e3a8a_38%,#050b1f_82%)]', chip: 'bg-blue-600 text-white' },
  oranye: { label: 'Oranye', swatch: '#f97316', header: 'bg-[radial-gradient(120%_140%_at_100%_0%,#fb923c_0%,#9a3412_40%,#1c0a03_84%)]', chip: 'bg-orange-500 text-white' },
  merah: { label: 'Merah', swatch: '#e11d48', header: 'bg-[radial-gradient(120%_140%_at_100%_0%,#f43f5e_0%,#881337_40%,#1a0309_84%)]', chip: 'bg-rose-600 text-white' },
  pink: { label: 'Pink', swatch: '#db2777', header: 'bg-[radial-gradient(120%_140%_at_100%_0%,#ec4899_0%,#831843_40%,#1a0410_84%)]', chip: 'bg-pink-600 text-white' },
  gelap: { label: 'Gelap', swatch: '#1e293b', header: 'bg-[radial-gradient(120%_140%_at_100%_0%,#475569_0%,#0f172a_45%,#020617_85%)]', chip: 'bg-slate-900 text-white dark:bg-slate-700' },
  emas: { label: 'Emas', swatch: '#d97706', header: 'bg-[radial-gradient(120%_140%_at_100%_0%,#f59e0b_0%,#78350f_42%,#140a02_85%)]', chip: 'bg-amber-500 text-slate-950' },
};
