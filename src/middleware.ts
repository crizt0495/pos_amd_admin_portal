import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

import { demoAktif, KOOKIE_DEMO, DEMO_PASSWORD, DEMO_USERNAME } from '@/lib/demo/config';
import { env } from '@/lib/env';
import { loginHtml } from '@/lib/login-html';

/**
 * =============================================================================
 *  MIDDLEWARE — redirect cepat, PENJAGA SESI (bukan penjaga role)
 * =============================================================================
 *
 * Yang dikerjakan di sini (murah, tanpa memanggil Supabase):
 *  - Halaman admin tanpa sesi cookie -> langsung lempar /login
 *  - /login ketika sudah punya sesi cookie -> lempar /dashboard
 *
 * Yang SENGAJA TIDAK dikerjakan di sini: pengecekan role `super_admin`.
 * Alasannya, cookie sesi @supabase/ssr bukan JWT utuh yang bisa dibaca payload-nya
 * denganandal di environment Edge. Cara satu-satunya memastikan role ialah
 * memverifikasi token di server (`getUser()`) lalu mengecek app_metadata —
 * itulah yang dilakukan `requireAdmin()` di lib/supabase/guard.ts.
 *
 * Prinsipnya: middleware itu lapisan kenyamanan UX, guard.ts adalah keamanan.
 * Setiap halaman admin memanggil `requireAdmin()` sendiri, dan setiap Route
 * Handler memanggilnya sebelum menyentuh service-role client.
 */
const PROTECTED = ['/dashboard', '/toko', '/keys', '/akun'];
const PUBLIK = ['/login'];

function terProteksi(pathname: string): boolean {
  return PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Dokumen login mandiri (nol React, nol chunk JS, CSS inlined).
 *
 * Header `no-store` tetap dipasang: halaman ini menulis `?error=` dan
 * `?next=` di URL, dan respons-nya harus selalu mencerminkan build yang sedang
 * berjalan. Halaman ini terlalu kecil (HTML ~4 kB, 0 kB JS) sehingga
 * `no-store` tidak menimbulkan biaya nyata — tidak ada permintaan kedua.
 */
function halamanLogin(): Response {
  return new NextResponse(
    loginHtml({
      appName: env.appName,
      description: env.description,
      demo: demoAktif,
      demoUser: DEMO_USERNAME,
      demoPass: DEMO_PASSWORD,
    }),
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'same-origin',
      },
    },
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  let response = NextResponse.next({ request: { headers: req.headers } });

  // --- Mode demo: tanpa Supabase sama sekali -------------------------------
  // Cookie demo dicek langsung; tidak ada panggilan jaringan. Penegasan role
  // tetap di guard.ts (server) — middleware cuma lapisan UX, sama seperti
  // jalur produksi.
  if (demoAktif) {
    const sudahLogin = req.cookies.get(KOOKIE_DEMO)?.value === '1';

    if (!sudahLogin && terProteksi(pathname)) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.search = `?next=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }

    if (PUBLIK.includes(pathname)) {
      // Sudah punya sesi -> jangan perlakukan sebagai dokumen biasa.
      if (sudahLogin) {
        const url = req.nextUrl.clone();
        url.pathname = '/dashboard';
        url.search = '';
        return NextResponse.redirect(url);
      }
      return halamanLogin();
    }

    return response;
  }

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey || 'public-anon-key', {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: req.headers } });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options as never),
        );
      },
    },
  });

  // Tanpa jaringan: decode cookie sesi (JWT) untuk cek login & refresh token
  // kedaluwarsa (± tiap 1 jam). Kalau tidak ada cookie sama sekali, nol jaringan.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session && terProteksi(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (PUBLIK.includes(pathname)) {
    // `getSession()` di atas sudah selesai: kalau ada sesi, aksesnya tetap
    // divalidasi ulang oleh `requireAdmin()` di tiap halaman admin.
    if (session) {
      const url = req.nextUrl.clone();
      url.pathname = '/dashboard';
      url.search = '';
      return NextResponse.redirect(url);
    }
    return halamanLogin();
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Semua halaman & API, KECUALI aset statis Next.js (tidak perlu redirect).
     */
    '/((?!_next/static|_next/image|favicon.ico|icons/|manifest.json|sw.js).*)',
  ],
};
