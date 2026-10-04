/**
 * =============================================================================
 *  RINGKAN HTML  —  buang React, inline-kan CSS
 * =============================================================================
 *
 * Semua fungsi di sini MURNI (tanpa `fs`, tanpa network, tanpa Node API) supaya
 * aman dipanggil dari middleware yang jalan di runtime Edge.
 *
 * Latar belakang (terukur di produksi, throttle 4x + Slow 4G):
 *
 *   chunk fd9d1056 (react-dom + router)  53,5 kB gzip -> 270 ms eksekusi
 *   chunk 117      (runtime App Router)  31,7 kB gzip -> 600 ms eksekusi
 *   --------------------------------------------------------------
 *   ~870 ms CPU di thread utama untuk HALAMAN YANG TIDAK PUNYA SATU PUN
 *   interaksi yang butuh JS
 *
 * Jadi untuk halaman yang benar-benar read-only, React tidak boleh diunduh
 * sama sekali. Markah HTML yang sudah dirender App Router sendiri yang
 * dibuang: tag `<script>` (chunk Next + payload RSC inline) dan tag `<link>`
 * yang menunjuk ke sana. CSS-nya justru DISALIN ke dalam `<style>` supaya
 * tidak ada permintaan render-blocking kedua.
 *
 * Yang SENGAJA tidak disentuh: `<meta>`, `<title>`, `<link rel="icon">`.
 * Judul, deskripsi, dan `noindex` tetap ikut — audit SEO tidak berubah.
 */

/** Tag `<script>` BERISI: `...</script>`. */
const RE_SCRIPT = /<script\b[^>]*>[\s\S]*?<\/script>/gi;

/** Tag `<script>` tanpa isi (`<script ... />`). */
const RE_SCRIPT_KOSONG = /<script\b[^>]*\/>/gi;

/** Tag `<link>` apa pun. */
const RE_LINK = /<link\b[^>]*>/gi;

/** `rel="stylesheet"` — satu-satunya yang perlu disalin jadi `<style>`. */
const RE_STYLESHEET = /\brel="stylesheet"/i;

/**
 * `rel` yang menunjuk ke chunk JS atau ke pratinjau.
 *
 * Setelah semua `<script>` dibuang, `<link rel="preload" as="script">` dan
 * `<link rel="modulepreload">` hanya jadi permintaan sia-sia (Chrome akan
 * realizing prefetch-nya sendiri dan log error 404-nya). `preconnect` ke
 * origin yang sama juga tidak berguna di dokumen yang sudah ada.
 */
const RE_LINK_SIA_SIA = /\brel="(?:preload|modulepreload|prefetch|preconnect|dns-prefetch)"/i;

export interface Ringkasan {
  html: string;
  /** Berapa tag `<script>` yang dibuang. */
  scriptDibuang: number;
  /** `true` kalau ada CSS yang disalin ke dalam `<style>`. */
  cssTersalin: boolean;
}

/**
 * Buang React dari dokumen,-inline-kan CSS.
 *
 * Mengembalikan dokumen yang SAMA persis secara visual, tapi nol JavaScript.
 */
export function ringankan(html: string, css: string): Ringkasan {
  let scriptDibuang = 0;

  const buangScript = (tag: string) => {
    scriptDibuang += 1;
    return '';
  };

  let cssTersalin = false;

  const olahLink = (tag: string) => {
    if (RE_STYLESHEET.test(tag)) {
      // App Router hanya memuat satu CSS; kalau nanti lebih dari satu, cukup
      // yang pertama supaya CSS tidak terduplikasi di dalam HTML.
      if (cssTersalin) return '';
      cssTersalin = true;
      return `<style>${css}</style>`;
    }
    if (RE_LINK_SIA_SIA.test(tag)) return '';
    return tag;
  };

  const out = html
    .replace(RE_SCRIPT, buangScript)
    .replace(RE_SCRIPT_KOSONG, buangScript)
    .replace(RE_LINK, olahLink);

  return { html: out, scriptDibuang, cssTersalin };
}
