// Siklus tagihan kartu kredit — fungsi murni tanpa dependensi supaya dipakai
// bersama oleh frontend (Kartu Saya, Dashboard) dan cron Worker (pengingat
// jatuh tempo). Semua tanggal berupa string kalender "YYYY-MM-DD" (WIB di
// Worker, tanggal lokal device di browser) — tanpa jam, tanpa zona waktu.

export interface CardCycleSettings {
  /** Tanggal cetak tagihan tiap bulan (1–28). */
  statementDay?: number;
  /** Tanggal jatuh tempo tiap bulan (1–28), selalu SETELAH tanggal cetak. */
  dueDay?: number;
  /** Persen pembayaran minimum dari tagihan (mis. 10). */
  minPaymentPercent?: number;
  /** Batas bawah pembayaran minimum dalam mata uang kartu (mis. 50000). */
  minPaymentAmount?: number;
}

/** Arus uang di rekening kartu: delta > 0 menambah terpakai (belanja), < 0 mengurangi (pembayaran). */
export interface CardFlow {
  date: string;
  delta: number;
}

export interface CardCycle {
  statementDate: string;
  nextStatementDate: string;
  dueDate: string;
  daysUntilDue: number;
  /** Sisa tagihan periode tercetak yang belum dibayar. */
  amountDue: number;
  minPayment: number;
  overdue: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => {
  // m 0-based, boleh di luar 0..11 (Date.UTC yang merapikan).
  const date = new Date(Date.UTC(y, m, d));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};
const parts = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return { y, m: m - 1, d };
};

export const clampCycleDay = (day: number | undefined): number | undefined => {
  if (day === undefined || day === null || !Number.isFinite(Number(day))) return undefined;
  return Math.min(28, Math.max(1, Math.round(Number(day))));
};

export const daysBetween = (from: string, to: string) => {
  const a = parts(from);
  const b = parts(to);
  return Math.round((Date.UTC(b.y, b.m, b.d) - Date.UTC(a.y, a.m, a.d)) / 86400000);
};

/** Tanggal cetak terakhir yang <= today. */
export const lastStatementDate = (today: string, statementDay: number) => {
  const t = parts(today);
  return t.d >= statementDay ? ymd(t.y, t.m, statementDay) : ymd(t.y, t.m - 1, statementDay);
};

/** Jatuh tempo untuk tagihan yang dicetak pada statementDate: tanggal dueDay pertama SETELAH tanggal cetak. */
export const dueDateFor = (statementDate: string, dueDay: number) => {
  const s = parts(statementDate);
  return dueDay > s.d ? ymd(s.y, s.m, dueDay) : ymd(s.y, s.m + 1, dueDay);
};

export const isCycleConfigured = (settings: CardCycleSettings | undefined) =>
  Boolean(clampCycleDay(settings?.statementDay) && clampCycleDay(settings?.dueDay));

/**
 * usedNow   : tagihan terpakai saat ini (positif).
 * flows     : arus rekening kartu (belanja +, pembayaran −) — cukup yang
 *             terjadi SETELAH tanggal cetak terakhir, sisanya diabaikan.
 * Tagihan tercetak yang masih harus dibayar = terpakai sekarang − belanja
 * sejak tanggal cetak (belanja baru masuk tagihan bulan depan, pembayaran
 * langsung mengurangi tagihan tercetak).
 */
export const computeCardCycle = (
  usedNow: number,
  flows: CardFlow[],
  settings: CardCycleSettings | undefined,
  today: string
): CardCycle | null => {
  const statementDay = clampCycleDay(settings?.statementDay);
  const dueDay = clampCycleDay(settings?.dueDay);
  if (!statementDay || !dueDay) return null;

  const statementDate = lastStatementDate(today, statementDay);
  const s = parts(statementDate);
  const nextStatementDate = ymd(s.y, s.m + 1, statementDay);
  const dueDate = dueDateFor(statementDate, dueDay);

  const spendSinceStatement = flows
    .filter((f) => f.date.slice(0, 10) > statementDate && f.delta > 0)
    .reduce((sum, f) => sum + f.delta, 0);
  const amountDue = Math.max(0, Math.round((usedNow - spendSinceStatement) * 100) / 100);

  const pct = Math.max(0, Number(settings?.minPaymentPercent ?? 10));
  const floor = Math.max(0, Number(settings?.minPaymentAmount ?? 0));
  const minPayment = amountDue <= 0 ? 0 : Math.min(amountDue, Math.max(floor, Math.ceil((amountDue * pct) / 100)));

  const daysUntilDue = daysBetween(today, dueDate);
  return {
    statementDate,
    nextStatementDate,
    dueDate,
    daysUntilDue,
    amountDue,
    minPayment,
    overdue: daysUntilDue < 0 && amountDue > 0,
  };
};
