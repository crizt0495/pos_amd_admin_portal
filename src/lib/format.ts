/** Format angka & tanggal gaya Indonesia. */

const ANGKA = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** "Rp. 500.000" — format lengkap. */
export function rupiah(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 'Rp. 0';
  return `Rp. ${ANGKA.format(n)}`;
}

/** Versi ringkas untuk kartu statistik: 1.250.000 -> "Rp. 1,25jt". */
export function rupiahRingkas(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 'Rp. 0';
  if (Math.abs(n) >= 1_000_000_000) {
    return `Rp. ${(n / 1_000_000_000).toFixed(2).replace('.', ',')}M`;
  }
  if (Math.abs(n) >= 1_000_000) return `Rp. ${(n / 1_000_000).toFixed(2).replace('.', ',')}jt`;
  if (Math.abs(n) >= 1_000) return `Rp. ${ANGKA.format(Math.round(n / 1_000))}rb`;
  return rupiah(n);
}

/** Angka biasa dengan pemisah ribuan: 12500 -> "12.500". */
export function angka(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0';
  return ANGKA.format(n);
}

/** Angka ringkas untuk kartu statistik: 12500 -> "12,5rb". */
export function angkaRingkas(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')}jt`;
  if (Math.abs(n) >= 1_000) return `${ANGKA.format(Math.round(n / 1_000))}rb`;
  return ANGKA.format(n);
}

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const HARI_SINGKAT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const BULAN = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

/** "12 Okt 2026" */
export function tanggalPendek(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

/** "12 Okt 2026, 14:32" */
export function tanggalWaktu(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  const jam = String(d.getHours()).padStart(2, '0');
  const menit = String(d.getMinutes()).padStart(2, '0');
  return `${tanggalPendek(d)}, ${jam}:${menit}`;
}

/** "Sen" — untuk sumbu chart. */
export function hariSingkat(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return HARI_SINGKAT[d.getDay()] ?? '-';
}

/** "Senin, 12 Oktober 2026" */
export function tanggalPanjang(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

/** Label relatif ringkas: "baru saja", "5 menit lalu", "3 hari lalu". */
export function sejak(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '-';

  const detik = Math.floor((Date.now() - d.getTime()) / 1000);
  if (detik < 60) return 'baru saja';
  const menit = Math.floor(detik / 60);
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  const hari = Math.floor(jam / 24);
  if (hari < 30) return `${hari} hari lalu`;
  const bulan = Math.floor(hari / 30);
  if (bulan < 12) return `${bulan} bulan lalu`;
  return `${Math.floor(bulan / 12)} tahun lalu`;
}

/** Ambil 4 karakter terakhir email, buat avatar inisial. */
export function inisial(email: string | null | undefined): string {
  const s = (email ?? '').trim();
  if (!s) return 'A';
  const nama = s.split('@')[0] ?? s;
  return (nama[0] ?? 'A').toUpperCase();
}

/** Buang semua karakter selain digit. */
export function hanyaDigit(s: string): string {
  return s.replace(/\D/g, '');
}
