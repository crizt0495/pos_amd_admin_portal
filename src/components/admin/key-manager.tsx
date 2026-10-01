'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Ban, CheckCircle2, Copy, Search, ShieldAlert } from 'lucide-react';

import { Button, IconButton } from '@/components/ui/button';
import { KeyStatusBadge } from '@/components/ui/badge';
import { Input } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { AlertBox, EmptyState, TableWrap, Td, Th } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { rupiah, tanggalWaktu } from '@/lib/format';
import { LICENSE_TYPE_LABEL, PAKET_LABEL } from '@/lib/tier';
import type { Key } from '@/types';

/**
 * ============================================================================
 *  MANAGER KEY GLOBAL — daftar semua serial key dari semua toko
 * ============================================================================
 *  Aksi: revoke / blokir / aktifkan kembali. Perubahan status lewat
 *  PATCH /api/keys/[id] yang memanggil RPC `admin_revoke_key`.
 * ============================================================================
 */

const FILTER_STATUS = [
  { nilai: 'semua', label: 'Semua' },
  { nilai: 'unused', label: 'Belum Dipakai' },
  { nilai: 'active', label: 'Aktif' },
  { nilai: 'blocked', label: 'Diblokir' },
  { nilai: 'revoked', label: 'Dicabut' },
] as const;

type FilterStatus = (typeof FILTER_STATUS)[number]['nilai'];

