/**
 * Peta navigasi admin — dipakai bersama oleh bagian server dan bagian client.
 *
 * Kenapa file terpisah: `judulHalaman()` adalah fungsi biasa, tapi tadinya ia
 * hidup di `app-nav.tsx` yang ber-`'use client'`. Mengimpornya ke Server
 * Component tidak akan berhasil — modul `'use client'` diekspor sebagai
 * referensi proxy, bukan kode asli, jadi pemanggilannya gagal saat render.
 *
 * Modul ini sengaja TANPA `'use client'` supaya bisa dipakai di dua sisi.
 *
 * `NAV_ITEMS` adalah SATU-SATUNYA sumber kebenaran untuk href/label/urutan.
 * `app-nav.tsx` attaching ikon ke daftar ini (bukan punya daftarnya sendiri),
 * supaya label dan urutan tidak pernah bisa berbeda di dua tempat.
 */

/** Slot navigasi tanpa ikon — aman dipakai dari server maupun client. */
export interface NavItem {
  href: NavHref;
  /** Label penuh, dipakai di topbar. */
  label: string;
  /** Label pendek, dipakai di bar navigasi bawah pada layar kecil. */
  short: string;
}

/** Urutannya sama dengan urutan visual bar navigasi bawah. */
export const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', short: 'Beranda' },
  { href: '/toko', label: 'Toko', short: 'Toko' },
  { href: '/toko/baru', label: 'Daftar Toko Baru', short: 'Daftar' },
  { href: '/keys', label: 'Semua Key', short: 'Key' },
  { href: '/produk', label: 'Produk', short: 'Produk' },
  { href: '/akun', label: 'Akun Toko', short: 'Akun' },
] as const;

/** Gabungan tipe semua href — dipakai supaya peta ikon wajib lengkap. */
export type NavHref = (typeof NAV_ITEMS)[number]['href'];

/**
 * Slot menu aktif untuk sebuah pathname.
 *
 * `/toko/baru` punya slot sendiri, jadi harus dikecualikan dari prefix
 * `/toko` — kalau tidak, dua slot aktif menyala bersamaan di halaman itu.
 */
export function slotAktif(href: string, pathname: string): boolean {
  if (href === '/toko') {
    return pathname === '/toko' || (pathname.startsWith('/toko/') && pathname !== '/toko/baru');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Judul halaman untuk topbar — mengikuti slot menu yang aktif. */
export function judulHalaman(pathname: string): string {
  const cocok = NAV_ITEMS.find(({ href }) => slotAktif(href, pathname));
  return cocok?.label ?? 'Admin Portal';
}
