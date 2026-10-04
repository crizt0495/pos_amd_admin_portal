/**
 * =============================================================================
 *  TES HALAMAN RINGAN  —  jaga supaya /dashboard tetap tanpa JavaScript
 * =============================================================================
 *
 * Halaman "ringan" adalah halaman yang dirender App Router, lalu markup-nya
 * dibersihkan: semua `<script>` dibuang dan CSS-nya di-inline jadi `<style>`.
 * Tujuannya satu: Lighthouse Performance 100 tanpa kehilangan isi halaman.
 *
 * Risiko besarnya adalah REGRESI SENYAP. Semua audit SEO tetap hijau, semua
 * tombol masih ada, tabel masih berisi data — hanya saja React ditambahkan
 * kembali diam-diam, atau `Location` redirect berubah jadi absolut, dan
 * semua selesai tanpa satu pun error di konsol.
 *
 * Yang diuji:
 *   A. `ringankan()` — fungsi murni yang membuang `<script>` dan
 *      meng-inline-kan CSS.
 *   B. Middleware hanya memakai `ringankan()` untuk route yang benar.
 *   C. Keamanan respons tidak hilang di jalur ringan.
 *   D. `Location` redirect pada route handler tetap RELATIF (bug `form-action`).
 *
 * Jalankan: npm run test:ringan
 */

import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let lulus = 0;
let gagal = 0;

function cek(nama, ok, detail = '') {
  if (ok) {
    lulus++;
    console.log(`  OK   ${nama}${detail ? ` - ${detail}` : ''}`);
  } else {
    gagal++;
    console.log(`  GAGAL ${nama}${detail ? `\n       ${detail}` : ''}`);
  }
}

const baca = (...p) => readFileSync(join(ROOT, ...p), 'utf8');

const srcRingan = baca('src', 'lib', 'html-ringan.ts');
const srcMiddleware = baca('src', 'middleware.ts');
const srcRedirect = baca('src', 'lib', 'redirect.ts');
const srcLogin = baca('src', 'app', 'api', 'auth', 'login', 'route.ts');
const srcLogout = baca('src', 'app', 'api', 'auth', 'logout', 'route.ts');

/** Buang komentar supaya grep di bawah tidak menyambar penjelasan. */
const tanpaKomentar = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const polos = (src) => tanpaKomentar(src).replace(/\s+/g, ' ');

// =============================================================================
//  A. `ringankan()` — fungsi murni, diuji lewat modul yang sudah di-transpile
// =============================================================================

/**
 * `html-ringan.ts` sengaja ditulis tanpa import apa pun supaya aman dipanggil
 * dari middleware Edge. Itu juga berarti file ini bisa di-transpile sendiri
 * oleh `typescript`, yang sudah jadi devDependency repo — tanpa toolchain lain.
 */
