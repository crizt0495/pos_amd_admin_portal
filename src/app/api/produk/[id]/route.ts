import { bacaJson, jsonGagal, jsonOk, wajibAdmin } from '@/lib/api-guard';
import { hapusProduk, simpanProduk } from '@/lib/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * PATCH /api/produk/[id] — ubah nama / harga / deskripsi satu produk.
 *
 * `PATCH` (bukan `POST`) supaya tidak bisa tertukar dengan "tambah": `POST`
 * selalu membuat baris baru, `PATCH` selalu mengubah baris yang id-nya disebut.
 * Kalau sampai tertukar, akibatnya bukan error yang kelihatan tapi satu produk
 * dobel di katalog.
 *
 * Body diterima utuh (bukan patch sebagian): form edit mengirim semua kolom,
 * jadi tidak ada keadaan parsial yang bisa membuat nama terisi tapi harga kosong
 * tanpa sengaja.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await wajibAdmin();
  if (admin.error) return admin.error;

  const { id } = await ctx.params;
  const body = await bacaJson<Record<string, unknown>>(req);
  if (!body) return jsonGagal('Body harus berupa JSON.', 400);

  const hasil = await simpanProduk(id, body);
  if (!hasil.ok) return jsonGagal(hasil.error, 400);

  return jsonOk(`Produk "${hasil.produk.nama_apariksi}" diperbarui.`, hasil.produk);
}

/**
 * DELETE /api/produk/[id] — hapus satu produk dari katalog.
 *
 * Menghapus produk TIDAK menghapus key yang sudah terjual
 * (`licenses.produk_id` memakai `on delete set null`). Yang hilang adalah acuan
 * harganya: key itu menyumbang 0 ke estimasi komisi sampai ditautkan ke produk
 * lain. Jumlahnya dikembalikan supaya UI bisa memperingatkan akibatnya, bukan
 * hanya melaporkan "berhasil".
 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await wajibAdmin();
  if (admin.error) return admin.error;

  const { id } = await ctx.params;
  const hasil = await hapusProduk(id);
  if (!hasil.ok) return jsonGagal(hasil.error, 404);

  /*
   * Konsekuensinya ikut dikirim di dalam `message`, bukan cuma di `data`, supaya
   * bisa langsung dipakai `toast` tanpa logika tambahan di sisi client.
   */
  const catatan =
    hasil.kehilangan > 0
      ? ` ${hasil.kehilangan} key kehilangan acuan harga produk ini.`
      : '';

  return jsonOk(`Produk "${hasil.nama}" dihapus.${catatan}`, {
    nama: hasil.nama,
    kehilangan: hasil.kehilangan,
  });
}
