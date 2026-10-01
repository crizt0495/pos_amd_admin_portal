import { NextResponse, type NextRequest } from 'next/server';

import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/login — login admin dengan EMAIL + password.
 *
 * Alur:
 *  1. signInWithPassword(email, password) via cookie session (supabase-ssr)
 *  2. Cek role: email harus ada di env ADMIN_EMAIL **atau** punya
 *     app_metadata.role = 'super_admin'
 *  3. Kalau bukan admin -> signOut paksa (supaya sesi tidak tertinggal),
 *     lalu tolak dengan pesan jelas
 *
 * Menerima dua bentuk body:
 *   1. form-urlencoded (halaman login server-rendered) -> redirect 303
 *   2. application/json (klien API)                    -> JSON {ok,message}
 */
function safeNext(raw: string | null | undefined): string {
  if (!raw) return '/dashboard';
  return raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard';
}

function isFormRequest(contentType: string | null): boolean {
  return !contentType || contentType.toLowerCase().includes('application/x-www-form-urlencoded');
}

function formError(req: NextRequest, message: string): NextResponse {
  const next = safeNext(req.nextUrl.searchParams.get('next'));
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = `?error=${encodeURIComponent(message)}&next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(url, 303);
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type');
  const viaForm = isFormRequest(contentType);

  let email = '';
  let password = '';
  let next = '/dashboard';

  if (viaForm) {
    const form = await req.formData();
    email = String(form.get('email') ?? '').trim().toLowerCase();
    password = String(form.get('password') ?? '');
    next = safeNext(String(form.get('next') ?? '') || req.nextUrl.searchParams.get('next'));
  } else {
    try {
      const body = (await req.json()) as { email?: string; password?: string; next?: string };
      email = String(body.email ?? '').trim().toLowerCase();
      password = String(body.password ?? '');
      next = safeNext(body.next);
    } catch {
      return NextResponse.json(
        { ok: false, message: 'Body JSON tidak valid.' },
        { status: 400 },
      );
    }
  }

  const json = (payload: Record<string, unknown>, status: number) =>
    NextResponse.json(payload, { status });

  if (!email || !password) {
    const message = 'Email dan password wajib diisi.';
    return viaForm ? formError(req, message) : json({ ok: false, message }, 400);
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    // Jangan bocak apakah email-nya terdaftar — pesan dibuat generik.
    const message = 'Email atau password salah.';
    return viaForm ? formError(req, message) : json({ ok: false, message }, 401);
  }

  // --- Cek role -----------------------------------------------------------
  const daftarAdmin = env.adminEmails;
  const role = data.user.app_metadata?.role;
  const bolehLewatEnv = daftarAdmin.length > 0 && daftarAdmin.includes(email);
  const bolehLewatRole = role === 'super_admin';

  if (!bolehLewatEnv && !bolehLewatRole) {
    // Paksa logout: jangan tinggalkan sesi user non-admin di browser.
    await supabase.auth.signOut();
    const message = 'Akun ini terdaftar di portal toko, bukan sebagai admin super.';
    return viaForm ? formError(req, message) : json({ ok: false, message }, 403);
  }

  if (viaForm) {
    const url = req.nextUrl.clone();
    url.pathname = next;
    url.search = '';
    return NextResponse.redirect(url, 303);
  }

  return json({ ok: true, message: 'Berhasil login.', email }, 200);
}
