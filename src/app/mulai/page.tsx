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
  Keyboard,
  Landmark,
  Mic,
  PiggyBank,
  Sparkles,
  Target,
  TrendingDown,
} from 'lucide-react';
import { LeoMascot } from '@/components/mascot/LeoMascot';
import { Coin, PaydayNote, Receipt, StickyNote, WalletCard } from '@/components/auth/PaperNotes';
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
  budget: 'bg-orange-500',
  nabung: 'bg-pink-500',
  hutang: 'bg-sky-500',
  pajak: 'bg-emerald-500',
  aset: 'bg-violet-500',
};

const MODES: { id: GuestInputMode; chip: string; title: string; desc: string; hint: string; icon: React.ElementType; bg: string }[] = [
  { id: 'ketik', chip: 'Tinggal ketik', title: 'Ketik pintar', desc: 'Ketik seperti chat: “makan siang 30rb pakai BCA”.', hint: 'Paling cepat di depan laptop.', icon: Keyboard, bg: 'bg-sky-50' },
  { id: 'suara', chip: 'Tinggal ngomong', title: 'Suara', desc: '“Parkir lima ribu, kopi dua puluh lima ribu.” Kamu ngomong, Leo yang nulis.', hint: 'Paling enak waktu di jalan.', icon: Mic, bg: 'bg-indigo-50' },
  { id: 'foto', chip: 'Tinggal foto', title: 'Foto struk', desc: 'Foto struknya, item & totalnya terbaca otomatis.', hint: 'Cocok buat belanja bulanan.', icon: Camera, bg: 'bg-amber-50' },
];

const REMINDER_TIMES = ['19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'];
const EXAMPLES = ['Kopi susu 25rb', 'Parkir 5rb', 'Gajian 4,2jt'];

const PARSE_CTX = {
  accounts: [],
  categories: DEFAULT_CATEGORY_GROUPS.flatMap((g) => g.subs.map((sub) => ({ category: g.category, subCategory: sub }))),
  history: GUEST_CATEGORY_HINTS,
};

