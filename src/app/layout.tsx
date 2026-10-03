import type { Metadata, Viewport } from 'next';

import { env } from '@/lib/env';

import './globals.css';

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
