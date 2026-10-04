import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { UserPlus } from 'lucide-react';

import { AkunCari, AkunDaftar, AkunFlash, filterToko } from '@/components/admin/akun-daftar';
import { getStores } from '@/lib/data';
import { requireAdmin } from '@/lib/supabase/guard';

export const metadata: Metadata = { title: 'Akun Toko' };

// Selalu dinamis: kuota & status akun ikut berubah begitu ada top up atau reset
// password, jadi tidak boleh pernah disimpan di cache Full Route / Data Cache.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Panjang maksimum `?q=`. Query lebih panjang dipotong, bukan ditolak. */
const MAKS_Q = 80;

/** `searchParams` selalu `string | string[] | undefined`; ebook jadi string di sini. */
function satu(nilai: string | string[] | undefined): string {
  if (Array.isArray(nilai)) return nilai[0] ?? '';
  return nilai ?? '';
}

export default async function AkunPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const auth = await requireAdmin();
  if (!auth.ok) redirect('/login');

  /*
   * `requireAdmin()` dan `getStores()` sudah dibungkus React `cache()` di
   * lib/supabase/guard.ts dan lib/data.ts, jadi layout `(admin)` yang juga
   * memanggil `requireAdmin()` tidak menyebabkan verifikasi token berjalan dua
   * kali per muat halaman.
   */

  const q = satu(searchParams.q).slice(0, MAKS_Q);
  const ok = satu(searchParams.ok);
  const err = satu(searchParams.err);

  const stores = await getStores();

  /*
   * Hanya toko yang terhubung ke akun Supabase Auth yang bisa login. Baris
   * tanpa `user_id` tidak bisa di-reset dari halaman ini, jadi tidak ditampilkan
   * di daftar - hanya dilaporkan di peringatan di bawah (lihat `AkunDaftar`).
   */
  const denganAkun = stores.filter((s) => !!s.user_id);
  const terfilter = filterToko(denganAkun, q);
  const tanpaAkun = stores.filter((s) => !s.user_id);

  /*
   * Jalur kembali untuk form POST. Hanya `q` yang dipertahankan: `ok`/`err`
   * ikut dibuang supaya pesan lama tidak bertahan setelah aksi berikutnya, dan
   * supaya URL tidak tumbuh setiap kali form dikirim.
   */
  const ulang = q ? `/akun?q=${encodeURIComponent(q)}` : '/akun';

  return (
    <div className="space-y-4">
      <AkunFlash ok={ok} err={err} />

      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        {/* Judul ada di app bar; di sini cukup penjelas singkat. */}
        <p className="max-w-2xl text-[13px] text-zinc-500">
          Semua email/username yang bisa login ke portal toko. Reset password &amp; generate kuota
          massal bisa dilakukan di sini.
        </p>
        <Link href="/toko/baru" prefetch={false} className="btn-outline shrink-0">
          <UserPlus className="h-4 w-4" />
          Daftar Toko Baru
        </Link>
      </header>

      <AkunCari q={q} jumlah={denganAkun.length} />

      <AkunDaftar stores={terfilter} q={q} ulang={ulang} />

      {/* Peringatan: toko tanpa akun auth. */}
      {tanpaAkun.length > 0 ? (
        <div className="card-soft p-3.5">
          <p className="text-[12.5px] leading-relaxed text-zinc-600">
            {tanpaAkun.length} baris toko tidak terhubung ke akun Supabase Auth sehingga tidak bisa
            login dan tidak bisa reset password dari sini:{' '}
            <strong className="text-zinc-800">
              {tanpaAkun.map((s) => s.nama_toko).join(', ')}
            </strong>
            . Perbaiki manual di Supabase Dashboard.
          </p>
        </div>
      ) : null}
    </div>
  );
}
