import { Package } from 'lucide-react';

import {
  AlertBox,
  EmptyState,
  ListCell,
  ListHead,
  ListHeadCell,
  ListRow,
  ListShell,
} from '@/components/ui/table';
import { rupiah } from '@/lib/format';
import { BELUM_DIISI, KOLOM_HARGA } from '@/lib/produk';
import type { Produk } from '@/types';

import { ProdukAksi, ProdukTambah } from './produk-aksi';

/**
 * ============================================================================
 *  DAFTAR PRODUK — SERVER COMPONENT
 * ============================================================================
 *
 * Struktur kolom yang diminta:
 *   Nama Aplikasi | Sekali Bayar (Rp) | Langganan/Tahun (Rp) | Aksi
 *
 * Deskripsi tidak dijadikan kolom tersendiri, melainkan dicetak di bawah nama
 * aplikasi. Alasannya panjangnya tidak menentu: kalau jadi kolom sendiri, satu
 * deskripsi berparagraf akan membuat seluruh baris membesar hanya karena satu
 * kolom.
 *
 * Dua hal yang dijaga di sini:
 *
 *  1. Kolom harga TIDAK pernah menampilkan 0 untuk harga yang belum diisi.
 *     `produk.harga_*` nullable, jadi null dicetak sebagai "Belum diisi".
 *     0 berarti produk itu gratis, dan kedua keadaan itu beda artinya.
 *
 *  2. Island client hanya dua: tombol "Tambah Produk" dan tombol aksi per
 *     baris. Nama, harga, dan deskripsi tetap HTML biasa sehingga tidak perlu
 *     hydrate.
 */

/**
 * Template kolom `lg:` — PERSIS sama antara `ListHead` dan `ListRow` supaya
 * judul kolom dan isi selalu sejajar.
 *
 * Kolom Aksi diberi lebar minimum yang cukup untuk dua tombol ikon. Kolom harga
 * diberi minimum yang cukup untuk "Rp500.000" supaya tidak pecah jadi dua baris.
 */
const GRID_PRODUK =
  'lg:grid-cols-[minmax(180px,2fr)_minmax(140px,1fr)_minmax(140px,1fr)_minmax(96px,.5fr)]';

/** Harga aman untuk dicetak: null -> "Belum diisi", selain itu format rupiah. */
function selHarga(nilai: number | null): { teks: string; kosong: boolean } {
  if (nilai === null || nilai === undefined) return { teks: BELUM_DIISI, kosong: true };
  return { teks: rupiah(nilai), kosong: false };
}

export function ProdukDaftar({ produk }: { produk: Produk[] }) {
  if (produk.length === 0) {
    return (
      <EmptyState
        title="Belum ada produk"
        description="Tambahkan produk yang dijual beserta harga sekali bayar dan harga langganan per tahun. Harga di sini dipakai menghitung estimasi komisi."
        action={<ProdukTambah />}
      />
    );
  }

  return (
    <ListShell>
      <ListHead gridClass={GRID_PRODUK}>
        <ListHeadCell>Nama Aplikasi</ListHeadCell>
        <ListHeadCell className="lg:text-right">{KOLOM_HARGA.sekali}</ListHeadCell>
        <ListHeadCell className="lg:text-right">{KOLOM_HARGA.langganan}</ListHeadCell>
        <ListHeadCell className="lg:text-right">Aksi</ListHeadCell>
      </ListHead>

      <ul className="divide-y divide-zinc-100">
        {produk.map((p) => {
          const sekali = selHarga(p.harga_sekali_bayar);
          const langganan = selHarga(p.harga_langganan_tahunan);

          return (
            <ListRow key={p.id} gridClass={GRID_PRODUK}>
              {/* 1 — Nama Aplikasi, plus deskripsi sebagai baris kedua */}
              <ListCell label="Nama Aplikasi">
                <p className="flex items-start gap-1.5 text-[14px] font-semibold text-zinc-900">
                  <Package className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                  <span className="break-words">{p.nama_apariksi}</span>
                </p>
                {p.deskripsi ? (
                  /*
                   * break-words + whitespace-normal: deskripsi bebas panjang dan
                   * tidak boleh dipotong, sama seperti alamat di daftar toko.
                   */
                  <p className="mt-0.5 break-words text-[12px] leading-snug whitespace-normal text-zinc-500">
                    {p.deskripsi}
                  </p>
                ) : null}
              </ListCell>

              {/* 2 — Sekali Bayar (Rp) */}
              <ListCell label={KOLOM_HARGA.sekali} className="tabular lg:text-right">
                {sekali.kosong ? (
                  <span className="text-zinc-500">{sekali.teks}</span>
                ) : (
                  <span className="font-medium text-zinc-800">{sekali.teks}</span>
                )}
              </ListCell>

              {/* 3 — Langganan/Tahun (Rp) */}
              <ListCell label={KOLOM_HARGA.langganan} className="tabular lg:text-right">
                {langganan.kosong ? (
                  <span className="text-zinc-500">{langganan.teks}</span>
                ) : (
                  <span className="font-medium text-zinc-800">{langganan.teks}</span>
                )}
              </ListCell>

              {/* 4 — Aksi */}
              <ListCell label="Aksi" className="lg:text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <ProdukAksi
                    produk={{
                      id: p.id,
                      nama_apariksi: p.nama_apariksi,
                      harga_sekali_bayar: p.harga_sekali_bayar,
                      harga_langganan_tahunan: p.harga_langganan_tahunan,
                      deskripsi: p.deskripsi,
                    }}
                  />
                </div>
              </ListCell>
            </ListRow>
          );
        })}
      </ul>
    </ListShell>
  );
}

/** Judul + tombol tambah, dipakai oleh header halaman. */
export function ProdukHeader({ jumlah }: { jumlah: number }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="flex items-center gap-2 text-[20px] font-bold text-zinc-900">
          <Package className="h-5 w-5 text-zinc-500" />
          Daftar Produk
        </h1>
        <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">
          {jumlah > 0
            ? `${jumlah} produk terdaftar. Harga di sini jadi acuan estimasi komisi.`
            : 'Belum ada produk. Tambahkan dulu agar estimasi komisi bisa dihitung.'}
        </p>
      </div>
      <ProdukTambah />
    </div>
  );
}

/**
 * Catatan di bawah tabel.
 *
 * Disampaikan eksplisit karena angka "Estimasi Komisi" di dashboard hanya
 * menghitung key yang sudah terhubung ke produk. Tanpa catatan ini, admin bisa
 * mengira komisinya nol karena tidak ada penjualan, padahal memang belum ada
 * harga acuan yang tertaut.
 */
export function ProdukCatatan({ adaTanpaHarga }: { adaTanpaHarga: boolean }) {
  if (!adaTanpaHarga) return null;

  return (
    <AlertBox tone="warn">
      Ada produk yang salah satu jenis harganya belum diisi. Key untuk jenis itu tidak punya acuan
      harga, jadi tidak ikut dihitung di estimasi komisi. Isi atau biarkan kosong sesuai kenyataan
      penjualan.
    </AlertBox>
  );
}
