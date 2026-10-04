import 'server-only';

import { cache } from 'react';

import {
  demoBuatProduk,
  demoCariStore,
  demoDashboard,
  demoHapusProduk,
  demoKeys,
  demoKeysToko,
  demoPatchProduk,
  demoProduk,
  demoStores,
  demoTopupsToko,
} from '@/lib/demo/data';
import { demoAktif } from '@/lib/demo/config';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/supabase/guard';
import { hariSingkat, tanggalPendek } from '@/lib/format';
import { hitungEstimasiKomisi, rapikanProduk, produkError } from '@/lib/produk';
import type {
  DashboardSummary,
  Key,
  LicenseStatus,
  Produk,
  ProdukInput,
  SalesPoint,
  Store,
  TopupHistory,
} from '@/types';

/**
 * =============================================================================
 *  QUERY ADMIN  —  semua fungsi di sini memakai SERVICE ROLE client
 * =============================================================================
 *  Aturan: TIDAK ADA fungsi yang boleh dipanggil tanpa `requireAdmin()` lebih
 *  dulu. Karena service-role client melewati RLS, setiap pemanggil WAJIB
 *  menjalankan guard lebih dulu (lihat lib/supabase/guard.ts).
 * =============================================================================
 */

/** Kolom yang sering dipakai; declaring sekali biar query ringkas & konsisten. */
const KOLOM_STORE =
  'id, user_id, nama_toko, email, username, no_hp, alamat, tier, total_terjual, sisa_kuota, komisi_total, is_active, status, created_at, updated_at';

const KOLOM_KEY =
  'id, serial_key, store_id, nama_toko, nama_pembeli, telepon, alamat_pembeli, paket, pilihan, komisi, tier, tier_rate, status, hwid_locked, device_name, activated_at, expires_at, created_at, produk_id, produk_nama, harga_produk_acuan';

/** Katalog produk — seluruh kolomnya memang dipakai UI, jadi SELECT *. */
const KOLOM_PRODUK = 'id, nama_apariksi, harga_sekali_bayar, harga_langganan_tahunan, deskripsi, created_at';

