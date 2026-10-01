import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';

import { demoAktif, DEMO_EMAIL, KOOKIE_DEMO } from '@/lib/demo/config';
import { env, isSupabaseFullyConfigured, PESAN_ENV_BELUM_DIISI } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import type { AdminUser } from '@/types';

/**
 * Hasil `requireAdmin()`.
 *
 * Dibuat sebagai discriminated union (ada literal `ok` di KEDUA cabang) supaya
 * `if (!auth.ok)` langsung mempersempit tipe — tanpa itu TypeScript tidak bisa
 * memastikan cabang mana yang aktif.
 */
export type AdminAuthResult =
  | { ok: false; error: string; status: number }
  | { ok: true; user: AdminUser };

/**
 * =============================================================================
 *  PENJAGA AKSES ADMIN  —  satu-satunya pintu masuk data sensitif
 * =============================================================================
 *
 * Kenapa cek role DI SINI (server) dan bukan hanya di middleware?
 *  - Cookie sesi Supabase (format @supabase/ssr) tidak bisa dibaca payload JWT-nya
 *    denganandal di middleware tanpa parse ribet; yang tersedia cuma token mentah.
 *  - `middleware` tetap melakukan redirect cepat (lihat src/middleware.ts) supaya
 *    UX tidak flickering, tapi PENEGAKNYA role ada di sini.
 *
 * Urutan pemeriksaan (bukan-atau — cukup salah satu lolos):
 *  1. Sesi Supabase valid (`auth.getUser()` — benar-benar verifikasi token).
 *  2. Email-nya terdaftar di env `ADMIN_EMAIL` (bisa lebih dari satu, pisah koma).
 *  3. Atau `user.app_metadata.role === 'super_admin'`.
 *
 * Catatan: `user_metadata` (yang bisa diisi user sendiri saat signup) TIDAK
 * dipakai di sini — hanya `app_metadata` yang hanya bisa ditulis lewat service
 * role / dashboard, jadi tidak bisa dipalsukan dari sisi pengguna.
 */
export const requireAdmin = cache(async (): Promise<AdminAuthResult> => {
  // --- Mode demo (lokal saja) ---------------------------------------------
  // Dicek SEBELUM preflight Supabase: pada mode demo memang tidak ada env
  // Supabase sama sekali, jadi preflight akan selalu gagal.
  if (demoAktif) {
    const ada = (await cookies()).get(KOOKIE_DEMO)?.value === '1';
    if (!ada) return { ok: false, error: 'Belum login (mode demo).', status: 401 };
    return { ok: true, user: { userId: 'demo', email: DEMO_EMAIL } };
  }

  // Preflight: env kosong harus muncul sebagai "belum dikonfigurasi" (503),
  // bukan "sesi tidak valid" (401) yang membuat admin mengira sesinya jelek.
  if (!isSupabaseFullyConfigured()) {
    return { ok: false, error: PESAN_ENV_BELUM_DIISI, status: 503 };
  }

  const supabase = createClient();

  // getUser() = verifikasi token ke server (bukan sekadar decode cookie).
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { ok: false, error: 'Sesi tidak valid. Silakan login ulang.', status: 401 };
  }

  const email = (user.email ?? '').toLowerCase();
  if (!email) {
    return { ok: false, error: 'Akun ini tidak punya email.', status: 403 };
  }

  const daftarAdmin = env.adminEmails;
  const role = user.app_metadata?.role;

  const bolehLewatEnv = daftarAdmin.length > 0 && daftarAdmin.includes(email);
  const bolehLewatRole = role === 'super_admin';

  if (!bolehLewatEnv && !bolehLewatRole) {
    return { ok: false, error: 'Akun ini bukan admin super. Akses ditolak.', status: 403 };
  }

  return { ok: true, user: { userId: user.id, email } };
});
