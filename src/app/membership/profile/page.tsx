"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import {
  User,
  Mail,
  Phone,
  MapPin,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ChevronRight,
  Lock,
  Bell,
  Camera,
  AtSign,
  Save,
  Building2,
  Wallet,
  Loader2,
  Clock,
  AlertTriangle,
  Trash2,
  Smartphone
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { auth, db } from '@/lib/cf-client';
import { onAuthStateChanged, User as FirebaseUser } from '@/lib/cf-auth';
import { doc, setDoc, subscribeToCollectionChanges } from '@/lib/cf-firestore';
import { accountService, Account } from '@/lib/services/accountService';
import { transactionService, Transaction } from '@/lib/services/transactionService';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { subscribeUserProfile } from '@/lib/services/userService';
import { exchangeRateService } from '@/lib/services/exchangeRateService';
import { isCreditAccountType, computeCreditUsage } from '@/lib/creditCard';
import { ChangePasswordModal } from '@/components/modals/ChangePasswordModal';
import { TwoFactorModal } from '@/components/auth/TwoFactorModal';
import { Modal } from '@/components/ui/Modal';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { useModal } from '@/context/ModalContext';

interface UserProfile {
  displayName: string;
  email: string;
  username: string;
  phone: string;
  address: string;
  photoURL?: string;
  plan?: string;
  twoFactorSecret?: string | null;
}

