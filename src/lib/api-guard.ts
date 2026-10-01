import 'server-only';

import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/supabase/guard';
import type { AdminUser } from '@/types';

/**
 * Membungkus `requireAdmin()` untuk Route Handler.
 *
 * Pola pemakaian:
 * ```ts
 * const admin = await wajibAdmin();
 * if (admin.error) return admin.error;   // sudah jadi NextResponse JSON
 * admin.user.email                       // user admin tervalidasi
 * ```
 *
 * Tujuannya: satu Route Handler TIDAK PERNAH bisa lupa cek role sebelum
 * menyentuh service-role client.
 */
export async function wajibAdmin(): Promise<
  { user: AdminUser; error: null } | { user: null; error: NextResponse }
> {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return {
      user: null,
      error: NextResponse.json({ ok: false, message: auth.error }, { status: auth.status }),
    };
  }
  return { user: auth.user, error: null };
}

/** Balasan JSON sukses yang konsisten di semua route. */
export function jsonOk<T>(message: string, data?: T, status = 200) {
  return NextResponse.json({ ok: true, message, data }, { status });
}

/** Balasan JSON gagal yang konsisten di semua route. */
export function jsonGagal(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

/** Baca body JSON dengan penanganan error -> null bila tidak valid. */
export async function bacaJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
