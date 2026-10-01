import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { UserPlus } from 'lucide-react';

import { StoreManager } from '@/components/admin/store-manager';
import { getStores } from '@/lib/data';
import { requireAdmin } from '@/lib/supabase/guard';

export const metadata: Metadata = { title: 'Manajemen Toko' };
export const dynamic = 'force-dynamic';

export default async function TokoPage() {
  const auth = await requireAdmin();
  if (!auth.ok) redirect('/login');

  const stores = await getStores();
  const aktif = stores.filter((s) => s.is_active).length;

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        {/* Judul ada di app bar; di sini cukup ringkasan angka. */}
        <p className="text-[13px] text-zinc-500">
          {stores.length} toko terdaftar · {aktif} aktif · {stores.length - aktif} nonaktif
        </p>
        <Link
          href="/toko/baru"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 text-[14px] font-semibold text-white transition active:scale-[0.99]"
        >
          <UserPlus className="h-4 w-4" />
          Daftar Toko Baru
        </Link>
      </header>

      <StoreManager stores={stores} />
    </div>
  );
}
