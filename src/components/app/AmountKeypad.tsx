'use client';

import { useState } from 'react';
import { Delete, Divide, X as ClearIcon, Calculator } from 'lucide-react';
import { lightTap } from '@/lib/haptics';
import { evaluateExpression, CalcToken, CalcOperator } from '@/lib/calc/safeEval';

// Satu-satunya formatter tampilan nominal ("50000.5" -> "50,000.5"): dipakai keypad
// ini + label tombol submit di AddTransactionSheet.
export const groupDigits = (raw: string) => {
  if (!raw) return raw;
  const [intPart, decPart] = raw.split('.');
  const sign = intPart.startsWith('-') ? '-' : '';
  const digits = intPart.replace('-', '');
  const formattedInt = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart !== undefined ? `${sign}${formattedInt}.${decPart}` : `${sign}${formattedInt}`;
};

const OPERATORS: CalcOperator[] = ['÷', '×', '-', '+'];
const isOperatorToken = (t: CalcToken | undefined): t is CalcOperator =>
  t !== undefined && (OPERATORS as string[]).includes(t);

interface AmountKeypadProps {
  value: string;
  onChange: (value: string) => void;
  currencySymbol?: string;
  /** "flat": tombol datar tanpa kotak & tanpa baris nominal (nominal tampil di
   * panel atas AddTransactionSheet); baris kalkulator hanya saat mode kalkulator. */
  variant?: 'default' | 'flat';
  /** Mode kalkulator dikendalikan dari luar (tombol di panel atas). */
  calculator?: boolean;
  onCalculatorChange?: (on: boolean) => void;
  /** Varian flat: tombol kiri bawah "000" (mata uang tanpa sen) atau "." */
  thousandKey?: boolean;
}

