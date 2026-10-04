/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  compiler: {
    // Buang console.* di produksi. Kode ini tidak memakainya sama sekali
    // (hasil grep: 0 pemanggilan), jadi ini murni pennyiksaan ukuran bundle.
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Minifikasi sudah SELALU pakai SWC di Next 14, jadi `swcMinify` tidak
  // mengubah apa pun. Ditulis hanya agar konfigurasi eksplisit.
  swcMinify: true,

  experimental: {
    // Tree-shaking per-modul: hanya ikon lucide yang benar-benar dipakai ikut
    // ter-bundle, bukan seluruh ~(1500) ikon. Ini yang memangkas chunk bersama.
    optimizePackageImports: ['lucide-react', '@supabase/supabase-js'],
  },

  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }],
  },
  async headers() {
    return [
      {
        /*
         * Aset statis: boleh di-cache lama & keras.
         *
         * PENTING: aturan `no-store` di bawah memakai `source: '/:path*'`, yang
         * di Next/Vercel juga mencocokkan `/icon.svg` dan `/manifest.webmanifest`.
         * Tanpa pengecualian ini, favicon ikut terkirim ulang tiap muat halaman
         * (terukur `private, no-store, max-age=0`). Hash aset di `/_next/static`
         * sudah immutable dari sisi Next, tapi `/public/*` tidak.
         *
         * Header KEAMANAN (CSP, COOP, X-Frame-Options, X-Content-Type-Options,
         * Referrer-Policy) SENGAJA TIDAK ada di sini — semuanya ada di
         * `src/middleware.ts` lewat `securityHeaders()`. Alasannya, CSP halaman
         * Next memakai nonce yang berbeda tiap request sehingga tidak mungkin
         * ditulis sebagai header statis di sini; dengan memusatkannya di satu
         * tempat, `/login` (yang keluar dari middleware lebih awal) dan halaman
         * lain dijamin memakai kebijakan yang sama persis.
         */
        source: '/:path((?!_next/static|icon.svg|manifest.webmanifest|robots.txt|favicon.ico).*)',
        headers: [{ key: 'Cache-Control', value: 'private, no-store, max-age=0' }],
      },
      {
        // Aset dari `public/` yang namanya stabil (tanpa hash) — cache sebentar,
        // cukup supaya tidak di-download ulang pada tiap navigasi.
        source: '/icon.svg',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' },
        ],
      },
    ];
  },
};

export default nextConfig;
