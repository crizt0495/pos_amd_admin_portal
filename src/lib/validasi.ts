/**
 * Aturan validasi form admin portal.
 * Mirip portal toko supaya perilaku input terasa sama di kedua aplikasi.
 */

/** Nomor HP Indonesia: diawali 08, total 10-13 digit (mis. 081234567890). */
export const POLA_HP = /^08[0-9]{8,11}$/;

/** Buang semua karakter selain digit. */
export const hanyaDigit = (s: string) => s.replace(/\D/g, '');

/** Nama toko: minimal 3 karakter setelah dipangkas spasi. */
export const namaValid = (nama: string, min = 3) => nama.trim().length >= min;

/**
 * Validasi no HP.
 * `wajib` = false dipakai field opsional: kosong tidak error, tapi bila diisi
 * harus cocok pola 08xx.
 */
export function cekTelepon(telepon: string, wajib = false): string {
  const angka = hanyaDigit(telepon);
  if (angka.length === 0) return wajib ? 'Nomor HP wajib diisi.' : '';
  if (!POLA_HP.test(angka)) return 'Nomor HP harus diawali 08 dan 10-13 digit (mis. 081234567890).';
  return '';
}

/** Validasi alamat: minimal `min` karakter (boleh kosong bila `wajib` false). */
export function cekAlamat(alamat: string, min = 10, wajib = true): string {
  const n = alamat.trim().length;
  if (n === 0) return wajib ? 'Alamat wajib diisi.' : '';
  if (n < min) return `Alamat minimal ${min} karakter.`;
  return '';
}

/** Validasi email (cukup untuk deteksi typo, bukan RFC 5322 penuh). */
export function cekEmail(email: string, wajib = true): string {
  const v = email.trim();
  if (!v) return wajib ? 'Email wajib diisi.' : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Format email tidak valid.';
  return '';
}

/**
 * Validasi password akun toko.
 * Minimal 8 karakter + harus mengandung huruf dan angka.
 */
export function cekPassword(pw: string, wajib = true): string {
  if (!pw) return wajib ? 'Password wajib diisi.' : '';
  if (pw.length < 8) return 'Password minimal 8 karakter.';
  if (!/[a-zA-Z]/.test(pw)) return 'Password harus mengandung huruf.';
  if (!/\d/.test(pw)) return 'Password harus mengandung angka.';
  return '';
}

/** Validasi jumlah key top up: bilangan bulat, bukan 0, dalam batas wajar. */
export function cekJumlahKey(nilai: number, min = 1, maks = 10_000): string {
  if (!Number.isFinite(nilai)) return 'Jumlah harus berupa angka.';
  if (!Number.isInteger(nilai)) return 'Jumlah harus bilangan bulat.';
  // Hanya nilai POSITIF yang dibandingkan dengan `min`. Nilai negatif berarti
  // "koreksi admin" dan memang sah — batasnya sudah `maks` saja, sedangkan
  // sisa kuota tetap dijepit >= 0 oleh clamp di SQL (dan di data demo).
  if (nilai > 0 && nilai < min) return `Jumlah minimal ${Math.abs(min)} (boleh minus untuk koreksi).`;
  if (nilai === 0) return 'Jumlah tidak boleh 0.';
  if (Math.abs(nilai) > maks) return `Jumlah maksimal ${maks.toLocaleString('id-ID')}.`;
  return '';
}
