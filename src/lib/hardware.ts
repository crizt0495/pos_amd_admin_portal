/**
 * =============================================================================
 *  HARDWARE ID  —  identitas unik satu perangkat kasir
 * =============================================================================
 *
 * Dipakai untuk mengunci satu serial key ke satu komputer. Yang terkunci bukan
 * "nama komputer" dan bukan "produknya", tapi ID satu device yang unik.
 *
 * ATURAN YANG TIDAK BISA DITAWAR
 *
 *  1. Hardware ID itu UUID v4. Bukan username Windows, bukan nama host, bukan
 *     nomor seri hard disk, dan BUKAN pengenal produk.
 *     Alasannya: username bisa diganti pemilik, nama host bisa diganti, dan
 *     dua komputer bisa punya motherboard yang sama. UUID per mesin tidak.
 *
 *  2. JANGAN PERNAH memakai `Win32_ComputerSystem.Manufacturer`,
 *     `Win32_ComputerSystem.Model`, `Win32_OperatingSystem.Caption`, atau
 *     nama proses/produk apa pun untuk menyusun Hardware ID.
 *     Itu bukan identitas: ribuan komputer punya nilai yang sama persis, jadi
 *     kunci akan ikut terbuka di komputer lain yang modelnya sama.
 *
 *  3. `Win32_BaseBoard.SerialNumber` hanya dipakai sebagai PENYUSUN kalau
 *     motherboard memang punya nomor seri yang NON-KOSONG (sebagian besar
 *     motherboard konsumen memang kosong atau berisi "Default string").
 *     Kalau kosong,Bagian ini HARUS DILEWATI, bukan dipakai apa adanya - kalau
 *     dipakai, semua komputer tanpa nomor seri motherboard akan mengunci ke
 *     ID yang sama.
 *
 *  4. UUID dibaca dari WMI `SELECT UUID FROM Win32_ComputerSystemProduct`. Ini
 *     bersumber dari SMBIOS dan stabil selama motherboard tidak diganti.
 *
 * RANGKUMAN URUTAN PENYUSUNAN (sisi aplikasi POS AMD / sisi klien)
 *
 *   a. UUID motherboard          -> dipakai langsung
 *   b. UUID SMBIOS + nomor seri
 *      motherboard yang benar    -> SHA-256 dari keduanya
 *   c. UUID SMBIOS + nama komputer + id instalasi Windows
 *      -> SHA-256 dari ketiganya
 *
 *   Kalau ketiganya gagal, perangkat TIDAK BISA diafinisikan. Aplikasi WAJIB
 *   menampilkan pesan error yang jelas. Fallback ke pengenal produk
 *   (poin 2) lebih berbahaya daripada tidak bisa dipakai sama sekali.
 *
 * HASIL AKHIR SELALU UUID v4, apa pun bahan bakunya. SHA-256 menghasilkan 32
 * byte, dipotong jadi 16 byte lalu diberi versi 4 dan varian RFC 4122, jadi
 * bentuknya sama persis dengan (a).
 * -----------------------------------------------------------------------------
 */

/**
 * Panjang UUID dalam bentuk teks, termasuk 4 tanda hubung.
 * `8-4-4-4-12` = 36.
 */
export const PANJANG_UUID = 36;

/**
 * Pola UUID v4 (versi 4, varian RFC 4122).
 *
 * Digit ke-15 wajib `4`, dan digit ke-20 wajib salah satu dari `89ab`. Checksum
 * sengaja TIDAK diperiksa di sini: tujuannya bukan memvalidasi UUID secara
 * ketat, tapi membedakan "berbentuk UUID" dari "bukan UUID" supaya admin bisa
 * melihat nilai UUID yang dinormalkan versus teks bebas apa pun.
 */
const POLA_UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Buang tanda hubung dan huruf besar dari sebuah UUID.
 *
 * UUID tidak sensitive huruf besar-kecil, dan sering ditulis dengan bentuk
 * berup-upercase berbeda oleh perangkat yang berbeda (`4C4C4544-...`).
 * Menormalkan ke huruf kecil tanpa tanda hubung membuat dua tulisan UUID yang
 * sama bisa dibandingkan sebagai string yang sama.
 */
export function normalHardwareId(nilai: string): string {
  return nilai.trim().toLowerCase().replace(/-/g, '');
}

/** True kalau nilai tersebut berbentuk UUID v4. */
export function uuidV4(nilai: string): boolean {
  return POLA_UUID_V4.test(nilai.trim());
}

/**
 * True kalau dua Hardware ID berarti perangkat yang sama.
 *
 * Normalisasi dilakukan di kedua sisi supaya `4C4C4544-0030...` dan
 * `4c4c45440030...` dianggap sama. Perbandingan ini yang dipakai client saat
 * memeriksa key-nya sendiri; kode yang tidak pernah memanggilnya berpeluang
 * membiarkan satu key dipakai di dua mesin tanpa sengaja.
 */
export function hardwareIdSama(a: string, b: string): boolean {
  const x = normalHardwareId(a);
  const y = normalHardwareId(b);
  return x.length > 0 && x === y;
}

/**
 * Bentukkan UUID v4 dari byte apa pun (hasil hash, atau UUID mentah).
 *
 * Dipakai client: `dariByte()` menerima 16 byte dan mengembalikan UUID v4
 * dengan byte versi/varian yang benar. Fungsi ini sengaja ADA di portal juga,
 * bukan hanya di README, supaya aturan "hasil akhir selalu UUID v4" punya satu
 * implementasi yang bisa diuji dan tidak hanya jadi dokumentasi.
 *
 * Bit versi dan varian diambil dari byte byte yang sudah ada, lalu dipaksa:
 *   byte[6] = (byte[6] & 0x0f) | 0x40   -> versi 4
 *   byte[8] = (byte[8] & 0x3f) | 0x80   -> varian RFC 4122
 */
export function dariByte(byte: ArrayLike<number>): string {
  const b = new Uint8Array(16);
  for (let i = 0; i < 16; i++) b[i] = byte[i] & 0xff;

  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;

  const hx = [...b].map((x) => x.toString(16).padStart(2, '0'));

  return [
    hx.slice(0, 4).join(''),
    hx.slice(4, 6).join(''),
    hx.slice(6, 8).join(''),
    hx.slice(8, 10).join(''),
    hx.slice(10, 16).join(''),
  ].join('-');
}

/**
 * Ringkasan Hardware ID untuk ditampilkan di portal.
 *
 * Tidak pernah memotong nilainya. Memotong UUID justru membuat admin salah
 * menyalin HWID ke tiket - dan HWID yang salah berarti key tidak akan
 * cocok di komputer yang benar. Yang boleh diubah hanya pemenggalan
 * whitespace di tepi dan spasi tak terlihat di tengah.
 */
export function rapikanTampil(nilai: string): string {
  return nilai.trim().replace(/[\u00a0\u2007\u202f]+/g, ' ');
}

/**
 * Keterangan singkat untuk ditampilkan di bawah nilai HWID.
 *
 * Menegaskan satu hal yang paling sering ditanya admin: HWID berbeda per
 * perangkat, bukan per akun dan bukan per toko. Satu toko dengan lima
 * komputer kasir punya lima HWID yang berbeda untuk key yang sama.
 */
export const CATATAN_HWID =
  'Hardware ID mengunci key ini ke SATU komputer kasir. Toko yang punya beberapa kasir akan punya Hardware ID berbeda untuk key yang sama.';