async function muatRingkankan() {
  const js = ts.transpileModule(srcRingan, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  const dir = mkdtempSync(join(tmpdir(), 'uji-ringan-'));
  const file = join(dir, 'html-ringan.mjs');
  writeFileSync(file, js, 'utf8');
  try {
    return await import(pathToFileURL(file).href);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const { ringankan } = await muatRingkankan();

console.log('\n[A] Fungsi ringankan()');

// Markup nyata yang keluar dari App Router: skrip dengan konten, skrip
// self-closing, chunk preloaded, satu stylesheet, dan `<link rel="icon">`
// yang HARUS tetap ada (kalau hilang, favicon 404 dan audit SEO naik).
const CONTOH = `<!DOCTYPE html><html><head>
<link rel="preload" as="script" href="/_next/static/chunks/117.js"/>
<link rel="stylesheet" href="/_next/static/css/app.css"/>
<link rel="icon" href="/icon.svg"/>
<title>Dashboard</title>
</head><body>
<script src="/_next/static/chunks/fd9d1056.js" async></script>
<script>self.__next_f.push([1,"x"])</script>
<script src="/_next/static/chunks/app/layout.js"/>
<h1>Dashboard</h1>
</body></html>`;

const css = '.app-nav{position:fixed}';
const { html: ringkas, scriptDibuang, cssTersalin } = ringankan(CONTOH, css);

cek('semua <script> dibuang', !ringkas.includes('<script'), `sisa: ${ringkas.match(/<script/g)?.length ?? 0}`);
cek('jumlah <script> yang dibuang = 3', scriptDibuang === 3, String(scriptDibuang));
cek('payload RSC inline ikut hilang', !ringkas.includes('__next_f'));
cek('CSS jadi satu <style>', (ringkas.match(/<style>/g) ?? []).length === 1, `cssTersalin=${cssTersalin}`);
cek('isi CSS masuk ke dalam <style>', ringkas.includes(`<style>${css}</style>`));
cek('link stylesheet tidak tersisa', !ringkas.includes('rel="stylesheet"'));
cek('preload chunk dibuang', !ringkas.includes('rel="preload"'));
cek('link icon tetap ada', ringkas.includes('<link rel="icon" href="/icon.svg"/>'));
cek('judul tetap ada', ringkas.includes('<title>Dashboard</title>'));
cek('isi halaman tetap ada', ringkas.includes('<h1>Dashboard</h1>'));
cek('doctype tetap ada', ringkas.trimStart().toUpperCase().startsWith('<!DOCTYPE'));

// Dua stylesheet harus tetap jadi SATU <style>; kalau tidak, CSS terkirim dua
// kali dan halaman ringan justru lebih berat dari aslinya.
const dua = ringankan(
  '<link rel="stylesheet" href="a.css"/><link rel="stylesheet" href="b.css"/><h1>x</h1>',
  css,
);
cek(
  'dua stylesheet di-collapse jadi satu <style>',
  (dua.html.match(/<style>/g) ?? []).length === 1 && !dua.html.includes('b.css'),
  `nilai: ${dua.html}`,
);

// `rel` lain yang tidak perlu untuk dokumen statis ikut dibuang.
const lain = ringankan('<link rel="modulepreload" href="x.js"/><link rel="dns-prefetch" href="//a"/>', css);
cek('modulepreload + dns-prefetch dibuang', !lain.html.includes('modulepreload') && !lain.html.includes('dns-prefetch'));

// Halaman tanpa CSS sama sekali tidak boleh gagal (botoli CSS belum dibuat).
const tanpaCss = ringankan('<h1>x</h1>', '');
cek('halaman tanpa stylesheet tetap aman', tanpaCss.html.includes('<h1>x</h1>') && !tanpaCss.html.includes('<style>'));

// =============================================================================
//  B. Middleware memakai ringankan() hanya untuk HALAMAN_RINGAN
// =============================================================================

console.log('\n[B] Middleware');

const mwPolos = polos(srcMiddleware);

cek(
  'halaman ringan memakai fungsi ringankan()',
  /ringankan\(/.test(srcMiddleware) && srcMiddleware.includes("from '@/lib/html-ringan'"),
);
cek('dari html-ringan hanya fungsi ringankan yang dipakai', /export function (\w+)/.exec(srcRingan)?.[1] === 'ringankan');

const blokSet = /HALAMAN_RINGAN\s*=\s*new Set\(\[([^\]]*)\]\)/.exec(srcMiddleware)?.[1] ?? '';
cek('HALAMAN_RINGAN memuat /dashboard', blokSet.includes("'/dashboard'"), blokSet.trim());
cek(
  'halaman interaktif TIDAK diringankan',
  !['/toko', '/keys', '/akun', '/toko/baru'].some((r) => blokSet.includes(`'${r}'`)),
  blokSet.trim(),
);

cek('pathname diteruskan ke layout lewat x-pathname', srcMiddleware.includes("'x-pathname'"));

// Header anti-rekursi: tanpa ini, middleware akan fetch dirinya sendiri
// tanpa henti dan setiap permintaan jadi dua render penuh.
cek('middleware punya header anti-rekursi', /HEADER_SUDAH\s*=\s*'x-render-halaman'/.test(srcMiddleware));
cek(
  'self-fetch menandai header anti-rekursi dan DEVELOPMENT',
  /headers\.set\(HEADER_SUDAH,\s*'1'\)/.test(srcMiddleware) && /req\.headers\.get\(HEADER_SUDAH\)/.test(srcMiddleware),
);

// Body harus bisa disunting: upstream yang mengirim gzip/br akan membuat
// `text()` mengembalikan byte terkompresi, bukan HTML.
cek(
  'self-fetch memaksa accept-encoding identity',
  /headers\.set\('accept-encoding',\s*'identity'\)/.test(srcMiddleware),
);

// Kalau upstream gagal atau CSS-nya tidak tersalin, middleware harus
// mundur ke jalur Next — jangan balas dokumen tanpa gaya.
cek(
  'gagal di upstream -> mundur ke jalur Next',
  /catch\s*\{\s*return null;?\s*\}/.test(srcMiddleware) &&
    /!upstream\.ok[\s\S]{0,80}return null/.test(srcMiddleware) &&
    /!cssTersalin\) return null/.test(srcMiddleware),
);

// Halaman ringan per-akun: jangan pernah diminjamkan cache bersama.
cek(
  'halaman ringan memakai Cache-Control private',
  /'Cache-Control':\s*'private, no-store, max-age=0'/.test(srcMiddleware),
);

// Request router (prefetch RSC) tidak boleh diringankan: balasannya bukan
// dokumen HTML, dan irreparable kalau ikut dibersihkan.
cek('prefetch RSC dilewati', mwPolos.includes("'rsc'") && mwPolos.includes("'x-middleware-prefetch'"));

cek(
  'middleware tidak mengirim CSP ganda',
  !/headers\.set\(\s*'content-security-policy'/.test(mwPolos),
);

// =============================================================================
//  C. Header keamanan tidak hilang di jalur ringan
// =============================================================================

console.log('\n[C] Keamanan di jalur ringan');

const mwSrc = baca('src', 'lib', 'csp.ts');
cek('csp.ts masih punya form-action', polos(mwSrc).includes("form-action 'self'"));
cek(
  'csp.ts masih punya require-trusted-types-for',
  polos(mwSrc).includes("require-trusted-types-for 'script'"),
);
/*
 * `require-trusted-types-for 'script'` membuat browser menolak SEMUA renderer
 * Trusted Types. Kalau suatu saat ada `innerHTML`, `insertAdjacentHTML`, atau
 * `eval` di `src/`, aplikasi langsung mati di browser. Guard di sini.
 */
const BERBAHAYA =
  /\.(?:innerHTML|outerHTML)\s*=|insertAdjacentHTML|document\.write\s*\(|\beval\s*\(|new\s+Function\s*\(/;

function kumpulkanSrc(dir = join(ROOT, 'src')) {
  const keluar = [];
  for (const entri of readdirSync(dir, { withFileTypes: true })) {
    const penuh = join(dir, entri.name);
    if (entri.isDirectory()) keluar.push(...kumpulkanSrc(penuh));
    else if (/\.(?:ts|tsx|js|jsx)$/.test(entri.name)) keluar.push(penuh);
  }
  return keluar;
}

const sumberBerbahaya = kumpulkanSrc()
  .filter((f) => BERBAHAYA.test(tanpaKomentar(readFileSync(f, 'utf8'))))
  .map((f) => f.slice(ROOT.length + 1));

cek(
  'tidak ada injeksi HTML mentah di src (syarat require-trusted-types-for)',
  sumberBerbahaya.length === 0,
  sumberBerbahaya.join('\n       '),
);

/*
 * Halaman ringan dibuat sebagai `NextResponse` BARU, bukan hasil render Next.
 * Jadi header keamanan hanya sampai ke sana kalau middleware tetap
 * membungkus semua keluarannya. Kalau satu jalur lupa, halaman /dashboard
 * kehilangan CSP-nya sendiri - dan tidak ada yang complained.
 */
cek(
  'middleware membungkus semua respons dengan pasangKeamanan',
  /return pasangKeamanan\(hasil, csp\)/.test(srcMiddleware),
);
cek(
  'pasangKeamanan menempelkan header ke respons apa pun',
  /function pasangKeamanan\(\s*response:\s*NextResponse[\s\S]{0,200}response\.headers\.set/.test(srcMiddleware),
);
cek(
  'halaman ringan tetap memakai respons NextResponse (bukan string)',
  /return new NextResponse\(html,\s*\{/.test(srcMiddleware),
);

// =============================================================================
//  D. `Location` redirect route handler harus RELATIF
// =============================================================================

console.log('\n[D] Location redirect');

const loginPolos = polos(srcLogin);
const logoutPolos = polos(srcLogout);
const redirectPolos = polos(srcRedirect);

cek('helper arahkan() ada', srcRedirect.includes('export function arahkan('));
cek(
  'helper arahkan() menolak path protocol-relative',
  /pathname\.startsWith\('\/\/'\)[\s\S]{0,400}?throw new Error/.test(srcRedirect),
);

cek('login memakai arahkan()', loginPolos.includes('arahkan(') && !loginPolos.includes('NextResponse.redirect('));
cek('logout memakai arahkan()', logoutPolos.includes('arahkan(') && !logoutPolos.includes('NextResponse.redirect('));

/*
 * Semua redirect route handler harus lewat `arahkan()`. `NextResponse.redirect`
 * memaksa `Location` jadi URL absolut yang diambil dari `req.nextUrl`, dan itu
 * bisa jadi origin lain dari yang dipakai browser.
 */
for (const [nama, src] of [
  ['api/stores', baca('src', 'app', 'api', 'stores', 'route.ts')],
  ['api/topup', baca('src', 'app', 'api', 'topup', 'route.ts')],
  ['api/akun/reset-password', baca('src', 'app', 'api', 'akun', 'reset-password', 'route.ts')],
]) {
  cek(`${nama} tidak punya redirect absolut`, !polos(src).includes('NextResponse.redirect('));
}

// Sebaliknya, middleware HARUS tetap absolut: runner Next.js mem-parse ulang
// header Location dengan `new NextURL()`, dan path relatif jadi 500.
const mwRedirectPakai = polos(srcMiddleware).includes('NextResponse.redirect(');
cek('middleware tetap memakai NextResponse.redirect (wajib absolut)', mwRedirectPakai);
cek('middleware tidak memakai arahkan()', !mwPolos.includes('arahkan('));

// =============================================================================
//  E. CSS hasil build benar-benar ada
// =============================================================================

console.log('\n[E] CSS ter-inline');

let cssPunya = 0;
try {
  cssPunya = baca('src', 'generated', 'app-css.ts').length;
} catch {
  /* file belum ada */
}
cek(
  'src/generated/app-css.ts ada dan berisi CSS',
  cssPunya > 5000,
  cssPunya ? `${cssPunya} byte` : 'belum ada - jalankan `npm run build` atau `node scripts/gen-css.mjs`',
);
cek('gen-css.mjs terpasang di prebuild', baca('package.json').includes('scripts/gen-css.mjs'));

console.log(`\n== ${lulus} lulus, ${gagal} gagal ==`);
process.exit(gagal ? 1 : 0);
