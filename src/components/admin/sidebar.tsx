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

export function Sidebar({ email, demo = false }: { email: string; demo?: boolean }) {
  const pathname = usePathname();
  const [buka, setBuka] = React.useState(false);

  // Tutup drawer setiap pindah halaman.
  React.useEffect(() => {
    setBuka(false);
  }, [pathname]);

  const menu = (
    <>
      {/* Brand */}
      <div className="flex h-16 items-center justify-between border-b border-zinc-800 px-4">
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
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-800 hover:text-white lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Badge mode demo — biar tidak pernah tertukar dengan data asli */}
      {demo ? (
        <div className="border-b border-amber-500/25 bg-amber-500/10 px-4 py-2">
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
                    'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition',
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
      <div className="border-t border-zinc-800 p-3">
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
            className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13.5px] font-medium text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Keluar
          </button>
        </form>
      </div>
    </>
  );

  return (
    <>
      {/* Sidebar tetap (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-zinc-900 lg:flex">
        {menu}
      </aside>

      {/* Tombol buka menu (mobile) */}
      <button
        type="button"
        onClick={() => setBuka(true)}
        aria-label="Buka menu"
        className="fixed left-4 top-4 z-30 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-lg lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Drawer (mobile) */}
      {buka ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Tutup menu"
            onClick={() => setBuka(false)}
            className="absolute inset-0 bg-zinc-900/60"
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 animate-slide-left flex-col bg-zinc-900">
            {menu}
          </aside>
        </div>
      ) : null}
    </>
  );
}
