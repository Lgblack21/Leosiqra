'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  BadgeCheck,
  Briefcase,
  CalendarClock,
  Check,
  Cloud,
  Copy,
  FileSpreadsheet,
  HandCoins,
  Info,
  Landmark,
  LayoutDashboard,
  Printer,
  Receipt,
  Scale,
  Smartphone,
  Store,
} from 'lucide-react';
import { YearPicker } from '@/components/ui/YearPicker';
import { PajakKesehatan } from '@/components/pajak/PajakKesehatan';
import type { Transaction } from '@/lib/services/transactionService';
import type { Investment } from '@/lib/services/investmentService';
import type { Account } from '@/lib/services/accountService';
import { auth, db } from '@/lib/cf-client';
import { onAuthStateChanged } from '@/lib/cf-auth';
import { collection, query, where, onSnapshot, orderBy } from '@/lib/cf-firestore';
import { exchangeRateService, type ExchangeRates } from '@/lib/services/exchangeRateService';
import { shopBookService } from '@/lib/services/shopBookService';
import { useCountUp } from '@/lib/hooks/useCountUp';
import { cn, formatIDR } from '@/lib/utils';
import {
  BIAYA_JABATAN_MAKS,
  MAX_TANGGUNGAN,
  NAMA_BULAN,
  UMKM_BATAS_OMZET,
  UMKM_BEBAS,
  UMKM_TAHUN_MAKS,
  hitungSpt,
  sisaHari,
  tenggatTahun,
  umkmPerBulan,
  type Tenggat,
} from '@/lib/pajak/rules';
import { DOKUMEN, DEFAULT_SETTINGS, loadTaxSettings, saveTaxSettings, type TaxSettings } from '@/lib/pajak/settings';

// Pajak Center (3.25.0): estimasi PPh orang pribadi yang benar-benar bisa dipakai — PPh final UMKM 0,5%
// dari omzet Usahaku, asisten SPT Tahunan (karyawan/usaha/campuran), kalender tenggat, harta & utang,
// setelan tersimpan di akun. Estimasi, bukan nasihat pajak resmi.

type TabId = 'ringkasan' | 'umkm' | 'spt' | 'harta' | 'kalender';
const TABS: { id: TabId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'ringkasan', label: 'Ringkasan', icon: LayoutDashboard },
  { id: 'umkm', label: 'UMKM 0,5%', icon: Store },
  { id: 'spt', label: 'SPT Tahunan', icon: Receipt },
  { id: 'harta', label: 'Harta & Utang', icon: Scale },
  { id: 'kalender', label: 'Kalender', icon: CalendarClock },
];

const amt = (t: Transaction) => Number(t.amountIDR) || Number(t.amount) || 0;
const pad = (n: number) => String(n).padStart(2, '0');
const tglID = (d: Date) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
const short = (n: number) =>
  Math.abs(n) >= 1e9
    ? `Rp${(n / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 2 })} M`
    : Math.abs(n) >= 1e6
      ? `Rp${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`
      : formatIDR(n);