/** Namai helper ini biar jelas:_fn yang melempar kalau bukan admin. */
async function wajibAdmin() {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(`Akses ditolak: ${auth.error}`);
  return auth.user;
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                          */
/* ------------------------------------------------------------------ */

export const getDashboard = cache(async (): Promise<{
  summary: DashboardSummary;
  stores: Store[];
  sales: SalesPoint[];
}> => {
  await wajibAdmin();

  // Mode demo: data in-memory, tanpa Supabase.
  if (demoAktif) return demoDashboard();

  const db = createAdminClient();

  // 7 hari terakhir, termasuk hari ini (timezone server).
  const sejak7Hari = new Date();
  sejak7Hari.setHours(0, 0, 0, 0);
  sejak7Hari.setDate(sejak7Hari.getDate() - 6);

  /*
   * =============================================================================
   *  SATU FASE PARALEL — jangan pecah jadi beberapa `await Promise.all()`.
   * =============================================================================
   * Setiap query ke Supabase itu satu kali bolak-balik jaringan (~170-600 ms
   * tergantung lokasi server). Kalau query dipecah jadi beberapa fase berurutan,
   * latensi fase-fase itu saling ditumpuk dan TTFB halaman jadi jauh lebih
   * lambat. Semua kebutuhan dashboard ini diambil dalam SATU `Promise.all`.
   *
   * 4 angka utama: count/aggregate dihitung di memory dari baris yang sudah
   * diambil, jadi tidak perlu query `head: true` terpisah untuk menghitung
   * jumlah toko. KOLOM yang diambil sengaja hanya kolom agregat supaya payload
   *-nya tetap kecil walaupun jumlah toko bertambah.
   */
  const [agregatStore, keyAktif, terbaru, salesRaw] = await Promise.all([
    db.from('admin_stores').select('total_terjual, sisa_kuota, komisi_total'),
    /*
     * "Estimasi komisi" = 20% x harga produk acuan, dari key yang SUDAH AKTIF.
     *
     * Query ini menggantikan "Komisi Pending" yang dulu menjumlahkan komisi
     * key yang belum dipakai. Bedanya bukan soal rumus, tapi soal arti: komisi
     * pending menghitung key yang belum terjual sama sekali, sehingga
     *ashboard menampilkan angka komisi besar padahal belum ada satu rupiah pun
     * yang masuk.
     *
     * `harga_produk_acuan` sudah dihitung di view `admin_keys` (harga sesuai
     * jenis lisensi: sekali bayar atau langganan/tahun), jadi di sini hanya
     * `harga_produk_acuan` yang diambil — bukan `produk_id`, `pilihan`, atau
     * harga mentahnya.
     */
    db.from('admin_keys').select('harga_produk_acuan').eq('status', 'active'),
    db
      .from('admin_stores')
      .select(KOLOM_STORE)
      .order('created_at', { ascending: false })
      .limit(6),
    db
      .from('admin_keys')
      .select('created_at, komisi')
      .gte('created_at', sejak7Hari.toISOString()),
  ]);

  const barisStore = agregatStore.data ?? [];
  const totalToko = barisStore.length;
  const totalKeyTerjual = barisStore.reduce((s, r) => s + (r.total_terjual ?? 0), 0);
  const totalKeySisa = barisStore.reduce((s, r) => s + (r.sisa_kuota ?? 0), 0);
  const komisiTotalNilai = barisStore.reduce((s, r) => s + (r.komisi_total ?? 0), 0);

  const { estimasi, tercakup } = hitungEstimasiKomisi(keyAktif.data ?? []);

  // Rakit deret 7 hari (hari tanpa key tetap ada, nilainya 0) supaya
  // spacing chart-nya evenly spaced.
  const sales: SalesPoint[] = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(sejak7Hari);
    d.setDate(sejak7Hari.getDate() + i);
    const kunci = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const hariIni = (salesRaw.data ?? []).filter((r) => {
      const rd = new Date(r.created_at);
      const rkunci = `${rd.getFullYear()}-${String(rd.getMonth() + 1).padStart(2, '0')}-${String(rd.getDate()).padStart(2, '0')}`;
      return rkunci === kunci;
    });

    sales.push({
      tanggal: kunci,
      label: hariSingkat(d),
      jumlah: hariIni.length,
      komisi: hariIni.reduce((s, r) => s + (r.komisi ?? 0), 0),
    });
  }

  return {
    summary: {
      totalToko,
      totalKeyTerjual,
      totalKeySisa,
      estimasiKomisi: estimasi,
      komisiTotal: komisiTotalNilai,
      keyAktifBer_acuan: tercakup,
    },
    stores: (terbaru.data ?? []) as Store[],
    sales,
  };
});

/* ------------------------------------------------------------------ */
/* Toko                                                               */
/* ------------------------------------------------------------------ */

