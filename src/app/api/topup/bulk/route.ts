import { bacaJson, jsonGagal, jsonOk, wajibAdmin } from '@/lib/api-guard';
import { cekJumlahKey } from '@/lib/validasi';
import { demoAktif } from '@/lib/demo/config';
import { demoTopupBulk } from '@/lib/demo/data';
import { balik, jalurKembali, postingForm } from '@/lib/form-post';
import { createAdminClient } from '@/lib/supabase/admin';
import type { TopupResult } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Halaman asal untuk form native di `/akun`. */
const ASAL_AKUN = '/akun';

/**
 * POST /api/topup/bulk — top up BANYAK toko sekaligus (isi kuota massal).
 *
 * Dua pemanggil, satu route:
 *   1. `<form method="post">` dari halaman `/akun` yang tanpa JavaScript
 *      (`Content-Type: application/x-www-form-urlencoded`) -> dibalas 303
 *      kembali ke `/akun` dengan pesan di query string.
 *   2. `fetch()` dari Client Component -> dibalas JSON seperti biasa.
 *
 * Yang membedakan hanya BENTUK balasan, bukan aksi dan validasinya: keduanya
 * melewati kode aksi yang sama persis di bawah. Kalau validasinya ditulis dua
 * kali, form native dan island bisa punya aturan berbeda.
 *
 * Semua toko diproses dalam 1 transaksi RPC (`admin_topup_bulk`). Toko yang
 * tidak ditemukan dilaporkan per-baris tanpa membatalkan yang lain, jadi
 * admin langsung tahu mana yang gagal.
 */
export async function POST(req: Request) {
  const admin = await wajibAdmin();
  if (admin.error) return admin.error;

  const dariForm = postingForm(req);

  const ids: string[] = [];
  let jumlah = 0;
  let catatan: string | null = null;
  let asal = ASAL_AKUN;

  if (dariForm) {
    const fd = await req.formData();
    // Checkbox yang tidak dicentang tidak pernah terkirim, jadi `getAll()`
    // otomatis hanya berisi yang dicentang. Ini menggantikan state React
    // `Set<string>` yang sebelumnya disimpan di memori.
    ids.push(...fd.getAll('store_ids').map((v) => String(v)).filter(Boolean));
    jumlah = Number(fd.get('jumlah_key'));
    catatan = String(fd.get('catatan') ?? '').trim() || null;
    asal = jalurKembali(fd.get('_ulang'), ASAL_AKUN);
  } else {
    const body = await bacaJson<{
      store_ids?: string[];
      jumlah_key?: number;
      catatan?: string;
    }>(req);
    if (!body) return jsonGagal('Body JSON tidak valid.');
    ids.push(...(Array.isArray(body.store_ids) ? body.store_ids.filter(Boolean) : []));
    jumlah = Number(body.jumlah_key);
    catatan = (body.catatan ?? '').trim() || null;
  }

  if (ids.length === 0) return tolak(dariForm, asal, 'Pilih minimal satu toko.');
  if (ids.length > 200) return tolak(dariForm, asal, 'Maksimal 200 toko dalam sekali top up.');

  const errJumlah = cekJumlahKey(jumlah);
  if (errJumlah) return tolak(dariForm, asal, errJumlah);

  // Mode demo: ubah angka di memory, tetap pakai aturan clamp yang sama.
  if (demoAktif) {
    const hasil = demoTopupBulk(ids, Math.trunc(jumlah), catatan, admin.user.email);
    const sukses = hasil.filter((r) => r.ok).length;
    return terima(dariForm, asal, `[DEMO] Kuota ${jumlah >= 0 ? '+' : ''}${jumlah} key diterapkan ke ${sukses} toko.`, {
      hasil,
      sukses,
      gagal: hasil.length - sukses,
    });
  }

  const db = createAdminClient();
  const { data, error } = await db.rpc('admin_topup_bulk', {
    p_store_ids: ids,
    p_jumlah: Math.trunc(jumlah),
    p_catatan: catatan,
    p_admin_by: admin.user.email,
  });

  if (error) return tolak(dariForm, asal, error.message || 'Gagal top up massal.');

  const hasil = (data ?? []) as TopupResult[];
  const sukses = hasil.filter((r) => r.ok).length;
  const gagal = hasil.length - sukses;

  const ringkas = `${jumlah >= 0 ? '+' : ''}${jumlah} key`;
  const pesan =
    gagal === 0
      ? `Kuota ${ringkas} diterapkan ke ${sukses} toko.`
      : `${ringkas} diterapkan ke ${sukses} toko, ${gagal} gagal (toko dihapus/diubah).`;

  return terima(dariForm, asal, pesan, { hasil, sukses, gagal });
}

/** Balasan gagal: 303 ke halaman asal (form) atau JSON (island). */
function tolak(dariForm: boolean, asal: string, pesan: string) {
  return dariForm ? balik(asal, { err: pesan }) : jsonGagal(pesan, 400);
}

/** Balasan sukses: 303 ke halaman asal (form) atau JSON (island). */
function terima(dariForm: boolean, asal: string, pesan: string, data: unknown) {
  return dariForm ? balik(asal, { ok: pesan }) : jsonOk(pesan, data);
}
