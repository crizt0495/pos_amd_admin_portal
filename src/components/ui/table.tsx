'use client';

import * as React from 'react';
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Pembungkus tabel — HANYA tampil di layar besar (`lg:` ke atas).
 *
 * Di layar kecil tabel ini disembunyikan dan diganti `TableCards`, jadi
 * pengguna HP tidak pernah perlu scroll horizontal.
 */
export function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="table-wrap rounded-2xl border border-zinc-200/80 bg-white">
      <table className="w-full min-w-[720px] border-collapse">{children}</table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Padanan tabel untuk layar kecil — daftar kartu                     */
/* ------------------------------------------------------------------ */

/** Wadah daftar kartu. Pasangan `TableWrap` untuk tampilan HP. */
export function TableCards({ children }: { children: React.ReactNode }) {
  return <ul className="card-list">{children}</ul>;
}

/** Satu kartu = satu baris tabel. */
export function CardItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return <li className={cn('card-soft p-3.5', className)}>{children}</li>;
}

/** Judul kartu + slot kanan untuk badge/sCheckbox. */
export function CardHeader({
  title,
  subtitle,
  right,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      {right ? <div className="pt-0.5">{right}</div> : null}
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-bold leading-snug text-zinc-900">{title}</p>
        {subtitle ? (
          <p className="mt-0.5 text-[11.5px] leading-snug text-zinc-500">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

/** Baris label→nilai di dalam kartu (mis. "Tier: Pro"). */
export function CardField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-baseline gap-2 text-[12.5px]', className)}>
      <span className="w-24 shrink-0 text-zinc-500">{label}</span>
      <span className="min-w-0 flex-1 break-words text-zinc-800">{children}</span>
    </div>
  );
}

/** Deretan badge di dalam kartu. */
export function CardBadges({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-1.5">{children}</div>;
}

/** Deretan aksi di dalam kartu — target sentuh tetap 44px di HP. */
export function CardActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-zinc-100 pt-3">
      {children}
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
/* ------------------------------------------------------------------ */
/* Daftar responsif SATU DOM untuk HP & desktop                         */
/* ------------------------------------------------------------------ */

/*
 * Kenapa ini ada (dan bukan `TableWrap` + `TableCards`):
 *
 * Versi lama merender DUA salinan data sekaligus — `<table>` untuk desktop
 * dan daftar kartu untuk HP — lalu menyembunyikan salah satunya lewat CSS
 * (`hidden lg:block` vs `lg:hidden`). CSS hiding tidak mencegah React
 * merender, jadi tiap baris di-hydrate dua kali, di-recalc dua kali, dan
 * ikut masuk payload HTML (178 KB untuk 20 key, bukan 95 KB). Audit
 * Lighthouse `mainthread-work-breakdown` menunjukkan `styleLayout` 754 ms
 * dan `scriptEvaluation` 1132 ms — hampir seluruhnya dari duplikasi ini.
 *
 * `ListShell`/`ListHead`/`ListRow` membuat SATU markup yang berubah bentuk
 * murni lewat CSS: HP = kartu bertumpuk, `lg:` ke atas = baris tabel. Satu
 * DOM, satu kali hydrate, nol CLS.
 *
 * `gridClass` WAJIB sama persis antara `ListHead` dan `ListRow` supaya kolom
 * header dan isi tetap sejajar.
 */

/** Wadah daftar: satu kartu putih membungkus header + baris. */
export function ListShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-zinc-200/80 bg-white', className)}>
      {children}
    </div>
  );
}

/** Baris judul kolom. Hanya muncul di layar lebar (`lg:`), seperti tabel. */
export function ListHead({
  children,
  gridClass,
}: {
  children: React.ReactNode;
  gridClass: string;
}) {
  return (
    <div
      className={cn(
        'hidden border-b border-zinc-200/80 bg-zinc-50 px-3 py-2.5 lg:grid',
        gridClass,
      )}
    >
      {children}
    </div>
  );
}

/** Satu kepala kolom, untuk `ListHead`. */
export function ListHeadCell({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'text-[11px] font-bold uppercase tracking-wide text-zinc-500',
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Satu item daftar = satu `<li>`. Menggantikan `CardItem` untuk daftar yang
 * juga perlu tampil sebagai baris tabel di `lg:`.
 *
 * Pemisah antar baris dipasang oleh `divide-y` pada `<ul>` induknya, jadi
 * kelas ini tidak perlu border sendiri (menghindari garis dobel).
 */
export function ListRow({
  children,
  gridClass,
  className,
}: {
  children: React.ReactNode;
  gridClass: string;
  className?: string;
}) {
  return (
    <li
      className={cn(
        'px-3.5 py-3.5 transition hover:bg-zinc-50/70 lg:grid lg:items-start lg:gap-x-3 lg:px-3 lg:py-3',
        gridClass,
        className,
      )}
    >
      {children}
    </li>
  );
}

/**
 * Label kecil di dalam sel — hanya kelihatan di HP (baris tabel tak butuh).
 *
 * Warna `zinc-500`, bukan `zinc-400`: label ini kini benar-benar terlihat di
 * HP (sebelumnya duplikat tabel+kartu disembunyikan CSS, jadi teks warna
 * muda lolos dari audit tanpa pernah diperiksa). `zinc-400` di atas putih
 * hanya ~2,6:1 dan gagal WCAG AA.
 */
export function ListLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-0.5 block text-[10.5px] font-bold uppercase tracking-wide text-zinc-500 lg:hidden">
      {children}
    </span>
  );
}

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
