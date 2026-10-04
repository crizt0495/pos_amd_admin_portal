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
 *  1. Sesi Supabase valid (`auth.getClaims()` — verifikasi tanda tangan token).
 *  2. Email-nya terdaftar di env `ADMIN_EMAIL` (bisa lebih dari satu, pisah koma).
 *  3. Atau `app_metadata.role === 'super_admin'`.
 *
 * Catatan: `user_metadata` (yang bisa diisi user sendiri saat signup) TIDAK
 * dipakai di sini — hanya `app_metadata` yang hanya bisa ditulis lewat service
 * role / dashboard, jadi tidak bisa dipalsukan dari sisi pengguna.
 *
 * ---------------------------------------------------------------------------
 * KENAPA `getClaims()` BUKAN `getUser()`
 * ---------------------------------------------------------------------------
 * `getUser()` selalu bolak-balik ke server Auth untuk verifikasi token: ~165 ms
 * per permintaan di produksi, padahal semua yang dibutuhkan portal ini sudah
 * tertulis di payload JWT.
 *
 * `getClaims()` memverifikasi tanda tangan token secara LOKAL:
 *  - Ambil kunci publik dari `/.well-known/jwks.json` (proyek ini tanda
 *    tangannya asimetris/ES256), lalu `crypto.subtle.verify` terhadap token.
 *    Kunci publik di-cache di memori proses, jadi ~2-4 ms setelah permintaan
 *    pertama.
 *  - Klaim `exp` tetap divalidasi, jadi token kedaluwarsa tetap ditolak.
 *  - `app_metadata` ADA DI DALAM payload yang ditandatangani, jadi role tetap
 *    tidak bisa dipalsukan dari sisi pengguna.
 *  - Supabase otomatis jatuh kembali ke `getUser()` kalau algoritmanya simetris
 *    (HS256) atau WebCrypto tidak tersedia — jadi tetap aman untuk proyek lama.
 *
 * Konsekuensi yang perlu diketahui (risiko yang sama dengan yang didokumentasikan
 * Supabase untuk `getClaims()`): sesi yang dicabut di sisi server masih berlaku
 * sampai access token habis masa (Supabase membatasi access token maksimal
 * 1 jam). Token yang dipakai sudah bertanda tangan resmi dan hanya bisa
 * diminta lewat login.
 */
/**
 * =============================================================================
 *  CACHE KUNCI PUBLIK (JWKS)
 * =============================================================================
 * `createClient()` membuat instance Supabase baru untuk tiap permintaan, jadi
 * cache JWKS bawaan library ikut terbuang tiap kali. Tanpa cache ini, setiap
 * permintaan admin membayar satu bolak-balik jaringan (~60 ms) hanya untuk
 * mengambil kunci publik yang isinya nyaris tidak pernah berubah.
 *
 * Disimpan di modul (per instance fungsi) dengan masa berlaku 1 jam, sama
 * seperti TTL bawaan auth-js. Kalau `kid` di-rotasi, `getClaims()` tidak
 * menemukan kunci di daftar ini lalu otomatis mengunduh ulang sendiri, jadi
 * pergantian kunci projektikanpun tetap terdukung.
 */
const JWKS_TTL_MS = 60 * 60 * 1000;

/** Tipe JWKS diambil dari tanda tangan `getClaims()` supaya tidak melenceng. */
type Jwks = NonNullable<
  Parameters<ReturnType<typeof createClient>['auth']['getClaims']>[1]
>['jwks'];

let jwksCache: { jwks: Jwks; diambilPada: number } | null = null;

async function jwksPublik(): Promise<Jwks | undefined> {
  const sekarang = Date.now();
  if (jwksCache && jwksCache.diambilPada + JWKS_TTL_MS > sekarang) return jwksCache.jwks;

  const url = `${env.supabaseUrl}/auth/v1/.well-known/jwks.json`;
  const r = await fetch(url, {
    headers: { apikey: env.supabaseAnonKey },
    cache: 'no-store',
  });
  if (!r.ok) return undefined;

  const jwks = (await r.json()) as Jwks;
  if (!Array.isArray(jwks?.keys) || jwks.keys.length === 0) return undefined;

  jwksCache = { jwks, diambilPada: sekarang };
  return jwks;
}

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

  // getClaims() = verifikasi tanda tangan token LOKAL (lihat catatan panjang di
  // atas file ini): kunci publik ES256 dari JWKS, plus validasi `exp`. Jauh lebih
  // cepat daripada getUser() yang bolak-balik ke server Auth tiap permintaan.
  const { data, error } = await supabase.auth.getClaims(undefined, { jwks: await jwksPublik() });
  const claims = data?.claims;

  if (error || !claims) {
    return { ok: false, error: 'Sesi tidak valid. Silakan login ulang.', status: 401 };
  }

  const email = (claims.email ?? '').toLowerCase();
  if (!email) {
    return { ok: false, error: 'Akun ini tidak punya email.', status: 403 };
  }

  const daftarAdmin = env.adminEmails;
  // `app_metadata` ada di dalam payload bertanda tangan, jadi role di bawah
  // tidak bisa dipalsukan dari sisi pengguna.
  const role = claims.app_metadata?.role;

  const bolehLewatEnv = daftarAdmin.length > 0 && daftarAdmin.includes(email);
  const bolehLewatRole = role === 'super_admin';

  if (!bolehLewatEnv && !bolehLewatRole) {
    return { ok: false, error: 'Akun ini bukan admin super. Akses ditolak.', status: 403 };
  }

  return { ok: true, user: { userId: claims.sub, email } };
});
