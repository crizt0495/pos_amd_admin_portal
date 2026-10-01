import { redirect } from 'next/navigation';

import { Sidebar } from '@/components/admin/sidebar';
import { ToastProvider } from '@/components/ui/toast';
import { demoAktif } from '@/lib/demo/config';
import { requireAdmin } from '@/lib/supabase/guard';
import { cn } from '@/lib/utils';

/**
 * Layout terproteksi untuk SEMUA halaman admin.
 *
 * Ini lapisan KEAMANAN yang sesungguhnya: middleware hanya redo redirect
 * berdasarkan ada/tidaknya cookie sesi, tapi role `super_admin` baru
 * dipastikan di sini lewat `requireAdmin()` (verifikasi token + cek
 * app_metadata / ADMIN_EMAIL).
 */
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireAdmin();
  if (!auth.ok) redirect('/login');

  return (
    <ToastProvider>
      <div className="admin-shell">
        <Sidebar email={auth.user.email} demo={demoAktif} />
        {/* `pt-14` menyisakan ruang untuk tombol menu mengambang di layar
            kecil; banner-nya sendiri disembunyikan di desktop karena sidebar
            sudah membawa badge yang sama. */}
        <div className={cn('admin-main', demoAktif && 'pt-14 lg:pt-0')}>
          {demoAktif ? (
            <p
              role="status"
              className="mx-4 mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] font-semibold text-amber-900 sm:mx-6 lg:hidden"
            >
              Mode demo — data palsunya, tanpa database.
            </p>
          ) : null}
          <div className="admin-content">{children}</div>
        </div>
      </div>
    </ToastProvider>
  );
}
