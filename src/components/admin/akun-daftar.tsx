import Link from 'next/link';
import { KeyRound, Layers, Search, UserCog, UserPlus } from 'lucide-react';

import { KuotaBadge, StoreStatusBadge, TierBadge } from '@/components/ui/badge';
import {
  AlertBox,
  EmptyState,
  ListCell,
  ListHead,
  ListHeadCell,
  ListRow,
  ListShell,
} from '@/components/ui/table';
import { rupiah, sejak } from '@/lib/format';
import type { Store } from '@/types';

/**
 * ============================================================================
 *  DAFTAR AKUN TOKO - SERVER COMPONENT, TANPA JAVASCRIPT
 * ============================================================================
 *
 * Halaman ini berbeda dari halaman lain: TIDAK ada satu pun Client Component di
 * dalamnya, dan tidak ada satu baris pun JavaScript yang diunduh browser. Semua
 * interaksinya memakai HTML native, bukan React.
 *
 * Kenapa: halaman ini sebelumnya punya TBT 1.090 ms (Lighthouse Performance 68)
 * hanya untuk me-hydrate `AkunManager` beserta tiga dialog-nya. Untuk daftar
 * yang isinya cuma teks dan angka, hydrate 105 kB JavaScript adalah pemborosan
 * yang tidak ada imbal balik.
 *
 * PEMETAAN INTERAKSI LAMA -> YANG BARU
 *
 *   state React              ->  <form method="get"> + `?q=` di URL
 *   filter di memori         ->  filter di server (`filterToko`)
 *   checkbox + state Set     ->  <input type="checkbox" name="store_ids">
 *   Modal top up             ->  <details> + <form method="post">
 *   Modal reset password     ->  <details> + <form method="post">
 *   toast.sukses()           ->  banner `?ok=` / `?err=` dari redirect 303
 *
 * Yang HILANG dengan sengaja: tombol "pilih semua". HTML native tidak punya
 * cara mencentang sekumpulan checkbox tanpa JavaScript, dan lebih baik kontrol
 * itu dihapus daripada dibiarkan ada tapi tidak melakukan apa pun.
 *
 * Yang TIDAK hilang: pencarian, generate kuota massal, top up per toko, dan
 * reset password per toko. Semuanya tetap bisa dipakai, hanya saja setelah
 * selesai halamannya dimuat ulang.
 */

/**
 * Template kolom `lg:` untuk daftar akun - PERSIS sama antara `ListHead` dan
 * `ListRow` supaya judul kolom dan isi sejajar. Di bawah `lg` diabaikan: tiap
 * sel jadi blok bertumpuk dengan label dari CSS `::before`.
 */
const GRID_AKUN =
  'lg:grid-cols-[34px_minmax(140px,1.2fr)_minmax(148px,1.2fr)_minmax(104px,.75fr)_minmax(80px,.55fr)_minmax(70px,.5fr)_minmax(96px,.65fr)_minmax(104px,.7fr)_minmax(96px,.65fr)_minmax(78px,auto)]';

/**
 * Filter daftar akun di server.
 *
 * Pencarian pindah ke sini (dulu `useMemo` di client) supaya `/akun` bisa
 * disajikan tanpa JavaScript. Datanya kecil - handful toko per akun - jadi
 * tidak perlu indeks pencarian apa pun.
 */
export function filterToko(stores: Store[], q: string): Store[] {
  const kunci = q.trim().toLowerCase();
  if (!kunci) return stores;
  return stores.filter((s) =>
    [s.nama_toko, s.email ?? '', s.username ?? ''].join(' ').toLowerCase().includes(kunci),
  );
}

/**
 * Kotak pencarian.
 *
 * `<form method="get" action="/akun">` adalah pengganti penuh dari state
 * `cari`. `name="q"` dibaca `searchParams` di page, jadi isinya sudah terisi
 * dari server dan tidak baru muncul setelah hydration.
 */
export function AkunCari({ q, jumlah }: { q: string; jumlah: number }) {
  return (
    <form method="get" action="/akun" className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        {/*
         * `field-input` dipakai langsung, bukan komponen `Input` dari
         * `components/ui/form.tsx`, karena file itu `'use client'`.
         * Meng-importnya ke Server Component akan menarik React ke halaman ini -
         * persis yang sedang kita hilangkan.
         */}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Cari nama toko, email, username..."
          aria-label="Cari akun toko"
          className="field-input pl-9"
        />
      </div>

      <button type="submit" className="btn-outline shrink-0">
        Cari
      </button>

      {q ? (
        <Link
          href="/akun"
          prefetch={false}
          className="btn-outline shrink-0"
        >
          Reset
        </Link>
      ) : (
        <span className="shrink-0 text-[12.5px] text-zinc-500">{jumlah} akun toko</span>
      )}
    </form>
  );
}

