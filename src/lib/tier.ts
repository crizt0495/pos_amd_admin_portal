import type { LicenseStatus, LicenseType, PaketType, TierName } from '@/types';

/**
 * ===========================================================================
 *  ATURAN TIER & KOMISI (cerminan dari portal toko — harus sinkron)
 * ===========================================================================
 *  Bronze   : 1 - 5   lisensi terjual  -> komisi 5%
 *  Silver   : 6 - 10  lisensi terjual  -> komisi 10%
 *  Gold     : 11 - 30 lisensi terjual  -> komisi 20%
 *  Platinum : 30+     lisensi terjual  -> komisi 30%
 *
 *  ⚠️ Sumber kebenaran tier ada di SQL (`tier_name_of()`), karena tier di
 * -hitung dari `partners.total_terjual`. Modul ini hanya untuk tampil label &
 *  warna di UI — kalau suatu saat berbeda, yang menang adalah nilai dari DB.
 * ===========================================================================
 */

export interface TierRule {
  name: TierName;
  min: number;
  max: number | null;
  rate: number;
  /** Warna teks/garis tier. */
  color: string;
  /** Warna latar bulatan. */
  chipBg: string;
  /** Warna latar badge (dipakai di tabel). */
  badgeBg: string;
}

export const TIER_RULES: TierRule[] = [
  {
    name: 'Bronze',
    min: 1,
    max: 5,
    rate: 0.05,
    color: '#a16207',
    chipBg: 'bg-amber-100',
    badgeBg: 'bg-amber-50 text-amber-800',
  },
  {
    name: 'Silver',
    min: 6,
    max: 10,
    rate: 0.1,
    color: '#64748b',
    chipBg: 'bg-gray-100',
    badgeBg: 'bg-gray-100 text-gray-700',
  },
  {
    name: 'Gold',
    min: 11,
    max: 30,
    rate: 0.2,
    color: '#ca8a04',
    chipBg: 'bg-yellow-100',
    badgeBg: 'bg-yellow-50 text-yellow-800',
  },
  {
    name: 'Platinum',
    min: 30,
    max: null,
    rate: 0.3,
    color: '#0f172a',
    chipBg: 'bg-slate-200',
    badgeBg: 'bg-slate-800 text-white',
  },
];

const TIER_BY_NAME = new Map(TIER_RULES.map((t) => [t.name, t]));

/** Aturan tier dari nama tier (untuk lookup warna). Default = Bronze. */
export function tierRule(name: TierName | string | null | undefined): TierRule {
  return TIER_BY_NAME.get(String(name) as TierName) ?? TIER_RULES[0]!;
}

/** Tier toko berdasarkan total lisensi terjual (untuk preview di UI). */
export function tierOf(totalTerjual: number): TierRule {
  const n = Math.max(0, totalTerjual || 0);
  if (n >= 30) return TIER_RULES[3]!;
  if (n >= 11) return TIER_RULES[2]!;
  if (n >= 6) return TIER_RULES[1]!;
  return TIER_RULES[0]!;
}

/** Label rentang tier, contoh: "1 - 5 lisensi" / "30+ lisensi". */
export function tierRangeLabel(tier: TierRule): string {
  return tier.max === null ? `${tier.min}+ lisensi` : `${tier.min} - ${tier.max} lisensi`;
}

export const PAKET_LABEL: Record<PaketType, string> = {
  bundle: 'Bundle',
  app_only: 'Aplikasi',
};

export const PAKET_LABEL_PANJANG: Record<PaketType, string> = {
  bundle: 'Bundle PC + Aplikasi',
  app_only: 'Aplikasi Saja',
};

export const LICENSE_TYPE_LABEL: Record<LicenseType, string> = {
  sekali: 'Sekali Bayar',
  langganan: 'Langganan',
};

/** Label status key yang enak dibaca. */
export const STATUS_LABEL: Record<LicenseStatus, string> = {
  unused: 'Belum Dipakai',
  active: 'Aktif',
  blocked: 'Diblokir',
  revoked: 'Dicabut',
};

/** Kelas Tailwind badge status key. */
export const STATUS_BADGE: Record<LicenseStatus, string> = {
  unused: 'bg-sky-50 text-sky-700',
  active: 'bg-emerald-50 text-emerald-700',
  blocked: 'bg-amber-50 text-amber-800',
  revoked: 'bg-red-50 text-red-700',
};
