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
  X,
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
 * Sheet akun — dipicu dari avatar di topbar.
 *
 * Menggantikan blok "Super Admin + Keluar" yang tadinya ada di sidebar.
 * Bottom sheet (naik dari bawah + backdrop), bukan dialog di tengah, supaya
 * terasa native di HP.
 */
export function AccountSheet({
  email,
  demo = false,
}: {
  email: string;
  demo?: boolean;
}) {
  const [buka, setBuka] = React.useState(false);

  // Escape menutup sheet + kunci scroll body seperti dialog pada umumnya.
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

  return (
    <>
      {/* Pemicu: avatar di topbar */}
      <button
        type="button"
        onClick={() => setBuka(true)}
        aria-label="Buka menu akun"
        aria-expanded={buka}
        className="app-avatar"
      >
        {inisial(email)}
      </button>

      {buka ? (
        <div
          className="app-sheet-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Menu akun"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setBuka(false);
          }}
        >
          <div className="app-sheet">
            {/* Gagang sheet — penanda visual ala bottom sheet */}
            <div className="mx-auto mb-4 h-1 w-9 shrink-0 rounded-full bg-zinc-300" aria-hidden />

            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-zinc-900 text-[16px] font-bold text-white">
                {inisial(email)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold text-zinc-900">Super Admin</p>
                <p className="truncate text-[12.5px] text-zinc-500" title={email}>
                  {email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBuka(false)}
                aria-label="Tutup menu akun"
                className="touch-target -mr-2 rounded-xl text-zinc-500 transition hover:bg-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {demo ? (
              <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] font-semibold text-amber-900">
                Mode demo — semua data palsunya, tanpa database.
              </p>
            ) : null}

            <form method="post" action="/api/auth/logout" className="mt-4">
              <button type="submit" className="btn-danger w-full">
                <LogOut className="h-4 w-4" />
                Keluar
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}