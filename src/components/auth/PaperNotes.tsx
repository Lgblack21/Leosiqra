import Image from 'next/image';

// Hiasan "kertas di meja" untuk layar sambutan (/mulai) & halaman masuk/daftar:
// catatan tempel, struk, koin, dan kartu e-wallet yang melayang pelan. Murni
// dekorasi (aria-hidden) — nominalnya contoh, bukan data siapa pun.
const hand = 'font-[family-name:var(--font-hand)]';

export function StickyNote({ className = '' }: { className?: string }) {
  return (
    <div className={`paper-float w-44 rotate-[-6deg] ${className}`} style={{ '--r': '-6deg' } as React.CSSProperties}>
      <div className="relative rounded-[6px_6px_22px_6px] bg-[#fde68a] px-5 pb-6 pt-7 shadow-[0_18px_30px_-14px_rgba(120,80,0,0.45)]">
        <span className="absolute left-1/2 top-2 h-4 w-4 -translate-x-1/2 rounded-full bg-rose-500 shadow-[inset_-2px_-2px_0_rgba(0,0,0,0.2)]" />
        <p className={`${hand} text-[30px] leading-[1.05] text-slate-900`}>
          Parkir
          <br />
          goceng.
        </p>
        <svg viewBox="0 0 120 12" className="mt-2 h-3 w-28 text-slate-800" aria-hidden>
          <path d="M2 9 C 30 2, 50 12, 80 6 S 110 4, 118 3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

export function Receipt({ className = '' }: { className?: string }) {
  return (
    <div className={`paper-float w-52 rotate-[5deg] ${className}`} style={{ '--r': '5deg', animationDelay: '-2s' } as React.CSSProperties}>
      <div className="receipt-edge bg-white px-5 pb-6 pt-5 font-mono text-[13px] uppercase tracking-wide text-slate-800 shadow-[0_18px_30px_-16px_rgba(15,23,42,0.35)]">
        <p className="font-bold">Nasi Padang</p>
        <p className="mt-1 text-slate-500">1 × 25.000</p>
        <p className="my-2 border-t border-dashed border-slate-300" />
        <p className="flex justify-between font-bold">
          <span>Total</span>
          <span>25.000</span>
        </p>
      </div>
    </div>
  );
}

export function PaydayNote({ className = '' }: { className?: string }) {
  return (
    <div className={`paper-float w-44 rotate-[3deg] ${className}`} style={{ '--r': '3deg', animationDelay: '-4s' } as React.CSSProperties}>
      <div className="relative rounded-md bg-[#e0e7ff] px-5 pb-5 pt-6 shadow-[0_18px_30px_-16px_rgba(49,46,129,0.4)]">
        <span className="absolute -top-2 left-1/2 h-5 w-16 -translate-x-1/2 rotate-[-2deg] bg-white/70" />
        <p className={`${hand} text-[28px] leading-none text-slate-900`}>Gajian!</p>
        <p className={`${hand} mt-1.5 text-[26px] leading-none text-emerald-600`}>+4,2 jt</p>
      </div>
    </div>
  );
}

export function Coin({ className = '' }: { className?: string }) {
  return (
    <div className={`paper-float ${className}`} style={{ '--r': '0deg', animationDelay: '-1s' } as React.CSSProperties}>
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 shadow-[inset_0_-4px_0_rgba(146,64,14,0.35),0_14px_24px_-10px_rgba(146,64,14,0.55)] ring-4 ring-amber-200">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90">
          <Image src="/images/Logo-new.png" alt="" width={34} height={34} />
        </span>
      </div>
    </div>
  );
}

export function WalletCard({ className = '' }: { className?: string }) {
  return (
    <div className={`paper-float w-48 rotate-[-4deg] ${className}`} style={{ '--r': '-4deg', animationDelay: '-3s' } as React.CSSProperties}>
      <div className="rounded-2xl bg-white p-4 shadow-[0_18px_30px_-16px_rgba(15,23,42,0.35)]">
        <div className="flex items-center gap-2">
          <span className="h-7 w-7 rounded-lg bg-indigo-600" />
          <span className="text-[12px] font-bold text-slate-500">E-wallet</span>
        </div>
        <p className="mt-3 text-[11px] font-semibold text-slate-400">Saldo</p>
        <p className="text-[20px] font-extrabold tracking-tight text-slate-900">Rp 312.500</p>
      </div>
    </div>
  );
}
