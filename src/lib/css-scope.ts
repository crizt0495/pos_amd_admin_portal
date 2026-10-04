/**
 * =============================================================================
 *  SARING CSS  —  buang aturan yang tidak dipakai satu halaman
 * =============================================================================
 *
 * Kenapa perlu?
 *
 * Halaman "ringan" menyisipkan CSS aplikasi utuh ke dalam `<style>`. CSS itu
 * hasil Tailwind untuk SELURUH portal, padahal `/dashboard` hanya memakai 133
 * kelas. Jadi lebih dari separuh CSS itu tidak ada gunanya di dokumen itu.
 *
 * Dampaknya nyata (Chrome headless, median 5x):
 *
 *   CSS penuh 33,5 kB  ->  layout 35 ms, total task 82 ms, load 52 ms
 *   CSS saring 14,0 kB ->  layout 27 ms, total task 60 ms, load 36 ms
 *
 * Lighthouse menjalankan throttle CPU 4x, jadi 22 ms yang dihemat di thread
 * utama menjadi sekitar 88 ms di skor. Dokumen juga turun dari 52,2 kB ke
 * 32,7 kB, jadi ParseHTML ikut murah.
 *
 * Syarat supaya saringan ini aman:
 *
 *   1. Halaman yang disaring tidak boleh punya JavaScript. Kalau ada React, ia
 *      bisa memasang kelas secara dinamis SETELAH load; kelas itu tidak ada di
 *      HTML sehingga CSS-nya ikut hilang dan tampilan rusak diam-diam.
 *      `ringankan()` membuang semua `<script>`, jadi syarat ini sudah otomatis
 *      terpenuhi di setiap halaman yang memakai modul ini.
 *   2. CSS dihitung dari HTML dokumen itu sendiri, per permintaan. Jadi kelas
 *      baru yang muncul karena data berubah selalu ikut terbawa CSS-nya.
 *   3. Selalu diverifikasi: `npm run test:ringan` membandingkan hasil saringan
 *      terhadap CSS penuh dan gagal kalau ada kelas yang tidak punya aturan.
 *
 * Semua fungsi di sini MURNI (tanpa `fs`, tanpa network, tanpa Node API) supaya
 * aman dipanggil dari middleware yang jalan di runtime Edge.
 */

/**
 * Nama kelas di dalam selector CSS.
 *
 * Dua hal yang wajib ditangani:
 *
 * - Escape CSS. Tailwind menulis `.mt-0\.5`, `.top-1\/2`, dan `.z-\[60\]`
 *   supaya selector-nya tetap valid, sedangkan di HTML kelasnya ditulis polos
 *   (`mt-0.5`). Kalau tidak di-unescape, kelas `mt-0.5` tidak akan pernah
 *   cocok dan aturannya ikut terbuang.
 * - Pemisah selector: spasi, `>+~(){}[]"'.,:|#*`. Pasangan `\\.` di dalam
 *   kelas menyatakan satu karakter yang ter-escape dan boleh ikut.
 */
