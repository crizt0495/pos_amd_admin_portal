'use client';

import * as React from 'react';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose?: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={cn(
          'flex max-h-[88dvh] w-full animate-fade-in flex-col overflow-hidden rounded-2xl bg-white shadow-xl',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md',
        )}
      >
        {title ? (
          <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3.5">
            <h2 className="text-[15px] font-bold text-zinc-900">{title}</h2>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>

        {footer ? (
          <div className="border-t border-zinc-100 bg-zinc-50 px-4 py-3">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
