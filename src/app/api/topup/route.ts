import { bacaJson, jsonGagal, jsonOk, wajibAdmin } from '@/lib/api-guard';
import { cekJumlahKey } from '@/lib/validasi';
import { demoAktif } from '@/lib/demo/config';
import { demoTopup } from '@/lib/demo/data';
import { balik, jalurKembali, postingForm } from '@/lib/form-post';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Halaman asal kalau form native tidak mengirim `_ulang`. */
const ASAL_BAWAAN = '/toko';

/**
 * POST /api/topup — isi ulang / top up kuota 1 toko.
 *
 * Dua pemanggil, satu route:
 *   1. `<form method="post">` dari `/akun` (halaman tanpa JavaScript)
 *      -> dibalas 303 kembali ke halaman asal dengan pesan di query string.
 *   2. `fetch()` dari `StoreAksi` di `/toko` (halaman ber-React)
 *      -> dibalas JSON, dipakai `toast`.
 *
 * Bentuk balasannya berbeda, aksi dan validasinya tidak.
 *
 * Parameter `jumlah_key`:
 *   - POSITIF  = tambah kuota (mis. +5)
 *   - NEGATIF  = kurangi kuota (koreksi admin)
 *
 * Cara kerja: memanggil RPC `admin_topup()` yang mengunci baris (`FOR UPDATE`)
 * supaya dua admin yang top up bersamaan tidak saling menimpa, lalu menulis
 * `topup_history`. Sisa kuota dijaga >= 0 di SQL.
 */
export async function POST(req: Request) {
  const admin = await wajibAdmin();
  if (admin.error) return admin.error;

  const dariForm = postingForm(req);

  let storeId = '';
  let jumlah = 0;
  let catatan: string | null = null;
  let asal = ASAL_BAWAAN;

  if (dariForm) {
    const fd = await req.formData();
    storeId = String(fd.get('store_id') ?? '').trim();
    jumlah = Number(fd.get('jumlah_key'));
    catatan = String(fd.get('catatan') ?? '').trim() || null;
    asal = jalurKembali(fd.get('_ulang'), ASAL_BAWAAN);
  } else {
    const body = await bacaJson<{
      store_id?: string;
      jumlah_key?: number;
      catatan?: string;
    }>(req);
    if (!body) return jsonGagal('Body JSON tidak valid.');
    storeId = String(body.store_id ?? '').trim();
    jumlah = Number(body.jumlah_key);
    catatan = (body.catatan ?? '').trim() || null;
  }

  if (!storeId) return tolak(dariForm, asal, 'store_id wajib diisi.');

  const errJumlah = cekJumlahKey(jumlah);
  if (errJumlah) return tolak(dariForm, asal, errJumlah);

  // Mode demo: ubah angka di memory, tetap pakai aturan clamp yang sama.
  if (demoAktif) {
    const hasil = demoTopup(storeId, Math.trunc(jumlah), catatan, admin.user.email);
    if (!hasil.ok) return tolak(dariForm, asal, hasil.pesan);

    const terapkan = hasil.jumlah_diterapkan;
    const catatanTambahan =
      terapkan !== jumlah
        ? ` (diminta ${jumlah}, diterapkan ${terapkan} karena sisa tidak boleh negatif)`
        : '';

    return terima(dariForm, asal, `[DEMO] Kuota toko ${terapkan >= 0 ? 'bertambah' : 'berkurang'} ${Math.abs(terapkan)} key. Sisa sekarang ${hasil.sisa_kuota} key${catatanTambahan}.`, {
      sisa_kuota: hasil.sisa_kuota,
      jumlah_diterapkan: terapkan,
    });
  }

  const db = createAdminClient();
  const { data, error } = await db.rpc('admin_topup', {
    p_store_id: storeId,
    p_jumlah: Math.trunc(jumlah),
    p_catatan: catatan,
    p_admin_by: admin.user.email,
  });

  if (error) {
    // Pesan dari raise exception SQL dipakai apa adanya (sudah Bahasa Indonesia).
    return tolak(dariForm, asal, error.message || 'Gagal top up.');
  }

  const hasil = (data?.[0] ?? {}) as { sisa_kuota?: number; jumlah_diterapkan?: number };
  const terapkan = hasil.jumlah_diterapkan ?? jumlah;

  // Bila pengurangan melebihi kuota, terapkan bisa < jumlah (sisa dikunci 0).
  const catatanTambahan =
    terapkan !== jumlah
      ? ` (diminta ${jumlah}, diterapkan ${terapkan} karena sisa tidak boleh negatif)`
      : '';

  return terima(dariForm, asal, `Kuota toko ${terapkan >= 0 ? 'bertambah' : 'berkurang'} ${Math.abs(terapkan)} key. Sisa sekarang ${hasil.sisa_kuota ?? 0} key${catatanTambahan}.`, {
    sisa_kuota: hasil.sisa_kuota ?? 0,
    jumlah_diterapkan: terapkan,
  });
}

/** Balasan gagal: 303 ke halaman asal (form) atau JSON (island). */
function tolak(dariForm: boolean, asal: string, pesan: string) {
  return dariForm ? balik(asal, { err: pesan }) : jsonGagal(pesan, 400);
}

/** Balasan sukses: 303 ke halaman asal (form) atau JSON (island). */
function terima(dariForm: boolean, asal: string, pesan: string, data: unknown) {
  return dariForm ? balik(asal, { ok: pesan }) : jsonOk(pesan, data);
}
