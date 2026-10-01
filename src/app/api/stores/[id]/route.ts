import { NextResponse } from 'next/server';

import { bacaJson, jsonGagal, jsonOk, wajibAdmin } from '@/lib/api-guard';
import { cekAlamat, cekEmail, cekTelepon, hanyaDigit, namaValid } from '@/lib/validasi';
import { demoAktif } from '@/lib/demo/config';
import { demoCariStore, demoHapusStore, demoPatchStore } from '@/lib/demo/data';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

/* ------------------------------------------------------------------ */
/* PATCH — edit data toko / ubah status aktif                          */
/* ------------------------------------------------------------------ */
interface PatchBody {
  nama_toko?: string;
  no_hp?: string;
  alamat?: string;
  email?: string;
  status?: 'active' | 'suspended';
  /** Reset password akun toko (opsional, terpisah dari field lain). */
  password_baru?: string;
}

/**
 * PATCH /api/stores/[id] — edit profil toko, ubah status, atau reset password.
 *
 * Field opsional: yang dikirim saja yang berubah. Tidak ada aksi "hapus" di
 * sini (itu DELETE) supaya tidak salah klik.
 *
 * Kalau `email` diubah, `auth.users.email` ikut diperbarui Supabase juga
 * (biar login dengan email baru tetap jalan).
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const admin = await wajibAdmin();
  if (admin.error) return admin.error;

  const body = await bacaJson<PatchBody>(req);
  if (!body) return jsonGagal('Body JSON tidak valid.');

  // Mode demo: validasi sama persis, lalu simpan ke memory.
  if (demoAktif) return patchDemo(params.id, body);

  const db = createAdminClient();
  const id = params.id;

  // Toko harus ada.
  const { data: toko } = await db.from('partners').select('id, user_id, email').eq('id', id).maybeSingle();
  if (!toko) return jsonGagal('Toko tidak ditemukan.', 404);

  const update: Record<string, unknown> = {};

  if (body.nama_toko !== undefined) {
    const nama = body.nama_toko.trim();
    if (!namaValid(nama)) {
      return NextResponse.json(
        { ok: false, message: 'Nama toko tidak valid.', errors: { nama_toko: 'Minimal 3 karakter.' } },
        { status: 422 },
      );
    }
    update.nama_toko = nama;
  }

  if (body.no_hp !== undefined) {
    const noHp = hanyaDigit(body.no_hp);
    const err = cekTelepon(noHp, false);
    if (err) {
      return NextResponse.json(
        { ok: false, message: 'Nomor HP tidak valid.', errors: { no_hp: err } },
        { status: 422 },
      );
    }
    update.no_hp = noHp || null;
  }

  if (body.alamat !== undefined) {
    const alamat = body.alamat.trim();
    const err = cekAlamat(alamat, 10, false);
    if (err) {
      return NextResponse.json(
        { ok: false, message: 'Alamat tidak valid.', errors: { alamat: err } },
        { status: 422 },
      );
    }
    update.alamat = alamat || null;
  }

  if (body.status !== undefined) {
    if (body.status !== 'active' && body.status !== 'suspended') {
      return jsonGagal('Status tidak valid.');
    }
    update.status = body.status;
  }

  if (body.email !== undefined) {
    const email = body.email.trim().toLowerCase();
    const err = cekEmail(email, true);
    if (err) {
      return NextResponse.json(
        { ok: false, message: 'Email tidak valid.', errors: { email: err } },
        { status: 422 },
      );
    }
    // Cek bentrok dengan toko lain.
    const { data: bentrok } = await db
      .from('partners')
      .select('id')
      .eq('email', email)
      .neq('id', id)
      .maybeSingle();
    if (bentrok) {
      return NextResponse.json(
        { ok: false, message: `Email ${email} sudah dipakai toko lain.`, errors: { email: 'Email sudah terdaftar.' } },
        { status: 409 },
      );
    }
    update.email = email;
  }

  let resetPassword = false;
  if (body.password_baru !== undefined && body.password_baru !== '') {
    const pw = body.password_baru;
    if (pw.length < 8 || !/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) {
      return NextResponse.json(
        { ok: false, message: 'Password baru tidak valid.', errors: { password_baru: 'Min. 8 karakter, ada huruf & angka.' } },
        { status: 422 },
      );
    }
    if (!toko.user_id) {
      return jsonGagal('Toko ini tidak terhubung ke akun auth, tidak bisa reset password.', 400);
    }
    const { error: errPw } = await db.auth.admin.updateUserById(toko.user_id, { password: pw });
    if (errPw) return jsonGagal(`Gagal reset password: ${errPw.message}`, 502);
    resetPassword = true;
  }

  // Simpan perubahan profil (bisa kosong kalau cuma reset password).
  if (Object.keys(update).length > 0) {
    const { error } = await db.from('partners').update(update).eq('id', id);
    if (error) return jsonGagal(`Gagal menyimpan: ${error.message}`, 500);
  }

  // Email auth ikut diubah di Supabase.
  if (update.email && toko.user_id) {
    await db.auth.admin.updateUserById(toko.user_id, { email: update.email as string });
  }

  const pesan = resetPassword
    ? 'Perubahan tersimpan & password toko berhasil di-reset.'
    : 'Perubahan tersimpan.';
  return jsonOk(pesan, { resetPassword });
}

/**
 * Mode demo: patch toko tanpa Supabase.
 *
 * Memakai validator yang SAMA dengan jalur produksi supaya demo tidak
 * Konstanta diterima input yang akan ditolak sungguhan — memvalidasi dengan
 * aturan berbeda akan membuat demo berbohong soal perilaku aplikasi.
 */
