import { AccountMenu, AppNav, JudulHalaman } from '@/components/admin/app-nav';

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
 *  Solusinya: judul dipindah ke island kecil `JudulHalaman`, sehingga shell
 *  ini bisa jadi Server Component. `AppNav` dan `AccountMenu` tetap Client
 *  Component, tapi sekarang mereka SAUDAR dari `{children}`, bukan pembungkus —
 *  jadi konten halaman tidak lagi ikut ter-hydrate.
 *  ---------------------------------------------------------------------------
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
  return (
    <div className="admin-shell">
      {/* App bar */}
      <header className="admin-topbar">
        <h1 className="min-w-0 flex-1 truncate text-[17px] font-bold leading-none text-zinc-900">
          <JudulHalaman />
        </h1>
        {demo ? (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-[10.5px] font-bold uppercase tracking-wide text-amber-800">
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
      <AppNav />
    </div>
  );
}
