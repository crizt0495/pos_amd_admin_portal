import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';

import { demoAktif, DEMO_EMAIL, KOOKIE_DEMO } from '@/lib/demo/config';
import { createClient } from '@/lib/supabase/server';

/**
 * User Supabase yang sedang login, SEKALI per request (React cache).
 *
 * Memakai `auth.getSession()` (decode JWT dari cookie — tanpa jaringan) supaya
 * halaman admin tidak menambah satu round-trip `getUser()` di tiap render.
 * Validasi sungguhan (token palsu) tetap terjadi di `requireAdmin()` yang
 * memanggil `getUser()` — jadi halaman yang butuh data sensitif aman.
 */
export const getSessionUser = cache(async (): Promise<{ id: string; email: string } | null> => {
  // Mode demo: cookie sendiri, tanpa Supabase sama sekali.
  if (demoAktif) {
    const ada = (await cookies()).get(KOOKIE_DEMO)?.value === '1';
    return ada ? { id: 'demo', email: DEMO_EMAIL } : null;
  }

  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return null;

  return { id: user.id, email: user.email ?? '' };
});
