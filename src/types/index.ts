/**
 * Domain types untuk KasirPro Admin Portal.
 * Sumber kebenaran: supabase/admin-schema.sql (view `admin_stores` & `admin_keys`).
 *
 * PENTING: `tier` di sini BUKAN kolom tersimpan. Nilainya dihitung di SQL dari
 * `partners.total_terjual` lewat fungsi `tier_name_of()` — sama seperti di
 * portal toko. Jadi tidak mungkin "basi" saat toko naik tier.
 */

export type TierName = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

/** Status key. `unused` = sudah dijual, belum dipakai di komputer kasir. */
export type LicenseStatus = 'unused' | 'active' | 'blocked' | 'revoked';

export type PaketType = 'bundle' | 'app_only';
export type LicenseType = 'sekali' | 'langganan';

/** Satu baris view `admin_stores` (= satu toko terdaftar). */
export interface Store {
  id: string;
  user_id: string | null;
  nama_toko: string;
  email: string | null;
  username: string | null;
  no_hp: string | null;
  alamat: string | null;
  tier: TierName;
  total_terjual: number;
  sisa_kuota: number;
  komisi_total: number;
  is_active: boolean;
  status: 'active' | 'suspended';
  created_at: string;
  updated_at: string;
}

/**
 * Subset baris toko yang boleh menyeberang ke Client Component (island).
 *
 * Setiap kolom di bawah ini memang dipakai oleh UI island (`StoreAksi` dan
 * `PilihSemua`). Field lain (user_id, username, komisi_total, status) tidak
 * pernah dilihat di klien, jadi dilarang menyeberang: kalau nanti kolom baru
 * ditambah, TypeScript akan menolak build alih-alih diam-diam ikut
 * ter-serialize.
 */
export type StoreRowData = Pick<
  Store,
  | 'id'
  | 'nama_toko'
  | 'email'
  | 'no_hp'
  | 'alamat'
  | 'total_terjual'
  | 'sisa_kuota'
  | 'is_active'
>;

/** Satu baris view `admin_keys` (= satu serial key global). */
export interface Key {
  id: string;
  serial_key: string;
  store_id: string;
  nama_toko: string | null;
  nama_pembeli: string;
  telepon: string | null;
  alamat_pembeli: string | null;
  paket: PaketType;
  pilihan: LicenseType;
  komisi: number;
  tier: TierName;
  tier_rate: number;
  status: LicenseStatus;
  hwid_locked: string | null;
  device_name: string | null;
  activated_at: string | null;
  expires_at: string | null;
  created_at: string;
  /** Produk acuan lisensi ini (lihat tabel `produk`). */
  produk_id: string | null;
  produk_nama: string | null;
  /**
   * Harga produk sesuai jenis lisensi ini: `sekali` -> `harga_sekali_bayar`,
   * `langganan` -> `harga_langganan_tahunan`.
   *
   * Hitung di SQL dan sudah di-`coalesce` ke 0, jadi di sisi aplikasi tidak
   * pernah perlu memeriksa null untuk menjumlahkannya.
   */
  harga_produk_acuan: number;
}

/**
 * Satu baris katalog produk (tabel `produk`).
 *
 * Kedua harga NULL-able dan itu disengaja: `NULL` berarti "belum diisi" untuk
 * jenis penjualan itu, sedangkan `0` berarti "benar-benar gratis". Kalau
 * keduanya dipaksa jadi 0, produk yang belum tahu harga langganannya akan ikut
 * membuat estimasi komisi melorot.
 */
export interface Produk {
  id: string;
  nama_apariksi: string;
  harga_sekali_bayar: number | null;
  harga_langganan_tahunan: number | null;
  deskripsi: string | null;
  created_at: string;
}

/** Bentuk kiriman form produk -> Route Handler. */
export interface ProdukInput {
  nama_apariksi: string;
  harga_sekali_bayar: number | null;
  harga_langganan_tahunan: number | null;
  deskripsi: string | null;
}

export interface TopupHistory {
  id: string;
  store_id: string;
  jumlah: number;
  sisa_quota: number;
  admin_by: string | null;
  catatan: string | null;
  created_at: string;
}

/** Identitas admin yang sedang login (hasil requireAdmin). */
export interface AdminUser {
  userId: string;
  email: string;
}

/** Ringkasan angka untuk kartu dashboard. */
export interface DashboardSummary {
  totalToko: number;
  totalKeyTerjual: number;
  totalKeySisa: number;
  /**
   * Estimasi komisi = 20% x harga produk acuan, dari key berstatus `active`.
   *
   * Menggantikan "Komisi Pending" (jumlah komisi key yang belum dipakai).
   * Angka itu menyesatkan: ia menjumlahkan komisi dari key yang belum pernah
   * dipakai pembeli, padahal komisi baru benar-benar masuk saat key berstatus
   * `active`.
   */
  estimasiKomisi: number;
  komisiTotal: number;
  /** Key `active` yang terhubung ke katalog produk (dasar hitungan estimasi). */
  keyAktifBer_acuan: number;
}

/** Satu titik pada chart penjualan 7 hari. */
export interface SalesPoint {
  /** YYYY-MM-DD (UTC) */
  tanggal: string;
  label: string;
  jumlah: number;
  komisi: number;
}

/* ------------------------------------------------------------------ */
/* Balasan API                                                         */
/* ------------------------------------------------------------------ */

export type ApiResult<T = unknown> =
  | { ok: true; message: string; data?: T }
  | { ok: false; message: string };

export interface TopupResult {
  store_id: string;
  nama_toko: string;
  sisa_kuota: number;
  ok: boolean;
  pesan: string;
}
