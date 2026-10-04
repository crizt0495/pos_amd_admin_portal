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
import { join, dirname, sep } from 'node:path';
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
 * `html-ringan.ts` dan `css-scope.ts` ditulis tanpa API Node supaya aman
 * dipanggil dari middleware Edge. Itu juga berarti file-nya bisa di-transpile
 * sendiri oleh `typescript`, yang sudah jadi devDependency repo — tanpa
 * toolchain lain. Specifier alias `@/...` dipetakan ke file sibling hasil
 * transpile.
 */
async function muatRingkankan() {
  const keJs = (src) =>
    ts.transpileModule(src, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText;

  const dir = mkdtempSync(join(tmpdir(), 'uji-ringan-'));
  try {
    writeFileSync(join(dir, 'css-scope.mjs'), keJs(baca('src', 'lib', 'css-scope.ts')), 'utf8');
    const js = keJs(srcRingan).replace("'@/lib/css-scope'", "'./css-scope.mjs'");
    writeFileSync(join(dir, 'html-ringan.mjs'), js, 'utf8');
    return await import(pathToFileURL(join(dir, 'html-ringan.mjs')).href);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const { ringankan } = await muatRingkankan();

/**
 * Muat satu file `.ts` apa pun lewat jalur transpile yang sama seperti
 * `muatRingkankan()`.
 *
 * Dipakai untuk modul yang murni fungsi dan tidak menyentuh API Node maupun
 * API server-only, jadi aman dipanggil dari sandbox test ini. Modul yang butuh
 * `@/` alias harus menulis dependensinya relatif, atau di-import lewat
 * `muatRingkankan()` yang sudah menyelesaikan alias-nya.
 */
async function muatModulTs(...bagian) {
  const js = ts.transpileModule(baca(...bagian), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const dir = mkdtempSync(join(tmpdir(), 'uji-modul-'));
  try {
    const file = join(dir, 'modul.mjs');
    writeFileSync(file, js, 'utf8');
    return await import(pathToFileURL(file).href);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Muat `css-scope.ts` lewat jalur transpile yang sama. */
async function muatSaring() {
  const js = ts.transpileModule(baca('src', 'lib', 'css-scope.ts'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const dir = mkdtempSync(join(tmpdir(), 'uji-saring-'));
  try {
    const file = join(dir, 'css-scope.mjs');
    writeFileSync(file, js, 'utf8');
    return await import(pathToFileURL(file).href);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

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
  'halaman dengan Client Component TIDAK diringankan',
  !['/toko', '/keys', '/produk', '/toko/baru'].some((r) => blokSet.includes(`'${r}'`)),
  blokSet.trim(),
);

/*
 * =============================================================================
 *  B2. GRAFI IMPORT HALAMAN RINGAN - syarat yang sebenarnya
 * =============================================================================
 *
 * Guard di atas hanya memeriksa nama route, dan itu lemah. `/akun` pernah masuk
 * daftar "jangan diringankan" semata karena isinya punya Client Component,
 * sementara penjaganya berupa daftar nama yang harus diketik tangan. Salah ketik
 * satu karakter = halaman dengan 100 kB JavaScript lolos, dan tidak ada satu
 * pun yang gagal.
 *
 * Yang diperiksa di sini tidak bisa dilanggar diam-diam: untuk setiap route di
 * HALAMAN_RINGAN, telusuri SELURUH graf import mulai dari `page.tsx`-nya, lalu
 * pastikan tidak ada satu pun file yang terjangkau punya direktif
 * `'use client'`. Kalau ada Client Component di subtree mana pun - bahkan di
 * komponen UI yang di-import dua tingkat lebih dalam - test ini gagal sambil
 * menyebut file yang menyebabkannya.
 */

const AKAR = join(ROOT, 'src');

/** Semua file .ts/.tsx di dalam `src`, untuk resolusi import berbasis nama. */
function petakanSrc(dir = AKAR, out = new Map()) {
  for (const entri of readdirSync(dir, { withFileTypes: true })) {
    const penuh = join(dir, entri.name);
    if (entri.isDirectory()) {
      petakanSrc(penuh, out);
    } else if (/\.tsx?$/.test(entri.name)) {
      out.set(penuh, readFileSync(penuh, 'utf8'));
    }
  }
  return out;
}

const PETA_SRC = petakanSrc();

/** Ubah pemisah path platform menjadi `/` supaya perbandingan stabil. */
const norm = (p) => p.split(sep).join('/');

/**
 * Resolusi satu specifier import ke file sungguhan di dalam `src`.
 *
 * Hanya bentuk yang dipakai repo ini: alias `@/...` dan relatif `./` `../`.
 * Import ke `node_modules` (next, lucide-react, ...) sengaja diabaikan - kalau
 * modul pihak ketiga sampai menarik Client Component, kerusakannya sudah di luar
 * jangkauan test statis ini.
 */
function selesaikan(dari, spec) {
  let basis;
  if (spec.startsWith('@/')) basis = join(AKAR, spec.slice(2));
  else if (spec.startsWith('.')) basis = join(dirname(dari), spec);
  else return null;

  const kandidat = [
    basis,
    `${basis}.tsx`,
    `${basis}.ts`,
    join(basis, 'index.tsx'),
    join(basis, 'index.ts'),
  ];
  return kandidat.find((p) => PETA_SRC.has(p)) ?? null;
}

/** Specifier yang ditulis statis (`from '...'`) maupun dinamis (`import('...')`). */
function specifierImport(src) {
  const keluar = [];
  for (const m of src.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) keluar.push(m[1]);
  return keluar;
}

/**
 * Direktif `'use client'` harus jadi pernyataan pertama file. Jangkar di awal
 * baris supaya penyebutan `'use client'` di dalam komentar tidak ikut terhitung.
 */
const ARAH_CLIENT = /^\s*['"]use client['"]/m;

/** Semua file yang terjangkau dari satu titik masuk, ikut masuk file itu sendiri. */
function subgraf(mulai) {
  const dikunjungi = new Set();
  const antre = [mulai];

  while (antre.length > 0) {
    const file = antre.pop();
    if (!file || dikunjungi.has(file)) continue;
    const src = PETA_SRC.get(file);
    if (src === undefined) continue;
    dikunjungi.add(file);

    for (const spec of specifierImport(src)) {
      const tujuan = selesaikan(file, spec);
      if (tujuan) antre.push(tujuan);
    }
  }

  return dikunjungi;
}

/**
 * Cari `page.tsx` yang merender sebuah route.
 *
 * Route group Next (folder `(admin)`) boleh muncul di tengah jalur, jadi
 * pencocokan dilakukan pada ekor jalur, bukan persis sama.
 *
 * Mengembalikan KUNCI peta apa adanya (path absolut asli), bukan versi
 * dinormalisasi, supaya hasilnya bisa langsung dipakai `subgraf`.
 */
function cariPage(route) {
  const semua = [...PETA_SRC.keys()];
  const ekor = norm(join('src', 'app', route)).toLowerCase();
  const target = norm(route).toLowerCase();
  const cocok = semua.filter((p) => {
    const dir = norm(dirname(p)).toLowerCase();
    return dir === ekor || dir.endsWith(target);
  });
  return cocok.length === 1 ? cocok[0] : null;
}

const ROUTE_RINGAN = [...blokSet.matchAll(/'([^']*)'/g)].map((m) => m[1]);

cek('HALAMAN_RINGAN tidak kosong', ROUTE_RINGAN.length > 0, blokSet.trim());

for (const route of ROUTE_RINGAN) {
  const page = cariPage(route);

  if (!page) {
    cek(`graf import ${route}: page.tsx ditemukan`, false, `tidak ada satu page.tsx untuk ${route}`);
    continue;
  }

  const terjangkau = subgraf(page);
  const klien = [...terjangkau]
    .filter((f) => ARAH_CLIENT.test(PETA_SRC.get(f) ?? ''))
    .map((f) => norm(f).replace(`${norm(ROOT)}/`, ''));

  cek(
    `graf import ${route} bebas Client Component`,
    klien.length === 0,
    klien.length === 0
      ? `${terjangkau.size} file terjangkau, nol 'use client'`
      : klien.join('\n       '),
  );
}

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

// =============================================================================
//  F. `saringCss()` — CSS disaring per halaman, dan TIDAK boleh ada yang hilang
// =============================================================================

console.log('\n[F] Saringan CSS per halaman');

const { saringCss, kelasDipakai, resetCacheSaring } = await muatSaring();

/**
 * CSS contoh dengan semua jebakan yang ada di keluaran Tailwind sungguhan.
 *
 * Dua baris pertama sengaja berisi jebakan yang SUDAH pernah membuat tampilan
 * rusak, jadi tidak boleh lengah kalau ada refactor lagi:
 *
 * - Banner lisensi `/*! tailwindcss v3.4.19 ...*\/` mengandung titik. Kalau
 *   ikut dibaca sebagai selector, `*,:after,:before` ikut terbuang dan
 *   `box-sizing` seluruh portal berubah.
 * - `.text-\[17px\]` punya kurung siku TER-ESCAPE di dalam nama kelasnya.
 *   Kalau selector atribut dibuang dengan regex biasa, kurung siku itu ikut
 *   hilang dan kelas `text-[17px]` tidak lagi cocok.
 */
const CSS_CONTOH = [
  '/*! tailwindcss v3.4.19 | MIT License */',
  '*,:after,:before{box-sizing:border-box}',
  '.app-nav{position:fixed}',
  '.p-4{padding:1rem}',
  '.mt-0\\.5{margin-top:.125rem}',
  '.top-1\\/2{top:50%}',
  '.z-\\[60\\]{z-index:60}',
  '.w-1\\/2{width:50%}',
  '.text-\\[17px\\]{font-size:17px}',
  '[data-x="1.5"]{display:block}',
  '.hover\\:bg-zinc-100:hover{background-color:#f4f4f5}',
  '.lg\\:grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}',
  // Regresi 2026-10: nilai arbitrer yang memuat koma. Tailwind menulis koma
  // sebagai hex escape `\2c ` (spasi ikut menjadi terminator escape), sedangkan
  // di HTML atribut `class` tidak punya spasi. Regex yang berhenti di `.` atau
  // `,` akan memotong nama kelas di tengah jalan dan aturannya ikut terbuang,
  // sehingga tabel kehilangan template kolomnya di layar lebar.
  '.lg\\:grid-cols-\\[34px_minmax\\(140px\\2c 1\\.2fr\\)_minmax\\(148px\\2c 1\\.2fr\\)\\]' +
    '{grid-template-columns:34px minmax(140px,1.2fr) minmax(148px,1.2fr)}',
  '.halaman-toko{padding:2rem}',
  '@media (min-width:768px){.lg\\:grid-cols-3{display:grid}.halaman-toko{padding:3rem}}',
  '@media (min-width:1024px){.lg\\:flex{display:flex}}',
  '@keyframes spin{to{transform:rotate(360deg)}}',
  'body{margin:0}',
  ':root{--x:1px}',
].join('');

const GRID_ARBITRER = 'lg:grid-cols-[34px_minmax(140px,1.2fr)_minmax(148px,1.2fr)]';

const HTML_LIGHT =
  '<div class="app-nav p-4 mt-0.5 top-1/2 z-[60] w-1/2 text-[17px] hover:bg-zinc-100 lg:grid-cols-3 lg:flex ' +
  GRID_ARBITRER +
  '"></div>';

resetCacheSaring();
const hasil = saringCss(CSS_CONTOH, HTML_LIGHT);

cek(
  'aturan dasar tetap ada walau ada banner lisensi',
  hasil.css.includes('*,:after,:before{box-sizing:border-box}'),
  hasil.css.slice(0, 120),
);
cek('banner lisensi ikut dipertahankan', hasil.css.includes('/*! tailwindcss'), hasil.css.slice(0, 80));
cek('kurung siku ter-escape di nama kelas ikut terbawa', hasil.css.includes('.text-\\[17px\\]{font-size:17px}'), hasil.css);
cek('selector atribut tanpa kelas tetap ada', hasil.css.includes('[data-x="1.5"]{display:block}'));
cek('kelas dengan escape CSS ikut terbawa', hasil.css.includes('.mt-0\\.5{margin-top:.125rem}'), hasil.css);
cek('kelas dengan garis miring ikut terbawa', hasil.css.includes('.top-1\\/2{top:50%}'), hasil.css);
cek('kelas dengan kurung siku ikut terbawa', hasil.css.includes('.z-\\[60\\]{z-index:60}'), hasil.css);
cek('varian hover ikut terbawa', hasil.css.includes('.hover\\:bg-zinc-100:hover'), hasil.css);
cek('varian layar lebar ikut terbawa', hasil.css.includes('.lg\\:grid-cols-3'), hasil.css);
cek(
  'grid-cols dengan nilai arbitrer ber-koma ikut terbawa (regresi hex escape \\2c)',
  hasil.css.includes('.lg\\:grid-cols-\\[34px_minmax\\(140px\\2c 1\\.2fr\\)'),
  hasil.css,
);
cek('kelas halaman lain dibuang', !hasil.css.includes('.halaman-toko'), hasil.css);
cek('aturan elemen tetap ada', hasil.css.includes('body{margin:0}'));
cek('variabel :root tetap ada', hasil.css.includes(':root{--x:1px}'));
cek('@keyframes tidak ikut terbuang', hasil.css.includes('@keyframes spin'));
cek(
  'isi @media ikut disaring',
  /@media \(min-width:768px\)\{\.lg\\:grid-cols-3\{display:grid\}\}/.test(hasil.css),
  hasil.css,
);
cek('blok @media jadi kosong dibuang', !/@media \(min-width:1024px\)\{\}/.test(hasil.css), hasil.css);
cek('CSS benar-benar mengecil', hasil.sesudah < hasil.sebelum, `${hasil.sebelum} -> ${hasil.sesudah} byte`);

// Saringan harus idempoten: CSS yang sudah disaring tidak boleh berubah lagi.
const ulang = saringCss(hasil.css, HTML_LIGHT);
cek('saringan idempoten', ulang.css === hasil.css, `${ulang.sesudah} vs ${hasil.sesudah} byte`);

// Tanpa kelas sama sekali, CSS dikembalikan utuh supaya tidak ada yang hilang.
resetCacheSaring();
const tanpaKelas = saringCss(CSS_CONTOH, '<div>halo</div>');
cek('tanpa kelas, CSS utuh dikembalikan', tanpaKelas.css === CSS_CONTOH);

// Urutan class di markup tidak boleh mengubah hasil.
resetCacheSaring();
const urutA = saringCss(CSS_CONTOH, '<div class="p-4 app-nav"></div>');
resetCacheSaring();
const urutB = saringCss(CSS_CONTOH, '<div class="app-nav p-4"></div>');
cek('urutan class tidak berpengaruh', urutA.css === urutB.css);

/*
 * Uji paling penting: untuk CSS build sungguhan, SETIAP kelas yang dipakai di
 * markup wajib punya setidaknya satu aturan yang dipertahankan. Kalau ada kelas
 * yang lolos ke HTML tanpa aturan CSS-nya, tampilannya rusak diam-diam dan
 * tidak ada satu pun error di konsol.
 */
const CSS_BUILD = baca('src', 'generated', 'app-css.ts')
  .replace(/^[\s\S]*?APP_CSS = `/, '')
  .replace(/`;\s*$/, '')
  /*
   * Buka lagi isi template literal-nya, persis kebalikan `keTemplateLiteral()`
   * di scripts/gen-css.mjs (`\` -> `\\`, backtick -> ``\` ``, `${` -> `\${`).
   *
   * Tanpa langkah ini `CSS_BUILD` masih berisi backslash ganda, sehingga nama
   * kelas hasil dekode selector punya satu backslash terlalu banyak dan TIDAK
   * akan pernah cocok dengan nilai `class` di HTML. Gejalanya persis seperti
   *bug saringan CSS: aturan ada di CSS tapi terbuang saat disaring.
   */
  .replace(/\\(.)/g, '$1');

/**
 * Dua ejaan yang mungkin dipakai CSS untuk satu nama kelas.
 *
 * CSS boleh menulis karakter yang tidak lazim sebagai escape sederhana (`\/`)
 * ATAU sebagai hex escape (`\2c `). Keduanya sah, dan generator pun memakai
 * keduanya. Ceknya karena itu menerima salah satu, bukan menebak yang mana.
 */
const ejaanSelector = (k) => [
  '.' + k.replace(/[^A-Za-z0-9_-]/g, (c) => '\\' + c),
  '.' + k.replace(/[^A-Za-z0-9_-]/g, (c) => '\\' + c.charCodeAt(0).toString(16) + ' '),
];

/*
 * Ekstraktor nama kelas untuk DIJALANKAN LAGI di section F.
 *
 * Ditulis dengan regex, sedangkan `src/lib/css-scope.ts` memakai pemindai
 * karakter. Keduanya sengaja dibuat berbeda: kalau logikanya sama, satu bug
 * yang sama akan menutupi dirinya sendiri dan test tetap hijau.
 *
 * Yang dijaga di sini:
 *   - `,` dan `:` TIDAK menghentikan nama kelas, karena keduanya muncul
 *     ter-escape di nilai arbitrer Tailwind
 *     (`grid-cols-[34px_minmax(140px,1.2fr)]`), begitu juga titik di `1.2fr`.
 *   - Hex escape dibaca beserta SATU whitespace terminator-nya, karena itu yang
 *     membuat `\2c ` (koma) tidak memutus nama kelas.
 */
const IDENT_CSS = /\.(?:\\(?:[0-9a-fA-F]{1,6}[ \n\t\r\f]?|.)|[^\\,:\s>+~{}"'*#;[\]()])+/g;

const decodeIdent = (s) =>
  s.replace(/\\(?:([0-9a-fA-F]{1,6})[ \n\t\r\f]?|([^\n\r\f]))/g, (_, hex, chr) =>
    hex ? String.fromCodePoint(parseInt(hex, 16)) : chr,
  );

if (CSS_BUILD.length > 5000) {
  /*
   * Ambil nama kelas NYATA dari CSS build, bukan daftar karangan: kalau daftar
   * karangan dipakai, ujinya bisa lulus atau gagal karena alasan yang salah.
   * Yang diuji justru putaran balik escape -> nama kelas -> pencocokan.
   */
  const semuaSelector = [...CSS_BUILD.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{[^{}]*\}/g)].map(
    (m) => m[1],
  );
  const namaKelas = new Set();
  for (const sel of semuaSelector) {
    for (const m of sel.matchAll(IDENT_CSS)) namaKelas.add(decodeIdent(m[0].slice(1)));
  }

  // Prioritaskan kelas yang butuh escape, karena itu jalur paling rawan: di
  // situlah nama kelas bisa terpotong dan aturannya ikut hilang diam-diam.
  const KELAS_BERESCAPE = [...namaKelas].filter((k) => /[^A-Za-z0-9_-]/.test(k));
  const KELAS_UJI = [...new Set([...KELAS_BERESCAPE.slice(0, 8), ...[...namaKelas].slice(0, 12)])];

  const htmlContoh = `<div class="${KELAS_UJI.join(' ')}"></div>`;
  resetCacheSaring();
  const nyata = saringCss(CSS_BUILD, htmlContoh);
  const hilang = KELAS_UJI.filter((k) => !ejaanSelector(k).some((e) => nyata.css.includes(e)));
  cek(
    'tiap kelas di markup build punya aturan di CSS tersaring',
    hilang.length === 0,
    hilang.length
      ? `tidak ada aturannya: ${hilang.join(', ')}`
      : `${KELAS_UJI.length} kelas diperiksa (${KELAS_BERESCAPE.length} punya escape)`,
  );
  cek(
    'CSS build tersaring jadi jauh lebih kecil',
    nyata.sesudah < nyata.sebelum * 0.8,
    `${(nyata.sebelum / 1024).toFixed(1)} kB -> ${(nyata.sesudah / 1024).toFixed(1)} kB`,
  );
  cek(
    'kelasDipakai() membaca class="..."',
    kelasDipakai(htmlContoh).size === KELAS_UJI.length,
    String(kelasDipakai(htmlContoh).size),
  );
  cek('html-ringan memakai saringCss()', srcRingan.includes('saringCss('));
}

/*
 * =============================================================================
 *  G. HARDWARE ID  —  kontrak yang harus benar, bukan sekadar tampil
 * =============================================================================
 *
 * `src/lib/hardware.ts` adalah satu-satunya tempat aturan Hardware ID ditulis,
 * dan aturan itu dipakai dua pihak: portal admin (menampilkan dan memeriksa)
 * serta aplikasi POS AMD di sisi pembeli (mengirimkannya).
 *
 * Kalau bit versi/varian UUID v4 dibungkus salah di sini, hasilnya tetap
 * berbentuk UUID yang valid. Tidak ada error, tidak ada log, tidak ada apa pun
 * yang gagal. Sebaliknya, kalau pembungkusnya longgar, semua HWID yang sudah
 * terkunci bisa berubah bentuk dan tidak ada satu pun key yang bisa dipakai
 * kembali. Karena itu diuji bit per bit, bukan cuma "polanya cocok".
 */

console.log('\n[G] Hardware ID');

const hw = await muatModulTs('src', 'lib', 'hardware.ts');

cek('hardware.ts terbaca', hw !== null, hw ? Object.keys(hw).sort().join(', ') : 'gagal muat');

if (hw) {
  const { dariByte, hardwareIdSama, normalHardwareId, rapikanTampil, uuidV4, PANJANG_UUID } = hw;

  // --- Pola UUID v4 --------------------------------------------------------

  cek('UUID v4 dari SMBIOS dikenali', uuidV4('4c4c4544-0030-4910-8045-c4c04f343332'));
  cek('UUID huruf besar dikenali', uuidV4('4C4C4544-0030-4910-8045-C4C04F343332'));
  cek('spasi di ujung diterima', uuidV4('  4c4c4544-0030-4910-8045-c4c04f343332  '));
  cek('versi bukan 4 ditolak', uuidV4('4c4c4544-0030-2910-8045-c4c04f343332') === false);
  cek('UUID terpotong ditolak', uuidV4('4c4c4544-0030-4910') === false);
  cek('bukan UUID ditolak', uuidV4('HWID-1001') === false);
  cek('teks kosong ditolak', uuidV4('   ') === false);
  cek('panjang UUID v4 = 36', PANJANG_UUID === 36, String(PANJANG_UUID));

  /*
   * Digit ke-20 adalah nibble varian, dan letaknya adalah karakter PERTAMA
   * kelompok keempat (`xxxxxxxx-xxxx-xxxx-Nxxx-xxxx-xxxxxxxxxxxx`), bukan
   * kelompok kelima. Salah posisi di sini akan membuat pemeriksaan lolos untuk
   * yang salah.
   *
   * Yang sah cuma 8, 9, a, dan b (RFC 4122). Digit 0-7 dan c-f bukan varian
   * UUID yang sah, jadi `uuidV4()` harus menolaknya.
   */
  for (const [digit, sah] of [
    ['8', true],
    ['9', true],
    ['a', true],
    ['b', true],
    ['0', false],
    ['7', false],
    ['c', false],
    ['f', false],
  ]) {
    const contoh = `4c4c4544-0030-4910-${digit}4c0-c04f343332ab`;
    cek(`varian UUID ${digit} ${sah ? 'diterima' : 'ditolak'}`, uuidV4(contoh) === sah, contoh);
  }

  // --- `dariByte()`: pembungkus byte apa pun jadi UUID v4 ------------------
  // Byte-nya sengaja pseudo-acak supaya bit versi/variant tidak bisa
  // kebetulan benar hanya pada satu contoh.

  const byteAcak = [];
  let benih = 12345;
  for (let i = 0; i < 16; i += 1) {
    benih = (benih * 1103515245 + 12345) & 0x7fffffff;
    byteAcak.push(benih & 0xff);
  }

  const dariAcak = dariByte(byteAcak);
  cek('dariByte menghasilkan UUID v4', uuidV4(dariAcak), dariAcak);
  cek('dariByte selalu 36 karakter', dariAcak.length === 36, String(dariAcak.length));
  cek('digit ke-15 adalah versi 4', dariAcak[14] === '4', dariAcak);
  cek('digit ke-20 adalah varian RFC 4122', '89ab'.includes(dariAcak[19]), dariAcak[19]);

  const dariNol = dariByte(new Array(16).fill(0));
  cek('dariByte([nol]) tetap UUID v4', uuidV4(dariNol), dariNol);
  cek('dariByte([nol]) versi tetap 4', dariNol[14] === '4', dariNol);
  cek('dariByte([nol]) varian menjadi 8', dariNol[19] === '8', dariNol);

  const dariSatu = dariByte(new Array(16).fill(0xff));
  cek('dariByte([0xff]) tetap UUID v4', uuidV4(dariSatu), dariSatu);
  cek('dariByte([0xff]) versi tetap 4', dariSatu[14] === '4', dariSatu);
  /*
   * `0xff & 0x3f | 0x80` = 0xbf, dan `b` itu varian RFC 4122 yang sah. Yang
   * salah kalau byte[8] dibiarkan apa adanya: byte itu bisa jadi 0x0f, yang
   * menghasilkan varian 0 dan UUID di luar spesifikasi.
   */
  cek('dariByte([0xff]) varian tetap sah', '89ab'.includes(dariSatu[19]), dariSatu[19]);

  // Byte > 0xff harus dipotong, bukan_byte_ meluap ke byte berikutnya dan
  // menggeser seluruh UUID.
  const byteLuap = new Array(16).fill(0);
  byteLuap[0] = 0x1ff;
  const dariLuap = dariByte(byteLuap);
  cek('dariByte memotong byte di atas 0xff', dariLuap.slice(0, 8) === 'ff000000', dariLuap.slice(0, 8));

  cek('dariByte([]) tidak melempar', typeof dariByte([]) === 'string', String(dariByte([])));

  // --- Perbandingan HWID ---------------------------------------------------

  cek(
    'HWID sama meski huruf berbeda',
    hardwareIdSama('4C4C4544-0030-4910-8045-C4C04F343332', '4c4c4544-0030-4910-8045-c4c04f343332'),
  );
  cek(
    'HWID sama dengan dan tanpa tanda hubung',
    hardwareIdSama('4c4c4544003049108045c4c04f343332', '4c4c4544-0030-4910-8045-c4c04f343332'),
  );
  cek(
    'HWID berbeda tidak dianggap sama',
    hardwareIdSama('4c4c4544-0030-4910-8045-c4c04f343332', '4c4c4544-0030-4910-8045-c4c04f343333') === false,
  );
  cek('HWID kosong tidak sama dengan yang lain', hardwareIdSama('', '') === false);
  cek('HWID kosong tidak sama dengan teks', hardwareIdSama('   ', 'abc') === false);
  cek('normalHardwareId membuang tanda hubung', normalHardwareId('AA-BB-CC') === 'aabbcc', normalHardwareId('AA-BB-CC'));

  // --- Tampilan ------------------------------------------------------------

  cek('rapikanTampil memangkas spasi tepi', rapikanTampil('  abc  ') === 'abc');
  cek('rapikanTampil tidak memotong UUID', rapikanTampil(dariAcak) === dariAcak, dariAcak);
  cek('rapikanTampil tidak mengubah huruf besar', rapikanTampil('ABC') === 'ABC');

  // --- Aturan yang tidak bisa ditawar, dijaga di dalam kode ----------------

  /*
   * Dua pemeriksaan berbeda memakai dua bentuk sumber yang berbeda:
   *
   *   - `mentah` masih berisi komentar, dipakai untuk memeriksa ATURAN. Aturan
   *     WMI memang ditulis sebagai komentar, jadi setelah komentar dibuang
   *     namanya jadi hilang dan pemeriksaan ini tidak berarti apa-apa.
   *   - `kode` sudah dibuang komentarnya, dipakai untuk memeriksa IMPLEMENTASI.
   *     Nama pengenal produk boleh muncul di komentar aturan, tapi kemunculan
   *     di kode berarti aturan itu dilanggar.
   */
  const mentah = baca('src', 'lib', 'hardware.ts');
  const kode = polos(mentah);

  cek(
    'hardware.ts melarang Manufacturer dan Model sebagai bahan HWID',
    mentah.includes('JANGAN PERNAH') &&
      mentah.includes('Win32_ComputerSystem.Manufacturer') &&
      mentah.includes('Win32_ComputerSystem.Model'),
  );
  cek(
    'hardware.ts menunjuk Win32_ComputerSystemProduct sebagai sumber utama',
    mentah.includes('Win32_ComputerSystemProduct'),
  );
  cek(
    'hardware.ts menyebut Win32_BaseBoard.SerialNumber sebagai pelengkap',
    mentah.includes('Win32_BaseBoard.SerialNumber'),
  );
  cek(
    'hardware.ts mewajibkan nomor seri motherboard yang tidak kosong',
    /tidak kosong|non-kosong/i.test(mentah),
  );
  cek(
    'hardware.ts menyebut Diagnosis Value "Default string" sebagai nilai sampah',
    /Default string/i.test(mentah),
    'motherboard tanpa nomor seri sering berisi nilai ini',
  );
  cek(
    'kode TIDAK memakai Manufacturer atau Model sebagai bahan HWID',
    !/Manufacturer|ComputerSystem\.Model|Win32_OperatingSystem/.test(kode),
    'nama pengenal produk hanya boleh muncul di komentar aturan',
  );
  cek(
    'kode TIDAK membaca kolom Manufacturer lewat WMI',
    !/select[^\n]*manufacturer/i.test(kode),
  );
}

console.log(`\n== ${lulus} lulus, ${gagal} gagal ==`);
process.exit(gagal ? 1 : 0);
