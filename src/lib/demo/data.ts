import 'server-only';

import { hariSingkat } from '@/lib/format';
import { tierOf } from '@/lib/tier';
import type {
  DashboardSummary,
  Key,
  LicenseStatus,
  LicenseType,
  PaketType,
  SalesPoint,
  Store,
  TopupHistory,
  TopupResult,
} from '@/types';

/**
 * =============================================================================
 *  DATA DEMO — in-memory, kembali ke awal setiap `npm run dev` di-restart
 * =============================================================================
 *
 * Sengaja meniru bentuk baris dari view `admin_stores` / `admin_keys` supaya
 * komponen UI tidak perlu tahu-menahu soal mode demo: tidak ada branching di
 * komponen, hanya di `lib/data.ts` dan Route Handler.
 *
 * Tier & komisi DIHITUNG pakai `tierOf()`, sama seperti aslinya — bukan angka
 * tebakan. Kalau `TIER_RULES` nanti berubah, angka demo ikut berubah.
 */

const HARGA: Record<PaketType, number> = { bundle: 250_000, app_only: 150_000 };

const PEMBELI = [
  'Warung Bu Imas',
  'Kedai Kopi Senja',
  'Bengkel Pak Hadi',
  'Laundry Kilat',
  'Toko Berkah Jaya',
  'Apotek Sehat',
  'Kantin SDN 3',
  'Barbershop Manggala',
  'Toko Sembako Rejeki',
  'Rumah Makan Padang Sederhana',
  'Butik Batik Anindya',
  'Konter Pulsa Cells',
];

const ALAMAT_PEMBELI = [
  'Jl. Melati No. 12, Bandung',
  'Jl. Kenanga No. 4, Semarang',
  'Jl. Rajawali No. 88, Surabaya',
  'Jl. Kenanga No. 45, Yogyakarta',
];

interface Seed {
  nama: string;
  email: string;
  username: string;
  no_hp: string;
  alamat: string;
  terjual: number;
  kuota: number;
  status: 'active' | 'suspended';
  umurHari: number;
}

const SEEDS: Seed[] = [
  { nama: 'Toko Berkah Jaya', email: 'berkah@example.com', username: 'berkah', no_hp: '081234567890', alamat: 'Jl. Pasar Baru No. 21, Bandung', terjual: 34, kuota: 12, status: 'active', umurHari: 96 },
  { nama: 'Warung Bu Imas', email: 'imas@example.com', username: 'buimas', no_hp: '081298765432', alamat: 'Jl. Melati No. 4, Semarang', terjual: 12, kuota: 5, status: 'active', umurHari: 64 },
  { nama: 'Bengkel Pak Hadi', email: 'hadi@example.com', username: 'pakhadi', no_hp: '085711223344', alamat: 'Jl. Industri No. 17, Bekasi', terjual: 7, kuota: 3, status: 'active', umurHari: 41 },
  { nama: 'Laundry Kilat', email: 'laundry@example.com', username: 'kilat', no_hp: '081377889900', alamat: 'Jl. Kenanga No. 4, Yogyakarta', terjual: 5, kuota: 8, status: 'active', umurHari: 30 },
  { nama: 'Apotek Sehat', email: 'apotek@example.com', username: 'apoteksehat', no_hp: '081200011122', alamat: 'Jl. Ijen No. 9, Malang', terjual: 23, kuota: 0, status: 'active', umurHari: 120 },
  { nama: 'Konter Pulsa Cells', email: 'cells@example.com', username: 'cells', no_hp: '081233445566', alamat: 'Jl. Rajawali No. 88, Surabaya', terjual: 3, kuota: 2, status: 'suspended', umurHari: 18 },
  { nama: 'Kantin SDN 3', email: 'kantin@example.com', username: 'kantinsdn3', no_hp: '081355667788', alamat: 'Jl. Cendana No. 1, Bandung', terjual: 9, kuota: 6, status: 'active', umurHari: 55 },
  { nama: 'Toko Sembako Rejeki', email: 'rejeki@example.com', username: 'rejeki', no_hp: '081244556677', alamat: 'Jl. Minang No. 15, Padang', terjual: 2, kuota: 4, status: 'active', umurHari: 9 },
];