const pill = 'h-12 sm:h-14 px-8 rounded-full text-[15px] sm:text-[16px] font-semibold transition-all active:scale-[0.98]';
const pillDark = cn(pill, 'bg-slate-950 text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:active:scale-100');
const pillLight = cn(pill, 'bg-slate-100 text-slate-800 hover:bg-slate-200');

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
    <div className="min-h-screen bg-white font-sans text-slate-900 lg:grid lg:grid-cols-2 lg:gap-4 lg:p-4">
      {/* Kiri: teks & pilihan */}
      <section className="flex min-h-[60vh] flex-col px-6 pb-10 pt-6 sm:px-12 lg:min-h-0 lg:px-16 lg:py-10">
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
              className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          {step > 0 && step < LAST && (
            <div className="flex gap-1.5" aria-label={`Langkah ${step} dari 4`}>
              {[1, 2, 3, 4].map((i) => (
                <span key={i} className={cn('h-1.5 w-6 rounded-full transition-colors', i <= step ? 'bg-slate-900' : 'bg-slate-200')} />
              ))}
            </div>
          )}
        </header>

        <div key={step} className="flex flex-1 flex-col justify-center py-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {step === 0 && (
            <>
              <h1 className="text-[42px] font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-[54px] xl:text-[60px]">
                Gajian, jajan, cicilan.
                <br />
                Semua tercatat rapi.
              </h1>
              <p className="mt-5 max-w-md text-[17px] leading-relaxed text-slate-500 sm:text-[19px]">
                Ketik, ucapkan, atau foto struk. Lihat ke mana uangmu pergi, dengan bahasa yang gampang.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <button type="button" onClick={() => go(1)} className={cn(pillDark, 'min-w-[11rem]')}>Mulai</button>
                <Link href="/#produk" className={cn(pillLight, 'inline-flex items-center')}>Lihat contoh</Link>
              </div>
              <p className="mt-5 text-[14px] text-slate-500">
                Sudah punya akun? <Link href={loginHref} className="font-semibold text-slate-900 hover:underline">Masuk</Link>
              </p>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="text-[38px] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-[48px]">Mau Leo bantu apa?</h2>
              <div className="mt-7 space-y-2.5">
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
                        'flex w-full items-center gap-4 rounded-[20px] px-5 py-4 text-left transition-colors',
                        on ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800 hover:bg-slate-200/70'
                      )}
                    >
                      <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2', on ? 'border-white bg-white text-slate-900' : 'border-slate-300')}>
                        {on && <Check size={14} strokeWidth={3} />}
                      </span>
                      <span className="flex-1 text-[16px] font-semibold">{goal.label}</span>
                      <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl text-white', GOAL_TILE[goal.id])}>
                        <Icon size={17} />
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-8">
                <button type="button" disabled={g.goals.length === 0} onClick={() => go(2)} className={cn(pillDark, 'min-w-[11rem]')}>Lanjut</button>
                <p className="mt-3 text-[13px] text-slate-500">Pilih sebanyak yang kamu mau. Bisa diubah kapan saja.</p>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-[38px] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-[48px]">Paling enak nyatat pakai apa?</h2>
              {(() => {
                const m = MODES.find((x) => x.id === (g.inputMode ?? 'ketik'))!;
                return (
                  <div className="mt-6 hidden lg:block">
                    <p className="text-[26px] font-bold tracking-tight">{m.title}</p>
                    <p className="mt-2 text-[17px] text-slate-500">{m.desc}</p>
                    <p className="mt-1.5 text-[14px] text-slate-400">{m.hint}</p>
                  </div>
                );
              })()}
              <div className="mt-6 grid gap-2.5 lg:hidden">
                {MODES.map((m) => (
                  <ModeCard key={m.id} m={m} on={(g.inputMode ?? 'ketik') === m.id} onClick={() => update({ inputMode: m.id })} compact />
                ))}
              </div>
              <div className="mt-8">
                <button type="button" onClick={() => { if (!g.inputMode) update({ inputMode: 'ketik' }); go(3); }} className={cn(pillDark, 'min-w-[11rem]')}>Pakai yang ini</button>
                <p className="mt-3 text-[13px] text-slate-500">Ketiganya tetap bisa dipakai. Ini cuma pilihan utama.</p>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-[38px] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-[48px]">
                Semenit,
                <br />
                tiap malam.
              </h2>
              <p className="mt-4 text-[17px] text-slate-500">Leo ingatkan kamu menutup hari: catat yang tadi, lalu istirahat.</p>
              <span className="mt-6 inline-flex w-fit flex-col rounded-2xl bg-indigo-50 px-4 py-2.5">
                <span className="text-[17px] font-bold text-indigo-700">± 1 menit</span>
                <span className="text-[12px] font-semibold text-indigo-500">Tutup hari</span>
              </span>
              <div className="mt-4 rounded-[20px] bg-slate-100 p-4">
                <div className="flex items-center gap-3">
                  <Bell size={20} className="shrink-0 text-slate-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-semibold">Ingatkan aku?</p>
                    <p className="text-[13px] text-slate-500">Tidak dikirim kalau hari itu sudah ada catatan.</p>
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
                  <div className="mt-4 flex flex-wrap gap-2 pl-8">
                    {REMINDER_TIMES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => update({ reminder: { on: true, time: t } })}
                        className={cn('rounded-full px-3.5 py-1.5 text-[13px] font-semibold', g.reminder.time === t ? 'bg-slate-900 text-white' : 'bg-white text-slate-600')}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-5">
                <button type="button" onClick={() => go(4)} className={cn(pillDark, 'min-w-[11rem]')}>
                  {g.reminder.on ? 'Atur ritme harianku' : 'Lanjut'}
                </button>
                {g.reminder.on && (
                  <button type="button" onClick={() => { update({ reminder: { ...g.reminder, on: false } }); go(4); }} className="text-[15px] font-semibold text-slate-600 hover:text-slate-900">
                    Nanti saja
                  </button>
                )}
              </div>
              <p className="mt-3 text-[13px] text-slate-400">Notifikasi diaktifkan setelah akunmu jadi.</p>
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="text-[38px] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-[48px]">
                Mulai dari
                <br />
                hari ini.
              </h2>
              <p className="mt-4 text-[17px] text-slate-500">Hari ini sudah bayar apa? Atau ada uang masuk? Tulis jumlahnya, Leo yang rapikan.</p>
              <label className="mt-6 block rounded-[20px] border border-slate-200 bg-white p-4 focus-within:border-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Catatanmu</span>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, 200))}
                  rows={2}
                  placeholder="Kopi susu 25rb"
                  className="mt-1 w-full resize-none bg-transparent text-[18px] outline-none placeholder:text-slate-300"
                />
                <span className="flex items-center justify-between text-[12px] text-slate-400">
                  <span>
                    {draftOk ? (
                      <span className="font-semibold text-emerald-600">
                        {draft!.type === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'} · {formatIDR(draft!.amount!)}
                        {draft!.subCategory ? ` · ${draft!.subCategory}` : ''}
                      </span>
                    ) : text.trim() ? (
                      'Sebutkan jumlahnya, mis. 25rb atau 25.000'
                    ) : (
                      'Suara & foto struk bisa dipakai setelah punya akun'
                    )}
                  </span>
                  <span>{text.length} / 200</span>
                </span>
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <button key={ex} type="button" onClick={() => setText(ex)} className="rounded-full border border-slate-200 px-4 py-2 text-[14px] text-slate-700 hover:bg-slate-50">
                    {ex}
                  </button>
                ))}
              </div>
              <div className="mt-8">
                <button type="button" disabled={!draftOk} onClick={saveNote} className={cn(pillDark, 'min-w-[11rem]')}>Simpan catatanku</button>
                <p className="mt-3 text-[13px] text-slate-500">
                  Bisa diubah atau dihapus nanti.{' '}
                  <button type="button" onClick={() => { update({ note: null, done: true }); go(LAST); }} className="font-semibold text-slate-900 hover:underline">
                    Lewati
                  </button>
                </p>
              </div>
            </>
          )}

          {step === LAST && (
            <>
              <h2 className="text-[38px] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-[52px]">Awal yang bagus.</h2>
              <p className="mt-3 text-[17px] text-slate-500">Semua sudah siap.</p>
              <span className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-slate-100 py-2 pl-2 pr-4 text-[15px] font-semibold">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white">
                  <Image src="/images/Logo-new.png" alt="" width={20} height={20} />
                </span>
                Hari ke-1 bersama Leo
              </span>
              <Link href={registerHref} className="mt-4 flex items-center gap-4 rounded-[20px] bg-amber-50 p-4 transition-colors hover:bg-amber-100/70">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-white">
                  <Sparkles size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-semibold">Simpan ke akun biar nggak hilang</span>
                  <span className="block text-[13px] text-slate-500">
                    {g.note ? 'Catatan & pilihanmu ikut tersimpan.' : 'Pilihanmu ikut tersimpan.'} Gratis 14 hari, tanpa kartu kredit.
                  </span>
                </span>
                <ArrowRight size={18} className="shrink-0 text-slate-400" />
              </Link>
              <div className="mt-8">
                <Link href={registerHref} className={cn(pillDark, 'inline-flex min-w-[11rem] items-center justify-center')}>Simpan ke akun</Link>
                <p className="mt-3 text-[13px] text-slate-500">
                  Sudah punya akun? <Link href={loginHref} className="font-semibold text-slate-900 hover:underline">Masuk</Link>
                </p>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Kanan: pratinjau per langkah */}
      <aside className={cn('relative mx-4 mb-4 min-h-[420px] overflow-hidden rounded-[32px] bg-[#f5f5f7] lg:m-0 lg:min-h-0', step === 2 && 'hidden lg:block')}>
        {step === 0 && <WelcomeScene />}
        {step === 1 && <GoalsPreview goals={g.goals} now={now} />}
        {step === 2 && (
          <div className="flex h-full items-center justify-center p-8 xl:p-12">
            <div className="grid w-full max-w-[480px] grid-cols-1 gap-4">
              {MODES.map((m) => (
                <ModeCard key={m.id} m={m} on={(g.inputMode ?? 'ketik') === m.id} onClick={() => update({ inputMode: m.id })} />
              ))}
            </div>
          </div>
        )}
        {step === 3 && <ReminderPreview on={g.reminder.on} time={g.reminder.time} />}
        {step === 4 && <HistoryPreview draftOk={draftOk} draft={draft} />}
        {step === LAST && <FirstReceipt g={g} now={now} />}
      </aside>
    </div>
  );
}

