import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes, forwardRef } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', isLoading, children, ...props }, ref) => {
    const variants = {
      primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100",
      secondary: "bg-slate-50 border border-slate-200 text-slate-900 hover:bg-slate-100",
      ghost: "bg-transparent text-slate-500 hover:text-indigo-600 hover:bg-indigo-50",
    };

    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-2xl px-8 py-4 text-sm font-bold transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-50 gap-2",
          variants[variant],
          className
        )}
        ref={ref}
        disabled={isLoading}
        {...props}
      >
        {isLoading && (
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button };
