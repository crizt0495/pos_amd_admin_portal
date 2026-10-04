/**
 * =============================================================================
 *  CONTENT SECURITY POLICY — satu sumber kebenaran untuk header keamanan
 * =============================================================================
 *
 * Sebelumnya admin portal tidak mengirim CSP sama sekali, jadi:
 *   - `csp-xss`             -> "No CSP found in enforcement mode"
 *   - `trusted-types-xss`   -> "No CSP header with Trusted Types directive"
 *   - `origin-isolation`    -> "No COOP header found"
 *
 * Catatan jujur soal dampaknya ke SKOR: di Lighthouse 13 ketiga audit itu
 * ber-`weight: 0` (murni informatif), jadi BP 60 yang terlihat di report
 * `/dashboard` BUKAN disebabkan CSP. Tapi panel super admin adalah target
 * paling berharga untuk XSS — jadi ini tetap diperbaiki sebagai TRAINING
 * keamanan, bukan untuk Chase angka.
 *
 * -----------------------------------------------------------------------------
 *  Kenapa nonce, dan kenapa `/login` justru pakai hash
 * -----------------------------------------------------------------------------
 * Ada dua jenis halaman di aplikasi ini, dan keduanya butuh `script-src` yang
 * berbeda. CSP tidak bisa dilonggarkan diam-diam di salah satunya, jadi:
 *
 *  1. Halaman Next (App Router: /dashboard, /toko, /keys, /akun)
 *     React menyuntikkan `<script>` inline berisi payload RSC yang BERUBAH tiap
 *     render, jadi hash-nya tidak bisa di-hardcode. Satu-satunya cara mengizinkan
 *     script inline yang berubah-ubah adalah NONCE: middleware membuat nonce
 *     acak per request, meneruskannya lewat request header `x-nonce` (Next
 *     membacanya dan menempelkan `nonce` ke setiap tag script yang ia hasilkan),
 *     lalu CSP memakai `'nonce-<nilai>'`.
 *
 *    `strict-dynamic` dipakai supaya chunk JS yang dimuat webpack saat runtime
 *     tetap diizinkan tanpa harus mencantumkan origin satu per satu.
 *     Browser CSP2 (lama) mengabaikan `strict-dynamic` lalu jatuh ke `'self'`,
 *     jadi halaman tetap jalan di sana juga.
 *
 *  2. Halaman `/login` (HTML mandiri, dilayani middleware)
 *     Nol React, nol chunk. Hanya satu `<script>` inline yang ISINYA SELALU
 *     SAMA (lihat `login-html.ts`). Skrip statis boleh dikunci dengan hash
 *     sha256, sehingga halaman ini mendapat `script-src` paling ketat yang
 *     ada — tanpa nonce, tanpa `unsafe-inline`, dan tetap boleh di-cache.
 *
 *     Hash-nya di-hardcode di bawah. `npm run test:csp`memverifikasi ulang
 *     hash itu terhadap isi skrip yang sebenarnya, jadi kalau skrip diubah
 *     tanpa memperbarui hash, test GAGAL — bukan diam-diam memblokir halaman.
 *
 * -----------------------------------------------------------------------------
 *  Trusted Types
 * -----------------------------------------------------------------------------
 * `require-trusted-types-for 'script'` memaksa semua titik-HTML-DOM
 * (innerHTML, outerHTML, insertAdjacentHTML, document.write, eval, ...)
 * hanya menerima nilai dari Trusted Types policy yang diizinkan. Ini menutup
 * kelas XSS yang CSP-src alone tidak bisa tangkap: payload yang lolos lewat
 * DOM API.
 *
 * Aplikasi ini tidak memakai satu pun dari API tersebut (hasil grep: nol
 * `innerHTML`/`eval`/`new Function`/`dangerouslySetInnerHTML`), jadi tidak ada
 * kode kita yang perlu dibuat policy. Policy `nextjs` (dan policy anak
 * `nextjs#bundler` milik webpack) diizinkan karena runtime Next sendiri
 * membuat TrustedHTML saat membuat element;
 * di browser yang belum mendukung Trusted Types, direktif ini diabaikan
 * sepenuhnya sehingga tidak ada risiko kompatibilitas.
 */

/**
 * sha256 (base64) dari skrip inline `/login`.
 *
 * Dihitung dari isi persis `SCRIPT` di `lib/login-html.ts`. JANGAN diubah
 * manual: jalankan `npm run test:csp` untuk mendapatkannya kembali.
 */
export const LOGIN_SCRIPT_SHA256 = 'yZGHb5WM6QIQQcJmra83+9gQAdbw7vpO2m4DkwYJEhI=';