const stores: Store[] = [];
const keys: Key[] = [];
const topups: TopupHistory[] = [];
let seqKey = 1;
let seqTopup = 1;

/* ------------------------------------------------------------------ */
/* Generator                                                           */
/* ------------------------------------------------------------------ */

function isoHariLalu(hari: number): string {
  const d = new Date();
  d.setHours(9, 30, 0, 0);
  d.setDate(d.getDate() - hari);
  return d.toISOString();
}

/** Serial mirip format asli: awalan KSP- lalu 4 blok huruf-angka. */
function serialKe(n: number): string {
  const blok = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = 'KSP-';
  for (let b = 0; b < 4; b += 1) {
    if (b > 0) out += '-';
    let s = '';
    for (let i = 0; i < 4; i += 1) s += blok[(n * 31 + i * 17 + b * 7) % blok.length]!;
    out += s;
  }
  return out;
}

function teleponKe(idx: number): string {
  return `081${String(200_000_000 + ((idx + 1) * 7_919 + idx * 104_729) % 799_999_999).slice(0, 9)}`;
}

/** Status keyagger untuk tiap store — sengaja disebar supaya SEMUA filter status ada isi. */
function statusKey(i: number): LicenseStatus {
  if (i % 23 === 7) return 'revoked';
  if (i % 17 === 5) return 'blocked';
  if (i % 9 === 4) return 'unused';
  return 'active';
}

function seedUlang(): void {
  stores.length = 0;
  keys.length = 0;
  topups.length = 0;
  seqKey = 1;
  seqTopup = 1;

  SEEDS.forEach((seed, idx) => {
    const id = `demo-toko-${idx + 1}`;
    const tier = tierOf(seed.terjual);

    stores.push({
      id,
      user_id: `demo-user-${idx + 1}`,
      nama_toko: seed.nama,
      email: seed.email,
      username: seed.username,
      no_hp: seed.no_hp,
      alamat: seed.alamat,
      tier: tier.name,
      total_terjual: seed.terjual,
      sisa_kuota: seed.kuota,
      komisi_total: 0,
      is_active: seed.status === 'active',
      status: seed.status,
      created_at: isoHariLalu(seed.umurHari),
      updated_at: isoHariLalu(Math.min(seed.umurHari, 6)),
    });

    // Key tersebar di rentang hari terbaru supaya chart 7 hari punya isi.
    const rentang = Math.min(seed.umurHari, 9);
    for (let i = 0; i < seed.terjual; i += 1) {
      const hariLalu = Math.max(0, Math.floor((i * rentang) / Math.max(1, seed.terjual)));
      const paket: PaketType = i % 3 === 0 ? 'app_only' : 'bundle';
      const pilihan: LicenseType = i % 4 === 0 ? 'langganan' : 'sekali';
      const komisi = Math.round(HARGA[paket] * tier.rate);
      const status = statusKey(i);
      const hidup = status === 'active';

      keys.push({
        id: `demo-key-${seqKey}`,
        serial_key: serialKe(seqKey * 137),
        store_id: id,
        nama_toko: seed.nama,
        nama_pembeli: PEMBELI[(idx + i) % PEMBELI.length]!,
        telepon: teleponKe(idx * 97 + i),
        alamat_pembeli: ALAMAT_PEMBELI[(idx + i) % ALAMAT_PEMBELI.length]!,
        paket,
        pilihan,
        komisi,
        tier: tier.name,
        tier_rate: tier.rate,
        status,
        hwid_locked: hidup ? `HWID-${1000 + seqKey}` : null,
        device_name: hidup ? `PC-KASIR-${(idx % 4) + 1}` : null,
        activated_at: hidup ? isoHariLalu(Math.max(0, hariLalu - 1)) : null,
        expires_at: pilihan === 'langganan' ? isoHariLalu(-365) : null,
        created_at: isoHariLalu(hariLalu),
      });
      seqKey += 1;
    }

    // 1-2 riwayat top up per toko supaya halaman detail toko tidak kosong.
    const jumlahTopup = (idx % 2) + 1;
    for (let t = 0; t < jumlahTopup; t += 1) {
      topups.push({
        id: `demo-topup-${seqTopup}`,
        store_id: id,
        jumlah: (t + 1) * 10,
        sisa_quota: seed.kuota,
        admin_by: 'demo@kasirpro.local',
        catatan: t === 0 ? 'Top up awal setelah pendaftaran' : null,
        created_at: isoHariLalu(Math.max(0, seed.umurHari - 20 + t * 7)),
      });
      seqTopup += 1;
    }
  });

  hitungKomisiTotal();
}

