import { NextResponse, type NextRequest } from 'next/server';

import { demoAktif, KOOKIE_DEMO } from '@/lib/demo/config';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/logout — hapus sesi admin.
 *
 * Selalu balas 303 ke /login walau sesi sudah tidak ada, supaya tombol
 * "Keluar" tidak pernah menggantung di halaman error.
 */
export async function POST(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';

  // Mode demo: cukup hapus cookie demo, jangan sentuh Supabase.
  if (demoAktif) {
    const res = NextResponse.redirect(url, 303);
    res.cookies.set(KOOKIE_DEMO, '', { path: '/', maxAge: 0 });
    return res;
  }

  const supabase = createClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(url, 303);
}
