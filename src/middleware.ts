import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

import { buildCsp, securityHeaders } from '@/lib/csp';
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
 *  - Setiap respons (termasuk redirect) mendapat header CSP + keamanan
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

const DEV = process.env.NODE_ENV !== 'production';

function terProteksi(pathname: string): boolean {
  return PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Nonce acak untuk CSP halaman Next.
 *
 * Diteruskan ke Next lewat request header `x-nonce`; Next membacanya dan
 * menempelkan nilai yang sama ke setiap tag `<script>` yang ia hasilkan, jadi
 * hanya script milik render ini yang boleh jalan. Nonce baru dibuat tiap
 * request, sehingga blokir serialize dari HTML lama otomatis tidak berlaku.
 *
 * 16 byte acak dari CSPRNG browser (Edge runtime), di-encode base64 supaya
 * aman ditulis apa adanya ke dalam header HTTP.
 */
function buatNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let biner = '';
  for (let i = 0; i < bytes.length; i++) biner += String.fromCharCode(bytes[i]);
  return btoa(biner);
}

/**
 * Dokumen login mandiri (nol React, nol chunk JS, CSS inlined).
 *
 * Header `no-store` tetap dipasang: halaman ini menulis `?error=` dan
 * `?next=` di URL, dan respons-nya harus selalu mencerminkan build yang sedang
 * berjalan. Halaman ini terlalu kecil (HTML ~4 kB, 0 kB JS) sehingga
 * `no-store` tidak menimbulkan biaya nyata — tidak ada permintaan kedua.
 *
 * CSP-nya TIDAK ditulis di sini: semua header keamanan dipasang satu kali di
 * `pasangKeamanan` supaya tidak ada dua daftar yang bisa berbeda.
 */
function halamanLogin(): NextResponse {
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
      },
    },
  );
}

/**
 * Tambahkan CSP + header keamanan ke respons apa pun, termasuk redirect.
 *
 * Redirect ikut diberi CSP karena browser tetap bisa mengikutinya; tidak
 * ada biaya, dan konsisten dengan yang lain.
 */
function pasangKeamanan(response: NextResponse, csp: string): NextResponse {
  for (const [k, v] of Object.entries(securityHeaders(csp))) response.headers.set(k, v);
  return response;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // --- Nonce untuk CSP ------------------------------------------------------
  // Dibuat sebelum logika mana pun dijalankan supaya redirect pun punya header.
  const nonce = buatNonce();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);

  /*
   * `/login` dilayani sebagai HTML mandiri tanpa React: skrip inline-nya statis,
   * jadi dikunci hash sha256 — tanpa nonce, tanpa `unsafe-inline`, dan halamannya
   * tetap boleh di-cache. Halaman lain memakai nonce (lihat lib/csp.ts).
   */
  const csp = buildCsp(
    pathname === '/login'
      ? { supabaseUrl: env.supabaseUrl, dev: DEV }
      : { nonce, supabaseUrl: env.supabaseUrl, dev: DEV },
  );

  const hasil = await proses(req, requestHeaders);
  return pasangKeamanan(hasil, csp);
}

async function proses(req: NextRequest, requestHeaders: Headers): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  let response = NextResponse.next({ request: { headers: requestHeaders } });

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
        response = NextResponse.next({ request: { headers: requestHeaders } });
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