export const getStores = cache(async (limit = 500): Promise<Store[]> => {
  await wajibAdmin();

  if (demoAktif) return demoStores().slice(0, limit);

  const db = createAdminClient();

  const { data, error } = await db
    .from('admin_stores')
    .select(KOLOM_STORE)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Gagal memuat toko: ${error.message}`);
  return (data ?? []) as Store[];
});

/** Kolom yang boleh dicari dari kotak "Cari toko". */
const KOLOM_CARI_STORE = ['nama_toko', 'email', 'no_hp', 'alamat', 'tier'] as const;

export type ParamsToko = {
  q?: string;
  page?: number;
  perPage?: number;
};

export type HasilToko = {
  stores: Store[];
  total: number;
  page: number;
  perHalaman: number;
  totalHalaman: number;
};

/**
 * Daftar toko untuk halaman /toko — dengan pencarian + paginasi.
 *
 * Mirip `getKeys`: filter & paging dikerjakan DI SERVER lewat URL, jadi baris
 * yang ditampilkan di-hydrate sekecil mungkin dan URL bisa di-share. Pencarian
 * memakai `ilike` (tanpa kasus) di 5 kolom; `q` dibersihkan dulu lewat
 * `bersihkanCari` supaya tidak mengubah struktur query PostgREST.
 */
export const getStoresPaged = cache(async (params: ParamsToko = {}): Promise<HasilToko> => {
  await wajibAdmin();

  const perHalaman = Math.min(Math.max(Math.trunc(params.perPage ?? PER_HALAMAN), 1), 50);
  let page = Math.max(1, Math.trunc(params.page ?? 1));
  const q = bersihkanCari(params.q ?? '');

  if (demoAktif) {
    const semua = demoStores().filter((s) => {
      if (!q) return true;
      return KOLOM_CARI_STORE.some((c) =>
        String(s[c] ?? '').toLowerCase().includes(q.toLowerCase()),
      );
    });
    const totalHalaman = Math.max(1, Math.ceil(semua.length / perHalaman));
    page = Math.min(page, totalHalaman);
    const dari = (page - 1) * perHalaman;
    return {
      stores: semua.slice(dari, dari + perHalaman),
      total: semua.length,
      page,
      perHalaman,
      totalHalaman,
    };
  }

  const db = createAdminClient();

  // Filter pencarian dipasang kondisional: `.or()` dengan nilai kosong akan
  // menambah klausa yang tidak kita mau (mis. `nama_toko=ilike.%`).
  const ambilHalaman = (hal: number) => {
    let qy = db
      .from('admin_stores')
      .select(KOLOM_STORE, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((hal - 1) * perHalaman, hal * perHalaman - 1);
    if (q) qy = qy.or(KOLOM_CARI_STORE.map((c) => `${c}.ilike.%${q}%`).join(','));
    return qy;
  };

  let { data, error, count } = await ambilHalaman(page);

  // PostgREST menjawab HTTP 416 kalau halaman melewati baris terakhir (mis.
  // ?page=99 di URL, atau jumlah toko menyusut). Kondisi normal, bukan error —
  // kita klem ke halaman terakhir yang benar-benar berisi data. Clamp dilakukan
  // di lapisan data (bukan `redirect()` di page) karena halaman punya
  // `loading.tsx`, jadi streaming sudah mulai dan header terkirim duluan.
  if (error && /range not satisfiable/i.test(error.message)) {
    let hitung = db.from('admin_stores').select('id', { count: 'exact', head: true });
    if (q) hitung = hitung.or(KOLOM_CARI_STORE.map((c) => `${c}.ilike.%${q}%`).join(','));

    const totalHitung = (await hitung).count ?? 0;
    const halTerakhir = Math.max(1, Math.ceil(totalHitung / perHalaman));

    if (halTerakhir < page) {
      const ulang = await ambilHalaman(halTerakhir);
      if (!ulang.error) {
        page = halTerakhir;
        data = ulang.data;
        count = ulang.count;
        error = null;
      }
    }

    if (error) {
      return { stores: [], total: 0, page, perHalaman, totalHalaman: 1 };
    }
  }

  if (error) throw new Error(`Gagal memuat toko: ${error.message}`);

  const total = count ?? 0;
  return {
    stores: (data ?? []) as Store[],
    total,
    page,
    perHalaman,
    totalHalaman: Math.max(1, Math.ceil(total / perHalaman)),
  };
});

/** Satu toko + riwayat top up-nya. */
export const getStoreDetail = cache(async (id: string): Promise<{
  store: Store | null;
  keys: Key[];
  topups: TopupHistory[];
}> => {
  await wajibAdmin();

  if (demoAktif) {
    return {
      store: demoCariStore(id),
      keys: demoKeysToko(id),
      topups: demoTopupsToko(id),
    };
  }

  const db = createAdminClient();

  const [store, keys, topups] = await Promise.all([
    db.from('admin_stores').select(KOLOM_STORE).eq('id', id).maybeSingle(),
    db
      .from('admin_keys')
      .select(KOLOM_KEY)
      .eq('store_id', id)
      .order('created_at', { ascending: false })
      .limit(200),
    db
      .from('topup_history')
      .select('id, store_id, jumlah, sisa_quota, admin_by, catatan, created_at')
      .eq('store_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  return {
    store: (store.data ?? null) as Store | null,
    keys: (keys.data ?? []) as Key[],
    topups: (topups.data ?? []) as TopupHistory[],
  };
});

/* ------------------------------------------------------------------ */
/* Key global                                                         */
/* ------------------------------------------------------------------ */

/** Jumlah baris per halaman untuk daftar key. Batas atas 50 (lihat `getKeys`). */
export const PER_HALAMAN = 20;

/** Kolom yang boleh dicari dari kotak "Cari key". */
const KOLOM_CARI_KEY = [
  'serial_key',
  'nama_pembeli',
  'nama_toko',
  'telepon',
  'alamat_pembeli',
] as const;

/**
 * Bersihkan kata kunci sebelum masuk ke filter `.or()`.
 *
 * PENTING: `or()` dirakit jadi string query PostgREST, jadi `,` `(` `)` di
 * dalam input user bisa mengubah strukturnya (mis. membuatOR kedua yang
 * tidak SHOULD). Jadi semua karakter yang punya arti khusus di PostgREST
 * dibuang, bukan cuma di-escape. Panjang juga dibatasi supaya query tidak
 * jadi ridiculously panjang.
 */
function bersihkanCari(q: string): string {
  return q
    .replace(/[,()%*"'\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

/**
 * Jumlah key per status untuk seluruh tabel, bukan cuma halaman yang sedang
 * dibuka. Dipakai ringkasan di header /keys.
 *
 * `head: true` = PostgREST hanya menghitung, tidak mengirim baris sama sekali,
 * jadi murah walau tabelnya besar. Dipanggil paralel.
 */
export const getRingkasanKey = cache(async (): Promise<Record<LicenseStatus, number>> => {
  if (demoAktif) {
    const semua = demoKeys();
    return {
      unused: semua.filter((k) => k.status === 'unused').length,
      active: semua.filter((k) => k.status === 'active').length,
      blocked: semua.filter((k) => k.status === 'blocked').length,
      revoked: semua.filter((k) => k.status === 'revoked').length,
    };
  }

  const db = createAdminClient();
  const statuses: LicenseStatus[] = ['unused', 'active', 'blocked', 'revoked'];
  const hasil = await Promise.all(
    statuses.map((s) =>
      db.from('admin_keys').select('id', { count: 'exact', head: true }).eq('status', s),
    ),
  );

  return statuses.reduce(
    (acc, s, i) => ({ ...acc, [s]: hasil[i]?.count ?? 0 }),
    {} as Record<LicenseStatus, number>,
  );
});

export type ParamsKey = {
  q?: string;
  status?: LicenseStatus | 'semua';
  page?: number;
  perPage?: number;
};

export type HasilKey = {
  keys: Key[];
  total: number;
  page: number;
  perHalaman: number;
  totalHalaman: number;
};

export const getKeys = cache(async (params: ParamsKey = {}): Promise<HasilKey> => {
  await wajibAdmin();

  // 20 per halaman; 50 = plafon keras supaya tidak pernah menarik ratusan baris.
  const perHalaman = Math.min(Math.max(Math.trunc(params.perPage ?? PER_HALAMAN), 1), 50);
  let page = Math.max(1, Math.trunc(params.page ?? 1));
  const status = params.status ?? 'semua';
  const q = bersihkanCari(params.q ?? '');

  if (demoAktif) {
    const semua = demoKeys().filter((k) => {
      if (status !== 'semua' && k.status !== status) return false;
      if (!q) return true;
      return KOLOM_CARI_KEY.some((c) => String(k[c] ?? '').toLowerCase().includes(q.toLowerCase()));
    });
    const totalHalaman = Math.max(1, Math.ceil(semua.length / perHalaman));
    page = Math.min(page, totalHalaman);
    const dari = (page - 1) * perHalaman;
    return {
      keys: semua.slice(dari, dari + perHalaman),
      total: semua.length,
      page,
      perHalaman,
      totalHalaman,
    };
  }

  const db = createAdminClient();

  // Filter status & pencarian sengaja dipasang secara kondisional: `.eq()` /
  // `.or()` dengan nilai kosong akan menambah klausa yang tidak kita mau
  // (mis. `status=eq.` kalau status kosong).
  const ambilHalaman = (hal: number) => {
    let qy = db
      .from('admin_keys')
      .select(KOLOM_KEY, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((hal - 1) * perHalaman, hal * perHalaman - 1);
    if (status !== 'semua') qy = qy.eq('status', status);
    if (q) qy = qy.or(KOLOM_CARI_KEY.map((c) => `${c}.ilike.%${q}%`).join(','));
    return qy;
  };

  let { data, error, count } = await ambilHalaman(page);

  // PostgREST menjawab "Requested range not satisfiable" (HTTP 416), bukan array
  // kosong, kalau halaman yang diminta melewati baris terakhir — mis. `?page=99`
  // di URL atau jumlah kunci yang menyusut. Itu kondisi normal, bukan kegagalan.
  //
  // Di sini kita KLEM ke halaman terakhir yang benar-benar berisi data. clamp
  // dilakukan di lapisan data, bukan dengan `redirect()` di page: halaman /keys
  // punya `loading.tsx`, jadi Next sudah mulai streaming dan header terkirim
  // duluan — `redirect()` tidak lagi bisa mengirim 307 dan hasilnya halamannya
  // kosong. Query tambahan ini hanya jalan di kasus langka ini.
  if (error && /range not satisfiable/i.test(error.message)) {
    let hitung = db.from('admin_keys').select('id', { count: 'exact', head: true });
    if (status !== 'semua') hitung = hitung.eq('status', status);
    if (q) hitung = hitung.or(KOLOM_CARI_KEY.map((c) => `${c}.ilike.%${q}%`).join(','));

    const totalHitung = (await hitung).count ?? 0;
    const halTerakhir = Math.max(1, Math.ceil(totalHitung / perHalaman));

    if (halTerakhir < page) {
      const ulang = await ambilHalaman(halTerakhir);
      if (!ulang.error) {
        page = halTerakhir;
        data = ulang.data;
        count = ulang.count;
        error = null;
      }
    }

    // Masih 416 (mis. tidak ada data sama sekali) -> kunci jawaban kosong.
    if (error) {
      return { keys: [], total: 0, page, perHalaman, totalHalaman: 1 };
    }
  }

  if (error) throw new Error(`Gagal memuat key: ${error.message}`);

  const total = count ?? 0;
  return {
    keys: (data ?? []) as Key[],
    total,
    page,
    perHalaman,
    totalHalaman: Math.max(1, Math.ceil(total / perHalaman)),
  };
});

/* ------------------------------------------------------------------ */
/* Katalog produk                                                      */
/* ------------------------------------------------------------------ */

/**
 * Daftar produk untuk halaman `/produk`, terbaru dulu.
 *
 * Tidak dipaginasi. Katalog produk sengaja jauh lebih kecil daripada daftar
 * toko atau key (satu baris per jenis aplikasi yang dijual), jadi seluruhnya
 * muat di satu layar dan pagination di sini hanya menambah rumit tanpa
 * manfaat.
 *
 * Kolom yang diambil sudah lewat `KOLOM_PRODUK`, bukan `select *`, supaya
 * kolom database yang ditambahkan belakangan tidak ikut terbawa diam-diam.
 */
export const getProduk = cache(async (): Promise<Produk[]> => {
  await wajibAdmin();

  if (demoAktif) return demoProduk();

  const db = createAdminClient();
  const { data, error } = await db
    .from('produk')
    .select(KOLOM_PRODUK)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Gagal memuat produk: ${error.message}`);
  return (data ?? []) as Produk[];
});

