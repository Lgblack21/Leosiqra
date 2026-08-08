"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  User as UserIcon,
  Coins,
  Tags,
  Building2,
  Wallet,
  Banknote,
  Loader2,
} from 'lucide-react';
import { auth } from '@/lib/cf-client';
import { onAuthStateChanged } from '@/lib/cf-auth';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { currencyService } from '@/lib/services/currencyService';
import { categoryService } from '@/lib/services/categoryService';
import { accountService } from '@/lib/services/accountService';
import { matchIndonesianInstitutionLogo } from '@/lib/indonesianBanks';
import { LogoImage } from '@/components/ui/LogoImage';
import { START_TOUR_EVENT } from '@/components/onboarding/OnboardingTour';
import { cn } from '@/lib/utils';

// —— Data pilihan ————————————————————————————————————————————————

interface CurrencyOption { code: string; name: string; symbol: string; }
const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: 'IDR', name: 'Rupiah Indonesia', symbol: 'Rp' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'KHR', name: 'Cambodian Riel', symbol: '៛' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿' },
  { code: 'KRW', name: 'Korean Won', symbol: '₩' },
];

interface CategoryGroup { category: string; subs: string[]; }
const DEFAULT_CATEGORY_GROUPS: CategoryGroup[] = [
  { category: 'Makanan & Minuman', subs: ['Makan', 'Jajan & Kopi', 'Belanja Dapur'] },
  { category: 'Transportasi', subs: ['Bensin', 'Parkir & Tol', 'Transportasi Online'] },
  { category: 'Tagihan & Utilitas', subs: ['Listrik', 'Air', 'Internet & Pulsa'] },
  { category: 'Belanja', subs: ['Pakaian', 'Elektronik', 'Rumah Tangga'] },
  { category: 'Hiburan', subs: ['Langganan', 'Nonton & Musik', 'Jalan-jalan'] },
  { category: 'Kesehatan', subs: ['Obat', 'Dokter', 'Olahraga'] },
  { category: 'Pemasukan', subs: ['Gaji', 'Bonus', 'Pendapatan Lain'] },
];

interface BankOption { name: string; type: 'Bank Account' | 'E-Wallet' | 'Cash'; }
const BANK_OPTIONS: BankOption[] = [
  { name: 'BCA', type: 'Bank Account' },
  { name: 'Bank Mandiri', type: 'Bank Account' },
  { name: 'BRI', type: 'Bank Account' },
  { name: 'BNI', type: 'Bank Account' },
  { name: 'CIMB Niaga', type: 'Bank Account' },
  { name: 'Bank Jago', type: 'Bank Account' },
  { name: 'SeaBank', type: 'Bank Account' },
  { name: 'GoPay', type: 'E-Wallet' },
  { name: 'OVO', type: 'E-Wallet' },
  { name: 'DANA', type: 'E-Wallet' },
  { name: 'ShopeePay', type: 'E-Wallet' },
  { name: 'Uang Tunai', type: 'Cash' },
];

const TOTAL_STEPS = 5; // 0 Welcome, 1 Profil, 2 Mata Uang, 3 Kategori, 4 Rekening

