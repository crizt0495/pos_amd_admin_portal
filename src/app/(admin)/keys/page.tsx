import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { KeyDaftar } from '@/components/admin/key-daftar';
import { KeyKosong, KeyPaginasi, KeyToolbar } from '@/components/admin/key-toolbar';
import { getKeys, getRingkasanKey } from '@/lib/data';
import { angka } from '@/lib/format';
import { requireAdmin } from '@/lib/supabase/guard';
import type { LicenseStatus } from '@/types';

export const metadata: Metadata = { title: 'Manajemen Serial Key' };

// Halaman ini SELALU dinamis: daftar key ikut berubah begitu ada generate/revoke,
// jadi tidak boleh pernah disimpan di cache Full Route / Data Cache.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Status yang boleh muncul di URL. Selain itu diabaikan (bukan error 500). */
const STATUS_VALID: LicenseStatus[] = ['unused', 'active', 'blocked', 'revoked'];

/** (searchParams) selalu string|string[]|undefined — ebook jadi string di sini. */
function satu(nilai: string | string[] | undefined): string {
  if (Array.isArray(nilai)) return nilai[0] ?? '';
  return nilai ?? '';
}

export default async function KeysPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const auth = await requireAdmin();
  if (!auth.ok) redirect('/login');

  // Semua filter datang dari URL, bukan dari state di browser. Keuntungannya:
  // hasil filter bisa di-share, di-back, dan di-refresh tanpa kehilangan.
  const q = satu(searchParams.q).slice(0, 80);
  const statusParam = satu(searchParams.status);
  const status = (STATUS_VALID.find((s) => s === statusParam) ?? 'semua') as
    LicenseStatus | 'semua';
  const pageRaw = Number.parseInt(satu(searchParams.page), 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  // `getKeys` sudah meng-clamp nomor halaman ke halaman terakhir yang ada
  // datanya, jadi `?page=99` aman dan tidak perlu `redirect()` di sini.
  // Jangan menambahkan `redirect()`: halaman ini punya `loading.tsx`, jadi
  // Next mulai streaming lebih dulu dan `redirect()` tidak bisa mengirim 307.
  const [{ keys, total, page: hal, perHalaman, totalHalaman }, ringkasan] = await Promise.all([
    getKeys({ q, status, page }),
    getRingkasanKey(),
  ]);

  return (
    <div className="space-y-4">
      {/* Judul halaman sudah ada di app bar, jadi di sini cukup ringkasan. */}
      <header>
        <p className="text-[13px] text-zinc-500">
          {angka(total)} key dari semua toko · {angka(ringkasan.active)} aktif · {angka(ringkasan.unused)} belum dipakai
          · {ringkasan.revoked} dicabut
        </p>
      </header>

      {/*
        Urutan di bawah itu disengaja: `KeyDaftar` adalah Server Component,
        sedangkan `KeyToolbar`/`KeyPaginasi`/`KeyKosong` adalah island. Semua
        ini SAUDAR, tidak ada island yang membungkus daftar — kalau dibungkus,
        React akan hydrate daftar itu juga dan seluruhnya jadi sia-sia.
      */}
      <KeyToolbar q={q} status={status} />

      <p className="text-[12px] text-zinc-500">
        {total === 0
          ? 'Tidak ada key'
          : `Menampilkan ${(hal - 1) * perHalaman + 1}–${Math.min(hal * perHalaman, total)} dari ${total} key`}
        {q ? ` untuk "${q}"` : ''}
      </p>

      {keys.length === 0 ? (
        <KeyKosong adaFilter={Boolean(q) || status !== 'semua'} />
      ) : (
        <KeyDaftar keys={keys} />
      )}

      <KeyPaginasi page={hal} totalHalaman={totalHalaman} jumlah={keys.length} />
    </div>
  );
}