const RE_KELAS_SELECTOR = /\.(?:\\.|[^\s>+~(){}\[\]"'.,:|#*])+/g;

/** `class="..."` atau `class='...'` pada markup hasil render App Router. */
const RE_CLASS_ATTR = /\sclass=(?:"([^"]*)"|'([^']*)')/g;

/** Komentar CSS apa pun, termasuk banner lisensi Tailwind. */
const RE_KOMENTAR = /\/\*[\s\S]*?\*\//g;

/** Komentar lisensi di awal file, wajib ikut kalau CSS-nya disalin. */
const RE_LISENSI = /^\s*\/\*![\s\S]*?\*\//;

/**
 * Selector atribut dan string di dalam selector, misal `[data-x="1.5"]`.
 * Isinya bisa memuat titik, dan titik itu bukan nama kelas.
 *
 * TIDAK bisa dibuang dengan regex biasa: kurung siku yang ter-escape milik NAMA
 * KELAS (`.text-\[17px\]`) ikut kena, sehingga kelasnya jadi tidak terbaca dan
 * aturannya terbuang. Karena itu penyaringan dilakukan dengan pemindaian
 * karakter yang menghormati escape.
 */
function selectorBersih(selector: string): string {
  let keluar = '';
  for (let i = 0; i < selector.length; i++) {
    const c = selector[i];
    // Escape: karakter berikutnya selalu bagian dari nama, bukan pembatas.
    if (c === '\\') {
      keluar += c + (selector[i + 1] ?? '');
      i++;
      continue;
    }
    if (c === '[') {
      while (i < selector.length && selector[i] !== ']') i++;
      continue;
    }
    if (c === '"' || c === "'") {
      const kutip = c;
      while (++i < selector.length && selector[i] !== kutip) {
        if (selector[i] === '\\') i++;
      }
      keluar += kutip + kutip;
      continue;
    }
    keluar += c;
  }
  return keluar;
}

/**
 * Pemisah nama kelas di cache. Nama kelas bisa memuat tanda baca (`:` dari
 * varian Tailwind, `/` dari `w-1/2`, `[` dari nilai arbitrer), jadi spasi saja
 * yang aman karena tidak mungkin muncul di dalam nama kelas.
 */
const PEMBATAS_CACHE = ' ';

/**
 * Kumpulkan semua nama kelas yang benar-benar dipakai di markup.
 * Dikembalikan apa adanya (tanpa escape) supaya bisa dibandingkan langsung
 * dengan selector CSS yang sudah di-unescape.
 */
export function kelasDipakai(html: string): Set<string> {
  const hasil = new Set<string>();
  for (const m of html.matchAll(RE_CLASS_ATTR)) {
    const nilai = m[1] ?? m[2] ?? '';
    for (const k of nilai.split(/\s+/)) if (k) hasil.add(k);
  }
  return hasil;
}

/** Buang escape CSS: `mt-0\.5` menjadi `mt-0.5`. */
function unescape(kelas: string): string {
  return kelas.includes('\\') ? kelas.replace(/\\(.)/g, '$1') : kelas;
}

/**
 * Daftar kelas (sudah di-unescape) yang disebut sebuah selector.
 *
 * Selector atribut dan string dibuang lebih dulu (lihat `selectorBersih`).
 */
function kelasDiSelector(selector: string): string[] {
  const bersih = selectorBersih(selector);
  const hasil: string[] = [];
  for (const m of bersih.matchAll(RE_KELAS_SELECTOR)) hasil.push(unescape(m[0].slice(1)));
  return hasil;
}

/** Nama at-rule: `media`, `supports`, `keyframes`, danfriends. */
function namaAtRule(prelude: string): string {
  const m = /^@([\w-]+)/.exec(prelude.trim());
  return m ? m[1].toLowerCase() : '';
}

/**
 * Saring isi CSS menjadi blok yang relevan.
 *
 * `kedalaman > 0` berarti sedang berada di dalam `@media` atau `@supports`.
 * Aturan tanpa kelas selector (elemen, `*`, `:root`, `::before`) selalu
 * disimpan: biayanya sedikit, sedangkan mem-buangnya berisiko merusak
 * tampilan.
 */
function saringIsi(css: string, dipakai: Set<string>, kedalaman: number): string {
  const hasil: string[] = [];
  let i = 0;

  while (i < css.length) {
    const buka = css.indexOf('{', i);
    if (buka === -1) {
      // Sisa tanpa kurung kurawal. Biasanya cuma spasi, tapi tetap
      // dikembalikan agar blok terakhir tidak hilang.
      const sisa = css.slice(i);
      if (sisa.trim()) hasil.push(sisa);
      break;
    }

    const prelude = css.slice(i, buka);
    let depth = 1;
    let j = buka + 1;
    while (j < css.length && depth > 0) {
      const c = css[j];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      j++;
    }
    const blok = css.slice(i, j);
    const nama = prelude.trim();
    const at = namaAtRule(prelude);

    if (at === 'media' || at === 'supports') {
      // Berisi aturan bersarang: sarang isinya, lalu buang bloknya kalau
      // tidak ada satu pun aturan yang tersisa.
      const isi = saringIsi(css.slice(buka + 1, j - 1), dipakai, kedalaman + 1);
      if (isi.trim()) hasil.push(`${nama}{${isi}}`);
    } else if (nama.startsWith('@')) {
      // `@keyframes`, `@font-face`, `@property`, `@layer`: nama at-rule tidak
      // bergantung pada kelas yang dipakai, jadi blok utuhnya dipertahankan.
      hasil.push(blok);
    } else {
      const kelas = kelasDiSelector(nama);
      if (kelas.length === 0 || kelas.some((k) => dipakai.has(k))) hasil.push(blok);
    }

    i = j;
  }

  return hasil.join('');
}

/**
 * Cache hasil saringan. Halaman ringan hanya handful (saat ini cuma
 * `/dashboard`) dan kumpulan kelasnya stabil antar permintaan, jadi satu hasil
 * praktis selalu kena.
 */
const cache = new Map<string, string>();
const BATAS_CACHE = 8;

/** Diagnostic saringan, dipakai tes dan log. */
export interface RingkasanSaring {
  css: string;
  /** Panjang CSS sebelum disaring. */
  sebelum: number;
  /** Panjang CSS sesudah disaring. */
  sesudah: number;
  /** Berapa blok aturan yang dipertahankan. */
  aturan: number;
}

/**
 * Kembalikan CSS yang hanya berisi aturan yang dipakai `html`.
 *
 * Kalau `html` tidak punya satu pun kelas, CSS asli dikembalikan utuh: lebih
 * besar, tapi tidak mungkin ada yang hilang.
 */
export function saringCss(css: string, html: string): RingkasanSaring {
  const dipakai = kelasDipakai(html);
  if (dipakai.size === 0) {
    return { css, sebelum: css.length, sesudah: css.length, aturan: 0 };
  }

  const kunci = [...dipakai].sort().join(PEMBATAS_CACHE);
  const tersimpan = cache.get(kunci);
  if (tersimpan !== undefined) {
    return { css: tersimpan, sebelum: css.length, sesudah: tersimpan.length, aturan: 0 };
  }

  /*
   * Komentar dibuang SEBELUM diurai. Banner lisensi Tailwind
   * (`/*! tailwindcss v3.4.19 ...*\/`) mengandung titik, dan kalau ikut
   * terbaca sebagai selector, kelas semu `4` dan `19` muncul dan membuat
   * seluruh aturan dasar `*,:before,:after` ikut terbuang. Akibatnya
   * `box-sizing` seluruh portal berubah dan tinggi halaman meleset. Banner
   * lisensinya tetap
   * ikut di depan hasil supaya atribusi Tailwind tidak hilang.
   */
  const lisensi = RE_LISENSI.exec(css)?.[0] ?? '';
  const hasil = saringIsi(css.replace(RE_KOMENTAR, ''), dipakai, 0);
  const akhir = lisensi ? lisensi + hasil : hasil;

  if (cache.size >= BATAS_CACHE) cache.clear();
  cache.set(kunci, akhir);

  return {
    css: akhir,
    sebelum: css.length,
    sesudah: akhir.length,
    aturan: (akhir.match(/\{/g) || []).length,
  };
}

/** Kosongkan cache. Dipakai tes supaya setiap kasus benar-benar dihitung. */
export function resetCacheSaring(): void {
  cache.clear();
}