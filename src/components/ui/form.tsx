'use client';

import * as React from 'react';
import { AlertCircle } from 'lucide-react';

import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Input / Textarea                                                   */
/* ------------------------------------------------------------------ */

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn('field-input', className)} {...rest} />;
  },
);

/**
 * Input khusus nomor telepon: hanya menerima digit.
 *
 * Tiga lapis defense (mengikuti portal toko & app desktop):
 *  1. `inputMode="numeric"`  -> keyboard angka di HP
 *  2. `pattern="[0-9]*"`     -> hint native + fallback validasi
 *  3. filter `onChange`      -> karakter non-digit dibuang sebelum masuk state
 *
 * `onBeforeInput` tidak dipakai di sini (berbeda dari app desktop) karena
 * admin_panel ini hanya dipakai di browser, bukan app native.
 */
export const InputTelepon = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function InputTelepon({ className, onChange, ...rest }, ref) {
  return (
    <input
      ref={ref}
      type="tel"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="tel"
      className={cn('field-input tabular', className)}
      onChange={(e) => {
        const bersih = e.target.value.replace(/\D/g, '');
        onChange?.({ ...e, target: { ...e.target, value: bersih } } as never);
      }}
      {...rest}
    />
  );
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn('field-textarea', className)} {...rest} />;
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn('field-input pr-9', className)} {...rest}>
      {children}
    </select>
  );
});

/* ------------------------------------------------------------------ */
/* Field: label + input + pesan error                                 */
/* ------------------------------------------------------------------ */

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="field-error">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-[12px] text-zinc-500">{hint}</p>
      ) : null}
    </div>
  );
}
