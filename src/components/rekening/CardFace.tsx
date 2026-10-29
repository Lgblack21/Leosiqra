"use client";

import type { ReactNode } from 'react';
import { CreditCard } from 'lucide-react';
import { LogoImage } from '@/components/ui/LogoImage';
import { getCardGradientClass } from '@/lib/cardColors';
import { cn } from '@/lib/utils';

// Tampak depan kartu kredit — dipakai carousel pusat kartu & pratinjau form
// kartu supaya keduanya selalu sama persis.

export function NetworkMark({ network }: { network?: string }) {
  if (network === 'visa') return <span className="text-[20px] font-black italic tracking-tight">VISA</span>;
  if (network === 'mastercard')
    return (
      <span className="flex" aria-label="Mastercard">
        <span className="h-6 w-6 rounded-full bg-[#eb001b]" />
        <span className="-ml-2.5 h-6 w-6 rounded-full bg-[#f79e1b]/90" />
      </span>
    );
  if (network === 'jcb') return <span className="text-[16px] font-black tracking-wide">JCB</span>;
  if (network === 'amex') return <span className="rounded bg-white/20 px-1.5 text-[13px] font-black tracking-wider">AMEX</span>;
  if (network === 'gpn') return <span className="text-[14px] font-black tracking-wider">GPN</span>;
  return null;
}

export function CardFace({
  name,
  logoUrl,
  last4,
  network,
  color,
  chip,
  urgent,
  amountLabel,
  amount,
  overlay,
  className,
}: {
  name: string;
  logoUrl?: string;
  last4?: string;
  network?: string;
  color?: string;
  chip: string;
  urgent?: boolean;
  amountLabel: string;
  amount: string;
  overlay?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative flex aspect-[1.586/1] flex-col justify-between overflow-hidden rounded-[20px] p-4 text-left text-white',
        getCardGradientClass(color, 'Credit Card'),
        className
      )}
    >
      <span aria-hidden className="pointer-events-none absolute -right-14 -top-20 h-48 w-48 rounded-full bg-white/15" />
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/20" />
      <div className="relative flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/95">
          <LogoImage src={logoUrl} alt={name} fallbackText={(name || 'KK').substring(0, 3).toUpperCase()} fallbackIcon={<CreditCard size={15} className="text-slate-700" />} className="h-full w-full object-cover" />
        </span>
        <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{name || 'Kartu kredit'}</span>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', urgent ? 'bg-white text-rose-600' : 'bg-white/20')}>{chip}</span>
      </div>
      <div className="relative flex items-center gap-3">
        <svg width="36" height="27" viewBox="0 0 42 32" aria-hidden>
          <rect x="0.5" y="0.5" width="41" height="31" rx="6" fill="#f5d27a" stroke="#d4a943" />
          <path d="M14 1v30M28 1v30M1 11h13M28 11h13M1 21h13M28 21h13M14 16h14" stroke="#c99a35" strokeWidth="1.2" fill="none" />
        </svg>
        <span className="font-mono text-[15px] tracking-[0.22em] text-white/90">•••• {last4 || '····'}</span>
      </div>
      <div className="relative flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/70">{amountLabel}</p>
          <p className="truncate text-[19px] font-extrabold leading-tight tabular-nums">{amount}</p>
        </div>
        <NetworkMark network={network} />
      </div>
      {overlay}
    </div>
  );
}
