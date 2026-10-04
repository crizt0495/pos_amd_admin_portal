import type { Metadata, Viewport } from 'next';

import { env } from '@/lib/env';

import './globals.css';

/**
 * Rendering harus selalu dinamis.
 *
 * Alasannya nonce: middleware mengiringi setiap respons dengan CSP ber-nonce,
 * dan Next hanya bisa menempelkan nonce itu ke tag `<script>` saat merender
 * dokumen. Halaman yang di-prerender saat build (dulu `/` dan `/_not-found`)
 * sudah jadi HTML jadi sebelum ada request, jadi tag skripnya tidak punya
 * nonce sama sekali - padahal CSP tetap menuntut nonce. Akibatnya SEMUA skrip
 * di halaman 404 diblokir browser dengan "Loading the script ... violates
 * Content Security Policy".
 *
 * `force-dynamic` di layout root berlaku untuk semua route di bawahnya, jadi
 * satu baris ini menutup `/`, `/_not-found`, dan route yang ditambahkan nanti.
 * Halaman admin memang sudah dinamis, jadi tidak ada biaya tambahan.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: {
    default: env.appName,
    template: `%s — ${env.appName}`,
  },
  description: env.description,
  applicationName: env.appName,
  // Panel admin tidak pernah boleh di-index mesin pencari.
  robots: { index: false, follow: false, nocache: true },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#111827',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
