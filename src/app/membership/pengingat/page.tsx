"use client";

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Plus, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { useFeedback } from '@/components/ui/Feedback';
import { LeoMascot } from '@/components/mascot/LeoMascot';
import { Skeleton } from '@/components/ui/Skeleton';

// Pengingat: notifikasi push di jam & hari pilihanmu (dikirim server tiap
// 10 menit, jadi bisa telat beberapa menit). Butuh notifikasi push aktif.

type Reminder = { id: string; title: string; body: string | null; time_wib: string; days: number; enabled: number };
const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const PRESETS = [
  { title: 'Catat pengeluaran hari ini', body: 'Ada yang belum dicatat? Scan struk atau bilang saja ke Leo.', time: '21:00', days: 127 },
  { title: 'Tutup hari', body: 'Cek transaksi hari ini lalu jaga streak-mu.', time: '22:00', days: 127 },
  { title: 'Cek anggaran minggu ini', body: 'Lihat sisa anggaran sebelum akhir pekan.', time: '19:00', days: 1 << 5 },
  { title: 'Bayar tagihan bulanan', body: 'Listrik, internet, cicilan — sudah dibayar?', time: '09:00', days: 127 },
];
const daysLabel = (d: number) => (d === 127 ? 'Setiap hari' : d === 62 ? 'Hari kerja' : d === 65 ? 'Akhir pekan' : DAYS.filter((_, i) => d & (1 << i)).join(', '));

