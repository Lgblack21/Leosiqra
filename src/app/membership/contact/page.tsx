"use client";

import { 
  Check, 
  Copy, 
  Mail, 
  Phone, 
  ArrowRight, 
  ChevronDown,
  CreditCard,
  QrCode,
  ShieldCheck,
  Upload,
  X,
  ImageIcon
} from 'lucide-react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { subscribeAppSettings, AppSettings, ProPackage } from '@/lib/services/adminService';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { auth, db } from '@/lib/cf-client';
import { collection, addDoc, serverTimestamp } from '@/lib/cf-firestore';
import { onAuthStateChanged } from '@/lib/cf-auth';
import { cn } from '@/lib/utils';

export default function ContactPage() {
  const [copied, setCopied] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: '',
    email: '',
    method: 'Bank Transfer',
    ref: '',
    package: '1 Bulan - Pro Solo',
    amount: '',
    note: ''
  });

  const activePackages = useMemo(() => {
    return settings?.proPackages || [];
  }, [settings?.proPackages]);

  useEffect(() => {
    const unsub = subscribeAppSettings((data) => {
      setSettings(data);
      setLoading(false);
    });
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setForm(prev => ({ ...prev, email: user.email || '', name: user.displayName || '' }));
      }
    });
    return () => { unsub(); unsubAuth(); };
  }, []);

  useEffect(() => {
    if (activePackages.length > 0 && !activePackages.find(p => p.id === form.package)) {
      setForm(prev => ({ ...prev, package: activePackages[0].id }));
    }
  }, [activePackages, form.package]);

  // Sync amount saat paket berubah
  useEffect(() => {
    const pkg = activePackages.find(p => p.id === form.package);
    if (pkg) {
      setForm(prev => ({ ...prev, amount: pkg.price.toString() }));
    }
  }, [form.package, activePackages]);

  const copyToClipboard = () => {
    if (settings?.bankNumber) {
      navigator.clipboard.writeText(settings.bankNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setProofPreview(preview);
    setUploadingProof(true);
    try {
      const url = await uploadToCloudinary(file);
      setProofUrl(url);
    } catch {
      alert('Gagal mengupload gambar. Coba lagi.');
      setProofPreview(null);
    } finally {
      setUploadingProof(false);
    }
  };

  const resetForm = () => {
    setForm(prev => ({
      ...prev,
      method: 'Bank Transfer',
      ref: '',
      package: activePackages.length > 0 ? activePackages[0].id : '',
      amount: activePackages.length > 0 ? activePackages[0].price.toString() : '0',
      note: ''
    }));
    setProofPreview(null);
    setProofUrl(null);
    setSubmitted(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.ref) {
      alert('Lengkapi Nama, Email, dan ID Referensi terlebih dahulu.');
      return;
    }
    setSubmitting(true);
    try {
      const user = auth.currentUser;
      await addDoc(collection(db, 'payments'), {
        userId: user?.uid || null,
        userEmail: form.email,
        userName: form.name,
        userPhotoURL: user?.photoURL || null,
        method: form.method,
        ref: form.ref,
        package: { 
          id: form.package,
          name: activePackages.find(p => p.id === form.package)?.name || 'Custom Package',
          durationMonths: activePackages.find(p => p.id === form.package)?.durationMonths || 1
        },
        amount: parseInt(form.amount.replace(/\D/g, '')) || 0,
        note: form.note,
        proofImageUrl: proofUrl || null,
        status: 'MENUNGGU',
        createdAt: serverTimestamp()
      });
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      alert('Gagal mengirim konfirmasi. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 max-w-[1200px] mb-12">
      
      {/* 1. Header Section */}
      <div className="max-w-2xl">
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Konfirmasi Pembayaran Pro</h1>
        <p className="text-sm font-medium text-slate-500 mt-2 leading-relaxed">
          Selesaikan transaksi Anda untuk membuka fitur eksklusif dan layanan prioritas di platform kami.
        </p>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Memuat instruksi pembayaran...</p>
        </div>
      ) : submitted ? (
        <div className="py-20 flex flex-col items-center justify-center gap-8 text-center animate-in zoom-in duration-500">
          <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center shadow-2xl shadow-emerald-200/50 relative">
            <Check size={48} className="text-emerald-600 relative z-10" />
            <div className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" />
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Konfirmasi Terkirim!</h2>
            <p className="text-[13px] font-bold text-slate-500 max-w-xs mx-auto leading-relaxed">Tim kami akan memverifikasi pembayaran Anda dalam maksimal 1x24 jam. Cek email atau WhatsApp Anda secara berkala.</p>
          </div>
          <button 
            onClick={resetForm}
            className="px-12 py-5 bg-slate-900 text-white text-[13px] font-black rounded-2xl hover:bg-slate-800 hover:-translate-y-1 transition-all shadow-2xl shadow-slate-300"
          >
            Oke, Mengerti
          </button>
        </div>
      ) : (
        <>
          {/* 2. Steps Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: 1, title: 'Bayar sesuai paket', desc: 'Transfer dana sesuai dengan nominal paket Pro yang Anda pilih.', active: true },
              { step: 2, title: 'Isi referensi pembayaran', desc: 'Lengkapi formulir konfirmasi dengan detail bukti transaksi Anda.', active: false },
              { step: 3, title: 'Tunggu aktivasi admin', desc: 'Tim kami akan memverifikasi dalam waktu maksimal 1x24 jam.', active: false },
            ].map((item, i) => (
              <div key={i} className="bg-white p-6 md:p-8 rounded-[20px] md:rounded-[32px] border border-slate-50 shadow-sm text-center space-y-4">
                <div className={`w-10 h-10 rounded-full mx-auto flex items-center justify-center text-sm font-black ${item.active ? 'bg-indigo-600 text-white' : 'bg-slate-500 text-white opacity-60'}`}>
                  {item.step}
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-slate-900 tracking-tight">{item.title}</h3>
                  <p className="text-[10px] font-bold text-slate-400 leading-relaxed px-4">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* 3. Main Detail Section */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            
            {/* LEFT COLUMN: Informasi Pembayaran */}
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-[#f0f5fa] p-6 md:p-8 rounded-[20px] md:rounded-[40px] border border-white shadow-sm space-y-8 relative overflow-hidden">
                <div className="absolute top-8 right-8 text-slate-200">
                  <CreditCard size={48} />
                </div>

                <div>
                  <h2 className="text-lg font-black text-indigo-600 tracking-tight mb-6">Informasi Pembayaran</h2>
                  
                  <div className="space-y-6">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Pembayaran</p>
                      <p className="text-3xl font-black text-indigo-600 tracking-tight">Rp {parseInt(form.amount.replace(/\D/g, '') || '0').toLocaleString('id-ID')}</p>
                      <p className="text-[11px] font-bold text-slate-500 mt-1">{activePackages.find(p => p.id === form.package)?.name || 'Silakan pilih paket Anda'}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Bank Tujuan</p>
                        <p className="text-[13px] font-black text-slate-900 tracking-tight">{settings?.bankName || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nama Rekening</p>
                        <p className="text-[13px] font-black text-slate-900 tracking-tight leading-snug">{settings?.bankAccountName || '-'}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nomor Rekening</p>
                      <div className="flex items-center gap-3">
                        <p className="text-lg font-black text-indigo-600 tracking-tight">{settings?.bankNumber || '-'}</p>
                        {settings?.bankNumber && (
                          <button 
                            onClick={copyToClipboard}
                            className="text-slate-400 hover:text-indigo-600 transition-colors"
                          >
                            {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-200">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{settings?.qrisText || 'Pembayaran QRIS'}</p>
                      <div className="w-48 h-48 flex items-center justify-center overflow-hidden">
                        {settings?.qrisURL ? (
                          <img src={settings.qrisURL} alt="QRIS" className="w-full h-full object-contain" />
                        ) : (
                          <div className="w-full h-full bg-slate-50 rounded-3xl flex items-center justify-center border-2 border-dashed border-slate-200">
                            <QrCode size={80} className="text-slate-300" />
                          </div>
                        )}
                      </div>
                      <p className="text-[9px] font-bold text-slate-400 italic">Scan QRIS di atas melalui aplikasi bank atau e-wallet Anda.</p>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-slate-200 space-y-3">
                  <div className="flex items-center gap-3 text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer">
                    <Mail size={16} />
                    <span className="text-[11px] font-bold">{settings?.billingEmail || 'billing@service.com'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer">
                    <Phone size={16} />
                    <span className="text-[11px] font-bold">+{settings?.whatsapp || '62'} (WhatsApp)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Form Card */}
            <div className="lg:col-span-3">
              <form onSubmit={handleSubmit} className="bg-white p-6 md:p-10 rounded-[20px] md:rounded-[40px] border border-slate-50 shadow-sm space-y-10">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Kirim Konfirmasi Pembayaran</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nama Lengkap</label>
                    <input 
                      type="text" 
                      placeholder="Sesuai bukti transfer"
                      value={form.name}
                      onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-indigo-100 rounded-xl py-4 px-6 text-sm font-bold text-slate-600 placeholder:text-slate-300 transition-all"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Alamat Email</label>
                    <input 
                      type="email" 
                      placeholder="user@example.com"
                      value={form.email}
                      onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                      className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-indigo-100 rounded-xl py-4 px-6 text-sm font-bold text-slate-600 placeholder:text-slate-300 transition-all"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Metode Bayar</label>
                    <div className="relative">
                      <select 
                        value={form.method}
                        onChange={e => setForm(p => ({ ...p, method: e.target.value }))}
                        className="w-full appearance-none bg-slate-50 border-none focus:ring-2 focus:ring-indigo-100 rounded-xl py-4 px-6 text-sm font-bold text-slate-600 transition-all cursor-pointer"
                      >
                        <option>Bank Transfer</option>
                        <option>QRIS / E-Wallet</option>
                      </select>
                      <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">ID Ref Pembayaran</label>
                    <input 
                      type="text" 
                      placeholder="Contoh: REF-98210"
                      value={form.ref}
                      onChange={e => setForm(p => ({ ...p, ref: e.target.value }))}
                      className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-indigo-100 rounded-xl py-4 px-6 text-sm font-bold text-slate-600 placeholder:text-slate-300 transition-all"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Paket Pro</label>
                    <div className="relative">
                      <select 
                        value={form.package}
                        onChange={e => setForm(p => ({ ...p, package: e.target.value }))}
                        disabled={activePackages.length === 0}
                        className={cn(
                          "w-full appearance-none bg-slate-50 border-none focus:ring-2 focus:ring-indigo-100 rounded-xl py-4 px-6 text-sm font-bold text-slate-600 transition-all cursor-pointer",
                          activePackages.length === 0 && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        {activePackages.length === 0 ? (
                          <option value="">Belum ada paket tersedia</option>
                        ) : (
                          activePackages.map(pkg => (
                            <option key={pkg.id} value={pkg.id}>
                              {pkg.name} {pkg.isPopular ? '(⭐ Populer)' : ''}
                            </option>
                          ))
                        )}
                      </select>
                      <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Total Dibayar (IDR)</label>
                    <input 
                      type="text" 
                      placeholder="149000"
                      value={form.amount}
                      onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                      className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-indigo-100 rounded-xl py-4 px-6 text-sm font-bold text-slate-600 placeholder:text-slate-300 transition-all"
                    />
                  </div>

                  {/* UPLOAD BUKTI PEMBAYARAN */}
                  <div className="md:col-span-2 space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Bukti Pembayaran</label>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={handleProofUpload}
                    />
                    {proofPreview ? (
                      <div className="relative w-full rounded-2xl overflow-hidden border-2 border-indigo-100">
                        <img src={proofPreview} alt="Bukti Pembayaran" className="w-full max-h-64 object-contain bg-slate-50" />
                        {uploadingProof && (
                          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                        {!uploadingProof && proofUrl && (
                          <div className="absolute top-3 right-3 px-3 py-1 bg-emerald-500 text-white text-[10px] font-black rounded-full">
                            ✓ Terupload
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => { setProofPreview(null); setProofUrl(null); }}
                          className="absolute top-3 left-3 p-1 bg-white/80 rounded-full text-slate-600 hover:text-red-500"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-8 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center gap-3 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                          <ImageIcon size={22} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                        </div>
                        <div className="text-center">
                          <p className="text-[11px] font-black text-slate-600 group-hover:text-indigo-600">Klik untuk upload bukti transfer</p>
                          <p className="text-[9px] font-bold text-slate-400 mt-1">JPG, PNG, WEBP — Maks 5MB</p>
                        </div>
                      </button>
                    )}
                  </div>

                  <div className="md:col-span-2 space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Catatan Tambahan</label>
                    <textarea 
                      rows={4}
                      placeholder="Informasi tambahan jika diperlukan..."
                      value={form.note}
                      onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
                      className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-indigo-100 rounded-2xl py-5 px-6 text-sm font-bold text-slate-600 placeholder:text-slate-300 transition-all resize-none"
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <button 
                    type="submit"
                    disabled={submitting || uploadingProof}
                    className={cn(
                      "w-full bg-[#3b82f6] flex items-center justify-center gap-3 py-5 rounded-2xl text-[13px] font-black text-white hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 group",
                      (submitting || uploadingProof) && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    {submitting ? 'Mengirim...' : 'Kirim Konfirmasi Aktivasi Pro'}
                    {!submitting && <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />}
                  </button>
                  <p className="text-[10px] font-bold text-slate-400 text-center px-4">
                    Dengan mengklik tombol di atas, Anda menyetujui Syarat & Ketentuan kami.
                  </p>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

