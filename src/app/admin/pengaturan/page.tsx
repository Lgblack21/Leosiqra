"use client";

import Image from 'next/image';
import { 
  ShieldCheck,
  Zap,
  LayoutDashboard,
  Activity,
  Search,
  Settings,
  Globe,
  Database,
  Lock,
  Save,
  ArrowRight,
  X,
  Image as ImageIcon,
  Upload,
  RefreshCw,
  Users,
  Plus,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { onAuthStateChanged, updateProfile, updatePassword } from '@/lib/cf-auth';
import { auth, db } from '@/lib/cf-client';
import { collection, getDocs } from '@/lib/cf-firestore';
import { subscribeUserProfile, UserProfile } from '@/lib/services/userService';
import { 
  subscribeAppSettings,
  saveAppSettings,
  addAdminLog,
  AppSettings,
  updateAdminProfile,
  ProPackage
} from '@/lib/services/adminService';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { exchangeRateService } from '@/lib/services/exchangeRateService';
import { currencyService, Currency } from '@/lib/services/currencyService';

type LiveCryptoQuote = {
  idr?: number;
  usd?: number;
  usd_24h_change?: number;
};

export default function AdminPengaturanPage() {
  const [userEmail, setUserEmail] = useState('admin@leosiqra.com');
  const [activeTab, setActiveTab] = useState('billing');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isRefreshingMarket, setIsRefreshingMarket] = useState(false);
  const [liveFxRates, setLiveFxRates] = useState<Record<string, number>>({});
  const [liveCrypto, setLiveCrypto] = useState<Record<string, LiveCryptoQuote>>({});
  const [liveTimestamp, setLiveTimestamp] = useState<string>('-');
  const [allCurrencies, setAllCurrencies] = useState<Currency[]>([]);

  // FETCH MARKET DATA
  const fetchMarketData = useCallback(async () => {
    setIsRefreshingMarket(true);
    try {
      // Ambil semua mata uang dari Firestore (semua user, deduplicated) — sama seperti halaman member
      const currencies = await currencyService.getAllUniqueCurrencies();
      setAllCurrencies(currencies);

      const cryptoKeywords = ['BTC', 'ETH', 'SOL', 'BNB', 'ADA', 'XRP', 'DOT', 'DOGE'];
      const userCryptos = currencies.filter(c => cryptoKeywords.includes(c.code.toUpperCase()));
      const targetIds = userCryptos.length > 0
        ? userCryptos.map(c => {
            if (c.code === 'BTC') return 'bitcoin';
            if (c.code === 'ETH') return 'ethereum';
            if (c.code === 'SOL') return 'solana';
            if (c.code === 'BNB') return 'binancecoin';
            if (c.code === 'ADA') return 'cardano';
            return '';
          }).filter(id => id !== '')
        : ['bitcoin', 'ethereum', 'solana', 'binancecoin', 'cardano'];

      const [cryptoRes, usersSnap] = await Promise.all([
        fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${targetIds.join(',')}&vs_currencies=idr,usd&include_24hr_change=true`),
        getDocs(collection(db, 'users'))
      ]);

      const crypto = (cryptoRes.ok ? await cryptoRes.json() : {}) as Record<string, LiveCryptoQuote>;
      setLiveCrypto(crypto);
      
      // Gunakan exchangeRateService — sama persis dengan halaman member
      const rates = await exchangeRateService.getLatestRates();
      setLiveFxRates(rates);
      
      // Filter: Hanya hitung role 'user' dan status bukan 'GUEST'
      const filteredUsers = usersSnap.docs.filter(doc => {
        const data = doc.data();
        return data.role === 'user' && data.status !== 'GUEST';
      });
      const totalUsers = filteredUsers.length;

      const now = new Date();
      const timestamp = now.toLocaleString('id-ID', { 
        day: '2-digit', month: '2-digit', year: 'numeric', 
        hour: '2-digit', minute: '2-digit', second: '2-digit' 
      });
      setLiveTimestamp(timestamp);

      setSettings(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          marketData: {
            userCovered: totalUsers,
            fxUpdate: currencies.filter(c => c.code !== 'IDR').length,
            cryptoUpdate: Object.keys(crypto).length,
            stockUpdate: 3,
            lastUpdate: timestamp
          }
        };
      });

    } catch (err) {
      console.error("Gagal refresh market data:", err);
    } finally {
      setIsRefreshingMarket(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'market') {
      fetchMarketData();
    }
  }, [activeTab, fetchMarketData]);
  const [loading, setLoading] = useState(true);
  const [isUploadingQRIS, setIsUploadingQRIS] = useState(false);
  const [isUploadingProfile, setIsUploadingProfile] = useState(false);
  const [isUploadingMaintenanceImage, setIsUploadingMaintenanceImage] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingAccount, setIsSavingAccount] = useState(false);

  const passwordStrength = useMemo(() => {
    const hasUpperCaseStart = /^[A-Z]/.test(newPassword);
    const hasMinLength = newPassword.length >= 6;
    const hasSymbol = /[!@#$%^&*(),.?":{}|<>;]/.test(newPassword);
    const hasNumber = /\d/.test(newPassword);

    const metCriteria = [hasUpperCaseStart, hasMinLength, hasSymbol, hasNumber].filter(Boolean).length;

    if (newPassword.length === 0) return { label: 'Kosong', color: 'bg-slate-200', width: 'w-0' };
    if (hasUpperCaseStart && hasMinLength && hasSymbol && hasNumber) return { label: 'Kuat', color: 'bg-emerald-500', width: 'w-full' };
    if (metCriteria >= 3) return { label: 'Sedang', color: 'bg-orange-500', width: 'w-2/3' };
    return { label: 'Lemah', color: 'bg-red-500', width: 'w-1/3' };
  }, [newPassword]);
  
  useEffect(() => {
    let unsubProfile: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserEmail(user.email || 'admin@leosiqra.com');
        unsubProfile = subscribeUserProfile(user.uid, (data) => {
          setProfile(data);
        });
      }
    });

    const unsubSettings = subscribeAppSettings((data) => {
      if (data) setSettings(data);
      setLoading(false);
    });

    return () => {
      unsubAuth();
      unsubSettings();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  const handleSaveSettings = async () => {
    if (!settings) return;
    try {
      await saveAppSettings(settings);
      await addAdminLog({
        adminEmail: userEmail,
        action: 'UPDATE_SETTINGS',
        target: 'global_config',
        note: `Memperbarui konfigurasi sistem di tab ${activeTab}`,
        color: 'emerald'
      });
      alert('Konfigurasi berhasil disimpan!');
    } catch (error) {
      console.error(error);
      alert('Gagal menyimpan konfigurasi.');
    }
  };

  const handleQRISUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !settings) return;

    try {
      setIsUploadingQRIS(true);
      const url = await uploadToCloudinary(file);
      setSettings({ ...settings, qrisURL: url });
      alert('QRIS berhasil diunggah! Jangan lupa simpan perubahan.');
    } catch (error) {
      console.error(error);
      alert('Gagal mengunggah QRIS.');
    } finally {
      setIsUploadingQRIS(false);
    }
  };

  const handleProfileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const user = auth.currentUser;
    if (!user) return;

    try {
      setIsUploadingProfile(true);
      const url = await uploadToCloudinary(file);
      
      // Update Firestore
      await updateAdminProfile(user.uid, { photoURL: url });
      
      // Update Auth Profile for fallback/consistency
      await updateProfile(user, { photoURL: url });
      
      alert('Foto profil berhasil diperbarui!');
    } catch (error) {
      console.error(error);
      alert('Gagal mengunggah foto profil.');
    } finally {
      setIsUploadingProfile(false);
    }
  };

  const handleSaveAccount = async () => {
    const user = auth.currentUser;
    if (!user) return;

    if (newPassword) {
      if (newPassword !== confirmPassword) {
        alert('Konfirmasi password tidak cocok.');
        return;
      }
      if (passwordStrength.label !== 'Kuat') {
        alert('Password harus memenuhi kriteria keamanan (Dimulai Huruf Besar, min 6 char, ada Simbol & Angka).');
        return;
      }

      try {
        setIsSavingAccount(true);
        await updatePassword(user, newPassword);
        
        await addAdminLog({
          adminEmail: userEmail,
          action: 'UPDATE_PASSWORD',
          target: 'admin_account',
          note: 'Memperbarui password akun admin',
          color: 'orange'
        });

        alert('Password berhasil diperbarui!');
        setNewPassword('');
        setConfirmPassword('');
      } catch (error: unknown) {
        console.error(error);
        const code = (error as { code?: string } | null)?.code;
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (code === 'auth/requires-recent-login') {
          alert('Sesi Anda sudah lama. Silakan logout dan login kembali untuk mengubah password.');
        } else {
          alert('Gagal memperbarui password: ' + message);
        }
      } finally {
        setIsSavingAccount(false);
      }
    } else {
      alert('Masukkan password baru jika ingin mengubah.');
    }
  };

  const handleMaintenanceImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingMaintenanceImage(true);
      const url = await uploadToCloudinary(file);
      setSettings(prev => ({ 
        ...prev as AppSettings, 
        maintenance: { ...(prev as AppSettings).maintenance!, imageUrl: url } 
      }));
      alert('Gambar maintenance berhasil diunggah!');
    } catch (error) {
      console.error(error);
      alert('Gagal mengunggah gambar maintenance.');
    } finally {
      setIsUploadingMaintenanceImage(false);
    }
  };

  return (
    <div className="space-y-12 pb-20 max-w-[1600px] mx-auto">
      {/* HEADER SECTION */}
      <div className="flex flex-col xl:flex-row gap-12">
        <div className="flex-1 space-y-10">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-slate-900/10">
              <Zap size={10} className="text-indigo-400 fill-indigo-400" />
              Leosiqra Operations Console
            </div>
            <div className="space-y-4">
              <h1 className="text-5xl lg:text-6xl font-serif font-black text-slate-900 leading-[1.05] tracking-tight">
                Konfigurasi Sistem
              </h1>
              <p className="text-slate-400 font-medium text-base lg:text-lg leading-relaxed max-w-2xl">
                Atur parameter utama aplikasi, kelola integrasi pihak ketiga, dan sesuaikan kebijakan sistem dalam panel kontrol pusat.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { tag: 'GENERAL', title: 'Variabel Aplikasi', desc: 'Kelola nama aplikasi, logo, dan pengaturan dasar UI global.', color: 'text-slate-500', bg: 'bg-slate-50/50' },
              { tag: 'INTEGRATION', title: 'Gateway & API', desc: 'Hubungkan sistem dengan Cloudinary, Midtrans, atau pihak ketiga.', color: 'text-indigo-500', bg: 'bg-indigo-50/50' },
              { tag: 'SECURITY', title: 'Kebijakan Akses', desc: 'Atur limitasi pendaftaran, reset password, dan audit log sistem.', color: 'text-rose-500', bg: 'bg-rose-50/50' },
            ].map((card) => (
              <div key={card.tag} className="group p-8 rounded-[40px] bg-white border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] space-y-5 hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1 transition-all duration-500">
                <div className={cn("inline-flex px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase", card.bg, card.color)}>
                  {card.tag}
                </div>
                <div className="space-y-2">
                  <h3 className="font-serif font-black text-slate-900 text-xl leading-tight group-hover:text-indigo-600 transition-colors">{card.title}</h3>
                  <p className="text-slate-400 font-medium text-xs leading-relaxed">{card.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="w-full xl:w-[400px]">
          <div className="p-10 rounded-[48px] bg-slate-900 text-white shadow-2xl shadow-indigo-500/10 space-y-10 relative overflow-hidden">
            <div className="relative z-10 space-y-8">
              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Config Console</p>
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={16} />
                  <input 
                    type="text" 
                    placeholder="Search system parameters..."
                    className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-[13px] font-medium placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:bg-white/10 transition-all italic"
                  />
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Operations access</p>
                   <div className="px-6 py-4 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-between">
                     <span className="text-[11px] font-black tracking-wide text-indigo-300">
                       {userEmail.replace(/(.{1}).+@(.{1}).+/, "$1********@$2***.com")}
                     </span>
                     <div className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-[9px] font-black text-indigo-400 border border-indigo-500/30 uppercase tracking-widest">
                       PRO
                     </div>
                   </div>
                </div>

                <div className="p-8 rounded-[36px] bg-gradient-to-br from-slate-700 to-slate-900 text-white border border-white/10 space-y-4 shadow-xl shadow-slate-900/40">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-md">
                      <LayoutDashboard size={16} className="text-white" />
                    </div>
                    <h4 className="text-[11px] font-black uppercase tracking-[0.15em]">System Ready</h4>
                  </div>
                  <p className="text-[11px] font-medium text-slate-400 leading-relaxed">
                    Panel konfigurasi siap menerima perubahan parameter sistem secara instan.
                  </p>
                </div>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-slate-500/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
          </div>
        </div>
      </div>

      {/* TAB SWITCHER */}
      <div className="flex overflow-x-auto no-scrollbar gap-3 p-2 bg-slate-50 border border-slate-100 rounded-[32px] w-full max-w-full">
        {[
          { id: 'billing', label: 'Konfigurasi Pembayaran', icon: Database },
          { id: 'account', label: 'Konfigurasi Akun', icon: Lock },
          { id: 'member', label: 'Konfigurasi Member', icon: Users },
          { id: 'maintenance', label: 'Maintenance Mode', icon: Activity },
          { id: 'market', label: 'Market Control Center', icon: Globe },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center justify-center shrink-0 gap-3 px-8 py-4 rounded-3xl text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
              activeTab === tab.id 
                ? "bg-white text-slate-900 shadow-xl shadow-slate-200 ring-1 ring-slate-100 scale-[1.02]" 
                : "text-slate-400 hover:text-slate-600 hover:bg-white/50"
            )}
          >
            <tab.icon size={14} className={activeTab === tab.id ? "text-indigo-600" : "text-slate-300"} />
            {tab.label}
          </button>
        ))}
      </div>
      
      {loading && (
        <div className="flex items-center gap-4 p-8 bg-indigo-50 border border-indigo-100 rounded-3xl animate-pulse">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-[11px] font-black text-indigo-500 uppercase tracking-widest">Sinkronisasi data database...</p>
        </div>
      )}

      {activeTab === 'billing' && !loading && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Billing Configuration</p>
              <h3 className="text-3xl font-serif font-black text-slate-900 tracking-tight">Konfigurasi Pembayaran</h3>
            </div>
            <div className="px-5 py-2 rounded-full border border-slate-200 text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">
              Revenue Critical
            </div>
          </div>

          <div className="p-10 rounded-[48px] bg-slate-500 text-white/90 space-y-3">
            <h4 className="text-lg font-black tracking-tight">Prioritas pengisian</h4>
            <p className="text-sm font-medium leading-relaxed opacity-80 max-w-2xl">
              Lengkapi kontak, harga, dan rekening utama terlebih dahulu. QRIS dan maintenance dipakai saat alur transaksi dasar sudah stabil.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[13px] font-black text-slate-900">Email Kontak</label>
              <input 
                type="email" 
                value={settings?.billingEmail || ''}
                onChange={(e) => setSettings(prev => ({ ...prev as AppSettings, billingEmail: e.target.value }))}
                className="w-full px-6 py-4 bg-white border border-slate-100 rounded-2xl text-[14px] font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none shadow-sm" 
              />
            </div>
            <div className="space-y-3">
              <label className="text-[13px] font-black text-slate-900">WhatsApp Kontak</label>
              <input 
                type="text" 
                placeholder="62812xxxx" 
                value={settings?.whatsapp || ''}
                onChange={(e) => setSettings(prev => ({ ...prev as AppSettings, whatsapp: e.target.value }))}
                className="w-full px-6 py-4 bg-white border border-slate-100 rounded-2xl text-[14px] font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none shadow-sm" 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
            <div className="space-y-3">
              <label className="text-[13px] font-black text-slate-900">Harga Pro / Bulan (IDR)</label>
              <input 
                type="number" 
                value={settings?.proPrice || 0}
                onChange={(e) => setSettings(prev => ({ ...prev as AppSettings, proPrice: Number(e.target.value) }))}
                className="w-full px-6 py-4 bg-white border border-slate-100 rounded-2xl text-[14px] font-bold text-indigo-600" 
              />
            </div>
            <div className="space-y-3">
              <label className="text-[13px] font-black text-slate-900">Nama Bank</label>
              <input 
                type="text" 
                value={settings?.bankName || ''}
                onChange={(e) => setSettings(prev => ({ ...prev as AppSettings, bankName: e.target.value }))}
                className="w-full px-6 py-4 bg-white border border-slate-100 rounded-2xl text-[14px] font-medium" 
              />
            </div>
            <div className="space-y-3">
              <label className="text-[13px] font-black text-slate-900">Atas Nama</label>
              <input 
                type="text" 
                value={settings?.bankAccountName || ''}
                onChange={(e) => setSettings(prev => ({ ...prev as AppSettings, bankAccountName: e.target.value }))}
                className="w-full px-6 py-4 bg-white border border-slate-100 rounded-2xl text-[14px] font-medium" 
              />
            </div>
            <div className="space-y-3">
              <label className="text-[13px] font-black text-slate-900">No Rekening</label>
              <input 
                type="text" 
                value={settings?.bankNumber || ''}
                onChange={(e) => setSettings(prev => ({ ...prev as AppSettings, bankNumber: e.target.value }))}
                className="w-full px-6 py-4 bg-white border border-slate-100 rounded-2xl text-[14px] font-medium" 
              />
            </div>
          </div>

          <div className="space-y-10">
            <div className="space-y-6">
              <label className="text-[13px] font-black text-slate-900">Pembayaran QRIS</label>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div className="space-y-4">
                  <div className="p-8 rounded-[32px] bg-white shadow-sm flex flex-col items-center gap-6">
                    {settings?.qrisURL ? (
                      <div className="relative w-48 h-48 rounded-2xl overflow-hidden">
                        <Image src={settings.qrisURL} alt="QRIS Preview" fill className="object-contain" />
                      </div>
                    ) : (
                      <div className="w-48 h-48 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300">
                        <ImageIcon size={48} strokeWidth={1} />
                        <span className="text-[10px] font-black uppercase tracking-widest mt-2">No QRIS Image</span>
                      </div>
                    )}

                    <div className="w-full">
                      <input 
                        type="file" 
                        id="qris-input" 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleQRISUpload}
                        disabled={isUploadingQRIS}
                      />
                      <label 
                        htmlFor="qris-input"
                        className={cn(
                          "w-full flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-indigo-600 transition-all shadow-lg shadow-slate-900/10",
                          isUploadingQRIS && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        {isUploadingQRIS ? (
                          <>
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload size={14} />
                            Upload QRIS Baru
                          </>
                        )}
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">QRIS Text Label</label>
                    <input 
                      type="text" 
                      placeholder="Contoh: Scan untuk Bayar" 
                      value={settings?.qrisText || ''}
                      onChange={(e) => setSettings(prev => ({ ...prev as AppSettings, qrisText: e.target.value }))}
                      className="w-full px-6 py-4 bg-white border border-slate-100 rounded-2xl text-[14px] font-medium" 
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Direct URL Link (Opsional)</label>
                    <input 
                      type="text" 
                      placeholder="https://..." 
                      value={settings?.qrisURL || ''}
                      onChange={(e) => setSettings(prev => ({ ...prev as AppSettings, qrisURL: e.target.value }))}
                      className="w-full px-6 py-4 bg-white border border-slate-100 rounded-2xl text-[14px] font-medium opacity-50" 
                    />
                    <p className="text-[10px] font-bold text-slate-400 ml-1 italic">*URL akan otomatis terisi saat gambar diunggah.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'member' && !loading && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="space-y-2">
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Membership Configuration</p>
            <h3 className="text-3xl font-serif font-black text-slate-900 tracking-tight">Konfigurasi Member</h3>
          </div>

          {/* Konfigurasi Free Plan */}
          <div className="p-8 md:p-10 rounded-[48px] bg-white border border-slate-100 shadow-sm space-y-8">
            <div className="flex items-center gap-4 border-b border-slate-100 pb-6">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
                <Users className="text-indigo-600" size={24} />
              </div>
              <div>
                <h4 className="text-lg font-black text-slate-900">Aturan Free Plan</h4>
                <p className="text-[11px] font-medium text-slate-400">Tentukan masa berlaku gratis (Free Plan) untuk user guest baru.</p>
              </div>
            </div>

            <div className="max-w-xs space-y-3">
              <label className="text-[13px] font-black text-slate-900">Durasi Free Plan (Hari)</label>
              <div className="relative">
                <input 
                  type="number" 
                  value={settings?.freePlanDays || 0}
                  onChange={(e) => setSettings(prev => ({ ...prev as AppSettings, freePlanDays: parseInt(e.target.value) || 0 }))}
                  className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-[14px] font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                />
                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold pointer-events-none">Hari</span>
              </div>
            </div>
          </div>

          {/* Konfigurasi Paket Pro */}
          <div className="p-8 md:p-10 rounded-[48px] bg-white border border-slate-100 shadow-sm space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-100 pb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
                  <Database className="text-amber-500" size={24} />
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-900">Daftar Paket Pro</h4>
                  <p className="text-[11px] font-medium text-slate-400">Atur opsi langganan bulanan maupun tahunan secara dinamis.</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  const newPackage: ProPackage = {
                    id: Date.now().toString(),
                    name: 'Paket Baru',
                    durationMonths: 1,
                    price: 50000,
                    isPopular: false
                  };
                  setSettings(prev => ({
                    ...prev as AppSettings,
                    proPackages: [...(prev?.proPackages || []), newPackage]
                  }));
                }}
                className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[11px] font-black tracking-widest uppercase flex items-center gap-2 hover:bg-slate-800 transition-colors shrink-0"
              >
                <Plus size={14} /> Tambah Paket
              </button>
            </div>

            <div className="space-y-4">
              {(settings?.proPackages?.length || 0) === 0 ? (
                <div className="p-8 rounded-3xl border-2 border-dashed border-slate-200 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto text-slate-400">
                    <Database size={20} />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-600">Belum Ada Paket</h5>
                    <p className="text-xs text-slate-400">Silakan tambahkan paket berlangganan baru, atau sistem akan memunculkan harga default.</p>
                  </div>
                </div>
              ) : (
                settings?.proPackages?.map((pkg, index) => (
                  <div key={pkg.id} className="p-6 rounded-3xl bg-slate-50 border border-slate-100 flex flex-col xl:flex-row xl:items-end gap-6 relative group">
                    <button 
                      onClick={() => {
                        setSettings(prev => ({
                          ...prev as AppSettings,
                          proPackages: prev?.proPackages?.filter(p => p.id !== pkg.id)
                        }));
                      }}
                      className="absolute top-6 right-6 p-2 bg-white text-rose-500 rounded-lg shadow-sm border border-slate-100 opacity-50 hover:opacity-100 hover:bg-rose-50 transition-all z-10"
                    >
                      <Trash2 size={16} />
                    </button>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 pr-12 xl:pr-0">
                      <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-2">Nama Paket</label>
                        <input
                          type="text"
                          value={pkg.name}
                          onChange={(e) => {
                            const newArr = [...(settings.proPackages || [])];
                            newArr[index].name = e.target.value;
                            setSettings({ ...settings, proPackages: newArr });
                          }}
                          className="w-full px-5 py-3 bg-white border border-slate-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-100 outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-2">Harga (IDR)</label>
                         <input
                           type="number"
                           value={pkg.price}
                           onChange={(e) => {
                             const newArr = [...(settings.proPackages || [])];
                             newArr[index].price = Number(e.target.value);
                             setSettings({ ...settings, proPackages: newArr });
                           }}
                           className="w-full px-5 py-3 bg-white border border-slate-100 rounded-xl text-sm font-bold text-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none"
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-2">Masa Berlaku (Bulan)</label>
                         <div className="flex gap-4 items-center">
                           <input
                             type="number"
                             value={pkg.durationMonths}
                             onChange={(e) => {
                               const newArr = [...(settings.proPackages || [])];
                               newArr[index].durationMonths = Number(e.target.value);
                               setSettings({ ...settings, proPackages: newArr });
                             }}
                             className="w-full px-5 py-3 bg-white border border-slate-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-100 outline-none"
                           />
                           <label className="flex items-center gap-2 cursor-pointer shrink-0">
                             <input 
                               type="checkbox" 
                               checked={pkg.isPopular || false}
                               onChange={(e) => {
                                 const newArr = [...(settings.proPackages || [])];
                                 newArr[index].isPopular = e.target.checked;
                                 setSettings({ ...settings, proPackages: newArr });
                               }}
                               className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                             />
                             <span className="text-[11px] font-black uppercase text-amber-500 tracking-wider">Populer</span>
                           </label>
                         </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'account' && !loading && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="space-y-2">
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Account Management</p>
            <h3 className="text-3xl font-serif font-black text-slate-900 tracking-tight">Konfigurasi Akun Admin</h3>
          </div>

          <div className="flex flex-col lg:flex-row gap-12">
            <div className="w-full lg:w-1/3 space-y-6">
              <div className="p-10 rounded-[48px] bg-white border border-slate-100 shadow-sm flex flex-col items-center text-center space-y-6">
                <div className="relative group">
                  <div className="relative w-32 h-32 rounded-[40px] bg-slate-100 border-4 border-white shadow-xl flex items-center justify-center overflow-hidden">
                    {profile?.photoURL ? (
                      <Image src={profile.photoURL} alt="Profile" fill className="object-cover" />
                    ) : (
                      <Image
                        src={`https://ui-avatars.com/api/?name=${userEmail}&background=6366f1&color=fff&size=128`}
                        alt="Profile"
                        fill
                      />
                    )}
                  </div>
                  <button className="absolute -bottom-2 -right-2 w-10 h-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg hover:bg-slate-900 transition-all border-4 border-white">
                    <Settings size={16} />
                  </button>
                </div>
                <div className="w-full">
                  <input 
                    type="file" 
                    id="admin-photo-input" 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleProfileUpload}
                    disabled={isUploadingProfile}
                  />
                  <label 
                    htmlFor="admin-photo-input"
                    className={cn(
                      "w-full flex items-center justify-center gap-2 py-4 bg-slate-50 text-slate-500 border border-slate-100 rounded-3xl text-[11px] font-black uppercase tracking-widest cursor-pointer hover:border-indigo-500 transition-all",
                      isUploadingProfile && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {isUploadingProfile ? "Uploading..." : "Upload Foto Baru"}
                  </label>
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-8">
              <div className="p-10 rounded-[48px] bg-white border border-slate-100 shadow-sm space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[13px] font-black text-slate-900">Email Admin Utama</label>
                    <input type="email" defaultValue={userEmail} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[14px] font-medium" />
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <label className="text-[13px] font-black text-slate-900">Password Baru</label>
                      <input 
                        type="password" 
                        placeholder="Min 6 karakter, Simbol, Angka" 
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[14px] font-medium" 
                      />
                    </div>
                    
                    {/* Strength Indicator */}
                    {newPassword && (
                      <div className="px-1 space-y-1.5">
                        <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-500 ${passwordStrength.width} ${passwordStrength.color}`} />
                        </div>
                        <p className="text-[10px] font-bold text-slate-400">
                          Kekuatan: <span className="text-slate-900 uppercase">{passwordStrength.label}</span>
                        </p>
                      </div>
                    )}

                    <div className="space-y-3">
                      <label className="text-[13px] font-black text-slate-900">Ulangi Password</label>
                      <input 
                        type="password" 
                        placeholder="••••••••" 
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[14px] font-medium" 
                      />
                    </div>
                  </div>
                </div>
                <button 
                  onClick={handleSaveAccount}
                  disabled={isSavingAccount}
                  className={cn(
                    "flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-[24px] text-[11px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg shadow-slate-900/10",
                    isSavingAccount && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isSavingAccount ? (
                    "Memperbarui..."
                  ) : (
                    <>
                      <Save size={14} /> Perbarui Password & Akun
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'maintenance' && !loading && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="space-y-8">
            <div className="p-8 lg:p-12 rounded-[40px] bg-white border border-slate-100 shadow-sm flex items-center justify-between gap-8">
              <div className="space-y-2">
                <h4 className="text-2xl font-serif font-black text-slate-900 tracking-tight">Status Maintenance</h4>
                <p className="text-sm font-medium text-slate-400 leading-relaxed">Aktifkan untuk mengalihkan seluruh akses member ke layar pemeliharaan.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer group">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={settings?.maintenance?.isActive || false}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev as AppSettings, 
                    maintenance: { ...(prev as AppSettings).maintenance!, isActive: e.target.checked } 
                  }))}
                />
                <div className="w-20 h-10 bg-slate-100 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-10 peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-8 after:w-8 after:transition-all peer-checked:bg-indigo-600 shadow-inner group-hover:ring-4 group-hover:ring-slate-50 transition-all"></div>
              </label>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6 p-8 lg:p-10 rounded-[40px] bg-white border border-slate-100 shadow-sm">
                <div className="space-y-2">
                  <h5 className="text-lg font-black text-slate-900 tracking-tight">Konfigurasi Konten</h5>
                  <p className="text-[11px] font-medium text-slate-400">Pilih bagaimana maintenance akan ditampilkan ke user.</p>
                </div>

                <div className="flex p-1.5 bg-slate-50 rounded-2xl gap-1">
                  <button 
                    onClick={() => setSettings(prev => ({ ...prev as AppSettings, maintenance: { ...(prev as AppSettings).maintenance!, type: 'code' } }))}
                    className={cn(
                      "flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all",
                      settings?.maintenance?.type === 'code' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    Mode Program (HTML)
                  </button>
                  <button 
                    onClick={() => setSettings(prev => ({ ...prev as AppSettings, maintenance: { ...(prev as AppSettings).maintenance!, type: 'image' } }))}
                    className={cn(
                      "flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all",
                      settings?.maintenance?.type === 'image' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    Mode Gambar
                  </button>
                </div>

                {settings?.maintenance?.type === 'code' ? (
                  <div className="space-y-4 pt-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black text-slate-900 uppercase tracking-widest">HTML Code Template</label>
                      <button 
                        onClick={() => setShowPreviewModal(true)}
                        className="text-[10px] font-black text-indigo-600 hover:underline flex items-center gap-1"
                      >
                        Lihat Preview <ArrowRight size={12} />
                      </button>
                    </div>
                    <textarea 
                      className="w-full p-6 bg-slate-900 text-indigo-300 font-mono text-[12px] rounded-3xl min-h-[300px] outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all border border-slate-800"
                      placeholder="Masukkan kode HTML/CSS kustom Anda di sini..."
                      value={settings?.maintenance?.code || ''}
                      onChange={(e) => setSettings(prev => ({ 
                        ...prev as AppSettings, 
                        maintenance: { ...(prev as AppSettings).maintenance!, code: e.target.value } 
                      }))}
                    />
                  </div>
                ) : (
                  <div className="space-y-6 pt-4">
                    <label className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Maintenance Image</label>
                    
                    <div className="aspect-video w-full rounded-[32px] bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center overflow-hidden relative group">
                      {settings?.maintenance?.imageUrl ? (
                        <>
                          <Image src={settings.maintenance.imageUrl} alt="Maintenance" fill className="object-cover" />
                          <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button 
                              onClick={() => setShowPreviewModal(true)}
                              className="px-6 py-2 bg-white text-slate-900 rounded-full text-[10px] font-black uppercase tracking-widest"
                            >
                              Zoom Preview
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-3 text-slate-300">
                          <ImageIcon size={48} strokeWidth={1} />
                          <p className="text-[10px] font-black uppercase tracking-widest">No Image Selected</p>
                        </div>
                      )}
                    </div>

                    <div className="w-full">
                      <input 
                        type="file" 
                        id="maintenance-image-input" 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleMaintenanceImageUpload}
                        disabled={isUploadingMaintenanceImage}
                      />
                      <label 
                        htmlFor="maintenance-image-input"
                        className={cn(
                          "w-full flex items-center justify-center gap-2 py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest cursor-pointer hover:bg-slate-800 transition-all",
                          isUploadingMaintenanceImage && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        {isUploadingMaintenanceImage ? "Uploading..." : "Upload Gambar Maintenance"}
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-8 flex flex-col justify-between">
                <div className="p-8 lg:p-10 rounded-[40px] bg-indigo-600 text-white shadow-xl shadow-indigo-200 relative overflow-hidden">
                  <div className="relative z-10 space-y-6">
                    <h5 className="text-xl font-serif font-black tracking-tight">Kenapa Mode Ini?</h5>
                    <p className="text-sm font-medium text-indigo-100 leading-relaxed">
                      Mode &quot;Advanced&quot; memberikan Anda kebebasan penuh. Gunakan **Mode Program** jika Anda memiliki desain khusus berbasis kode, atau **Mode Gambar** jika Anda sudah menyiapkan banner maintenance dari desainer.
                    </p>
                    <div className="pt-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                        <ShieldCheck size={20} />
                      </div>
                      <span className="text-[11px] font-black uppercase tracking-widest">Full Control Protocol</span>
                    </div>
                  </div>
                  <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-white/10 blur-3xl rounded-full" />
                </div>

                <div className="p-10 rounded-[40px] bg-slate-50 border border-slate-100 flex flex-col gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fallback Message</p>
                    <p className="text-xs font-bold text-slate-500 italic">&quot;Kami kembali sebentar lagi. Leosiqra sedang dalam pemeliharaan sistem.&quot;</p>
                  </div>
                  <button 
                    onClick={handleSaveSettings}
                    className="w-full py-5 bg-[#2563EB] text-white rounded-[24px] text-[13px] font-black tracking-wide hover:bg-slate-900 transition-all shadow-xl shadow-blue-500/20 active:scale-[0.98]"
                  >
                    Simpan & Aktifkan Perubahan
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col animate-in fade-in duration-300">
          <div className="h-16 border-b border-white/10 flex items-center justify-between px-8 bg-slate-900/50 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-white text-[11px] font-black uppercase tracking-[0.2em]">Live Maintenance Preview</span>
            </div>
            <button 
              onClick={() => setShowPreviewModal(false)}
              className="p-2 text-white/60 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>
          <div className="flex-1 overflow-hidden relative">
            {settings?.maintenance?.type === 'code' ? (
              <div 
                className="w-full h-full overflow-auto bg-white"
                dangerouslySetInnerHTML={{ __html: settings?.maintenance?.code || '<div style="display:flex;align-items:center;justify-center;height:100vh;font-family:sans-serif;"><h1>No Code Content</h1></div>' }}
              />
            ) : (
              <div className="relative w-full h-full flex items-center justify-center bg-black">
                {settings?.maintenance?.imageUrl ? (
                  <Image src={settings.maintenance.imageUrl} alt="Maintenance Preview" fill className="object-contain" />
                ) : (
                  <p className="text-white/40 font-mono text-xs uppercase tracking-widest">No Image uploaded</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'market' && !loading && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Market Controller Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Market Control</p>
              <h3 className="text-3xl font-serif font-black text-slate-900 tracking-tight">Market Control Center</h3>
              <p className="text-slate-400 font-medium text-xs max-w-xl leading-relaxed">
                Pantau hasil sinkron market seluruh user dan jalankan refresh global saat dibutuhkan tanpa keluar dari ruang konfigurasi.
              </p>
            </div>
            <button 
              onClick={fetchMarketData}
              disabled={isRefreshingMarket}
              className={cn(
                "px-6 py-3 border border-slate-200 rounded-2xl text-[11px] font-black text-slate-900 uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2",
                isRefreshingMarket && "opacity-50 cursor-not-allowed"
              )}
            >
              <RefreshCw size={14} className={cn(isRefreshingMarket && "animate-spin")} />
              {isRefreshingMarket ? "Refreshing..." : "Refresh Semua User"}
            </button>
          </div>

          {/* Market Analytics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'USER TER-COVER', value: settings?.marketData?.userCovered || 0 },
              { label: 'FX TER-UPDATE', value: settings?.marketData?.fxUpdate || 0 },
              { label: 'CRYPTO TER-UPDATE', value: settings?.marketData?.cryptoUpdate || 0 },
              { label: 'STOCK/EMAS', value: settings?.marketData?.stockUpdate || 0 },
            ].map((stat) => (
              <div key={stat.label} className="p-8 rounded-[36px] bg-white border border-slate-100 shadow-sm space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                <p className="text-4xl font-serif font-black text-slate-900">{stat.value}</p>
              </div>
            ))}
            <div className="md:col-span-2 lg:col-span-2 p-8 rounded-[36px] bg-white border border-slate-100 shadow-sm space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">UPDATE TERAKHIR</p>
              <p className="text-4xl font-serif font-black text-slate-900 tracking-tight">
                {settings?.marketData?.lastUpdate || '-'}
              </p>
            </div>
          </div>

          {/* FX Table */}
          <div className="space-y-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-4 text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Pair</th>
                    <th className="pb-4 text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Rate</th>
                    <th className="pb-4 text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">User</th>
                    <th className="pb-4 text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(() => {
                    const idrRate = liveFxRates.IDR || 0;
                    // Ambil dari Firestore (sama seperti halaman member), filter IDR
                    const fxCurrencies = allCurrencies.filter(c => c.code !== 'IDR');
                    if (fxCurrencies.length === 0) {
                      return (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-[11px] text-slate-400 italic">
                            Klik &quot;Refresh Semua User&quot; untuk memuat data kurs.
                          </td>
                        </tr>
                      );
                    }
                    return fxCurrencies.map((c, idx) => {
                      const rate = liveFxRates[c.code] ? (idrRate / liveFxRates[c.code]) : null;
                      return (
                        <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                          <td className="py-4">
                            <p className="text-[11px] font-black text-slate-500">{c.code}_IDR</p>
                            <p className="text-[9px] font-medium text-slate-400">{c.name}</p>
                          </td>
                          <td className="py-4 text-[11px] font-bold text-slate-900">
                            {rate ? `Rp ${rate.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : <span className="text-slate-300 italic">—</span>}
                          </td>
                          <td className="py-4 text-[11px] font-medium text-slate-400">{settings?.marketData?.userCovered || 0}</td>
                          <td className="py-4 text-[11px] font-medium text-slate-400 font-mono tracking-tight">{liveTimestamp}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          {/* Crypto Feed */}
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">CRYPTO FEED</p>
              <h4 className="text-4xl font-serif font-black text-slate-900/10 tracking-tight -mb-2">Digital Assets</h4>
            </div>
            <div className="overflow-x-auto pt-4">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-4 text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Crypto</th>
                    <th className="pb-4 text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Price (IDR)</th>
                    <th className="pb-4 text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">24h Change</th>
                    <th className="pb-4 text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">User</th>
                    <th className="pb-4 text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(() => {
                    const pairs = [
                      { asset: 'BTC', name: 'Bitcoin', id: 'bitcoin' },
                      { asset: 'ETH', name: 'Ethereum', id: 'ethereum' },
                      { asset: 'BNB', name: 'BNB', id: 'binancecoin' },
                      { asset: 'SOL', name: 'Solana', id: 'solana' },
                      { asset: 'ADA', name: 'Cardano', id: 'cardano' },
                    ];
                    return pairs.map((p, idx) => {
                      const priceIDR = liveCrypto[p.id]?.idr;
                      const priceUSD = liveCrypto[p.id]?.usd;
                      const change = liveCrypto[p.id]?.usd_24h_change;
                      return (
                        <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                          <td className="py-4">
                            <p className="text-[11px] font-black text-slate-900">{p.asset}</p>
                            <p className="text-[9px] font-medium text-slate-400">{p.name}</p>
                          </td>
                          <td className="py-4">
                            {priceIDR ? (
                              <>
                                <p className="text-[11px] font-bold text-slate-900">Rp {priceIDR.toLocaleString('id-ID')}</p>
                                <p className="text-[9px] font-medium text-slate-400">${priceUSD?.toLocaleString('en-US')}</p>
                              </>
                            ) : <span className="text-[11px] text-slate-300 italic">Belum direfresh</span>}
                          </td>
                          <td className={`py-4 text-[11px] font-bold ${change == null ? 'text-slate-400' : change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {change != null ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%` : `—`}
                          </td>
                          <td className="py-4 text-[11px] font-medium text-slate-400">{settings?.marketData?.userCovered || 0}</td>
                          <td className="py-4 text-[11px] font-medium text-slate-400 font-mono tracking-tight">{liveTimestamp}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          {/* Saham IDX */}
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">SAHAM IDX</p>
              <h4 className="text-4xl font-serif font-black text-slate-900/10 tracking-tight -mb-2">Equity Monitoring</h4>
            </div>
            <div className="overflow-x-auto pt-4">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-4 text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Emiten</th>
                    <th className="pb-4 text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Harga</th>
                    <th className="pb-4 text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Source</th>
                    <th className="pb-4 text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">User</th>
                    <th className="pb-4 text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {[
                    { asset: '^JKSE (IHSG)', price: '7.285', source: 'YAHOO' },
                    { asset: 'BBCA.JK', price: '10.200', source: 'YAHOO' },
                    { asset: 'BBRI.JK', price: '4.130', source: 'YAHOO' },
                  ].map((row, idx) => (
                    <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 text-[11px] font-black text-slate-500">{row.asset}</td>
                      <td className="py-4 text-[11px] font-bold text-slate-900">{row.price}</td>
                      <td className="py-4 text-[9px] font-black text-indigo-400 uppercase tracking-tighter">{row.source}</td>
                      <td className="py-4 text-[11px] font-medium text-slate-400">{settings?.marketData?.userCovered || 0}</td>
                      <td className="py-4 text-[11px] font-medium text-slate-400 font-mono tracking-tight">{(window as Window & { liveMarket?: { timestamp?: string } }).liveMarket?.timestamp || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Emas & Komoditas */}
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">EMAS & KOMODITAS</p>
              <h4 className="text-4xl font-serif font-black text-slate-900/10 tracking-tight -mb-2">Precious Metals</h4>
            </div>
            <div className="overflow-x-auto pt-4">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-4 text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Aset</th>
                    <th className="pb-4 text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Harga</th>
                    <th className="pb-4 text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Source</th>
                    <th className="pb-4 text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">User</th>
                    <th className="pb-4 text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {[
                    { asset: 'XAUUSD (Emas)', price: 'Rp 1.690.000 / gram', source: 'REFERENSI' },
                    { asset: 'Emas Antam', price: 'Rp 1.920.000 / gram', source: 'LOGAM MULIA' },
                  ].map((row, idx) => (
                    <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 text-[11px] font-black text-slate-500">{row.asset}</td>
                      <td className="py-4 text-[11px] font-bold text-slate-900">{row.price}</td>
                      <td className="py-4 text-[9px] font-black text-amber-500 uppercase tracking-tighter">{row.source}</td>
                      <td className="py-4 text-[11px] font-medium text-slate-400">{settings?.marketData?.userCovered || 0}</td>
                      <td className="py-4 text-[11px] font-medium text-slate-400 font-mono tracking-tight">{(window as Window & { liveMarket?: { timestamp?: string } }).liveMarket?.timestamp || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {(activeTab === 'billing' || activeTab === 'member') && (
        <div className="pt-12 flex justify-end">
          <button 
            onClick={handleSaveSettings}
            className="flex items-center gap-3 px-10 py-5 bg-slate-900 text-white rounded-[32px] text-[13px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-2xl shadow-slate-900/20 group"
          >
            <Save size={18} className="group-hover:scale-110 transition-transform" />
            Simpan Seluruh Konfigurasi
          </button>
        </div>
      )}
    </div>
  );
}