seedUlang();

/** `komisi_total` = akumulasi komisi key yang sudah dipakai (activated_at terisi). */
function hitungKomisiTotal(): void {
  for (const s of stores) {
    s.komisi_total = keys
      .filter((k) => k.store_id === s.id && k.activated_at)
      .reduce((a, k) => a + k.komisi, 0);
  }
}

/* ------------------------------------------------------------------ */
/* Pembacaan                                                           */
/* ------------------------------------------------------------------ */

export function demoStores(): Store[] {
  return stores.map((s) => ({ ...s }));
}

export function demoCariStore(id: string): Store | null {
  const s = stores.find((x) => x.id === id);
  return s ? { ...s } : null;
}

export function demoKeys(): Key[] {
  return keys.map((k) => ({ ...k }));
}

export function demoKeysToko(storeId: string): Key[] {
  return keys
    .filter((k) => k.store_id === storeId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((k) => ({ ...k }));
}

export function demoTopupsToko(storeId: string): TopupHistory[] {
  return topups
    .filter((t) => t.store_id === storeId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((t) => ({ ...t }));
}

export function demoDashboard(): {
  summary: DashboardSummary;
  stores: Store[];
  sales: SalesPoint[];
} {
  hitungKomisiTotal();

  const komisiPending = keys
    .filter((k) => ['unused', 'blocked', 'revoked'].includes(k.status))
    .reduce((a, k) => a + k.komisi, 0);

  // 7 hari terakhir; hari tanpa key tetap ikut (nilai 0) supaya spacing chart rata.
  const mulai = new Date();
  mulai.setHours(0, 0, 0, 0);
  mulai.setDate(mulai.getDate() - 6);

  const sales: SalesPoint[] = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(mulai);
    d.setDate(mulai.getDate() + i);
    const tgl = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const hariIni = keys.filter((k) => {
      const rd = new Date(k.created_at);
      const rkunci = `${rd.getFullYear()}-${String(rd.getMonth() + 1).padStart(2, '0')}-${String(rd.getDate()).padStart(2, '0')}`;
      return rkunci === tgl;
    });

    sales.push({
      tanggal: tgl,
      label: hariSingkat(d),
      jumlah: hariIni.length,
      komisi: hariIni.reduce((a, k) => a + k.komisi, 0),
    });
  }

  return {
    summary: {
      totalToko: stores.length,
      totalKeyTerjual: stores.reduce((a, s) => a + s.total_terjual, 0),
      totalKeySisa: stores.reduce((a, s) => a + s.sisa_kuota, 0),
      komisiPending,
      komisiTotal: stores.reduce((a, s) => a + s.komisi_total, 0),
    },
    stores: [...stores]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 6)
      .map((s) => ({ ...s })),
    sales,
  };
}

/* ------------------------------------------------------------------ */
/* Mutasi — supaya top up di demo benar-benar mengubah angka          */
/* ------------------------------------------------------------------ */

export interface DemoTopupHasil {
  ok: boolean;
  nama_toko: string;
  sisa_kuota: number;
  jumlah_diterapkan: number;
  pesan: string;
}

