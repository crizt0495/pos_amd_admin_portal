import { redirect } from 'next/navigation';

import { AppShell } from '@/components/admin/app-shell';
import { ToastProvider } from '@/components/ui/toast';
import { demoAktif } from '@/lib/demo/config';
import { requireAdmin } from '@/lib/supabase/guard';

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
      <AppShell email={auth.user.email} demo={demoAktif}>
        {children}
      </AppShell>
    </ToastProvider>
  );
}