export default function PengingatPage() {
  const { toast, confirm } = useFeedback();
  const [items, setItems] = useState<Reminder[] | null>(null);
  const [error, setError] = useState('');
  const [edit, setEdit] = useState<Partial<Reminder> | null>(null);

  const load = useCallback(() => {
    cloudflareApi<{ items: Reminder[] }>('/api/member/reminders').then((r) => setItems(r.items)).catch((e) => { setItems([]); setError(e instanceof Error ? e.message : 'Gagal memuat.'); });
  }, []);
  useEffect(load, [load]);

  const save = async (r: Partial<Reminder>) => {
    const body = { title: r.title, body: r.body ?? '', time_wib: r.time_wib, days: r.days, enabled: r.enabled !== 0 };
    try {
      if (r.id) await cloudflareApi(`/api/member/reminders/${r.id}`, { method: 'PUT', json: body });
      else await cloudflareApi('/api/member/reminders', { method: 'POST', json: body });
      toast.success('Pengingat disimpan');
      setEdit(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan.');
    }
  };
  const toggle = (r: Reminder) => {
    setItems((cur) => cur?.map((x) => (x.id === r.id ? { ...x, enabled: r.enabled ? 0 : 1 } : x)) ?? cur);
    void cloudflareApi(`/api/member/reminders/${r.id}`, { method: 'PUT', json: { ...r, body: r.body ?? '', enabled: !r.enabled } }).catch(() => load());
  };
  const remove = async (r: Reminder) => {
    if (!(await confirm({ title: `Hapus “${r.title}”?`, confirmLabel: 'Hapus', danger: true }))) return;
    await cloudflareApi(`/api/member/reminders/${r.id}`, { method: 'DELETE' }).catch(() => {});
    setEdit(null);
    load();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Leo kirim notifikasi di jam yang kamu pilih. Pastikan notifikasi aktif di Profil.</p>
        <button type="button" onClick={() => setEdit({ title: '', time_wib: '21:00', days: 127, enabled: 1 })} className="flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"><Plus size={15} /> Tambah pengingat</button>
      </div>

      {error && <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>}
      {items === null ? <Skeleton className="h-40 rounded-3xl" /> : items.length === 0 ? (
        <div className="rounded-[24px] bg-slate-100/70 p-6 text-center">
          <LeoMascot mood="idle" size={80} />
          <p className="mt-2 font-bold text-slate-900">Belum ada pengingat</p>
          <p className="text-sm text-slate-500">Mulai dari salah satu ini:</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {PRESETS.map((p) => (
              <button key={p.title} type="button" onClick={() => save({ title: p.title, body: p.body, time_wib: p.time, days: p.days, enabled: 1 })} className="rounded-2xl bg-white p-3 text-left ring-1 ring-slate-200 hover:ring-indigo-300">
                <span className="block text-sm font-bold text-slate-800">{p.title}</span>
                <span className="text-xs text-slate-500">{p.time} · {daysLabel(p.days)}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-[24px] bg-slate-100/70">
          {items.map((r) => (
            <li key={r.id} className="flex items-center gap-3 border-b border-slate-200/60 px-4 py-3.5 last:border-0">
              <button type="button" onClick={() => setEdit(r)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <span className={cn('text-2xl font-extrabold tabular-nums', r.enabled ? 'text-slate-900' : 'text-slate-300')}>{r.time_wib}</span>
                <span className="min-w-0">
                  <span className={cn('block truncate text-[15px] font-semibold', r.enabled ? 'text-slate-800' : 'text-slate-400')}>{r.title}</span>
                  <span className="text-xs text-slate-500">{daysLabel(r.days)}</span>
                </span>
              </button>
              <button type="button" role="switch" aria-checked={Boolean(r.enabled)} aria-label={`Aktifkan ${r.title}`} onClick={() => toggle(r)} className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', r.enabled ? 'bg-emerald-500' : 'bg-slate-300')}>
                <motion.span layout className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow', r.enabled ? 'right-0.5' : 'left-0.5')} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <AnimatePresence>
        {edit && (
          <motion.div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-6 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEdit(null)} role="dialog" aria-modal="true" aria-label="Pengingat">
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-[28px] bg-white p-5 shadow-2xl">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-lg font-extrabold text-slate-900"><Bell size={18} /> {edit.id ? 'Ubah pengingat' : 'Pengingat baru'}</p>
                <button type="button" onClick={() => setEdit(null)} aria-label="Tutup" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
              </div>
              <input type="time" aria-label="Jam" value={edit.time_wib ?? '21:00'} onChange={(e) => setEdit({ ...edit, time_wib: e.target.value })} className="mt-4 w-full rounded-2xl bg-slate-100 px-4 py-3 text-center text-3xl font-extrabold tabular-nums outline-none" />
              <input value={edit.title ?? ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="Judul, mis. Catat pengeluaran" aria-label="Judul" className="mt-3 w-full rounded-2xl bg-slate-100 px-4 py-3 text-[15px] outline-none focus:bg-white focus:ring-1 focus:ring-indigo-300" />
              <input value={edit.body ?? ''} onChange={(e) => setEdit({ ...edit, body: e.target.value })} placeholder="Pesan (opsional)" aria-label="Pesan" className="mt-2 w-full rounded-2xl bg-slate-100 px-4 py-3 text-[15px] outline-none focus:bg-white focus:ring-1 focus:ring-indigo-300" />
              <div className="mt-3 flex justify-between gap-1">
                {DAYS.map((d, i) => {
                  const on = ((edit.days ?? 127) & (1 << i)) !== 0;
                  return <button key={d} type="button" onClick={() => setEdit({ ...edit, days: (edit.days ?? 127) ^ (1 << i) })} className={cn('h-10 flex-1 rounded-xl text-xs font-bold', on ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500')}>{d}</button>;
                })}
              </div>
              <p className="mt-2 text-xs text-slate-400">Waktu WIB. Dikirim paling lambat 10 menit setelah jamnya.</p>
              <div className="mt-4 flex gap-2">
                {edit.id && <button type="button" onClick={() => remove(edit as Reminder)} aria-label="Hapus" className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-500"><Trash2 size={17} /></button>}
                <button type="button" onClick={() => save(edit)} disabled={!edit.title?.trim() || !edit.days} className="h-12 flex-1 rounded-full bg-slate-900 text-sm font-bold text-white disabled:bg-slate-200 disabled:text-slate-400">Simpan</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