export type HasilSimpanProduk =
  | { ok: true; produk: Produk }
  | { ok: false; error: string };

/**
 * Simpan produk baru atau ubah produk yang sudah ada.
 *
 * `id` kosong = tambah, `id` terisi = ubah. Satu fungsi untuk dua keperluan
 * supaya validasi dan pembersihan input tidak pernah bisa berbeda antara
 * "tambah" dan "edit".
 *
 * Validasi memakai `produkError()` yang sama dengan form di browser. Ini bukan
 * pengulangan yang sia-sia: harga negatif atau nama kosong yang lolos ke
 * database akan langsung merusak angka "Estimasi Komisi".
 */
export const simpanProduk = cache(
  async (id: string | null, mentah: unknown): Promise<HasilSimpanProduk> => {
    await wajibAdmin();

    const p = rapikanProduk(
      (mentah ?? {}) as {
        nama_apariksi?: unknown;
        harga_sekali_bayar?: unknown;
        harga_langganan_tahunan?: unknown;
        deskripsi?: unknown;
      },
    );

    const err = produkError(p);
    if (err) return { ok: false, error: err };

    if (demoAktif) {
      if (id) {
        const berubah = demoPatchProduk(id, p as ProdukInput);
        if (!berubah) return { ok: false, error: 'Produk tidak ditemukan.' };
        return { ok: true, produk: berubah };
      }
      return { ok: true, produk: demoBuatProduk(p) };
    }

    const db = createAdminClient();

    if (id) {
      const { data, error } = await db
        .from('produk')
        .update({
          nama_apariksi: p.nama_apariksi,
          harga_sekali_bayar: p.harga_sekali_bayar,
          harga_langganan_tahunan: p.harga_langganan_tahunan,
          deskripsi: p.deskripsi,
        })
        .eq('id', id)
        .select(KOLOM_PRODUK)
        .maybeSingle();

      if (error) return { ok: false, error: `Gagal menyimpan produk: ${error.message}` };
      if (!data) return { ok: false, error: 'Produk tidak ditemukan.' };
      return { ok: true, produk: data as Produk };
    }

    const { data, error } = await db
      .from('produk')
      .insert({
        nama_apariksi: p.nama_apariksi,
        harga_sekali_bayar: p.harga_sekali_bayar,
        harga_langganan_tahunan: p.harga_langganan_tahunan,
        deskripsi: p.deskripsi,
      })
      .select(KOLOM_PRODUK)
      .single();

    if (error) return { ok: false, error: `Gagal menyimpan produk: ${error.message}` };
    return { ok: true, produk: data as Produk };
  },
);

