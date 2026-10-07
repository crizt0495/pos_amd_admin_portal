'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

/**
 * Tombol "Perpanjang +1 Tahun" — HANYA untuk key bertipe langganan.
 *
 * Island kecil per baris key; yang mencet adalah ADMIN, bukan toko. Harga
 * acuan diambil dari field `harga_produk_acuan` (sudah dihitung SQL dari
 * `produk.harga_langganan_tahunan`), sehingga label komisi tidak pernah
 * ditulis manual di kode.
 */
export function KeyPerpanjang({
  id,
  pilihan,
  hargaAcuan,
}: {
  id: string;
  pilihan: string;
  hargaAcuan: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);

  if (pilihan !== 'langganan') return null;

  const komisiTambahan = Math.round(hargaAcuan * 0.05);

  async function perpanjang() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/keys/${id}/perpanjang`, { method: 'POST' });
      const data = (await res.json()) as { ok: boolean; message: string };
      if (!res.ok || !data.ok) {
        toast.gagal(data.message || 'Gagal memperpanjang key.');
        return;
      }
      toast.sukses(data.message);
      router.refresh();
    } catch {
      toast.gagal('Tidak bisa menghubungi server.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="outline" loading={busy} disabled={busy} onClick={perpanjang}>
      Perpanjang +1 Tahun{hargaAcuan > 0 ? ` · +Rp ${komisiTambahan.toLocaleString('id-ID')}` : ''}
    </Button>
  );
}