function ModeCard({ m, on, onClick, compact }: { m: (typeof MODES)[number]; on: boolean; onClick: () => void; compact?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'flex flex-col rounded-[24px] text-left transition-all',
        m.bg,
        compact ? 'flex-row items-center gap-4 p-4' : 'flex-row items-center gap-5 p-6',
        on ? 'ring-[3px] ring-slate-900' : 'ring-1 ring-transparent hover:ring-slate-300'
      )}
    >
      <span className={cn('flex shrink-0 items-center justify-center rounded-xl bg-white text-slate-800', compact ? 'h-10 w-10' : 'h-12 w-12')}>
        <m.icon size={19} />
      </span>
      <span className="min-w-0">
        <span className="inline-block rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-700">{m.chip}</span>
        <span className={cn('mt-2 block text-slate-700', compact ? 'text-[14px]' : 'text-[16px] leading-relaxed')}>{m.desc}</span>
      </span>
    </button>
  );
}

function WelcomeScene() {
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_55%_60%,rgba(251,191,36,0.18),transparent_60%)]" />
      <StickyNote className="absolute left-[7%] top-[8%]" />
      <Coin className="absolute left-[52%] top-[7%]" />
      <Receipt className="absolute right-[6%] top-[14%] hidden sm:block" />
      <PaydayNote className="absolute left-[9%] top-[52%]" />
      <WalletCard className="absolute right-[7%] top-[50%] hidden sm:block" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[38%]">
        <LeoMascot mood="idle" size={260} />
      </div>
    </div>
  );
}

