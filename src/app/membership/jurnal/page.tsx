"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { journalService, type JournalEntry, type Mood } from '@/lib/services/journalService';
import { LeoMascot, type LeoMood } from '@/components/mascot/LeoMascot';
import { useFeedback } from '@/components/ui/Feedback';

// Jurnal: satu halaman tiap hari — mood, satu kalimat, dan satu hal yang
// berarti — plus "tahun dalam titik" (365 titik berwarna sesuai mood).

const MOODS: { value: Mood; label: string; emoji: string; leo: LeoMood; dot: string; chip: string }[] = [
  { value: 1, label: 'Berat', emoji: '😣', leo: 'sad', dot: 'bg-slate-500', chip: 'bg-slate-100 text-slate-700' },
  { value: 2, label: 'Lesu', emoji: '😕', leo: 'sad', dot: 'bg-sky-400', chip: 'bg-sky-50 text-sky-700' },
  { value: 3, label: 'Biasa', emoji: '🙂', leo: 'idle', dot: 'bg-violet-300', chip: 'bg-violet-50 text-violet-700' },
  { value: 4, label: 'Baik', emoji: '😊', leo: 'idle', dot: 'bg-amber-400', chip: 'bg-amber-50 text-amber-700' },
  { value: 5, label: 'Mantap', emoji: '🤩', leo: 'happy', dot: 'bg-orange-500', chip: 'bg-orange-50 text-orange-700' },
];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];