export function KeyManager({ keys, total }: { keys: Key[]; total: number }) {
  const router = useRouter();
  const toast = useToast();

  const [cari, setCari] = React.useState('');
  const [status, setStatus] = React.useState<FilterStatus>('semua');
  const [konfirmasi, setKonfirmasi] = React.useState<Key | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const terfilter = React.useMemo(() => {
    const q = cari.trim().toLowerCase();
    return keys.filter((k) => {
      if (status !== 'semua' && k.status !== status) return false;
      if (!q) return true;
      return [k.serial_key, k.nama_pembeli, k.nama_toko ?? '', k.telepon ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [keys, cari, status]);

  async function ubahStatus(key: Key, baru: Key['status']) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/keys/${key.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: baru }),
      });
      const data = (await res.json()) as { ok: boolean; message: string };
      if (!res.ok || !data.ok) {
        setError(data.message || 'Gagal mengubah status key.');
        return;
      }
      toast.sukses(data.message);
      setKonfirmasi(null);
      router.refresh();
    } catch {
      setError('Tidak bisa menghubungi server.');
    } finally {
      setBusy(false);
    }
  }

  async function salin(teks: string) {
    try {
      await navigator.clipboard.writeText(teks);
      toast.sukses('Disalin ke clipboard.');
    } catch {
      toast.gagal('Gagal menyalin. Salin manual ya.');
    }
  }

  return (
    <>
      {/* Toolbar */}
      <div className="mb-3 flex flex-col gap-2.5 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari serial key, nama pembeli, toko, telepon…"
            className="pl-9"
            aria-label="Cari key"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTER_STATUS.map((f) => (
            <button
              key={f.nilai}
              type="button"
              onClick={() => setStatus(f.nilai)}
              className={`h-9 rounded-lg px-3 text-[12.5px] font-semibold transition ${
                status === f.nilai
                  ? 'bg-zinc-900 text-white'
                  : 'border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-2 text-[12px] text-zinc-500">
        Menampilkan {terfilter.length} dari {total} key
        {total > keys.length ? ` (data terbaru ${keys.length}, naik halaman untuk sisanya)` : ''}
      </p>

      {error ? (
        <div className="mb-3">
          <AlertBox>{error}</AlertBox>
        </div>
      ) : null}

      {terfilter.length === 0 ? (
        <EmptyState
          title={cari || status !== 'semua' ? 'Tidak ada key yang cocok' : 'Belum ada key'}
          description={
            cari || status !== 'semua'
              ? 'Coba ubah kata kunci atau filter status.'
              : 'Key akan muncul di sini setelah toko mulai generate serial key.'
          }
          action={
            cari || status !== 'semua' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCari('');
                  setStatus('semua');
                }}
              >
                Reset filter
              </Button>
            ) : null
          }
        />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>Serial Key</Th>
              <Th>Pembeli</Th>
              <Th>Toko Penjual</Th>
              <Th>Paket</Th>
              <Th>Pilihan</Th>
              <Th className="text-right">Komisi</Th>
              <Th>Tanggal Generate</Th>
              <Th>Status</Th>
              <Th className="text-right">Aksi</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {terfilter.map((k) => (
              <tr key={k.id} className="transition hover:bg-zinc-50/70">
                <Td>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[12px] font-semibold text-zinc-900">
                      {k.serial_key}
                    </span>
                    <IconButton
                      label={`Salin ${k.serial_key}`}
                      onClick={() => salin(k.serial_key)}
                      className="h-7 w-7 border-transparent"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </IconButton>
                  </div>
                  {k.hwid_locked ? (
                    <p className="mt-0.5 text-[10.5px] text-zinc-400" title={k.hwid_locked}>
                      terkunci ke {k.device_name ?? 'perangkat'}
                    </p>
                  ) : null}
                </Td>
                <Td>
                  <p className="font-medium text-zinc-800">{k.nama_pembeli}</p>
                  {k.telepon ? (
                    <p className="tabular text-[11.5px] text-zinc-500">{k.telepon}</p>
                  ) : null}
                </Td>
                <Td className="text-zinc-600">{k.nama_toko ?? '-'}</Td>
                <Td>{PAKET_LABEL[k.paket]}</Td>
                <Td>{LICENSE_TYPE_LABEL[k.pilihan]}</Td>
                <Td className="tabular text-right">{rupiah(k.komisi)}</Td>
                <Td className="text-zinc-600">{tanggalWaktu(k.created_at)}</Td>
                <Td>
                  <KeyStatusBadge status={k.status} />
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-1">
                    {k.status === 'revoked' ? (
                      <IconButton
                        label={`Aktifkan kembali ${k.serial_key}`}
                        onClick={() => ubahStatus(k, 'unused')}
                        disabled={busy}
                        className="border-emerald-200 text-emerald-700"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </IconButton>
                    ) : (
                      <>
                        {k.status === 'active' ? (
                          <IconButton
                            label={`Blokir ${k.serial_key}`}
                            onClick={() => setKonfirmasi({ ...k, status: 'blocked' })}
                            disabled={busy}
                            className="border-amber-200 text-amber-700"
                          >
                            <ShieldAlert className="h-4 w-4" />
                          </IconButton>
                        ) : null}
                        <IconButton
                          label={`Cabut ${k.serial_key}`}
                          onClick={() => setKonfirmasi({ ...k, status: 'revoked' })}
                          disabled={busy}
                          className="border-red-200 text-red-600"
                        >
                          <Ban className="h-4 w-4" />
                        </IconButton>
                      </>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      {/* Konfirmasi revoke / blokir */}
      <Modal
        open={!!konfirmasi}
        onClose={() => setKonfirmasi(null)}
        title={konfirmasi?.status === 'revoked' ? 'Cabut Serial Key' : 'Blokir Serial Key'}
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
              onClick={() => konfirmasi && ubahStatus(konfirmasi, konfirmasi.status)}
            >
              {konfirmasi?.status === 'revoked' ? 'Ya, cabut' : 'Ya, blokir'}
            </Button>
          </div>
        }
      >
        {konfirmasi ? (
          <div className="space-y-3">
            <AlertBox tone="warn">
              {konfirmasi.status === 'revoked' ? (
                <>
                  Key <strong>{konfirmasi.serial_key}</strong> akan dicabut dan{' '}
                  <strong>kunci perangkat (HWID) dilepas</strong>. Pemilik key tidak bisa lagi
                  memakai key ini di komputer kasir — pakai untuk kasusWANGS (mis. pembeli minta
                  refund). Komisi yang tercatat TIDAK berubah.
                </>
              ) : (
                <>
                  Key <strong>{konfirmasi.serial_key}</strong> akan diblokir — tidak bisa dipakai
                  di komputer kasir, dan kunci perangkatnya tetap terpasang.
                </>
              )}
            </AlertBox>
            <div className="rounded-xl bg-zinc-50 px-3 py-2.5 text-[13px]">
              <p className="font-semibold text-zinc-800">{konfirmasi.nama_pembeli}</p>
              <p className="text-[12px] text-zinc-500">
                {konfirmasi.nama_toko} · {PAKET_LABEL[konfirmasi.paket]} ·{' '}
                {LICENSE_TYPE_LABEL[konfirmasi.pilihan]}
              </p>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
