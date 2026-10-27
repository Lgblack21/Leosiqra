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
  Zap,
  FileCheck,
} from 'lucide-react';
import { auth } from '@/lib/cf-client';
import { onAuthStateChanged } from '@/lib/cf-auth';
import { cloudflareApi } from '@/lib/cloudflare-api';
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

// Tampilan tiap langkah: nama di menu samping, warna ikon, judul besar & penjelasan.
const STEPS = [
  { title: 'Selamat datang', icon: Sparkles, tile: 'bg-indigo-600', headline: '', subtitle: '' },
  { title: 'Profil', icon: UserIcon, tile: 'bg-sky-500', headline: 'Kenalan dulu.', subtitle: 'Nama ini yang tampil di aplikasi dan dipakai untuk menyapamu.' },
  { title: 'Mata uang', icon: Coins, tile: 'bg-amber-500', headline: 'Mata uang utama.', subtitle: 'Dipakai untuk mencatat dan merangkum keuanganmu. Mata uang lain bisa ditambah nanti.' },
  { title: 'Kategori', icon: Tags, tile: 'bg-pink-500', headline: 'Kategori transaksi.', subtitle: 'Kami siapkan kategori yang umum dipakai. Matikan yang tidak perlu — semua bisa diubah nanti.' },
  { title: 'Rekening pertama', icon: Building2, tile: 'bg-emerald-500', headline: 'Rekening pertama.', subtitle: 'Pilih bank atau e-wallet lalu isi saldo saat ini. Boleh dilewati kalau belum siap.' },
] as const;

