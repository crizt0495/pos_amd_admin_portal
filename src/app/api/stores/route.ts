import { NextResponse } from 'next/server';

import { bacaJson, jsonGagal, jsonOk, wajibAdmin } from '@/lib/api-guard';
import { cekAlamat, cekEmail, cekPassword, cekTelepon, hanyaDigit, namaValid } from '@/lib/validasi';
import { demoAktif } from '@/lib/demo/config';
import { demoBuatStore, demoStores } from '@/lib/demo/data';
import { createAdminClient } from '@/lib/supabase/admin';
import { tierOf } from '@/lib/tier';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/stores — daftarkan toko baru BESERTa akun loginnyа.
 *
 * Sekaligus dua hal, dalam urutan ini:
 *  1. `auth.admin.createUser()`  -> akun Supabase Auth (bisa langsung login)
 *  2. `partners`                -> baris toko (kuota awal, tier, dll)
 *
 * Kenapa tidak Trigger saja? Supabase punya trigger `on_auth_user_created` yang
 * otomatis membuat baris `partners` (default quota 5, nama dari email). Kita
 * TETAP memakainya — jadi baris tetap dibuat walau trigger aktif — lalu
 * `update` baris itu dengan data asli dari form. Kalau trigger belum terpasang
 * (mis. database lama), baris tetap dibuat manual di sini. Dua jalur, satu
 * hasil: selalu ada baris `partners` yang sesuai form.
 *
 * ⚠️ Bila `createUser` berhasil tapi update baris gagal, akun auth SUDAH
 * dibuat. Route mengembalikan 500 dengan pesan agar admin tahu akunnya
 * mungkin sudah ada dan perlu dihapus manual (bikin akun nyangkut).
 */
interface Body {
  nama_toko?: string;
  no_hp?: string;
  alamat?: string;
  email?: string;
  password?: string;
  kuota_awal?: number;
  /**
   * ⚠️ TIDAK ada `tier_awal` yang bisa diisi. Tier dihitung dari
   * `total_terjual` (lihat SQL `tier_name_of()`), sama seperti portal toko —
   * jadi tidak bisa dipaksakan. Toko baru otomatis Bronze.
   */
  username?: string;
}

export async function POST(req: Request) {
  const admin = await wajibAdmin();
  if (admin.error) return admin.error;

  const body = await bacaJson<Body>(req);
  if (!body) return jsonGagal('Body JSON tidak valid.');

  // --- Validasi (sama persis aturan portal toko) ---------------------------
  const namaToko = (body.nama_toko ?? '').trim();
  const noHp = hanyaDigit(body.no_hp ?? '');
  const alamat = (body.alamat ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  const kuotaAwal = Number.isInteger(body.kuota_awal) ? (body.kuota_awal as number) : 5;

  const errors: Record<string, string> = {};
  if (!namaValid(namaToko)) errors.nama_toko = 'Nama toko minimal 3 karakter.';
  const errHp = cekTelepon(noHp, true);
  if (errHp) errors.no_hp = errHp;
  const errAlamat = cekAlamat(alamat, 10, true);
  if (errAlamat) errors.alamat = errAlamat;
  const errEmail = cekEmail(email, true);
  if (errEmail) errors.email = errEmail;
  const errPw = cekPassword(password, true);
  if (errPw) errors.password = errPw;
  if (kuotaAwal < 0 || kuotaAwal > 10_000) errors.kuota_awal = 'Kuota awal 0 - 10.000.';

  if (Object.keys(errors).length > 0) {
    return NextResponse.json(
      { ok: false, message: 'Periksa kembali data yang diisi.', errors },
      { status: 422 },
    );
  }

  // Mode demo: cek email dipakai di memory, lalu buat toko baru.
  if (demoAktif) {
    const bentrok = demoStores().find((s) => (s.email ?? '').toLowerCase() === email);
    if (bentrok) {
      return NextResponse.json(
        {
          ok: false,
          message: `Email ${email} sudah dipakai toko "${bentrok.nama_toko}".`,
          errors: { email: 'Email sudah terdaftar.' },
        },
        { status: 409 },
      );
    }
    const s = demoBuatStore({
      nama_toko: namaToko,
      email,
      username: (body.username ?? '').trim() || email.split('@')[0]!,
      no_hp: noHp,
      alamat,
      kuota_awal: kuotaAwal,
    });
    return jsonOk(
      `[DEMO] Toko "${s.nama_toko}" dibuat dengan sisa kuota ${s.sisa_kuota} key. Tidak ada akun auth yang dibuat.`,
      { user_id: s.user_id, tier: tierOf(0).name },
      201,
    );
  }

  const db = createAdminClient();

  // --- 0. Email belum dipakai? Cek DULU sebelum create auth ---------------
  const { data: emailAda } = await db
    .from('admin_stores')
    .select('id, nama_toko')
    .eq('email', email)
    .maybeSingle();
  if (emailAda) {
    return NextResponse.json(
      {
        ok: false,
        message: `Email ${email} sudah dipakai toko "${emailAda.nama_toko}".`,
        errors: { email: 'Email sudah terdaftar.' },
      },
      { status: 409 },
    );
  }

  // --- 1. Buat akun Supabase Auth ------------------------------------------
  const { data: dibuat, error: errAuth } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // langsung bisa login tanpa verifikasi email
    user_metadata: { nama_toko: namaToko, username: email.split('@')[0] },
  });

  if (errAuth || !dibuat?.user) {
    return jsonGagal(`Gagal membuat akun: ${errAuth?.message ?? 'tidak diketahui'}`, 502);
  }

  const userId = dibuat.user.id;
  // Trigger on_auth_user_created mungkin sudah buat baris; kalau belum, kita
  // insert sendiri. Dua-duanya aman karena insert pakai onConflict user_id.
  const { error: errInsert } = await db.from('partners').insert({
    user_id: userId,
    email,
    username: (body.username ?? '').trim() || email.split('@')[0],
    nama_toko: namaToko,
    no_hp: noHp,
    alamat,
    license_quota: kuotaAwal,
    total_terjual: 0,
    komisi_total: 0,
    status: 'active',
  });

  if (errInsert) {
    // Kemungkinan: trigger sudah insert dengan user_id yang sama -> bentrok
    // unique. Coba update path sebagai gantinya.
    const { error: errUpdate } = await db
      .from('partners')
      .update({
        email,
        username: (body.username ?? '').trim() || email.split('@')[0],
        nama_toko: namaToko,
        no_hp: noHp,
        alamat,
        license_quota: kuotaAwal,
        status: 'active',
      })
      .eq('user_id', userId);

    if (errUpdate) {
      return jsonGagal(
        `Akun ${email} TERBUAT tapi gagal menyimpan data toko. Hapus akun di Supabase lalu ulangi. (${errUpdate.message})`,
        500,
      );
    }
  }

  return jsonOk(
    `Toko "${namaToko}" berhasil didaftarkan. Akun ${email} siap login.`,
    { user_id: userId, tier: tierOf(0).name },
    201,
  );
}
