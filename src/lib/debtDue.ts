// Jatuh tempo hutang/piutang (opsional), disimpan server di payload_json.due:
// { date: "YYYY-MM-DD" } sekali bayar, atau { day: 1–31 } tiap bulan (cicilan).
// Rumus tanggal berikutnya sama dengan nextDebtDue di Worker (pengingat H-3/H-1).
import { toLocalDateString } from '@/lib/utils';

export type DebtDue = { date: string } | { day: number };

export const dueFromPayload = (raw: unknown): DebtDue | undefined => {
  if (typeof raw !== 'string' || !raw.includes('"due"')) return undefined;
  try {
    const d = (JSON.parse(raw) as { due?: { date?: unknown; day?: unknown } }).due;
    if (d && typeof d.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.date)) return { date: d.date };
    if (d && typeof d.day === 'number' && d.day >= 1 && d.day <= 31) return { day: d.day };
  } catch {
    /* payload_json rusak — abaikan */
  }
  return undefined;
};

/** Tanggal jatuh tempo berikutnya (YYYY-MM-DD), null kalau sekali bayar & sudah lewat. */
export const nextDueDate = (due: DebtDue, today = toLocalDateString()): string | null => {
  if ('date' in due) return due.date >= today ? due.date : null;
  const [y, m] = today.split('-').map(Number);
  const at = (yy: number, mm: number) => {
    const last = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
    return `${yy}-${String(mm).padStart(2, '0')}-${String(Math.min(due.day, last)).padStart(2, '0')}`;
  };
  const thisMonth = at(y, m);
  return thisMonth >= today ? thisMonth : m === 12 ? at(y + 1, 1) : at(y, m + 1);
};

const DAY = 86400e3;
export const daysUntil = (dateStr: string, today = toLocalDateString()) =>
  Math.round((Date.parse(`${dateStr}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);

const short = (dateStr: string) =>
  new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${dateStr}T00:00:00Z`),
  );

/** Teks singkat untuk daftar/detail, mis. "Jatuh tempo besok (5 Des)". */
export const dueLabel = (
  due: DebtDue,
  today = toLocalDateString(),
): { text: string; urgent: boolean; overdue: boolean } => {
  const next = nextDueDate(due, today);
  if (!next)
    return { text: `Lewat jatuh tempo (${short((due as { date: string }).date)})`, urgent: true, overdue: true };
  const n = daysUntil(next, today);
  const when = n === 0 ? 'hari ini' : n === 1 ? 'besok' : n <= 7 ? `${n} hari lagi` : short(next);
  const prefix = 'day' in due ? `Tiap tgl ${due.day} · ` : '';
  return {
    text: `${prefix}Jatuh tempo ${when}${n >= 1 && n <= 7 ? ` (${short(next)})` : ''}`,
    urgent: n <= 3,
    overdue: false,
  };
};
