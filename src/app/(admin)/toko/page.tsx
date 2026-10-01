import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Store as StoreIcon, UserPlus } from 'lucide-react';

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
        <div>
          <h1 className="flex items-center gap-2 text-[20px] font-bold text-zinc-900">
            <StoreIcon className="h-5 w-5 text-zinc-500" />
            Manajemen Toko
          </h1>
          <p className="mt-0.5 text-[13px] text-zinc-500">
            {stores.length} toko terdaftar · {aktif} aktif · {stores.length - aktif} nonaktif
          </p>
        </div>
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
