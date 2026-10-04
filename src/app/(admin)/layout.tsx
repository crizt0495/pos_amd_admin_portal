import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { AppShell } from '@/components/admin/app-shell';
import { Toaster } from '@/components/ui/toast';
import { demoAktif } from '@/lib/demo/config';
import { requireAdmin } from '@/lib/supabase/guard';

/**
 * Layout terproteksi untuk SEMUA halaman admin.
 *
 * Ini lapisan KEAMANAN yang sesungguhnya: middleware hanya melakukan redirect
 * cepat berdasarkan ada/tidaknya cookie sesi, tapi role `super_admin` baru
 * dipastikan di sini lewat `requireAdmin()` (verifikasi token + cek
 * app_metadata / ADMIN_EMAIL).
 *
 * `requireAdmin()` dibungkus React `cache()`, jadi pemanggilan dari layout dan
 * dari halaman memakai SATU hasil yang sama: verifikasi token Supabase tidak
 * diulang dua kali per muat halaman.
 */
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireAdmin();
  if (!auth.ok) redirect('/login');

  /*
   * Pathname datang dari middleware (request header `x-pathname`). Shell butuh
   * ini untuk judul topbar dan slot navigasi yang aktif, dan sengaja tidak
   * membaca `usePathname()` — pemanggilan itu akan membuat shell jadi Client
   * Component, dan Client Component di dalam shell berarti seluruh isi halaman
   * ikut ter-hydrate.
   */
  const pathname = (await headers()).get('x-pathname') ?? '/dashboard';

  return (
    /*
     * `Toaster` sengaja dipasang sebagai SAUDAR `AppShell`, bukan provider di
     * atasnya. Begitu Client Component membungkus `{children}`, React
     * me-hydrate seluruh isi halaman, dan di sinilah biaya utamanya.
     */
    <>
      <AppShell pathname={pathname} email={auth.user.email} demo={demoAktif}>
        {children}
      </AppShell>
      <Toaster />
    </>
  );
}
