import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, UserPlus } from 'lucide-react';

import { CreateStoreForm } from '@/components/admin/create-store-form';
import { requireAdmin } from '@/lib/supabase/guard';

export const metadata: Metadata = { title: 'Daftar Toko Baru' };
export const dynamic = 'force-dynamic';

export default async function TokoBaruPage() {
  const auth = await requireAdmin();
  if (!auth.ok) redirect('/login');

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <Link
          href="/toko"
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-zinc-600 transition hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke daftar toko
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-[20px] font-bold text-zinc-900">
          <UserPlus className="h-5 w-5 text-zinc-500" />
          Daftar Toko Baru
        </h1>
        <p className="mt-0.5 text-[13px] text-zinc-500">
          Sekaligus membuat akun login toko dan baris tokonya. Akun langsung aktif (tanpa verifikasi
          email).
        </p>
      </header>

      <CreateStoreForm />
    </div>
  );
}