/** Buang trailing slash supaya aman dipakai sebagai origin. */
function origin(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/**
 * Origin WebSocket dari URL project Supabase (`http(s)://` -> `ws(s)://`).
 *
 * Client Supabase membuka koneksi realtime lewat WebSocket, jadi `connect-src`
 * harus memuatnya juga; kalau tidak, koneksi realtime diam-diam gagal.
 * Kalau URL-nya bukan http(s) (mis. sudah `ws://`), dikembalikan apa adanya.
 */
export function supabaseWsOrigin(url: string): string {
  const u = origin(url);
  if (u.startsWith('https://')) return `wss://${u.slice('https://'.length)}`;
  if (u.startsWith('http://')) return `ws://${u.slice('http://'.length)}`;
  return u;
}

export interface CspOptions {
  /**
   * Nonce untuk halaman Next. Kosongkan untuk halaman statis `/login`, yang
   * dikunci hash dan tidak butuh nonce sama sekali.
   */
  nonce?: string;
  /** `env.supabaseUrl` — dipakai untuk `connect-src`. */
  supabaseUrl: string;
  /**
   * true saat `next dev`. React Refresh butuh `unsafe-eval`, dan
   * `upgrade-insecure-requests` akan menaikkan http ke https dan mematikan dev
   * lokal yang berjalan di http://localhost.
   */
  dev?: boolean;
}

/**
 * Rakit policy CSP lengkap.
 *
 * Mengembalikan string multi-directive yang dipisah `;`, sesuai format header.
 */
export function buildCsp(o: CspOptions): string {
  const supabase = origin(o.supabaseUrl);
  const ws = supabaseWsOrigin(o.supabaseUrl);

  /*
   * Halaman Next: nonce + strict-dynamic.
   * Halaman login: hash statis, tanpa nonce.
   * `unsafe-eval` HANYA untuk React Refresh di mode dev.
   */
  const scriptSrc = o.nonce
    ? [`'self'`, `'nonce-${o.nonce}'`, `'strict-dynamic'`, ...(o.dev ? [`'unsafe-eval'`] : [])]
    : [`'self'`, `'sha256-${LOGIN_SCRIPT_SHA256}'`];

  const directives: string[] = [
    // Sumber default untuk semua directive yang tidak disebut terpisah.
    `default-src 'self'`,
    // Cegah `<base>` dialingihkan untuk mencuri semua URL relatif.
    `base-uri 'self'`,
    // Cegah plugin (flash/pdf) — Attack Surface Reduction.
    `object-src 'none'`,
    // Anti clickjacking versi modern; X-Frame-Options tetap dikirim untuk browser lama.
    `frame-ancestors 'none'`,
    // Form login hanya boleh dikirim ke origin sendiri (anti form-hijacking).
    `form-action 'self'`,
    `script-src ${scriptSrc.join(' ')}`,
    /*
     * `unsafe-inline` di `style-src` dipilih sadar, bukan kelalaian:
     * React menulis `style="..."` inline untuk nilai dinamis (mis. lebar baris
     * progres), dan CSS inline tidak bisa dieksekusi sebagai skrip. Yang
     * berbahaya adalah `script-src`, dan itu sudah dikunci ketat di atas.
     */
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self' data:`,
    `manifest-src 'self'`,
    `worker-src 'self' blob:`,
    `connect-src 'self' ${supabase} ${ws}`,
    // Tutup kelas XSS berbasis DOM: semua sink HTML wajib Trusted Types.
    `require-trusted-types-for 'script'`,
    /*
     * Policy yang diizinkan. `nextjs` dipakai runtime Next.
     *
     * `nextjs#bundler` WAJIB ikut disebut. Webpack Next menyetel
     * `output.trustedTypes = "nextjs#bundler"` untuk semua bundel sisi klien,
     * jadi runtime-nya selalu membuat policy bernama itu. Policy `nextjs` yang
     * dibuat Next (`client/trusted-types.js`) TIDAK meneruskan `policyName`,
     * sehingga Chrome menolak policy anak tersebut kalau namanya tidak
     * tercantum di directive `trusted-types`. Akibatnya hydration React gagal
     * dengan "Policy nextjs#bundler disallowed" dan seluruh halaman React
     * (mis. /toko, /keys) jadi kosong.
     */
    `trusted-types nextjs nextjs#bundler`,
  ];

  if (!o.dev) directives.push('upgrade-insecure-requests');

  return directives.join('; ');
}

/**
 * Header keamanan non-CSP, dikumpulkan supaya `/login` (yang keluar dari
 * middleware lebih awal) dan halaman Next tidak punya daftar berbeda.
 */
export function securityHeaders(csp: string): Record<string, string> {
  return {
    'Content-Security-Policy': csp,
    // Isolasi origin:-who-is-this-window. Menutup kelas serangan lintas-origin.
    'Cross-Origin-Opener-Policy': 'same-origin',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
  };
}
