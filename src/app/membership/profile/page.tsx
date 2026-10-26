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
  ChevronRight,
  Lock,
  Bell,
  Camera,
  AtSign,
  Save,
  Building2,
  Wallet,
  Loader2,
  AlertTriangle,
  Trash2,
  Smartphone,
  Eye,
  EyeOff,
  Monitor,
  Settings,
  Bot,
  Check,
  KeyRound,
  LogOut,
  type LucideIcon
} from 'lucide-react';
import Link from 'next/link';
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
import { McpConnectCard } from '@/components/profile/McpConnectCard';
import { Modal } from '@/components/ui/Modal';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { useModal } from '@/context/ModalContext';
import {
  isPushSupported,
  isIosNeedsInstall,
  getExistingSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/pushNotifications';

interface UserProfile {
  displayName: string;
  email: string;
  username: string;
  phone: string;
  address: string;
  photoURL?: string;
  plan?: string;
  twoFactorEnabled?: boolean;
}

interface SessionInfo {
  id: string;
  device: string;
  createdAt: string;
  lastSeenAt: string;
  isPermanent: boolean;
  isCurrent: boolean;
}

// Pengaturan dikelompokkan per menu (samping di desktop, tab geser di HP) supaya
// tiap bagian dapat lebar penuh: Akun = data diri & rekening, Keamanan = akses
// akun, Notifikasi = push & email, Hubungkan ke AI = MCP, Lainnya = pintasan &
// zona berbahaya. ?tab=<id> membuka menu tertentu (mis. dari SecurityNudge).
const SETTINGS_TABS = [
  { id: 'akun', label: 'Akun', desc: 'Data diri & rekening', icon: User },
  { id: 'keamanan', label: 'Keamanan', desc: 'Password, 2FA, perangkat', icon: ShieldCheck },
  { id: 'notifikasi', label: 'Notifikasi', desc: 'Push & laporan email', icon: Bell },
  { id: 'ai', label: 'Hubungkan ke AI', desc: 'Claude, ChatGPT & MCP', icon: Bot },
  { id: 'lainnya', label: 'Lainnya', desc: 'Input Cepat & reset data', icon: Settings },
] as const;
type RightTab = (typeof SETTINGS_TABS)[number]['id'];
const isSettingsTab = (v: string | null): v is RightTab => SETTINGS_TABS.some((t) => t.id === v);

export default function ProfilePage() {
  const { activeModal } = useModal();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>('akun');
  // Simpan menu aktif di URL (?tab=) supaya bisa dibagikan/di-refresh tanpa kembali ke Akun.
  const selectTab = (tab: RightTab) => {
    setRightTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.replaceState(null, '', url.toString());
  };
  // Di HP menu berupa tab geser: pastikan tab aktif terlihat (mis. "Lainnya" dari ?tab=lainnya).
  // Geser horizontal saja (bukan scrollIntoView) supaya halaman tidak ikut melompat.
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>('#pengaturan-akun nav');
    const el = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (nav && el) nav.scrollLeft = el.offsetLeft - (nav.clientWidth - el.clientWidth) / 2;
  }, [rightTab]);
  // Tautan langsung ke tab tertentu, mis. dari kartu "Aktifkan 2FA" di Beranda.
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (!isSettingsTab(tab) || tab === 'akun') return;
    setRightTab(tab);
    const t = setTimeout(() => document.getElementById('pengaturan-akun')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 600);
    return () => clearTimeout(t);
  }, []);
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
  const [showResetPassword, setShowResetPassword] = useState(false);
  const RESET_CONFIRM_WORD = 'HAPUS SEMUA DATA';

  // Notifikasi push — status "aktif" ditentukan dari subscription browser
  // yang beneran ada (bukan cuma field lokal), supaya tetap akurat kalau
  // user cabut izin notifikasi langsung dari setelan HP-nya.
  const [notifSupported, setNotifSupported] = useState(true);
  const [notifIosNeedsInstall, setNotifIosNeedsInstall] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState('');

  // Kelola Perangkat — daftar sesi login aktif (web + PWA), bisa logout paksa
  // sesi tertentu dari jarak jauh kalau ada yang mencurigakan.
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);

  const loadSessions = () => {
    setSessionsLoading(true);
    cloudflareApi<{ items: SessionInfo[] }>('/api/member/sessions')
      .then((res) => setSessions(res.items))
      .catch(console.error)
      .finally(() => setSessionsLoading(false));
  };

  const handleRevokeSession = async (id: string) => {
    if (!confirm('Logout sesi ini dari perangkat tersebut sekarang?')) return;
    setRevokingSessionId(id);
    try {
      await cloudflareApi(`/api/member/sessions/${id}`, { method: 'DELETE' });
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Gagal logout sesi.');
    } finally {
      setRevokingSessionId(null);
    }
  };

  const formatSessionDate = (iso: string) =>
    new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

  useEffect(() => {
    setNotifSupported(isPushSupported());
    setNotifIosNeedsInstall(isIosNeedsInstall());
    getExistingSubscription()
      .then((sub) => setNotifEnabled(Boolean(sub)))
      .catch(() => setNotifEnabled(false));
  }, []);

  // Laporan keuangan bulanan via email (opt-in, default mati).
  const [reportEnabled, setReportEnabled] = useState(false);
  const [reportAvailable, setReportAvailable] = useState(false);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState('');

  useEffect(() => {
    cloudflareApi<{ enabled: boolean; available: boolean }>('/api/member/email-report')
      .then((res) => {
        setReportEnabled(res.enabled);
        setReportAvailable(res.available);
      })
      .catch(() => setReportAvailable(false))
      .finally(() => setReportLoading(false));
  }, []);

  const handleToggleMonthlyReport = async () => {
    setReportError('');
    setReportLoading(true);
    try {
      const res = await cloudflareApi<{ enabled: boolean }>('/api/member/email-report', {
        method: 'PUT',
        json: { enabled: !reportEnabled },
      });
      setReportEnabled(res.enabled);
    } catch (e) {
      setReportError(e instanceof Error ? e.message : 'Gagal mengubah pengaturan laporan bulanan.');
    } finally {
      setReportLoading(false);
    }
  };

  const handleToggleNotifications = async () => {
    setNotifError('');
    setNotifLoading(true);
    try {
      if (notifEnabled) {
        await unsubscribeFromPush();
        setNotifEnabled(false);
      } else {
        await subscribeToPush();
        setNotifEnabled(true);
      }
    } catch (e) {
      setNotifError(e instanceof Error ? e.message : 'Gagal mengubah pengaturan notifikasi.');
    } finally {
      setNotifLoading(false);
    }
  };

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
              twoFactorEnabled?: number | boolean | null;
            };
            setProfile({
              displayName: data.name || u.displayName || '',
              email: data.email || u.email || '',
              username: profileExtras.username || '',
              phone: profileExtras.whatsapp || profileExtras.phone || '',
              address: profileExtras.address || '',
              photoURL: data.photoURL || u.photoURL || '',
              plan: data.plan,
              twoFactorEnabled: Boolean(profileExtras.twoFactorEnabled)
            });
          }
        });

        loadAccountsAndTransactions(u.uid);
        loadSessions();
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
      alert(error instanceof Error ? error.message : "Gagal mengunggah foto.");
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
      setProfile(p => ({ ...p, twoFactorEnabled: true }));
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
      setProfile(p => ({ ...p, twoFactorEnabled: false }));
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
    if (user?.hasPassword !== false && !resetPassword) {
      setResetError('Masukkan password saat ini.');
      return;
    }
    if (resetConfirmText.trim().toUpperCase() !== RESET_CONFIRM_WORD) {
      setResetError(`Ketik persis "${RESET_CONFIRM_WORD}" untuk konfirmasi.`);
      return;
    }
    setResetLoading(true);
    try {
      await cloudflareApi('/api/member/reset-data', {
        method: 'POST',
        json: user?.hasPassword !== false ? { currentPassword: resetPassword } : {},
      });
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
    { label: "Pengeluaran hari ini", value: formatRp(todayOut), icon: TrendingDown, color: "text-rose-600", bg: "bg-rose-50", trend: todayOut > 0 ? "Active" : "Nihil" },
    { label: "Total Saldo", value: formatRp(totalBalance), icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50", trend: `${accounts.length} Akun` },
  ];

  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-700 max-w-[1400px] mb-20">
      
      {/* Ajakan memasang aplikasi di HP */}
      <Link
        href="/install"
        className="group flex items-center gap-4 rounded-[20px] md:rounded-[28px] border border-indigo-100 bg-gradient-to-r from-indigo-50 to-violet-50 p-4 md:p-5 transition-colors hover:border-indigo-200"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm">
          <Smartphone size={20} />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-black text-slate-900">Pasang Leosiqra & Input Cepat di HP</span>
          <span className="block text-xs font-medium text-slate-500">Buka langsung dari layar utama, tanpa Play Store — lihat caranya</span>
        </span>
        <span className="text-sm font-black text-indigo-600 transition-transform group-hover:translate-x-1">→</span>
      </Link>

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
                  {profile.plan === 'PRO' ? 'Member PRO' : 'Paket Gratis'}
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

      {/* Pengaturan — menu samping (desktop) / tab geser (HP), isi selebar kolom kanan */}
      <div id="pengaturan-akun" className="scroll-mt-24 grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-4 md:gap-6 lg:gap-8 items-start">
        <nav
          aria-label="Menu pengaturan"
          className="relative flex lg:flex-col gap-1.5 p-1.5 bg-white border border-slate-100 rounded-2xl shadow-sm overflow-x-auto no-scrollbar lg:sticky lg:top-28"
        >
          {SETTINGS_TABS.map((tab) => {
            const active = rightTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => selectTab(tab.id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  "flex items-center gap-3 shrink-0 px-3.5 py-2.5 lg:py-3 rounded-xl text-left transition-all whitespace-nowrap",
                  active ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                )}
              >
                <tab.icon size={16} className={active ? "text-indigo-600" : "text-slate-400"} />
                <span className="min-w-0">
                  <span className="block text-[12px] font-black">{tab.label}</span>
                  <span className="hidden lg:block text-[10px] font-medium text-slate-400 truncate">{tab.desc}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 space-y-6 animate-in fade-in duration-300" key={rightTab}>
          {rightTab === 'akun' && (
            <>
              <SettingCard icon={User} title="Data diri" desc="Nama, username, dan kontak yang dipakai di akun Anda">
                {saveError && (
                  <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 text-sm font-medium text-rose-600">
                    {saveError}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-x-8 md:gap-y-6">
                  <Field label="Nama lengkap" icon={User}>
                    <input type="text" value={profile.displayName} onChange={e => setProfile(p => ({...p, displayName: e.target.value}))}
                      placeholder="Nama lengkap..." className={inputClass} />
                  </Field>
                  <Field label="Email" icon={Mail} hint="Email tidak bisa diubah.">
                    <input type="email" value={profile.email} disabled className={cn(inputClass, "text-slate-400 bg-slate-50/30 cursor-not-allowed")} />
                  </Field>
                  <Field label="Username" icon={AtSign} hint="3–20 karakter (huruf/angka/underscore/titik), bisa dipakai login selain email.">
                    <input type="text" value={profile.username} onChange={e => setProfile(p => ({...p, username: e.target.value.toLowerCase().replace(/\s+/g, '')}))}
                      placeholder="username..." className={inputClass} />
                  </Field>
                  <Field label="Nomor HP" icon={Phone}>
                    <input type="text" value={profile.phone} onChange={e => setProfile(p => ({...p, phone: e.target.value}))}
                      placeholder="+62 ..." className={inputClass} />
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="Alamat" icon={MapPin} iconTop>
                      <textarea rows={3} value={profile.address} onChange={e => setProfile(p => ({...p, address: e.target.value}))}
                        placeholder="Jl. ..." className={cn(inputClass, "resize-none")} />
                    </Field>
                  </div>
                </div>
                <div className="pt-6 border-t border-slate-100 flex justify-end">
                  <button onClick={handleSave} disabled={saving}
                    className="w-full md:w-fit px-8 py-3.5 bg-indigo-600 disabled:bg-slate-300 text-white rounded-xl text-[13px] font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Save size={14} />}
                    {saving ? 'Menyimpan...' : saved ? 'Tersimpan' : 'Simpan perubahan'}
                  </button>
                </div>
              </SettingCard>

              <SettingCard icon={Wallet} title="Rekening aktif" desc="Ketuk rekening untuk melihat detail saldo & konversi kurs">
                {loading ? (
                  <p className="text-sm text-slate-400 text-center py-4">Memuat...</p>
                ) : accounts.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">Belum ada rekening</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {accounts.map((acc) => {
                      const isCredit = isCreditAccountType(acc.type);
                      const credit = isCredit ? computeCreditUsage(acc, transactions) : null;
                      return (
                        <button
                          key={acc.id}
                          onClick={() => setSelectedAccount(acc)}
                          className="w-full flex items-center gap-3 p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-colors text-left"
                        >
                          <div className="w-10 h-10 rounded-xl shrink-0 bg-blue-600 text-white flex items-center justify-center">
                            {acc.type === 'E-Wallet' ? <Wallet size={16} /> : <Building2 size={16} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-black text-slate-900 leading-tight truncate">{acc.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight truncate mt-1">
                              {isCredit ? 'Sisa limit' : acc.type}
                            </p>
                          </div>
                          <p className="text-[13px] font-black text-slate-900 whitespace-nowrap shrink-0">
                            {formatAccountBalance(isCredit && credit ? credit.remaining : acc.balance, acc.currency)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </SettingCard>
            </>
          )}

          {rightTab === 'keamanan' && (
            <>
              <SettingCard icon={ShieldCheck} title="Login & akses" desc="Lindungi akun Anda dari akses orang lain">
                <div className="divide-y divide-slate-100">
                  <SettingRow
                    icon={Lock}
                    title="Password"
                    desc={user?.hasPassword === false ? 'Akun ini login dengan Google — buat password agar bisa login dengan email juga' : 'Ganti password secara berkala. Mengganti password memutus semua koneksi AI.'}
                    action={
                      <button onClick={() => setShowPasswordModal(true)} className={secondaryButton}>
                        {user?.hasPassword === false ? 'Buat password' : 'Ganti'}
                      </button>
                    }
                  />
                  <SettingRow
                    icon={KeyRound}
                    title="Verifikasi 2 langkah (2FA)"
                    desc="Kode dari aplikasi authenticator diminta setiap login"
                    badge={profile.twoFactorEnabled ? { text: 'Aktif', tone: 'good' } : { text: 'Belum aktif', tone: 'warn' }}
                    action={
                      profile.twoFactorEnabled ? (
                        <button onClick={() => setShow2FADisable(true)} className={secondaryButton}>Nonaktifkan</button>
                      ) : (
                        <button onClick={() => setShow2FASetup(true)} className={primaryButton}>Aktifkan</button>
                      )
                    }
                  />
                </div>
              </SettingCard>

              <SettingCard icon={Monitor} title="Perangkat yang login" desc="Keluarkan perangkat yang tidak Anda kenali">
                {sessionsLoading ? (
                  <p className="text-sm text-slate-400 text-center py-4">Memuat...</p>
                ) : sessions.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">Tidak ada sesi aktif.</p>
                ) : (
                  <div className="space-y-2.5">
                    {sessions.map((s) => (
                      <div key={s.id} className="flex items-center justify-between gap-3 p-4 bg-slate-50 rounded-2xl">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-slate-400 shrink-0">
                            {s.isPermanent ? <Smartphone size={15} /> : <Monitor size={15} />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-xs font-black text-slate-900 truncate">{s.device}</p>
                              {s.isCurrent && (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-black rounded-full uppercase tracking-widest shrink-0">Perangkat ini</span>
                              )}
                              {s.isPermanent && (
                                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[9px] font-black rounded-full uppercase tracking-widest shrink-0">Aplikasi</span>
                              )}
                            </div>
                            <p className="text-[10px] font-medium text-slate-400 mt-1">Aktif terakhir {formatSessionDate(s.lastSeenAt)}</p>
                          </div>
                        </div>
                        {!s.isCurrent && (
                          <button
                            onClick={() => handleRevokeSession(s.id)}
                            disabled={revokingSessionId === s.id}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white text-[11px] font-black text-slate-500 hover:bg-rose-500 hover:text-white transition-all shrink-0 disabled:opacity-50"
                          >
                            {revokingSessionId === s.id ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
                            Keluarkan
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </SettingCard>
            </>
          )}

          {rightTab === 'notifikasi' && (
            <SettingCard icon={Bell} title="Notifikasi" desc="Atur apa saja yang dikirim Leosiqra ke Anda">
              <div className="divide-y divide-slate-100">
                <SettingRow
                  icon={Bell}
                  title="Notifikasi push"
                  desc="Ringkasan harian & pengingat transaksi rutin ke HP atau browser ini"
                  action={
                    notifIosNeedsInstall ? (
                      <span className="flex items-center gap-1.5 text-[10px] font-black text-amber-600 uppercase tracking-widest">
                        <Smartphone size={12} /> Pasang dulu
                      </span>
                    ) : !notifSupported ? (
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tidak didukung</span>
                    ) : notifLoading ? (
                      <Loader2 size={16} className="animate-spin text-slate-400" />
                    ) : (
                      <Toggle on={notifEnabled} onClick={handleToggleNotifications} label="Notifikasi push" />
                    )
                  }
                >
                  {notifIosNeedsInstall && (
                    <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
                      Di iPhone, notifikasi hanya jalan kalau Leosiqra sudah ditambahkan ke Home Screen: tap{' '}
                      <b>Share</b> di Safari → <b>&quot;Add to Home Screen&quot;</b>, lalu buka Leosiqra dari ikon itu.
                    </p>
                  )}
                  {notifError && <p className="text-[11px] font-bold text-rose-500">{notifError}</p>}
                </SettingRow>
                <SettingRow
                  icon={Mail}
                  title="Laporan bulanan via email"
                  desc="Ringkasan pemasukan, pengeluaran & budget tiap awal bulan"
                  action={
                    reportLoading ? (
                      <Loader2 size={16} className="animate-spin text-slate-400" />
                    ) : !reportAvailable && !reportEnabled ? (
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Segera</span>
                    ) : (
                      <Toggle on={reportEnabled} onClick={handleToggleMonthlyReport} label="Laporan bulanan via email" />
                    )
                  }
                >
                  {reportError && <p className="text-[11px] font-bold text-rose-500">{reportError}</p>}
                </SettingRow>
              </div>
            </SettingCard>
          )}

          {rightTab === 'ai' && <McpConnectCard />}

          {rightTab === 'lainnya' && (
            <>
              <SettingCard icon={Smartphone} title="Input Cepat" desc="Catat transaksi dari HP — iPhone & Android">
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
              </SettingCard>

              <div className="bg-white p-5 md:p-8 rounded-[20px] md:rounded-[32px] border border-rose-100 shadow-sm space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
                    <AlertTriangle size={18} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base md:text-lg font-black text-rose-700 tracking-tight leading-tight">Zona berbahaya</h2>
                    <p className="text-[11px] font-medium text-slate-400 mt-0.5">Tindakan di sini tidak bisa dibatalkan</p>
                  </div>
                </div>
                <div className="flex flex-col md:flex-row md:items-center gap-4 p-4 bg-rose-50/60 rounded-2xl">
                  <p className="flex-1 text-xs font-medium text-rose-700/80 leading-relaxed">
                    Menghapus permanen semua transaksi, rekening, budget, investasi, tabungan, kategori, mata uang, jadwal recurring, dan riwayat chat AI Anda. Akun (login, plan, riwayat pembayaran) tidak terhapus.
                  </p>
                  <button
                    onClick={() => setShowResetModal(true)}
                    className="shrink-0 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition-all"
                  >
                    <Trash2 size={14} />
                    Reset semua data
                  </button>
                </div>
              </div>
            </>
          )}
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

      <ChangePasswordModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} hasPassword={user?.hasPassword} />

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

            {user?.hasPassword === false ? (
              <p className="text-[12px] text-slate-500 leading-relaxed bg-slate-50 border border-slate-100 rounded-xl p-4">
                Akun ini masuk pakai Google dan tidak punya password — sesi login yang sedang aktif jadi bukti identitas Anda. Ketik frasa konfirmasi di bawah untuk melanjutkan.
              </p>
            ) : (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Password Saat Ini</label>
                <div className="relative group">
                  <Lock size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-rose-500 transition-colors" />
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    value={resetPassword}
                    onChange={e => setResetPassword(e.target.value)}
                    placeholder="Masukkan password saat ini"
                    className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-rose-100 rounded-xl py-3.5 pl-12 pr-12 text-sm font-bold text-slate-700 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
                    aria-label={showResetPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showResetPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
            )}

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

const inputClass =
  'w-full bg-slate-50/70 border-none focus:ring-2 focus:ring-indigo-100 rounded-xl py-3.5 pl-12 pr-4 text-sm font-bold text-slate-700 transition-all';
const primaryButton =
  'px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black transition-colors whitespace-nowrap';
const secondaryButton =
  'px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-black transition-colors whitespace-nowrap';

function SettingCard({ icon: Icon, title, desc, children }: { icon: LucideIcon; title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="bg-white p-5 md:p-8 rounded-[20px] md:rounded-[32px] border border-slate-100 shadow-sm space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <h2 className="text-base md:text-lg font-black text-slate-900 tracking-tight leading-tight">{title}</h2>
          <p className="text-[11px] font-medium text-slate-400 mt-0.5">{desc}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function SettingRow({
  icon: Icon,
  title,
  desc,
  badge,
  action,
  children,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  badge?: { text: string; tone: 'good' | 'warn' };
  action: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="py-4 first:pt-0 last:pb-0 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Icon size={16} className="text-slate-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[13px] font-black text-slate-900">{title}</p>
              {badge && (
                <span
                  className={cn(
                    'px-2 py-0.5 text-[9px] font-black rounded-full uppercase tracking-widest',
                    badge.tone === 'good' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  )}
                >
                  {badge.text}
                </span>
              )}
            </div>
            <p className="text-[11px] font-medium text-slate-400 mt-0.5 leading-relaxed">{desc}</p>
          </div>
        </div>
        <div className="shrink-0">{action}</div>
      </div>
      {children && <div className="pl-7 space-y-2">{children}</div>}
    </div>
  );
}

function Field({ label, icon: Icon, hint, iconTop, children }: { label: string; icon: LucideIcon; hint?: string; iconTop?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 block">{label}</label>
      <div className="relative group">
        <Icon size={16} className={cn('absolute left-4 text-slate-300 group-focus-within:text-indigo-600 transition-colors', iconTop ? 'top-4' : 'top-1/2 -translate-y-1/2')} />
        {children}
      </div>
      {hint && <p className="text-[10px] font-medium text-slate-400 pl-1">{hint}</p>}
    </div>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={on}
      className={cn('w-11 h-6 rounded-full relative transition-colors', on ? 'bg-indigo-600' : 'bg-slate-200')}
    >
      <span className={cn('w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-sm', on ? 'right-1' : 'left-1')} />
    </button>
  );
}