function GoalsPreview({ goals, now }: { goals: GuestGoal[]; now: Date | null }) {
  const month = now ? now.toLocaleDateString('id-ID', { month: 'long' }) : '';
  const card = (id: GuestGoal, title: string, value: string, body: React.ReactNode) => {
    const on = goals.includes(id);
    return (
      <div className={cn('rounded-[22px] p-5 transition-all duration-300', on ? 'bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]' : 'border border-dashed border-slate-300/80 opacity-45')}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13px] font-semibold text-slate-500">{title}</p>
          {!on && <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Belum dipilih</span>}
        </div>
        <p className="mt-1 text-[22px] font-extrabold tracking-tight">{value}</p>
        <div className="mt-3">{body}</div>
      </div>
    );
  };
  const bar = (w: string, on = false) => <div className="h-2.5 rounded-full bg-slate-100"><div className={cn('h-full rounded-full', on ? 'bg-indigo-600' : 'bg-indigo-300')} style={{ width: w }} /></div>;
  return (
    <div className="h-full p-6 sm:p-8 xl:p-10">
      <div className="flex items-baseline justify-between">
        <p className="text-[22px] font-bold tracking-tight">Ruang Uangku</p>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Beranda · contoh</p>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {card('arus_uang', `Pengeluaran ${month}`, 'Rp 3.240.000',
          <div className="flex h-16 items-end gap-2">{[40, 62, 30, 75, 52, 90, 58].map((h, i) => <span key={i} className={cn('flex-1 rounded-md', i === 5 ? 'bg-indigo-600' : 'bg-indigo-200')} style={{ height: `${h}%` }} />)}</div>)}
        {card('budget', 'Anggaran', '3 kategori', <div className="space-y-2">{bar('72%')}{bar('88%', true)}{bar('35%')}</div>)}
        {card('nabung', 'Tujuan', 'Mudik · 35%', bar('35%', true))}
        {card('hutang', 'Cicilan motor', 'Sisa 8 bulan', bar('60%'))}
        {card('pajak', 'SPT Tahunan', 'Ringkasan siap', <p className="text-[12px] text-slate-500">Harta, utang & penghasilan setahun.</p>)}
        {card('aset', 'Kekayaan bersih', 'Rp 48.200.000', <p className="text-[12px] text-slate-500">Rekening, tabungan & investasi.</p>)}
      </div>
    </div>
  );
}

function ReminderPreview({ on, time }: { on: boolean; time: string }) {
  const [h, m] = time.split(':').map(Number);
  const frac = (h * 60 + m) / (24 * 60);
  const r = 120;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex h-full flex-col p-6 sm:p-8 xl:p-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Pengingat jam {time}</p>
        <div className={cn('w-full max-w-[340px] rounded-2xl bg-white/90 p-3.5 shadow-sm transition-opacity', on ? 'opacity-100' : 'opacity-40')}>
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50"><Image src="/images/Logo-new.png" alt="" width={24} height={24} /></span>
            <div className="min-w-0 flex-1">
              <p className="flex justify-between text-[12px] text-slate-400"><span>Leosiqra</span><span>{time}</span></p>
              <p className="text-[14px] font-semibold">Waktunya tutup hari</p>
              <p className="text-[12px] text-slate-500">Semenit bareng Leo: catat yang tadi, lalu istirahat.</p>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center py-6">
        <svg viewBox="0 0 300 300" className="h-auto w-full max-w-[320px]" aria-hidden>
          <circle cx="150" cy="150" r={r} fill="none" stroke="#e2e8f0" strokeWidth="26" />
          <circle cx="150" cy="150" r={r} fill="none" stroke={on ? '#4f46e5' : '#cbd5e1'} strokeWidth="26" strokeLinecap="round" strokeDasharray={`${c * frac} ${c}`} transform="rotate(-90 150 150)" className="transition-all duration-500" />
          {Array.from({ length: 24 }, (_, i) => {
            const a = (i / 24) * 2 * Math.PI - Math.PI / 2;
            const r1 = i % 6 === 0 ? 146 : 150;
            return <line key={i} x1={150 + Math.cos(a) * r1} y1={150 + Math.sin(a) * r1} x2={150 + Math.cos(a) * 156} y2={150 + Math.sin(a) * 156} stroke="#0f172a" strokeWidth={i % 6 === 0 ? 3 : 1.2} />;
          })}
          <text x="150" y="160" textAnchor="middle" className="fill-slate-900" style={{ fontSize: 52, fontWeight: 800, letterSpacing: '-0.03em' }}>{time}</text>
          <text x="150" y="190" textAnchor="middle" className="fill-slate-500" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.14em' }}>TIAP MALAM</text>
        </svg>
      </div>
    </div>
  );
}

