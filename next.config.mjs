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
         */
        source: '/:path((?!_next/static|icon.svg|manifest.webmanifest|robots.txt|favicon.ico).*)',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
        ],
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
