import { NextResponse } from 'next/server';

import { bacaJson, jsonGagal, jsonOk, wajibAdmin } from '@/lib/api-guard';
import { simpanProduk } from '@/lib/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/produk — tambah produk baru ke katalog.
 *
 * Body: `{ nama_apariksi, harga_sekali_bayar, harga_langganan_tahunan, deskripsi }`
 *
 * Kedua harga boleh `null` (= belum diisi). `null` disimpan apa adanya, bukan
 * diubah jadi 0, karena view `admin_keys` memakai perbedaan itu untuk
 * membedakan "gratis" dari "belum diketahui".
 *
 * Validasi TIDAK diulang di sini: `simpanProduk()` sudah memanggil
 * `produkError()` — fungsi yang sama dengan yang dipakai form di browser.
 * Mengulanginya di dua tempat berarti aturannya bisa berubah di satu tempat
 * saja dan tidak kelihatan.
 *
 * Ubah dan hapus ada di `/api/produk/[id]`, bukan di sini: route ini tidak punya
 * segmen dinamis, jadi tidak ada `params.id` yang bisa diambil.
 */
export async function POST(req: Request) {
  const admin = await wajibAdmin();
  if (admin.error) return admin.error;

  const body = await bacaJson<Record<string, unknown>>(req);
  if (!body) return jsonGagal('Body harus berupa JSON.', 400);

  const hasil = await simpanProduk(null, body);
  if (!hasil.ok) return jsonGagal(hasil.error, 400);

  return jsonOk(`Produk "${hasil.produk.nama_apariksi}" tersimpan.`, hasil.produk, 201);
}