/**
 * Panel generate kuota massal.
 *
 * Diletakkan DI BAWAH daftar, bukan di atas: alurnya adalah mencentang toko di
 * tabel, lalu turun ke sini untuk mengisi jumlah dan menekan tombol.
 *
 * `id="topup-massal"` dipakai checkbox di tabel lewat atribut `form=`. Jadi
 * `<form>`-nya ada di satu tempat dan checkbox-nya bisa tetap berada di dalam
 * baris tanpa harus membungkus seluruh tabel (form HTML tidak boleh bersarang).
 */
export function AkunTopupMassal({ ulang, adaToko }: { ulang: string; adaToko: boolean }) {
  return (
    <section className="card-soft p-4 sm:p-5" aria-labelledby="judul-massal">
      <div className="mb-3 flex items-center gap-2">
        <Layers className="h-4 w-4 text-zinc-500" />
        <h2 id="judul-massal" className="text-[15px] font-bold">
          Generate Kuota Massal
        </h2>
      </div>

      <form
        id="topup-massal"
        method="post"
        action="/api/topup/bulk"
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        {/*
         * Field tersembunyi yang memberi tahu Route Handler ke mana form ini
         * harus dikembalikan. Isinya sudah disanitasi server (`jalurKembali`),
         * jadi admin tidak bisa dialihkan ke origin lain lewat form.
         */}
        <input type="hidden" name="_ulang" value={ulang} />

        <div className="flex-1">
          <label htmlFor="m-jumlah" className="field-label">
            Jumlah Key per Toko
          </label>
          <input
            id="m-jumlah"
            name="jumlah_key"
            type="number"
            inputMode="numeric"
            step={1}
            defaultValue={5}
            required
            className="field-input tabular"
          />
        </div>

        <div className="flex-[2]">
          <label htmlFor="m-catatan" className="field-label">
            Catatan (opsional)
          </label>
          <input
            id="m-catatan"
            name="catatan"
            type="text"
            maxLength={140}
            placeholder="mis. bonus_campaign_Oktober"
            className="field-input"
          />
        </div>

        <button type="submit" className="btn-primary shrink-0">
          <Layers className="h-4 w-4" />
          Terapkan ke toko yang dicentang
        </button>
      </form>

      {/*
       * Tombol sengaja TIDAK diberi `disabled` walau `adaToko` false. Checkbox
       * belum dicentang saat HTML ini dirender, jadi `disabled` akan selalu
       * menyala - dan admin tidak akan punya cara membukanya lagi setelah
       * mencentang.
       *
       * Yang dilakukan gantinya: tombol tetap aktif, dan Route Handler menolak
       * dengan pesan jelas kalau memang tidak ada toko yang dipilih.
       */}
      <p className="mt-2.5 text-[12px] leading-relaxed text-zinc-500">
        {adaToko
          ? 'Centang kolom kosong di tabel, isi jumlah, lalu tekan tombol. Nilai boleh minus untuk koreksi admin; sisa kuota tidak pernah turun di bawah 0.'
          : 'Belum ada akun toko yang bisa dicentang. Daftar toko baru terlebih dahulu.'}
      </p>
    </section>
  );
}

/** Banner hasil aksi (sukses/gagal), dibaca dari `?ok=` / `?err=`. */
export function AkunFlash({ ok, err }: { ok?: string; err?: string }) {
  if (err) return <AlertBox tone="error">{err}</AlertBox>;
  if (ok) return <AlertBox tone="success">{ok}</AlertBox>;
  return null;
}

/**
 * Daftar akun.
 *
 * `ulang` diteruskan ke setiap form aksi supaya setelah selesai user kembali ke
 * halaman yang sama termasuk filter pencarian yang sedang aktif - bukan ke
 * `/akun` polos yang kehilangan konteks.
 */
