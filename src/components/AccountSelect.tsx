'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, CreditCard, Landmark, Wallet } from 'lucide-react';
import { LogoImage } from '@/components/ui/LogoImage';
import { Account } from '@/lib/services/accountService';
import { computeCreditUsage } from '@/lib/creditCard';
import { matchIndonesianInstitutionLogo } from '@/lib/indonesianBanks';
import { cn, formatCurrency } from '@/lib/utils';

// Pemilih rekening ringkas (form catat transaksi web): logo bank/e-wallet + sisa saldo.
// Kartu kredit menampilkan sisa limit (konvensi balance = −terpakai, lihat lib/creditCard).

const logoOf = (a: Account) =>
  a.logoUrl || (a.type === 'Cash' ? '' : (matchIndonesianInstitutionLogo(a.name, a.type) ?? ''));

const iconOf = (a: Account, size: number) =>
  a.type === 'Cash' || a.type === 'E-Wallet' ? (
    <Wallet size={size} />
  ) : a.creditLimit ? (
    <CreditCard size={size} />
  ) : (
    <Landmark size={size} />
  );

const balanceLine = (a: Account) =>
  a.creditLimit
    ? `Sisa limit ${formatCurrency(computeCreditUsage(a).remaining, a.currency || 'IDR')}`
    : `Saldo ${formatCurrency(Number(a.balance) || 0, a.currency || 'IDR')}`;

function AccountLogo({ account }: { account: Account }) {
  return (
    <LogoImage
      src={logoOf(account)}
      alt={account.name}
      fallbackText=""
      fallbackIcon={iconOf(account, 16)}
      className="h-9 w-9 shrink-0 rounded-[10px] bg-white object-contain ring-1 ring-slate-200"
    />
  );
}

export function AccountSelect({
  accounts,
  value,
  onChange,
}: {
  accounts: Account[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = accounts.find((a) => a.id === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-xl border bg-white px-2.5 py-2 text-left transition',
          open ? 'border-slate-400 ring-4 ring-slate-900/5' : 'border-slate-200 hover:border-slate-300',
        )}
      >
        {selected ? (
          <>
            <AccountLogo account={selected} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-semibold text-slate-800">{selected.name}</span>
              <span className="block truncate text-[11.5px] text-slate-500">{balanceLine(selected)}</span>
            </span>
          </>
        ) : (
          <span className="flex-1 px-1 py-2 text-[13.5px] font-medium text-slate-400">Pilih rekening</span>
        )}
        <ChevronDown size={16} className={cn('shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          role="listbox"
          className="mt-1.5 rounded-2xl border border-slate-100 bg-white p-1.5 shadow-lg animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <div className="custom-scrollbar max-h-56 overflow-y-auto">
            {accounts.map((a) => {
              const active = a.id === value;
              return (
                <button
                  key={a.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(a.id ?? '');
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors',
                    active ? 'bg-slate-100' : 'hover:bg-slate-50',
                  )}
                >
                  <AccountLogo account={a} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-slate-800">{a.name}</span>
                    <span className="block truncate text-[11.5px] text-slate-500">{balanceLine(a)}</span>
                  </span>
                  {active ? <Check size={15} className="shrink-0 text-slate-900" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