async function patchDemo(id: string, body: PatchBody) {
  const ada = demoCariStore(id);
  if (!ada) return jsonGagal('Toko tidak ditemukan.', 404);

  const patch: Record<string, unknown> = {};

  if (body.nama_toko !== undefined) {
    const nama = body.nama_toko.trim();
    if (!namaValid(nama)) {
      return NextResponse.json(
        { ok: false, message: 'Nama toko tidak valid.', errors: { nama_toko: 'Minimal 3 karakter.' } },
        { status: 422 },
      );
    }
    patch.nama_toko = nama;
  }

  if (body.no_hp !== undefined) {
    const noHp = hanyaDigit(body.no_hp);
    const err = cekTelepon(noHp, false);
    if (err) {
      return NextResponse.json(
        { ok: false, message: 'Nomor HP tidak valid.', errors: { no_hp: err } },
        { status: 422 },
      );
    }
    patch.no_hp = noHp || null;
  }

  if (body.alamat !== undefined) {
    const alamat = body.alamat.trim();
    const err = cekAlamat(alamat, 10, false);
    if (err) {
      return NextResponse.json(
        { ok: false, message: 'Alamat tidak valid.', errors: { alamat: err } },
        { status: 422 },
      );
    }
    patch.alamat = alamat || null;
  }

  if (body.status !== undefined) {
    if (body.status !== 'active' && body.status !== 'suspended') {
      return jsonGagal('Status tidak valid.');
    }
    patch.status = body.status;
  }

  if (body.email !== undefined) {
    const email = body.email.trim().toLowerCase();
    const err = cekEmail(email, true);
    if (err) {
      return NextResponse.json(
        { ok: false, message: 'Email tidak valid.', errors: { email: err } },
        { status: 422 },
      );
    }
    patch.email = email;
  }

  if (body.password_baru !== undefined && body.password_baru !== '') {
    const pw = body.password_baru;
    if (pw.length < 8 || !/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Password baru tidak valid.',
          errors: { password_baru: 'Min. 8 karakter, ada huruf & angka.' },
        },
        { status: 422 },
      );
    }
  }

  demoPatchStore(id, patch as never);
  return jsonOk('[DEMO] Perubahan tersimpan (hanya di memory, hilang saat dev restart).');
}

/* ------------------------------------------------------------------ */
/* DELETE — hapus toko BESERTA akun loginnya                          */
/* ------------------------------------------------------------------ */
export async function DELETE(_req: Request, { params }: Ctx) {
  const admin = await wajibAdmin();
  if (admin.error) return admin.error;

  if (demoAktif) {
    const nama = demoHapusStore(params.id);
    if (!nama) return jsonGagal('Toko tidak ditemukan.', 404);
    return jsonOk(`[DEMO] Toko "${nama}" beserta key-nya dihapus.`);
  }

  const db = createAdminClient();
  const id = params.id;

  const { data: toko } = await db.from('partners').select('id, user_id, nama_toko').eq('id', id).maybeSingle();
  if (!toko) return jsonGagal('Toko tidak ditemukan.', 404);

  // Hapus user auth DULU: baris `partners` cascade-delete dari auth.users, dan
  // `licenses` cascade-delete dari partners. Urutan ini Yang paling bersih.
  if (toko.user_id) {
    const { error: errDel } = await db.auth.admin.deleteUser(toko.user_id);
    if (errDel) {
      return jsonGagal(`Gagal menghapus akun: ${errDel.message}`, 502);
    }
    // auth.users terhapus -> cascade ke partners & licenses.
    return jsonOk(`Toko "${toko.nama_toko}" beserta akun & key-nya dihapus.`);
  }

  // Tidak ada auth user (jarang): hapus baris partners langsung.
  const { error: errDel } = await db.from('partners').delete().eq('id', id);
  if (errDel) return jsonGagal(`Gagal menghapus toko: ${errDel.message}`, 500);
  return jsonOk(`Toko "${toko.nama_toko}" dihapus.`);
}
