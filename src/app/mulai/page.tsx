'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Bell,
  Camera,
  Check,
  ChevronLeft,
  CreditCard,
  FileCheck,
  Flame,
  Keyboard,
  Landmark,
  Mic,
  PiggyBank,
  ScanLine,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { LeoMascot } from '@/components/mascot/LeoMascot';
import { BalanceChip, BrandBackdrop, BudgetChip, ScanChip, TxChip, VoiceChip } from '@/components/auth/FinanceChips';
import { cloudflareApi } from '@/lib/cloudflare-api';
import { resolveNext, sanitizeNext, withNext } from '@/lib/authNext';
import { parseQuickText } from '@/lib/quick/parse';
import { DEFAULT_CATEGORY_GROUPS, GUEST_CATEGORY_HINTS } from '@/lib/defaultCategories';
import {
  EMPTY_GUEST,
  GUEST_GOALS,
  loadGuest,
  saveGuest,
  type GuestGoal,
  type GuestInputMode,
  type GuestOnboarding,
} from '@/lib/guestOnboarding';
import { cn, formatIDR } from '@/lib/utils';

// Onboarding sebelum punya akun: 0 sambutan → 1 tujuan → 2 cara mencatat →
// 3 pengingat → 4 catatan pertama → 5 selesai ("Simpan ke akun" = daftar).
// Panel kanan = HP berisi aplikasi Leosiqra yang ikut terbentuk tiap langkah.
// Semua pilihan disimpan di browser (lib/guestOnboarding) dan dibawa ke akun
// setelah daftar (GuestCarryOver di setup akun web & app).
const LAST = 5;

const GOAL_ICON: Record<GuestGoal, React.ElementType> = {
  arus_uang: TrendingDown,
  budget: Target,
  nabung: PiggyBank,
  hutang: CreditCard,
  pajak: FileCheck,
  aset: Landmark,
};
const GOAL_TILE: Record<GuestGoal, string> = {
  arus_uang: 'bg-indigo-600',
  budget: 'bg-amber-500',
  nabung: 'bg-pink-500',
  hutang: 'bg-sky-500',
  pajak: 'bg-emerald-500',
  aset: 'bg-violet-500',
};

const MODES: { id: GuestInputMode; title: string; desc: string; icon: React.ElementType }[] = [
  { id: 'ketik', title: 'Ketik', desc: 'Seperti chat: “makan siang 30rb bca”.', icon: Keyboard },
  { id: 'suara', title: 'Ngomong', desc: '“Parkir lima ribu” — Leo yang nulis.', icon: Mic },
  { id: 'foto', title: 'Foto struk', desc: 'Item & total terbaca otomatis.', icon: Camera },
];

const REMINDER_TIMES = ['19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'];
const EXAMPLES = ['Kopi susu 25rb', 'Parkir 5rb', 'Gajian 4,2jt'];

const PARSE_CTX = {
  accounts: [],
  categories: DEFAULT_CATEGORY_GROUPS.flatMap((g) => g.subs.map((sub) => ({ category: g.category, subCategory: sub }))),
  history: GUEST_CATEGORY_HINTS,
};

const pill = 'inline-flex h-12 sm:h-14 items-center justify-center gap-2 px-8 rounded-full text-[15px] sm:text-[16px] font-bold transition-all active:scale-[0.98]';
const pillMain = cn(
  pill,
  'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-[0_14px_30px_-12px_rgba(79,70,229,0.7)] hover:-translate-y-0.5 hover:shadow-[0_18px_34px_-12px_rgba(79,70,229,0.75)] disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:hover:translate-y-0'
);
const pillGhost = cn(pill, 'bg-white text-indigo-700 ring-1 ring-indigo-100 hover:ring-indigo-200');
const h2 = 'text-[34px] font-extrabold leading-[1.08] tracking-[-0.03em] text-slate-900 sm:text-[44px]';

