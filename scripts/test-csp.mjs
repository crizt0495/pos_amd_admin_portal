/**
 * =============================================================================
 *  TES KEBERHASILAN CSP — menjaga hash skrip /login tetap sinkron
 * =============================================================================
 *
 * CSP halaman `/login` mengizinkan skrip inline-nya dengan HASH sha256, bukan
 * nonce. Itu pilihan paling ketat (halaman tetap boleh di-cache), tapi punya
 * satu syarat: hash-nya harus cocok dengan isi skrip yang sebenarnya.
 *
 * Kalau skrip diubah tanpa memperbarui `LOGIN_SCRIPT_SHA256`, akibatnya bukan
 * "sebagian fitur gagal" — halaman `/login` akan DIAM-DIAM diblokir CSP
 * (`?error=` dan `?next=` berhenti bekerja) dan penyebabnya sulit dilacak.
 *
 * Test ini menutup celah itu: fail dengan pesan yang menyuruh paste hash baru.
 *
 * Jalankan: npm run test:csp
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let lulus = 0;
let gagal = 0;

function cek(nama, ok, detail = '') {
  if (ok) {
    lulus++;
    console.log(`  OK   ${nama}`);
  } else {
    gagal++;
    console.log(`  GAGAL ${nama}${detail ? `\n       ${detail}` : ''}`);
  }
}

/** Ambil isi literal di antara backtick pertama dan penutupnya. */
function literalTemplate(path, nama) {
  const src = readFileSync(path, 'utf8');
  const re = new RegExp(`const ${nama} = \`([\\s\\S]*?)\`;`);
  const m = src.match(re);
  if (!m) throw new Error(`Tidak menemukan \`const ${nama} = \\\`...\\\`\` di ${path}`);
  return m[1];
}

const loginHtmlSrc = readFileSync(join(ROOT, 'src', 'lib', 'login-html.ts'), 'utf8');
const cspSrc = readFileSync(join(ROOT, 'src', 'lib', 'csp.ts'), 'utf8');
const middlewareSrc = readFileSync(join(ROOT, 'src', 'middleware.ts'), 'utf8');

/** Buang komentar block dan line agar grep header tidak menyambar penjelasan. */
function tanpaKomentar(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

// --- 1. Hash CSP harus cocok dengan skrip login yang sebenarnya ---------------
const script = literalTemplate(join(ROOT, 'src', 'lib', 'login-html.ts'), 'SCRIPT');
const hashAsli = createHash('sha256').update(script, 'utf8').digest('base64');
const hashDiCsp = /LOGIN_SCRIPT_SHA256\s*=\s*'([^']+)'/.exec(cspSrc)?.[1];

cek('LOGIN_SCRIPT_SHA256 ada di csp.ts', Boolean(hashDiCsp));
cek(
  'hash CSP cocok dengan isi SCRIPT',
  hashDiCsp === hashAsli,
  hashDiCsp
    ? `csp.ts punya : ${hashDiCsp}\n       script sekarang: ${hashAsli}` +
        `\n       perbaiki dengan: export const LOGIN_SCRIPT_SHA256 = '${hashAsli}';`
    : '',
);

// --- 2. Halaman login tidak boleh memakai nonce (memang tidak perlu) ---------
/*
 * Bentuknya `buildCsp(pathname === '/login' ? { supabaseUrl } : { nonce, supabaseUrl })`
 * — cabang login TIDAK boleh menyebut `nonce`.
 */
const cabangLogin = /pathname === '\/login'\s*\?\s*\{([^}]*)\}/.exec(tanpaKomentar(middlewareSrc));
cek(
  '/login memakai hash, bukan nonce',
  Boolean(cabangLogin) && !/\bnonce\b/.test(cabangLogin[1]),
  cabangLogin ? `cabang /login berisi: {${cabangLogin[1].trim()}}` : 'cabang ternary tidak ketemu',
);

