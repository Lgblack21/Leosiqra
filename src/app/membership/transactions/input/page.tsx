"use client";

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown,
  ArrowLeftRight,
  FileSpreadsheet,
  Briefcase,
  Landmark,
  Coins,
  PiggyBank,
  HandCoins,
  ChevronRight,
  PlusCircle,
  type LucideIcon,
} from 'lucide-react';
import { cn, formatIDR, isIncomingTransaction } from '@/lib/utils';
import { useModal, ModalType } from '@/context/ModalContext';
import { auth } from '@/lib/cf-client';
import { onAuthStateChanged } from '@/lib/cf-auth';
import { transactionService, Transaction } from '@/lib/services/transactionService';
import { subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

interface Action { id: ModalType; label: string; desc: string; icon: LucideIcon; color: string }

const secondaryActions: Action[] = [
  { id: 'topup_transfer', label: 'Transfer & Top Up', desc: 'Pindah dana antar rekening sendiri atau isi saldo e-wallet.', icon: ArrowLeftRight, color: 'bg-cyan-50 text-cyan-600' },
  { id: 'import_mutasi', label: 'Impor Mutasi (CSV)', desc: 'Upload export mutasi bank/e-wallet jadi riwayat transaksi.', icon: FileSpreadsheet, color: 'bg-emerald-50 text-emerald-600' },
];

const otherActions: Action[] = [
  { id: 'tabungan', label: 'Tabungan', desc: 'Setor atau tarik dana tabungan.', icon: PiggyBank, color: 'bg-rose-50 text-rose-600' },
  { id: 'saham', label: 'Saham', desc: 'Beli/jual saham dan update portofolio.', icon: Briefcase, color: 'bg-blue-50 text-blue-600' },
  { id: 'deposito', label: 'Deposito', desc: 'Penempatan dana berjangka & bunganya.', icon: Landmark, color: 'bg-indigo-50 text-indigo-600' },
  { id: 'investasi_lain', label: 'Investasi Lainnya', desc: 'Emas, kripto, reksadana, properti.', icon: Coins, color: 'bg-purple-50 text-purple-600' },
  { id: 'hutang_piutang', label: 'Hutang & Piutang', desc: 'Catat pinjaman, cicilan, dan tagihan.', icon: HandCoins, color: 'bg-orange-50 text-orange-600' },
];

function ActionTile({ action, onClick }: { action: Action; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-white rounded-card border border-slate-100 shadow-sm p-4 md:p-5 flex items-center gap-4 hover:shadow-md hover:border-slate-200 transition-all group focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
    >
      <span className={cn('w-11 h-11 rounded-control flex items-center justify-center shrink-0', action.color)}>
        <action.icon size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-slate-900">{action.label}</span>
        <span className="block text-caption text-slate-400 mt-0.5">{action.desc}</span>
      </span>
      <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all shrink-0" />
    </button>
  );
}

export default function InputTransactionPage() {
  const { openModal } = useModal();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(true);

  useEffect(() => {
    let active = true;
    const load = () =>
      transactionService
        .getUserTransactions('session')
        .then((items) => { if (active) setTransactions(items); })
        .catch((err) => {
          console.error('Gagal memuat ringkasan transaksi hari ini:', err);
          if (active) setTransactions([]);
        })
        .finally(() => { if (active) setLoadingSummary(false); });

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (!u) {
        setTransactions([]);
        setLoadingSummary(false);
        return;
      }
      load();
    });
    // Refetch tiap ada transaksi baru dari modal mana pun, supaya ringkasan
    // "hari ini" langsung ikut ter-update setelah user mencatat.
    const unsubTrx = subscribeToCollectionChanges('transactions', load);
    return () => {
      active = false;
      unsubAuth();
      unsubTrx();
    };
  }, []);

  // Catatan Hutang/Piutang (type "debt") bukan arus kas — sama seperti di
  // Dashboard & Riwayat Transaksi, tidak ikut dihitung di sini.
  const todayEntries = useMemo(() => {
    const today = new Date();
    return transactions
      .filter((t) => t.type !== 'debt' && isSameDay(t.date, today))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [transactions]);

  // Digabung lintas rekening, jadi pakai amountIDR (sudah dikonversi saat
  // transaksi disimpan) — bukan .amount mentah.
  const toIdr = (t: Transaction) => Number(t.amountIDR) || Number(t.amount) || 0;
  const todayIn = todayEntries.filter((t) => t.type === 'pemasukan').reduce((s, t) => s + toIdr(t), 0);
  const todayOut = todayEntries.filter((t) => t.type === 'pengeluaran').reduce((s, t) => s + toIdr(t), 0);

  return (
    <div className="space-y-6 md:space-y-8 max-w-[1400px] pb-12">
      <PageHeader
        icon={<PlusCircle size={22} />}
        title="Catat Transaksi"
        subtitle="Pilih jenis catatan. Saldo rekening langsung ter-update setelah disimpan."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Aksi utama */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          <button
            type="button"
            onClick={() => openModal('harian')}
            className="w-full text-left bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-card p-6 md:p-8 shadow-xl shadow-emerald-600/15 relative overflow-hidden hover:shadow-2xl hover:-translate-y-0.5 transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300"
          >
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
            <div className="flex items-start justify-between gap-4">
              <span className="w-12 h-12 rounded-control bg-white/15 flex items-center justify-center">
                <ArrowUpDown size={22} />
              </span>
              <span className="text-label font-bold uppercase bg-white/15 px-2.5 py-1 rounded-full">Paling sering</span>
            </div>
            <p className="mt-6 text-xl md:text-2xl font-black">Pemasukan / Pengeluaran</p>
            <p className="mt-1 text-sm text-emerald-50/90 max-w-md">
              Gaji, belanja, makan, tagihan — semua uang masuk & keluar sehari-hari.
            </p>
            <span className="mt-5 inline-flex items-center gap-1 text-sm font-bold">
              Catat sekarang <ChevronRight size={16} />
            </span>
          </button>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {secondaryActions.map((a) => (
              <ActionTile key={a.id} action={a} onClick={() => openModal(a.id)} />
            ))}
          </div>

          <div>
            <p className="text-label font-bold text-slate-400 uppercase mb-3">Aset, investasi & kewajiban</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              {otherActions.map((a) => (
                <ActionTile key={a.id} action={a} onClick={() => openModal(a.id)} />
              ))}
            </div>
          </div>
        </div>

        {/* Ringkasan hari ini */}
        <Card className="p-5 md:p-6 h-fit">
          <CardHeader title="Hari ini" />
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-control bg-emerald-50/60 p-3">
              <p className="text-caption font-medium text-emerald-700">Masuk</p>
              {loadingSummary ? <Skeleton className="h-5 mt-1" /> : (
                <p className="text-sm font-black text-emerald-600 tabular-nums truncate">{formatIDR(todayIn)}</p>
              )}
            </div>
            <div className="rounded-control bg-rose-50/60 p-3">
              <p className="text-caption font-medium text-rose-700">Keluar</p>
              {loadingSummary ? <Skeleton className="h-5 mt-1" /> : (
                <p className="text-sm font-black text-rose-500 tabular-nums truncate">{formatIDR(todayOut)}</p>
              )}
            </div>
          </div>

          <p className="text-label font-bold text-slate-400 uppercase mt-6 mb-2">
            Terakhir dicatat {!loadingSummary && `· ${todayEntries.length} transaksi`}
          </p>
          {loadingSummary ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : todayEntries.length === 0 ? (
            <p className="text-sm text-slate-400 py-3">Belum ada transaksi hari ini.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {todayEntries.slice(0, 5).map((t) => {
                const incoming = isIncomingTransaction(t);
                return (
                  <li key={t.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{t.note || t.category}</p>
                      <p className="text-caption text-slate-400 truncate">{t.category}</p>
                    </div>
                    <p className={cn('text-sm font-black tabular-nums whitespace-nowrap', incoming ? 'text-emerald-600' : 'text-rose-500')}>
                      {incoming ? '+' : '−'}{formatIDR(toIdr(t))}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
