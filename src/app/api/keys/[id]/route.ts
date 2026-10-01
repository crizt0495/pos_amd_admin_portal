import { bacaJson, jsonGagal, jsonOk, wajibAdmin } from '@/lib/api-guard';
import { createAdminClient } from '@/lib/supabase/admin';
import type { LicenseStatus } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

/**
 * PATCH /api/keys/[id] — ubah status serial key (revoke / aktifkan kembali).
 *
 * Body: { status: 'unused' | 'active' | 'blocked' | 'revoked' }
 *
 * Memakai RPC `admin_revoke_key()` yang (a) mengunci baris, (b) saat status
 * 'revoked' melepas hwid + activated_at supaya key bisa di-generate/akai lagi
 * tanpa sisa kunci perangkat lama.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const admin = await wajibAdmin();
  if (admin.error) return admin.error;

  const body = await bacaJson<{ status?: LicenseStatus }>(req);
  if (!body?.status) return jsonGagal('Field "status" wajib diisi.');

  const status = body.status;
  if (!['unused', 'active', 'blocked', 'revoked'].includes(status)) {
    return jsonGagal('Status tidak valid.');
  }

  const db = createAdminClient();
  const { data, error } = await db.rpc('admin_revoke_key', {
    p_key_id: params.id,
    p_status: status,
  });

  if (error) return jsonGagal(error.message || 'Gagal mengubah status key.', 400);

  const hasil = (data?.[0] ?? {}) as { serial_key?: string; status?: string };
  const namaStatus = {
    unused: 'belum dipakai',
    active: 'aktif',
    blocked: 'diblokir',
    revoked: 'dicabut',
  }[status];

  return jsonOk(`Key ${hasil.serial_key ?? ''} kini ${namaStatus}.`, hasil);
}
