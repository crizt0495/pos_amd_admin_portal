/**
 * =============================================================================
 *  MODE DEMO — KHUSUS LOKAL
 * =============================================================================
 *
 * Mengganti Supabase dengan data in-memory supaya admin portal bisa dibuka,
 * diklik, dan dicoba tanpa database apa pun (belum ada env Supabase).
 *
 * Aturan yang tidak bisa ditawar:
 *  - Mode demo TIDAK BOLEH aktif kalau env Supabase juga terisi. Itu satu-satunya
 *    kombinasi berbahaya: aplikasi yang kredensial demo-nya aktif tapi masih
 *    bisa menyentuh database asli. Kombinasi itu membuat build GAGAL dengan
 *    pesan jelas, jadi tidak bisa lolos diam-diam ke production.
 *  - Untuk deployment demo, project Vercel/demo tidak diberi env Supabase sama
 *    sekali — data demo memang tidak butuh database.
 *  - Demo memakai kredensial dummy yang CETAK di halaman login, jadi
 *    membocorkannya tidak berbahaya selama tidak ada database di sebelahnya.
 *  - Cookie demo (`KOOKIE_DEMO`) terpisah dari cookie sesi Supabase, jadi
 *    sesi demo tidak akan pernah dianggap sesi admin sungguhan.
 *
 * Mengaktifkan:
 *   echo 'DEMO_MODE=1' >> .env.local
 *   npm run dev                  ->  http://localhost:3100
 */

export const DEMO_USERNAME = 'demo';
export const DEMO_PASSWORD = 'demo1234';
export const DEMO_EMAIL = 'demo@kasirpro.local';

export const KOOKIE_DEMO = 'kp_demo_admin';

const flag = (process.env.DEMO_MODE ?? '').trim().toLowerCase();
const aktif = flag === '1' || flag === 'true' || flag === 'yes' || flag === 'on';

/**
 * True kalau env Supabase nyata sudah terisi (dianggap nyata kalau bukan
 * placeholder `xxxx`).
 *
 * Sengaja membaca `process.env` langsung, bukan lewat `@/lib/env`, supaya file
 * ini tidak menarik modul lain — `middleware.ts` (Edge) ikut mengimpornya.
 */
function adaEnvSupabase(): boolean {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
  const secret = (
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    ''
  ).trim();

  return Boolean(url) && !url.includes('xxxx') && Boolean(secret) && !secret.includes('xxxx');
}

if (aktif && adaEnvSupabase()) {
  throw new Error(
    'DEMO_MODE=1 tidak boleh aktif bersamaan dengan env Supabase terisi. ' +
      'Mode demo memakai data palsu dan tidak butuh database. ' +
      'Matikan DEMO_MODE, atau kosongkan env Supabase project ini.',
  );
}

export const demoAktif = aktif;

/** True kalau username+password yang diketik user cocok dengan kredensial demo. */
export function cekKredensialDemo(username: string, password: string): boolean {
  if (!demoAktif) return false;
  return username.trim().toLowerCase() === DEMO_USERNAME && password === DEMO_PASSWORD;
}