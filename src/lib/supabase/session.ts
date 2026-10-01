import 'server-only';

import { cache } from 'react';

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
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return null;

  return { id: user.id, email: user.email ?? '' };
});
