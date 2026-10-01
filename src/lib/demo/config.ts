/**
 * =============================================================================
 *  MODE DEMO — KHUSUS LOKAL
 * =============================================================================
 *
 * Mengganti Supabase dengan data in-memory supaya admin portal bisa dibuka,
 * diklik, dan dicoba tanpa database apa pun (belum ada env Supabase).
 *
 * Aturan yang tidak bisa ditawar:
 *  - Hanya boleh aktif saat `NODE_ENV !== 'production'`.
 *  - Demo memakai kredensial dummy yang CETAK di halaman login, jadi
 *    membocorkannya tidak berbahaya — TAPI hanya aman karena tidak pernah
 *    boleh nyala di production. Karena itu file ini MEMBUANG DIRI (throw)
 *    begitu `DEMO_MODE=1` bertemu `NODE_ENV=production`, sehingga `next build`
 *    untuk deploy akan GAGAL dengan pesan jelas, bukan diam-diam ter-deploy.
 *  - Tidak ada kode demo yang menyentuh Supabase. Demo memakai cookie sendiri
 *    (`KOOKIE_DEMO`), tidak pernah cookie sesi Supabase, jadi tidak ada jalan
 *    whereby demo session bisa dianggap sesi admin sungguhan.
 *
 * Mengaktifkan:
 *   cp .env.example .env.local   lalu isi  DEMO_MODE=1
 *   npm run dev                  ->  http://localhost:3100
 */

export const DEMO_USERNAME = 'demo';
export const DEMO_PASSWORD = 'demo1234';
export const DEMO_EMAIL = 'demo@kasirpro.local';

export const KOOKIE_DEMO = 'kp_demo_admin';

const flag = (process.env.DEMO_MODE ?? '').trim().toLowerCase();
const aktif = flag === '1' || flag === 'true' || flag === 'yes' || flag === 'on';

if (aktif && process.env.NODE_ENV === 'production') {
  throw new Error(
    'DEMO_MODE=1 tidak boleh aktif di NODE_ENV=production. ' +
      'Hapus DEMO_MODE dari environment project Vercel lalu deploy ulang.',
  );
}

export const demoAktif = aktif;

/** True kalau username+password yang diketik user cocok dengan kredensial demo. */
export function cekKredensialDemo(username: string, password: string): boolean {
  if (!demoAktif) return false;
  return username.trim().toLowerCase() === DEMO_USERNAME && password === DEMO_PASSWORD;
}