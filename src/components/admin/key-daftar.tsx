import { KeyStatusBadge } from '@/components/ui/badge';
import { ListCell, ListHead, ListHeadCell, ListRow, ListShell } from '@/components/ui/table';
import { rupiah, tanggalWaktu } from '@/lib/format';
import { LICENSE_TYPE_LABEL, PAKET_LABEL } from '@/lib/tier';
import type { Key } from '@/types';

import { KeyAksi, KeySalin } from './key-aksi';

/**
 * ============================================================================
 *  DAFTAR KEY GLOBAL — SERVER COMPONENT
 * ============================================================================
 *
 * File ini TIDAK punya `'use client'`, dan itu inti dari perubahan performanya.
 *
 * Sebelumnya seluruh tabel (toolbar, 20 baris x 9 sel, paginasi, modal) berada
 * di dalam satu Client Component. Akibatnya:
 *   1. objek `Key` utuh (19 field/baris) melintas lewat payload RSC, padahal
 *      11 field-nya tidak pernah dipakai di browser;
 *   2. setiap sel ikut hydrate, walau isinya cuma teks statis.
 *
 * Sekarang hanya tiga hal yang jadi island: `KeySalin`, `KeyAksi`, dan
 * (di file terpisah) toolbar + paginasi. Sembilan sel data di bawah ini
 * dirender sekali di server dan tidak pernah masuk ke bundle klien.
 *
 * Perhatikan `data={{ ... }}` pada `KeyAksi`: field-nya ditulis satu per satu,
 * bukan `data={k}`. Ini disengaja — tipe `KeyAksiData` hanya mengizinkan 7
 * field, jadi kalau suatu saat kolom `Key` bertambah, TypeScript akan menolak
 * build alih-alih diam-diam ikut ter-serialize ke browser.
 */

/**
 * Template kolom untuk `lg:` — dipakai PERSIS sama oleh `ListHead` dan
 * `ListRow`, jadi judul kolom dan isi selalu sejajar. Di bawah `lg` template
 * ini diabaikan: tiap sel jadi blok bertumpuk dengan label `ListCell`.
 *
 * Urutannya harus sama dengan urutan sel di dalam `ListRow`.
 */
const GRID_DAFTAR =
  'lg:grid-cols-[minmax(128px,1fr)_minmax(168px,1.5fr)_minmax(92px,.9fr)_minmax(74px,.7fr)_minmax(82px,.8fr)_minmax(82px,.8fr)_minmax(108px,.9fr)_minmax(78px,.7fr)_minmax(64px,auto)]';

export function KeyDaftar({ keys }: { keys: Key[] }) {
  return (
    <ListShell>
      <ListHead gridClass={GRID_DAFTAR}>
        <ListHeadCell>Serial Key</ListHeadCell>
        <ListHeadCell>Pembeli</ListHeadCell>
        <ListHeadCell>Toko Penjual</ListHeadCell>
        <ListHeadCell>Paket</ListHeadCell>
        <ListHeadCell>Pilihan</ListHeadCell>
        <ListHeadCell className="text-right">Komisi</ListHeadCell>
        <ListHeadCell>Tanggal Generate</ListHeadCell>
        <ListHeadCell>Status</ListHeadCell>
        <ListHeadCell className="text-right">Aksi</ListHeadCell>
      </ListHead>

      <ul className="divide-y divide-zinc-100">
        {keys.map((k) => (
          <ListRow key={k.id} gridClass={GRID_DAFTAR}>
            {/* 1 — Serial key + tombol salin */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[12px] font-semibold text-zinc-900">
                  {k.serial_key}
                </span>
                <KeySalin serial={k.serial_key} />
              </div>
              {k.hwid_locked ? (
                // zinc-500 bukan zinc-400: teks kecil ini tampil penuh di HP
                // dan zinc-400 hanya ~2,6:1 (gagal WCAG AA).
                <p className="mt-0.5 text-[12px] text-zinc-500" title={k.hwid_locked}>
                  terkunci ke {k.device_name ?? 'perangkat'}
                </p>
              ) : null}
            </div>

            {/* 2 — Pembeli: nama, alamat, telepon */}
            <div className="mt-2.5 min-w-0 lg:mt-0">
              <p className="text-sm font-medium text-zinc-800">{k.nama_pembeli}</p>
              {k.alamat_pembeli ? (
                <p
                  title={k.alamat_pembeli}
                  className="line-clamp-2 max-w-[200px] text-xs leading-snug text-gray-600"
                >
                  {k.alamat_pembeli}
                </p>
              ) : (
                <p className="max-w-[200px] text-xs leading-snug text-gray-600">
                  Alamat belum diisi
                </p>
              )}
              {k.telepon ? (
                // gray-500 bukan gray-400, alasan kontras sama seperti di atas.
                <p className="tabular text-[12px] text-gray-500">{k.telepon}</p>
              ) : null}
            </div>

            {/* 3 — Toko Penjual */}
            <ListCell label="Toko">
              <span className="text-zinc-600">{k.nama_toko ?? '-'}</span>
            </ListCell>

            {/* 4 — Paket */}
            <ListCell label="Paket">
              <span>{PAKET_LABEL[k.paket]}</span>
            </ListCell>

            {/* 5 — Pilihan */}
            <ListCell label="Pilihan">
              <span>{LICENSE_TYPE_LABEL[k.pilihan]}</span>
            </ListCell>

            {/* 6 — Komisi */}
            <ListCell label="Komisi" className="lg:text-right">
              <span className="tabular">{rupiah(k.komisi)}</span>
            </ListCell>

            {/* 7 — Tanggal generate */}
            <ListCell label="Tanggal Generate">
              <span className="text-zinc-600">{tanggalWaktu(k.created_at)}</span>
            </ListCell>

            {/* 8 — Status */}
            <ListCell label="Status">
              <KeyStatusBadge status={k.status} />
            </ListCell>

            {/* 9 — Aksi (target sentuh tetap 44px di HP) */}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 lg:mt-0 lg:justify-end">
              <KeyAksi
                data={{
                  id: k.id,
                  serial_key: k.serial_key,
                  status: k.status,
                  nama_pembeli: k.nama_pembeli,
                  nama_toko: k.nama_toko,
                  paket: k.paket,
                  pilihan: k.pilihan,
                }}
              />
            </div>
          </ListRow>
        ))}
      </ul>
    </ListShell>
  );
}