export function PajakCenter() {
  const reduce = useReducedMotion();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [tab, setTab] = useState<TabId>('ringkasan');
  const [tx, setTx] = useState<Transaction[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [debts, setDebts] = useState<Transaction[]>([]);
  const [fx, setFx] = useState<ExchangeRates>({});
  const [s, setS] = useState<TaxSettings>(DEFAULT_SETTINGS);
  const [where_, setWhere] = useState<'akun' | 'perangkat' | null>(null);
  const [saving, setSaving] = useState(false);
  const [xls, setXls] = useState<'idle' | 'busy' | 'err'>('idle');
  const loadedYear = useRef<number | null>(null);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    exchangeRateService
      .getLatestRates()
      .then(setFx)
      .catch(() => {});
  }, []);

  // Setelan per tahun pajak.
  useEffect(() => {
    let alive = true;
    loadedYear.current = null;
    loadTaxSettings(year).then((r) => {
      if (!alive) return;
      setS(r.settings);
      setWhere(r.where);
      loadedYear.current = year;
    });
    return () => {
      alive = false;
    };
  }, [year]);
  const update = useCallback(
    (patch: Partial<TaxSettings>) => {
      setS((cur) => {
        const next = { ...cur, ...patch };
        if (loadedYear.current === year) {
          if (saveTimer.current) window.clearTimeout(saveTimer.current);
          setSaving(true);
          saveTimer.current = window.setTimeout(() => {
            saveTaxSettings(year, next).then((w) => {
              setWhere(w);
              setSaving(false);
            });
          }, 600);
        }
        return next;
      });
    },
    [year],
  );

  // Data transaksi tahun ini + posisi harta/utang (sama dengan versi lama).
  useEffect(() => {
    const subs: (() => void)[] = [];
    const unsub = onAuthStateChanged(auth, (u) => {
      subs.splice(0).forEach((f) => f());
      if (!u) return;
      const map = (snap: { docs: { id: string; data: () => Record<string, unknown> }[] }) =>
        snap.docs.map((d) => {
          const v = d.data() as Record<string, unknown> & { date?: { toDate?: () => Date } };
          return {
            ...v,
            id: d.id,
            amount: Number(v.amount) || 0,
            date: v.date?.toDate?.() ?? new Date(),
          } as Transaction;
        });
      subs.push(
        onSnapshot(
          query(
            collection(db, 'transactions'),
            where('userId', '==', u.uid),
            where('date', '>=', new Date(year, 0, 1)),
            where('date', '<=', new Date(year, 11, 31, 23, 59, 59)),
            orderBy('date', 'desc'),
          ),
          (snap) => setTx(map(snap)),
        ),
        onSnapshot(query(collection(db, 'investments'), where('userId', '==', u.uid)), (snap) =>
          setInvestments(
            snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Investment).filter((i) => i.status !== 'Planned'),
          ),
        ),
        onSnapshot(query(collection(db, 'accounts'), where('userId', '==', u.uid)), (snap) =>
          setAccounts(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Account)),
        ),
        onSnapshot(
          query(collection(db, 'transactions'), where('userId', '==', u.uid), where('type', '==', 'debt')),
          (snap) => setDebts(map(snap)),
        ),
      );
    });
    return () => {
      unsub();
      subs.forEach((f) => f());
    };
  }, [year]);

  // Buku usaha Usahaku (kas usaha terpisah, 3.28.0+) tidak lagi masuk transaksi pribadi → ambil omzet bruto
  // & biaya per bulan dari buku usaha lalu dijumlahkan dengan catatan lama.
  const [bookMonths, setBookMonths] = useState<{ month: number; omzet: number; biaya: number }[]>([]);
  useEffect(() => {
    let alive = true;
    void shopBookService.omzet(year).then((m) => alive && setBookMonths(m));
    return () => {
      alive = false;
    };
  }, [year]);

  // ── Angka otomatis dari catatan
  const auto = useMemo(() => {
    const omzet = Array(12).fill(0) as number[];
    let gaji = 0;
    let biayaUsaha = 0;
    let zakat = 0;
    for (const t of tx) {
      const v = amt(t);
      const cat = t.category ?? '';
      if (t.type === 'pemasukan') {
        if (cat === 'Gaji') gaji += v;
        if (cat === 'Usaha & Freelance') omzet[new Date(t.date as unknown as Date).getMonth()] += v;
      } else if (t.type === 'pengeluaran') {
        if (cat === 'Biaya Usaha') biayaUsaha += v;
        if (/zakat/i.test(`${cat} ${t.subCategory ?? ''} ${t.note ?? ''}`)) zakat += v;
      }
    }
    for (const m of bookMonths) {
      if (m.month >= 1 && m.month <= 12) omzet[m.month - 1] += m.omzet;
      biayaUsaha += m.biaya;
    }
    return { omzet, gaji, biayaUsaha, zakat };
  }, [tx, bookMonths]);

  const omzet = useMemo(() => auto.omzet.map((v, i) => s.omzetManual[pad(i + 1)] ?? v), [auto.omzet, s.omzetManual]);
  const omzetSetahun = omzet.reduce((a, b) => a + b, 0);
  const umkm = useMemo(() => umkmPerBulan(omzet), [omzet]);
  const umkmTotal = umkm.reduce((a, b) => a + b.pph, 0);
  const umkmBelum = umkm.filter((b) => b.pph > 0 && !s.umkmSetor[pad(b.bulan)]?.paid).reduce((a, b) => a + b.pph, 0);
  const finalMode = s.usahaMode === 'final';

  const gajiBruto = s.gajiBruto ?? auto.gaji;
  const zakat = s.zakat ?? auto.zakat;
  const spt = useMemo(
    () =>
      hitungSpt({
        status: s.status,
        tanggungan: s.tanggungan,
        karyawan: s.karyawan,
        brutoGaji: gajiBruto,
        iuranPensiun: s.iuranPensiun,
        pph21Dipotong: s.pph21Dipotong,
        usahaMode: s.usahaMode,
        omzetSetahun,
        biayaUsaha: auto.biayaUsaha,
        penghasilanLain: s.penghasilanLain,
        zakat,
      }),
    [s, gajiBruto, omzetSetahun, auto.biayaUsaha, zakat],
  );

  // ── Harta & utang (posisi terkini, IDR)
  const toIDR = useCallback((n: number, cur?: string) => exchangeRateService.convert(n, cur || 'IDR', 'IDR', fx), [fx]);
  const harta = useMemo(
    () => [
      ...accounts.map((a) => ({
        name: a.name,
        type: a.type || 'Rekening',
        value: toIDR(Number(a.balance) || 0, a.currency),
      })),
      ...investments.map((i) => ({
        name: i.name,
        type: 'Investasi',
        value: Number(i.amountIDR) || Number(i.amountInvested) || 0,
      })),
    ],
    [accounts, investments, toIDR],
  );
  const utang = debts
    .filter((t) => t.category === 'Hutang' && t.paymentStatus !== 'lunas')
    .map((t) => ({ name: t.lenderName || t.note || 'Hutang', value: amt(t) }));
  const piutang = debts
    .filter((t) => t.category === 'Piutang' && t.paymentStatus !== 'lunas')
    .map((t) => ({ name: t.lenderName || t.note || 'Piutang', value: amt(t) }));
  const totalHarta = harta.reduce((a, b) => a + b.value, 0);
  const totalUtang = utang.reduce((a, b) => a + b.value, 0);
  const totalPiutang = piutang.reduce((a, b) => a + b.value, 0);

  const tenggat = useMemo(
    () =>
      tenggatTahun(year, {
        karyawan: s.karyawan,
        umkm: finalMode ? umkm : null,
        setor: s.umkmSetor,
        sptLapor: s.sptLapor,
      }),
    [year, s.karyawan, finalMode, umkm, s.umkmSetor, s.sptLapor],
  );
  const nextDue = tenggat.find((t) => !t.done && sisaHari(t.date) >= -60);
  const docs = DOKUMEN.filter((d) => (!('karyawan' in d) || s.karyawan) && (!('usaha' in d) || finalMode));
  const docsDone = docs.filter((d) => s.dokumen[d.key]).length;

  const bayarTahun = Math.max(0, spt.selisih) + (finalMode ? umkmBelum : 0);
  const heroAnim = useCountUp(bayarTahun);

  const downloadXlsx = async () => {
    setXls('busy');
    try {
      const { buildPajakXlsx } = await import('@/lib/pajak/pajakXlsx');
      const blob = await buildPajakXlsx({
        year,
        s,
        spt,
        umkm: finalMode ? umkm : null,
        harta,
        utang,
        piutang,
        omzet,
        tenggat,
      });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Pajak-${year}-Leosiqra.xlsx`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      setXls('idle');
    } catch {
      setXls('err');
    }
  };

  return (
    <div className="pajak-root mx-auto max-w-6xl px-4 pb-24 pt-5 md:px-8 md:pt-8">
      <style>{`@media print { .pajak-noprint { display: none !important; } .pajak-root { padding: 0 !important; max-width: none !important; } }`}</style>

      {/* Kepala */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="fs-12 font-bold uppercase tracking-[0.16em] text-indigo-500">Pajak Center</p>
          <h1 className="fsh-30 font-extrabold tracking-tight text-slate-900">Pajak {year}, beres tanpa pusing</h1>
          <p className="mt-1 flex items-center gap-1.5 fs-13 text-slate-500">
            {where_ === 'akun' ? <Cloud size={14} className="text-emerald-500" /> : <Smartphone size={14} />}
            {saving
              ? 'Menyimpan…'
              : where_ === 'akun'
                ? 'Setelan tersimpan di akunmu'
                : where_
                  ? 'Setelan tersimpan di perangkat ini'
                  : 'Memuat…'}
          </p>
        </div>
        <div className="pajak-noprint flex flex-wrap items-center gap-2">
          <YearPicker value={year} onChange={setYear} />
          <button
            type="button"
            onClick={downloadXlsx}
            disabled={xls === 'busy'}
            className="flex h-10 items-center gap-1.5 rounded-full bg-emerald-600 px-4 fs-13 font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            <FileSpreadsheet size={15} /> {xls === 'busy' ? 'Menyiapkan…' : 'Excel'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex h-10 items-center gap-1.5 rounded-full bg-white px-4 fs-13 font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            <Printer size={15} /> Cetak / PDF
          </button>
        </div>
      </div>
      {xls === 'err' && <p className="mt-2 fs-12 font-semibold text-rose-600">Excel gagal dibuat. Coba lagi.</p>}

      {/* Hero */}
      <motion.section
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative mt-5 overflow-hidden rounded-[28px] bg-gradient-to-br from-[#eef0ff] via-white to-[#fff5e4] p-5 ring-1 ring-slate-200/80 md:p-7"
      >
        <span
          aria-hidden
          className="auth-aurora absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.2),transparent_65%)]"
        />
        <div className="relative grid gap-5 md:grid-cols-[1.3fr_1fr]">
          <div className="min-w-0">
            <p className="fs-13 font-bold text-slate-500">Perkiraan yang masih perlu dibayar untuk {year}</p>
            <p className="mt-1 fsh-40 font-extrabold tracking-tight tabular-nums text-slate-900">
              {formatIDR(Math.round(heroAnim))}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Chip tone={spt.status === 'kurang' ? 'amber' : spt.status === 'lebih' ? 'emerald' : 'slate'}>
                SPT:{' '}
                {spt.status === 'kurang'
                  ? `kurang bayar ${short(spt.selisih)}`
                  : spt.status === 'lebih'
                    ? `lebih bayar ${short(-spt.selisih)}`
                    : 'nihil'}
              </Chip>
              {finalMode && (
                <Chip tone={umkmBelum ? 'amber' : 'emerald'}>
                  UMKM:{' '}
                  {umkmTotal
                    ? umkmBelum
                      ? `${short(umkmBelum)} belum disetor`
                      : 'semua sudah disetor'
                    : 'belum kena pajak'}
                </Chip>
              )}
              <Chip tone={s.sptLapor ? 'emerald' : 'slate'}>
                {s.sptLapor ? 'SPT sudah dilapor' : 'SPT belum dilapor'}
              </Chip>
            </div>
          </div>
          <div className="min-w-0 space-y-2.5">
            {nextDue ? (
              <button
                type="button"
                onClick={() => setTab('kalender')}
                className="flex w-full items-center gap-3 rounded-2xl bg-white/90 p-3.5 text-left ring-1 ring-slate-200 transition hover:-translate-y-0.5"
              >
                <Countdown days={sisaHari(nextDue.date)} />
                <span className="min-w-0">
                  <span className="block truncate fs-14 font-bold text-slate-900">{nextDue.title}</span>
                  <span className="block fs-12 text-slate-500">{tglID(nextDue.date)}</span>
                </span>
              </button>
            ) : (
              <p className="rounded-2xl bg-white/90 p-3.5 fs-13 font-semibold text-emerald-700 ring-1 ring-emerald-200">
                Semua tenggat {year} sudah beres. 🎉
              </p>
            )}
            <button
              type="button"
              onClick={() => setTab('spt')}
              className="flex w-full items-center gap-3 rounded-2xl bg-white/90 p-3.5 text-left ring-1 ring-slate-200 transition hover:-translate-y-0.5"
            >
              <Ring pct={docs.length ? docsDone / docs.length : 0} />
              <span>
                <span className="block fs-14 font-bold text-slate-900">Persiapan dokumen SPT</span>
                <span className="block fs-12 text-slate-500">
                  {docsDone} dari {docs.length} siap
                </span>
              </span>
            </button>
          </div>
        </div>
      </motion.section>

      {/* Tab */}
      <nav className="pajak-noprint no-scrollbar sticky top-0 z-10 -mx-4 mt-5 flex gap-1 overflow-x-auto bg-[#f6f7fb]/95 px-4 py-2 md:mx-0 md:rounded-full md:bg-white md:p-1.5 md:shadow-sm md:ring-1 md:ring-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'relative flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 fs-13 font-bold transition-colors',
              tab === t.id ? 'text-white' : 'text-slate-500 hover:text-slate-800',
            )}
          >
            {tab === t.id && (
              <motion.span
                layoutId="pajak-tab"
                className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 shadow-[0_8px_20px_-10px_rgba(79,70,229,0.8)]"
                transition={{ type: 'spring', stiffness: 420, damping: 36 }}
              />
            )}
            <t.icon size={15} className="relative" />
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </nav>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: 0.28 }}
          className="mt-5"
        >
          {tab === 'ringkasan' && (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat icon={Briefcase} label="Penghasilan neto (SPT)" value={spt.neto} sub={`PKP ${short(spt.pkp)}`} />
                <Stat
                  icon={Receipt}
                  label="PPh terutang setahun"
                  value={spt.pphTerutang}
                  sub={`Sudah dipotong ${short(spt.kredit)}`}
                />
                <Stat
                  icon={Store}
                  label="PPh final UMKM"
                  value={finalMode ? umkmTotal : 0}
                  sub={finalMode ? `Omzet ${short(omzetSetahun)}` : 'Mode UMKM belum dipakai'}
                />
                <Stat
                  icon={Landmark}
                  label="Harta bersih"
                  value={totalHarta + totalPiutang - totalUtang}
                  sub={`${harta.length} harta · ${utang.length} utang`}
                />
              </div>
              <Card title="Yang perlu dilakukan" icon={CalendarClock}>
                <ul className="space-y-2">
                  {tenggat
                    .filter((t) => !t.done)
                    .slice(0, 4)
                    .map((t) => (
                      <TenggatRow key={t.key} t={t} />
                    ))}
                  {!tenggat.some((t) => !t.done) && (
                    <li className="fs-13 text-slate-500">Tidak ada tenggat yang tertunda.</li>
                  )}
                </ul>
              </Card>
              <Disclaimer />
              <PajakKesehatan year={year} />
            </div>
          )}

          {tab === 'umkm' && (
            <div className="space-y-5">
              <Card title="Usahamu dikenai pajak dengan cara apa?" icon={Store}>
                <div className="grid gap-2.5 md:grid-cols-3">
                  {(
                    [
                      [
                        'final',
                        'PPh final 0,5% (UMKM)',
                        'Omzet ≤ Rp4,8 M/tahun. Rp500 jt pertama tiap tahun tidak kena pajak.',
                      ],
                      [
                        'pembukuan',
                        'Pembukuan (tarif umum)',
                        'Laba usaha (omzet − biaya) ikut dihitung di SPT dengan tarif progresif.',
                      ],
                      ['tidak', 'Tidak punya usaha', 'Hanya gaji / penghasilan lain.'],
                    ] as const
                  ).map(([id, t, d]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => update({ usahaMode: id })}
                      className={cn(
                        'rounded-2xl p-4 text-left ring-1 transition',
                        s.usahaMode === id
                          ? 'bg-indigo-50 ring-2 ring-indigo-500'
                          : 'bg-white ring-slate-200 hover:ring-slate-300',
                      )}
                    >
                      <span className="flex items-center justify-between fs-14 font-extrabold text-slate-900">
                        {t} {s.usahaMode === id && <BadgeCheck size={17} className="text-indigo-600" />}
                      </span>
                      <span className="mt-1 block fs-12.5 text-slate-500">{d}</span>
                    </button>
                  ))}
                </div>
              </Card>

              {s.usahaMode !== 'tidak' && (
                <>
                  <Card title={`Omzet ${year} menuju batas bebas pajak`} icon={HandCoins}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="fsh-26 font-extrabold tabular-nums">{formatIDR(omzetSetahun)}</p>
                      <p className="fs-13 text-slate-500">
                        {omzetSetahun < UMKM_BEBAS
                          ? `Sisa ${short(UMKM_BEBAS - omzetSetahun)} lagi sebelum kena 0,5%`
                          : `Sudah lewat Rp500 jt — kelebihannya kena 0,5%`}
                      </p>
                    </div>
                    <div className="relative mt-3 h-4 overflow-hidden rounded-full bg-slate-100">
                      <motion.div
                        className={cn(
                          'h-full rounded-full',
                          omzetSetahun < UMKM_BEBAS
                            ? 'bg-gradient-to-r from-emerald-400 to-teal-500'
                            : 'bg-gradient-to-r from-amber-400 to-orange-500',
                        )}
                        initial={reduce ? false : { width: 0 }}
                        animate={{ width: `${Math.min(100, (omzetSetahun / UMKM_BEBAS) * 100)}%` }}
                        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </div>
                    <p className="mt-2 fs-12 text-slate-400">
                      Otomatis dari pemasukan kategori <b>Usaha &amp; Freelance</b> (termasuk penjualan Usahaku). Bisa
                      dikoreksi per bulan di tabel.
                    </p>
                    {omzetSetahun > UMKM_BATAS_OMZET && (
                      <Warn>Omzet melewati Rp4,8 M — tahun berikutnya tidak bisa memakai PPh final 0,5%.</Warn>
                    )}
                  </Card>

                  {finalMode && (
                    <Card title="Setoran PPh final per bulan" icon={Receipt}>
                      <div className="mb-3 flex flex-wrap items-center gap-2 fs-13 text-slate-600">
                        Mulai memakai PPh final tahun
                        <input
                          type="number"
                          min={2009}
                          max={2100}
                          value={s.umkmMulai ?? ''}
                          placeholder="mis. 2022"
                          onChange={(e) => update({ umkmMulai: e.target.value ? Number(e.target.value) : null })}
                          className="h-9 w-24 rounded-lg border border-slate-200 px-2 fs-13"
                        />
                        {s.umkmMulai && (
                          <span
                            className={cn(
                              'fs-12',
                              year > s.umkmMulai + UMKM_TAHUN_MAKS - 1 ? 'font-bold text-amber-700' : 'text-slate-400',
                            )}
                          >
                            Batas {UMKM_TAHUN_MAKS} tahun: sampai tahun pajak {s.umkmMulai + UMKM_TAHUN_MAKS - 1}
                            {year > s.umkmMulai + UMKM_TAHUN_MAKS - 1
                              ? ' — sudah lewat, cek ketentuan terbaru DJP.'
                              : '.'}
                          </span>
                        )}
                      </div>
                      <div className="overflow-x-auto rounded-2xl ring-1 ring-slate-200">
                        <table className="w-full min-w-[620px] text-left fs-13">
                          <thead className="bg-slate-50 text-slate-500">
                            <tr>
                              {['Masa', 'Omzet', 'Kumulatif', 'PPh 0,5%', 'Status'].map((h) => (
                                <th
                                  key={h}
                                  className={cn(
                                    'px-3 py-2.5 font-bold',
                                    h !== 'Masa' && h !== 'Status' && 'text-right',
                                  )}
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {umkm.map((b) => {
                              const k = pad(b.bulan);
                              const paid = s.umkmSetor[k]?.paid === true;
                              return (
                                <tr key={k}>
                                  <td className="px-3 py-2 font-semibold">{NAMA_BULAN[b.bulan - 1]}</td>
                                  <td className="px-3 py-1.5 text-right">
                                    <RupiahInput
                                      value={b.omzet}
                                      edited={s.omzetManual[k] !== undefined}
                                      onChange={(v) =>
                                        update({
                                          omzetManual:
                                            v === null
                                              ? Object.fromEntries(
                                                  Object.entries(s.omzetManual).filter(([x]) => x !== k),
                                                )
                                              : { ...s.omzetManual, [k]: v },
                                        })
                                      }
                                    />
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                                    {short(b.kumulatif)}
                                  </td>
                                  <td
                                    className={cn(
                                      'px-3 py-2 text-right font-bold tabular-nums',
                                      b.pph ? 'text-slate-900' : 'text-slate-300',
                                    )}
                                  >
                                    {formatIDR(b.pph)}
                                  </td>
                                  <td className="px-3 py-2">
                                    {b.pph > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => update({ umkmSetor: { ...s.umkmSetor, [k]: { paid: !paid } } })}
                                        className={cn(
                                          'flex items-center gap-1 rounded-full px-2.5 py-1 fs-12 font-bold transition',
                                          paid
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-amber-100 text-amber-800 hover:bg-amber-200',
                                        )}
                                      >
                                        {paid ? <Check size={13} /> : null} {paid ? 'Sudah setor' : 'Tandai disetor'}
                                      </button>
                                    ) : (
                                      <span className="fs-12 text-slate-400">
                                        {b.omzet ? 'Tidak ada setoran' : '—'}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-indigo-50/60 font-extrabold">
                              <td className="px-3 py-2.5">Total</td>
                              <td className="px-3 py-2.5 text-right tabular-nums">{formatIDR(omzetSetahun)}</td>
                              <td />
                              <td className="px-3 py-2.5 text-right tabular-nums">{formatIDR(umkmTotal)}</td>
                              <td className="px-3 py-2.5 fs-12 font-bold text-amber-700">
                                {umkmBelum ? `${short(umkmBelum)} belum` : ''}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      <p className="mt-2 fs-12 text-slate-400">
                        Setor paling lambat tanggal 15 bulan berikutnya lewat kode billing di Coretax (kode akun pajak
                        411128, jenis setoran 420).
                      </p>
                    </Card>
                  )}

                  {s.usahaMode === 'pembukuan' && (
                    <Card title="Laba usaha (pembukuan)" icon={Briefcase}>
                      <Line k="Omzet setahun" v={omzetSetahun} />
                      <Line k="Biaya usaha (kategori Biaya Usaha)" v={-auto.biayaUsaha} />
                      <Line k="Laba usaha → masuk SPT" v={spt.netoUsaha} bold />
                    </Card>
                  )}
                </>
              )}
            </div>
          )}

          {tab === 'spt' && (
            <div className="grid gap-5 lg:grid-cols-[1fr_1.05fr]">
              <div className="space-y-5">
                <Card title="1. Status keluarga (PTKP)" icon={Info}>
                  <div className="flex flex-wrap gap-2">
                    {(['TK', 'K'] as const).map((st) => (
                      <Pill key={st} on={s.status === st} onClick={() => update({ status: st })}>
                        {st === 'TK' ? 'Belum menikah' : 'Menikah'}
                      </Pill>
                    ))}
                  </div>
                  <p className="mt-3 fs-13 font-semibold text-slate-600">
                    Tanggungan (anak/keluarga sedarah, maks {MAX_TANGGUNGAN})
                  </p>
                  <div className="mt-1.5 flex gap-2">
                    {[0, 1, 2, 3].map((n) => (
                      <Pill key={n} on={s.tanggungan === n} onClick={() => update({ tanggungan: n })}>
                        {n}
                      </Pill>
                    ))}
                  </div>
                  <p className="mt-2 fs-12 text-slate-400">
                    PTKP kamu: <b className="text-slate-700">{formatIDR(spt.ptkp)}</b> ({s.status}/{s.tanggungan})
                  </p>
                </Card>
                <Card title="2. Penghasilan" icon={Briefcase}>
                  <label className="flex items-center justify-between gap-3 fs-14 font-semibold">
                    Saya karyawan (dapat gaji)
                    <Toggle on={s.karyawan} onChange={(v) => update({ karyawan: v })} />
                  </label>
                  {s.karyawan && (
                    <div className="mt-3 space-y-3">
                      <Field
                        label="Penghasilan bruto setahun (gaji, tunjangan, THR, bonus)"
                        hint={
                          s.gajiBruto === null
                            ? `Otomatis dari kategori Gaji: ${formatIDR(auto.gaji)}`
                            : 'Lihat angka di bukti potong A1'
                        }
                        value={gajiBruto}
                        onChange={(v) => update({ gajiBruto: v })}
                        auto={s.gajiBruto === null}
                      />
                      <Field
                        label="Iuran pensiun / JHT yang dipotong dari gajimu"
                        value={s.iuranPensiun}
                        onChange={(v) => update({ iuranPensiun: v ?? 0 })}
                      />
                      <Field
                        label="PPh 21 yang sudah dipotong kantor setahun"
                        hint="Ada di bukti potong A1."
                        value={s.pph21Dipotong}
                        onChange={(v) => update({ pph21Dipotong: v ?? 0 })}
                      />
                    </div>
                  )}
                  <div className="mt-3">
                    <Field
                      label="Penghasilan neto lain (kena tarif umum, mis. honor, sewa tidak final)"
                      value={s.penghasilanLain}
                      onChange={(v) => update({ penghasilanLain: v ?? 0 })}
                    />
                  </div>
                  <p className="mt-2 fs-12 text-slate-400">
                    Usaha:{' '}
                    {s.usahaMode === 'final'
                      ? 'PPh final 0,5% — tidak dihitung lagi di sini.'
                      : s.usahaMode === 'pembukuan'
                        ? `laba ${formatIDR(spt.netoUsaha)} ikut dihitung.`
                        : 'tidak ada.'}{' '}
                    <button type="button" onClick={() => setTab('umkm')} className="font-bold text-indigo-600">
                      Ubah
                    </button>
                  </p>
                </Card>
                <Card title="3. Pengurang" icon={HandCoins}>
                  <Field
                    label="Zakat lewat BAZNAS / LAZ resmi"
                    hint={
                      s.zakat === null
                        ? `Saran dari catatan berkata "zakat": ${formatIDR(auto.zakat)}`
                        : 'Hanya yang punya bukti setor resmi.'
                    }
                    value={zakat}
                    onChange={(v) => update({ zakat: v })}
                    auto={s.zakat === null}
                  />
                </Card>
              </div>

              <div className="space-y-5">
                <Card title="4. Hasil perhitungan" icon={Receipt}>
                  {s.karyawan && (
                    <>
                      <Line k="Penghasilan bruto gaji" v={spt.brutoGaji} />
                      <Line k={`Biaya jabatan 5% (maks ${short(BIAYA_JABATAN_MAKS)})`} v={-spt.biayaJabatan} />
                      {spt.iuran > 0 && <Line k="Iuran pensiun / JHT" v={-spt.iuran} />}
                      <Line k="Neto dari gaji" v={spt.netoGaji} bold />
                    </>
                  )}
                  {spt.netoUsaha !== 0 && <Line k="Laba usaha (pembukuan)" v={spt.netoUsaha} />}
                  {spt.lain > 0 && <Line k="Penghasilan neto lain" v={spt.lain} />}
                  {spt.zakat > 0 && <Line k="Zakat resmi" v={-spt.zakat} />}
                  <Line k="Penghasilan neto" v={spt.neto} bold />
                  <Line k={`PTKP (${s.status}/${s.tanggungan})`} v={-spt.ptkp} />
                  <Line k="Penghasilan kena pajak (dibulatkan ribuan)" v={spt.pkp} bold />
                  <div className="my-3 space-y-1.5 rounded-2xl bg-slate-50 p-3">
                    {spt.lapisan.length ? (
                      spt.lapisan.map((l) => (
                        <div key={l.min} className="flex justify-between fs-12.5 text-slate-600">
                          <span>
                            {Math.round(l.rate * 100)}% × {short(l.kena)}
                          </span>
                          <span className="tabular-nums">{formatIDR(l.pajak)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="fs-12.5 text-slate-500">PKP nol — penghasilan di bawah PTKP.</p>
                    )}
                  </div>
                  <Line k="PPh terutang (Pasal 17)" v={spt.pphTerutang} bold />
                  <Line k="Kredit pajak (PPh 21 dipotong)" v={-spt.kredit} />
                  <motion.div
                    key={spt.status}
                    initial={reduce ? false : { scale: 0.97, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={cn(
                      'mt-3 flex items-center justify-between rounded-2xl px-4 py-3.5',
                      spt.status === 'kurang'
                        ? 'bg-amber-50 text-amber-900'
                        : spt.status === 'lebih'
                          ? 'bg-emerald-50 text-emerald-900'
                          : 'bg-indigo-50 text-indigo-900',
                    )}
                  >
                    <span className="fs-14 font-extrabold">
                      {spt.status === 'kurang' ? 'Kurang bayar' : spt.status === 'lebih' ? 'Lebih bayar' : 'Nihil'}
                    </span>
                    <span className="fsh-22 font-extrabold tabular-nums">{formatIDR(Math.abs(spt.selisih))}</span>
                  </motion.div>
                  <CopyBox spt={spt} s={s} />
                </Card>
                <Card title="Dokumen yang perlu disiapkan" icon={BadgeCheck}>
                  <ul className="space-y-1.5">
                    {docs.map((d) => (
                      <li key={d.key}>
                        <button
                          type="button"
                          onClick={() => update({ dokumen: { ...s.dokumen, [d.key]: !s.dokumen[d.key] } })}
                          className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left fs-13 hover:bg-slate-50"
                        >
                          <span
                            className={cn(
                              'flex h-5 w-5 shrink-0 items-center justify-center rounded-md ring-1 transition',
                              s.dokumen[d.key]
                                ? 'bg-emerald-500 text-white ring-emerald-500'
                                : 'bg-white ring-slate-300',
                            )}
                          >
                            {s.dokumen[d.key] && <Check size={13} strokeWidth={3} />}
                          </span>
                          <span className={cn(s.dokumen[d.key] && 'text-slate-400 line-through')}>{d.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <label className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3.5 py-3 fs-14 font-bold">
                    SPT Tahunan {year} sudah saya laporkan
                    <Toggle
                      on={s.sptLapor}
                      onChange={(v) =>
                        update({ sptLapor: v, sptTanggal: v ? new Date().toISOString().slice(0, 10) : null })
                      }
                    />
                  </label>
                </Card>
              </div>
            </div>
          )}

          {tab === 'harta' && (
            <div className="grid gap-5 lg:grid-cols-3">
              <ListCard
                title="Harta"
                total={totalHarta}
                rows={harta.map((h) => ({ name: h.name, sub: h.type, value: h.value }))}
                tone="indigo"
              />
              <ListCard
                title="Utang"
                total={totalUtang}
                rows={utang.map((h) => ({ name: h.name, value: h.value }))}
                tone="rose"
              />
              <ListCard
                title="Piutang"
                total={totalPiutang}
                rows={piutang.map((h) => ({ name: h.name, value: h.value }))}
                tone="emerald"
              />
              <div className="lg:col-span-3">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-3xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-4 text-white">
                  <span className="fs-14 font-bold">Harta bersih (harta + piutang − utang)</span>
                  <span className="fsh-24 font-extrabold tabular-nums">
                    {formatIDR(totalHarta + totalPiutang - totalUtang)}
                  </span>
                </div>
                <p className="mt-2 fs-12 text-slate-400">
                  Di SPT, harta dilaporkan per 31 Desember dengan nilai perolehan; daftar ini memakai saldo & nilai
                  terkini sebagai bahan isian.
                </p>
              </div>
            </div>
          )}

          {tab === 'kalender' && (
            <Card title={`Tenggat pajak untuk tahun pajak ${year}`} icon={CalendarClock}>
              <ol className="relative space-y-3 border-l-2 border-slate-100 pl-5">
                {tenggat.map((t, i) => (
                  <motion.li
                    key={t.key}
                    initial={reduce ? false : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="relative"
                  >
                    <span
                      className={cn(
                        'absolute -left-[27px] top-3 h-3 w-3 rounded-full ring-4 ring-white',
                        t.done ? 'bg-emerald-500' : sisaHari(t.date) < 0 ? 'bg-rose-500' : 'bg-amber-400',
                      )}
                    />
                    <TenggatRow
                      t={t}
                      onToggle={
                        t.kind === 'umkm' && (t.amount ?? 0) > 0
                          ? () => {
                              const k = t.key.slice(5);
                              update({ umkmSetor: { ...s.umkmSetor, [k]: { paid: !s.umkmSetor[k]?.paid } } });
                            }
                          : t.kind === 'spt'
                            ? () =>
                                update({
                                  sptLapor: !s.sptLapor,
                                  sptTanggal: !s.sptLapor ? new Date().toISOString().slice(0, 10) : null,
                                })
                            : undefined
                      }
                    />
                  </motion.li>
                ))}
              </ol>
              <p className="mt-3 fs-12 text-slate-400">
                Tenggat yang jatuh di akhir pekan / tanggal merah otomatis digeser ke hari kerja berikutnya.
              </p>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ── Komponen kecil
function Chip({ tone, children }: { tone: 'amber' | 'emerald' | 'slate'; children: React.ReactNode }) {
  const c = {
    amber: 'bg-amber-100 text-amber-800',
    emerald: 'bg-emerald-100 text-emerald-800',
    slate: 'bg-slate-100 text-slate-600',
  }[tone];
  return <span className={cn('rounded-full px-3 py-1 fs-12 font-bold', c)}>{children}</span>;
}
function Countdown({ days }: { days: number }) {
  const late = days < 0;
  return (
    <span
      className={cn(
        'flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl leading-none',
        late
          ? 'bg-rose-100 text-rose-700'
          : days <= 7
            ? 'bg-amber-100 text-amber-800'
            : 'bg-indigo-100 text-indigo-700',
      )}
    >
      <span className="fs-17 font-extrabold tabular-nums">{Math.abs(days)}</span>
      <span className="fs-9.5 font-bold">{late ? 'lewat' : 'hari'}</span>
    </span>
  );
}
function Ring({ pct }: { pct: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 44 44" className="h-12 w-12 shrink-0 -rotate-90">
      <circle cx="22" cy="22" r={r} fill="none" stroke="#e2e8f0" strokeWidth="5" />
      <motion.circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke="#10b981"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - pct) }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  );
}
function Stat({ icon: Icon, label, value, sub }: { icon: typeof Info; label: string; value: number; sub: string }) {
  const v = useCountUp(value);
  return (
    <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-200/80 transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-18px_rgba(15,23,42,0.35)]">
      <p className="flex items-center gap-1.5 fs-12.5 font-bold text-slate-500">
        <Icon size={15} className="text-indigo-500" /> {label}
      </p>
      <p className="mt-1.5 fsh-22 font-extrabold tracking-tight tabular-nums">{formatIDR(Math.round(v))}</p>
      <p className="fs-12 text-slate-400">{sub}</p>
    </div>
  );
}
function Card({ title, icon: Icon, children }: { title: string; icon: typeof Info; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-5 ring-1 ring-slate-200/80 md:p-6">
      <h2 className="mb-4 flex items-center gap-2 fs-16 font-extrabold text-slate-900">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-violet-100 text-indigo-600">
          <Icon size={16} />
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}
function Line({ k, v, bold }: { k: string; v: number; bold?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-3 border-b border-dashed border-slate-100 py-1.5 fs-13.5',
        bold && 'font-extrabold',
      )}
    >
      <span className={bold ? 'text-slate-900' : 'text-slate-600'}>{k}</span>
      <span className={cn('tabular-nums', v < 0 ? 'text-rose-600' : 'text-slate-900')}>
        {v < 0 ? '−' : ''}
        {formatIDR(Math.abs(v))}
      </span>
    </div>
  );
}
function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'min-w-11 rounded-full px-4 py-2 fs-13 font-bold transition',
        on
          ? 'bg-indigo-600 text-white shadow-[0_8px_18px_-10px_rgba(79,70,229,0.9)]'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
      )}
    >
      {children}
    </button>
  );
}
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        'relative h-7 w-12 shrink-0 rounded-full transition-colors',
        on ? 'bg-emerald-500' : 'bg-slate-300',
      )}
    >
      <motion.span
        className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow"
        animate={{ left: on ? 22 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
      />
    </button>
  );
}
const fmt = (n: number) => (n ? n.toLocaleString('id-ID') : '');
function RupiahInput({
  value,
  onChange,
  edited,
}: {
  value: number;
  onChange: (v: number | null) => void;
  edited?: boolean;
}) {
  const [text, setText] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-1">
      <input
        inputMode="numeric"
        value={text ?? fmt(value)}
        placeholder="0"
        onFocus={() => setText(fmt(value))}
        onChange={(e) => setText(e.target.value.replace(/[^\d.]/g, ''))}
        onBlur={() => {
          const n = Number((text ?? '').replace(/\./g, ''));
          if (text !== null && text.trim() !== fmt(value))
            onChange(text.trim() === '' ? 0 : Number.isFinite(n) ? n : 0);
          setText(null);
        }}
        className={cn(
          'h-8 w-36 rounded-lg border px-2 text-right fs-13 tabular-nums',
          edited ? 'border-indigo-300 bg-indigo-50/60' : 'border-transparent bg-transparent hover:border-slate-200',
        )}
      />
      {edited && (
        <button
          type="button"
          title="Kembali ke angka otomatis"
          onClick={() => onChange(null)}
          className="fs-11 font-bold text-indigo-600"
        >
          auto
        </button>
      )}
    </span>
  );
}
function Field({
  label,
  hint,
  value,
  onChange,
  auto,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number | null) => void;
  auto?: boolean;
}) {
  const [text, setText] = useState<string | null>(null);
  return (
    <label className="block">
      <span className="block fs-13 font-semibold text-slate-600">{label}</span>
      <span className="mt-1 flex items-center gap-2">
        <span className="flex h-11 flex-1 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-indigo-400 focus-within:bg-white">
          <span className="mr-1.5 fs-13 text-slate-400">Rp</span>
          <input
            inputMode="numeric"
            value={text ?? fmt(value)}
            placeholder="0"
            onFocus={() => setText(fmt(value))}
            onChange={(e) => setText(e.target.value.replace(/[^\d.]/g, ''))}
            onBlur={() => {
              if (text !== null && text !== fmt(value)) onChange(Number(text.replace(/\./g, '')) || 0);
              setText(null);
            }}
            className="w-full bg-transparent fs-15 font-semibold tabular-nums outline-none"
          />
        </span>
        {auto === false && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="shrink-0 rounded-full bg-indigo-50 px-3 py-2 fs-12 font-bold text-indigo-700"
          >
            Otomatis
          </button>
        )}
      </span>
      {hint && <span className="mt-1 block fs-12 text-slate-400">{hint}</span>}
    </label>
  );
}
function TenggatRow({ t, onToggle }: { t: Tenggat; onToggle?: () => void }) {
  const d = sisaHari(t.date);
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl p-3 ring-1',
        t.done ? 'bg-slate-50 ring-slate-100' : 'bg-white ring-slate-200',
      )}
    >
      {t.done ? (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
          <Check size={20} strokeWidth={3} />
        </span>
      ) : (
        <Countdown days={d} />
      )}
      <span className="min-w-0 flex-1">
        <span className={cn('block fs-14 font-bold', t.done ? 'text-slate-400 line-through' : 'text-slate-900')}>
          {t.title}
        </span>
        <span className="block fs-12 text-slate-500">
          {tglID(t.date)}
          {t.amount ? ` · ${formatIDR(t.amount)}` : ''} · {t.sub}
        </span>
      </span>
      {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            'shrink-0 rounded-full px-3 py-1.5 fs-12 font-bold',
            t.done ? 'bg-slate-200 text-slate-600' : 'bg-indigo-600 text-white',
          )}
        >
          {t.done ? 'Batal' : 'Sudah'}
        </button>
      )}
    </div>
  );
}
function ListCard({
  title,
  total,
  rows,
  tone,
}: {
  title: string;
  total: number;
  rows: { name: string; sub?: string; value: number }[];
  tone: 'indigo' | 'rose' | 'emerald';
}) {
  const bar = {
    indigo: 'from-indigo-400 to-violet-500',
    rose: 'from-rose-400 to-pink-500',
    emerald: 'from-emerald-400 to-teal-500',
  }[tone];
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <section className="rounded-3xl bg-white p-5 ring-1 ring-slate-200/80">
      <div className="flex items-baseline justify-between">
        <h2 className="fs-16 font-extrabold">{title}</h2>
        <span className="fs-15 font-extrabold tabular-nums">{formatIDR(total)}</span>
      </div>
      <ul className="mt-3 max-h-80 space-y-2.5 overflow-y-auto pr-1">
        {rows.length ? (
          rows
            .slice()
            .sort((a, b) => b.value - a.value)
            .map((r, i) => (
              <li key={`${r.name}-${i}`}>
                <div className="flex justify-between gap-2 fs-13">
                  <span className="min-w-0 truncate font-semibold">
                    {r.name}
                    {r.sub && <span className="ml-1 font-normal text-slate-400">· {r.sub}</span>}
                  </span>
                  <span className="shrink-0 tabular-nums">{formatIDR(r.value)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn('h-full rounded-full bg-gradient-to-r', bar)}
                    style={{ width: `${Math.max(2, (Math.abs(r.value) / max) * 100)}%` }}
                  />
                </div>
              </li>
            ))
        ) : (
          <li className="fs-13 text-slate-400">Belum ada.</li>
        )}
      </ul>
    </section>
  );
}
function Warn({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 flex items-start gap-2 rounded-2xl bg-amber-50 p-3 fs-13 font-semibold text-amber-800">
      <AlertTriangle size={16} className="mt-px shrink-0" /> {children}
    </p>
  );
}
function Disclaimer() {
  return (
    <p className="flex items-start gap-2 rounded-2xl bg-slate-50 p-4 fs-12.5 leading-relaxed text-slate-500">
      <Info size={16} className="mt-px shrink-0 text-slate-400" />
      Angka di sini adalah estimasi dari catatanmu berdasarkan aturan umum (PTKP, tarif Pasal 17 UU HPP, biaya jabatan,
      PP 55/2022). Bukan nasihat pajak resmi — cocokkan dengan bukti potong & Coretax DJP, atau tanya Kring Pajak
      1500200.
    </p>
  );
}
function CopyBox({ spt, s }: { spt: ReturnType<typeof hitungSpt>; s: TaxSettings }) {
  const [done, setDone] = useState(false);
  const text = [
    `Status PTKP: ${s.status}/${s.tanggungan}`,
    s.karyawan ? `Penghasilan bruto: ${spt.brutoGaji}` : null,
    s.karyawan ? `Biaya jabatan: ${spt.biayaJabatan}` : null,
    spt.iuran ? `Iuran pensiun/JHT: ${spt.iuran}` : null,
    spt.netoUsaha ? `Laba usaha: ${spt.netoUsaha}` : null,
    spt.lain ? `Penghasilan neto lain: ${spt.lain}` : null,
    spt.zakat ? `Zakat: ${spt.zakat}` : null,
    `Penghasilan neto: ${spt.neto}`,
    `PTKP: ${spt.ptkp}`,
    `PKP: ${spt.pkp}`,
    `PPh terutang: ${spt.pphTerutang}`,
    `Kredit PPh 21: ${spt.kredit}`,
    `${spt.status === 'kurang' ? 'Kurang bayar' : spt.status === 'lebih' ? 'Lebih bayar' : 'Nihil'}: ${Math.abs(spt.selisih)}`,
  ]
    .filter(Boolean)
    .join('\n');
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          window.setTimeout(() => setDone(false), 1800);
        })
      }
      className="pajak-noprint mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-slate-900 py-3 fs-13 font-bold text-white hover:bg-slate-800"
    >
      {done ? <Check size={15} /> : <Copy size={15} />} {done ? 'Tersalin' : 'Salin angka untuk diisi di Coretax'}
    </button>
  );
}
