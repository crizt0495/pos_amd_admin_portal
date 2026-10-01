import 'server-only';

import { cache } from 'react';

import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/supabase/guard';
import { hariSingkat, tanggalPendek } from '@/lib/format';
import type { DashboardSummary, Key, SalesPoint, Store, TopupHistory } from '@/types';

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
  'id, serial_key, store_id, nama_toko, nama_pembeli, telepon, alamat_pembeli, paket, pilihan, komisi, tier, tier_rate, status, hwid_locked, device_name, activated_at, expires_at, created_at';

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
  const db = createAdminClient();

  // 4 angka utama. Count/aggregate di DB, bukan ambil semua baris ke memory.
  const [toko, terjual, sisa, komisiPending, komisiTotal] = await Promise.all([
    db.from('admin_stores').select('id', { count: 'exact', head: true }),
    db.from('admin_stores').select('total_terjual'),
    db.from('admin_stores').select('sisa_kuota'),
    // "Komisi pending" = komisi dari key yang BELUM dipakai pembeli
    // (status belum 'active'), yaitu uang yang sudah tercatat tapi belum cair.
    db
      .from('admin_keys')
      .select('komisi, status')
      .in('status', ['unused', 'blocked', 'revoked']),
    db.from('admin_stores').select('komisi_total'),
  ]);

  const totalToko = toko.count ?? 0;
  const totalKeyTerjual = (terjual.data ?? []).reduce((s, r) => s + (r.total_terjual ?? 0), 0);
  const totalKeySisa = (sisa.data ?? []).reduce((s, r) => s + (r.sisa_kuota ?? 0), 0);
  const komisiPendingNilai = (komisiPending.data ?? []).reduce((s, r) => s + (r.komisi ?? 0), 0);
  const komisiTotalNilai = (komisiTotal.data ?? []).reduce((s, r) => s + (r.komisi_total ?? 0), 0);

  // 7 hari terakhir, termasuk hari ini (timezone server).
  const sejak7Hari = new Date();
  sejak7Hari.setHours(0, 0, 0, 0);
  sejak7Hari.setDate(sejak7Hari.getDate() - 6);

  const [terbaru, salesRaw] = await Promise.all([
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
      komisiPending: komisiPendingNilai,
      komisiTotal: komisiTotalNilai,
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
  const db = createAdminClient();

  const { data, error } = await db
    .from('admin_stores')
    .select(KOLOM_STORE)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Gagal memuat toko: ${error.message}`);
  return (data ?? []) as Store[];
});

/** Satu toko + riwayat top up-nya. */
export const getStoreDetail = cache(async (id: string): Promise<{
  store: Store | null;
  keys: Key[];
  topups: TopupHistory[];
}> => {
  await wajibAdmin();
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

export const getKeys = cache(
  async (limit = 500): Promise<{ keys: Key[]; total: number }> => {
    await wajibAdmin();
    const db = createAdminClient();

    const { data, error, count } = await db
      .from('admin_keys')
      .select(KOLOM_KEY, { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Gagal memuat key: ${error.message}`);
    return { keys: (data ?? []) as Key[], total: count ?? 0 };
  },
);
