import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AlertCircle, LogIn, ShieldCheck } from 'lucide-react';

import { env } from '@/lib/env';
import { getSessionUser } from '@/lib/supabase/session';

/**
 * Halaman login admin — SERVER component (tanpa hydration React).
 *
 * Form dikirim langsung ke POST /api/auth/login (form-urlencoded) lalu
 * di-redirect 303. Alasan tanpa hydration: halaman login sangat ringan,
 * dan tetap berfungsi walau JS lambat.
 */
export const metadata: Metadata = { title: 'Masuk' };

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const next =
    sp.next && sp.next.startsWith('/') && !sp.next.startsWith('//') ? sp.next : '/dashboard';

  // Sudah punya sesi? Langsung ke halaman tujuan (middleware biasanya sudah
  // mengalihkan, tapi direct load perlu dicek juga).
  const session = await getSessionUser();
  if (session) redirect(next);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-zinc-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-zinc-900 text-white">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <h1 className="mt-3 text-[19px] font-bold text-zinc-900">Admin Portal</h1>
          <p className="mt-1 text-[13px] text-zinc-500">
            Masuk sebagai super admin untuk mengelola toko &amp; key.
          </p>
        </div>

        <div className="card-soft p-5">
          {sp.error ? (
            <div
              className="mb-4 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-700"
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{sp.error}</span>
            </div>
          ) : null}

          <form method="post" action="/api/auth/login" className="space-y-3.5">
            <input type="hidden" name="next" value={next} />

            <div>
              <label className="field-label" htmlFor="email">
                Email Admin
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="username"
                autoFocus
                inputMode="email"
                placeholder="admin@example.com"
                className="field-input"
              />
            </div>

            <div>
              <label className="field-label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="field-input"
              />
            </div>

            <button type="submit" className="btn-primary w-full">
              <LogIn className="h-4 w-4" />
              Masuk
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-[12px] leading-relaxed text-zinc-500">
          Hanya akun dengan <code className="rounded bg-zinc-100 px-1 py-0.5">ADMIN_EMAIL</code> atau
          role <code className="rounded bg-zinc-100 px-1 py-0.5">super_admin</code> yang bisa masuk.
        </p>

        <p className="mt-2 text-center text-[12px] text-zinc-400">{env.appName}</p>
      </div>
    </main>
  );
}
