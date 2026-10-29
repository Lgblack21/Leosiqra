"use client";

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeftRight, Award, ExternalLink, LineChart, Receipt, ShieldAlert, ShieldCheck, TrendingDown } from 'lucide-react';
import { BI_RATE, LPS, SBN_RETAIL, TAX_DEPOSITO, TAX_SBN, monthlyNet } from '@/lib/sbnData';
import { formatIDR } from '@/lib/utils';

// Tab Belajar: materi singkat & stabil (aturan, bukan harga). Contoh angka
// diambil dari lib/sbnData supaya ikut terbarui bersama tab SBN.

const pct = (n: number) => `${n.toLocaleString('id-ID', { maximumFractionDigits: 2 })}%`;
// Kelas ditulis utuh supaya terbaca Tailwind (bukan dirakit dari string).
const DOT: Record<string, string> = {
  'bg-teal-50 text-teal-600': 'bg-teal-500',
  'bg-orange-50 text-orange-600': 'bg-orange-500',
  'bg-blue-50 text-blue-600': 'bg-blue-500',
  'bg-slate-100 text-slate-600': 'bg-slate-400',
  'bg-violet-50 text-violet-600': 'bg-violet-500',
  'bg-rose-50 text-rose-600': 'bg-rose-500',
  'bg-red-50 text-red-600': 'bg-red-500',
};
type Card = { icon: typeof Award; tone: string; title: string; points: string[]; extra?: React.ReactNode; links: { label: string; url: string }[]; wide?: boolean };

