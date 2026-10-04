import Link from 'next/link';

import { KuotaBadge, StoreStatusBadge, TierBadge } from '@/components/ui/badge';
import { ListCell, ListHead, ListHeadCell, ListRow, ListShell } from '@/components/ui/table';
import { sejak } from '@/lib/format';
import type { Store } from '@/types';

import { PilihSemua, StoreAksi, StorePilih } from './store-aksi';

/**
 * =============================================================================
 *  DAFTAR TOKO — SERVER COMPONENT
 * =============================================================================
 *
 * File ini TIDAK punya `'use client'`, dan itu inti dari perubahan performanya.
 *
 * Sebelumnya seluruh tabel (toolbar, semua baris x 10 sel, paginasi, dialog)
 * berada di dalam satu Client Component (`StoreManager`). Akibatnya:
 *   1. objek `Store` utuh (15 field/baris) melintas lewat payload RSC, padahal
 *      8 field-nya saja yang perlu sampai di browser untuk aksi interaktif;
 *   2. setiap sel ikut hydrate, walau isinya cuma teks statis.
 *
 * Sekarang hanya tiga hal yang jadi island: `PilihSemua` (kepala tabel),
 * `StorePilih` (kotak centang per baris), dan `StoreAksi` (tombol + dialog).
 * Sembilan sel data di bawah ini dirender sekali di server dan tidak pernah
 * masuk ke bundle klien.
 *
 * Perhatikan `data={{ ... }}` pada island: field-nya ditulis satu per satu,
 * bukan `data={s}`. Tipe `StoreRowData` hanya mengizinkan 8 field, jadi kalau
 * suatu saat kolom `Store` bertambah, TypeScript akan menolak build alih-alih
 * diam-diam ikut ter-serialize ke browser.
 */

/**
 * Template kolom untuk `lg:` — dipakai PERSIS sama oleh `ListHead` dan
 * `ListRow`, jadi judul kolom dan isi selalu sejajar. Di bawah `lg` template
 * ini diabaikan: tiap sel jadi blok bertumpuk dengan label `ListCell`.
 *
 * Urutannya harus sama dengan urutan sel di dalam `ListRow`.
 */
const GRID_TOKO =
  'lg:grid-cols-[34px_minmax(140px,1.2fr)_minmax(148px,1.2fr)_minmax(104px,.75fr)_minmax(148px,1.15fr)_minmax(80px,.55fr)_minmax(70px,.5fr)_minmax(96px,.65fr)_minmax(96px,.65fr)_minmax(78px,auto)]';

export function StoreDaftar({ stores }: { stores: Store[] }) {
  return (
    <ListShell>
      <ListHead gridClass={GRID_TOKO}>
        {/* Checkbox tidak dibungkus ListHeadCell: sel itu bukan teks judul, dan
            `uppercase`/tracking milik ListHeadCell tidak relevan untuk checkbox. */}
        <PilihSemua stores={stores} />
        <ListHeadCell>Nama Toko</ListHeadCell>
        <ListHeadCell>Email Akun</ListHeadCell>
        <ListHeadCell>No HP</ListHeadCell>
        <ListHeadCell>Alamat</ListHeadCell>
        <ListHeadCell>Tier</ListHeadCell>
        <ListHeadCell className="text-right">Terjual</ListHeadCell>
        <ListHeadCell className="text-right">Sisa Kuota</ListHeadCell>
        <ListHeadCell>Status</ListHeadCell>
        <ListHeadCell className="text-right">Aksi</ListHeadCell>
      </ListHead>

      <ul className="divide-y divide-zinc-100">
        {stores.map((s) => (
          <ListRow key={s.id} gridClass={GRID_TOKO}>
            {/* 1 — centang */}
            <div className="flex items-center">
              <StorePilih
                data={{
                  id: s.id,
                  nama_toko: s.nama_toko,
                  email: s.email,
                  no_hp: s.no_hp,
                  alamat: s.alamat,
                  total_terjual: s.total_terjual,
                  sisa_kuota: s.sisa_kuota,
                  is_active: s.is_active,
                }}
              />
            </div>

            {/* 2 — Nama toko + tanggal daftar */}
            <ListCell label="Nama Toko">
              <Link
                href={`/toko/${s.id}`}
                className="font-semibold text-zinc-900 underline-offset-2 hover:underline"
              >
                {s.nama_toko}
              </Link>
              <p className="text-[12px] text-zinc-500">daftar {sejak(s.created_at)}</p>
            </ListCell>

            {/* 3 — Email akun */}
            <ListCell label="Email Akun">
              <span className="text-zinc-600">{s.email ?? '-'}</span>
            </ListCell>

            {/* 4 — Nomor HP */}
            <ListCell label="No HP">
              <span className="tabular text-zinc-600">{s.no_hp ?? '-'}</span>
            </ListCell>

            {/* 5 — Alamat */}
            {/*
             * Alamat dibiarkan penuh. Dulu dipotong `max-w-[220px] truncate`,
             * jadi admin hanya melihat potongan dan harus membuka detail toko
             * untuk tahu alamat sebenarnya. Teksnya kini membungkus sendiri,
             * dan sel tetap rapi karena tiap kolom punya lebar sendiri.
             */}
            <ListCell label="Alamat">
              <span
                className="block break-words leading-relaxed whitespace-normal text-zinc-600"
                title={s.alamat ?? ''}
              >
                {s.alamat ?? '-'}
              </span>
            </ListCell>

            {/* 6 — Tier */}
            <ListCell label="Tier">
              <TierBadge tier={s.tier} />
            </ListCell>

            {/* 7 — Terjual */}
            <ListCell label="Terjual" className="tabular lg:text-right">
              <span>{s.total_terjual}</span>
            </ListCell>

            {/* 8 — Sisa kuota */}
            <ListCell label="Sisa Kuota" className="lg:text-right">
              <KuotaBadge sisa={s.sisa_kuota} />
            </ListCell>

            {/* 9 — Status */}
            <ListCell label="Status">
              <StoreStatusBadge aktif={s.is_active} />
            </ListCell>

            {/* 10 — Aksi */}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 lg:mt-0 lg:justify-end">
              <StoreAksi
                data={{
                  id: s.id,
                  nama_toko: s.nama_toko,
                  email: s.email,
                  no_hp: s.no_hp,
                  alamat: s.alamat,
                  total_terjual: s.total_terjual,
                  sisa_kuota: s.sisa_kuota,
                  is_active: s.is_active,
                }}
              />
            </div>
          </ListRow>
        ))}
      </ul>
    </ListShell>
  );
}
