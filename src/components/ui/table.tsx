'use client';

import * as React from 'react';
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

/** Pembungkus tabel: bikin scroll horizontal + bolehkan sticky header. */
export function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="table-wrap rounded-2xl border border-zinc-200/80 bg-white">
      <table className="w-full min-w-[720px] border-collapse">{children}</table>
    </div>
  );
}

export function Th({
  children,
  className,
  title,
}: {
  children?: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <th className={cn('table-head', className)} title={title}>
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  title,
}: {
  children?: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <td className={cn('table-cell', className)} title={title}>
      {children}
    </td>
  );
}

/** Placeholder saat data sedang dimuat. */
export function TableLoading({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-4">
      <div className="flex items-center gap-2 text-[13px] text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Memuat data…
      </div>
      <div className="mt-4 space-y-2" aria-hidden>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-2">
            {Array.from({ length: cols }).map((__, j) => (
              <div
                key={j}
                className="h-8 flex-1 animate-pulse rounded-lg bg-zinc-100"
                style={{ animationDelay: `${(i * cols + j) * 12}ms` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Placeholder saat data kosong (bukan error). */
export function EmptyState({
  title = 'Belum ada data',
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-zinc-100">
        <Inbox className="h-5 w-5 text-zinc-400" />
      </span>
      <p className="text-[14px] font-bold text-zinc-800">{title}</p>
      {description ? (
        <p className="max-w-sm text-[13px] leading-relaxed text-zinc-500">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Kotak peringatan/berhasil di dalam form. */
export function AlertBox({
  tone = 'error',
  children,
}: {
  tone?: 'error' | 'success' | 'warn' | 'info';
  children: React.ReactNode;
}) {
  const TONE = {
    error: 'bg-red-50 text-red-700',
    success: 'bg-emerald-50 text-emerald-700',
    warn: 'bg-amber-50 text-amber-800',
    info: 'bg-sky-50 text-sky-700',
  } as const;

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium',
        TONE[tone],
      )}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0">{children}</span>
    </div>
  );
}
