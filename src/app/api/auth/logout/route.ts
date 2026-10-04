import { type NextRequest } from 'next/server';

import { demoAktif, KOOKIE_DEMO } from '@/lib/demo/config';
import { arahkan } from '@/lib/redirect';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/logout — hapus sesi admin.
 *
 * Selalu balas 303 ke /login walau sesi sudah tidak ada, supaya tombol
 * "Keluar" tidak pernah menggantung di halaman error.
 */
export async function POST(_req: NextRequest) {
  /*
   * `Location` RELATIF: lihat lib/redirect.ts. Tombol Keluar adalah submit form
   * tanpa JS, jadi tujuan redirect-nya juga dievaluasi oleh `form-action 'self'`.
   * URL absolut dari `req.nextUrl` bisa jadi origin lain (mis. `localhost`
   * saat aplikasi diakses lewat 127.0.0.1), lalu Chrome memblokir submit-nya.
   */
  if (demoAktif) {
    // Cukup hapus cookie demo, jangan sentuh Supabase.
    const res = arahkan('/login', 303);
    res.cookies.set(KOOKIE_DEMO, '', { path: '/', maxAge: 0 });
    return res;
  }

  const supabase = createClient();
  await supabase.auth.signOut();

  return arahkan('/login', 303);
}
