import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronRight, TrendingUp } from 'lucide-react';

import { DashboardStats } from '@/components/admin/stat-card';
import { SalesChart } from '@/components/admin/sales-chart';
import { StoreStatusBadge, TierBadge } from '@/components/ui/badge';
import { getDashboard } from '@/lib/data';
import { rupiah, sejak, tanggalPendek } from '@/lib/format';
import { requireAdmin } from '@/lib/supabase/guard';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const auth = await requireAdmin();
  if (!auth.ok) redirect('/login');

  const { summary, stores, sales } = await getDashboard();
  const totalMingguIni = sales.reduce((s, d) => s + d.jumlah, 0);
  const komisiMingguIni = sales.reduce((s, d) => s + d.komisi, 0);

  return (
    <div className="space-y-5">
      {/* Judul "Dashboard" sudah tampil di app bar. */}
      <header>
        <p className="text-[13px] text-zinc-500">
          Ringkasan toko, key, dan komisi — 7 hari terakhir: {totalMingguIni} key ·{' '}
          {rupiah(komisiMingguIni)} komisi.
        </p>
      </header>

      <DashboardStats
        totalToko={summary.totalToko}
        totalKeyTerjual={summary.totalKeyTerjual}
        totalKeySisa={summary.totalKeySisa}
        komisiPending={summary.komisiPending}
      />

      {/* Chart + catatan */}
      <section className="card-soft p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-zinc-500" />
          <h2 className="text-[15px] font-bold">Penjualan 7 Hari Terakhir</h2>
        </div>
        <SalesChart data={sales} />
      </section>

      {/* Toko terbaru */}
      <section className="card-soft overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3.5 sm:px-5">
          <div>
            <h2 className="text-[15px] font-bold">Toko Terbaru</h2>
            <p className="text-[12px] text-zinc-500">6 toko terakhir yang mendaftar</p>
          </div>
          <Link
            href="/toko"
            aria-label="Lihat semua toko"
            className="inline-flex min-h-11 items-center gap-0.5 rounded-lg pr-2 text-[13px] font-semibold text-zinc-700 transition hover:text-zinc-900 lg:min-h-0"
          >
            Semua toko
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {stores.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-zinc-500">
            Belum ada toko terdaftar.{' '}
            <Link href="/toko/baru" className="font-semibold text-zinc-900 underline">
              Daftarkan toko pertama
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {stores.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/toko/${s.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-zinc-50 sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-zinc-900">{s.nama_toko}</p>
                    <p className="truncate text-[12px] text-zinc-500">
                      {s.email ?? '-'} · {s.total_terjual} terjual · sisa {s.sisa_kuota} key
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <TierBadge tier={s.tier} />
                    <StoreStatusBadge aktif={s.is_active} />
                  </div>
                  <span className="hidden shrink-0 text-[11.5px] text-zinc-500 sm:block">
                    {sejak(s.created_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* zinc-500 bukan zinc-400: teks kecil di atas putih butuh rasio >= 4,5:1. */}
      <p className="text-center text-[11.5px] text-zinc-500">
        Data diperbarui tiap kali halaman dimuat · {tanggalPendek(new Date())}
      </p>
    </div>
  );
}
