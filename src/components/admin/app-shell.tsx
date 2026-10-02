'use client';

import * as React from 'react';

import { AccountMenu, AppNav, judulHalaman } from '@/components/admin/app-nav';
import { usePathname } from 'next/navigation';

/**
 * ============================================================================
 *  APP SHELL — kerangka ala aplikasi Android
 * ============================================================================
 *  Sidebar sudah dihapus sepenuhnya. Layout sekarang:
 *
 *      ┌─────────────────────────┐  ← app bar sticky (judul + avatar)
 *      │                         │
 *      │       konten            │
 *      │                         │
 *      ├─────────────────────────┤  ← navigasi bawah (5 slot, docked)
 *      │  Beranda  Toko  ...     │
 *      └─────────────────────────┘
 *
 *  Semua elemen dalam flow, jadi tidak perlu padding kompensasi terhadap
 *  elemen `fixed`. `admin-content-safe` yang menyisakan ruang untuk bar bawah.
 * ============================================================================
 */
export function AppShell({
  email,
  demo = false,
  children,
}: {
  email: string;
  demo?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="admin-shell">
      {/* App bar */}
      <header className="admin-topbar">
        <h1 className="min-w-0 flex-1 truncate text-[17px] font-bold leading-none text-zinc-900">
          {judulHalaman(pathname)}
        </h1>
        {demo ? (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-[10.5px] font-bold uppercase tracking-wide text-amber-800">
            Demo
          </span>
        ) : null}
        <AccountMenu email={email} demo={demo} />
      </header>

      <div className="admin-main">
        <div className="admin-content admin-content-safe">{children}</div>
      </div>

      {/* Navigasi bawah — docked, melintasi seluruh lebar layar */}
      <AppNav />
    </div>
  );
}