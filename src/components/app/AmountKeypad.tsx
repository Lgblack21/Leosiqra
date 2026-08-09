"use client";

import { useState } from "react";
import { Delete, Divide, X as ClearIcon, Calculator } from "lucide-react";
import { lightTap } from "@/lib/haptics";
import { evaluateExpression, CalcToken, CalcOperator } from "@/lib/calc/safeEval";

// Sama seperti formatter lama di AddTransactionSheet — "50000.5" -> "50,000.5".
// Sekarang jadi satu-satunya sumber format tampilan (dipakai keypad ini +
// preview label tombol submit di AddTransactionSheet), gak diduplikasi lagi.
export const groupDigits = (raw: string) => {
  if (!raw) return raw;
  const [intPart, decPart] = raw.split(".");
  const sign = intPart.startsWith("-") ? "-" : "";
  const digits = intPart.replace("-", "");
  const formattedInt = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined ? `${sign}${formattedInt}.${decPart}` : `${sign}${formattedInt}`;
};

const OPERATORS: CalcOperator[] = ["÷", "×", "-", "+"];
const isOperatorToken = (t: CalcToken | undefined): t is CalcOperator =>
  t !== undefined && (OPERATORS as string[]).includes(t);

interface AmountKeypadProps {
  value: string;
  onChange: (value: string) => void;
  currencySymbol?: string;
}

export function AmountKeypad({ value, onChange, currencySymbol = "Rp" }: AmountKeypadProps) {
  const [mode, setMode] = useState<"keypad" | "calculator">("keypad");
  const [tokens, setTokens] = useState<CalcToken[]>(() => [value || "0"]);

  const lastToken = tokens[tokens.length - 1];
  const lastIsOperator = isOperatorToken(lastToken);

  const commit = (nextTokens: CalcToken[]) => {
    setTokens(nextTokens);
    const last = nextTokens[nextTokens.length - 1];
    if (!isOperatorToken(last)) {
      onChange(last || "0");
    }
  };

  const pressDigit = (digit: string) => {
    lightTap();
    const next = [...tokens];
    if (next.length === 0 || lastIsOperator) {
      next.push(digit === "." ? "0." : digit);
    } else {
      const current = next[next.length - 1];
      if (digit === "." && current.includes(".")) return;
      next[next.length - 1] = current === "0" && digit !== "." ? digit : current + digit;
    }
    commit(next);
  };

  const pressBackspace = () => {
    lightTap();
    const next = [...tokens];
    const current = next[next.length - 1] ?? "";
    if (current.length <= 1) {
      next.pop();
      if (next.length === 0) next.push("0");
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
    setMode("keypad");
  };

  const pressClear = () => {
    lightTap();
    setTokens(["0"]);
    onChange("0");
  };

  const toggleMode = () => {
    lightTap();
    if (mode === "calculator") {
      const fallback = isOperatorToken(lastToken) ? tokens[tokens.length - 2] ?? "0" : lastToken ?? "0";
      setTokens([fallback]);
      onChange(fallback);
      setMode("keypad");
    } else {
      setMode("calculator");
    }
  };

  const display = tokens.map((t) => (isOperatorToken(t) ? ` ${t} ` : groupDigits(t))).join("");

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
            mode === "calculator"
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
          }`}
          aria-label="Mode kalkulator"
        >
          <Calculator size={17} />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {mode === "calculator" ? (
          <>
            <KeyButton onClick={() => pressDigit("7")}>7</KeyButton>
            <KeyButton onClick={() => pressDigit("8")}>8</KeyButton>
            <KeyButton onClick={() => pressDigit("9")}>9</KeyButton>
            <KeyButton onClick={() => pressOperator("÷")} accent active={lastIsOperator && lastToken === "÷"}>
              <Divide size={16} />
            </KeyButton>

            <KeyButton onClick={() => pressDigit("4")}>4</KeyButton>
            <KeyButton onClick={() => pressDigit("5")}>5</KeyButton>
            <KeyButton onClick={() => pressDigit("6")}>6</KeyButton>
            <KeyButton onClick={() => pressOperator("×")} accent active={lastIsOperator && lastToken === "×"}>
              ×
            </KeyButton>

            <KeyButton onClick={() => pressDigit("1")}>1</KeyButton>
            <KeyButton onClick={() => pressDigit("2")}>2</KeyButton>
            <KeyButton onClick={() => pressDigit("3")}>3</KeyButton>
            <KeyButton onClick={() => pressOperator("-")} accent active={lastIsOperator && lastToken === "-"}>
              −
            </KeyButton>

            <KeyButton onClick={() => pressDigit(".")}>.</KeyButton>
            <KeyButton onClick={() => pressDigit("0")}>0</KeyButton>
            <KeyButton onClick={pressBackspace} muted>
              <Delete size={18} />
            </KeyButton>
            <KeyButton onClick={() => pressOperator("+")} accent active={lastIsOperator && lastToken === "+"}>
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
            <KeyButton onClick={() => pressDigit("1")}>1</KeyButton>
            <KeyButton onClick={() => pressDigit("2")}>2</KeyButton>
            <KeyButton onClick={() => pressDigit("3")}>3</KeyButton>
            <KeyButton onClick={pressClear} muted>
              <ClearIcon size={16} />
            </KeyButton>

            <KeyButton onClick={() => pressDigit("4")}>4</KeyButton>
            <KeyButton onClick={() => pressDigit("5")}>5</KeyButton>
            <KeyButton onClick={() => pressDigit("6")}>6</KeyButton>
            <KeyButton onClick={pressBackspace} muted>
              <Delete size={18} />
            </KeyButton>

            <KeyButton onClick={() => pressDigit("7")}>7</KeyButton>
            <KeyButton onClick={() => pressDigit("8")}>8</KeyButton>
            <KeyButton onClick={() => pressDigit("9")}>9</KeyButton>
            <div />

            <KeyButton onClick={() => pressDigit(".")}>.</KeyButton>
            <KeyButton onClick={() => pressDigit("0")}>0</KeyButton>
            <div className="col-span-2" />
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
          ? "bg-indigo-600 text-white"
          : accent
          ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
          : muted
          ? "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
          : "bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
      }`}
    >
      {children}
    </button>
  );
}
