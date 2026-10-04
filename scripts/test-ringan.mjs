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
  '.halaman-toko{padding:2rem}',
  '@media (min-width:768px){.lg\\:grid-cols-3{display:grid}.halaman-toko{padding:3rem}}',
  '@media (min-width:1024px){.lg\\:flex{display:flex}}',
  '@keyframes spin{to{transform:rotate(360deg)}}',
  'body{margin:0}',
  ':root{--x:1px}',
].join('');

const HTML_LIGHT =
  '<div class="app-nav p-4 mt-0.5 top-1/2 z-[60] w-1/2 text-[17px] hover:bg-zinc-100 lg:grid-cols-3 lg:flex"></div>';

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
  .replace(/`;\s*$/, '');

/** Escape nama kelas agar bisa dipakai sebagai selector CSS. */
const jadiSelector = (k) => `.${k.replace(/[.[\]/:]/g, (c) => '\\' + c)}`;

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
    for (const m of sel.matchAll(/\.((?:\\.|[^\s>+~(){}\[\]"'.,:|#*])+)/g)) {
      namaKelas.add(m[1].replace(/\\(.)/g, '$1'));
    }
  }
  // Prioritaskan kelas yang punya escape, karena itu jalur paling rawan.
  const KELAS_BERESCAPE = [...namaKelas].filter((k) => k.includes('\\'));
  const KELAS_UJI = [...new Set([...KELAS_BERESCAPE.slice(0, 8), ...[...namaKelas].slice(0, 12)])];

  const htmlContoh = `<div class="${KELAS_UJI.join(' ')}"></div>`;
  resetCacheSaring();
  const nyata = saringCss(CSS_BUILD, htmlContoh);
  const hilang = KELAS_UJI.filter((k) => !nyata.css.includes(jadiSelector(k)));
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

console.log(`\n== ${lulus} lulus, ${gagal} gagal ==`);
process.exit(gagal ? 1 : 0);
