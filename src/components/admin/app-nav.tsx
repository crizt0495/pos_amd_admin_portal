import Link from 'next/link';
import {
  KeyRound,
  LayoutDashboard,
  LogOut,
  Package,
  Store,
  UserCog,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { inisial } from '@/lib/format';
import { NAV_ITEMS, slotAktif, type NavHref } from '@/lib/nav';

/**
 * ============================================================================
 *  APP NAV — navigasi bawah ala aplikasi Android (Material NavigationBar)
 * ============================================================================
 *
 *  Sidebar sudah dihapus. Navigasi utama sekarang docked di bawah layar,
 *  persis seperti bar navigasi aplikasi native:
 *
 *   - 6 slot, ikon + label kecil, tinggi total 56px + safe-area bawah
 *   - slot aktif diberi warna primer + label bolder
 *   - Android app: tidak ada hover state, hanya state "terpilih"
 *
 *  Jumlah slot tidak dibatasi CSS: tiap slot `flex-1`, jadi menambah menu
 *  cukup menambah satu entri ke `NAV_ITEMS` + satu ikon ke `IKON`.
 *
 *  Di desktop bar tetap di bawah (bukan pindah ke atas/side) supaya
 *  posisinya konsisten di semua ukuran layar.
 * ============================================================================
 */

/**
 * PENTING: file ini SENGAJA TIDAK punya `'use client'`.
 *
 * Sebelumnya `AppNav` dan `AccountMenu` adalah Client Component karena
 * memanggil `usePathname()` (slot aktif) dan `useState()` (menu akun). Dua
 * hal itu sekarang dipindah ke server:
 *
 *   1. Pathname datang dari request header `x-pathname` (diisi middleware).
 *   2) Menu akun memakai `<details>`/`<summary>`, yang natively buka-tutup
 *      tanpa satu baris pun JS.
 *
 * Kenapa penting: begitu ada Client Component di dalam app shell, React
 * me-hydrate seluruh isi halaman - termasuk semua HTML yang sudah dikirim
 * server. Itu ~870 ms CPU untuk shell yang sebenarnya tidak butuh JS, dan
 * itulah alasan halaman `/dashboard` sekarang disajikan tanpa React sama
 * sekali (lihat `HALAMAN_RINGAN` di src/middleware.ts).
 */

/**
 * Ikon per slot. Dipisah dari `NAV_ITEMS` (`@/lib/nav`) supaya daftar href dan
 * label hanya ada di satu tempat; komponen `lucide` hanya boleh masuk dari
 * modul client.
 *
 * Tipe `Record<NavHref, ...>` membuat peta ini WAJIB lengkap: kalau nanti ada
 * slot baru di `NAV_ITEMS` tanpa ikon, `tsc` gagal di sini, bukan
 * `Icon: undefined` yang lolos ke runtime dan membuat satu slot bar navigasi
 * tidak tampil.
 */
const IKON: Record<NavHref, LucideIcon> = {
  '/dashboard': LayoutDashboard,
  '/toko': Store,
  '/toko/baru': UserPlus,
  '/keys': KeyRound,
  '/produk': Package,
  '/akun': UserCog,
};

const ITEMS = NAV_ITEMS.map((item) => ({ ...item, Icon: IKON[item.href] }));

/** Bar navigasi bawah. Dipasang sebagai sibling terakhir di dalam shell. */
export function AppNav({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Navigasi utama" className="app-nav">
      {ITEMS.map(({ href, short, Icon }) => {
        const aktif = slotAktif(href, pathname);
        return (
          <Link
            key={href}
            href={href}
            // Bar bawah selalu terlihat, jadi Next akan auto-prefetch kelima
            // route begitu halaman terbuka. Prefetch itu berebut bandwidth
            // dengan LCP saat load pertama, dan tiap prefetch `/_rsc=` juga
            // menjalankan render server penuh untuk halaman tuanya. Dimatikan;
            // navigasi berikutnya tetap cepat karena RSC-nya di-cache router.
            prefetch={false}
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
 * `aria-modal`, plus penguncian scroll body. Untuk satu aksi saja ("Keluar")
 * itu berlebihan dan di HP menutupi layar. Sekarang dropdown kecil yang
 * menempel di bawah avatar, tanpa backdrop, tanpa kunci scroll, tanpa
 * `fixed` + centering.
 *
 * Sekarang memakai `<details>`: tombol buka-tutup-nya milik browser, jadi menu
 * berfungsi di halaman yang sengaja disajikan tanpa JavaScript. Yang hilang:
 * "klik di luar menutup" dan "Escape menutup" - keduanya butuh JS, dan
 * menambahkannya kembali berarti menarik React ke dalam shell.
 *
 * `right-0` menjaga dropdown tetap di dalam viewport walau layar sempit.
 */
export function AccountMenu({ email, demo = false }: { email: string; demo?: boolean }) {
  return (
    <details className="akun-menu relative shrink-0">
      <summary className="app-avatar" aria-label="Menu akun">
        {inisial(email)}
      </summary>

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
          <p className="mx-1.5 mt-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[12px] font-semibold leading-snug text-amber-900">
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
    </details>
  );
}