export function TabBelajar() {
  const reduce = useReducedMotion();
  const floating = SBN_RETAIL.find((s) => s.floating);
  const top = SBN_RETAIL[0];

  const cards: Card[] = [
    {
      icon: Award,
      tone: 'bg-teal-50 text-teal-600',
      title: 'SBN itu apa?',
      points: [
        'Surat Berharga Negara: kamu meminjamkan uang ke negara. Negara membayar kupon tiap bulan dan mengembalikan pokoknya saat jatuh tempo.',
        'Pokok dan kuponnya dijamin undang-undang — negara wajib membayarnya.',
        'SBN ritel bisa dibeli mulai Rp1 juta lewat bank atau aplikasi mitra distribusi, saat masa penawaran.',
        'Empat jenis: ORI & SBR (konvensional), SR & ST (syariah).',
      ],
      links: [{ label: 'DJPPR · SBN Ritel', url: 'https://www.djppr.kemenkeu.go.id/sbnritel' }],
    },
    {
      icon: LineChart,
      tone: 'bg-orange-50 text-orange-600',
      title: 'Kupon tetap atau mengambang',
      points: [
        'ORI dan SR: kuponnya tetap sampai jatuh tempo.',
        'SBR dan ST: kupon = BI-Rate + spread, disesuaikan tiap tiga bulan.',
        'Kupon awalnya jadi batas bawah — kalau BI-Rate turun, kupon tidak ikut turun di bawahnya.',
      ],
      extra: floating ? (
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-[11px] font-semibold text-slate-500">{floating.code}</p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[14px] font-bold">
            <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">BI {pct(BI_RATE.rate)}</span> +
            <span className="rounded-full bg-teal-50 px-2.5 py-1 text-teal-700">spread {pct(Math.round((floating.coupon - BI_RATE.rate) * 100) / 100)}</span> =
            <span className="text-[17px] text-slate-900">{pct(floating.coupon)}</span>
          </p>
        </div>
      ) : undefined,
      links: [{ label: 'DJPPR · SBN Ritel', url: 'https://www.djppr.kemenkeu.go.id/sbnritel' }],
    },
    {
      icon: ArrowLeftRight,
      tone: 'bg-blue-50 text-blue-600',
      title: 'Butuh uangnya sebelum jatuh tempo?',
      points: [
        'ORI dan SR bisa dijual di pasar sekunder setelah lewat masa tahan minimal (satu kali kupon).',
        'Harganya bisa di atas atau di bawah 100% nominal, tergantung pasar hari itu.',
        'SBR dan ST tidak bisa dijual, tapi sebagian bisa dicairkan lebih awal (early redemption) di tanggal yang sudah ditentukan.',
      ],
      links: [{ label: 'DJPPR · SBN Ritel', url: 'https://www.djppr.kemenkeu.go.id/sbnritel' }],
    },
    {
      icon: Receipt,
      tone: 'bg-slate-100 text-slate-600',
      title: `Pajaknya: ${TAX_SBN}% atau ${TAX_DEPOSITO}%`,
      points: [
        `Kupon SBN kena PPh final ${TAX_SBN}%, langsung dipotong.`,
        `Bunga deposito dan tabungan kena PPh final ${TAX_DEPOSITO}%. Simpanan sampai Rp7,5 juta tidak dipotong.`,
      ],
      extra: top ? (
        <div className="space-y-2 rounded-2xl bg-slate-50 p-3">
          <p className="text-[11px] font-semibold text-slate-500">Rp10 jt sebulan, setelah pajak</p>
          {[
            { label: `${top.code} · ${pct(top.coupon)}`, value: monthlyNet(10_000_000, top.coupon, TAX_SBN), color: '#0d9488' },
            { label: `Deposito · ${pct(LPS.bankUmum)}`, value: monthlyNet(10_000_000, LPS.bankUmum, TAX_DEPOSITO), color: '#94a3b8' },
          ].map((r, i, arr) => (
            <div key={r.label}>
              <div className="flex justify-between text-[13px]"><span className="text-slate-700">{r.label}</span><span className="font-bold text-slate-900 tabular-nums">{formatIDR(r.value)}</span></div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-white">
                <motion.div initial={reduce ? false : { width: 0 }} whileInView={{ width: `${(r.value / Math.max(...arr.map((x) => x.value))) * 100}%` }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="h-full rounded-full" style={{ background: r.color }} />
              </div>
            </div>
          ))}
        </div>
      ) : undefined,
      links: [{ label: 'PP 91/2021', url: 'https://peraturan.bpk.go.id/Details/174835/pp-no-91-tahun-2021' }],
    },
    {
      icon: ShieldCheck,
      tone: 'bg-violet-50 text-violet-600',
      title: 'Jaminan LPS untuk tabunganmu',
      points: [
        `LPS menjamin simpanan di bank sampai Rp${(LPS.maxCover / 1e9).toLocaleString('id-ID')} miliar per nasabah per bank.`,
        'Syaratnya 3T: tercatat di pembukuan bank, bunganya tidak melebihi bunga penjaminan LPS, dan tidak melakukan tindakan yang merugikan bank.',
        'Simpanan dengan bunga di atas bunga penjaminan tidak dijamin sama sekali — pokok maupun bunganya.',
      ],
      extra: (
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 text-center">
          {[['Bank umum', LPS.bankUmum], ['BPR', LPS.bpr], ['Valas', LPS.valas]].map(([l, v]) => (
            <div key={l as string}><p className="text-[11px] text-slate-500">{l}</p><p className="text-[18px] font-extrabold text-slate-900">{pct(v as number)}</p></div>
          ))}
        </div>
      ),
      links: [{ label: 'LPS · Bunga penjaminan', url: LPS.source }],
    },
    {
      icon: TrendingDown,
      tone: 'bg-rose-50 text-rose-600',
      title: 'Suku bunga naik, harga obligasi turun',
      points: [
        'Harga obligasi bergerak berlawanan dengan suku bunga: bunga naik → harga obligasi yang sudah beredar turun, dan sebaliknya.',
        'Ini penting kalau kamu menjual ORI atau SR sebelum jatuh tempo. Kalau dipegang sampai jatuh tempo, negara mengembalikan pokoknya penuh.',
      ],
      links: [{ label: 'OJK · Sikapi Uangmu', url: 'https://sikapiuangmu.ojk.go.id' }],
    },
    {
      icon: ShieldAlert,
      tone: 'bg-red-50 text-red-600',
      title: 'Cek dulu sebelum pinjam atau investasi',
      points: [
        'Cek izinnya: Kontak OJK 157, WhatsApp 081-157-157-157, atau daftar entitas berizin di situs OJK.',
        'Ingat 2L dari OJK: Legal (punya izin) dan Logis (janji untungnya masuk akal). Untung besar yang pasti dan cepat itu tanda bahaya.',
        'Tawaran investasi atau pinjol ilegal bisa dilaporkan ke Satgas PASTI.',
      ],
      links: [{ label: 'OJK · Sikapi Uangmu', url: 'https://sikapiuangmu.ojk.go.id' }],
      wide: true,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {cards.map((c, i) => (
        <motion.section
          key={c.title}
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.4, delay: (i % 2) * 0.08 }}
          className={`space-y-3 rounded-[28px] bg-white p-5 ring-1 ring-slate-100${c.wide ? ' md:col-span-2' : ''}`}
        >
          <div className="flex items-center gap-3">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${c.tone}`}><c.icon size={20} /></span>
            <h3 className="text-[18px] font-bold tracking-tight text-slate-900">{c.title}</h3>
          </div>
          <ul className="space-y-2">
            {c.points.map((p) => (
              <li key={p} className="flex gap-2.5 text-[14px] leading-relaxed text-slate-700">
                <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${DOT[c.tone] ?? 'bg-slate-400'}`} />
                {p}
              </li>
            ))}
          </ul>
          {c.extra}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {c.links.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-900">
                <ExternalLink size={12} /> {l.label}
              </a>
            ))}
          </div>
        </motion.section>
      ))}
    </div>
  );
}