export default function ProfilePage() {
  const { activeModal } = useModal();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [show2FADisable, setShow2FADisable] = useState(false);
  const [disable2FAPassword, setDisable2FAPassword] = useState('');
  const [disable2FAError, setDisable2FAError] = useState('');
  const [disable2FALoading, setDisable2FALoading] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [fxRates, setFxRates] = useState<Record<string, number> | null>(null);
  const [fxLoading, setFxLoading] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const RESET_CONFIRM_WORD = 'HAPUS SEMUA DATA';

  const [profile, setProfile] = useState<UserProfile>({
    displayName: '', email: '', username: '', phone: '', address: '', photoURL: ''
  });
  const [uploading, setUploading] = useState(false);

  // Load akun & transaksi dipisah jadi fungsi sendiri supaya bisa dipanggil
  // ulang saat modal transaksi/rekening manapun ditutup — accountService tidak
  // pakai live subscription, jadi tanpa ini "Active Banks" nampilin saldo basi
  // sampai halaman di-reload.
  const loadAccountsAndTransactions = (uid: string) => {
    Promise.all([
      accountService.getUserAccounts(uid),
      transactionService.getUserTransactions(uid)
    ]).then(([accs, trxs]) => {
      setAccounts(accs);
      setTransactions(trxs);
    }).catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let unsubProfile: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // subscribe profile dari Firestore (Real-time)
        unsubProfile = subscribeUserProfile(u.uid, (data) => {
          if (data) {
            const profileExtras = data as typeof data & {
              username?: string;
              phone?: string;
              whatsapp?: string;
              address?: string;
              twoFactorSecret?: string | null;
            };
            setProfile({
              displayName: data.name || u.displayName || '',
              email: data.email || u.email || '',
              username: profileExtras.username || '',
              phone: profileExtras.whatsapp || profileExtras.phone || '',
              address: profileExtras.address || '',
              photoURL: data.photoURL || u.photoURL || '',
              plan: data.plan,
              twoFactorSecret: profileExtras.twoFactorSecret || null
            });
          }
        });

        loadAccountsAndTransactions(u.uid);
      } else {
        setLoading(false);
        if (unsubProfile) unsubProfile();
      }
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  const prevModalRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevModalRef.current && !activeModal && user) {
      loadAccountsAndTransactions(user.uid);
    }
    prevModalRef.current = activeModal;
  }, [activeModal, user]);

  // Jaring pengaman tambahan di luar modal-close (mis. hapus transaksi di
  // halaman lain, atau delete langsung dari halaman ini) — getUserAccounts/
  // getUserTransactions cuma fetch sekali, jadi butuh refetch manual.
  useEffect(() => {
    if (!user) return;
    const reload = () => loadAccountsAndTransactions(user.uid);
    const unsubAcc = subscribeToCollectionChanges('accounts', reload);
    const unsubTrx = subscribeToCollectionChanges('transactions', reload);
    return () => {
      unsubAcc();
      unsubTrx();
    };
  }, [user]);

  useEffect(() => {
    setFxLoading(true);
    exchangeRateService.getLatestRates()
      .then(setFxRates)
      .catch(console.error)
      .finally(() => setFxLoading(false));
  }, []);

  const convertedToIDR = useCallback((amount: number, currency: string): number | null => {
    if (currency === 'IDR') return amount;
    if (!fxRates || !fxRates.IDR || !fxRates[currency]) return null;
    return exchangeRateService.convert(amount, currency, 'IDR', fxRates);
  }, [fxRates]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      setProfile(prev => ({ ...prev, photoURL: url }));
      await setDoc(doc(db, 'users', user.uid), {
        photoURL: url,
        updatedAt: new Date()
      }, { merge: true });
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Gagal mengunggah foto. Pastikan konfigurasi Cloudinary benar.");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setSaveError('');
    try {
      await setDoc(doc(db, 'users', user.uid), {
        ...profile,
        updatedAt: new Date()
      }, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error(e);
      setSaveError('Gagal menyimpan perubahan. Silakan coba lagi.');
    }
    finally { setSaving(false); }
  };

  const handleEnable2FA = async (secret: string) => {
    if (!user) return false;
    try {
      await cloudflareApi('/api/member/2fa', { method: 'PATCH', json: { secret } });
      setProfile(p => ({ ...p, twoFactorSecret: secret }));
      setShow2FASetup(false);
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const handleDisable2FA = async () => {
    if (!disable2FAPassword) {
      setDisable2FAError('Masukkan password saat ini.');
      return;
    }
    setDisable2FALoading(true);
    setDisable2FAError('');
    try {
      await cloudflareApi('/api/member/2fa', { method: 'PATCH', json: { disable: true, currentPassword: disable2FAPassword } });
      setProfile(p => ({ ...p, twoFactorSecret: null }));
      setShow2FADisable(false);
      setDisable2FAPassword('');
    } catch (e) {
      setDisable2FAError(e instanceof Error ? e.message : 'Gagal menonaktifkan 2FA.');
    } finally {
      setDisable2FALoading(false);
    }
  };

  const handleResetAllData = async () => {
    setResetError('');
    if (!resetPassword) {
      setResetError('Masukkan password saat ini.');
      return;
    }
    if (resetConfirmText.trim().toUpperCase() !== RESET_CONFIRM_WORD) {
      setResetError(`Ketik persis "${RESET_CONFIRM_WORD}" untuk konfirmasi.`);
      return;
    }
    setResetLoading(true);
    try {
      await cloudflareApi('/api/member/reset-data', { method: 'POST', json: { currentPassword: resetPassword } });
      setResetDone(true);
      setTimeout(() => {
        window.location.href = '/membership/dashboard';
      }, 2000);
    } catch (e) {
      setResetError(e instanceof Error ? e.message : 'Gagal mereset data. Silakan coba lagi.');
    } finally {
      setResetLoading(false);
    }
  };

  // Digabung lintas rekening yang bisa beda mata uang, jadi dikonversi ke
  // IDR dulu (baseValue manual sering kosong, jadi pakai kurs live).
  const totalBalance = useMemo(
    () => accounts.reduce((s, a) => s + (convertedToIDR(a.balance, a.currency) ?? a.balance), 0),
    [accounts, convertedToIDR]
  );
  const todayOut = useMemo(() => {
    const today = new Date().toDateString();
    return transactions.filter(t => t.type === 'pengeluaran' && t.date.toDateString() === today).reduce((s, t) => s + (Number(t.amountIDR) || t.amount), 0);
  }, [transactions]);

  const formatRp = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
  const formatAccountBalance = (amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: currency || 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${currency || ''} ${new Intl.NumberFormat('id-ID').format(amount)}`.trim();
    }
  };
  const initials = profile.displayName ? profile.displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : (user?.email?.[0].toUpperCase() || 'U');

  const accountStats = [
    { label: "Today's Expense", value: formatRp(todayOut), icon: TrendingDown, color: "text-rose-600", bg: "bg-rose-50", trend: todayOut > 0 ? "Active" : "Nihil" },
    { label: "Total Saldo", value: formatRp(totalBalance), icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50", trend: `${accounts.length} Akun` },
  ];

  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-700 max-w-[1400px] mb-20">
      
      {/* Profile Identity Header */}
      <div className="bg-white rounded-[20px] md:rounded-[40px] border border-slate-50 shadow-sm p-5 md:p-10 lg:p-12">
        <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-10">
          <div className="relative group shrink-0">
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handlePhotoUpload} 
            />
            <div className="w-24 h-24 md:w-32 lg:w-40 md:h-32 lg:h-40 rounded-[28px] md:rounded-[48px] bg-gradient-to-tr from-indigo-600 to-blue-500 p-1 md:p-1.5 shadow-xl shadow-indigo-100 flex items-center justify-center overflow-hidden">
              <div className="w-full h-full rounded-[24px] md:rounded-[42px] bg-white flex items-center justify-center text-2xl md:text-4xl font-black text-indigo-600 overflow-hidden relative">
                {profile.photoURL ? (
                  <Image
                    src={profile.photoURL}
                    alt="Profile"
                    fill
                    className="object-cover"
                    sizes="160px"
                  />
                ) : (
                  initials
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                    <Loader2 className="animate-spin text-indigo-600" size={24} />
                  </div>
                )}
              </div>
            </div>
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 md:bottom-2 md:right-2 w-10 h-10 md:w-11 md:h-11 rounded-xl md:rounded-2xl bg-white shadow-lg border border-slate-100 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all hover:scale-110 disabled:opacity-50"
            >
              <Camera size={18} />
            </button>
          </div>
          
          <div className="flex-1 text-center lg:text-left">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-5 mb-3">
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
                {profile.displayName || user?.email?.split('@')[0] || 'Pengguna'}
              </h1>
              <div className="flex justify-center lg:justify-start">
                <span className={cn(
                  "px-5 py-2 text-[10px] font-black rounded-full uppercase tracking-[0.2em] border flex items-center gap-2 transition-all duration-500",
                  profile.plan === 'PRO' 
                    ? "bg-emerald-50 text-emerald-600 border-emerald-100 shadow-lg shadow-emerald-50" 
                    : "bg-indigo-50 text-indigo-600 border-indigo-100"
                )}>
                  <ShieldCheck size={12} className={cn(profile.plan === 'PRO' && "text-emerald-500")} />
                  {profile.plan === 'PRO' ? 'PRO MEMBER' : 'Free Plan Active'}
                </span>
              </div>
            </div>
            <p className="text-[12px] md:text-sm font-medium text-slate-400 leading-relaxed max-w-lg mx-auto lg:mx-0">
              {user?.email || 'Tidak ada email'}
            </p>
            
            <div className="flex flex-wrap justify-center lg:justify-start items-center gap-4 md:gap-8 mt-8 pt-8 border-t border-slate-50">
              {!loading && accountStats.map((stat, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl ${stat.bg} flex items-center justify-center ${stat.color} shadow-sm border border-white`}>
                    <stat.icon size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">{stat.label}</p>
                    <p className="text-lg font-black text-slate-900 leading-none">{stat.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Settings & Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        
        {/* Identity Form */}
        <div className="lg:col-span-2 space-y-6 md:space-y-8">
          <div className="bg-white p-5 md:p-8 lg:p-12 rounded-[20px] md:rounded-[48px] border border-slate-50 shadow-sm space-y-6 md:space-y-10">
            <div className="flex items-center justify-between">
              <h2 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">Identity Settings</h2>
            </div>

            {saveError && (
              <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 text-sm font-medium text-rose-600">
                {saveError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-x-12 md:gap-y-8">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block">Full Name</label>
                <div className="relative group">
                  <User size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                  <input type="text" value={profile.displayName} onChange={e => setProfile(p => ({...p, displayName: e.target.value}))}
                    placeholder="Nama lengkap..."
                    className="w-full bg-slate-50/50 border-none focus:ring-2 focus:ring-indigo-100 rounded-xl md:rounded-2xl py-4 md:py-5 pl-14 pr-6 text-sm font-bold text-slate-700 transition-all" />
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block">Email Address</label>
                <div className="relative group">
                  <Mail size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 transition-colors" />
                  <input type="email" value={profile.email} disabled
                    className="w-full bg-slate-50/30 border-none rounded-xl md:rounded-2xl py-4 md:py-5 pl-14 pr-6 text-sm font-bold text-slate-400 cursor-not-allowed" />
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block">Username</label>
                <div className="relative group">
                  <AtSign size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                  <input type="text" value={profile.username} onChange={e => setProfile(p => ({...p, username: e.target.value}))}
                    placeholder="username..."
                    className="w-full bg-slate-50/50 border-none focus:ring-2 focus:ring-indigo-100 rounded-2xl py-5 pl-14 pr-6 text-sm font-bold text-slate-700 transition-all" />
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block">Phone Number</label>
                <div className="relative group">
                  <Phone size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                  <input type="text" value={profile.phone} onChange={e => setProfile(p => ({...p, phone: e.target.value}))}
                    placeholder="+62 ..."
                    className="w-full bg-slate-50/50 border-none focus:ring-2 focus:ring-indigo-100 rounded-2xl py-5 pl-14 pr-6 text-sm font-bold text-slate-700 transition-all" />
                </div>
              </div>

              <div className="md:col-span-2 space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block">Alamat</label>
                <div className="relative group">
                  <MapPin size={18} className="absolute left-6 top-8 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                  <textarea rows={3} value={profile.address} onChange={e => setProfile(p => ({...p, address: e.target.value}))}
                    placeholder="Jl. ..."
                    className="w-full bg-slate-50/50 border-none focus:ring-2 focus:ring-indigo-100 rounded-xl md:rounded-2xl py-4 md:py-5 pl-14 pr-6 text-sm font-bold text-slate-700 transition-all resize-none" />
                </div>
              </div>
            </div>

            <div className="pt-8 md:pt-10 border-t border-slate-50 flex flex-col md:flex-row items-center gap-4 md:gap-6">
              <button onClick={handleSave} disabled={saving}
                className="w-full md:w-fit px-10 md:px-12 py-4 md:py-5 bg-indigo-600 disabled:bg-slate-300 text-white rounded-xl md:rounded-2xl text-[13px] md:text-xs font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                <Save size={14} />
                {saving ? 'Menyimpan...' : saved ? 'OK Tersimpan!' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Banks & Security */}
        <div className="space-y-6 md:space-y-10">
          
          {/* Active Banks */}
          <div className="bg-[#f0f5fa] p-5 md:p-8 rounded-[20px] md:rounded-[48px] border border-white shadow-sm space-y-6 md:space-y-8">
            <h2 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">Active Banks</h2>
            <div className="space-y-4">
              {loading ? (
                <p className="text-sm text-slate-400 text-center py-4">Memuat...</p>
              ) : accounts.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Belum ada rekening</p>
              ) : accounts.map((acc) => {
                const isCredit = isCreditAccountType(acc.type);
                const credit = isCredit ? computeCreditUsage(acc, transactions) : null;
                return (
                <button
                  key={acc.id}
                  onClick={() => setSelectedAccount(acc)}
                  className="w-full flex items-start gap-3 md:gap-4 p-4 md:p-5 bg-white/60 backdrop-blur-sm rounded-[24px] md:rounded-[28px] border border-white shadow-sm hover:scale-[1.02] transition-transform text-left"
                >
                  <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl md:rounded-2xl flex-shrink-0 bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-100">
                    {acc.type === 'E-Wallet' ? <Wallet size={16} /> : <Building2 size={16} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-[12px] md:text-[13px] font-black text-slate-900 leading-tight truncate">{acc.name}</h4>
                      <ArrowRight size={12} className="text-slate-300 shrink-0" />
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1.5">
                      <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-tight truncate">
                        {isCredit ? 'Sisa Limit' : acc.type}
                      </p>
                      <p className="text-[12px] md:text-[13px] font-black text-slate-900 whitespace-nowrap shrink-0">
                        {formatAccountBalance(isCredit && credit ? credit.remaining : acc.balance, acc.currency)}
                      </p>
                    </div>
                  </div>
                </button>
                );
              })}
            </div>
          </div>
 
          {/* Security */}
          <div className="bg-slate-900 p-5 md:p-8 rounded-[20px] md:rounded-[48px] shadow-2xl space-y-6 md:space-y-10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 text-white/5 group-hover:text-white/10 transition-colors hidden md:block">
              <ShieldCheck size={120} />
            </div>
            <h2 className="text-lg md:text-xl font-black text-white tracking-tight relative z-10">Security Center</h2>
            <div className="space-y-4 md:space-y-6 relative z-10">
              <button
                onClick={() => setShowPasswordModal(true)}
                className="w-full flex items-center justify-between p-4 md:p-5 bg-white/10 hover:bg-white/20 rounded-xl md:rounded-2xl transition-all border border-white/5 backdrop-blur-md"
              >
                <div className="flex items-center gap-3 md:gap-4 text-white">
                  <Lock size={16} className="text-indigo-400" />
                  <span className="text-[11px] md:text-[12px] font-black tracking-tight">Change Password</span>
                </div>
                <ChevronRight size={14} className="text-white/40" />
              </button>
              <div className="w-full flex items-center justify-between p-4 md:p-5 bg-white/5 rounded-xl md:rounded-2xl border border-white/5 backdrop-blur-md opacity-60 cursor-not-allowed">
                <div className="flex items-center gap-3 md:gap-4 text-white">
                  <Bell size={16} className="text-indigo-400" />
                  <span className="text-[11px] md:text-[12px] font-black tracking-tight">Notification Preferences</span>
                </div>
                <span className="flex items-center gap-1.5 text-[9px] font-black text-white/50 uppercase tracking-widest">
                  <Clock size={11} />
                  Segera Hadir
                </span>
              </div>
              <div className="pt-6 border-t border-white/10">
                <div className="flex items-start justify-between gap-4">
                  <div className="pt-0.5">
                    <p className="text-[9px] md:text-[10px] font-black text-white uppercase tracking-widest leading-none">Two Factor Auth</p>
                    <p className="text-[9px] font-bold text-white/40 mt-1.5">
                      {profile.twoFactorSecret ? 'Aktif — melindungi login Anda' : 'Belum diaktifkan'}
                    </p>
                  </div>
                  <button
                    onClick={() => profile.twoFactorSecret ? setShow2FADisable(true) : setShow2FASetup(true)}
                    className={cn(
                      "w-10 h-5 md:w-12 md:h-6 rounded-full relative p-1 transition-colors shrink-0",
                      profile.twoFactorSecret ? "bg-indigo-600" : "bg-white/10"
                    )}
                  >
                    <div className={cn(
                      "w-3 h-3 md:w-4 md:h-4 bg-white rounded-full absolute top-1 transition-all",
                      profile.twoFactorSecret ? "right-1" : "left-1 opacity-60"
                    )} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Input Cepat — satu-satunya jalur input dari HP, jalan di iPhone & Android. */}
          <div className="bg-white p-5 md:p-8 rounded-[20px] md:rounded-[48px] border border-slate-50 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                <Smartphone size={18} />
              </div>
              <div>
                <h2 className="text-lg md:text-xl font-black text-slate-900 tracking-tight leading-tight">Input Cepat</h2>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5">Catat transaksi dari HP — iPhone &amp; Android</p>
              </div>
            </div>

            <a
              href="/input-cepat"
              className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-700 p-4 text-white shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5"
            >
              <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <Smartphone size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-black tracking-tight">Buka Input Cepat</p>
                <p className="text-[10px] font-medium text-white/70 mt-0.5">Tambahkan ke layar utama biar tinggal tap</p>
              </div>
              <ChevronRight size={16} className="text-white/70 shrink-0" />
            </a>
          </div>

          {/* Danger Zone */}
          <div className="bg-rose-50 p-5 md:p-8 rounded-[20px] md:rounded-[48px] border border-rose-100 shadow-sm space-y-6 md:space-y-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 text-rose-600/5 group-hover:text-rose-600/10 transition-colors hidden md:block">
              <AlertTriangle size={120} />
            </div>
            <div className="flex items-center gap-3 relative z-10">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <AlertTriangle size={18} />
              </div>
              <h2 className="text-lg md:text-xl font-black text-rose-700 tracking-tight">Danger Zone</h2>
            </div>
            <p className="text-xs font-medium text-rose-600/80 leading-relaxed relative z-10">
              Menghapus permanen semua transaksi, rekening, budget, investasi, tabungan, kategori, mata uang, jadwal recurring, dan riwayat chat AI Anda. Akun (login, plan, riwayat pembayaran) tidak terhapus.
            </p>
            <button
              onClick={() => setShowResetModal(true)}
              className="relative z-10 w-full flex items-center justify-center gap-2 py-3.5 md:py-4 rounded-xl md:rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black tracking-wide transition-all shadow-xl shadow-rose-200"
            >
              <Trash2 size={14} />
              Reset Semua Data
            </button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={Boolean(selectedAccount)}
        onClose={() => setSelectedAccount(null)}
        title="Detail Rekening"
        maxWidth="max-w-sm"
      >
        {selectedAccount && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex-shrink-0 bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-100">
                {selectedAccount.type === 'E-Wallet' ? <Wallet size={22} /> : <Building2 size={22} />}
              </div>
              <div className="min-w-0">
                <h4 className="text-base font-black text-slate-900 leading-tight break-words">{selectedAccount.name}</h4>
                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{selectedAccount.type}</p>
              </div>
            </div>

            {isCreditAccountType(selectedAccount.type) ? (
              (() => {
                const credit = computeCreditUsage(selectedAccount, transactions);
                return (
                  <>
                    <div className="bg-slate-50 rounded-2xl p-6 space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sisa Limit</p>
                      <p className="text-2xl font-black text-emerald-600">{formatAccountBalance(credit.remaining, selectedAccount.currency)}</p>
                      {selectedAccount.currency !== 'IDR' && (
                        <p className="text-xs font-bold text-slate-400 pt-1">
                          {fxLoading
                            ? 'Menghitung konversi...'
                            : (() => {
                                const converted = convertedToIDR(credit.remaining, selectedAccount.currency);
                                return converted !== null
                                  ? `≈ ${formatRp(converted)}`
                                  : 'Kurs tidak tersedia saat ini';
                              })()}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 rounded-2xl p-4">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Terpakai</p>
                        <p className="text-sm font-black text-rose-500 mt-1">{formatAccountBalance(credit.used, selectedAccount.currency)}</p>
                      </div>
                      <div className="bg-slate-50 rounded-2xl p-4">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Limit Kredit</p>
                        <p className="text-sm font-black text-slate-900 mt-1">{formatAccountBalance(credit.limit, selectedAccount.currency)}</p>
                      </div>
                    </div>
                  </>
                );
              })()
            ) : (
              <>
                <div className="bg-slate-50 rounded-2xl p-6 space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saldo Saat Ini</p>
                  <p className="text-2xl font-black text-slate-900">{formatAccountBalance(selectedAccount.balance, selectedAccount.currency)}</p>
                  {selectedAccount.currency !== 'IDR' && (
                    <p className="text-xs font-bold text-slate-400 pt-1">
                      {fxLoading
                        ? 'Menghitung konversi...'
                        : (() => {
                            const converted = convertedToIDR(selectedAccount.balance, selectedAccount.currency);
                            return converted !== null
                              ? `≈ ${formatRp(converted)}`
                              : 'Kurs tidak tersedia saat ini';
                          })()}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Mata Uang</p>
                    <p className="text-sm font-black text-slate-900 mt-1">{selectedAccount.currency}</p>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Saldo Awal</p>
                    <p className="text-sm font-black text-slate-900 mt-1">{formatAccountBalance(selectedAccount.initialBalance || 0, selectedAccount.currency)}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      <ChangePasswordModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} />

      <TwoFactorModal
        isOpen={show2FASetup}
        onClose={() => setShow2FASetup(false)}
        mode="setup"
        email={profile.email || user?.email || ''}
        onVerify={handleEnable2FA}
      />

      <Modal
        isOpen={show2FADisable}
        onClose={() => { setShow2FADisable(false); setDisable2FAPassword(''); setDisable2FAError(''); }}
        title="Nonaktifkan 2FA"
        maxWidth="max-w-sm"
      >
        <div className="space-y-5">
          <p className="text-sm font-medium text-slate-500">
            Menonaktifkan 2FA akan mengurangi keamanan akun Anda. Masukkan password saat ini untuk melanjutkan.
          </p>
          {disable2FAError && (
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 text-sm font-medium text-rose-600">
              {disable2FAError}
            </div>
          )}
          <div className="relative group">
            <Lock size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
            <input
              type="password"
              value={disable2FAPassword}
              onChange={e => setDisable2FAPassword(e.target.value)}
              placeholder="Password saat ini"
              className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-indigo-100 rounded-xl py-3.5 pl-12 pr-5 text-sm font-bold text-slate-700 transition-all"
            />
          </div>
          <button
            onClick={handleDisable2FA}
            disabled={disable2FALoading}
            className="w-full bg-rose-600 disabled:bg-slate-300 text-white flex items-center justify-center gap-3 py-4 rounded-2xl text-sm font-black transition-all shadow-xl shadow-rose-100"
          >
            {disable2FALoading ? 'Memproses...' : 'Nonaktifkan 2FA'}
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={showResetModal}
        onClose={() => {
          setShowResetModal(false);
          setResetPassword('');
          setResetConfirmText('');
          setResetError('');
          setResetDone(false);
        }}
        title="Reset Semua Data"
        maxWidth="max-w-md"
      >
        {resetDone ? (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5 text-sm font-medium text-emerald-600 text-center">
            Semua data berhasil dihapus. Mengalihkan ke Dashboard...
          </div>
        ) : (
          <div className="space-y-5">
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle size={18} className="text-rose-500 shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-rose-600 leading-relaxed">
                Tindakan ini <strong>permanen dan tidak bisa dibatalkan</strong>. Semua transaksi, rekening, budget, investasi, tabungan, kategori, mata uang, jadwal recurring, dan riwayat chat AI Anda akan terhapus. Akun login Anda tetap ada.
              </p>
            </div>

            {resetError && (
              <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 text-sm font-medium text-rose-600">
                {resetError}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Password Saat Ini</label>
              <div className="relative group">
                <Lock size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-rose-500 transition-colors" />
                <input
                  type="password"
                  value={resetPassword}
                  onChange={e => setResetPassword(e.target.value)}
                  placeholder="Masukkan password saat ini"
                  className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-rose-100 rounded-xl py-3.5 pl-12 pr-5 text-sm font-bold text-slate-700 transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                Ketik &quot;{RESET_CONFIRM_WORD}&quot; untuk konfirmasi
              </label>
              <input
                type="text"
                value={resetConfirmText}
                onChange={e => setResetConfirmText(e.target.value)}
                placeholder={RESET_CONFIRM_WORD}
                className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-rose-100 rounded-xl py-3.5 px-5 text-sm font-bold text-slate-700 transition-all"
              />
            </div>

            <button
              onClick={handleResetAllData}
              disabled={resetLoading}
              className="w-full bg-rose-600 disabled:bg-slate-300 text-white flex items-center justify-center gap-3 py-4 rounded-2xl text-sm font-black transition-all shadow-xl shadow-rose-100"
            >
              {resetLoading ? 'Menghapus...' : (
                <>
                  <Trash2 size={16} />
                  Hapus Semua Data Permanen
                </>
              )}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

