import * as React from 'react';
import { AlertTriangle, Inbox } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * ============================================================================
 *  PRIMITIF DAFTAR RESPONSIF — SATU DOM untuk HP & desktop
 * ============================================================================
 *
 * File ini SENGAJA tidak punya `'use client'`.
 *
 * Sebelumnya ada `'use client'` di sini padahal seluruh file tidak memakai
 * satu pun hook, event handler, atau API browser (sudah dicek). Directive itu
 * membuat SELURUH modul ikut ter-bundle di sisi klien dan — yang lebih penting
 * — memaksa komponen apa pun yang mengimpornya dari Server Component untuk
 * dirender di browser. Karena `ListShell`/`ListRow` dipakai untuk merender
 * isi tabel, akibatnya setiap sel data ikut ter-hydrate.
 *
 * Setelah directive dihapus, file ini bisa dipakai dua arah:
 *   - dari Server Component  -> HTML sekali kirim, TIDAK ikut hydrate
 *   - dari Client Component  -> tetapnormal, modul masuk bundle klien
 *
 * Primitif `TableWrap`/`TableCards`/`Th`/`Td`/`Card*`/`TableLoading`/
 * `ListLabel` sudah DIHAPUS: setelah duplikasi tabel+kartu dibersihkan dari
 * semua halaman, tidak ada satu pun pemanggilnya. Lihat catatan "Kenapa ini
 * ada" di bawah untuk sejarahnya — jangan dikembalikan tanpa alasan.
 *
 * `gridClass` WAJIB sama persis antara `ListHead` dan `ListRow` supaya kolom
 * header dan isi selalu sejajar.
 */

/** Wadah daftar: satu kartu putih membungkus header + baris. */
export function ListShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('overflow-hidden rounded-2xl border border-zinc-200/80 bg-white', className)}
    >
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
      className={cn('hidden border-b border-zinc-200/80 bg-zinc-50 px-3 py-2.5 lg:grid', gridClass)}
    >
      {children}
    </div>
  );
}

/** Satu kepala kolom, untuk `ListHead`. */
export function ListHeadCell({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('text-[12px] font-bold uppercase tracking-wide text-zinc-500', className)}>
      {children}
    </span>
  );
}

/**
 * Satu item daftar = satu `<li>`.
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
 * Satu sel daftar = label (khusus HP) + isi, dalam SATU elemen.
 *
 * Kenapa bukan `<div><span>Label</span>…</div>`: versi itu menambah satu node
 * DOM per sel, padahal halaman admin merender 20 baris x 6-9 sel — ratusan
 * node yang harus dibuat, di-parse, dan di-hydrate, sementara labelnya sendiri
 * disembunyikan di layar lebar.
 *
 * Di sini label tidak pernah masuk DOM: CSS `::before` +
 * `content: attr(data-label)` (lihat `.list-cell` di `app/globals.css`)
 * memunculkannya hanya di bawah `lg`. Hemat node tanpa mengubah tampilan.
 *
 * Warna label `zinc-500`, bukan `zinc-400`: label ini benar-benar terlihat di
 * HP, dan `zinc-400` di atas putih hanya ~2,6:1 — gagal WCAG AA.
 */
export function ListCell({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div data-label={label} className={cn('list-cell', className)}>
      {children}
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
