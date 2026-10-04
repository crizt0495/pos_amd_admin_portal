#!/usr/bin/env node
/**
 * =============================================================================
 *  GENERATE `src/generated/app-css.ts` - CSS aplikasi sebagai string
 * =============================================================================
 *
 * Kenapa file ini ada?
 *
 * Halaman "ringan" (lihat src/middleware.ts) tidak boleh punya file CSS
 * terpisah: satu `<link rel="stylesheet">` adalah permintaan render-blocking
 * kedua, jadi FCP/LCP tidak bisa selesai sebelum satu round-trip lagi selesai.
 * Supaya nol permintaan render-blocking, CSS-nya harus ikut di dalam HTML.
 *
 * Runtime Edge tidak punya `fs`, jadi CSS harus sudah menjadi string ketika
 * build. Hasilnya dipakai di satu tempat saja:
 *
 *     import { APP_CSS } from '@/generated/app-css';
 *
 * CSS-nya dikompilasi oleh Tailwind CLI dengan config dan input yang PERSIS
 * sama dengan yang dipakai PostCSS di `next build`
 * (`tailwind.config.ts` + `src/app/globals.css`), lalu `--minify`. Hasilnya
 * praktis sama dengan file yang Next sendiri hasilkan (33,5 kB vs 33,5 kB),
 * jadi tidak ada dua salinan CSS yang bisa terlihat berbeda.
 *
 * File ini sengaja DI-COMMIT: `next dev` perlu file-nya ada sebelum build
 * pertama dijalankan, dan `tsc`/ESLint ikut membacanya. Dijalankan ulang
 * otomatis oleh `npm run build`, jadi isinya tidak pernah basi lebih dari satu
 * build.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KELUAR = join(ROOT, 'src/generated/app-css.ts');
const SEMENTARA = join(ROOT, 'node_modules/.cache/app-css.css');
const BIN_TAILWIND = join(ROOT, 'node_modules/.bin/tailwindcss');

mkdirSync(dirname(SEMENTARA), { recursive: true });
mkdirSync(dirname(KELUAR), { recursive: true });

/** CSS apa adanya tidak boleh memblokir file TS: escape tiga karakter ini. */
function keTemplateLiteral(css) {
  return css.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

const hasil = spawnSync(
  BIN_TAILWIND,
  [
    '-c',
    join(ROOT, 'tailwind.config.ts'),
    '-i',
    join(ROOT, 'src/app/globals.css'),
    '-o',
    SEMENTARA,
    '--minify',
  ],
  { encoding: 'utf8' },
);

if (hasil.error || hasil.status !== 0) {
  console.error('[gen-css] Tailwind CLI gagal.');
  console.error(hasil.error?.message || hasil.stderr || hasil.stdout);
  process.exit(1);
}

const css = readFileSync(SEMENTARA, 'utf8').trim();
rmSync(SEMENTARA, { force: true });

const isi = `/**
 * DIBUAT OTOMATIS oleh scripts/gen-css.mjs - jangan disunting manual.
 *
 * Sumber: src/app/globals.css + tailwind.config.ts (Tailwind CLI, --minify).
 * Dipakai middleware untuk meng-inline-kan CSS ke halaman tanpa JS.
 */

/** CSS aplikasi, sudah diminifikasi, siap disisipkan ke dalam <style>. */
export const APP_CSS = \`${keTemplateLiteral(css)}\`;
`;

let sebelumnya = '';
try {
  sebelumnya = readFileSync(KELUAR, 'utf8');
} catch {
  sebelumnya = '';
}

writeFileSync(KELUAR, isi);
console.log(
  sebelumnya === isi
    ? `[gen-css] tidak berubah (${(css.length / 1024).toFixed(1)} kB)`
    : `[gen-css] ditulis -> src/generated/app-css.ts (${(css.length / 1024).toFixed(1)} kB)`,
);
