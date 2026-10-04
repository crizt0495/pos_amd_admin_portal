import { NextResponse } from 'next/server';

/**
 * =============================================================================
 *  ARAHKAN — respons 30x dengan `Location` RELATIF
 * =============================================================================
 *
 * Kenapa tidak pakai `NextResponse.redirect(url)`?
 *
 * 1. `NextResponse.redirect` memaksa `Location` jadi URL ABSOLUT, karena
 *    `validateURL()` di dalamnya memanggil `new URL(url).toString()`. URL
 *    relatif akan dilempar sebagai error.
 *
 * 2. `req.nextUrl` tidak selalu menghasilkan origin yang sama dengan yang
 *    dipakai browser. Diuji di `next start`: request dari
 *    `http://127.0.0.1:3100/login` dibalas `Location: http://localhost:3100/dashboard`.
 *    Port ikut benar, tapi hostname diganti `localhost`. Di belakang proxy, di
 *    preview deployment, atau saat diakses lewat IP LAN, hasilnya bisa jadi
 *    origin yang benar-benar berbeda.
 *
 * 3. Akibatnya besar, bukan kosmetik. Chrome mengevaluasi `form-action` di
 *    seluruh rantai redirect sebuah submit form, bukan hanya permintaan
 *    pertama. Jadi login dari `127.0.0.1` + CSP `form-action 'self'` + redirect
 *    absolut ke `localhost` menghasilkan:
 *
 *        Sending form data to 'http://127.0.0.1:3100/api/auth/login'
 *        violates the following Content Security Policy directive:
 *        "form-action 'self'". The request has been blocked.
 *
 *    Form login-nya tidak pernah terkirim. Ini persis bug yang membuat CSP
 *    commit `6faa4d8`+"ringan" belum boleh dianggap aman sebelum diuji browser.
 *
 * `Location: /dashboard` selalu menyelesaikan semua itu: browser tetap di origin
 * yang sama, jadi cocok dengan `'self'`, dan tidak ada satu pun hop lintas
 * origin yang perlu dipikirkan.
 *
 * Cakupan: HANYA untuk route handler (`src/app/api/**`). Jangan pakai di
 * `src/middleware.ts` — runner middleware Next.js membaca header `Location`
 * respons lalu mem-parse ulang dengan `new NextURL(location)`, yang melempar
 * `TypeError: Invalid URL` untuk path relatif (menjadi 500). Middleware
 * redirect bukan submit form, jadi `form-action` tidak ikut menilai, dan
 * `NextResponse.redirect()` di sana tetap aman.
 *
 * @param pathname  path relatif, SELALU diawali `/` (boleh berisi `?query`).
 * @param status    Kode status redirect. 303 untuk hasil POST, 307 untuk GET.
 */
export function arahkan(pathname: string, status = 303, headers?: HeadersInit): NextResponse {
  if (!pathname.startsWith('/') || pathname.startsWith('//')) {
    // `//evil.example` dibaca browser sebagai protocol-relative URL, yaitu
    // navigasi lintas origin. Tolak lebih dulu, jangan pernah kirim.
    throw new Error(`arahkan(): path harus relatif satu slash, bukan "${pathname}"`);
  }

  const res = new NextResponse(null, { status, headers });
  res.headers.set('Location', pathname);
  return res;
}

/**
 * Susun query string dari objek, dengan `encodeURIComponent` pada nilainya.
 *
 * Sengaja tidak memakai `URLSearchParams.toString()`: itu meng-encode spasi jadi
 * `+`, sedangkan `?next=%2Fdashboard` yang dihasilkan harus persis seperti yang
 * dibaca `safeNext()` di route login.
 */
export function kueri(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}
