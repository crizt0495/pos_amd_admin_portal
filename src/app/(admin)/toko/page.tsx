import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { UserPlus } from 'lucide-react';

import { StoreDaftar } from '@/components/admin/store-daftar';
import { StoreKosong, StorePaginasi, StoreToolbar } from '@/components/admin/store-toolbar';
import { getStoresPaged } from '@/lib/data';
import { angka } from '@/lib/format';
import { requireAdmin } from '@/lib/supabase/guard';

export const metadata: Metadata = { title: 'Manajemen Toko' };

// Halaman ini SELALU dinamis: kuota & status toko ikut berubah begitu ada top up
// atau hapus, jadi tidak boleh pernah disimpan di cache Full Route / Data Cache.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** (searchParams) selalu string|string[]|undefined — ebook jadi string di sini. */
function satu(nilai: string | string[] | undefined): string {
  if (Array.isArray(nilai)) return nilai[0] ?? '';
  return nilai ?? '';
}

export default async function TokoPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const auth = await requireAdmin();
  if (!auth.ok) redirect('/login');

  // Semua filter datang dari URL, bukan dari state di browser. Keuntungannya:
  // hasil pencarian bisa di-share, di-back, dan di-refresh tanpa kehilangan.
  const q = satu(searchParams.q).slice(0, 80);
  const pageRaw = Number.parseInt(satu(searchParams.page), 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  // `getStoresPaged` sudah meng-clamp nomor halaman ke halaman terakhir yang ada
  // datanya, jadi `?page=99` aman dan tidak perlu `redirect()` di sini.
  // Jangan menambahkan `redirect()`: halaman ini punya `loading.tsx`, jadi Next
  // mulai streaming lebih dulu dan `redirect()` tidak bisa mengirim 307.
  const { stores, total, page: hal, perHalaman, totalHalaman } = await getStoresPaged({ q, page });

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        {/* Judul ada di app bar; di sini cukup ringkasan angka. */}
        <p className="text-[13px] text-zinc-500">
          {angka(total)} toko terdaftar · {stores.filter((s) => s.is_active).length} aktif di halaman ini
        </p>
        <Link
          href="/toko/baru"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 text-[14px] font-semibold text-white transition active:scale-[0.99]"
        >
          <UserPlus className="h-4 w-4" />
          Daftar Toko Baru
        </Link>
      </header>

      {/*
        Urutan di bawah itu disengaja: `StoreDaftar` adalah Server Component,
        sedangkan `StoreToolbar`/`StorePaginasi`/`StoreKosong` adalah island.
        Semua ini SAUDAR, tidak ada island yang membungkus daftar — kalau
        dibungkus, React akan hydrate daftar itu juga dan seluruhnya jadi sia-sia.
      */}
      <StoreToolbar q={q} total={total} />

      {stores.length === 0 ? (
        <StoreKosong adaFilter={Boolean(q)} />
      ) : (
        <>
          <p className="text-[12px] text-zinc-500">
            Menampilkan {(hal - 1) * perHalaman + 1}–{Math.min(hal * perHalaman, total)} dari{' '}
            {angka(total)} toko
            {q ? ` untuk "${q}"` : ''}
          </p>

          <StoreDaftar stores={stores} />

          <StorePaginasi page={hal} totalHalaman={totalHalaman} jumlah={stores.length} />
        </>
      )}
    </div>
  );
}