/**
 * Hapus satu produk dari katalog.
 *
 * `licenses.produk_id` memakai `on delete set null`, jadi key yang sudah
 * terjual tidak ikut terhapus. Yang hilang adalah acuan harganya: key itu
 * menyumbang 0 ke estimasi komisi sampai ditautkan ke produk lain.
 *
 * Return jumlah key yang kehilangan acuan supaya UI bisa memperingatkan
 * konsekuensinya, bukan hanya melaporkan "berhasil".
 */
export const hapusProduk = cache(
  async (id: string): Promise<{ ok: true; nama: string; kehilangan: number } | { ok: false; error: string }> => {
    await wajibAdmin();

    if (demoAktif) {
      const hasil = demoHapusProduk(id);
      if (!hasil) return { ok: false, error: 'Produk tidak ditemukan.' };
      return { ok: true, nama: hasil.nama, kehilangan: hasil.kehilangan };
    }

    const db = createAdminClient();

    // Hitung dulu berapa key yang memakai produk ini, supaya pesan konsekuensi
    // yang ditampilkan ke admin akurat meski penghapusannya sendiri berhasil.
    const { count } = await db
      .from('admin_keys')
      .select('id', { count: 'exact', head: true })
      .eq('produk_id', id);

    const { data, error } = await db
      .from('produk')
      .delete()
      .eq('id', id)
      .select('nama_apariksi')
      .maybeSingle();

    if (error) return { ok: false, error: `Gagal menghapus produk: ${error.message}` };
    if (!data) return { ok: false, error: 'Produk tidak ditemukan.' };

    return { ok: true, nama: data.nama_apariksi as string, kehilangan: count ?? 0 };
  },
);
