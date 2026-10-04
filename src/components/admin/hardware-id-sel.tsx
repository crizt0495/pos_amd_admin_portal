import { rapikanTampil, uuidV4 } from '@/lib/hardware';

import { HwidSalin } from './key-aksi';

/**
 * ============================================================================
 *  HARDWARE ID  —  Server Component
 * ============================================================================
 *
 * Menampilkan Hardware ID secara PENUH. Tidak ada `truncate`, tidak ada
 * `line-clamp`, dan tidak ada `title` yang jadi satu-satunya jalan melihat nilai
 * ini.
 *
 * Kenapa ini penting: Hardware ID adalah satu-satunya nilai di daftar key yang
 * admin kutip ke tiket saat pembeli komplain "key-nya tidak jalan di komputer
 * baru". Kalau nilainya terpotong di layar, admin akan menyalin HWID yang salah,
 * lalu key tetap tidak bisa dipakai di komputer yang benar — dan dari luar
 * terlihat seperti key-nya rusak.
 *
 * Server Component (bukan island): isinya teks statis. Yang jadi island hanya
 * tombol salin, dan itu island kecil di `key-aksi.tsx`.
 *
 * Di DALAM baris ini tidak ada paragraf penjelasan. Di `/keys` ada 20 baris per
 * halaman dan hampir semuanya punya HWID, jadi penjelasan per baris akan berubah
 * jadi bising dan menutupi kolom lain. Penjelasan lengkapnya (`CATATAN_HWID`)
 * ditulis sekali di halaman detail toko.
 */
export function HardwareId({
  hwid,
  deviceName,
}: {
  hwid: string;
  deviceName?: string | null;
}) {
  const nilai = rapikanTampil(hwid);
  const perangkat = rapikanTampil(deviceName ?? '');
  const bukanUuid = !uuidV4(nilai);

  return (
    <div className="min-w-0">
      <div className="flex items-start gap-1">
        {/*
         * `break-all` wajib, bukan `break-words`: UUID tidak punya spasi sama
         * sekali, jadi `break-words` tidak punya opportunities untuk memotong,
         * dan string 36 karakter akan meluber keluar sel.
         */}
        <span className="min-w-0 break-all font-mono text-[11px] leading-snug text-zinc-500">
          {nilai}
        </span>
        <HwidSalin hwid={nilai} />
      </div>

      <p className="mt-0.5 text-[11px] text-zinc-500">
        terkunci ke {perangkat || 'perangkat tanpa nama'}
      </p>

      {/*
       * Nilai di luar pola UUID v4 tetap ditampilkan utuh — memotongnya justru
       * membuat admin salah baca — tapi diberi penanda. Penandanya satu baris,
       * dengan penjelasan penuh di `title` supaya tabel tidak melebar.
       */}
      {bukanUuid ? (
        <p
          className="mt-1 inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-800"
          title={
            'Nilai ini bukan UUID v4. Kalau pembeli mengeluh key tidak jalan di ' +
            'komputer lain, periksa versi aplikasi POS AMD di perangkatnya.'
          }
        >
          bukan UUID v4
        </p>
      ) : null}
    </div>
  );
}