export function AmountKeypad({
  value,
  onChange,
  currencySymbol = 'Rp',
  variant = 'default',
  calculator,
  onCalculatorChange,
  thousandKey = true,
}: AmountKeypadProps) {
  const [innerMode, setInnerMode] = useState<'keypad' | 'calculator'>('keypad');
  const mode: 'keypad' | 'calculator' = calculator === undefined ? innerMode : calculator ? 'calculator' : 'keypad';
  const setMode = (m: 'keypad' | 'calculator') =>
    onCalculatorChange ? onCalculatorChange(m === 'calculator') : setInnerMode(m);
  const [tokens, setTokens] = useState<CalcToken[]>(() => [value || '0']);
  // Kalkulator ditutup dari luar saat masih ada operator → kembali ke angka terakhir.
  const [syncedMode, setSyncedMode] = useState(mode);
  if (mode !== syncedMode) {
    setSyncedMode(mode);
    if (mode === 'keypad' && tokens.length > 1) setTokens([value || '0']);
  }

  const lastToken = tokens[tokens.length - 1];
  const lastIsOperator = isOperatorToken(lastToken);

  // Nilai bisa diubah dari luar (chip preset "Lunasi", reset form setelah
  // simpan) — samakan tampilan kalau beda dari angka yang sedang diketik.
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    const typed = lastIsOperator ? tokens[tokens.length - 2] : lastToken;
    if ((value || '0') !== (typed || '0')) setTokens([value || '0']);
  }

  const commit = (nextTokens: CalcToken[]) => {
    setTokens(nextTokens);
    const last = nextTokens[nextTokens.length - 1];
    if (!isOperatorToken(last)) {
      onChange(last || '0');
    }
  };

  const pressDigit = (digit: string) => {
    lightTap();
    const next = [...tokens];
    if (next.length === 0 || lastIsOperator) {
      next.push(digit === '.' ? '0.' : digit);
    } else {
      const current = next[next.length - 1];
      if (digit === '.' && current.includes('.')) return;
      next[next.length - 1] = current === '0' && digit !== '.' ? digit : current + digit;
    }
    commit(next);
  };

  // "000" — nominal rupiah hampir selalu ribuan. Tidak berlaku untuk 0 atau angka desimal.
  const pressThousand = () => {
    const current = lastIsOperator ? '' : (tokens[tokens.length - 1] ?? '');
    if (!current || current === '0' || current.includes('.') || current.length > 12) return;
    lightTap();
    const next = [...tokens];
    next[next.length - 1] = current + '000';
    commit(next);
  };

  const pressBackspace = () => {
    lightTap();
    const next = [...tokens];
    const current = next[next.length - 1] ?? '';
    if (current.length <= 1) {
      next.pop();
      if (next.length === 0) next.push('0');
    } else {
      next[next.length - 1] = current.slice(0, -1);
    }
    commit(next);
  };

  const pressOperator = (op: CalcOperator) => {
    lightTap();
    if (tokens.length === 0) return;
    const next = [...tokens];
    if (lastIsOperator) {
      next[next.length - 1] = op;
    } else {
      next.push(op);
    }
    setTokens(next);
  };

  const pressEquals = () => {
    lightTap();
    const result = evaluateExpression(tokens);
    if (result === null) return;
    const resultStr = String(Math.round(result * 100) / 100);
    setTokens([resultStr]);
    onChange(resultStr);
    setMode('keypad');
  };

  const pressClear = () => {
    lightTap();
    setTokens(['0']);
    onChange('0');
  };

  const toggleMode = () => {
    lightTap();
    if (mode === 'calculator') {
      const fallback = isOperatorToken(lastToken) ? (tokens[tokens.length - 2] ?? '0') : (lastToken ?? '0');
      setTokens([fallback]);
      onChange(fallback);
      setMode('keypad');
    } else {
      setMode('calculator');
    }
  };

  const display = tokens.map((t) => (isOperatorToken(t) ? ` ${t} ` : groupDigits(t))).join('');

  if (variant === 'flat') {
    const flatKey =
      'h-14 rounded-2xl fsh-24 font-semibold text-slate-900 dark:text-white tabular-nums flex items-center justify-center active:bg-slate-100 dark:active:bg-slate-800 transition-colors';
    const dimKey = flatKey + ' !fs-19 !text-slate-400 dark:!text-slate-500';
    if (mode === 'calculator') {
      return (
        <div className="px-4 pt-2">
          <p className="mb-1 truncate text-right text-sm font-bold text-slate-400 dark:text-slate-500 tabular-nums">
            {currencySymbol} {display}
          </p>
          <div className="grid grid-cols-4">
            {(['7', '8', '9'] as const).map((d) => (
              <button key={d} type="button" onClick={() => pressDigit(d)} className={flatKey}>
                {d}
              </button>
            ))}
            <button type="button" onClick={() => pressOperator('÷')} className={dimKey}>
              ÷
            </button>
            {(['4', '5', '6'] as const).map((d) => (
              <button key={d} type="button" onClick={() => pressDigit(d)} className={flatKey}>
                {d}
              </button>
            ))}
            <button type="button" onClick={() => pressOperator('×')} className={dimKey}>
              ×
            </button>
            {(['1', '2', '3'] as const).map((d) => (
              <button key={d} type="button" onClick={() => pressDigit(d)} className={flatKey}>
                {d}
              </button>
            ))}
            <button type="button" onClick={() => pressOperator('-')} className={dimKey}>
              −
            </button>
            <button type="button" onClick={() => pressDigit('.')} className={dimKey}>
              .
            </button>
            <button type="button" onClick={() => pressDigit('0')} className={flatKey}>
              0
            </button>
            <button type="button" onClick={pressEquals} className={dimKey + ' !text-indigo-600 dark:!text-indigo-400'}>
              =
            </button>
            <button type="button" onClick={() => pressOperator('+')} className={dimKey}>
              +
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-3 px-4 pt-1">
        {(['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const).map((d) => (
          <button key={d} type="button" onClick={() => pressDigit(d)} className={flatKey}>
            {d}
          </button>
        ))}
        {thousandKey ? (
          <button type="button" onClick={pressThousand} className={dimKey}>
            000
          </button>
        ) : (
          <button type="button" onClick={() => pressDigit('.')} className={dimKey}>
            .
          </button>
        )}
        <button type="button" onClick={() => pressDigit('0')} className={flatKey}>
          0
        </button>
        <button type="button" onClick={pressBackspace} aria-label="Hapus" className={dimKey}>
          <Delete size={22} />
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 pt-4 pb-3">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-3xl font-black text-slate-900 dark:text-white tabular-nums truncate">
          {currencySymbol} {display}
        </p>
        <button
          type="button"
          onClick={toggleMode}
          className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
            mode === 'calculator'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
          }`}
          aria-label="Mode kalkulator"
        >
          <Calculator size={17} />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {mode === 'calculator' ? (
          <>
            <KeyButton onClick={() => pressDigit('7')}>7</KeyButton>
            <KeyButton onClick={() => pressDigit('8')}>8</KeyButton>
            <KeyButton onClick={() => pressDigit('9')}>9</KeyButton>
            <KeyButton onClick={() => pressOperator('÷')} accent active={lastIsOperator && lastToken === '÷'}>
              <Divide size={16} />
            </KeyButton>

            <KeyButton onClick={() => pressDigit('4')}>4</KeyButton>
            <KeyButton onClick={() => pressDigit('5')}>5</KeyButton>
            <KeyButton onClick={() => pressDigit('6')}>6</KeyButton>
            <KeyButton onClick={() => pressOperator('×')} accent active={lastIsOperator && lastToken === '×'}>
              ×
            </KeyButton>

            <KeyButton onClick={() => pressDigit('1')}>1</KeyButton>
            <KeyButton onClick={() => pressDigit('2')}>2</KeyButton>
            <KeyButton onClick={() => pressDigit('3')}>3</KeyButton>
            <KeyButton onClick={() => pressOperator('-')} accent active={lastIsOperator && lastToken === '-'}>
              −
            </KeyButton>

            <KeyButton onClick={() => pressDigit('.')}>.</KeyButton>
            <KeyButton onClick={() => pressDigit('0')}>0</KeyButton>
            <KeyButton onClick={pressBackspace} muted>
              <Delete size={18} />
            </KeyButton>
            <KeyButton onClick={() => pressOperator('+')} accent active={lastIsOperator && lastToken === '+'}>
              +
            </KeyButton>

            <button
              type="button"
              onClick={pressEquals}
              className="col-span-4 py-3.5 rounded-xl bg-indigo-600 text-white font-black text-lg active:scale-[0.98] transition-transform"
            >
              =
            </button>
          </>
        ) : (
          <>
            <KeyButton onClick={() => pressDigit('1')}>1</KeyButton>
            <KeyButton onClick={() => pressDigit('2')}>2</KeyButton>
            <KeyButton onClick={() => pressDigit('3')}>3</KeyButton>
            <KeyButton onClick={pressClear} muted>
              <ClearIcon size={16} />
            </KeyButton>

            <KeyButton onClick={() => pressDigit('4')}>4</KeyButton>
            <KeyButton onClick={() => pressDigit('5')}>5</KeyButton>
            <KeyButton onClick={() => pressDigit('6')}>6</KeyButton>
            <KeyButton onClick={pressBackspace} muted>
              <Delete size={18} />
            </KeyButton>

            <KeyButton onClick={() => pressDigit('7')}>7</KeyButton>
            <KeyButton onClick={() => pressDigit('8')}>8</KeyButton>
            <KeyButton onClick={() => pressDigit('9')}>9</KeyButton>
            <div />

            <KeyButton onClick={() => pressDigit('.')}>.</KeyButton>
            <KeyButton onClick={() => pressDigit('0')}>0</KeyButton>
            <KeyButton onClick={pressThousand}>000</KeyButton>
            <div />
          </>
        )}
      </div>
    </div>
  );
}

function KeyButton({
  children,
  onClick,
  muted,
  accent,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  muted?: boolean;
  accent?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-3.5 rounded-xl font-black text-lg flex items-center justify-center active:scale-95 transition-transform ${
        active
          ? 'bg-indigo-600 text-white'
          : accent
            ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
            : muted
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              : 'bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white'
      }`}
    >
      {children}
    </button>
  );
}
