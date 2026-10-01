import { bacaJson, jsonGagal, jsonOk, wajibAdmin } from '@/lib/api-guard';
import { cekJumlahKey } from '@/lib/validasi';
import { demoAktif } from '@/lib/demo/config';
import { demoTopup } from '@/lib/demo/data';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/topup — isi ulang / top up kuota 1 toko.
 *
 * Body: { store_id, jumlah_key, catatan? }
 *  - `jumlah_key` POSITIF  = tambah kuota (mis. +5)
 *  - `jumlah_key` NEGATIF = kurangi kuota (koreksi admin)
 *
 * Cara kerja: memanggil RPC `admin_topup()` yang mengunci baris (`FOR UPDATE`)
 * supaya dua admin yang top up bersamaan tidak saling menimpa, lalu menulis
 * `topup_history`. Sisa kuota dijaga >= 0 di SQL.
 */
export async function POST(req: Request) {
  const admin = await wajibAdmin();
  if (admin.error) return admin.error;

  const body = await bacaJson<{
    store_id?: string;
    jumlah_key?: number;
    catatan?: string;
  }>(req);
  if (!body) return jsonGagal('Body JSON tidak valid.');

  const storeId = String(body.store_id ?? '').trim();
  if (!storeId) return jsonGagal('store_id wajib diisi.');

  const jumlah = Number(body.jumlah_key);
  const errJumlah = cekJumlahKey(jumlah);
  if (errJumlah) return jsonGagal(errJumlah);

  // Mode demo: ubah angka di memory, tetap pakai aturan clamp yang sama.
  if (demoAktif) {
    const hasil = demoTopup(storeId, Math.trunc(jumlah), (body.catatan ?? '').trim() || null, admin.user.email);
    if (!hasil.ok) return jsonGagal(hasil.pesan, 404);
    const terapkan = hasil.jumlah_diterapkan;
    const catatanTambahan =
      terapkan !== jumlah ? ` (diminta ${jumlah}, diterapkan ${terapkan} karena sisa tidak boleh negatif)` : '';
    return jsonOk(
      `[DEMO] Kuota toko ${terapkan >= 0 ? 'bertambah' : 'berkurang'} ${Math.abs(terapkan)} key. Sisa sekarang ${hasil.sisa_kuota} key${catatanTambahan}.`,
      { sisa_kuota: hasil.sisa_kuota, jumlah_diterapkan: terapkan },
    );
  }

  const db = createAdminClient();
  const { data, error } = await db.rpc('admin_topup', {
    p_store_id: storeId,
    p_jumlah: Math.trunc(jumlah),
    p_catatan: (body.catatan ?? '').trim() || null,
    p_admin_by: admin.user.email,
  });

  if (error) {
    // Pesan dari raise exception SQL dipakai apa adanya (sudah Bahasa Indonesia).
    return jsonGagal(error.message || 'Gagal top up.', 400);
  }

  const hasil = (data?.[0] ?? {}) as { sisa_kuota?: number; jumlah_diterapkan?: number };
  const terapkan = hasil.jumlah_diterapkan ?? jumlah;

  // Bila pengurangan melebihi kuota, terapkan bisa < jumlah (sisa dikunci 0).
  const catatanTambahan =
    terapkan !== jumlah ? ` (diminta ${jumlah}, diterapkan ${terapkan} karena sisa tidak boleh negatif)` : '';

  return jsonOk(
    `Kuota toko ${terapkan >= 0 ? 'bertambah' : 'berkurang'} ${Math.abs(terapkan)} key. Sisa sekarang ${hasil.sisa_kuota ?? 0} key${catatanTambahan}.`,
    { sisa_kuota: hasil.sisa_kuota ?? 0, jumlah_diterapkan: terapkan },
  );
}
