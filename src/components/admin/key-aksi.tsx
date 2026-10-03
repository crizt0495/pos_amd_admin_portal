'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Ban, CheckCircle2, Copy, ShieldAlert } from 'lucide-react';

import { Button, IconButton } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { AlertBox } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { LICENSE_TYPE_LABEL, PAKET_LABEL } from '@/lib/tier';
import type { LicenseStatus, Key } from '@/types';

/**
 * ============================================================================
 *  ISLAND AKSI PER BARIS KEY
 * ============================================================================
 *
 * Dulu seluruh tabel dirender oleh satu Client Component besar (`KeyManager`),
 * jadi 20 baris x 9 sel — termasuk alamat, telepon, komisi, tanggal, dan HWID
 * — semuanya ikut hydrate di browser, dan objek `Key` utuh (19 field) melintas
 * lewat payload RSC.
 *
 * Sekarang barisnya dirender Server Component dan hanya bagian yang benar-benar
 * butuh interaksi yang jadi island. Tipe `KeyAksiData` di bawah sengaja
 * memakai `Pick`: hanya 7 dari 19 field yang boleh menyeberang ke klien, jadi
 * kalau nanti ada kolom baru, TypeScript akan menolaknya di sini alih-alih
 * diam-diam ikut ter-serialize.
 */

/**
 * Hanya 7 field ini yang boleh masuk ke klien. Dinama `data`, bukan `key`,
 * karena `key` itu reserved prop React dan akan dipakai sebagai key list.
 */
type KeyAksiData = Pick<
  Key,
  'id' | 'serial_key' | 'status' | 'nama_pembeli' | 'nama_toko' | 'paket' | 'pilihan'
>;

/**
 * Aksi status satu key: cabut / blokir / aktifkan kembali.
 *
 * Revolving ke architecture islands, error tidak lagi bisa muncul di "kotak
 * alert paling atas" seperti dulu karena state-nya lokal di baris ini. Dua jalur
 * yang dipakai sekarang, keduanya tanpa state bersama:
 *   - dari modal konfirmasi -> `AlertBox` di dalam modal itu sendiri
 *   - dari aksi langsung ("Aktifkan kembali", tanpa modal) -> toast
 * Keduanya jauh lebih dekat ke tempat pengguna menekan, dan tidak butuh
 * context bersama yang akan menarik seluruh tabel ke sisi klien lagi.
 */
/**
 * Tombol salin serial key.
 *
 * Island-nya sengaja dibuat sekecil mungkin: tanpa `useState`, tanpa `useEffect`,
 * tanpa modal. Satu fungsi + satu event listener per baris, padahal seluruh
 * teks serial key dirender sebagai HTML di server.
 */
export function KeySalin({ serial }: { serial: string }) {
  const toast = useToast();

  async function salin() {
    try {
      await navigator.clipboard.writeText(serial);
      toast.sukses('Disalin ke clipboard.');
    } catch {
      toast.gagal('Gagal menyalin. Salin manual ya.');
    }
  }

  return (
    <IconButton
      label={`Salin ${serial}`}
      onClick={salin}
      className="border-transparent lg:h-7 lg:w-7"
    >
      <Copy className="h-3.5 w-3.5" />
    </IconButton>
  );
}

export function KeyAksi({ data: k }: { data: KeyAksiData }) {
  const router = useRouter();
  const toast = useToast();

  // Status tujuan yang sedang menunggu konfirmasi, atau null = modal tutup.
  const [konfirmasi, setKonfirmasi] = React.useState<'revoked' | 'blocked' | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function ubahStatus(baru: LicenseStatus) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/keys/${k.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: baru }),
      });
      const data = (await res.json()) as { ok: boolean; message: string };
      if (!res.ok || !data.ok) {
        setError(data.message || 'Gagal mengubah status key.');
        // Aksi tanpa modal tidak punya tempat menampilkan AlertBox.
        if (!konfirmasi) toast.gagal(data.message || 'Gagal mengubah status key.');
        return;
      }
      toast.sukses(data.message);
      setKonfirmasi(null);
      router.refresh();
    } catch {
      setError('Tidak bisa menghubungi server.');
      if (!konfirmasi) toast.gagal('Tidak bisa menghubungi server.');
    } finally {
      setBusy(false);
    }
  }

  if (k.status === 'revoked') {
    return (
      <IconButton
        label={`Aktifkan kembali ${k.serial_key}`}
        onClick={() => ubahStatus('unused')}
        disabled={busy}
        className="border-emerald-200 text-emerald-700"
      >
        <CheckCircle2 className="h-4 w-4" />
      </IconButton>
    );
  }

  return (
    <>
      {k.status === 'active' ? (
        <IconButton
          label={`Blokir ${k.serial_key}`}
          onClick={() => {
            setError(null);
            setKonfirmasi('blocked');
          }}
          disabled={busy}
          className="border-amber-200 text-amber-700"
        >
          <ShieldAlert className="h-4 w-4" />
        </IconButton>
      ) : null}

      <IconButton
        label={`Cabut ${k.serial_key}`}
        onClick={() => {
          setError(null);
          setKonfirmasi('revoked');
        }}
        disabled={busy}
        className="border-red-200 text-red-600"
      >
        <Ban className="h-4 w-4" />
      </IconButton>

      {/* `Modal` mengembalikan null saat tertutup, jadi 20 modal yang menomix
          hibrida ini tidak menambah satu pun node DOM sampai benar-benar dibuka. */}
      <Modal
        open={!!konfirmasi}
        onClose={() => setKonfirmasi(null)}
        title={konfirmasi === 'revoked' ? 'Cabut Serial Key' : 'Blokir Serial Key'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setKonfirmasi(null)} disabled={busy}>
              Batal
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={busy}
              disabled={busy || !konfirmasi}
              onClick={() => konfirmasi && ubahStatus(konfirmasi)}
            >
              {konfirmasi === 'revoked' ? 'Ya, cabut' : 'Ya, blokir'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {error ? <AlertBox>{error}</AlertBox> : null}

          <AlertBox tone="warn">
            {konfirmasi === 'revoked' ? (
              <>
                Key <strong>{k.serial_key}</strong> akan dicabut dan{' '}
                <strong>kunci perangkat (HWID) dilepas</strong>. Pemilik key tidak bisa lagi memakai
                key ini di komputer kasir — pakai untuk kasus WANGS (mis. pembeli minta refund).
                Komisi yang tercatat TIDAK berubah.
              </>
            ) : (
              <>
                Key <strong>{k.serial_key}</strong> akan diblokir — tidak bisa dipakai di komputer
                kasir, dan kunci perangkatnya tetap terpasang.
              </>
            )}
          </AlertBox>

          <div className="rounded-xl bg-zinc-50 px-3 py-2.5 text-[13px]">
            <p className="font-semibold text-zinc-800">{k.nama_pembeli}</p>
            <p className="text-[12px] text-zinc-500">
              {k.nama_toko} · {PAKET_LABEL[k.paket]} · {LICENSE_TYPE_LABEL[k.pilihan]}
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
}
