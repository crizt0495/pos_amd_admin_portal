import { jsonGagal, jsonOk, wajibAdmin } from '@/lib/api-guard';
import { demoAktif } from '@/lib/demo/config';
import { demoPerpanjangKey } from '@/lib/demo/data';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

/**
 * POST /api/keys/[id]/perpanjang — perpanjang key LANGGANAN +1 tahun.
 *
 * Ini yang mencet ADMIN (menu Key). Toko tidak punya tombol ini — di portal
 * toko bagian Riwayat Komisi Langganan sekarang murni informasi.
 *
 * Semua angka dihitung di SQL dari DB: harga acuan dari
 * `produk.harga_langganan_tahunan`, komisi = 5% dari harga acuan. Client
 * tidak mengirim nominal apa pun, jadi tidak bisa dipalsukan.
 */
export async function POST(_req: Request, { params }: Ctx) {
  const admin = await wajibAdmin();
  if (admin.error) return admin.error;

  if (demoAktif) {
    const hasil = demoPerpanjangKey(params.id);
    if (!hasil) return jsonGagal('Key tidak ditemukan atau bukan langganan.', 404);
    return jsonOk(
      `Langganan diperpanjang +12 bulan (1 tahun). Komisi Rp ${hasil.komisi.toLocaleString('id-ID')} tercatat.`,
      hasil,
    );
  }

  const db = createAdminClient();
  const { data, error } = await db.rpc('admin_perpanjang_langganan', {
    p_key_id: params.id,
  });

  if (error) {
    const msg = error.message ?? '';
    if (msg.includes('Key tidak ditemukan')) return jsonGagal('Key tidak ditemukan.', 404);
    if (msg.includes('NOT_SUBSCRIPTION')) {
      return jsonGagal('Key ini bukan langganan, jadi tidak bisa diperpanjang.', 400);
    }
    return jsonGagal(error.message || 'Gagal memperpanjang key.', 400);
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { expires_at?: string; komisi?: number }
    | undefined;
  const komisi = Number(row?.komisi ?? 0);

  return jsonOk(
    `Langganan diperpanjang +12 bulan (1 tahun). Komisi Rp ${komisi.toLocaleString('id-ID')} tercatat.`,
    { expires_at: row?.expires_at ?? null, komisi },
  );
}
