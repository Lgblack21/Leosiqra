"use client";

import { Banknote, Building2, CreditCard, Landmark, Wallet } from 'lucide-react';
import { LogoImage } from '@/components/ui/LogoImage';
import { matchIndonesianInstitutionLogo, upgradeLogoUrl } from '@/lib/indonesianBanks';
import { cn } from '@/lib/utils';
import type { Account } from '@/lib/services/accountService';

// Logo rekening di semua tampilan: logo yang diunggah user → logo bank/e-wallet
// yang dikenali dari namanya (BCA, Mandiri, GoPay, …) → emoji tunai → ikon jenis.
const TYPE_BG: Record<string, string> = { 'Bank Account': 'bg-blue-600', 'E-Wallet': 'bg-indigo-600', Cash: 'bg-emerald-500', 'Investment Account': 'bg-slate-900', 'Credit Card': 'bg-rose-500' };
const typeIcon = (type: string, size: number) => {
  const p = { size, className: 'text-white' };
  return type === 'E-Wallet' ? <Wallet {...p} /> : type === 'Cash' ? <Banknote {...p} /> : type === 'Investment Account' ? <Landmark {...p} /> : type === 'Credit Card' ? <CreditCard {...p} /> : <Building2 {...p} />;
};

export function accountLogoUrl(acc: Pick<Account, 'logoUrl' | 'name' | 'type'>) {
  return upgradeLogoUrl(acc.logoUrl) || matchIndonesianInstitutionLogo(acc.name, acc.type) || undefined;
}

export function AccountLogo({ acc, size = 40, className }: { acc: Pick<Account, 'logoUrl' | 'name' | 'type'>; size?: number; className?: string }) {
  const src = accountLogoUrl(acc);
  const radius = size >= 36 ? 'rounded-xl' : 'rounded-lg';
  if (!src && acc.type === 'Cash') {
    return (
      <span className={cn('flex shrink-0 items-center justify-center bg-emerald-50', radius, className)} style={{ width: size, height: size, fontSize: size * 0.5 }}>
        💵
      </span>
    );
  }
  return (
    <span className={cn('flex shrink-0 items-center justify-center overflow-hidden bg-white ring-1 ring-slate-100', radius, className)} style={{ width: size, height: size }}>
      <LogoImage
        src={src}
        alt={acc.name}
        fallbackText={acc.name.substring(0, 3).toUpperCase()}
        fallbackIcon={<span className={cn('flex h-full w-full items-center justify-center', TYPE_BG[acc.type] ?? 'bg-slate-500')}>{typeIcon(acc.type, Math.round(size * 0.45))}</span>}
        className="h-full w-full object-contain p-0.5"
      />
    </span>
  );
}
