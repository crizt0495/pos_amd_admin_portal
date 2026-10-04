import { NextResponse, type NextRequest } from 'next/server';

import { cekKredensialDemo, demoAktif, DEMO_EMAIL, KOOKIE_DEMO } from '@/lib/demo/config';
import { env, isSupabaseFullyConfigured, PESAN_ENV_BELUM_DIISI } from '@/lib/env';
import { arahkan, kueri } from '@/lib/redirect';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/login — login admin dengan USERNAME (atau email) + password.
 *
 * Alur:
 *  1. Preflight env — kalau Supabase belum dikonfigurasi, jawab 503 dengan
 *     pesan konfigurasi, BUKAN "password salah".
 *  2. `identifier` yang mengandung "@" diperlakukan sebagai email. Kalau tidak,
 *     resolve username -> email lewat tabel `admin_accounts` (service role,
 *     di server).
 *  3. signInWithPassword(email, password) via cookie session (supabase-ssr)
 *  4. Cek role: email harus ada di env ADMIN_EMAIL **atau** punya
 *     app_metadata.role = 'super_admin'
 *  5. Kalau bukan admin -> signOut paksa (supaya sesi tidak tertinggal),
 *     lalu tolak dengan pesan jelas
 *
 * Menerima dua bentuk body:
 *  1. form-urlencoded (halaman login server-rendered) -> redirect 303
 *  2. application/json (klien API)                    -> JSON {ok,message}
 */

const PESAN_GAGAHUB =
  'Tidak dapat menghubungi server Supabase. Cek konfigurasi env di Vercel, lalu coba lagi.';
const PESAN_SALAH = 'Username atau password salah.';

/**
 * Ubah identifier yang diketik user menjadi email.
 *
 * Mengembalikan `null` bila username-nya memang tidak terdaftar — pemanggil
 * harus membalas generik supaya tidak bisa dipakai menebak username yang ada.
 */
async function identifierKeEmail(identifier: string): Promise<string | null> {
  const id = identifier.trim().toLowerCase();
  if (id.includes('@')) return id;

  const db = createAdminClient();
  const { data, error } = await db
    .from('admin_accounts')
    .select('email')
    .eq('username', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const email = data?.email;
  return email ? String(email).trim().toLowerCase() : null;
}

function safeNext(raw: string | null | undefined): string {
  if (!raw) return '/dashboard';
  return raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard';
}

function isFormRequest(contentType: string | null): boolean {
  return !contentType || contentType.toLowerCase().includes('application/x-www-form-urlencoded');
}

function formError(req: NextRequest, message: string): NextResponse {
  const next = safeNext(req.nextUrl.searchParams.get('next'));
  return arahkan(`/login?${kueri({ error: message, next })}`, 303);
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type');
  const viaForm = isFormRequest(contentType);

  let identifier = '';
  let password = '';
  let next = '/dashboard';

  if (viaForm) {
    const form = await req.formData();
    identifier = String(form.get('identifier') ?? form.get('email') ?? '')
      .trim()
      .toLowerCase();
    password = String(form.get('password') ?? '');
    next = safeNext(String(form.get('next') ?? '') || req.nextUrl.searchParams.get('next'));
  } else {
    try {
      const body = (await req.json()) as {
        identifier?: string;
        email?: string;
        password?: string;
        next?: string;
      };
      identifier = String(body.identifier ?? body.email ?? '')
        .trim()
        .toLowerCase();
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

  if (!identifier || !password) {
    const message = 'Username dan password wajib diisi.';
    return viaForm ? formError(req, message) : json({ ok: false, message }, 400);
  }

  // --- Mode demo (lokal saja) ----------------------------------------------
  // Dicek sebelum Supabase: pada mode demo tidak ada env Supabase sama sekali.
  if (demoAktif) {
    if (!cekKredensialDemo(identifier, password)) {
      return viaForm
        ? formError(req, PESAN_SALAH)
        : json({ ok: false, message: PESAN_SALAH }, 401);
    }

    if (viaForm) {
      // `Location` relatif: lihat lib/redirect.ts. URL absolut dari
      // `req.nextUrl` bisa jadi origin lain (mis. `localhost` saat diakses
      // lewat 127.0.0.1), dan Chrome lalu menolak submit form karena
      // `form-action 'self'`.
      const res = arahkan(next, 303);
      res.cookies.set(KOOKIE_DEMO, '1', {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 8,
      });
      return res;
    }

    const res = NextResponse.json(
      { ok: true, message: 'Berhasil login (mode demo).', email: DEMO_EMAIL },
      { status: 200 },
    );
    res.cookies.set(KOOKIE_DEMO, '1', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8,
    });
    return res;
  }

  // --- Preflight konfigurasi -----------------------------------------------
  // Tanpa ini, env yang kosong akan muncul sebagai "password salah" dan admin
  // akan menyalahkan kredensialnya sendiri, padahal server-nya yang belum diisi.
  if (!isSupabaseFullyConfigured()) {
    return viaForm
      ? formError(req, PESAN_ENV_BELUM_DIISI)
      : json({ ok: false, message: PESAN_ENV_BELUM_DIISI }, 503);
  }

  // --- Username -> email ----------------------------------------------------
  let email: string | null;
  try {
    email = await identifierKeEmail(identifier);
  } catch {
    return viaForm ? formError(req, PESAN_GAGAHUB) : json({ ok: false, message: PESAN_GAGAHUB }, 503);
  }

  if (!email) {
    // Sama persis dengan password salah — jangan bocak username yang terdaftar.
    return viaForm ? formError(req, PESAN_SALAH) : json({ ok: false, message: PESAN_SALAH }, 401);
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    // Jangan bocak apakah email-nya terdaftar — pesan dibuat generik.
    // Tapi bedakan "server tak bisa dihubungi" dari "kredensial salah", supaya
    // masalah konfigurasi tidak tersamar jadi masalah password.
    const takTerhubung = !error || error.status === 0;
    const message = takTerhubung ? PESAN_GAGAHUB : PESAN_SALAH;
    return viaForm
      ? formError(req, message)
      : json({ ok: false, message }, takTerhubung ? 503 : 401);
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
    return arahkan(next, 303);
  }

  return json({ ok: true, message: 'Berhasil login.', email }, 200);
}
