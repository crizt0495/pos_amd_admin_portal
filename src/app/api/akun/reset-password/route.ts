import { NextResponse } from 'next/server';

import { bacaJson, jsonGagal, jsonOk, wajibAdmin } from '@/lib/api-guard';
import { cekPassword } from '@/lib/validasi';
import { demoAktif } from '@/lib/demo/config';
import { demoCariStore } from '@/lib/demo/data';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/akun/reset-password — reset password akun toko secara manual.
 *
 * Body: { store_id, password_baru }
 *
 * Pakai `auth.admin.updateUserById()` karena kita pegang service role. Password
 * TIDAK pernah dikirim lewat email (tidak ada SMTP di setup ini) — jadi admin
 * yang harus menyebutkan password baru ke pemilik toko lewat kanal yang dia
 * pilih (WA, telepon, dll). Aplikasi sengaja tidak pernah mengirim/menyimpan
 * password lama.
 */
export async function POST(req: Request) {
  const admin = await wajibAdmin();
  if (admin.error) return admin.error;

  const body = await bacaJson<{ store_id?: string; password_baru?: string }>(req);
  if (!body) return jsonGagal('Body JSON tidak valid.');

  const storeId = String(body.store_id ?? '').trim();
  const password = body.password_baru ?? '';

  if (!storeId) return jsonGagal('store_id wajib diisi.');
  const errPw = cekPassword(password, true);
  if (errPw) {
    return NextResponse.json(
      { ok: false, message: errPw, errors: { password_baru: errPw } },
      { status: 422 },
    );
  }

  // Mode demo: tidak ada auth user sungguhan, jadi hanya konfirmasi.
  if (demoAktif) {
    const toko = demoCariStore(storeId);
    if (!toko) return jsonGagal('Toko tidak ditemukan.', 404);
    return jsonOk(`[DEMO] Password akun ${toko.email ?? toko.nama_toko} "di-reset" (tidak ada efek nyata).`);
  }

  const db = createAdminClient();
  const { data: toko } = await db
    .from('partners')
    .select('id, user_id, nama_toko, email')
    .eq('id', storeId)
    .maybeSingle();

  if (!toko) return jsonGagal('Toko tidak ditemukan.', 404);
  if (!toko.user_id) return jsonGagal('Toko ini tidak terhubung ke akun auth.', 400);

  const { error: errUpdate } = await db.auth.admin.updateUserById(toko.user_id, { password });
  if (errUpdate) return jsonGagal(`Gagal reset password: ${errUpdate.message}`, 502);

  return jsonOk(
    `Password akun ${toko.email ?? toko.nama_toko} berhasil di-reset. Sampaikan password baru ke pemilik toko.`,
  );
}
