import { redirect } from 'next/navigation';

/**
 * Akar aplikasi -> langsung ke dashboard (atau /login kalau middleware sudah
 * mengalihkan). Sengaja tidak render apa-apa supaya tidak ada kedipan konten.
 */
export default function RootPage() {
  redirect('/dashboard');
}