export default function OnboardingPage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Step 1 — Profil
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  // Step 2 — Mata Uang
  const [currency, setCurrency] = useState('IDR');

  // Step 3 — Kategori (set nama kategori yang dipilih)
  const [selectedGroups, setSelectedGroups] = useState<string[]>(
    DEFAULT_CATEGORY_GROUPS.map((g) => g.category)
  );

  // Step 4 — Rekening (opsional)
  const [bankName, setBankName] = useState('');
  const [bankType, setBankType] = useState<'Bank Account' | 'E-Wallet' | 'Cash'>('Bank Account');
  const [bankBalance, setBankBalance] = useState('');

  // Ambil uid + prefill nama/WA dari profil.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    cloudflareApi<{ item?: { name?: string; whatsapp?: string } }>('/api/member/profile')
      .then((res) => {
        if (res.item?.name) setName(res.item.name);
        if (res.item?.whatsapp) setWhatsapp(res.item.whatsapp);
      })
      .catch(() => {});
    return () => unsub();
  }, []);

  const currencyMeta = useMemo(
    () => CURRENCY_OPTIONS.find((c) => c.code === currency) ?? CURRENCY_OPTIONS[0],
    [currency]
  );
  const bankLogo = useMemo(
    () => (bankType === 'Cash' ? '' : matchIndonesianInstitutionLogo(bankName, bankType) ?? ''),
    [bankName, bankType]
  );

  const toggleGroup = (category: string) =>
    setSelectedGroups((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );

  const canNext = () => {
    if (step === 1) return name.trim().length >= 2;
    if (step === 2) return !!currency;
    return true;
  };

  const next = () => {
    setError('');
    if (step < TOTAL_STEPS - 1) setStep((s) => s + 1);
  };
  const back = () => {
    setError('');
    if (step > 0) setStep((s) => s - 1);
  };

  // Simpan semua ke server sekaligus di akhir, lalu mulai tur keliling halaman.
  const finish = async (withBank: boolean) => {
    if (!uid) {
      setError('Sesi belum siap, coba sesaat lagi.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      // 1) Mata uang: pastikan mata uang utama tersimpan sebagai default, dan
      //    IDR selalu ada (dipakai sebagai basis konversi kurs di seluruh app).
      await currencyService.addCurrency({
        userId: uid,
        code: currencyMeta.code,
        name: currencyMeta.name,
        symbol: currencyMeta.symbol,
        isDefault: true,
      });
      if (currencyMeta.code !== 'IDR') {
        await currencyService.addCurrency({
          userId: uid,
          code: 'IDR',
          name: 'Rupiah Indonesia',
          symbol: 'Rp',
          isDefault: false,
        });
      }

      // 2) Kategori: buat tiap sub-kategori dari grup yang dipilih.
      const groups = DEFAULT_CATEGORY_GROUPS.filter((g) => selectedGroups.includes(g.category));
      for (const g of groups) {
        for (const sub of g.subs) {
          await categoryService.createCategory({
            userId: uid,
            category: g.category,
            subCategory: sub,
            status: 'VERIFIED',
          });
        }
      }

      // 3) Rekening (opsional).
      const balanceNum = Number(bankBalance) || 0;
      if (withBank && bankName.trim()) {
        await accountService.createAccount({
          userId: uid,
          name: bankName.trim(),
          type: bankType,
          currency: currencyMeta.code,
          balance: balanceNum,
          initialBalance: balanceNum,
          logoUrl: bankLogo || undefined,
          logoLabel: bankName.trim(),
        });
      }

      // 4) Profil + tandai onboarding selesai (currency_initialized = 1).
      await cloudflareApi('/api/member/profile', {
        method: 'PATCH',
        json: {
          name: name.trim(),
          ...(whatsapp.trim() ? { whatsapp: whatsapp.trim() } : {}),
          currencyInitialized: 1,
        },
      });

      // 5) Nyalakan tur keliling halaman, lalu masuk ke dashboard.
      window.dispatchEvent(new Event(START_TOUR_EVENT));
      router.push('/membership/dashboard');
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Gagal menyimpan setup. Coba lagi ya.');
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full bg-slate-50 border border-slate-100 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 rounded-2xl py-3.5 px-4 text-[15px] font-bold text-slate-800 placeholder:text-slate-300 outline-none transition-all';

  return (
    <div className="fixed inset-0 z-[60] bg-gradient-to-b from-white to-indigo-50/40 overflow-y-auto">
      <div className="min-h-full flex flex-col max-w-lg mx-auto px-5 py-8 sm:py-12">
        {/* Header logo + progress */}
        <div className="flex items-center gap-2.5 mb-7">
          <Image src="/images/Logo-new.png" alt="Leosiqra" width={28} height={28} />
          <span className="font-serif font-black text-lg tracking-tight text-slate-900">Leosiqra</span>
        </div>

        {step > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">
                Setup Akun · {step}/{TOTAL_STEPS - 1}
              </p>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                style={{ width: `${(step / (TOTAL_STEPS - 1)) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex-1">
          {/* ————— STEP 0: Welcome ————— */}
          {step === 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 text-center pt-6">
              <div className="w-20 h-20 rounded-[28px] bg-indigo-600 text-white flex items-center justify-center mx-auto mb-7 shadow-xl shadow-indigo-600/25">
                <Sparkles size={34} />
              </div>
              <h1 className="text-[26px] leading-tight font-serif font-black text-slate-900 mb-3">
                Selamat datang di Leosiqra!
              </h1>
              <p className="text-[15px] font-medium text-slate-500 leading-relaxed max-w-sm mx-auto">
                Yuk siapkan akunmu dulu — cuma 4 langkah singkat. Setelah itu kami antar keliling
                semua fitur biar kamu nggak bingung. Santai, kurang dari 2 menit.
              </p>
            </div>
          )}

          {/* ————— STEP 1: Profil ————— */}
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-400">
              <StepHead icon={UserIcon} title="Kenalan dulu" subtitle="Nama ini yang akan tampil di aplikasi dan sapaan kami." />
              <div className="space-y-5">
                <div>
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 pl-1">
                    Nama Lengkap <span className="text-rose-400">*</span>
                  </label>
                  <input
                    className={inputClass}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="mis. Leo Wendry"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 pl-1">
                    Nomor WhatsApp <span className="text-slate-300 normal-case tracking-normal font-bold">(opsional)</span>
                  </label>
                  <input
                    className={inputClass}
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="08xxxxxxxxxx"
                    inputMode="tel"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ————— STEP 2: Mata Uang ————— */}
          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-400">
              <StepHead icon={Coins} title="Mata uang utama" subtitle="Mata uang default untuk mencatat keuanganmu. Bisa tambah mata uang lain nanti." />
              <div className="grid grid-cols-2 gap-3">
                {CURRENCY_OPTIONS.map((c) => {
                  const activeSel = currency === c.code;
                  return (
                    <button
                      key={c.code}
                      onClick={() => setCurrency(c.code)}
                      className={cn(
                        'relative flex items-center gap-3 p-4 rounded-2xl border text-left transition-all active:scale-[0.98]',
                        activeSel
                          ? 'border-indigo-500 bg-indigo-50/70 ring-4 ring-indigo-50'
                          : 'border-slate-100 bg-white hover:border-slate-200'
                      )}
                    >
                      <span className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0',
                        activeSel ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                      )}>
                        {c.symbol}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-black text-slate-800">{c.code}</span>
                        <span className="block text-[11px] font-medium text-slate-400 truncate">{c.name}</span>
                      </span>
                      {activeSel && (
                        <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                          <Check size={11} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ————— STEP 3: Kategori ————— */}
          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-400">
              <StepHead icon={Tags} title="Kategori transaksi" subtitle="Kami siapkan kategori umum. Nyalakan yang kamu butuh — semua bisa diubah nanti." />
              <div className="space-y-3">
                {DEFAULT_CATEGORY_GROUPS.map((g) => {
                  const on = selectedGroups.includes(g.category);
                  return (
                    <button
                      key={g.category}
                      onClick={() => toggleGroup(g.category)}
                      className={cn(
                        'w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all active:scale-[0.99]',
                        on ? 'border-indigo-500 bg-indigo-50/60' : 'border-slate-100 bg-white'
                      )}
                    >
                      <span className={cn(
                        'w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                        on ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-300'
                      )}>
                        {on && <Check size={14} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-black text-slate-800">{g.category}</span>
                        <span className="block text-[11px] font-medium text-slate-400 truncate">{g.subs.join(' · ')}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ————— STEP 4: Rekening ————— */}
          {step === 4 && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-400">
              <StepHead icon={Building2} title="Tambah rekening pertama" subtitle="Pilih bank/e-wallet dan isi saldo saat ini. Boleh dilewati kalau belum siap." />
              <div className="grid grid-cols-3 gap-2.5 mb-5">
                {BANK_OPTIONS.map((b) => {
                  const on = bankName === b.name && bankType === b.type;
                  const logo = b.type === 'Cash' ? '' : matchIndonesianInstitutionLogo(b.name, b.type) ?? '';
                  return (
                    <button
                      key={`${b.name}-${b.type}`}
                      onClick={() => { setBankName(b.name); setBankType(b.type); }}
                      className={cn(
                        'flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all active:scale-95',
                        on ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-100' : 'border-slate-100 bg-white'
                      )}
                    >
                      <span className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center overflow-hidden">
                        {b.type === 'Cash' ? (
                          <Banknote size={18} className="text-emerald-500" />
                        ) : (
                          <LogoImage
                            src={logo}
                            alt={b.name}
                            fallbackText={b.name.slice(0, 2)}
                            fallbackIcon={b.type === 'E-Wallet' ? <Wallet size={16} className="text-indigo-500" /> : <Building2 size={16} className="text-blue-500" />}
                            className="w-6 h-6 object-contain"
                          />
                        )}
                      </span>
                      <span className="text-[10px] font-bold text-slate-600 text-center leading-tight truncate w-full">{b.name}</span>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 pl-1">
                    Nama Rekening
                  </label>
                  <input
                    className={inputClass}
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="mis. BCA / OVO / Dompet"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 pl-1">
                    Saldo Saat Ini ({currencyMeta.symbol})
                  </label>
                  <input
                    className={inputClass}
                    value={bankBalance}
                    onChange={(e) => setBankBalance(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="0"
                    inputMode="decimal"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-6 py-3 px-4 rounded-xl bg-rose-50 text-rose-600 text-[12px] font-bold text-center">
            {error}
          </div>
        )}

        {/* Footer navigation */}
        <div className="mt-8 flex items-center gap-3">
          {step > 0 && !submitting && (
            <button
              onClick={back}
              className="w-13 h-14 px-4 rounded-2xl bg-white border border-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all shrink-0"
              aria-label="Kembali"
            >
              <ArrowLeft size={20} />
            </button>
          )}

          {step < TOTAL_STEPS - 1 ? (
            <button
              onClick={next}
              disabled={!canNext()}
              className="flex-1 h-14 rounded-2xl bg-indigo-600 text-white text-[15px] font-black flex items-center justify-center gap-2 hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-lg shadow-indigo-600/25 disabled:opacity-40 disabled:pointer-events-none"
            >
              {step === 0 ? 'Mulai Setup' : 'Lanjut'}
              <ArrowRight size={18} />
            </button>
          ) : (
            <div className="flex-1 flex flex-col gap-2.5">
              <button
                onClick={() => finish(true)}
                disabled={submitting || !bankName.trim()}
                className="h-14 rounded-2xl bg-indigo-600 text-white text-[15px] font-black flex items-center justify-center gap-2 hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-lg shadow-indigo-600/25 disabled:opacity-40 disabled:pointer-events-none"
              >
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                {submitting ? 'Menyimpan…' : 'Selesai & Mulai'}
              </button>
              {!submitting && (
                <button
                  onClick={() => finish(false)}
                  className="h-10 text-[13px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Nanti saja, lewati rekening
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const StepHead = ({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) => (
  <div className="mb-7">
    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
      <Icon size={22} />
    </div>
    <h2 className="text-[22px] font-serif font-black text-slate-900 leading-tight mb-1.5">{title}</h2>
    <p className="text-[13px] font-medium text-slate-500 leading-relaxed">{subtitle}</p>
  </div>
);
