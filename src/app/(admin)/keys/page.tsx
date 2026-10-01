import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { KeyRound } from 'lucide-react';

import { KeyManager } from '@/components/admin/key-manager';
import { getKeys } from '@/lib/data';
import { rupiah } from '@/lib/format';
import { requireAdmin } from '@/lib/supabase/guard';

export const metadata: Metadata = { title: 'Manajemen Serial Key' };
export const dynamic = 'force-dynamic';

/** Batas baris yang dimuat per halaman — Sisanya bisa dicari via filter/limit. */
const BATAS = 500;

export default async function KeysPage() {
  const auth = await requireAdmin();
  if (!auth.ok) redirect('/login');

  const { keys, total } = await getKeys(BATAS);
  const komisiTotal = keys.reduce((s, k) => s + (k.komisi ?? 0), 0);
  const aktifCount = keys.filter((k) => k.status === 'active').length;
  const belumCount = keys.filter((k) => k.status === 'unused').length;
  const dicabutCount = keys.filter((k) => k.status === 'revoked').length;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="flex items-center gap-2 text-[20px] font-bold text-zinc-900">
          <KeyRound className="h-5 w-5 text-zinc-500" />
          Manajemen Serial Key Global
        </h1>
        <p className="mt-0.5 text-[13px] text-zinc-500">
          {total} key dari semua toko · {aktifCount} aktif · {belumCount} belum dipakai ·{' '}
          {dicabutCount} dicabut · komisi total {rupiah(komisiTotal)}
        </p>
      </header>

      <KeyManager keys={keys} total={total} />
    </div>
  );
}
