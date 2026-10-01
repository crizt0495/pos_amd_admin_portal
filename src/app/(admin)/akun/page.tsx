import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { UserPlus, Users } from 'lucide-react';
import Link from 'next/link';

import { AkunManager } from '@/components/admin/akun-manager';
import { getStores } from '@/lib/data';
import { requireAdmin } from '@/lib/supabase/guard';

export const metadata: Metadata = { title: 'Akun Toko' };
export const dynamic = 'force-dynamic';

export default async function AkunPage() {
  const auth = await requireAdmin();
  if (!auth.ok) redirect('/login');

  const stores = await getStores();

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-[20px] font-bold text-zinc-900">
            <Users className="h-5 w-5 text-zinc-500" />
            Akun Toko
          </h1>
          <p className="mt-0.5 text-[13px] text-zinc-500">
            Semua email/username yang bisa login ke portal toko. Reset password & generate kuota
            massal bisa dilakukan di sini.
          </p>
        </div>
        <Link
          href="/toko/baru"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 text-[14px] font-semibold text-zinc-800 transition active:scale-[0.99]"
        >
          <UserPlus className="h-4 w-4" />
          Daftar Toko Baru
        </Link>
      </header>

      <AkunManager stores={stores} />
    </div>
  );
}
