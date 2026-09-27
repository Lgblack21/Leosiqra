"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  Building2,
  Wallet,
  Landmark,
  Banknote,
  CreditCard,
  Edit2,
  Trash2,
  ChevronRight,
  ShieldCheck,
  Plus,
  X
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { LogoImage } from '@/components/ui/LogoImage';
import { accountService, Account, parseAccountPayload } from '@/lib/services/accountService';
import { Transaction } from '@/lib/services/transactionService';
import { exchangeRateService, ExchangeRates } from '@/lib/services/exchangeRateService';
import { auth, db } from '@/lib/cf-client';
import { onAuthStateChanged, User } from '@/lib/cf-auth';
import { collection, query, where, onSnapshot } from '@/lib/cf-firestore';
import { AccountModal } from '@/components/modals/AccountModal';
import { isCreditAccountType, computeCreditUsage } from '@/lib/creditCard';
import { useModal } from '@/context/ModalContext';
import { cn, formatIDR, formatMoney } from '@/lib/utils';
import { useFeedback } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';

export default function RekeningPage() {
  const { toast, confirm } = useFeedback();
  const { activeModal } = useModal();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [fxRates, setFxRates] = useState<ExchangeRates>({});
  const [showSecurityBanner, setShowSecurityBanner] = useState(true);

  useEffect(() => {
    if (localStorage.getItem('rekening-security-banner-dismissed') === '1') {
      setShowSecurityBanner(false);
    }
  }, []);

  const dismissSecurityBanner = () => {
    setShowSecurityBanner(false);
    localStorage.setItem('rekening-security-banner-dismissed', '1');
  };

  useEffect(() => {
    exchangeRateService.getLatestRates().then(setFxRates).catch(console.error);
  }, []);

  const unsubRef = useRef<(() => void) | null>(null);
  const unsubTrxRef = useRef<(() => void) | null>(null);

  // Dipakai baik saat auth berubah maupun saat modal transaksi/rekening manapun
  // ditutup, supaya Saldo tidak stale — onSnapshot di sini cuma sekali ambil
  // data (bukan live subscription sungguhan), jadi harus dipanggil ulang manual.
  const subscribeAccountsAndTransactions = (u: User) => {
    // Transaksi dipakai untuk menghitung terpakai/sisa limit kartu kredit
    // & paylater — lihat lib/creditCard.ts.
    const qTrx = query(collection(db, 'transactions'), where('userId', '==', u.uid));
    if (unsubTrxRef.current) unsubTrxRef.current();
    unsubTrxRef.current = onSnapshot(qTrx, (snap) => {
      setTransactions(snap.docs.map(doc => {
        const d = doc.data();
        return { ...d, id: doc.id, amount: Number(d.amount) || 0, date: d.date?.toDate?.() ?? new Date(), createdAt: d.createdAt?.toDate?.() ?? new Date() } as Transaction;
      }));
    }, (err) => console.error(err));

    const q = query(collection(db, 'accounts'), where('userId', '==', u.uid));
    if (unsubRef.current) unsubRef.current();
    const unsubSnap = onSnapshot(q, (snap) => {
      setAccounts(snap.docs.map(doc => {
        const d = doc.data();
        // payload_json menyimpan cardColor & creditLimit — wajib di-parse, kalau
        // tidak keduanya hilang saat rekening ini diedit lewat AccountModal.
        const extra = parseAccountPayload(d.payload_json ?? d.payloadJson);
        return { ...d, id: doc.id, balance: Number(d.balance) || 0, ...extra, createdAt: d.createdAt?.toDate?.() ?? new Date() } as Account;
      }));
      setLoading(false);
    }, (err) => {
      if (err.code !== 'permission-denied') console.error('Account listener error:', err);
      setLoading(false);
    });
    unsubRef.current = unsubSnap;
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        subscribeAccountsAndTransactions(u);
      } else { setAccounts([]); setTransactions([]); setLoading(false); }
    });
    return () => { unsub(); if (unsubRef.current) unsubRef.current(); if (unsubTrxRef.current) unsubTrxRef.current(); };
  }, []);

  const prevModalRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevModalRef.current && !activeModal && user) {
      subscribeAccountsAndTransactions(user);
    }
    prevModalRef.current = activeModal;
  }, [activeModal, user]);

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: `Hapus rekening ${name}?`,
      message: 'Rekening hanya bisa dihapus kalau belum punya transaksi. Tindakan ini tidak bisa dibatalkan.',
      confirmLabel: 'Hapus rekening',
      danger: true,
    });
    if (!ok) return;
    setDeletingId(id);
    try {
      await accountService.deleteAccount(id);
      toast.success(`Rekening ${name} dihapus.`);
    } catch (e) {
      console.error(e);
      // Backend membalas 409 dengan alasan yang jelas kalau rekening masih
      // dipakai transaksi — tampilkan apa adanya.
      toast.error(e instanceof Error && e.message ? e.message : 'Gagal menghapus rekening. Silakan coba lagi.');
    } finally {
      setDeletingId(null);
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'Bank Account': return <Building2 size={20} className="text-white" />;
      case 'E-Wallet': return <Wallet size={20} className="text-white" />;
      case 'Cash': return <Banknote size={20} className="text-white" />;
      case 'Investment Account': return <Landmark size={20} className="text-white" />;
      case 'Credit Card': return <CreditCard size={20} className="text-white" />;
      default: return <Building2 size={20} className="text-white" />;
    }
  };

  const getBgForType = (type: string) => {
    switch (type) {
      case 'Bank Account': return 'bg-blue-600';
      case 'E-Wallet': return 'bg-indigo-600';
      case 'Cash': return 'bg-emerald-500';
      case 'Investment Account': return 'bg-slate-900';
      case 'Credit Card': return 'bg-rose-500';
      default: return 'bg-blue-500';
    }
  };

  // Nilai IDR otomatis (menggantikan field manual "Nilai Base" yang sudah dihapus).
  const toIDR = (amount: number, currency: string | undefined) =>
    exchangeRateService.convert(amount, currency || 'IDR', 'IDR', fxRates);

  // Kartu kredit/paylater dimodelkan sebagai limit, bukan saldo kas — kolom
  // "Saldo" untuk tipe ini menampilkan terpakai (dihitung dari transaksi,
  // bukan kolom balance) memakai rumus yang sama dengan halaman Kartu Saya.
  const creditUsageByAccount = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeCreditUsage>>();
    accounts.filter(a => isCreditAccountType(a.type) && a.id).forEach(acc => {
      map.set(acc.id!, computeCreditUsage(acc, transactions));
    });
    return map;
  }, [accounts, transactions]);

  // Sama dengan "Saldo Bersih" di Dashboard: total kolom balance semua
  // rekening, dikonversi ke IDR.
  const totalSaldo = useMemo(
    () => accounts.reduce((s, a) => s + toIDR(a.balance || 0, a.currency), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accounts, fxRates]
  );

  const openCreate = () => { setEditingAccount(null); setIsModalOpen(true); };

  return (
    <div className="space-y-6 md:space-y-8 max-w-[1400px] pb-12">
      <PageHeader
        icon={<Building2 size={22} />}
        title="Rekening"
        subtitle="Bank, e-wallet, uang tunai, dan kartu kredit kamu beserta saldonya."
        actions={
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-control text-sm font-bold hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} /> Tambah rekening
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <div className="md:col-span-1 bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-card p-5 md:p-6 shadow-xl shadow-emerald-600/15 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <p className="text-label font-bold text-emerald-100 uppercase mb-4">Total Saldo</p>
          {loading ? (
            <div className="h-9 w-2/3 mb-3 rounded-control bg-white/20 animate-pulse" />
          ) : (
            <p className={cn('text-2xl md:text-3xl font-black tracking-tight tabular-nums truncate mb-3', totalSaldo < 0 && 'text-rose-200')}>
              {formatIDR(totalSaldo)}
            </p>
          )}
          <p className="text-caption font-bold text-emerald-100">{accounts.length} rekening · dikonversi ke IDR</p>
        </div>

        {showSecurityBanner && (
          <Card className="md:col-span-2 p-5 md:p-6 flex items-start gap-4 relative">
            <span className="w-10 h-10 rounded-control bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <ShieldCheck size={20} />
            </span>
            <div className="pr-6">
              <p className="text-sm font-bold text-slate-900">Kami tidak pernah meminta akses ke bank kamu</p>
              <p className="text-sm text-slate-500 mt-1">
                Leosiqra tidak terhubung ke rekening bank dan tidak pernah meminta username, password, atau PIN bank.
                Saldo di sini murni dari catatan yang kamu input sendiri.
              </p>
            </div>
            <button
              onClick={dismissSecurityBanner}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-50 transition-colors"
              aria-label="Tutup"
            >
              <X size={16} />
            </button>
          </Card>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-base font-bold text-slate-900">Daftar Rekening</h2>
          <Link
            href="/membership/transactions/daily"
            className="inline-flex items-center gap-1 text-sm font-bold text-indigo-600 hover:text-indigo-700"
          >
            Riwayat transaksi <ChevronRight size={16} />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-card" />)}
          </div>
        ) : accounts.length === 0 ? (
          <Card className="p-5 md:p-8">
            <EmptyState
              title="Belum ada rekening"
              description="Tambahkan rekening bank, e-wallet, atau uang tunai pertamamu untuk mulai mencatat."
              icon={<Building2 size={24} />}
            />
            <div className="flex justify-center mt-4">
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-control text-sm font-bold hover:bg-indigo-700 transition-colors"
              >
                <Plus size={16} /> Tambah rekening
              </button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {accounts.map((acc) => {
              const isCredit = isCreditAccountType(acc.type);
              const creditUsage = acc.id ? creditUsageByAccount.get(acc.id) : undefined;
              // Untuk kartu kredit/paylater, "Saldo" berarti dana yang masih bisa
              // dipakai — jadi tampilkan sisa limit (bukan terpakai) sebagai angka utama.
              const displayAmount = isCredit ? (creditUsage?.remaining ?? 0) : (acc.balance || 0);
              return (
                <Card key={acc.id} className="p-5 flex flex-col gap-4 group">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-control flex items-center justify-center overflow-hidden bg-white border border-slate-100 shrink-0">
                      <LogoImage
                        src={acc.logoUrl}
                        alt={acc.name}
                        fallbackText={acc.name.substring(0, 3).toUpperCase()}
                        fallbackIcon={(
                          <div className={`w-full h-full flex items-center justify-center ${getBgForType(acc.type)} text-white`}>
                            {getIconForType(acc.type)}
                          </div>
                        )}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 truncate">{acc.name}</p>
                      <p className="text-caption text-slate-400 truncate">{acc.type}</p>
                    </div>
                    <div className="flex items-center gap-0.5 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                      <button
                        onClick={() => { setEditingAccount(acc); setIsModalOpen(true); }}
                        aria-label={`Ubah ${acc.name}`}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => acc.id && handleDelete(acc.id, acc.name)}
                        disabled={deletingId === acc.id}
                        aria-label={`Hapus ${acc.name}`}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-auto">
                    <p className="text-label font-bold text-slate-400 uppercase">{isCredit ? 'Sisa limit' : 'Saldo'}</p>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={cn('text-lg font-black tabular-nums truncate', isCredit ? 'text-emerald-600' : displayAmount < 0 ? 'text-rose-500' : 'text-slate-900')}>
                        {formatMoney(displayAmount, acc.currency)}
                      </p>
                      {acc.currency && acc.currency !== 'IDR' && <Badge>{acc.currency}</Badge>}
                    </div>
                    {isCredit ? (
                      <p className="text-caption text-slate-400 tabular-nums">Terpakai {formatMoney(creditUsage?.used ?? 0, acc.currency)}</p>
                    ) : acc.currency && acc.currency !== 'IDR' ? (
                      <p className="text-caption text-slate-400 tabular-nums">≈ {formatIDR(toIDR(displayAmount, acc.currency))}</p>
                    ) : null}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {user && (
        <AccountModal
          userId={user.uid}
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setEditingAccount(null); }}
          initialData={editingAccount}
          existingTypes={Array.from(new Set(accounts.map(a => a.type).filter(Boolean)))}
        />
      )}
    </div>
  );
}