// --- 3. Nonce harus diteruskan ke Next lewat header `x-nonce` ---------------
cek(
  'middleware meneruskan nonce lewat request header x-nonce',
  /requestHeaders\.set\('x-nonce', nonce\)/.test(middlewareSrc) &&
    /NextResponse\.next\(\{ request: \{ headers: requestHeaders \} \}\)/.test(middlewareSrc),
);

// --- 4. Nonce harus benar-benar acak per request ----------------------------
cek(
  'nonce dibuat dari CSPRNG (crypto.getRandomValues)',
  /crypto\.getRandomValues\(new Uint8Array\(/.test(middlewareSrc),
);

// --- 5. Semua respons harus mendapat header keamanan ------------------------
cek(
  'semua respons lewat pasangKeamanan (termasuk redirect)',
  /return pasangKeamanan\(hasil, csp\)/.test(middlewareSrc) &&
    /async function proses\(/.test(middlewareSrc),
);

// --- 6. src/middleware.ts tidak lagi mendefinisikan header keamanan sendiri -
cek(
  'middleware tidak menduplikasi header keamanan',
  !/X-Frame-Options|Content-Security-Policy|Cross-Origin-Opener-Policy/.test(
    tanpaKomentar(middlewareSrc),
  ),
);

// --- 7. next.config.mjs tidak lagi mendefinisikan header keamanan -----------
const nextConfigSrc = readFileSync(join(ROOT, 'next.config.mjs'), 'utf8');
cek(
  'next.config.mjs tidak menduplikasi header keamanan',
  !/X-Frame-Options|X-Content-Type-Options|Referrer-Policy|Content-Security-Policy/.test(
    tanpaKomentar(nextConfigSrc),
  ),
);

// --- 8. Arahan CSP wajib untuk Mitigasi DOM XSS ------------------------------
cek("csp.ts punya require-trusted-types-for 'script'", /require-trusted-types-for 'script'/.test(cspSrc));
cek('csp.ts punya frame-ancestors', /frame-ancestors 'none'/.test(cspSrc));
cek('csp.ts punya object-src none', /object-src 'none'/.test(cspSrc));
cek('csp.ts punya base-uri', /base-uri 'self'/.test(cspSrc));
cek('csp.ts punya form-action', /form-action 'self'/.test(cspSrc));
cek('csp.ts mengirim COOP', /Cross-Origin-Opener-Policy.*same-origin/s.test(cspSrc));

// --- 8b. Policy anak milik webpack Next harus diizinkan ---------------------
// Webpack Next menyetel `output.trustedTypes = "nextjs#bundler"` untuk bundel
// sisi klien, jadi runtime selalu membuat policy bernama itu. Policy `nextjs`
// yang dibuat Next tidak meneruskan `policyName`, jadi Chrome menolak policy
// anak yang namanya tidak ada di directive `trusted-types`; akibatnya hydration
// React gagal dan setiap halaman React kosong. Cek ini menjaga agar jangan
// terlupakan lagi seperti yang terjadi di produksi.
const trustedTypesDirective = cspSrc.match(/`trusted-types ([^`]*)`/);
cek(
  'csp.ts mengizinkan policy nextjs',
  Boolean(trustedTypesDirective) && /\bnextjs\b/.test(trustedTypesDirective[1]),
  trustedTypesDirective ? `ditemukan: "${trustedTypesDirective[1]}"` : 'directive tidak ada',
);
cek(
  'csp.ts mengizinkan policy nextjs#bundler milik webpack',
  Boolean(trustedTypesDirective) && /nextjs#bundler/.test(trustedTypesDirective[1]),
  trustedTypesDirective ? `ditemukan: "${trustedTypesDirective[1]}"` : 'directive tidak ada',
);

// --- 9. Halaman login benar-benar tidak punya React -------------------------
cek(
  'loginHtml tidak memuat chunk JS eksternal apa pun',
  !/<script[^>]*\ssrc=/.test(loginHtmlSrc) && /const SCRIPT = `/.test(loginHtmlSrc),
);

console.log(`\n${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