const fmtDay = (day: string) =>
  new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${day}T12:00:00`));

export default function JurnalPage() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [today, setToday] = useState('');
  const [entries, setEntries] = useState<Map<string, JournalEntry> | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [day, setDay] = useState('');

  const load = useCallback(() => {
    journalService
      .list(year)
      .then((r) => {
        setToday(r.today);
        setEntries(new Map(r.items.map((e) => [e.day, e])));
        setDay((d) => d || r.today);
      })
      .catch(() => {
        setEntries(new Map());
        setUnavailable(true);
      });
  }, [year]);
  useEffect(load, [load]);

  const nowYear = today ? Number(today.slice(0, 4)) : new Date().getFullYear();
  const startOfYear = new Date(nowYear, 0, 1);
  const todayDate = today ? new Date(`${today}T12:00:00`) : new Date();
  const dayOfYear = Math.floor((+todayDate - +startOfYear) / 864e5) + 1;
  const daysInYear = new Date(nowYear, 1, 29).getMonth() === 1 ? 366 : 365;
  // Sisa hari setelah hari ini (hari ini tidak dihitung).
  const daysLeft = daysInYear - dayOfYear;

  const stats = useMemo(() => {
    const list = [...(entries?.values() ?? [])];
    const withMood = list.filter((e) => e.mood);
    const avg = withMood.length ? withMood.reduce((s, e) => s + (e.mood ?? 0), 0) / withMood.length : 0;
    return { count: list.length, avg };
  }, [entries]);

  const pad = (n: number) => String(n).padStart(2, '0');

  if (unavailable) {
    return (
      <div className="mx-auto max-w-xl rounded-[24px] border border-slate-100 bg-white p-8 text-center">
        <LeoMascot mood="sad" size={110} className="mx-auto" />
        <p className="mt-3 font-bold text-slate-900">Jurnal belum aktif</p>
        <p className="mt-1 text-sm text-slate-500">Fitur ini sedang disiapkan. Coba lagi nanti ya.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-12">
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-500">Hari lagi menuju {nowYear + 1}</p>
        <p className="text-7xl font-extrabold tracking-tight text-slate-900 tabular-nums">{daysLeft}</p>
        <p className="text-xs text-slate-400">hari ke-{dayOfYear} dari {daysInYear} · {Math.round((dayOfYear / daysInYear) * 100)}%</p>
      </div>

      {/* Halaman hari ini — di-reset tiap ganti hari / setelah tersimpan */}
      {day && entries && (
        <DayForm key={`${day}-${entries.get(day)?.updated_at ?? ''}`} day={day} today={today} entry={entries.get(day)} onSaved={load} />
      )}

      {/* Tahun dalam titik */}
      <div className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-sm md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setYear(year - 1)} aria-label="Tahun sebelumnya" className="rounded-xl p-1.5 text-slate-500 hover:bg-slate-100"><ChevronLeft size={16} /></button>
            <p className="font-bold text-slate-900">{year} dalam titik</p>
            <button type="button" onClick={() => setYear(year + 1)} disabled={year >= nowYear} aria-label="Tahun berikutnya" className="rounded-xl p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ChevronRight size={16} /></button>
          </div>
          <p className="text-xs text-slate-400">{stats.count} hari ditulis{stats.avg ? ` · rata-rata mood ${MOODS[Math.round(stats.avg) - 1]?.emoji}` : ''}</p>
        </div>
        <div className="mt-4 space-y-1.5 overflow-x-auto">
          {MONTHS.map((mLabel, mi) => {
            const days = new Date(year, mi + 1, 0).getDate();
            return (
              <div key={mLabel} className="flex items-center gap-2">
                <span className="w-8 shrink-0 text-[11px] font-semibold text-slate-400">{mLabel}</span>
                <div className="flex gap-[3px]">
                  {Array.from({ length: days }, (_, di) => {
                    const key = `${year}-${pad(mi + 1)}-${pad(di + 1)}`;
                    const e = entries?.get(key);
                    const future = today && key > today;
                    const m = e?.mood ? MOODS[e.mood - 1] : null;
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={Boolean(future)}
                        onClick={() => setDay(key)}
                        title={`${fmtDay(key)}${m ? ` · ${m.label}` : e ? ' · ditulis' : ''}`}
                        className={cn(
                          'h-3.5 w-3.5 shrink-0 rounded-full transition-transform hover:scale-125 disabled:hover:scale-100',
                          m ? m.dot : e ? 'bg-slate-800' : future ? 'bg-slate-100' : 'bg-slate-200',
                          key === today && 'ring-2 ring-orange-400 ring-offset-1',
                          key === day && key !== today && 'ring-2 ring-slate-900 ring-offset-1'
                        )}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          {MOODS.map((m) => (
            <span key={m.value} className="flex items-center gap-1.5"><span className={cn('h-3 w-3 rounded-full', m.dot)} /> {m.label}</span>
          ))}
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-slate-200" /> Belum ditulis</span>
        </div>
      </div>
    </div>
  );
}

function DayForm({ day, today, entry, onSaved }: { day: string; today: string; entry?: JournalEntry; onSaved: () => void }) {
  const { toast } = useFeedback();
  const [mood, setMood] = useState<Mood | null>(entry?.mood ?? null);
  const [note, setNote] = useState(entry?.note ?? '');
  const [highlight, setHighlight] = useState(entry?.highlight ?? '');
  const [saving, setSaving] = useState(false);
  const selectedMood = MOODS.find((m) => m.value === mood);

  const save = async () => {
    setSaving(true);
    try {
      await journalService.save(day, { mood, note, highlight });
      toast.success('Jurnal tersimpan.');
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Jurnal gagal disimpan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-[0_8px_30px_-18px_rgba(49,46,129,0.25)] md:p-7">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-extrabold text-slate-900">{day === today ? 'Gimana hari ini?' : 'Gimana hari itu?'}</p>
          <p className="text-sm capitalize text-slate-500">{fmtDay(day)}</p>
        </div>
        <LeoMascot mood={selectedMood?.leo ?? 'idle'} size={78} interactive />
      </div>

      <div className="mt-4 grid grid-cols-5 gap-2">
        {MOODS.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMood(mood === m.value ? null : m.value)}
            className={cn(
              'flex flex-col items-center gap-1 rounded-2xl py-3 transition-all',
              mood === m.value ? `${m.chip} scale-105 ring-2 ring-current` : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
            )}
          >
            <span className="text-2xl">{m.emoji}</span>
            <span className="text-xs font-bold">{m.label}</span>
          </button>
        ))}
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder="Satu kalimat sudah cukup."
        className="mt-4 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:bg-white"
      />
      <p className="mt-3 text-xs font-semibold text-slate-500">Satu hal yang berarti</p>
      <input
        value={highlight}
        onChange={(e) => setHighlight(e.target.value)}
        maxLength={500}
        placeholder="Momen, kemenangan kecil, seseorang…"
        className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:bg-white"
      />
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="flex items-center gap-1 text-xs text-slate-400">
          {entry ? <><Check size={13} className="text-emerald-500" /> Sudah ditulis · tersimpan di akunmu</> : 'Tersimpan di akunmu, sama di semua perangkat.'}
        </span>
        <button type="button" onClick={save} disabled={saving} className="rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50">
          {saving ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </div>
  );
}
