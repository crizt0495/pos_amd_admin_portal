'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'xs';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  outline: 'btn-outline',
  danger: 'btn-danger',
  ghost: 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold text-zinc-600 transition hover:bg-zinc-100 active:scale-[0.99] disabled:opacity-50',
};

const SIZE: Record<ButtonSize, string> = {
  xs: 'h-8 px-2.5 text-[12px]',
  sm: 'h-9 px-3 text-[13px]',
  md: 'h-11',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading = false, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      data-loading={loading ? 'true' : undefined}
      className={cn(VARIANT[variant], SIZE[size], className)}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : null}
      {children}
    </button>
  );
});

/** Tombol ikon saja (untuk aksi di dalam tabel). Wajib punya `aria-label`. */
export const IconButton = React.forwardRef<
  HTMLButtonElement,
  ButtonProps & { label: string }
>(function IconButton({ label, className, children, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 active:scale-[0.97] disabled:opacity-50',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
