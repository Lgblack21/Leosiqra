import { Camera, Check, Mic, ScanLine, TrendingUp } from 'lucide-react';

// Kartu fitur Leosiqra yang melayang di latar /mulai & halaman masuk/daftar:
// suara jadi transaksi, scan struk, budget, saldo. Murni dekorasi (aria-hidden),
// nominalnya contoh — bukan data siapa pun.
const chip = 'paper-float rounded-[22px] bg-white/90 p-4 shadow-[0_24px_48px_-20px_rgba(49,46,129,0.45)] ring-1 ring-white backdrop-blur';
const float = (r: string, delay = '0s') => ({ '--r': r, animationDelay: delay }) as React.CSSProperties;

export function VoiceChip({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`${chip} w-60 ${className}`} style={float('-3deg')}>
      <div className="flex items-center gap-3">
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
          <span className="absolute inset-0 animate-ping rounded-full bg-indigo-500/30" />
          <Mic size={17} />
        </span>
        <div className="flex h-7 flex-1 items-center gap-[3px]">
          {[40, 75, 55, 95, 60, 85, 35, 70, 50, 90, 45, 65].map((h, i) => (
            <span key={i} className="voice-bar w-[3px] rounded-full bg-indigo-400" style={{ height: `${h}%`, animationDelay: `${i * 0.08}s` }} />
          ))}
        </div>
      </div>
      <p className="mt-3 text-[14px] font-semibold text-slate-700">“parkir lima ribu”</p>
    </div>
  );
}

export function TxChip({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`${chip} w-64 ${className}`} style={float('2deg', '-2.5s')}>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white">
          <Check size={18} strokeWidth={3} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-slate-900">Parkir</p>
          <p className="text-[11px] font-bold text-emerald-600">Tercatat · Transportasi</p>
        </div>
        <p className="text-[14px] font-bold text-slate-900">−Rp5.000</p>
      </div>
    </div>
  );
}

export function BudgetChip({ className = '' }: { className?: string }) {
  const pct = 72;
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <div aria-hidden className={`${chip} w-56 ${className}`} style={float('-2deg', '-4s')}>
      <div className="flex items-center gap-3.5">
        <svg viewBox="0 0 56 56" className="h-14 w-14 shrink-0 -rotate-90">
          <circle cx="28" cy="28" r={r} fill="none" stroke="#eef2ff" strokeWidth="7" />
          <circle cx="28" cy="28" r={r} fill="none" stroke="#f59e0b" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(c * pct) / 100} ${c}`} />
        </svg>
        <div>
          <p className="text-[12px] font-semibold text-slate-500">Budget makan</p>
          <p className="text-[18px] font-extrabold tracking-tight text-slate-900">{pct}%</p>
          <p className="text-[11px] text-slate-400">sisa Rp280.000</p>
        </div>
      </div>
    </div>
  );
}

export function ScanChip({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`${chip} w-52 ${className}`} style={float('3deg', '-1.5s')}>
      <div className="flex items-center gap-2 text-[12px] font-bold text-slate-500">
        <Camera size={14} /> Scan struk
      </div>
      <div className="relative mt-3 overflow-hidden rounded-xl bg-slate-50 p-3">
        {[70, 50, 85, 40].map((w, i) => (
          <span key={i} className="mb-1.5 block h-1.5 rounded-full bg-slate-200 last:mb-0" style={{ width: `${w}%` }} />
        ))}
        <span className="scan-line absolute inset-x-0 h-0.5 bg-indigo-500 shadow-[0_0_12px_2px_rgba(99,102,241,0.6)]" />
      </div>
      <p className="mt-2.5 flex items-center gap-1.5 text-[13px] font-semibold text-slate-800">
        <ScanLine size={14} className="text-indigo-600" /> 4 item · Rp86.500
      </p>
    </div>
  );
}

export function BalanceChip({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`${chip} w-56 ${className}`} style={float('-4deg', '-3.2s')}>
      <p className="text-[12px] font-semibold text-slate-500">Total saldo</p>
      <p className="mt-0.5 text-[20px] font-extrabold tracking-tight text-slate-900">Rp12.480.000</p>
      <div className="mt-2 flex items-end justify-between">
        <svg viewBox="0 0 120 32" className="h-8 w-28">
          <path d="M2 26 L18 22 L34 24 L50 15 L66 18 L82 9 L98 12 L118 4" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="flex items-center gap-1 text-[12px] font-bold text-emerald-600">
          <TrendingUp size={13} /> 4,2%
        </span>
      </div>
    </div>
  );
}

// Latar khas Leosiqra: gradasi indigo–ungu lembut dengan titik-titik halus.
export function BrandBackdrop({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 ${className}`}>
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_80%_0%,#c7d2fe_0%,transparent_55%),radial-gradient(90%_70%_at_0%_100%,#ddd6fe_0%,transparent_60%),linear-gradient(180deg,#eef2ff,#f5f3ff)]" />
      <div className="absolute inset-0 opacity-[0.35] [background-image:radial-gradient(#a5b4fc_1px,transparent_1px)] [background-size:22px_22px]" />
    </div>
  );
}
