import 'server-only';

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

import { env } from '@/lib/env';

/**
 * Supabase client dengan SERVICE ROLE key.
 *
 * ⚠️ Melewati RLS — bisa melihat & mengubah SEMUA toko dan key.
 * Aturan wajib di repo ini:
 *   1. Hanya dipakai di server (`import 'server-only'` di atas memastikan ini).
 *   2. SETIAP pemanggil WAJIB memanggil `requireAdmin()` (lihat guard.ts) lebih
 *      dulu dan baru bisa lanjut kalau hasilnya `ok: true`.
 *   3. Jangan pernah mengirim client ini ke browser / tidak boleh di-import
 *      dari komponen ber-'use client'.
 */
let cached: SupabaseClient | null = null;

export function hasServiceRole(): boolean {
  return Boolean(env.supabaseUrl && env.serviceRoleKey);
}

export function createAdminClient(): SupabaseClient {
  if (cached) return cached;

  if (!env.supabaseUrl || !env.serviceRoleKey) {
    throw new Error(
      'Kunci server Supabase belum diatur (SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY). ' +
        'Isi .env.local atau environment variable Vercel.',
    );
  }

  cached = createSupabaseClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  return cached;
}