/** Meniru RPC `admin_topup`: sisa kuota dikunci tidak boleh negatif. */
export function demoTopup(
  storeId: string,
  jumlah: number,
  catatan: string | null,
  adminBy: string,
): DemoTopupHasil {
  const s = stores.find((x) => x.id === storeId);
  if (!s) {
    return {
      ok: false,
      nama_toko: '',
      sisa_kuota: 0,
      jumlah_diterapkan: 0,
      pesan: 'Toko tidak ditemukan.',
    };
  }

  const terapkan = jumlah < 0 ? Math.max(jumlah, -s.sisa_kuota) : jumlah;
  s.sisa_kuota += terapkan;
  s.updated_at = new Date().toISOString();

  topups.unshift({
    id: `demo-topup-${seqTopup}`,
    store_id: s.id,
    jumlah: terapkan,
    sisa_quota: s.sisa_kuota,
    admin_by: adminBy,
    catatan,
    created_at: new Date().toISOString(),
  });
  seqTopup += 1;

  return {
    ok: true,
    nama_toko: s.nama_toko,
    sisa_kuota: s.sisa_kuota,
    jumlah_diterapkan: terapkan,
    pesan: `Sisa ${s.nama_toko}: ${s.sisa_kuota} key.`,
  };
}

export function demoTopupBulk(
  storeIds: string[],
  jumlah: number,
  catatan: string | null,
  adminBy: string,
): TopupResult[] {
  return storeIds.map((id) => {
    const h = demoTopup(id, jumlah, catatan, adminBy);
    return {
      store_id: id,
      nama_toko: h.nama_toko,
      sisa_kuota: h.sisa_kuota,
      ok: h.ok,
      pesan: h.pesan,
    };
  });
}

/** Meniru RPC `admin_revoke_key`: saat dicabut, kunci perangkat dilepas. */
export function demoSetKeyStatus(
  id: string,
  status: LicenseStatus,
): { serial_key: string; status: LicenseStatus } | null {
  const k = keys.find((x) => x.id === id);
  if (!k) return null;
  k.status = status;
  if (status === 'revoked') {
    k.hwid_locked = null;
    k.device_name = null;
    k.activated_at = null;
  }
  hitungKomisiTotal();
  return { serial_key: k.serial_key, status };
}

export function demoPatchStore(id: string, patch: Partial<Store>): Store | null {
  const s = stores.find((x) => x.id === id);
  if (!s) return null;
  // Hanya field yang boleh diubah dari UI — tier & kuota punya jalurnya sendiri.
  const boleh = ['nama_toko', 'email', 'no_hp', 'alamat', 'status'] as const;
  for (const k of boleh) {
    const v = patch[k];
    if (v !== undefined) Object.assign(s, { [k]: v });
  }
  s.is_active = s.status === 'active';
  s.updated_at = new Date().toISOString();
  hitungKomisiTotal();
  return { ...s };
}

export function demoHapusStore(id: string): string | null {
  const idx = stores.findIndex((x) => x.id === id);
  if (idx === -1) return null;
  const nama = stores[idx]!.nama_toko;
  stores.splice(idx, 1);
  for (let i = keys.length - 1; i >= 0; i -= 1) if (keys[i]!.store_id === id) keys.splice(i, 1);
  for (let i = topups.length - 1; i >= 0; i -= 1) if (topups[i]!.store_id === id) topups.splice(i, 1);
  hitungKomisiTotal();
  return nama;
}

export function demoBuatStore(p: {
  nama_toko: string;
  email: string;
  username: string;
  no_hp: string;
  alamat: string;
  kuota_awal: number;
}): Store {
  const stamp = Date.now().toString(36);
  const s: Store = {
    id: `demo-toko-baru-${stamp}`,
    user_id: `demo-user-${stamp}`,
    nama_toko: p.nama_toko,
    email: p.email,
    username: p.username,
    no_hp: p.no_hp,
    alamat: p.alamat,
    tier: 'Bronze',
    total_terjual: 0,
    sisa_kuota: p.kuota_awal,
    komisi_total: 0,
    is_active: true,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  stores.unshift(s);
  hitungKomisiTotal();
  return { ...s };
}

/** Kembalikan data ke kondisi awal (dipakai tombol "Reset data demo"). */
export function demoReset(): void {
  seedUlang();
}