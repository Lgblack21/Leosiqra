"use client";

import { useMemo, useState, useEffect, useRef } from 'react';
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
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { auth, db } from '@/lib/cf-client';
import { onAuthStateChanged, User as FirebaseUser } from '@/lib/cf-auth';
import { doc, setDoc } from '@/lib/cf-firestore';
import { accountService, Account } from '@/lib/services/accountService';
import { transactionService, Transaction } from '@/lib/services/transactionService';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { subscribeUserProfile } from '@/lib/services/userService';

interface UserProfile {
  displayName: string;
  email: string;
  username: string;
  phone: string;
  address: string;
  photoURL?: string;
  plan?: string;
}

export default function ProfilePage() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [profile, setProfile] = useState<UserProfile>({
    displayName: '', email: '', username: '', phone: '', address: '', photoURL: ''
  });
  const [uploading, setUploading] = useState(false);

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
              address?: string;
            };
            setProfile({
              displayName: data.name || u.displayName || '',
              email: data.email || u.email || '',
              username: profileExtras.username || '',
              phone: profileExtras.phone || '',
              address: profileExtras.address || '',
              photoURL: data.photoURL || u.photoURL || '',
              plan: data.plan
            });
          }
        });

        // Load akun dan transaksi
        Promise.all([
          accountService.getUserAccounts(u.uid),
          transactionService.getUserTransactions(u.uid)
        ]).then(([accs, trxs]) => {
          setAccounts(accs);
          setTransactions(trxs);
        }).catch(console.error)
          .finally(() => setLoading(false));
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
    try {
      await setDoc(doc(db, 'users', user.uid), {
        ...profile,
        updatedAt: new Date()
      }, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const totalBalance = useMemo(() => accounts.reduce((s, a) => s + a.balance, 0), [accounts]);
  const todayOut = useMemo(() => {
    const today = new Date().toDateString();
    return transactions.filter(t => t.type === 'pengeluaran' && t.date.toDateString() === today).reduce((s, t) => s + t.amount, 0);
  }, [transactions]);

  const formatRp = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
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
              ) : accounts.map((acc) => (
                <div key={acc.id} className="flex items-center justify-between p-4 md:p-5 bg-white/60 backdrop-blur-sm rounded-[24px] md:rounded-[28px] border border-white shadow-sm hover:scale-[1.02] transition-transform cursor-pointer">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl md:rounded-2xl flex-shrink-0 bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-100">
                      {acc.type === 'E-Wallet' ? <Wallet size={16} /> : <Building2 size={16} />}
                    </div>
                    <div>
                      <h4 className="text-[12px] md:text-[13px] font-black text-slate-900 leading-tight">{acc.name}</h4>
                      <p className="text-[9px] md:text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tight">{acc.type}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[12px] md:text-[13px] font-black text-slate-900">{formatRp(acc.balance)}</p>
                    <ArrowRight size={12} className="text-slate-300 float-right mt-1" />
                  </div>
                </div>
              ))}
            </div>
          </div>
 
          {/* Security */}
          <div className="bg-slate-900 p-5 md:p-8 rounded-[20px] md:rounded-[48px] shadow-2xl space-y-6 md:space-y-10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 text-white/5 group-hover:text-white/10 transition-colors hidden md:block">
              <ShieldCheck size={120} />
            </div>
            <h2 className="text-lg md:text-xl font-black text-white tracking-tight relative z-10">Security Center</h2>
            <div className="space-y-4 md:space-y-6 relative z-10">
              <button className="w-full flex items-center justify-between p-4 md:p-5 bg-white/10 hover:bg-white/20 rounded-xl md:rounded-2xl transition-all border border-white/5 backdrop-blur-md">
                <div className="flex items-center gap-3 md:gap-4 text-white">
                  <Lock size={16} className="text-indigo-400" />
                  <span className="text-[11px] md:text-[12px] font-black tracking-tight">Change Password</span>
                </div>
                <ChevronRight size={14} className="text-white/40" />
              </button>
              <button className="w-full flex items-center justify-between p-4 md:p-5 bg-white/10 hover:bg-white/20 rounded-xl md:rounded-2xl transition-all border border-white/5 backdrop-blur-md">
                <div className="flex items-center gap-3 md:gap-4 text-white">
                  <Bell size={16} className="text-indigo-400" />
                  <span className="text-[11px] md:text-[12px] font-black tracking-tight">Notification Preferences</span>
                </div>
                <ChevronRight size={14} className="text-white/40" />
              </button>
              <div className="pt-6 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] md:text-[10px] font-black text-white opacity-40 uppercase tracking-widest">Two Factor Auth</p>
                  <div className="w-10 h-5 md:w-12 md:h-6 bg-indigo-600 rounded-full relative p-1 cursor-pointer">
                    <div className="w-3 h-3 md:w-4 md:h-4 bg-white rounded-full absolute right-1" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

