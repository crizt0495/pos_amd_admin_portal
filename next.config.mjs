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
        // Panel admin: jangan pernah di-cache oleh CDN/proxy.
        source: '/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
