'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Store,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { inisial } from '@/lib/format';

const ITEMS = [
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/toko', label: 'Toko', Icon: Store },
  { href: '/toko/baru', label: 'Daftar Toko Baru', Icon: UserPlus },
  { href: '/keys', label: 'Semua Key', Icon: KeyRound },
  { href: '/akun', label: 'Akun Toko', Icon: Users },
] as const;

/** Judul halaman untuk topbar HP, mengikuti item menu yang aktif. */
function judulHalaman(pathname: string): string {
  if (pathname === '/toko/baru') return 'Daftar Toko Baru';
  const cocok = ITEMS.find(({ href }) =>
    href === '/toko'
      ? pathname === '/toko' || pathname.startsWith('/toko/')
      : pathname === href || pathname.startsWith(`${href}/`),
  );
  return cocok?.label ?? 'Admin Portal';
}

/**
 * Kerangka navigasi admin — MOBILE FIRST.
 *
 * - HP (`< lg`): topbar sticky berisi judul halaman + tombol menu, dan
 *   navigasi muncul lewat drawer. Sidebar `<aside>` desktop disembunyikan.
 * - Desktop (`>= lg`): `<aside>` tetap di kiri, topbar disembunyikan.
 *
 * Topbar sengaja `sticky` (bukan `fixed`) supaya ikut menambah tinggi
 * secara alami — tidak perlu padding kompensasi di konten.
 */
export function AdminShell({
  email,
  demo = false,
  children,
}: {
  email: string;
  demo?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [buka, setBuka] = React.useState(false);

  // Tutup drawer setiap pindah halaman.
  React.useEffect(() => {
    setBuka(false);
  }, [pathname]);

  // Escape menutup drawer + kunci scroll body agar konten di belakang
  // tidak ikut tergulir saat drawer terbuka.
  React.useEffect(() => {
    if (!buka) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBuka(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [buka]);

  const menu = (
    <>
      {/* Brand */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-800 px-4">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-zinc-900">
            <Store className="h-4 w-4" />
          </span>
          <span className="text-[14px] font-bold text-white">Admin Portal</span>
        </Link>
        <button
          type="button"
          onClick={() => setBuka(false)}
          aria-label="Tutup menu"
          className="touch-target rounded-lg text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Badge mode demo — biar tidak pernah tertukar dengan data asli */}
      {demo ? (
        <div className="shrink-0 border-b border-amber-500/25 bg-amber-500/10 px-4 py-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-400">
            Mode demo
          </p>
          <p className="text-[11px] leading-snug text-amber-300/80">
            Semua data di sini palsu dan tidak menyentuh database.
          </p>
        </div>
      ) : null}

      {/* Navigasi utama */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3" aria-label="Navigasi utama">
        <ul className="space-y-0.5">
          {ITEMS.map(({ href, label, Icon }) => {
            // /toko/baru ikut cocok dengan prefix /toko;tabs "/toko"
            // yang hanya tepat saat pathname persis /toko.
            const aktif =
              href === '/toko'
                ? pathname === '/toko' || pathname.startsWith('/toko/')
                : href === '/toko/baru'
                  ? pathname === '/toko/baru'
                  : pathname === href || pathname.startsWith(`${href}/`);

            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={aktif ? 'page' : undefined}
                  className={cn(
                    'flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition lg:min-h-0',
                    aktif
                      ? 'bg-white font-bold text-zinc-900'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-white',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Info admin + keluar */}
      <div className="shrink-0 border-t border-zinc-800 p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-zinc-700 text-[13px] font-bold text-white">
            {inisial(email)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-bold text-white">Super Admin</p>
            <p className="truncate text-[11px] text-zinc-400" title={email}>
              {email}
            </p>
          </div>
        </div>
        <form method="post" action="/api/auth/logout">
          <button
            type="submit"
            className="mt-1 flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13.5px] font-medium text-zinc-400 transition hover:bg-zinc-800 hover:text-white lg:min-h-0"
          >
            <LogOut className="h-4 w-4" />
            Keluar
          </button>
        </form>
      </div>
    </>
  );

  return (
    <div className="admin-shell">
      {/* Sidebar tetap (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-zinc-900 lg:flex">
        {menu}
      </aside>

      <div className="admin-main">
        {/* Topbar sticky (HP) — menggantikan tombol hamburger melayang */}
        <header className="admin-topbar">
          <button
            type="button"
            onClick={() => setBuka(true)}
            aria-label="Buka menu"
            aria-expanded={buka}
            className="touch-target -ml-1 rounded-xl text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-zinc-900">
            {judulHalaman(pathname)}
          </span>
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-zinc-900 text-[12px] font-bold text-white"
            title={email}
          >
            {inisial(email)}
          </span>
        </header>

        {/* Banner demo: di desktop sidebar sudah membawa badge yang sama. */}
        {demo ? (
          <p
            role="status"
            className="mx-4 mb-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] font-semibold text-amber-900 sm:mx-6 lg:hidden"
          >
            Mode demo — data palsunya, tanpa database.
          </p>
        ) : null}

        <div className="admin-content admin-content-safe">{children}</div>
      </div>

      {/* Drawer (HP) */}
      {buka ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Tutup menu"
            onClick={() => setBuka(false)}
            className="absolute inset-0 bg-zinc-900/60"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Menu navigasi"
            className="absolute inset-y-0 left-0 flex w-[min(17rem,85vw)] animate-slide-left flex-col bg-zinc-900 shadow-2xl"
          >
            {menu}
          </aside>
        </div>
      ) : null}
    </div>
  );
}