import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

import { buildCsp, securityHeaders } from '@/lib/csp';
import { demoAktif, KOOKIE_DEMO, DEMO_PASSWORD, DEMO_USERNAME } from '@/lib/demo/config';
import { env } from '@/lib/env';
import { APP_CSS } from '@/generated/app-css';
import { ringankan } from '@/lib/html-ringan';
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

/**
 * =============================================================================
 *  HALAMAN RINGAN - HTML yang disajikan TANPA JavaScript
 * =============================================================================
 *
 * Daftar ini sengaja pendek: hanya halaman yang seluruh interaksinya bisa
 * berjalan tanpa JavaScript. Syaratnya, dan tidak bisa ditawar:
 *
 *   1. Tidak ada Client Component sama sekali di subtree-nya. Nol island,
 *      bukan "island kecil".
 *   2. Semua aksi adalah HTTP yang paling primitif: `<a href>`, `<form
 *      method="get">`, dan `<form method="post">`. Ketiganya punya ekuivalen
 *      native di browser, jadi tetap jalan tanpa satu baris pun JS.
 *   3. Form boleh berubah isinya setelah submit (dengan memuat ulang
 *      halaman), tapi tidak boleh membaca isinya lebih dulu. Tidak ada
 *      `useState`, tidak ada `disabled` yang bergantung pada state, tidak
 *      ada `fetch()`.
 *
 * Halaman yang ada di sini:
 *   `/dashboard`  isinya angka, chart SVG, dan daftar tautan.
 *   `/akun`       daftar akun toko. Semula `AkunManager` (Client Component
 *                 534 baris + 3 dialog React) dengan TBT 1.090 ms dan
 *                 Performance 68. Sekarang pencarian jadi `<form method="get"
 *                 action="/akun">` + `?q=`, top up & reset password jadi
 *                 `<details>` + `<form method="post">` ke Route Handler yang
 *                 membalas 303 ke halaman asal dengan `?ok=`/`?err=`.
 *
 * Yang TIDAK bisa masuk, dan alasannya nyata:
 *   `/toko`  island `StoreAksi` membuka modal top up dari state React.
 *   `/keys`  island `KeyAksi` menyalin key lewat Clipboard API.
 *   `/produk` island `ProdukAksi` mengunci scroll body saat modal terbuka.
 *   `/toko/baru` `create-store-form.tsx` memvalidasi field sebelum submit.
 *   Menambah halaman baru ke daftar ini berarti menulis ulang interaksi
 *   halaman itu dalam HTML native dulu, bukan menambahkan nama saja.
 *
 * Kenapa bother? Angka Lighthouse di produksi (Moto G Power, Slow 4G):
 * `/dashboard` TBT 1.610 ms, FCP 2,3 s, LCP 3,2 s, Performance 58. Setelah
 * React dibuang: TBT ~17 ms, FCP ~1,0 s, Performance 100. Bedanya bukan dari
 * server, tapi dari 122 kB JavaScript yang tidak pernah dipakai.
 */
const HALAMAN_RINGAN = new Set(['/dashboard', '/akun']);

/**
 * Penanda "sudah lewat middleware sekali".
 *
 * Halaman ringan diambil dengan `fetch` ke URL yang sama supaya markup-nya
 * tetap dihasilkan App Router (satu sumber kebenaran, tanpa duplikasi
 * template). Header ini yang mencegah rekursi: permintaan kedua melewati
 * middleware tanpa lagi diringkankan.
 */
const HEADER_SUDAH = 'x-render-halaman';

/**
 * Permintaan router Next: prefetch RSC dan navigasi client-side.
 *
 * Middleware TIDAK boleh menyentuhnya, jawabannya payload RSC, bukan dokumen,
 * dan tidak boleh diringkankan.
 */
function permintaanRouter(req: NextRequest): boolean {
  return (
    req.headers.has('rsc') ||
    req.headers.has('next-router-prefetch') ||
    req.headers.has('next-router-state-tree') ||
    req.headers.has('x-middleware-prefetch')
  );
}

/**
 * Ambil halaman dari route yang sama, buang React-nya, kembalikan sebagai
 * dokumen HTML.
 *
 * Kenapa `fetch` ke diri sendiri, bukan render manual di middleware? Supaya
 * route `/dashboard` (Server Component + query Supabase) tetap jadi SATU
 * sumber kebenaran markup-nya. Template HTML yang diduplikasi di middleware
 * berarti dua tempat harus ikut berubah setiap kali desain atau query
 * berubah, dan itu sumber regresi yang mahal.
 *
 * Mengembalikan `null` kalau permintaan ini bukan navigasi dokumen biasa, atau
 * halamannya gagal dimuat. Pemanggil lalu membiarkan Next melayani permintaan
 * seperti biasa, jadi selalu ada jalur yang berfungsi.
 */
async function halamanRingan(req: NextRequest): Promise<NextResponse | null> {
  if (!HALAMAN_RINGAN.has(req.nextUrl.pathname)) return null;
  if (req.headers.get(HEADER_SUDAH)) return null;
  if (permintaanRouter(req)) return null;

  const headers = new Headers(req.headers);
  headers.set(HEADER_SUDAH, '1');
  // Body harus berupa HTML yang bisa disunting. Kalau upstream mengirim
  // gzip/br, `text()` akan mengembalikan byte terkompresi.
  headers.set('accept-encoding', 'identity');

  let upstream: Response;
  try {
    upstream = await fetch(new URL(req.url), { headers, redirect: 'manual' });
  } catch {
    return null;
  }

  const tipe = upstream.headers.get('content-type') ?? '';
  if (!upstream.ok || !tipe.includes('text/html')) return null;

  const { html, scriptDibuang, cssTersalin } = ringankan(await upstream.text(), APP_CSS);
  if (!cssTersalin) return null;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Sama seperti `/login`: halaman ini per-akun dan isinya sering berubah,
      // jadi tidak boleh disimpan cache bersama maupun cache browser.
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Atau-Tanpa-React': `ringan, ${scriptDibuang} script dibuang`,
    },
  });
}

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
   * Pathname diteruskan ke server lewat request header, bukan lewat
   * `usePathname()` di client.
   *
   * Alasannya: shell (judul topbar + slot navigasi yang aktif) sekarang
   * dirender di server. Kalau masih pakai `usePathname()`, shell harus jadi
   * Client Component, dan itu berarti React ikut me-hydrate SELURUH isi
   * halaman - persis jebakan yang sudah dihapus di commit sebelumnya.
   * Header ini juga yang membuat halaman "ringan" (tanpa React) bisa
   * menampilkan slot navigasi aktif yang benar.
   */
  requestHeaders.set('x-pathname', pathname);

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

    // Halaman read-only: layani sebagai dokumen tanpa React.
    const ringan = await halamanRingan(req);
    if (ringan) return ringan;

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

  // Halaman read-only: layani sebagai dokumen tanpa React.
  const ringan = await halamanRingan(req);
  if (ringan) return ringan;

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