function HistoryPreview({ draftOk, draft }: { draftOk: boolean; draft: ReturnType<typeof parseQuickText> | null }) {
  return (
    <div className="flex h-full min-h-[420px] flex-col p-6 sm:p-8 xl:p-10">
      <div className="flex items-baseline justify-between">
        <p className="text-[22px] font-bold tracking-tight">Riwayat</p>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Hari ini</p>
      </div>
      {draftOk && draft ? (
        <div className="mt-6 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm animate-in fade-in slide-in-from-bottom-2">
          <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl text-white', draft.type === 'pemasukan' ? 'bg-emerald-500' : 'bg-indigo-600')}>
            {draft.type === 'pemasukan' ? <ArrowRight size={17} className="-rotate-45" /> : <TrendingDown size={17} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold">{draft.note || 'Catatan'}</p>
            <p className="text-[12px] text-slate-500">{draft.subCategory || draft.category || (draft.type === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran')}</p>
          </div>
          <p className={cn('text-[15px] font-bold', draft.type === 'pemasukan' ? 'text-emerald-600' : 'text-slate-900')}>
            {draft.type === 'pemasukan' ? '+' : '−'}{formatIDR(draft.amount!)}
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <LeoMascot mood="watch" size={120} />
          <p className="mt-2 text-[15px] text-slate-500">Catatanmu muncul di sini.</p>
        </div>
      )}
    </div>
  );
}

function FirstReceipt({ g, now }: { g: GuestOnboarding; now: Date | null }) {
  const stamp = now
    ? `${now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} · ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
    : '';
  const income = g.note?.type === 'pemasukan';
  return (
    <div className="flex h-full min-h-[460px] items-center justify-center p-6">
      <div className="w-full max-w-[340px]">
        <div className="mx-auto h-1.5 w-[110%] -translate-x-[4.5%] rounded-full bg-slate-300" />
        <div className="receipt-edge -mt-0.5 bg-white px-6 pb-9 pt-6 font-mono text-[13px] text-slate-700 shadow-[0_24px_40px_-24px_rgba(15,23,42,0.35)] animate-in slide-in-from-top-6 duration-700">
          <div className="text-center">
            <Image src="/images/Logo-new.png" alt="" width={30} height={30} className="mx-auto" />
            <p className="mt-2 font-sans text-[19px] font-bold text-slate-900">Struk pertama</p>
            <p className="mt-1 uppercase tracking-wider text-slate-500">Ruang uangku · No. 0001</p>
            <p className="uppercase tracking-wider text-slate-500">{stamp}</p>
          </div>
          <p className="my-4 border-t border-dashed border-slate-300" />
          {g.note ? (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-sans text-[15px] text-slate-900">{g.note.note}</p>
                <p className="uppercase tracking-wider text-slate-500">{g.note.subCategory || g.note.category || (income ? 'Pemasukan' : 'Pengeluaran')}</p>
              </div>
              <p className="shrink-0 font-sans text-[15px] text-slate-900">{formatIDR(g.note.amount)}</p>
            </div>
          ) : (
            <div>
              <p className="font-sans text-[15px] text-slate-900">Hari pertama</p>
              <p className="uppercase tracking-wider text-slate-500">Belum ada catatan. Tidak apa-apa.</p>
            </div>
          )}
          <p className="my-4 border-t border-dashed border-slate-300" />
          <p className="flex items-baseline justify-between">
            <span className="font-bold uppercase tracking-wider text-slate-900">{income ? 'Masuk' : 'Keluar'}</span>
            <span className="font-sans text-[24px] font-semibold text-slate-900">{formatIDR(g.note?.amount ?? 0)}</span>
          </p>
          <div className="mt-6 flex justify-center">
            <span className="inline-flex -rotate-6 items-center gap-2 rounded-xl border-[3px] border-indigo-600 px-4 py-1.5 font-sans text-[13px] font-extrabold uppercase tracking-[0.16em] text-indigo-600">
              <Check size={15} strokeWidth={3} /> Tercatat · Hari 1
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