export default function MulaiPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [g, setG] = useState<GuestOnboarding>(EMPTY_GUEST);
  const [next, setNext] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [now, setNow] = useState<Date | null>(null);

  // Pulihkan pilihan sebelumnya; yang sudah login tidak perlu lewat sini.
  useEffect(() => {
    const n = sanitizeNext(new URLSearchParams(window.location.search).get('next'));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pulihkan isian dari localStorage setelah hydrate (static export)
    setNext(n);
    const saved = loadGuest();
    if (saved) {
      setG(saved);
      if (saved.note) setText(saved.note.text);
      if (saved.done) setStep(LAST);
    }
    setNow(new Date());
    cloudflareApi<{ user?: unknown }>('/api/auth/me')
      .then((r) => {
        if (r.user) router.replace(resolveNext(n) ?? '/membership/dashboard');
      })
      .catch(() => {});
  }, [router]);

  const update = (patch: Partial<GuestOnboarding>) =>
    setG((prev) => {
      const v = { ...prev, ...patch };
      saveGuest(v);
      return v;
    });

  const today = useMemo(() => (now ? new Date(now.getTime() + 7 * 3600e3).toISOString().slice(0, 10) : ''), [now]);
  const draft = useMemo(() => (text.trim() && today ? parseQuickText(text, { ...PARSE_CTX, today }) : null), [text, today]);
  const draftOk = !!draft?.amount && draft.amount > 0 && draft.amount < 1e12;
  const mode = g.inputMode ?? 'ketik';

  const go = (s: number) => {
    setStep(s);
    window.scrollTo({ top: 0 });
  };

  const saveNote = () => {
    if (!draft || !draftOk) return;
    update({
      note: {
        text: text.trim().slice(0, 200),
        type: draft.type ?? 'pengeluaran',
        amount: draft.amount!,
        note: draft.note ?? text.trim().slice(0, 60),
        category: draft.category,
        subCategory: draft.subCategory,
        createdAt: new Date().toISOString(),
      },
      done: true,
    });
    go(LAST);
  };

  const registerHref = withNext('/auth/register', next);
  const loginHref = withNext('/auth/login', next);

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* Kiri: teks & pilihan */}
      <section className="flex min-h-[60vh] flex-col px-6 pb-10 pt-6 sm:px-12 lg:min-h-screen lg:px-16 lg:py-10 xl:px-20">
        <header className="flex h-12 items-center justify-between">
          {step === 0 ? (
            <Link href="/" className="flex items-center gap-2">
              <Image src="/images/Logo-new.png" alt="Leosiqra" width={30} height={30} />
              <span className="text-[19px] font-extrabold tracking-tight">Leosiqra</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => go(step === LAST && !g.note ? 4 : step - 1)}
              aria-label="Kembali"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          {step > 0 && step < LAST && (
            <span className="text-[13px] font-bold text-indigo-600">Langkah {step} dari 4</span>
          )}
        </header>
        {step > 0 && step < LAST && (
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-indigo-50">
            <div className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-500 transition-all duration-500" style={{ width: `${(step / 4) * 100}%` }} />
          </div>
        )}

        <div key={step} className="flex flex-1 flex-col justify-center py-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {step === 0 && (
            <>
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-indigo-50 px-3.5 py-1.5 text-[12px] font-bold text-indigo-700">
                <Sparkles size={14} /> Catatan keuangan pribadi, dibantu Leo
              </span>
              <h1 className="mt-5 text-[44px] font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-[58px] xl:text-[64px]">
                Catat 5 detik.
                <br />
                <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500 bg-clip-text text-transparent">Paham sebulan.</span>
              </h1>
              <p className="mt-5 max-w-md text-[17px] leading-relaxed text-slate-500 sm:text-[19px]">
                Ketik, ngomong, atau foto struk. Leo yang merapikan jadi saldo, budget, dan laporan — tanpa spreadsheet.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <button type="button" onClick={() => go(1)} className={cn(pillMain, 'min-w-[12rem]')}>
                  Mulai sekarang <ArrowRight size={18} />
                </button>
                <Link href="/contoh" className={pillGhost}>Lihat contoh</Link>
              </div>
              <p className="mt-5 text-[14px] text-slate-500">
                Sudah punya akun? <Link href={loginHref} className="font-bold text-indigo-600 hover:underline">Masuk</Link>
              </p>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className={h2}>Apa yang paling bikin pusing soal uang?</h2>
              <p className="mt-3 text-[16px] text-slate-500">Pilih sebanyak yang kamu mau — berandamu disusun dari sini.</p>
              <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {GUEST_GOALS.map((goal) => {
                  const on = g.goals.includes(goal.id);
                  const Icon = GOAL_ICON[goal.id];
                  return (
                    <button
                      key={goal.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => update({ goals: on ? g.goals.filter((x) => x !== goal.id) : [...g.goals, goal.id] })}
                      className={cn(
                        'relative flex items-center gap-3 rounded-2xl p-3.5 text-left transition-all',
                        on ? 'bg-indigo-50 ring-2 ring-indigo-600' : 'bg-white ring-1 ring-slate-200 hover:ring-slate-300'
                      )}
                    >
                      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white', GOAL_TILE[goal.id])}>
                        <Icon size={18} />
                      </span>
                      <span className="flex-1 text-[15px] font-semibold text-slate-800">{goal.label}</span>
                      <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full', on ? 'bg-indigo-600 text-white' : 'ring-2 ring-slate-200')}>
                        {on && <Check size={12} strokeWidth={3.5} />}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-8">
                <button type="button" disabled={g.goals.length === 0} onClick={() => go(2)} className={cn(pillMain, 'min-w-[12rem]')}>Lanjut</button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className={h2}>Paling enak nyatat pakai apa?</h2>
              <p className="mt-3 text-[16px] text-slate-500">Ketiganya tetap bisa dipakai — ini cuma yang muncul duluan.</p>
              <div className="mt-6 grid grid-cols-3 gap-2.5">
                {MODES.map((m) => {
                  const on = mode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => update({ inputMode: m.id })}
                      className={cn(
                        'flex flex-col items-center gap-2 rounded-2xl px-2 py-4 text-center transition-all',
                        on ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-[0_14px_30px_-14px_rgba(79,70,229,0.8)]' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300'
                      )}
                    >
                      <m.icon size={22} />
                      <span className="text-[14px] font-bold">{m.title}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-4 text-[15px] text-slate-600">{MODES.find((m) => m.id === mode)!.desc}</p>
              <div className="mt-8">
                <button type="button" onClick={() => { if (!g.inputMode) update({ inputMode: 'ketik' }); go(3); }} className={cn(pillMain, 'min-w-[12rem]')}>Pakai ini</button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className={h2}>
                Leo ingetin
                <br />
                tiap malam.
              </h2>
              <p className="mt-3 text-[16px] text-slate-500">Satu notifikasi buat menutup hari. Kalau hari itu sudah ada catatan, Leo diam.</p>
              <div className="mt-6 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white"><Bell size={18} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-bold">Ingatkan aku</p>
                    <p className="text-[13px] text-slate-500">Bisa diubah di Profil → Notifikasi</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={g.reminder.on}
                    aria-label="Ingatkan aku"
                    onClick={() => update({ reminder: { ...g.reminder, on: !g.reminder.on } })}
                    className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors', g.reminder.on ? 'bg-indigo-600' : 'bg-slate-300')}
                  >
                    <span className={cn('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all', g.reminder.on ? 'right-1' : 'left-1')} />
                  </button>
                </div>
                {g.reminder.on && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {REMINDER_TIMES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => update({ reminder: { on: true, time: t } })}
                        className={cn('rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-colors', g.reminder.time === t ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100')}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-5">
                <button type="button" onClick={() => go(4)} className={cn(pillMain, 'min-w-[12rem]')}>Lanjut</button>
                {g.reminder.on && (
                  <button type="button" onClick={() => { update({ reminder: { ...g.reminder, on: false } }); go(4); }} className="text-[15px] font-semibold text-slate-500 hover:text-slate-800">
                    Nggak usah
                  </button>
                )}
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h2 className={h2}>Catatan pertamamu.</h2>
              <p className="mt-3 text-[16px] text-slate-500">Tadi bayar apa? Atau ada uang masuk? Tulis biasa saja, Leo yang menebak sisanya.</p>
              <div className="mt-6 rounded-2xl bg-white p-4 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-indigo-500">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, 200))}
                  rows={2}
                  aria-label="Catatan pertama"
                  placeholder="Kopi susu 25rb"
                  className="w-full resize-none bg-transparent text-[18px] font-medium outline-none placeholder:text-slate-300"
                />
                <div className="mt-1 flex items-center justify-between gap-3 text-[12px]">
                  {draftOk ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700">
                      <Check size={12} strokeWidth={3} />
                      {draft!.type === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'} · {formatIDR(draft!.amount!)}
                      {draft!.subCategory ? ` · ${draft!.subCategory}` : ''}
                    </span>
                  ) : (
                    <span className="text-slate-400">{text.trim() ? 'Sebutkan jumlahnya, mis. 25rb atau 25.000' : 'Suara & foto struk aktif setelah punya akun'}</span>
                  )}
                  <span className="shrink-0 text-slate-400">{text.length}/200</span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <button key={ex} type="button" onClick={() => setText(ex)} className="rounded-full bg-indigo-50 px-4 py-2 text-[14px] font-semibold text-indigo-700 hover:bg-indigo-100">
                    {ex}
                  </button>
                ))}
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-5">
                <button type="button" disabled={!draftOk} onClick={saveNote} className={cn(pillMain, 'min-w-[12rem]')}>Catat</button>
                <button type="button" onClick={() => { update({ note: null, done: true }); go(LAST); }} className="text-[15px] font-semibold text-slate-500 hover:text-slate-800">
                  Lewati dulu
                </button>
              </div>
            </>
          )}

          {step === LAST && (
            <>
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-amber-50 px-3.5 py-1.5 text-[13px] font-bold text-amber-700">
                <Flame size={15} /> Hari ke-1 bersama Leo
              </span>
              <h2 className={cn(h2, 'mt-4')}>Hari pertama, beres.</h2>
              <p className="mt-3 text-[16px] text-slate-500">
                Simpan ke akun supaya {g.note ? 'catatan & pilihanmu' : 'pilihanmu'} nggak hilang. Gratis 14 hari, tanpa kartu kredit.
              </p>
              <ul className="mt-6 space-y-2.5 text-[15px] text-slate-700">
                <li className="flex items-center gap-2.5"><Check size={17} className="text-emerald-500" strokeWidth={3} /> {g.goals.length} tujuan dipilih</li>
                <li className="flex items-center gap-2.5"><Check size={17} className="text-emerald-500" strokeWidth={3} /> Catat utama: {MODES.find((m) => m.id === mode)!.title.toLowerCase()}</li>
                <li className="flex items-center gap-2.5">
                  <Check size={17} className={g.reminder.on ? 'text-emerald-500' : 'text-slate-300'} strokeWidth={3} />
                  {g.reminder.on ? `Pengingat jam ${g.reminder.time}` : 'Tanpa pengingat'}
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={17} className={g.note ? 'text-emerald-500' : 'text-slate-300'} strokeWidth={3} />
                  {g.note ? `Catatan pertama: ${g.note.note} ${formatIDR(g.note.amount)}` : 'Belum ada catatan — nggak apa-apa'}
                </li>
              </ul>
              <div className="mt-8">
                <Link href={registerHref} className={cn(pillMain, 'min-w-[12rem]')}>Simpan ke akun <ArrowRight size={18} /></Link>
                <p className="mt-4 text-[14px] text-slate-500">
                  Sudah punya akun? <Link href={loginHref} className="font-bold text-indigo-600 hover:underline">Masuk</Link>
                </p>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Kanan: latar indigo + HP berisi aplikasi Leosiqra yang ikut terbentuk */}
      <aside className="relative mx-4 mb-4 min-h-[540px] overflow-hidden rounded-[32px] lg:m-4 lg:min-h-0">
        <BrandBackdrop />
        {step === 0 ? (
          <WelcomeScene />
        ) : (
          <div className="relative flex h-full min-h-[540px] items-center justify-center px-4 py-10">
            <Phone>
              {step === 1 && <PhoneHome goals={g.goals} now={now} />}
              {step === 2 && <PhoneInput mode={mode} />}
              {step === 3 && <PhoneLock on={g.reminder.on} time={g.reminder.time} now={now} />}
              {step === 4 && <PhoneHistory draftOk={draftOk} draft={draft} />}
              {step === LAST && <PhoneDayOne g={g} />}
            </Phone>
            {step === LAST && (
              <div className="pointer-events-none absolute bottom-0 right-[6%] hidden translate-y-[30%] xl:block">
                <LeoMascot mood="happy" size={190} />
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

function WelcomeScene() {
  return (
    <div className="relative h-full min-h-[540px]">
      <VoiceChip className="absolute left-[6%] top-[9%]" />
      <TxChip className="absolute right-[5%] top-[24%] hidden sm:block" />
      <BudgetChip className="absolute left-[8%] top-[42%] hidden sm:block" />
      <ScanChip className="absolute right-[8%] top-[48%] hidden md:block" />
      <BalanceChip className="absolute right-[6%] top-[28%] sm:hidden" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[34%]">
        <LeoMascot mood="idle" size={250} />
      </div>
    </div>
  );
}

function Phone({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-[280px] rounded-[46px] bg-slate-900 p-[9px] shadow-[0_40px_80px_-30px_rgba(30,27,75,0.6)] sm:w-[300px]">
      <div className="relative h-[560px] overflow-hidden rounded-[38px] bg-[#f6f7fb] sm:h-[600px]">
        <div className="absolute left-1/2 top-2 z-20 h-6 w-24 -translate-x-1/2 rounded-full bg-slate-900" />
        {children}
      </div>
    </div>
  );
}

function AppTop({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="px-5 pb-3 pt-12">
      {sub && <p className="text-[11px] font-semibold text-slate-400">{sub}</p>}
      <p className="text-[20px] font-extrabold tracking-tight text-slate-900">{title}</p>
    </div>
  );
}

function PhoneHome({ goals, now }: { goals: GuestGoal[]; now: Date | null }) {
  const month = now ? now.toLocaleDateString('id-ID', { month: 'long' }) : '';
  const widgets: Record<GuestGoal, React.ReactNode> = {
    arus_uang: (
      <>
        <p className="text-[11px] font-semibold text-slate-500">Keluar {month}</p>
        <p className="text-[17px] font-extrabold">Rp3.240.000</p>
        <div className="mt-2 flex h-10 items-end gap-1.5">
          {[40, 62, 30, 75, 52, 90, 58].map((h, i) => <span key={i} className={cn('flex-1 rounded', i === 5 ? 'bg-indigo-600' : 'bg-indigo-200')} style={{ height: `${h}%` }} />)}
        </div>
      </>
    ),
    budget: (
      <>
        <p className="text-[11px] font-semibold text-slate-500">Budget makan</p>
        <p className="text-[17px] font-extrabold">72% terpakai</p>
        <div className="mt-2 h-2 rounded-full bg-amber-100"><div className="h-full w-[72%] rounded-full bg-amber-500" /></div>
      </>
    ),
    nabung: (
      <>
        <p className="text-[11px] font-semibold text-slate-500">Tabungan mudik</p>
        <p className="text-[17px] font-extrabold">35% · Rp3,5 jt</p>
        <div className="mt-2 h-2 rounded-full bg-pink-100"><div className="h-full w-[35%] rounded-full bg-pink-500" /></div>
      </>
    ),
    hutang: (
      <>
        <p className="text-[11px] font-semibold text-slate-500">Cicilan motor</p>
        <p className="text-[17px] font-extrabold">Sisa 8 bulan</p>
        <div className="mt-2 h-2 rounded-full bg-sky-100"><div className="h-full w-[60%] rounded-full bg-sky-500" /></div>
      </>
    ),
    pajak: (
      <>
        <p className="text-[11px] font-semibold text-slate-500">SPT Tahunan</p>
        <p className="text-[17px] font-extrabold">Ringkasan siap</p>
        <p className="mt-1 text-[11px] text-slate-500">Harta, utang & penghasilan</p>
      </>
    ),
    aset: (
      <>
        <p className="text-[11px] font-semibold text-slate-500">Kekayaan bersih</p>
        <p className="text-[17px] font-extrabold">Rp48.200.000</p>
        <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-emerald-600"><TrendingUp size={12} /> naik bulan ini</p>
      </>
    ),
  };
  return (
    <>
      <AppTop sub="Selamat datang" title="Beranda" />
      <div className="space-y-2.5 px-4">
        {goals.length === 0 ? (
          <div className="mt-16 flex flex-col items-center text-center">
            <LeoMascot mood="peek" size={110} />
            <p className="mt-2 px-6 text-[13px] text-slate-500">Pilih di sebelah, berandamu terbentuk di sini.</p>
          </div>
        ) : (
          GUEST_GOALS.filter((x) => goals.includes(x.id)).map((x) => (
            <div key={x.id} className="rounded-2xl bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.06)] animate-in fade-in slide-in-from-bottom-2 duration-300">
              {widgets[x.id]}
            </div>
          ))
        )}
      </div>
    </>
  );
}

function PhoneInput({ mode }: { mode: GuestInputMode }) {
  if (mode === 'suara') {
    return (
      <div className="flex h-full flex-col items-center bg-gradient-to-b from-indigo-600 to-violet-700 px-6 pt-20 text-white">
        <p className="text-[13px] font-semibold text-white/70">Mendengarkan…</p>
        <p className="mt-3 text-center text-[22px] font-bold leading-snug">“parkir lima ribu, kopi dua puluh lima ribu”</p>
        <div className="mt-10 flex h-16 items-center gap-1">
          {[30, 60, 45, 90, 70, 100, 55, 80, 40, 65, 35].map((h, i) => (
            <span key={i} className="voice-bar w-1.5 rounded-full bg-white/80" style={{ height: `${h}%`, animationDelay: `${i * 0.07}s` }} />
          ))}
        </div>
        <span className="relative mt-auto mb-14 flex h-20 w-20 items-center justify-center rounded-full bg-white text-indigo-600">
          <span className="absolute inset-0 animate-ping rounded-full bg-white/40" />
          <Mic size={30} />
        </span>
      </div>
    );
  }
  if (mode === 'foto') {
    return (
      <div className="flex h-full flex-col bg-slate-900 px-6 pt-16 text-white">
        <p className="text-center text-[13px] font-semibold text-white/70">Arahkan ke struk</p>
        <div className="relative mx-auto mt-5 w-full rounded-2xl border-2 border-dashed border-white/40 p-4">
          <div className="space-y-2 rounded-lg bg-white p-4 text-slate-700">
            {[['Beras 5kg', '68.000'], ['Telur 1kg', '28.500'], ['Minyak 2L', '36.000']].map(([a, b]) => (
              <p key={a} className="flex justify-between font-mono text-[11px]"><span>{a}</span><span>{b}</span></p>
            ))}
            <p className="flex justify-between border-t border-dashed border-slate-300 pt-2 font-mono text-[12px] font-bold"><span>TOTAL</span><span>132.500</span></p>
          </div>
          <span className="scan-line absolute inset-x-4 h-0.5 bg-indigo-400 shadow-[0_0_14px_3px_rgba(129,140,248,0.7)]" />
        </div>
        <p className="mt-5 flex items-center justify-center gap-2 text-[13px] font-semibold text-indigo-200"><ScanLine size={15} /> 3 item terbaca · Rp132.500</p>
        <span className="mx-auto mt-auto mb-12 h-16 w-16 rounded-full border-4 border-white bg-white/20" />
      </div>
    );
  }
  return (
    <>
      <AppTop sub="Input cepat" title="Catat" />
      <div className="px-4">
        <div className="rounded-2xl bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
          <p className="text-[15px] font-medium text-slate-900">makan siang 30rb bca<span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-indigo-600 align-middle" /></p>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {['Pengeluaran', 'Rp30.000', 'Makan', 'BCA'].map((t) => (
            <span key={t} className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700">{t}</span>
          ))}
        </div>
        <div className="mt-6 grid grid-cols-10 gap-1">
          {'qwertyuiopasdfghjkl'.split('').map((k) => (
            <span key={k} className="flex h-8 items-center justify-center rounded-md bg-white text-[12px] text-slate-600 shadow-[0_1px_0_rgba(15,23,42,0.1)]">{k}</span>
          ))}
        </div>
      </div>
    </>
  );
}

function PhoneLock({ on, time, now }: { on: boolean; time: string; now: Date | null }) {
  const date = now ? now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
  return (
    <div className="flex h-full flex-col items-center bg-[radial-gradient(120%_70%_at_50%_0%,#4338ca,#1e1b4b_70%)] px-4 pt-16 text-white">
      <p className="text-[13px] font-semibold text-white/70">{date}</p>
      <p className="mt-1 text-[68px] font-extrabold leading-none tracking-tight">{time}</p>
      <div className={cn('mt-10 w-full rounded-[22px] bg-white/15 p-3.5 backdrop-blur-md transition-all duration-500', on ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-30')}>
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white">
            <Image src="/images/Logo-new.png" alt="" width={24} height={24} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex justify-between text-[11px] text-white/70"><span>Leosiqra</span><span>sekarang</span></p>
            <p className="text-[14px] font-bold">Waktunya tutup hari</p>
            <p className="text-[12px] text-white/80">Semenit bareng Leo: catat yang tadi, lalu istirahat.</p>
          </div>
        </div>
      </div>
      {!on && <p className="mt-4 text-[12px] text-white/60">Pengingat mati</p>}
    </div>
  );
}

function PhoneHistory({ draftOk, draft }: { draftOk: boolean; draft: ReturnType<typeof parseQuickText> | null }) {
  const income = draft?.type === 'pemasukan';
  return (
    <>
      <AppTop sub="Hari ini" title="Transaksi" />
      <div className="px-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
            <p className="text-[11px] font-semibold text-slate-500">Masuk</p>
            <p className="text-[14px] font-extrabold text-emerald-600">{draftOk && income ? formatIDR(draft!.amount!) : 'Rp0'}</p>
          </div>
          <div className="rounded-2xl bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
            <p className="text-[11px] font-semibold text-slate-500">Keluar</p>
            <p className="text-[14px] font-extrabold text-slate-900">{draftOk && !income ? formatIDR(draft!.amount!) : 'Rp0'}</p>
          </div>
        </div>
        {draftOk && draft ? (
          <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.06)] animate-in fade-in slide-in-from-bottom-2">
            <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl text-white', income ? 'bg-emerald-500' : 'bg-indigo-600')}>
              {income ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold">{draft.note || 'Catatan'}</p>
              <p className="text-[11px] text-slate-500">{draft.subCategory || draft.category || (income ? 'Pemasukan' : 'Pengeluaran')}</p>
            </div>
            <p className={cn('text-[13px] font-bold', income ? 'text-emerald-600' : 'text-slate-900')}>{income ? '+' : '−'}{formatIDR(draft.amount!)}</p>
          </div>
        ) : (
          <div className="mt-14 flex flex-col items-center text-center">
            <LeoMascot mood="watch" size={110} />
            <p className="mt-2 text-[13px] text-slate-500">Ketik di sebelah, muncul di sini.</p>
          </div>
        )}
      </div>
    </>
  );
}

function PhoneDayOne({ g }: { g: GuestOnboarding }) {
  const days = ['S', 'S', 'R', 'K', 'J', 'S', 'M'];
  return (
    <>
      <AppTop sub="Leosiqra" title="Hari ke-1" />
      <div className="space-y-3 px-4">
        <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-4 text-white">
          <p className="flex items-center gap-1.5 text-[12px] font-bold text-white/80"><Flame size={14} /> Rutinitas mencatat</p>
          <div className="mt-3 flex justify-between">
            {days.map((d, i) => (
              <span key={i} className="flex flex-col items-center gap-1">
                <span className={cn('flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold', i === 0 ? 'bg-white text-indigo-700' : 'bg-white/15 text-white/70')}>
                  {i === 0 ? <Check size={13} strokeWidth={3.5} /> : ''}
                </span>
                <span className="text-[10px] text-white/70">{d}</span>
              </span>
            ))}
          </div>
        </div>
        {g.note ? (
          <div className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white"><Check size={16} strokeWidth={3} /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold">{g.note.note}</p>
              <p className="text-[11px] text-slate-500">Catatan pertama</p>
            </div>
            <p className="text-[13px] font-bold">{g.note.type === 'pemasukan' ? '+' : '−'}{formatIDR(g.note.amount)}</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white p-3.5 text-[13px] text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">Catatan pertama menyusul — santai.</div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {GUEST_GOALS.filter((x) => g.goals.includes(x.id)).map((x) => (
            <span key={x.id} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">{x.label}</span>
          ))}
        </div>
        {g.reminder.on && (
          <p className="flex items-center gap-2 text-[12px] font-semibold text-slate-500"><Bell size={13} /> Leo ingetin jam {g.reminder.time}</p>
        )}
      </div>
    </>
  );
}
