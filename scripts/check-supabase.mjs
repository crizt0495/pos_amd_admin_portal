#!/usr/bin/env node
/**
 * Cek cepat: apakah env admin portal sudah benar-benar siap?
 *
 * Menjalankan 3 hal:
 *  1. Env wajib terisi (URL, publishable key, service role key, ADMIN_EMAIL)
 *  2. Objek database baru sudah ada (view admin_stores/admin_keys,
 *     fungsi admin_topup/admin_topup_bulk/admin_revoke_key, tabel topup_history,
 *     tabel admin_accounts)
 *  3. Angka ringkas toko & key yang terbaca, plus daftar username admin
 *
 * Jalankan:  npm run check:supabase
 *
 * ⚠️ Membaca .env.local. Jangan pernah commit kuncinya.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function muatEnvLokal() {
  const f = join(ROOT, '.env.local');
  if (!existsSync(f)) return false;
  for (const baris of readFileSync(f, 'utf8').split('\n')) {
    const b = baris.trim();
    if (!b || b.startsWith('#')) continue;
    const idx = b.indexOf('=');
    if (idx === -1) continue;
    const kunci = b.slice(0, idx).trim();
    const nilai = b.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (kunci && !process.env[kunci]) process.env[kunci] = nilai;
  }
  return true;
}

const adaEnvLokal = muatEnvLokal();

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const service = process.env.SUPABASE_SECRET_KEY || process.env.SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const adminEmail = (process.env.ADMIN_EMAIL || '').trim();

console.log('=== Kesiapan Admin Portal ===\n');

let cacat = 0;
function cek(label, ok, tambahan = '') {
  console.log(`${ok ? 'OK  ' : 'GAGAL'} ${label}${tambahan ? ` — ${tambahan}` : ''}`);
  if (!ok) cacat += 1;
}

cek('.env.local ada', adaEnvLokal, adaEnvLokal ? '' : 'cp .env.example .env.local');
cek('SUPABASE_URL terisi', Boolean(url), url || 'kosong');
cek('Publishable key terisi', Boolean(publishable));
cek('Service role key terisi', Boolean(service), service ? '' : 'WAJIB service role, bukan anon');
cek('ADMIN_EMAIL terisi', Boolean(adminEmail), adminEmail || 'kosong');

if (!url || !service) {
  console.log('\nEnv belum lengkap — cek database dilewati.');
  process.exit(1);
}

const db = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log('\n--- Objek database ---');
for (const view of ['admin_stores', 'admin_keys']) {
  const { error } = await db.from(view).select('*').limit(1);
  cek(`view ${view}`, !error, error?.message ?? '');
}
{
  const { error } = await db.from('topup_history').select('*').limit(1);
  cek('tabel topup_history', !error, error?.message ?? '');
}
{
  const { error } = await db.from('admin_accounts').select('*').limit(1);
  cek('tabel admin_accounts', !error, error?.message ?? '');
}
for (const fn of ['admin_topup', 'admin_topup_bulk', 'admin_revoke_key']) {
  // Panggil dengan argumen sengaja tidak lengkap — harus gagal dengan pesan
  // validasi ("tidak boleh 0" / "wajib diisi"), bukan "function does not exist".
  const { error } = await db.rpc(fn, {});
  const pesan = error?.message ?? '';
  const adaFungsi =
    !error ||
    /tidak boleh 0|wajib diisi|minimal satu toko|toko tidak ditemukan|status tidak valid/i.test(
      pesan,
    );
  cek(`fungsi ${fn}()`, adaFungsi, adaFungsi ? pesan : `tidak ditemukan (${pesan})`);
}

console.log('\n--- Isi data ---');
{
  const { count: toko, error: e1 } = await db
    .from('admin_stores')
    .select('id', { count: 'exact', head: true });
  cek('baca admin_stores', !e1, e1?.message ?? '');
  console.log(`     toko terdaftar: ${toko ?? 0}`);
}
{
  const { count: key, error: e2 } = await db
    .from('admin_keys')
    .select('id', { count: 'exact', head: true });
  cek('baca admin_keys', !e2, e2?.message ?? '');
  console.log(`     serial key: ${key ?? 0}`);
}
console.log('\n--- Akun admin (login) ---');
{
  const { data, error: e3 } = await db
    .from('admin_accounts')
    .select('username, email')
    .order('username');
  cek('baca admin_accounts', !e3, e3?.message ?? '');
  if (data?.length) {
    for (const a of data) console.log(`     ${a.username}  ->  ${a.email}`);
  } else {
    console.log('     (belum ada username) — jalankan:');
    console.log('     npm run bootstrap:admin -- admin@email.com superadmin');
  }
}

console.log(
  cacat === 0
    ? '\nSemua siap. Kalau tabel/view di atas belum ada, jalankan supabase/admin-schema.sql di Supabase SQL Editor.'
    : `\n${cacat} masalah ditemukan. Perbaiki dulu sebelum deploy.`,
);

process.exit(cacat === 0 ? 0 : 1);
