'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFinance } from '@/components/kanvas/useFinance';
import { canvasService, type CanvasMeta } from '@/lib/kanvas/service';
import { subscriptionService } from '@/lib/services/subscriptionService';
import { recurringService, type RecurringTransaction } from '@/lib/services/recurringService';
import { computeRapor } from '@/lib/rapor';
import { isIncome, isSpend, rp, short } from '@/lib/kanvas/data';
import { toLocalDateString } from '@/lib/utils';

export type Status = { text: string; tone?: 'good' | 'warn' | 'bad'; progress?: number; spark?: number[] };
export type Saran = { key: string; title: string; text: string; href: string; tone: 'good' | 'warn' | 'info' };

type Sub = { amount: number; cycle: string; status?: string };
const PER_MONTH: Record<string, number> = { mingguan: 52 / 12, bulanan: 1, '3bulan': 1 / 3, tahunan: 1 / 12 };
const SHORT_MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// Status singkat per fitur dari data user sendiri. Semua sumber opsional: yang gagal dimuat
// cukup kembali ke subjudul biasa, halaman tetap tampil.
export function useFiturStatus() {
  const fin = useFinance();
  const [canvases, setCanvases] = useState<CanvasMeta[] | null>(null);
  const [subs, setSubs] = useState<Sub[] | null>(null);
  const [rutin, setRutin] = useState<RecurringTransaction[] | null>(null);
  const [focusDays, setFocusDays] = useState<string[] | null>(null);

  useEffect(() => {
    let alive = true;
    canvasService
      .list()
      .then((v) => alive && setCanvases(v))
      .catch(() => alive && setCanvases([]));
    subscriptionService
      .list()
      .then((v) => alive && setSubs(v as Sub[]))
      .catch(() => alive && setSubs([]));
    recurringService
      .listMine()
      .then((v) => alive && setRutin(v))
      .catch(() => alive && setRutin([]));
    fetch('/api/member/focus', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then(
        (d: { items?: { date?: string }[] }) =>
          alive && setFocusDays([...new Set((d.items ?? []).map((x) => x.date ?? ''))]),
      )
      .catch(() => alive && setFocusDays([]));
    return () => {
      alive = false;
    };
  }, []);

  return useMemo(() => {
    const st: Record<string, Status> = {};
    const saran: Saran[] = [];
    const now = new Date();
    const today = toLocalDateString(now);
    const month = today.slice(0, 7);
    if (fin) {
      const { tx, accounts, metrics: m } = fin;
      const dayKey = (d: Date | string) => toLocalDateString(new Date(d));
      const todayCount = tx.filter((t) => dayKey(t.date) === today).length;
      const monthTx = tx.filter((t) => dayKey(t.date).startsWith(month));
      const outMonth = monthTx.filter(isSpend).reduce((s, t) => s + (Number(t.amountIDR) || Number(t.amount) || 0), 0);
      const inMonth = monthTx.filter(isIncome).reduce((s, t) => s + (Number(t.amountIDR) || Number(t.amount) || 0), 0);
      const spark = Array.from({ length: 7 }, (_, i) => {
        const d = toLocalDateString(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + i));
        return tx
          .filter((t) => isSpend(t) && dayKey(t.date) === d)
          .reduce((s, t) => s + (Number(t.amountIDR) || Number(t.amount) || 0), 0);
      });
      st.catat = todayCount
        ? { text: `Hari ini ${todayCount} catatan`, tone: 'good' }
        : { text: 'Belum ada catatan hari ini', tone: 'warn' };
      st.riwayat = { text: `${monthTx.length} transaksi bulan ini` };
      st.laporan = { text: `Keluar ${short(outMonth)} · masuk ${short(inMonth)}`, spark };
      st.rekening = { text: `${accounts.length} rekening · ${short(m.cash)}` };
      if (m.topExpenses[0]) st.jejak = { text: `Terbesar: ${m.topExpenses[0].name}` };
      if (m.ready) {
        st.kekayaan = { text: `Bersih ${rp(m.net)}`, tone: m.net >= 0 ? 'good' : 'bad' };
        st.investasi = { text: m.investments ? `Nilai ${rp(m.investments)}` : 'Belum ada investasi' };
        const rapor = computeRapor(tx, m);
        st.cek =
          rapor.score !== null && rapor.grade
            ? {
                text: `Nilai ${rapor.score} · ${rapor.grade.letter} ${rapor.grade.label.toLowerCase()}`,
                tone: rapor.score >= 70 ? 'good' : rapor.score >= 55 ? 'warn' : 'bad',
                progress: rapor.score / 100,
              }
            : { text: 'Catat dulu, nilainya langsung muncul' };
      }
      if (!todayCount)
        saran.push({
          key: 'catat',
          title: 'Catat hari ini',
          text: 'Belum ada catatan hari ini. Catat sekarang selagi ingat.',
          href: '/membership/transactions/input',
          tone: 'info',
        });
      if (m.months && m.emergencyMonths !== null && m.emergencyMonths < 3)
        saran.push({
          key: 'cek',
          title: 'Dana darurat masih tipis',
          text: `Cukup untuk ±${m.emergencyMonths.toLocaleString('id-ID', { maximumFractionDigits: 1 })} bulan pengeluaran. Pedomannya minimal 3×.`,
          href: '/membership/cek-keuangan',
          tone: 'warn',
        });
      if (m.months && m.leftAvg < 0)
        saran.push({
          key: 'jejak',
          title: 'Pengeluaran melebihi pemasukan',
          text: 'Lihat ke mana saja uangmu pergi bulan-bulan ini.',
          href: '/membership/jejak-uang',
          tone: 'warn',
        });
    }
    if (canvases) {
      st.kanvas = canvases.length
        ? { text: `${canvases.length} kanvas · ${canvases[0].title}` }
        : { text: 'Mulai rencana pertamamu' };
      if (canvases[0])
        saran.push({
          key: 'kanvas',
          title: `Lanjutkan ${canvases[0].title}`,
          text: 'Rencanamu tersimpan, tinggal lanjut dari bab terakhir.',
          href: `/membership/kanvas?id=${canvases[0].id}`,
          tone: 'info',
        });
    }
    if (subs) {
      const aktif = subs.filter((x) => x.status !== 'batal');
      const per = aktif.reduce((s, x) => s + (Number(x.amount) || 0) * (PER_MONTH[x.cycle] ?? 1), 0);
      st.langganan = aktif.length
        ? { text: `${aktif.length} aktif · ${short(per)}/bln` }
        : { text: 'Belum ada langganan dicatat' };
    }
    if (rutin) {
      const next = rutin
        .filter((r) => r.status === 'ACTIVE' && !Number.isNaN(r.nextDate.getTime()))
        .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime())[0];
      st.rutin = next
        ? { text: `Berikutnya: ${next.name} · ${next.nextDate.getDate()} ${SHORT_MONTH[next.nextDate.getMonth()]}` }
        : { text: 'Belum ada transaksi rutin' };
    }
    if (focusDays) {
      const set = new Set(focusDays);
      let streak = 0;
      for (let i = set.has(today) ? 0 : 1; ; i++) {
        const d = toLocalDateString(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
        if (!set.has(d)) break;
        streak++;
      }
      st.fokus = streak
        ? { text: `🔥 ${streak} hari berturut-turut`, tone: 'good' }
        : { text: set.has(today) ? 'Sudah fokus hari ini' : 'Belum fokus hari ini' };
    }
    if (!saran.length)
      saran.push({
        key: 'cek',
        title: 'Cek kesehatan keuanganmu',
        text: 'Lima pemeriksaan sederhana dari catatanmu sendiri.',
        href: '/membership/cek-keuangan',
        tone: 'good',
      });
    return { status: st, saran: saran.slice(0, 3), loading: !fin };
  }, [fin, canvases, subs, rutin, focusDays]);
}
