import { NextResponse } from 'next/server';

import { bacaJson, jsonGagal, jsonOk, wajibAdmin } from '@/lib/api-guard';
import { cekPassword } from '@/lib/validasi';
import { demoAktif } from '@/lib/demo/config';
import { demoCariStore } from '@/lib/demo/data';
import { balik, jalurKembali, postingForm } from '@/lib/form-post';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Halaman asal untuk form native di `/akun`. */
const ASAL_AKUN = '/akun';

/**
 * POST /api/akun/reset-password — reset password akun toko secara manual.
 *
 * Dua pemanggil, satu route:
 *   1. `<form method="post">` dari `/akun` (halaman tanpa JavaScript)
 *      -> 303 kembali ke `/akun` dengan pesan di query string.
 *   2. `fetch()` dari Client Component -> JSON seperti biasa.
 *
 * Pakai `auth.admin.updateUserById()` karena kita pegang service role. Password
 * TIDAK pernah dikirim lewat email (tidak ada SMTP di setup ini) — jadi admin
 * yang harus menyebutkan password baru ke pemilik toko lewat kanal yang dia
 * pilih (WA, telepon, dll). Aplikasi sengaja tidak pernah mengirim atau
 * menyimpan password lama.
 */
export async function POST(req: Request) {
  const admin = await wajibAdmin();
  if (admin.error) return admin.error;

  const dariForm = postingForm(req);

  let storeId = '';
  let password = '';
  let asal = ASAL_AKUN;

  if (dariForm) {
    const fd = await req.formData();
    storeId = String(fd.get('store_id') ?? '').trim();
    password = String(fd.get('password_baru') ?? '');
    asal = jalurKembali(fd.get('_ulang'), ASAL_AKUN);
  } else {
    const body = await bacaJson<{ store_id?: string; password_baru?: string }>(req);
    if (!body) return jsonGagal('Body JSON tidak valid.');
    storeId = String(body.store_id ?? '').trim();
    password = body.password_baru ?? '';
  }

  if (!storeId) return tolak(dariForm, asal, 'store_id wajib diisi.');

  const errPw = cekPassword(password, true);
  if (errPw) {
    /*
     * `errors` sengaja hanya di jalur JSON. Form native tidak punya tempat
     * untuk menaruh peta error per-field: pesannya muncul sebagai banner di
     * atas halaman, yang sudah cukup untuk menjelaskan apa yang salah.
     */
    return dariForm
      ? balik(asal, { err: errPw })
      : NextResponse.json(
          { ok: false, message: errPw, errors: { password_baru: errPw } },
          { status: 422 },
        );
  }

  // Mode demo: tidak ada auth user sungguhan, jadi hanya konfirmasi.
  if (demoAktif) {
    const toko = demoCariStore(storeId);
    if (!toko) return tolak(dariForm, asal, 'Toko tidak ditemukan.');
    return terima(
      dariForm,
      asal,
      `[DEMO] Password akun ${toko.email ?? toko.nama_toko} "di-reset" (tidak ada efek nyata).`,
    );
  }

  const db = createAdminClient();
  const { data: toko } = await db
    .from('partners')
    .select('id, user_id, nama_toko, email')
    .eq('id', storeId)
    .maybeSingle();

  if (!toko) return tolak(dariForm, asal, 'Toko tidak ditemukan.');
  if (!toko.user_id) return tolak(dariForm, asal, 'Toko ini tidak terhubung ke akun auth.');

  const { error: errUpdate } = await db.auth.admin.updateUserById(toko.user_id, { password });
  if (errUpdate) return tolak(dariForm, asal, `Gagal reset password: ${errUpdate.message}`);

  return terima(
    dariForm,
    asal,
    `Password akun ${toko.email ?? toko.nama_toko} berhasil di-reset. Sampaikan password baru ke pemilik toko.`,
  );
}

/** Balasan gagal: 303 ke halaman asal (form) atau JSON (island). */
function tolak(dariForm: boolean, asal: string, pesan: string) {
  return dariForm ? balik(asal, { err: pesan }) : jsonGagal(pesan, 400);
}

/** Balasan sukses: 303 ke halaman asal (form) atau JSON (island). */
function terima(dariForm: boolean, asal: string, pesan: string) {
  return dariForm ? balik(asal, { ok: pesan }) : jsonOk(pesan);
}
