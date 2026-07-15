"use client";

import Image from 'next/image';
import {
  Zap,
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
import { onAuthStateChanged, updateProfile } from '@/lib/cf-auth';
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
import { cloudflareApi } from '@/lib/cloudflare-api';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';

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
      // Ambil semua mata uang dari Firestore (semua user, deduplicated) - sama seperti halaman member
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

      // Gunakan exchangeRateService - sama persis dengan halaman member
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
  const [currentPassword, setCurrentPassword] = useState('');
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
      if (!currentPassword) {
        alert('Masukkan password saat ini untuk verifikasi.');
        return;
      }
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
        await cloudflareApi('/api/member/password', {
          method: 'PATCH',
          json: { currentPassword, newPassword },
        });

        await addAdminLog({
          adminEmail: userEmail,
          action: 'UPDATE_PASSWORD',
          target: 'admin_account',
          note: 'Memperbarui password akun admin',
          color: 'orange'
        });

        alert('Password berhasil diperbarui!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } catch (error: unknown) {
        console.error(error);
        const message = error instanceof Error ? error.message : 'Gagal memperbarui password.';
        alert(message);
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

  const tabs = [
    { id: 'billing', label: 'Pembayaran', icon: Database },
    { id: 'account', label: 'Akun Admin', icon: Lock },
    { id: 'member', label: 'Member', icon: Users },
    { id: 'maintenance', label: 'Maintenance', icon: Zap },
    { id: 'market', label: 'Market Data', icon: Globe },
  ];

  return (
    <div className="space-y-8 pb-16 max-w-[1400px] mx-auto">
      <AdminPageHeader
        title="Konfigurasi Sistem"
        description="Atur pembayaran, akun, member, maintenance, dan sumber data pasar."
      />

      {/* TAB SWITCHER */}
      <div className="flex overflow-x-auto no-scrollbar gap-2 p-1.5 bg-slate-50 border border-slate-100 rounded-2xl w-full max-w-full">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center justify-center shrink-0 gap-2 px-5 py-2.5 rounded-xl text-[12px] font-black transition-all whitespace-nowrap",
              activeTab === tab.id
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-100"
                : "text-slate-400 hover:text-slate-600"
            )}
          >
            <tab.icon size={14} className={activeTab === tab.id ? "text-indigo-600" : "text-slate-300"} />
            {tab.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-3 p-6 bg-indigo-50 border border-indigo-100 rounded-2xl">
          <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-[11px] font-black text-indigo-500 uppercase tracking-widest">Memuat konfigurasi...</p>
        </div>
      )}

      {activeTab === 'billing' && !loading && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm space-y-6">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Kontak & Rekening</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[12px] font-black text-slate-600">Email Kontak</label>
                <input
                  type="email"
                  value={settings?.billingEmail || ''}
                  onChange={(e) => setSettings(prev => ({ ...prev as AppSettings, billingEmail: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[14px] font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[12px] font-black text-slate-600">WhatsApp Kontak</label>
                <input
                  type="text"
                  placeholder="62812xxxx"
                  value={settings?.whatsapp || ''}
                  onChange={(e) => setSettings(prev => ({ ...prev as AppSettings, whatsapp: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[14px] font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[12px] font-black text-slate-600">Harga Pro / Bulan (IDR)</label>
                <input
                  type="number"
                  value={settings?.proPrice || 0}
                  onChange={(e) => setSettings(prev => ({ ...prev as AppSettings, proPrice: Number(e.target.value) }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[14px] font-bold text-indigo-600 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[12px] font-black text-slate-600">Nama Bank</label>
                <input
                  type="text"
                  value={settings?.bankName || ''}
                  onChange={(e) => setSettings(prev => ({ ...prev as AppSettings, bankName: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[14px] font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[12px] font-black text-slate-600">Atas Nama</label>
                <input
                  type="text"
                  value={settings?.bankAccountName || ''}
                  onChange={(e) => setSettings(prev => ({ ...prev as AppSettings, bankAccountName: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[14px] font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[12px] font-black text-slate-600">No Rekening</label>
                <input
                  type="text"
                  value={settings?.bankNumber || ''}
                  onChange={(e) => setSettings(prev => ({ ...prev as AppSettings, bankNumber: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[14px] font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm space-y-6">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Pembayaran QRIS</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="p-6 rounded-2xl bg-slate-50 flex flex-col items-center gap-4">
                {settings?.qrisURL ? (
                  <div className="relative w-40 h-40 rounded-xl overflow-hidden bg-white">
                    <Image src={settings.qrisURL} alt="QRIS Preview" fill className="object-contain" />
                  </div>
                ) : (
                  <div className="w-40 h-40 rounded-xl bg-white border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300">
                    <ImageIcon size={36} strokeWidth={1} />
                    <span className="text-[10px] font-black uppercase tracking-widest mt-2">Belum ada QRIS</span>
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
                      "w-full flex items-center justify-center gap-2 py-2.5 bg-slate-900 text-white rounded-xl text-[11px] font-black uppercase tracking-widest cursor-pointer hover:bg-indigo-600 transition-all",
                      isUploadingQRIS && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {isUploadingQRIS ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Mengunggah...
                      </>
                    ) : (
                      <>
                        <Upload size={13} />
                        Upload QRIS Baru
                      </>
                    )}
                  </label>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[12px] font-black text-slate-600">Label Teks QRIS</label>
                  <input
                    type="text"
                    placeholder="Contoh: Scan untuk Bayar"
                    value={settings?.qrisText || ''}
                    onChange={(e) => setSettings(prev => ({ ...prev as AppSettings, qrisText: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[14px] font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[12px] font-black text-slate-600">URL Langsung (Opsional)</label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={settings?.qrisURL || ''}
                    onChange={(e) => setSettings(prev => ({ ...prev as AppSettings, qrisURL: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[14px] font-medium opacity-60"
                  />
                  <p className="text-[11px] font-medium text-slate-400">Terisi otomatis saat gambar diunggah.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'member' && !loading && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                <Users size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Aturan Free Plan</h3>
                <p className="text-[11px] font-medium text-slate-400">Masa berlaku gratis untuk user baru.</p>
              </div>
            </div>
            <div className="max-w-xs space-y-2">
              <label className="text-[12px] font-black text-slate-600">Durasi Free Plan (Hari)</label>
              <div className="relative">
                <input
                  type="number"
                  value={settings?.freePlanDays || 0}
                  onChange={(e) => setSettings(prev => ({ ...prev as AppSettings, freePlanDays: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[14px] font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold pointer-events-none">Hari</span>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500 shrink-0">
                  <Database size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Daftar Paket Pro</h3>
                  <p className="text-[11px] font-medium text-slate-400">Opsi langganan bulanan maupun tahunan.</p>
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
                className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-colors shrink-0"
              >
                <Plus size={14} /> Tambah Paket
              </button>
            </div>

            <div className="space-y-3">
              {(settings?.proPackages?.length || 0) === 0 ? (
                <div className="p-8 rounded-2xl border-2 border-dashed border-slate-200 text-center space-y-2">
                  <Database size={20} className="mx-auto text-slate-300" />
                  <div>
                    <h5 className="font-bold text-slate-600 text-sm">Belum Ada Paket</h5>
                    <p className="text-xs text-slate-400">Tambahkan paket berlangganan, atau sistem memakai harga default.</p>
                  </div>
                </div>
              ) : (
                settings?.proPackages?.map((pkg, index) => (
                  <div key={pkg.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col xl:flex-row xl:items-end gap-4 relative">
                    <button
                      onClick={() => {
                        setSettings(prev => ({
                          ...prev as AppSettings,
                          proPackages: prev?.proPackages?.filter(p => p.id !== pkg.id)
                        }));
                      }}
                      className="absolute top-4 right-4 p-1.5 bg-white text-rose-500 rounded-lg shadow-sm border border-slate-100 hover:bg-rose-50 transition-all z-10"
                    >
                      <Trash2 size={14} />
                    </button>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 pr-10 xl:pr-0">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama Paket</label>
                        <input
                          type="text"
                          value={pkg.name}
                          onChange={(e) => {
                            const newArr = [...(settings.proPackages || [])];
                            newArr[index].name = e.target.value;
                            setSettings({ ...settings, proPackages: newArr });
                          }}
                          className="w-full px-4 py-2.5 bg-white border border-slate-100 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-100 outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Harga (IDR)</label>
                         <input
                           type="number"
                           value={pkg.price}
                           onChange={(e) => {
                             const newArr = [...(settings.proPackages || [])];
                             newArr[index].price = Number(e.target.value);
                             setSettings({ ...settings, proPackages: newArr });
                           }}
                           className="w-full px-4 py-2.5 bg-white border border-slate-100 rounded-lg text-sm font-bold text-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none"
                         />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Masa Berlaku (Bulan)</label>
                         <div className="flex gap-3 items-center">
                           <input
                             type="number"
                             value={pkg.durationMonths}
                             onChange={(e) => {
                               const newArr = [...(settings.proPackages || [])];
                               newArr[index].durationMonths = Number(e.target.value);
                               setSettings({ ...settings, proPackages: newArr });
                             }}
                             className="w-full px-4 py-2.5 bg-white border border-slate-100 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-100 outline-none"
                           />
                           <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
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
                             <span className="text-[10px] font-black uppercase text-amber-500 tracking-wider">Populer</span>
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
        <div className="animate-in fade-in duration-300 flex flex-col lg:flex-row gap-6">
          <div className="w-full lg:w-72 shrink-0">
            <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col items-center text-center space-y-4">
              <div className="relative">
                <div className="relative w-24 h-24 rounded-2xl bg-slate-100 border-4 border-white shadow-md flex items-center justify-center overflow-hidden">
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
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-md border-2 border-white">
                  <Settings size={14} />
                </div>
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
                    "w-full flex items-center justify-center gap-2 py-2.5 bg-slate-50 text-slate-500 border border-slate-100 rounded-xl text-[11px] font-black uppercase tracking-widest cursor-pointer hover:border-indigo-500 transition-all",
                    isUploadingProfile && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isUploadingProfile ? "Mengunggah..." : "Upload Foto Baru"}
                </label>
              </div>
            </div>
          </div>

          <div className="flex-1">
            <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm space-y-6">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Kredensial Admin</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[12px] font-black text-slate-600">Email Admin Utama</label>
                  <input type="email" defaultValue={userEmail} disabled className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[14px] font-medium text-slate-500" />
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-[12px] font-black text-slate-600">Password Saat Ini</label>
                    <input
                      type="password"
                      placeholder="Untuk verifikasi"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[14px] font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[12px] font-black text-slate-600">Password Baru</label>
                    <input
                      type="password"
                      placeholder="Min 6 karakter, Simbol, Angka"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[14px] font-medium"
                    />
                  </div>

                  {newPassword && (
                    <div className="space-y-1">
                      <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-500 ${passwordStrength.width} ${passwordStrength.color}`} />
                      </div>
                      <p className="text-[10px] font-bold text-slate-400">
                        Kekuatan: <span className="text-slate-900 uppercase">{passwordStrength.label}</span>
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[12px] font-black text-slate-600">Ulangi Password</label>
                    <input
                      type="password"
                      placeholder="Ulangi password baru"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[14px] font-medium"
                    />
                  </div>
                </div>
              </div>
              <button
                onClick={handleSaveAccount}
                disabled={isSavingAccount}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all",
                  isSavingAccount && "opacity-50 cursor-not-allowed"
                )}
              >
                {isSavingAccount ? (
                  "Memperbarui..."
                ) : (
                  <>
                    <Save size={14} /> Perbarui Password
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'maintenance' && !loading && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-between gap-6">
            <div>
              <h3 className="text-sm font-black text-slate-900">Status Maintenance</h3>
              <p className="text-[12px] font-medium text-slate-400">Alihkan seluruh akses member ke layar pemeliharaan.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={settings?.maintenance?.isActive || false}
                onChange={(e) => setSettings(prev => ({
                  ...prev as AppSettings,
                  maintenance: { ...(prev as AppSettings).maintenance!, isActive: e.target.checked }
                }))}
              />
              <div className="w-14 h-7 bg-slate-200 rounded-full peer peer-checked:after:translate-x-7 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-600 transition-all" />
            </label>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-5 p-6 rounded-2xl bg-white border border-slate-100 shadow-sm">
              <div>
                <h4 className="text-sm font-black text-slate-900">Konfigurasi Konten</h4>
                <p className="text-[11px] font-medium text-slate-400">Cara maintenance ditampilkan ke user.</p>
              </div>

              <div className="flex p-1 bg-slate-50 rounded-xl gap-1">
                <button
                  onClick={() => setSettings(prev => ({ ...prev as AppSettings, maintenance: { ...(prev as AppSettings).maintenance!, type: 'code' } }))}
                  className={cn(
                    "flex-1 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all",
                    settings?.maintenance?.type === 'code' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Kode HTML
                </button>
                <button
                  onClick={() => setSettings(prev => ({ ...prev as AppSettings, maintenance: { ...(prev as AppSettings).maintenance!, type: 'image' } }))}
                  className={cn(
                    "flex-1 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all",
                    settings?.maintenance?.type === 'image' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Gambar
                </button>
              </div>

              {settings?.maintenance?.type === 'code' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Kode HTML</label>
                    <button
                      onClick={() => setShowPreviewModal(true)}
                      className="text-[10px] font-black text-indigo-600 hover:underline flex items-center gap-1"
                    >
                      Preview <ArrowRight size={12} />
                    </button>
                  </div>
                  <textarea
                    className="w-full p-4 bg-slate-900 text-indigo-300 font-mono text-[12px] rounded-xl min-h-[240px] outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
                    placeholder="Masukkan kode HTML/CSS kustom Anda di sini..."
                    value={settings?.maintenance?.code || ''}
                    onChange={(e) => setSettings(prev => ({
                      ...prev as AppSettings,
                      maintenance: { ...(prev as AppSettings).maintenance!, code: e.target.value }
                    }))}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <label className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Gambar Maintenance</label>

                  <div className="aspect-video w-full rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center overflow-hidden relative group">
                    {settings?.maintenance?.imageUrl ? (
                      <>
                        <Image src={settings.maintenance.imageUrl} alt="Maintenance" fill className="object-cover" />
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            onClick={() => setShowPreviewModal(true)}
                            className="px-5 py-2 bg-white text-slate-900 rounded-full text-[10px] font-black uppercase tracking-widest"
                          >
                            Zoom Preview
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-slate-300">
                        <ImageIcon size={36} strokeWidth={1} />
                        <p className="text-[10px] font-black uppercase tracking-widest">Belum ada gambar</p>
                      </div>
                    )}
                  </div>

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
                      "w-full flex items-center justify-center gap-2 py-2.5 bg-slate-900 text-white rounded-xl text-[11px] font-black uppercase tracking-widest cursor-pointer hover:bg-slate-800 transition-all",
                      isUploadingMaintenanceImage && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {isUploadingMaintenanceImage ? "Mengunggah..." : "Upload Gambar Maintenance"}
                  </label>
                </div>
              )}
            </div>

            <div className="space-y-6 flex flex-col justify-between">
              <div className="p-6 rounded-2xl bg-indigo-600 text-white space-y-3">
                <h5 className="text-base font-black">Kapan pakai mode apa?</h5>
                <p className="text-[13px] font-medium text-indigo-100 leading-relaxed">
                  Pakai <strong>Kode HTML</strong> jika punya desain kustom berbasis kode, atau <strong>Gambar</strong> jika sudah punya banner maintenance jadi dari desainer.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-4">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pesan Fallback</p>
                  <p className="text-xs font-bold text-slate-500 italic mt-1">&quot;Kami kembali sebentar lagi. Leosiqra sedang dalam pemeliharaan sistem.&quot;</p>
                </div>
                <button
                  onClick={handleSaveSettings}
                  className="w-full py-3.5 bg-indigo-600 text-white rounded-xl text-[13px] font-black hover:bg-slate-900 transition-all"
                >
                  Simpan & Aktifkan Perubahan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col animate-in fade-in duration-300">
          <div className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-white text-[11px] font-black uppercase tracking-widest">Live Maintenance Preview</span>
            </div>
            <button
              onClick={() => setShowPreviewModal(false)}
              className="p-2 text-white/60 hover:text-white transition-colors"
            >
              <X size={20} />
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
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Market Control Center</h3>
              <p className="text-[12px] font-medium text-slate-400 mt-1">Pantau hasil sinkron data pasar dan refresh manual bila perlu.</p>
            </div>
            <button
              onClick={fetchMarketData}
              disabled={isRefreshingMarket}
              className={cn(
                "px-5 py-2.5 border border-slate-200 rounded-xl text-[11px] font-black text-slate-900 uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2 shrink-0",
                isRefreshingMarket && "opacity-50 cursor-not-allowed"
              )}
            >
              <RefreshCw size={14} className={cn(isRefreshingMarket && "animate-spin")} />
              {isRefreshingMarket ? "Refreshing..." : "Refresh Semua"}
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <AdminStatCardLocal label="User Ter-cover" value={settings?.marketData?.userCovered || 0} />
            <AdminStatCardLocal label="FX Ter-update" value={settings?.marketData?.fxUpdate || 0} />
            <AdminStatCardLocal label="Crypto Ter-update" value={settings?.marketData?.cryptoUpdate || 0} />
            <AdminStatCardLocal label="Update Terakhir" value={settings?.marketData?.lastUpdate || '-'} small />
          </div>

          {/* FX Table */}
          <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm space-y-4">
            <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-widest">Kurs Mata Uang</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pair</th>
                    <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Rate</th>
                    <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">User</th>
                    <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Diperbarui</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(() => {
                    const idrRate = liveFxRates.IDR || 0;
                    const fxCurrencies = allCurrencies.filter(c => c.code !== 'IDR');
                    if (fxCurrencies.length === 0) {
                      return (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-[11px] text-slate-400 italic">
                            Klik &quot;Refresh Semua&quot; untuk memuat data kurs.
                          </td>
                        </tr>
                      );
                    }
                    return fxCurrencies.map((c, idx) => {
                      const rate = liveFxRates[c.code] ? (idrRate / liveFxRates[c.code]) : null;
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3">
                            <p className="text-[12px] font-black text-slate-700">{c.code}/IDR</p>
                            <p className="text-[10px] font-medium text-slate-400">{c.name}</p>
                          </td>
                          <td className="py-3 text-[12px] font-bold text-slate-900">
                            {rate ? `Rp ${rate.toLocaleString('id-ID', { maximumFractionDigits: 0 })}` : <span className="text-slate-300 italic">-</span>}
                          </td>
                          <td className="py-3 text-[12px] font-medium text-slate-400">{settings?.marketData?.userCovered || 0}</td>
                          <td className="py-3 text-[11px] font-medium text-slate-400">{liveTimestamp}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          {/* Crypto Feed */}
          <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm space-y-4">
            <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-widest">Crypto Feed</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Crypto</th>
                    <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Harga (IDR)</th>
                    <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">24 Jam</th>
                    <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Diperbarui</th>
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
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3">
                            <p className="text-[12px] font-black text-slate-900">{p.asset}</p>
                            <p className="text-[10px] font-medium text-slate-400">{p.name}</p>
                          </td>
                          <td className="py-3">
                            {priceIDR ? (
                              <>
                                <p className="text-[12px] font-bold text-slate-900">Rp {priceIDR.toLocaleString('id-ID')}</p>
                                <p className="text-[10px] font-medium text-slate-400">${priceUSD?.toLocaleString('en-US')}</p>
                              </>
                            ) : <span className="text-[12px] text-slate-300 italic">Belum direfresh</span>}
                          </td>
                          <td className={`py-3 text-[12px] font-bold ${change == null ? 'text-slate-400' : change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {change != null ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%` : `-`}
                          </td>
                          <td className="py-3 text-[11px] font-medium text-slate-400">{liveTimestamp}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {(activeTab === 'billing' || activeTab === 'member') && (
        <div className="flex justify-end">
          <button
            onClick={handleSaveSettings}
            className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-[12px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all"
          >
            <Save size={16} />
            Simpan Konfigurasi
          </button>
        </div>
      )}
    </div>
  );
}

function AdminStatCardLocal({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm space-y-2">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className={cn("font-black text-slate-900 tracking-tight", small ? "text-sm" : "text-2xl")}>{value}</p>
    </div>
  );
}
