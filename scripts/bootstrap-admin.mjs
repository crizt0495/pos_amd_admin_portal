#!/usr/bin/env node
/**
 * Pasang role `super_admin` pada satu akun Supabase Auth, dan (opsional)
 * daftarkan USERNAME untuk login.
 *
 * Dipakai SEKALI, setelah akun dibuat lewat Supabase Dashboard:
 *   1. Dashboard > Authentication > Users > Add user
 *      (centang "Auto Confirm User", isi email admin kamu)
 *   2. Jalankan script ini:
 *        npm run bootstrap:admin -- admin@email.com superadmin
 *
 * Argumen ke-2 (username) OPSIONAL:
 *   - diisi  -> username didaftarkan ke tabel `admin_accounts`, jadi admin bisa
 *               login memakai USERNAME (email tetap boleh dipakai).
 *   - kosong -> login tetap memakai email saja.
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
const usernameArg = process.argv[3]?.trim().toLowerCase() || '';

// Username hanya huruf kecil, angka, titik, underscore, strip; 3-32 karakter.
// Aturan ini harus sama persis dengan CHECK constraint di tabel admin_accounts.
const POLA_USERNAME = /^[a-z0-9][a-z0-9._-]{2,31}$/;

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const key =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  '';

if (!emailArg) {
  console.error('Pemakaian: npm run bootstrap:admin -- admin@email.com [username]');
  process.exit(1);
}
if (usernameArg && !POLA_USERNAME.test(usernameArg)) {
  console.error(`Username "${usernameArg}" tidak valid.`);
  console.error('Aturan: huruf kecil, angka, titik, _ atau -, panjang 3-32 karakter.');
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

// --- Opsional: daftarkan username untuk login -------------------------------
if (usernameArg) {
  const email = emailArg.toLowerCase();

  // Satu email tidak boleh punya dua username, dan username tidak boleh dipakai
  // akun lain — jadi hapus dulu baris lama milik email ini kalau ada.
  const { error: errHapusLama } = await db
    .from('admin_accounts')
    .delete()
    .eq('email', email);

  if (errHapusLama) {
    console.error('Gagal membersihkan username lama:', errHapusLama.message);
    process.exit(1);
  }

  const { error: errSimpan } = await db
    .from('admin_accounts')
    .insert({ username: usernameArg, email });

  if (errSimpan) {
    console.error('Gagal menyimpan username:', errSimpan.message);
    console.error(
      'Kalau errornya soal duplikat, berarti username itu sudah dipakai akun lain.',
    );
    process.exit(1);
  }

  console.log(`OK — username "${usernameArg}" didaftarkan untuk ${email}.`);
}

console.log('');
console.log('Login di /login memakai:');
console.log(`  username : ${usernameArg || '(belum didaftarkan — pakai email)'}`);
console.log(`  email    : ${emailArg}`);
console.log('  password : password yang kamu set di Supabase Dashboard');
