import { NextResponse } from 'next/server';

import { arahkan, kueri } from '@/lib/redirect';

/**
 * =============================================================================
 *  POST DARI FORM NATIVE  (tanpa JavaScript)
 * =============================================================================
 *
 * Halaman "ringan" (lihat `HALAMAN_RINGAN` di `src/middleware.ts`) disajikan
 * tanpa satu baris pun JavaScript. Artinya tidak ada `fetch`, tidak ada
 * `toast`, dan tidak ada `Modal` React: satu-satunya cara melakukan aksi adalah
 * `<form method="post">` native yang dikirim browser ke Route Handler.
 *
 * Route Handler-nya lalu tidak boleh membalas JSON, karena browser yang
 * mengirim POST itu tidak akan membaca JSON tersebut. Yang tampil hanyalah
 * JSON mentah di layar. Jadi route yang dipakai form native memanggil
 * `balik()` di sini: 303 ke halaman asal dengan pesan hasil di query string,
 * lalu pesan itu dirender server menjadi banner.
 *
 * Format query yang dipakai: `?ok=` untuk berhasil, `?err=` untuk gagal.
 * `?err=` sengaja dibedakan dari `?ok=` supaya banner-nya dirender sebagai
 * `AlertBox` merah, bukan hijau.
 */

/** `Content-Type` yang dikirim `<form method="post">` tanpa `enctype` khusus. */
const JENIS_FORM = /^(application\/x-www-form-urlencoded|multipart\/form-data)\b/i;

/**
 * True kalau request ini datang dari `<form>` native, bukan dari `fetch()`.
 *
 * `fetch` memakai `Content-Type: application/json` seperti yang dikirim semua
 * island React yang masih ada. Satu route bisa melayani keduanya: JSON untuk
 * island, form untuk halaman ringan.
 */
export function postingForm(req: Request): boolean {
  return JENIS_FORM.test(req.headers.get('content-type') ?? '');
}

/** Batas panjang pesan di query, supaya URL tidak jadi tidak wajar. */
const MAKS_PESAN = 300;

/** Panjang maksimum jalur kembali yang diterima dari field tersembunyi. */
const MAKS_JALUR = 400;

/**
 * Bersihkan jalur kembali dari field form tersembunyi.
 *
 * Field ini datang dari browser, jadi tidak boleh dipercaya apa adanya:
 * `https://phishing.example` dan `//phishing.example` (protocol-relative)
 * keduanya akan membuat browser meninggalkan origin kita kalau dipakai
 * mentah-mentah sebagai `Location`. Jadi hanya path relatif dengan satu slash
 * depan yang diterima; sisanya jatuh ke `bawaan`.
 */
export function jalurKembali(nilai: FormDataEntryValue | null | undefined, bawaan: string): string {
  const v = typeof nilai === 'string' ? nilai.trim() : '';
  if (v.length === 0 || v.length > MAKS_JALUR) return bawaan;
  if (!v.startsWith('/') || v.startsWith('//')) return bawaan;
  return v;
}

/**
 * Balas POST form dengan redirect ke halaman asal.
 *
 * Selalu 303 (lihat `arahkan()`): setelah POST, halaman asal harus diambil
 * dengan GET. Kalau ternyata 307, browser mengulang POST ke halaman itu dan
 * form-nya terkirim dua kali — top up jadi dua kali.
 */
export function balik(jalur: string, hasil: { ok?: string; err?: string }): NextResponse {
  const pesan = hasil.ok ?? hasil.err;
  const kunci = hasil.ok ? 'ok' : 'err';

  const bersih = (pesan ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .slice(0, MAKS_PESAN);

  if (bersih.length === 0) return arahkan(jalur);

  const qs = kueri({ [kunci]: bersih });
  return arahkan(`${jalur}${jalur.includes('?') ? '&' : '?'}${qs}`);
}
