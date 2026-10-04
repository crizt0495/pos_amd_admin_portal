import type { LicenseType, Produk, ProdukInput } from '@/types';

/**
 * =============================================================================
 *  KATALOG PRODUK & ATURAN ESTIMASI KOMISI
 * =============================================================================
 *
 * Modul ini SENGAJA tanpa `'use client'` dan tanpa `server-only`: isinya aturan
 * murni (fungsi-fungsi kecil), dipakai bersama oleh Server Component, Client
 * Component (form produk), dan Route Handler. Kalau aturan ini hidup di dua
 * tempat, kartu dashboard dan form yang mengeditnya bisa diam-diam berbeda.
 *
 * Dua hal yang dijaga modul ini:
 *
 *  1. HARGA ACAUN per lisensi. `harga_sekali_bayar` dan
 *     `harga_langganan_tahunan` tidak bisa dijumlahkan begitu saja: lisensi
 *     `langganan` dijual per tahun, lisensi `sekali` sekali bayar.
 *     `hargaAcuan()` adalah satu-satunya tempat yang memutuskan harga mana yang
 *     dipakai untuk sebuah lisensi.
 *
 *  2. PERSEN ESTIMASI. Angka 20% dipakai untuk menghitung komisi dari harga
 *     produk. Nilainya dideklarasikan sekali di sini supaya tidak ada dua
 *     angka 0,2 yang suatu saat berubah sendiri.
 */

/**
 * Persentase komisi untuk kartu "Estimasi Komisi".
 *
 * SENGAJA tidak diambil dari `TIER_RULES` di `tier.ts`: rate tier (5-30%) itu
 * komisi yang dibayar TOKO kepada admin untuk paket yang ia jual, dan rate-nya
 * berbeda per tier. Yang di sini satu rate tetap untuk semua key aktif.
 */
export const PERSEN_ESTIMASI_KOMISI = 0.2;

/**
 * Harga produk yang jadi acuan untuk satu jenis lisensi.
 *
 * Mengembalikan `null` (bukan 0) kalau produknya tidak ada atau harga untuk
 * jenis lisensi itu belum diisi. `null` berarti "tidak diketahui", sedangkan 0
 * berarti "gratis": pemanggil wajib membedakan keduanya supaya harga yang
 * belum ada tidak dilaporkan seolah-olah sudah ditanggung.
 */
export function hargaAcuan(p: Produk | null | undefined, pilihan: LicenseType): number | null {
  if (!p) return null;
  const v = pilihan === 'langganan' ? p.harga_langganan_tahunan : p.harga_sekali_bayar;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Estimasi komisi dari daftar key aktif.
 *
 * `harga_produk_acuan` sudah berupa harga per lisensi sesuai jenisnya (dihitung
 * di view `admin_keys`), jadi di sini cukup dijumlahkan lalu dikali satu rate.
 *
 * Key tanpa produk, atau produknya belum punya harga untuk jenis lisensi itu,
 * menyumbang 0. Jumlahnya dikembalikan terpisah supaya UI bisa menyebutkan
 * berapa key yang belum ikut dihitung, alih-alih diam-diam menampilkan angka
 * yang lebih kecil tanpa penjelasan.
 */
export function hitungEstimasiKomisi(rows: { harga_produk_acuan: number | null }[]): {
  estimasi: number;
  tercakup: number;
} {
  let jumlahHarga = 0;
  let tercakup = 0;

  for (const r of rows) {
    const harga = Number(r.harga_produk_acuan ?? 0);
    if (Number.isFinite(harga) && harga > 0) {
      jumlahHarga += harga;
      tercakup += 1;
    }
  }

  return {
    estimasi: Math.round(jumlahHarga * PERSEN_ESTIMASI_KOMISI),
    tercakup,
  };
}

/** Batas atas harga. Cukup untuk produk; di luar itu salah input. */
const MAKS_HARGA = 1_000_000_000;

/** Batas panjang nama aplikasi. */
const MAKS_NAMA = 100;

/**
 * Validasi satu baris produk dari form.
 *
 * Return `null` kalau valid, atau pesan error kalau tidak. Satu fungsi dipakai
 * baik oleh form (client) maupun Route Handler (server), supaya apa yang tampil
 * di layar dan apa yang disimpan memang aturan yang sama.
 *
 * Harga boleh KOSONG (disimpan `null` = belum diisi) tapi kalau diisi harus
 * bilangan bulat >= 0. Tidak ada harga negatif: harga negatif bukan diskon,
 * itu salah input.
 */
export function produkError(v: {
  nama_apariksi?: string;
  harga_sekali_bayar?: number | null;
  harga_langganan_tahunan?: number | null;
}): string | null {
  const nama = (v.nama_apariksi ?? '').trim();
  if (nama.length === 0) return 'Nama aplikasi wajib diisi.';
  if (nama.length > MAKS_NAMA) return `Nama aplikasi maksimal ${MAKS_NAMA} karakter.`;

  const pasangan: readonly [string, number | null | undefined][] = [
    ['sekali bayar', v.harga_sekali_bayar],
    ['langganan/tahun', v.harga_langganan_tahunan],
  ];

  for (const [label, nilai] of pasangan) {
    if (nilai === null || nilai === undefined) continue;
    if (!Number.isFinite(nilai)) return `Harga ${label} harus berupa angka.`;
    if (!Number.isInteger(nilai)) return `Harga ${label} harus bilangan bulat.`;
    if (nilai < 0) return `Harga ${label} tidak boleh negatif.`;
    if (nilai > MAKS_HARGA) return `Harga ${label} maksimal ${MAKS_HARGA.toLocaleString('id-ID')}.`;
  }

  return null;
}

/**
 * Bersihkan input mentah form jadi bentuk yang aman disimpan.
 *
 * String kosong jadi `null` (bukan 0): itu pembedaan paling penting di modul
 * ini, karena `0` berarti produk itu gratis sementara `null` berarti belum diisi.
 */
export function rapikanProduk(masuk: {
  nama_apariksi?: unknown;
  harga_sekali_bayar?: unknown;
  harga_langganan_tahunan?: unknown;
  deskripsi?: unknown;
}): ProdukInput {
  const harga = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) ? n : null;
  };

  const deskripsi = String(masuk.deskripsi ?? '').trim();

  return {
    nama_apariksi: String(masuk.nama_apariksi ?? '').trim(),
    harga_sekali_bayar: harga(masuk.harga_sekali_bayar),
    harga_langganan_tahunan: harga(masuk.harga_langganan_tahunan),
    deskripsi: deskripsi.length === 0 ? null : deskripsi,
  };
}

/** Judul kolom sesuai permintaan: "Sekali Bayar (Rp)" / "Langganan/Tahun (Rp)". */
export const KOLOM_HARGA = {
  sekali: 'Sekali Bayar (Rp)',
  langganan: 'Langganan/Tahun (Rp)',
} as const;

/** Teks untuk sel harga yang masih NULL (belum diisi). */
export const BELUM_DIISI = 'Belum diisi';
