import { bacaJson, jsonGagal, jsonOk, wajibAdmin } from '@/lib/api-guard';
import { cekJumlahKey } from '@/lib/validasi';
import { createAdminClient } from '@/lib/supabase/admin';
import type { TopupResult } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/topup/bulk — top up BANYAK toko sekaligus (isi kuota massal).
 *
 * Body: { store_ids: string[], jumlah_key, catatan? }
 *
 * Semua toko diproses dalam 1 transaksi RPC (`admin_topup_bulk`). Toko yang
 * tidak ditemukan dilaporkan per-baris tanpa membatalkan yang lain, jadi
 * admin langsung tahu mana yang gagal.
 */
export async function POST(req: Request) {
  const admin = await wajibAdmin();
  if (admin.error) return admin.error;

  const body = await bacaJson<{
    store_ids?: string[];
    jumlah_key?: number;
    catatan?: string;
  }>(req);
  if (!body) return jsonGagal('Body JSON tidak valid.');

  const ids = Array.isArray(body.store_ids) ? body.store_ids.filter(Boolean) : [];
  if (ids.length === 0) return jsonGagal('Pilih minimal satu toko.');
  if (ids.length > 200) return jsonGagal('Maksimal 200 toko dalam sekali top up.');

  const jumlah = Number(body.jumlah_key);
  const errJumlah = cekJumlahKey(jumlah);
  if (errJumlah) return jsonGagal(errJumlah);

  const db = createAdminClient();
  const { data, error } = await db.rpc('admin_topup_bulk', {
    p_store_ids: ids,
    p_jumlah: Math.trunc(jumlah),
    p_catatan: (body.catatan ?? '').trim() || null,
    p_admin_by: admin.user.email,
  });

  if (error) return jsonGagal(error.message || 'Gagal top up massal.', 400);

  const hasil = (data ?? []) as TopupResult[];
  const sukses = hasil.filter((r) => r.ok).length;
  const gagal = hasil.length - sukses;

  const ringkas = `${jumlah >= 0 ? '+' : ''}${jumlah} key`;
  const pesan =
    gagal === 0
      ? `Kuota ${ringkas} diterapkan ke ${sukses} toko.`
      : `${ringkas} diterapkan ke ${sukses} toko, ${gagal} gagal (toko dihapus/diubah).`;

  return jsonOk(pesan, { hasil, sukses, gagal });
}
