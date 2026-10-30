"use client";

import { useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { PencilLine, Search, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { LogoImage } from '@/components/ui/LogoImage';
import { matchIndonesianInstitutionLogo } from '@/lib/indonesianBanks';
import { cn } from '@/lib/utils';

// Pemilih "Tambah akun" di halaman Kekayaan: cari / saring, ketuk satu →
// form Rekening (AccountModal) terbuka dengan nama, jenis & logo terisi.
// Investasi & kripto sengaja tidak di sini — dicatat di Investasiku, bukan
// sebagai rekening.

export type AccountPick = { name: string; type: string; logoUrl?: string } | 'kartu' | 'manual';
type Item = { name: string; type: 'Bank Account' | 'E-Wallet' | 'Cash'; emoji?: string; hint?: string };

const BANKS = ['BCA', 'Mandiri', 'BRI', 'BNI', 'BSI', 'BTN', 'CIMB Niaga', 'Permata', 'Danamon', 'OCBC', 'Bank Jago', 'Jenius', 'SeaBank', 'blu', 'Allo Bank', 'Krom', 'Maybank', 'DBS', 'UOB', 'HSBC', 'Citibank', 'Standard Chartered', 'Bank Mega', 'Sinarmas', 'Panin', 'BJB'];
const WALLETS = ['GoPay', 'OVO', 'DANA', 'ShopeePay', 'LinkAja', 'Flip', 'PayPal', 'Wise', 'Revolut'];
const ITEMS: Item[] = [
  ...BANKS.map((name) => ({ name, type: 'Bank Account' as const })),
  ...WALLETS.map((name) => ({ name, type: 'E-Wallet' as const })),
  { name: 'Tunai', type: 'Cash', emoji: '💵', hint: 'Uang di dompet' },
];
const FILTERS = [
  { id: 'semua', label: 'Semua' },
  { id: 'Bank Account', label: 'Bank' },
  { id: 'E-Wallet', label: 'E-wallet & bayar' },
] as const;
const SECTION: Record<Item['type'], string> = { 'Bank Account': 'Bank', 'E-Wallet': 'E-wallet & pembayaran', Cash: 'Tunai' };

export function AddAccountPicker({ isOpen, onClose, onPick }: { isOpen: boolean; onClose: () => void; onPick: (p: AccountPick) => void }) {
  const reduce = useReducedMotion();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('semua');

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return ITEMS.filter((i) => (filter === 'semua' || i.type === filter) && (!term || i.name.toLowerCase().includes(term)));
  }, [q, filter]);
  const groups = (['Bank Account', 'E-Wallet', 'Cash'] as const).map((t) => ({ t, items: shown.filter((i) => i.type === t) })).filter((g) => g.items.length);
  const close = () => { setQ(''); setFilter('semua'); onClose(); };
  const pick = (p: AccountPick) => { setQ(''); setFilter('semua'); onPick(p); };

  return (
    <Modal isOpen={isOpen} onClose={close} title="Tambah akun" maxWidth="max-w-2xl">
      <div className="space-y-4">
        <div className="relative">
          <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari bank atau e-wallet…" aria-label="Cari bank atau e-wallet" className="w-full rounded-full bg-slate-100 py-3 pl-11 pr-10 text-[15px] text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-300" />
          {q && <button type="button" onClick={() => setQ('')} aria-label="Hapus pencarian" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-200"><X size={15} /></button>}
        </div>

        <LayoutGroup id="acc-pick-filter">
          <div className="flex gap-1.5">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" onClick={() => setFilter(f.id)} aria-pressed={filter === f.id} className={cn('relative rounded-full px-3.5 py-1.5 text-[13px] font-semibold', filter === f.id ? 'text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100')}>
                {filter === f.id && <motion.span layoutId={reduce ? undefined : 'acc-pick-pill'} className="absolute inset-0 rounded-full bg-slate-900" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                <span className="relative">{f.label}</span>
              </button>
            ))}
          </div>
        </LayoutGroup>

        {/* Pintasan khusus */}
        {!q && filter === 'semua' && (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => pick('kartu')} className="group flex items-center gap-3 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-900 p-3 text-left text-white">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-[20px] transition-transform group-hover:scale-110">💳</span>
              <span><span className="block text-[14px] font-bold">Kartu kredit</span><span className="block text-[11px] text-white/60">Limit & jatuh tempo</span></span>
            </button>
            <button type="button" onClick={() => pick('manual')} className="group flex items-center gap-3 rounded-2xl bg-slate-50 p-3 text-left ring-1 ring-slate-200 hover:bg-slate-100">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600 ring-1 ring-slate-200 transition-transform group-hover:scale-110"><PencilLine size={18} /></span>
              <span><span className="block text-[14px] font-bold text-slate-900">Isi manual</span><span className="block text-[11px] text-slate-500">Bank lain, dompet, dll</span></span>
            </button>
          </div>
        )}

        <div className="max-h-[52vh] space-y-5 overflow-y-auto pr-1">
          <AnimatePresence mode="popLayout" initial={false}>
            {groups.map((g) => (
              <motion.section key={g.t} layout={!reduce} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduce ? undefined : { opacity: 0 }}>
                <p className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-wide text-slate-400">{SECTION[g.t]}</p>
                <div className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-5">
                  {g.items.map((i, idx) => {
                    const logo = matchIndonesianInstitutionLogo(i.name, i.type);
                    return (
                      <motion.button
                        key={i.name}
                        type="button"
                        onClick={() => pick({ name: i.name, type: i.type, logoUrl: logo ?? undefined })}
                        initial={reduce ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(idx, 12) * 0.015 }}
                        whileTap={reduce ? undefined : { scale: 0.94 }}
                        className="group flex flex-col items-center gap-1.5 rounded-2xl p-1.5 text-center hover:bg-slate-50"
                      >
                        <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[18px] bg-white shadow-[0_6px_16px_-8px_rgba(15,23,42,0.35)] ring-1 ring-slate-100 transition-transform group-hover:-translate-y-0.5">
                          {i.emoji ? <span className="text-[26px]">{i.emoji}</span> : (
                            <LogoImage src={logo} alt={i.name} fallbackText={i.name.slice(0, 3).toUpperCase()} className="h-full w-full object-contain p-1.5" />
                          )}
                        </span>
                        <span className="line-clamp-2 text-[12px] font-semibold leading-tight text-slate-700">{i.name}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.section>
            ))}
          </AnimatePresence>
          {groups.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-[14px] font-semibold text-slate-800">“{q}” belum ada di daftar</p>
              <button type="button" onClick={() => pick({ name: q.trim(), type: 'Bank Account' })} className="mt-3 rounded-full bg-slate-900 px-4 py-2 text-[13px] font-bold text-white hover:bg-slate-800">Tambah “{q.trim()}” manual</button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
