'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form';
import { EmptyState } from '@/components/ui/table';
import { useDebounce } from '@/lib/useDebounce';
import type { LicenseStatus } from '@/types';

/**
 * ============================================================================
 *  TOOLBAR + PAGINASI — CLIENT ISLAND
 * ============================================================================
 *
 * Ketiganya dipisah dari `KeyDaftar` (Server Component) dan sengaja TIDAK
 * digabung jadi satu island besar: kalau toolbar dan paginasi ikut jadi anak
 * dari island yang sama, daftar server-rendered harus jadi `children`-nya —
 * dan `children` yang dirender Client Component tetap ikut di-hydrate. Jadi
 * masing-masing dibiarkan sebagai island terpisah, dengan daftar sebagai
 * SAUDAR (bukan anak) di `page.tsx`.
 *
 * Konsekuensinya masing-masing punya state `menunggu` sendiri. Ini justru
 * benar: spinner di kotak pencarian hanya merespons pencarian yang sedang
 * berjalan, dan tombol paginasi hanya merespons navigasi halaman.
 */

const FILTER_STATUS = [
  { nilai: 'semua', label: 'Semua' },
  { nilai: 'unused', label: 'Belum Dipakai' },
  { nilai: 'active', label: 'Aktif' },
  { nilai: 'blocked', label: 'Diblokir' },
  { nilai: 'revoked', label: 'Dicabut' },
] as const;

export type FilterStatus = (typeof FILTER_STATUS)[number]['nilai'];

/**
 * State navigasi bersama: bikin URL baru tanpa kehilangan filter lain, dan
 * selalu kembali ke halaman 1. Tiap pemanggil mendapat `menunggu`-nya sendiri,
 * jadi tidak perlu di-drill ke bawah sebagai prop.
 */
function useNavigasiKey() {
  const router = useRouter();
  const sp = useSearchParams();
  const [menunggu, mulaiTransition] = React.useTransition();

  function navigasi(next: { q?: string; status?: string; page?: number }) {
    const p = new URLSearchParams(sp.toString());
    if (next.q !== undefined) p.set('q', next.q);
    if (next.status !== undefined) p.set('status', next.status);
    p.delete('page');
    if (next.page && next.page > 1) p.set('page', String(next.page));
    const qs = p.toString();
    mulaiTransition(() => router.replace(qs ? `/keys?${qs}` : '/keys', { scroll: false }));
  }

  return { navigasi, menunggu };
}

/** Kotak pencarian + filter status. */
export function KeyToolbar({ q, status }: { q: string; status: FilterStatus }) {
  const { navigasi, menunggu } = useNavigasiKey();

  // Teks di kotak pencarian sengaja dipisah dari `q` (yang sudah hasil filter
  // server). Kalau tidak, tiap selesai debounce teks ketikan ikut terkirim ke
  // server dan kursor-nya melompat-lompat.
  const [cari, setCari] = React.useState(q);
  const cariDebounce = useDebounce(cari, 500);

  // Ikuti URL kalau user Back/Forward atau menekan tombol filter.
  React.useEffect(() => setCari(q), [q]);

  // Efek terpisah dari hook debounce: hook cuma menunda nilai, hook tidak
  // boleh punya efek samping.
  const qTerakhir = React.useRef(q);
  React.useEffect(() => {
    const bersih = cariDebounce.trim();
    if (bersih === qTerakhir.current) return;
    qTerakhir.current = bersih;
    navigasi({ q: bersih });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cariDebounce]);

  return (
    <div className="mb-3 flex flex-col gap-2.5 lg:flex-row lg:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <Input
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="Cari serial key, nama pembeli, alamat, toko, telepon…"
          className="pl-9"
          aria-label="Cari key"
        />
        {/* Spinner kecil hanya selama query baru dijalankan — teks tetap bisa diketik. */}
        {menunggu ? (
          <span
            aria-hidden
            className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700"
          />
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {FILTER_STATUS.map((f) => (
          <button
            key={f.nilai}
            type="button"
            aria-pressed={status === f.nilai}
            onClick={() => navigasi({ status: f.nilai })}
            className={`touch-chip ${
              status === f.nilai
                ? 'bg-zinc-900 text-white'
                : 'border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Navigasi halaman — disembunyikan kalau hasilnya muat satu halaman. */
export function KeyPaginasi({
  page,
  totalHalaman,
  jumlah,
}: {
  page: number;
  totalHalaman: number;
  jumlah: number;
}) {
  const { navigasi, menunggu } = useNavigasiKey();
  if (jumlah === 0 || totalHalaman <= 1) return null;

  return (
    <nav
      aria-label="Navigasi halaman key"
      className="mt-3 flex items-center justify-between gap-2 border-t border-zinc-100 pt-3"
    >
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1 || menunggu}
        onClick={() => navigasi({ page: page - 1 })}
      >
        Sebelumnya
      </Button>
      <span className="text-[12.5px] text-zinc-500">
        Halaman {page} dari {totalHalaman}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalHalaman || menunggu}
        onClick={() => navigasi({ page: page + 1 })}
      >
        Berikutnya
      </Button>
    </nav>
  );
}

/** Placeholder saat hasil filter kosong. */
export function KeyKosong({ adaFilter }: { adaFilter: boolean }) {
  const { navigasi } = useNavigasiKey();

  return (
    <EmptyState
      title={adaFilter ? 'Tidak ada key yang cocok' : 'Belum ada key'}
      description={
        adaFilter
          ? 'Coba ubah kata kunci atau filter status.'
          : 'Key akan muncul di sini setelah toko mulai generate serial key.'
      }
      action={
        adaFilter ? (
          <Button variant="outline" size="sm" onClick={() => navigasi({ q: '', status: 'semua' })}>
            Reset filter
          </Button>
        ) : null
      }
    />
  );
}

/** Re-export supaya tipe status tidak perlu diduplikasi di `page.tsx`. */
export type KeyStatusFilter = LicenseStatus | 'semua';
