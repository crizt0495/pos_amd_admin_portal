import { NextResponse, type NextRequest } from 'next/server';

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
  const supabase = createClient();
  await supabase.auth.signOut();

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url, 303);
}