export function AkunDaftar({
  stores,
  q,
  ulang,
}: {
  stores: Store[];
  q: string;
  ulang: string;
}) {
  return (
    <div className="space-y-4">
      {stores.length === 0 ? (
        <EmptyState
          title={q ? 'Tidak ada akun yang cocok' : 'Belum ada akun toko'}
          description={
            q
              ? `Tidak ditemukan akun dengan kata kunci "${q}".`
              : 'Daftarkan toko baru untuk membuat akun login pertamanya.'
          }
          action={
            <Link href="/toko/baru" prefetch={false} className="btn-primary">
              <UserPlus className="h-4 w-4" />
              Daftar Toko Baru
            </Link>
          }
        />
      ) : (
        <ListShell>
          <ListHead gridClass={GRID_AKUN}>
            <span className="flex items-center text-[12px] font-bold uppercase tracking-wide text-zinc-400">
              <span className="sr-only">Pilih</span>
            </span>
            <ListHeadCell>Nama Toko</ListHeadCell>
            <ListHeadCell>Email Login</ListHeadCell>
            <ListHeadCell>Username</ListHeadCell>
            <ListHeadCell>Tier</ListHeadCell>
            <ListHeadCell className="text-right">Terjual</ListHeadCell>
            <ListHeadCell className="text-right">Sisa Kuota</ListHeadCell>
            <ListHeadCell>Komisi</ListHeadCell>
            <ListHeadCell>Status</ListHeadCell>
            <ListHeadCell className="text-right">Aksi</ListHeadCell>
          </ListHead>

          <ul className="divide-y divide-zinc-100">
            {stores.map((s) => (
              <ListRow key={s.id} gridClass={GRID_AKUN}>
                {/* 1 - centang, milik form "topup-massal" yang ada di bawah */}
                <div className="flex items-center">
                  <label className="-m-2 grid h-11 w-11 cursor-pointer place-items-center">
                    <input
                      type="checkbox"
                      name="store_ids"
                      value={s.id}
                      form="topup-massal"
                      aria-label={`Pilih ${s.nama_toko}`}
                      className="h-5 w-5 rounded border-zinc-300 accent-zinc-900"
                    />
                  </label>
                </div>

                {/* 2 - Nama toko + tanggal daftar */}
                <ListCell label="Nama Toko">
                  <Link
                    href={`/toko/${s.id}`}
                    prefetch={false}
                    className="font-semibold text-zinc-900 underline-offset-2 hover:underline"
                  >
                    {s.nama_toko}
                  </Link>
                  <p className="text-[12px] text-zinc-500">daftar {sejak(s.created_at)}</p>
                </ListCell>

                {/* 3 - Email login */}
                <ListCell label="Email Login">
                  <span className="break-words text-zinc-600">{s.email ?? '-'}</span>
                </ListCell>

                {/* 4 - Username */}
                <ListCell label="Username">
                  <span className="text-zinc-600">{s.username ?? '-'}</span>
                </ListCell>

                {/* 5 - Tier */}
                <ListCell label="Tier">
                  <TierBadge tier={s.tier} />
                </ListCell>

                {/* 6 - Terjual */}
                <ListCell label="Terjual" className="tabular lg:text-right">
                  <span>{s.total_terjual}</span>
                </ListCell>

                {/* 7 - Sisa kuota */}
                <ListCell label="Sisa Kuota" className="lg:text-right">
                  <KuotaBadge sisa={s.sisa_kuota} />
                </ListCell>

                {/* 8 - Komisi */}
                <ListCell label="Komisi" className="tabular text-zinc-600">
                  <span>{rupiah(s.komisi_total)}</span>
                </ListCell>

                {/* 9 - Status */}
                <ListCell label="Status">
                  <StoreStatusBadge aktif={s.is_active} />
                </ListCell>

                {/* 10 - Aksi: native <details> + dua form POST */}
                <div className="mt-2.5 lg:mt-0 lg:flex lg:justify-end">
                  <details className="group w-full min-w-0 lg:w-auto">
                    <summary className="btn-outline cursor-pointer list-none text-[13px] lg:h-9 lg:px-3">
                      <span className="group-open:hidden">Aksi</span>
                      <span className="hidden group-open:inline">Tutup</span>
                    </summary>

                    <div className="mt-2.5 space-y-3 rounded-xl bg-zinc-50 p-3">
                      {/* --- Top up satu toko --- */}
                      <form method="post" action="/api/topup" className="space-y-2">
                        <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-zinc-500">
                          <KeyRound className="h-3.5 w-3.5" />
                          Top up kuota
                        </p>
                        <input type="hidden" name="store_id" value={s.id} />
                        <input type="hidden" name="_ulang" value={ulang} />

                        <div>
                          <label htmlFor={`topup-${s.id}`} className="sr-only">
                            Jumlah key untuk {s.nama_toko}
                          </label>
                          <input
                            id={`topup-${s.id}`}
                            name="jumlah_key"
                            type="number"
                            inputMode="numeric"
                            step={1}
                            defaultValue={5}
                            required
                            className="field-input tabular"
                          />
                        </div>
                        <button type="submit" className="btn-primary w-full lg:h-9 lg:text-[13px]">
                          Tambah Kuota
                        </button>
                      </form>

                      {/* --- Reset password --- */}
                      <form
                        method="post"
                        action="/api/akun/reset-password"
                        className="space-y-2 border-t border-zinc-200 pt-3"
                      >
                        <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-zinc-500">
                          <UserCog className="h-3.5 w-3.5" />
                          Reset password
                        </p>
                        <input type="hidden" name="store_id" value={s.id} />
                        <input type="hidden" name="_ulang" value={ulang} />

                        <div>
                          <label htmlFor={`pw-${s.id}`} className="sr-only">
                            Password baru untuk {s.nama_toko}
                          </label>
                          <input
                            id={`pw-${s.id}`}
                            name="password_baru"
                            type="text"
                            autoComplete="new-password"
                            required
                            minLength={8}
                            placeholder="min. 8 karakter"
                            className="field-input"
                          />
                        </div>
                        <button type="submit" className="btn-outline w-full lg:h-9 lg:text-[13px]">
                          Reset Password
                        </button>
                        <p className="text-[11.5px] leading-relaxed text-zinc-500">
                          Tidak dikirim via email - sampaikan manual ke toko.
                        </p>
                      </form>
                    </div>
                  </details>
                </div>
              </ListRow>
            ))}
          </ul>
        </ListShell>
      )}

      <AkunTopupMassal ulang={ulang} adaToko={stores.length > 0} />
    </div>
  );
}
