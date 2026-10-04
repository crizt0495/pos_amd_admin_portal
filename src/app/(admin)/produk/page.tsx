import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ProdukCatatan, ProdukDaftar, ProdukHeader } from '@/components/admin/produk-daftar';
import { getProduk } from '@/lib/data';
import { requireAdmin } from '@/lib/supabase/guard';

export const metadata: Metadata = { title: 'Daftar Produk' };

// Selalu dinamis: harga produk bisa diubah admin kapan saja lewat dialog di
// halaman ini, jadi tidak boleh pernah disimpan di cache Full Route / Data Cache.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ProdukPage() {
  const auth = await requireAdmin();
  if (!auth.ok) redirect('/login');

  /*
   * `requireAdmin()` dan `getProduk()` sudah dibungkus React `cache()` di
   * lib/supabase/guard.ts dan lib/data.ts, jadi layout `(admin)` yang juga
   * memanggil `requireAdmin()` tidak menyebabkan verifikasi token berjalan dua
   * kali per muat halaman.
   */
  const produk = await getProduk();

  // Peringatan hanya tampil kalau memang ada produk yang belum lengkap
  // harganya, bukan "selalu tampil" supaya tidak jadi noise yang diabaikan.
  const adaTanpaHarga = produk.some(
    (p) => p.harga_sekali_bayar === null || p.harga_langganan_tahunan === null,
  );

  return (
    <div className="space-y-4">
      <ProdukHeader jumlah={produk.length} />
      <ProdukDaftar produk={produk} />
      <ProdukCatatan adaTanpaHarga={adaTanpaHarga} />
    </div>
  );
}
