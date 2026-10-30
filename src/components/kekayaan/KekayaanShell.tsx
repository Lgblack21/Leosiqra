"use client";

import { useEffect, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeftRight, Car, CreditCard, HandCoins, Package, PieChart, PiggyBank, Plus, TrendingUp, Wallet } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useModal } from '@/context/ModalContext';
import { AddAccountPicker, type AccountPick } from '@/components/kekayaan/AddAccountPicker';
import { AddInvestmentModal } from '@/components/kekayaan/AddInvestmentModal';
import { HeaderSlot } from '@/components/Header';
import { RingkasanKekayaan } from '@/components/kekayaan/RingkasanKekayaan';
import TabunganPanel from '@/components/kekayaan/TabunganPanel';
import HutangPanel from '@/components/kekayaan/HutangPanel';
import { cn } from '@/lib/utils';

// Halaman Kekayaan: Tabungan + Hutang & Piutang + ringkasan kekayaan bersih
// jadi satu (2026-10-30). Tab di hash URL (#tabungan, #hutang) supaya tautan
// lama (/membership/tabungan, /transactions/debt) bisa diarahkan ke sini.

export type KekayaanTab = 'ringkasan' | 'tabungan' | 'hutang';
const TABS: { id: KekayaanTab; label: string; icon: typeof PieChart }[] = [
  { id: 'ringkasan', label: 'Ringkasan', icon: PieChart },
  { id: 'tabungan', label: 'Tabungan', icon: PiggyBank },
  { id: 'hutang', label: 'Hutang & Piutang', icon: HandCoins },
];
const fromHash = (): KekayaanTab => {
  const h = window.location.hash.slice(1) as KekayaanTab;
  return TABS.some((t) => t.id === h) ? h : 'ringkasan';
};

export function KekayaanShell() {
  const reduce = useReducedMotion();
  const [tab, setTab] = useState<KekayaanTab>('ringkasan');
  const { openModal } = useModal();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [investOpen, setInvestOpen] = useState(false);
  const addAccount = () => { setMenuOpen(false); setPickerOpen(true); };
  const onPick = (p: AccountPick) => {
    setPickerOpen(false);
    if (p === 'kartu') openModal('kartu');
    else if (p === 'manual') openModal('rekening');
    else openModal('rekening', p);
  };
  const run = (f: () => void) => () => { setMenuOpen(false); f(); };
  // Menu "Tambah" — dibangun bertahap; yang belum ada ditandai "Segera".
  const ADD: { label: string; desc: string; icon: typeof Plus; tone: string; on?: () => void }[] = [
    { label: 'Akun', desc: 'Bank, e-wallet, tunai', icon: Wallet, tone: 'bg-sky-50 text-sky-600', on: addAccount },
    { label: 'Kartu kredit', desc: 'Limit & jatuh tempo', icon: CreditCard, tone: 'bg-indigo-50 text-indigo-600', on: run(() => openModal('kartu')) },
    { label: 'Investasi', desc: 'Saham, kripto, emas, dll', icon: TrendingUp, tone: 'bg-violet-50 text-violet-600', on: run(() => setInvestOpen(true)) },
    { label: 'Target tabungan', desc: 'Dana darurat, liburan', icon: PiggyBank, tone: 'bg-pink-50 text-pink-600', on: run(() => go('tabungan')) },
    { label: 'Piutang / utang', desc: 'Pinjam & meminjamkan', icon: HandCoins, tone: 'bg-emerald-50 text-emerald-600', on: run(() => openModal('hutang_piutang')) },
    { label: 'Transfer', desc: 'Pindah dana antar akun', icon: ArrowLeftRight, tone: 'bg-cyan-50 text-cyan-600', on: run(() => openModal('topup_transfer')) },
    { label: 'Properti / kendaraan', desc: 'Rumah, tanah, motor', icon: Car, tone: 'bg-slate-100 text-slate-400' },
    { label: 'Barang & koleksi', desc: 'HP, laptop, jam, kartu', icon: Package, tone: 'bg-slate-100 text-slate-400' },
  ];

  useEffect(() => {
    const sync = () => setTab(fromHash());
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const go = (t: KekayaanTab) => {
    if (t === tab) return;
    window.history.pushState(null, '', t === 'ringkasan' ? window.location.pathname : `#${t}`);
    setTab(t);
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <div className="mx-auto mb-12 max-w-[1400px] space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-extrabold tracking-tight text-slate-900 md:text-[30px]">Kekayaan</h1>
            <p className="text-[14px] text-slate-500">Semua yang kamu punya dan yang masih harus dibayar, di satu tempat.</p>
          </div>
          <HeaderSlot className="md:hidden" />
        </div>
        <div className="flex items-center gap-2">
          <LayoutGroup id="kekayaan-tabs">
            <div role="tablist" aria-label="Bagian kekayaan" className="flex flex-1 gap-1 rounded-full bg-slate-100 p-1 md:flex-none">
              {TABS.map((t) => {
                const active = t.id === tab;
                return (
                  <button key={t.id} type="button" role="tab" aria-selected={active} onClick={() => go(t.id)} className={cn('relative flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-[13px] font-semibold md:flex-none md:px-4', active ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700')}>
                    {active && <motion.span layoutId={reduce ? undefined : 'kekayaan-tab'} className="absolute inset-0 rounded-full bg-white shadow-sm" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                    <t.icon size={15} className="relative hidden sm:block" />
                    <span className="relative">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </LayoutGroup>
          <button type="button" onClick={() => setMenuOpen(true)} aria-label="Tambah" className="flex h-10 w-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-slate-900 text-[13px] font-bold text-white shadow-sm hover:bg-slate-800 sm:h-auto sm:w-auto sm:px-4 sm:py-2.5">
            <Plus size={17} strokeWidth={2.6} /> <span className="hidden sm:inline">Tambah</span>
          </button>
          <HeaderSlot className="hidden md:flex" />
        </div>
      </div>

      <Modal isOpen={menuOpen} onClose={() => setMenuOpen(false)} title="Tambah ke kekayaan" maxWidth="max-w-lg">
        <div className="grid grid-cols-2 gap-2">
          {ADD.map((a, i) => (
            <motion.button
              key={a.label}
              type="button"
              onClick={a.on}
              disabled={!a.on}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              whileTap={reduce || !a.on ? undefined : { scale: 0.96 }}
              className={cn('relative flex items-start gap-3 rounded-2xl p-3 text-left ring-1 transition-colors', a.on ? 'bg-white ring-slate-200 hover:bg-slate-50' : 'cursor-not-allowed bg-slate-50 ring-slate-100')}
            >
              <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', a.tone)}><a.icon size={19} /></span>
              <span className="min-w-0">
                <span className={cn('block text-[14px] font-bold', a.on ? 'text-slate-900' : 'text-slate-400')}>{a.label}</span>
                <span className="block text-[11px] leading-snug text-slate-400">{a.desc}</span>
              </span>
              {!a.on && <span className="absolute right-2 top-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700">Segera</span>}
            </motion.button>
          ))}
        </div>
      </Modal>
      <AddAccountPicker isOpen={pickerOpen} onClose={() => setPickerOpen(false)} onPick={onPick} />
      <AddInvestmentModal isOpen={investOpen} onClose={() => setInvestOpen(false)} onDeposito={() => openModal('deposito')} />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
          {tab === 'ringkasan' && <RingkasanKekayaan go={go} onAddAccount={addAccount} />}
          {tab === 'tabungan' && <TabunganPanel />}
          {tab === 'hutang' && <HutangPanel />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
