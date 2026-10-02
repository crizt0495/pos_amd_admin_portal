'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  KeyRound,
  LayoutDashboard,
  LogOut,
  Store,
  UserCog,
  UserPlus,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { inisial } from '@/lib/format';

/**
 * ============================================================================
 *  APP NAV — navigasi bawah ala aplikasi Android (Material NavigationBar)
 * ============================================================================
 *  Sidebar sudah dihapus. Navigasi utama sekarang docked di bawah layar,
 *  persis seperti bar navigasi aplikasi native:
 *
 *   - 5 slot, ikon + label kecil, tinggi total 56px + safe-area bawah
 *   - slot aktif diberi warna primer + label bolder
 *   - Android app: tidak ada hover state, hanya state "terpilih"
 *
 *  Di desktop bar tetap di bawah (bukan pindah ke atas/side) supaya
 *  posisinya konsisten di semua ukuran layar.
 * ============================================================================
 */

const ITEMS = [
  { href: '/dashboard', label: 'Dashboard', short: 'Beranda', Icon: LayoutDashboard },
  { href: '/toko', label: 'Toko', short: 'Toko', Icon: Store },
  { href: '/toko/baru', label: 'Daftar Toko Baru', short: 'Daftar', Icon: UserPlus },
  { href: '/keys', label: 'Semua Key', short: 'Key', Icon: KeyRound },
  { href: '/akun', label: 'Akun Toko', short: 'Akun', Icon: UserCog },
] as const;

/**
 * Slot menu aktif untuk sebuah pathname.
 *
 * `/toko/baru` punya slot sendiri, jadi harus dikecualikan dari prefix
 * `/toko` — kalau tidak, dua slot aktif menyala bersamaan di halaman itu.
 */
function slotAktif(href: string, pathname: string): boolean {
  if (href === '/toko') {
    return pathname === '/toko' || (pathname.startsWith('/toko/') && pathname !== '/toko/baru');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Judul halaman untuk topbar — mengikuti slot menu yang aktif. */
export function judulHalaman(pathname: string): string {
  if (pathname === '/toko/baru') return 'Daftar Toko Baru';
  const cocok = ITEMS.find(({ href }) => slotAktif(href, pathname));
  return cocok?.label ?? 'Admin Portal';
}

/** Bar navigasi bawah. Dipasang sebagai sibling terakhir di dalam shell. */
export function AppNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigasi utama" className="app-nav">
      {ITEMS.map(({ href, short, Icon }) => {
        const aktif = slotAktif(href, pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={aktif ? 'page' : undefined}
            className={cn('app-nav-item', aktif && 'app-nav-item-active')}
          >
            <Icon className="app-nav-icon" strokeWidth={aktif ? 2.4 : 2} />
            <span className="app-nav-label">{short}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Menu akun — dipicu dari avatar di topbar.
 *
 * Menggantikan blok "Super Admin + Keluar" yang tadinya ada di sidebar.
 *
 * Dulu ini bottom sheet: panel selebar layar naik dari bawah, backdrop gelap
 * `aria-modal`, plus penguncian scroll body. Untuk satu aksi saja
 * ("Keluar") itu berlebihan dan di HP menutupi layar. Sekarang dropdown
 * kecil yang menempel di bawah avatar — tanpa backdrop, tanpa kunci scroll,
 * tanpa `fixed` + centering.
 *
 * `right-0` menjaga dropdown tetap di dalam viewport walau layar sempit.
 */
export function AccountMenu({ email, demo = false }: { email: string; demo?: boolean }) {
  const [buka, setBuka] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  // Klik di luar -> tutup. Escape -> tutup + kembali fokus ke avatar.
  React.useEffect(() => {
    if (!buka) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setBuka(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setBuka(false);
      ref.current?.querySelector('button')?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [buka]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setBuka((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={buka}
        aria-label="Menu akun"
        className="app-avatar"
      >
        {inisial(email)}
      </button>

      {buka ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-48 rounded-lg border border-zinc-200/80 bg-white py-1 shadow-lg"
        >
          <div className="border-b border-zinc-100 px-3 py-2">
            <p className="truncate text-sm font-medium text-zinc-900" title={email}>
              {email}
            </p>
            <p className="text-xs text-gray-500">Super Admin</p>
          </div>

          {demo ? (
            <p className="mx-1.5 mt-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold leading-snug text-amber-900">
              Mode demo — data palsunya.
            </p>
          ) : null}

          <form method="post" action="/api/auth/logout" className="mt-1">
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Keluar
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}