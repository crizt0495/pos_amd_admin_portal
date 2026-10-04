import { AccountMenu, AppNav } from '@/components/admin/app-nav';
import { judulHalaman } from '@/lib/nav';

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
 *
 *  ---------------------------------------------------------------------------
 *  PENTING: file ini SENGAJA TIDAK punya `'use client'`.
 *
 *  Sebelumnya shell ini adalah Client Component karena memanggil
 *  `usePathname()` untuk judul topbar. Konsekuensinya `{children}` — seluruh
 *  isi halaman yang sudah dirender di server — berada di dalam output Client
 *  Component, sehingga React ikut me-hydrate semuanya. Server Component tidak
 *  otomatis bebas hydrasi hanya karena datanya sudah dikirim sebagai HTML;
 *  yang menentukan adalah ada/tidaknya Client Component di atasnya.
 *
 *  Solusinya sudah dua tahap:
 *
 *   1. Shell, `AppNav`, dan `AccountMenu` sekarang Server Component. Pathname
 *      untuk judul topbar dan slot navigasi aktif datang dari request header
 *      `x-pathname` yang diisi middleware (bukan `usePathname()`), dan menu
 *      akun memakai `<details>` (bukan `useState()`).
 *   2. `Toaster` sengaja dipasang sebagai SAUDAR `{children}` di layout,
 *      bukan provider di atasnya - begitu Client Component membungkus
 *      `{children}`, React me-hydrate seluruh isi halaman, dan di situlah biaya
 *      utamanya.
 *
 *  Karena tidak ada Client Component di dalam shell, halaman read-only seperti
 *  `/dashboard` bisa disajikan sebagai dokumen murni tanpa React sama sekali
 *  (lihat `HALAMAN_RINGAN` di src/middleware.ts): nol chunk JS, nol hidrasi,
 *  TBT ~0.
 *  ---------------------------------------------------------------------------
 */
export function AppShell({
  pathname,
  email,
  demo = false,
  children,
}: {
  pathname: string;
  email: string;
  demo?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="admin-shell">
      {/* App bar */}
      <header className="admin-topbar">
        <h1 className="min-w-0 flex-1 truncate text-[17px] font-bold leading-none text-zinc-900">
          {judulHalaman(pathname)}
        </h1>
        {demo ? (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-[12px] font-bold uppercase tracking-wide text-amber-800">
            Demo
          </span>
        ) : null}
        <AccountMenu email={email} demo={demo} />
      </header>

      {/*
        `main` (bukan `div`) supaya halaman punya landmark utama — ini yang
        diuji audit "landmark-one-main". Styling tetap lewat class `admin-main`.
      */}
      <main className="admin-main">
        <div className="admin-content admin-content-safe">{children}</div>
      </main>

      {/* Navigasi bawah — docked, melintasi seluruh lebar layar */}
      <AppNav pathname={pathname} />
    </div>
  );
}
