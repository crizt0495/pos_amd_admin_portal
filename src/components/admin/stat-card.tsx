import type { LucideIcon } from 'lucide-react';
import { Inbox, KeyRound, Store, Wallet } from 'lucide-react';

import { angkaRingkas, rupiahRingkas } from '@/lib/format';
import { PERSEN_ESTIMASI_KOMISI } from '@/lib/produk';
import { cn } from '@/lib/utils';

export interface StatData {
  label: string;
  nilai: number;
  /** Format angka: rupiah atau angka biasa. */
  format?: 'angka' | 'rupiah';
  sub?: string;
  Icon?: LucideIcon;
  tone?: 'netral' | 'peringatan';
}

/**
 * Kartu statistik dashboard. `format` menentukan gaya angka supaya kartu
 * komisi rupiah tidak memakai pemisah ribuan yang membingungkan.
 */
export function StatCard({ label, nilai, format = 'angka', sub, Icon, tone = 'netral' }: StatData) {
  const teks = format === 'rupiah' ? rupiahRingkas(nilai) : angkaRingkas(nilai);

  return (
    <div
      className={cn(
        'card-soft p-4',
        tone === 'peringatan' && nilai > 0 && 'border-amber-200 bg-amber-50/40',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] font-semibold text-zinc-500">{label}</p>
        {Icon ? <Icon className="h-4 w-4 shrink-0 text-zinc-300" /> : null}
      </div>
      <p className="tabular mt-2 text-[22px] font-bold leading-none text-zinc-900">{teks}</p>
      {sub ? <p className="mt-1.5 text-[12px] text-zinc-500">{sub}</p> : null}
    </div>
  );
}

/**
 * Empat kartu utama sesuai spec dashboard.
 *
 * Kartu keempat adalah "Estimasi Komisi". Semula labelnya "Komisi Pending" dan
 * isinya jumlah komisi dari key yang BELUM dipakai. Angka itu diganti karena
 * bikin salah baca: komisi baru benar-benar masuk setelah key dipakai di
 * komputer kasir, sedangkan kartu lama menjumlahkan key yang belum terjual
 * sama sekali. Sekarang isinya 20% dari harga produk acuan, key `active` saja.
 *
 * "N key aktif" sengaja disebut di sub-teks: estimasi ini HANYA menghitung key
 * yang punya acuan harga produk. Kalau tidak disebut, angka yang turun drastis
 * karena ada key belum tertaut produk akan terlihat seperti penjualan sedang
 * sepi, padahal masalahnya datanya.
 */
export function DashboardStats({
  totalToko,
  totalKeyTerjual,
  totalKeySisa,
  estimasiKomisi,
  keyTercakup,
}: {
  totalToko: number;
  totalKeyTerjual: number;
  totalKeySisa: number;
  estimasiKomisi: number;
  /** Key aktif yang punya acuan harga produk (dasar hitungan estimasi). */
  keyTercakup?: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        label="Total Toko Terdaftar"
        nilai={totalToko}
        Icon={Store}
        sub="akun toko aktif & nonaktif"
      />
      <StatCard
        label="Total Key Terjual"
        nilai={totalKeyTerjual}
        Icon={KeyRound}
        sub="permanen, tidak pernah berkurang"
      />
      <StatCard
        label="Sisa Key Global"
        nilai={totalKeySisa}
        Icon={Inbox}
        sub="kuota yang masih bisa digenerate"
      />
      <StatCard
        label="Estimasi Komisi"
        nilai={estimasiKomisi}
        format="rupiah"
        Icon={Wallet}
        sub={
          keyTercakup !== undefined
            ? `${PERSEN_ESTIMASI_KOMISI * 100}% x harga produk · ${keyTercakup} key aktif`
            : `${PERSEN_ESTIMASI_KOMISI * 100}% x harga produk acuan`
        }
      />
    </div>
  );
}
