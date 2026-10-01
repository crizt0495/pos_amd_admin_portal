#!/usr/bin/env node
/**
 * Pasang role `super_admin` pada satu akun Supabase Auth.
 *
 * Dipakai SEKALI, setelah akun dibuat lewat Supabase Dashboard:
 *   1. Dashboard > Authentication > Users > Add user
 *      (centang "Auto Confirm User", isi email admin kamu)
 *   2. Jalankan script ini:
 *        npm run bootstrap:admin -- admin@email.com
 *
 * Kenapa perlu script? Role disimpan di `app_metadata`, yang HANYA bisa ditulis
 * lewat service role key / dashboard — bukan `user_metadata` yang bisa diisi
 * sendiri saat signup. Tanpa langkah ini, akun hanya bisa login kalau email-nya
 * juga terdaftar di env ADMIN_EMAIL.
 *
 * ⚠️ Butuh kredensial service role. Ambil dari .env.local atau set sebagai env
 *    sebelum menjalankan:
 *      SUPABASE_URL=... SUPABASE_SECRET_KEY=... npm run bootstrap:admin -- email@x.com
 *    JANGAN pernah commit kuncinya.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

/** Baca .env.local tanpa dependensi tambahan. */
function muatEnvLokal() {
  const f = join(ROOT, '.env.local');
  if (!existsSync(f)) return;
  for (const baris of readFileSync(f, 'utf8').split('\n')) {
    const barisBersih = baris.trim();
    if (!barisBersih || barisBersih.startsWith('#')) continue;
    const idx = barisBersih.indexOf('=');
    if (idx === -1) continue;
    const kunci = barisBersih.slice(0, idx).trim();
    const nilai = barisBersih.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (kunci && !process.env[kunci]) process.env[kunci] = nilai;
  }
}

muatEnvLokal();

const emailArg = process.argv[2]?.trim();
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const key =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  '';

if (!emailArg) {
  console.error('Pemakaian: npm run bootstrap:admin -- admin@email.com');
  process.exit(1);
}
if (!url || !key) {
  console.error('SUPABASE_URL / SUPABASE_SECRET_KEY belum diatur (lihat .env.example).');
  process.exit(1);
}

const db = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Cari user berdasarkan email.
const { data: daftar, error: errList } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (errList) {
  console.error('Gagal mengambil daftar user:', errList.message);
  process.exit(1);
}

const target = daftar?.users?.find(
  (u) => (u.email ?? '').toLowerCase() === emailArg.toLowerCase(),
);

if (!target) {
  console.error(`User dengan email "${emailArg}" tidak ditemukan.`);
  console.error('Buat dulu di Supabase Dashboard > Authentication > Users > Add user.');
  process.exit(1);
}

// Tulis app_metadata.role (bukan user_metadata).
const { error: errUpdate } = await db.auth.admin.updateUserById(target.id, {
  app_metadata: {
    ...(target.app_metadata ?? {}),
    role: 'super_admin',
  },
});

if (errUpdate) {
  console.error('Gagal memasang role:', errUpdate.message);
  process.exit(1);
}

console.log(`OK — role super_admin dipasang untuk ${emailArg} (user id ${target.id}).`);
console.log('Sekarang akun ini bisa login di admin portal.');