const WELCOME_TILES = [
  { title: 'Catat dalam hitungan detik', desc: 'Ketik “25rb kopi”, ucapkan, atau foto struk.', icon: Zap, tile: 'bg-orange-500' },
  { title: 'Semua rekening, satu layar', desc: 'Bank, e-wallet, tunai, dan kartu kredit.', icon: Wallet, tile: 'bg-indigo-600' },
  { title: 'Siap lapor pajak', desc: 'Ringkasan harta & penghasilan untuk SPT tahunan.', icon: FileCheck, tile: 'bg-emerald-500' },
] as const;

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
      // Satu request atomik ke server (mata uang, kategori, rekening opsional,
      // tandai selesai) — kalau halaman ditutup di tengah, tidak ada setup
      // setengah jadi, dan mengulang tidak membuat data dobel.
      const groups = DEFAULT_CATEGORY_GROUPS.filter((g) => selectedGroups.includes(g.category));
      const balanceNum = Number(bankBalance) || 0;
      await cloudflareApi('/api/member/onboarding', {
        method: 'POST',
        json: {
          name: name.trim(),
          whatsapp: whatsapp.trim(),
          currency: { code: currencyMeta.code, name: currencyMeta.name, symbol: currencyMeta.symbol },
          categories: groups.flatMap((g) => g.subs.map((sub) => ({ category: g.category, subCategory: sub }))),
          account:
            withBank && bankName.trim()
              ? { name: bankName.trim(), type: bankType, balance: balanceNum, logoUrl: bankLogo || undefined, logoLabel: bankName.trim() }
              : null,
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
    'w-full bg-white border border-slate-200/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 rounded-2xl py-3.5 px-4 text-[15px] font-semibold text-slate-900 placeholder:text-slate-300 outline-none transition-all';

  const meta = STEPS[step];

  return (
    <div className="fixed inset-0 z-[60] bg-[#f5f5f7] overflow-y-auto">
      <div className="min-h-full lg:grid lg:grid-cols-[288px_minmax(0,1fr)]">
        {/* Menu langkah (desktop) — gaya daftar pengaturan: ikon berwarna, langkah aktif disorot */}
        <aside className="hidden lg:flex flex-col sticky top-0 h-screen border-r border-slate-200/70 bg-[#efeff2]/80 backdrop-blur px-4 py-6">
          <div className="flex items-center gap-2.5 px-2">
            <Image src="/images/Logo-new.png" alt="Leosiqra" width={28} height={28} />
            <span className="font-black text-[17px] tracking-tight text-slate-900">Leosiqra</span>
          </div>
          <p className="mt-8 mb-2 px-3 text-[11px] font-bold text-slate-400">Siapkan akun</p>
          <nav className="space-y-1">
            {STEPS.map((s, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <button
                  key={s.title}
                  type="button"
                  onClick={() => done && !submitting && setStep(i)}
                  disabled={!done || submitting}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-[14px] font-semibold transition-colors',
                    active ? 'bg-indigo-600 text-white' : done ? 'text-slate-700 hover:bg-white/70' : 'text-slate-400'
                  )}
                >
                  <span
                    className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white',
                      done ? 'bg-emerald-500' : active ? 'bg-white/20' : cn(s.tile, 'opacity-40')
                    )}
                  >
                    {done ? <Check size={15} /> : <s.icon size={15} />}
                  </span>
                  <span className="truncate">{s.title}</span>
                </button>
              );
            })}
          </nav>
          <div className="mt-auto px-3 text-[12px] font-medium text-slate-400 leading-relaxed">
            Kurang dari 2 menit. Semua bisa diubah lagi nanti di Pengaturan.
          </div>
        </aside>

        <main className="min-h-screen flex flex-col">
          {/* Bar atas (HP & tablet): logo + progres per langkah */}
          <header className="lg:hidden sticky top-0 z-10 bg-[#f5f5f7]/85 backdrop-blur border-b border-slate-200/60 px-5 py-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Image src="/images/Logo-new.png" alt="Leosiqra" width={24} height={24} />
                <span className="font-black text-[15px] tracking-tight text-slate-900">Leosiqra</span>
              </div>
              {step > 0 && (
                <span className="text-[12px] font-semibold text-slate-500">
                  Langkah {step} dari {TOTAL_STEPS - 1}
                </span>
              )}
            </div>
            {step > 0 && (
              <div className="mt-3 grid grid-cols-4 gap-1.5">
                {STEPS.slice(1).map((s, i) => (
                  <span
                    key={s.title}
                    className={cn('h-1 rounded-full transition-colors duration-500', i < step ? 'bg-indigo-600' : 'bg-slate-200')}
                  />
                ))}
              </div>
            )}
          </header>

          <div className="flex-1 lg:flex-none w-full max-w-xl mx-auto px-5 pt-10 pb-8 lg:pt-24">
            <div key={step} className="animate-in fade-in slide-in-from-bottom-3 duration-500">
              {/* ————— STEP 0: Welcome ————— */}
              {step === 0 && (
                <>
                  <p className="text-[15px] font-semibold text-indigo-600">Selamat datang{name ? `, ${name.split(' ')[0]}` : ''}</p>
                  <h1 className="mt-2 text-[40px] sm:text-[56px] leading-[1.02] font-black tracking-[-0.03em] text-slate-900">
                    Keuangan rapi,<br />mulai di sini.
                  </h1>
                  <p className="mt-5 text-[17px] leading-relaxed text-slate-500">
                    Empat langkah singkat untuk menyiapkan akunmu. Setelah itu kami antar keliling fitur biar
                    nggak bingung.
                  </p>
                  <div className="mt-9 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {WELCOME_TILES.map((t) => (
                      <div key={t.title} className="bg-white rounded-[22px] p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                        <span className={cn('w-9 h-9 rounded-xl flex items-center justify-center text-white', t.tile)}>
                          <t.icon size={17} />
                        </span>
                        <p className="mt-4 text-[15px] font-bold text-slate-900 leading-snug">{t.title}</p>
                        <p className="mt-1 text-[13px] text-slate-500 leading-relaxed">{t.desc}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {step > 0 && <StepHead eyebrow={`Langkah ${step} · ${meta.title}`} tile={meta.tile} icon={meta.icon} title={meta.headline} subtitle={meta.subtitle} />}

              {/* ————— STEP 1: Profil ————— */}
              {step === 1 && (
                <div className="bg-white rounded-[22px] p-5 sm:p-6 space-y-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <div>
                    <label className="block text-[13px] font-semibold text-slate-600 mb-2">
                      Nama lengkap <span className="text-rose-400">*</span>
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
                    <label className="block text-[13px] font-semibold text-slate-600 mb-2">
                      Nomor WhatsApp <span className="text-slate-400 font-medium">(opsional)</span>
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
              )}

              {/* ————— STEP 2: Mata Uang ————— */}
              {step === 2 && (
                <div className="grid grid-cols-2 gap-2.5">
                  {CURRENCY_OPTIONS.map((c) => {
                    const activeSel = currency === c.code;
                    return (
                      <button
                        key={c.code}
                        onClick={() => setCurrency(c.code)}
                        className={cn(
                          'relative flex items-center gap-3 p-4 rounded-[18px] text-left transition-all active:scale-[0.98]',
                          activeSel
                            ? 'bg-white ring-2 ring-indigo-600 shadow-[0_6px_20px_-8px_rgba(79,70,229,0.45)]'
                            : 'bg-white ring-1 ring-slate-200/70 hover:ring-slate-300'
                        )}
                      >
                        <span className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0',
                          activeSel ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                        )}>
                          {c.symbol}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[15px] font-bold text-slate-900">{c.code}</span>
                          <span className="block text-[12px] text-slate-400 truncate">{c.name}</span>
                        </span>
                        {activeSel && (
                          <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                            <Check size={12} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ————— STEP 3: Kategori ————— */}
              {step === 3 && (
                <div className="bg-white rounded-[22px] divide-y divide-slate-100 overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  {DEFAULT_CATEGORY_GROUPS.map((g) => {
                    const on = selectedGroups.includes(g.category);
                    return (
                      <button
                        key={g.category}
                        onClick={() => toggleGroup(g.category)}
                        aria-pressed={on}
                        className="w-full flex items-center gap-3 px-4 sm:px-5 py-4 text-left hover:bg-slate-50 transition-colors"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-bold text-slate-900">{g.category}</span>
                          <span className="block text-[12px] text-slate-400 truncate">{g.subs.join(' · ')}</span>
                        </span>
                        <span className={cn('w-11 h-6 rounded-full relative shrink-0 transition-colors', on ? 'bg-indigo-600' : 'bg-slate-200')}>
                          <span className={cn('w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-all', on ? 'right-0.5' : 'left-0.5')} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ————— STEP 4: Rekening ————— */}
              {step === 4 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {BANK_OPTIONS.map((b) => {
                      const on = bankName === b.name && bankType === b.type;
                      const logo = b.type === 'Cash' ? '' : matchIndonesianInstitutionLogo(b.name, b.type) ?? '';
                      return (
                        <button
                          key={`${b.name}-${b.type}`}
                          onClick={() => { setBankName(b.name); setBankType(b.type); }}
                          className={cn(
                            'flex flex-col items-center gap-2 p-3 rounded-[18px] bg-white transition-all active:scale-95',
                            on ? 'ring-2 ring-indigo-600' : 'ring-1 ring-slate-200/70 hover:ring-slate-300'
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
                          <span className="text-[11px] font-semibold text-slate-600 text-center leading-tight truncate w-full">{b.name}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="bg-white rounded-[22px] p-5 sm:p-6 space-y-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                    <div>
                      <label className="block text-[13px] font-semibold text-slate-600 mb-2">Nama rekening</label>
                      <input
                        className={inputClass}
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="mis. BCA / OVO / Dompet"
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-semibold text-slate-600 mb-2">Saldo saat ini ({currencyMeta.symbol})</label>
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
              <div className="mt-6 py-3 px-4 rounded-2xl bg-rose-50 text-rose-600 text-[13px] font-semibold text-center">
                {error}
              </div>
            )}
          </div>

          {/* Navigasi bawah — menempel di HP supaya tombol selalu terjangkau jempol */}
          <div className="sticky bottom-0 bg-[#f5f5f7]/90 backdrop-blur border-t border-slate-200/60 lg:static lg:bg-transparent lg:border-0">
            <div className="w-full max-w-xl mx-auto px-5 py-4 lg:pb-16 flex items-center gap-3">
              {step > 0 && !submitting && (
                <button
                  onClick={back}
                  className="w-12 h-12 rounded-full bg-white ring-1 ring-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all shrink-0"
                  aria-label="Kembali"
                >
                  <ArrowLeft size={19} />
                </button>
              )}

              {step < TOTAL_STEPS - 1 ? (
                <button
                  onClick={next}
                  disabled={!canNext()}
                  className="flex-1 h-12 rounded-full bg-indigo-600 text-white text-[15px] font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none"
                >
                  {step === 0 ? 'Mulai setup' : 'Lanjut'}
                  <ArrowRight size={17} />
                </button>
              ) : (
                <div className="flex-1 flex items-center gap-3">
                  {!submitting && (
                    <button
                      onClick={() => finish(false)}
                      className="h-12 px-4 rounded-full text-[14px] font-semibold text-slate-500 hover:text-slate-700 hover:bg-white transition-colors"
                    >
                      Lewati
                    </button>
                  )}
                  <button
                    onClick={() => finish(true)}
                    disabled={submitting || !bankName.trim()}
                    className="flex-1 h-12 rounded-full bg-indigo-600 text-white text-[15px] font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {submitting ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}
                    {submitting ? 'Menyimpan…' : 'Selesai & mulai'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

const StepHead = ({
  eyebrow,
  tile,
  icon: Icon,
  title,
  subtitle,
}: {
  eyebrow: string;
  tile: string;
  icon: React.ElementType;
  title: string;
  subtitle: string;
}) => (
  <div className="mb-8">
    <div className="flex items-center gap-2.5">
      <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center text-white', tile)}>
        <Icon size={15} />
      </span>
      <p className="text-[14px] font-semibold text-slate-500">{eyebrow}</p>
    </div>
    <h2 className="mt-4 text-[32px] sm:text-[44px] leading-[1.05] font-black tracking-[-0.03em] text-slate-900">{title}</h2>
    <p className="mt-3 text-[16px] sm:text-[17px] text-slate-500 leading-relaxed">{subtitle}</p>
  </div>
);
