'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Ban, CheckCircle2, Copy, Search, ShieldAlert } from 'lucide-react';

import { Button, IconButton } from '@/components/ui/button';
import { KeyStatusBadge } from '@/components/ui/badge';
import { Input } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import {
  AlertBox,
  EmptyState,
  ListHead,
  ListHeadCell,
  ListLabel,
  ListRow,
  ListShell,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { rupiah, tanggalWaktu } from '@/lib/format';
import { LICENSE_TYPE_LABEL, PAKET_LABEL } from '@/lib/tier';
import { useDebounce } from '@/lib/useDebounce';
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

/**
 * Template kolom untuk `lg:` — dipakai PERSIS sama oleh `ListHead` dan
 * `ListRow`, jadi judul kolom dan isi selalu sejajar. Di bawah `lg` template
 * ini diabaikan: tiap sel jadi blok bertumpuk dengan `ListLabel`.
 *
 * Urutannya harus sama dengan urutan sel di dalam `ListRow`.
 */
const GRID_DAFTAR =
  'lg:grid-cols-[minmax(128px,1fr)_minmax(168px,1.5fr)_minmax(92px,.9fr)_minmax(74px,.7fr)_minmax(82px,.8fr)_minmax(82px,.8fr)_minmax(108px,.9fr)_minmax(78px,.7fr)_minmax(64px,auto)]';

export function KeyManager({
  keys,
  total,
  page,
  perHalaman,
  totalHalaman,
  q,
  status,
}: {
  keys: Key[];
  total: number;
  page: number;
  perHalaman: number;
  totalHalaman: number;
  q: string;
  status: FilterStatus;
}) {
  const router = useRouter();
  const toast = useToast();
  const sp = useSearchParams();
  const [menunggu, mulaiTransition] = React.useTransition();

  const [konfirmasi, setKonfirmasi] = React.useState<Key | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Teks di kotak pencarian sengaja dipisah dari `q` (yang sudah hasil filter
  // server). Kalau tidak, tiap selesai debounce teks ketikan ikut terkirim ke
  // server dan courses-nya melompat-lompat.
  const [cari, setCari] = React.useState(q);
  const cariDebounce = useDebounce(cari, 500);

  // Ikuti URL kalau user Back/Forward atau menekan tombol filter.
  React.useEffect(() => setCari(q), [q]);

  /** Bikin URL baru tanpa kehilangan filter lain; halaman selalu balik ke 1. */
  function navigasi(next: { q?: string; status?: string; page?: number }) {
    const p = new URLSearchParams(sp.toString());
    if (next.q !== undefined) p.set('q', next.q);
    if (next.status !== undefined) p.set('status', next.status);
    p.delete('page');
    if (next.page && next.page > 1) p.set('page', String(next.page));
    const qs = p.toString();
    mulaiTransition(() => router.replace(qs ? `/keys?${qs}` : '/keys', { scroll: false }));
  }

  // Efek terpisah dari hook debounce: hook cuma menunda nilai, hook tidak
  // boleh punya efek samping.
  const qTerakhir = React.useRef(q);
  React.useEffect(() => {
    const bersih = cariDebounce.trim();
    if (bersih === qTerakhir.current) return;
    qTerakhir.current = bersih;
    navigasi({ q: bersih });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cariDebounce]);

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

  /** Aksi status satu key — dipakai baris tabel (desktop) & kartu (HP). */
  function aksiKey(k: Key) {
    if (k.status === 'revoked') {
      return (
        <IconButton
          label={`Aktifkan kembali ${k.serial_key}`}
          onClick={() => ubahStatus(k, 'unused')}
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
    );
  }

  /** Serial key + tombol salin, dipakai tabel & kartu. */
  function selKey(k: Key) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[12px] font-semibold text-zinc-900">{k.serial_key}</span>
        <IconButton
          label={`Salin ${k.serial_key}`}
          onClick={() => salin(k.serial_key)}
          className="border-transparent lg:h-7 lg:w-7"
        >
          <Copy className="h-3.5 w-3.5" />
        </IconButton>
      </div>
    );
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
            placeholder="Cari serial key, nama pembeli, alamat, toko, telepon…"
            className="pl-9"
            aria-label="Cari key"
          />
          {/*Spinner kecil hanya selama query baru dijalankan — teks tetap bisa diketik. */}
          {menunggu ? (
            <span
              aria-hidden
              className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700"
            />
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTER_STATUS.map((f) => (
            <button
              key={f.nilai}
              type="button"
              onClick={() => navigasi({ status: f.nilai })}
              className={`touch-chip ${
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
        {total === 0
          ? 'Tidak ada key'
          : `Menampilkan ${(page - 1) * perHalaman + 1}–${Math.min(page * perHalaman, total)} dari ${total} key`}
        {q ? ` untuk "${q}"` : ''}
      </p>

      {error ? (
        <div className="mb-3">
          <AlertBox>{error}</AlertBox>
        </div>
      ) : null}

      {keys.length === 0 ? (
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
                  qTerakhir.current = '';
                  navigasi({ q: '', status: 'semua' });
                }}
              >
                Reset filter
              </Button>
            ) : null
          }
        />
      ) : (
        /*
         * SATU markup untuk HP & desktop.
         *
         * Sebelumnya halaman ini merender `<TableWrap>` (tabel, disembunyikan
         * di HP) DAN `TableCards` (kartu, disembunyikan di desktop) sekaligus.
         * CSS `hidden` tidak mencegah React merender, jadi 20 key ter-render
         * dua kali: HTML 178 KB, `styleLayout` 754 ms, `scriptEvaluation`
         * 1132 ms. Sekarang cukup satu `<ul>`; `lg:grid-cols-*` yang mengubah
         * kartu bertumpuk menjadi baris tabel. Nol duplikasi, CLS tetap 0.
         */
        <ListShell>
          <ListHead gridClass={GRID_DAFTAR}>
            <ListHeadCell>Serial Key</ListHeadCell>
            <ListHeadCell>Pembeli</ListHeadCell>
            <ListHeadCell>Toko Penjual</ListHeadCell>
            <ListHeadCell>Paket</ListHeadCell>
            <ListHeadCell>Pilihan</ListHeadCell>
            <ListHeadCell className="text-right">Komisi</ListHeadCell>
            <ListHeadCell>Tanggal Generate</ListHeadCell>
            <ListHeadCell>Status</ListHeadCell>
            <ListHeadCell className="text-right">Aksi</ListHeadCell>
          </ListHead>

          <ul className="divide-y divide-zinc-100">
            {keys.map((k) => (
              <ListRow key={k.id} gridClass={GRID_DAFTAR}>
                {/* 1 — Serial key + tombol salin */}
                <div className="min-w-0">
                  {selKey(k)}
                  {k.hwid_locked ? (
                    // zinc-500 bukan zinc-400: teks kecil ini tampil penuh di
                    // HP dan zinc-400 hanya ~2,6:1 (gagal WCAG AA).
                    <p className="mt-0.5 text-[10.5px] text-zinc-500" title={k.hwid_locked}>
                      terkunci ke {k.device_name ?? 'perangkat'}
                    </p>
                  ) : null}
                </div>

                {/* 2 — Pembeli: nama, alamat, telepon */}
                <div className="mt-2.5 min-w-0 lg:mt-0">
                  <p className="text-sm font-medium text-zinc-800">{k.nama_pembeli}</p>
                  {k.alamat_pembeli ? (
                    <p
                      title={k.alamat_pembeli}
                      className="line-clamp-2 max-w-[200px] text-xs leading-snug text-gray-600"
                    >
                      {k.alamat_pembeli}
                    </p>
                  ) : (
                    <p className="max-w-[200px] text-xs leading-snug text-gray-600">
                      Alamat belum diisi
                    </p>
                  )}
                  {k.telepon ? (
                    // gray-500 bukan gray-400, alasan kontras sama seperti di atas.
                    <p className="tabular text-[11px] text-gray-500">{k.telepon}</p>
                  ) : null}
                </div>

                {/* 3 — Toko Penjual */}
                <div className="mt-2.5 min-w-0 lg:mt-0">
                  <ListLabel>Toko</ListLabel>
                  <span className="text-zinc-600">{k.nama_toko ?? '-'}</span>
                </div>

                {/* 4 — Paket */}
                <div className="mt-2.5 lg:mt-0">
                  <ListLabel>Paket</ListLabel>
                  <span>{PAKET_LABEL[k.paket]}</span>
                </div>

                {/* 5 — Pilihan */}
                <div className="mt-2.5 lg:mt-0">
                  <ListLabel>Pilihan</ListLabel>
                  <span>{LICENSE_TYPE_LABEL[k.pilihan]}</span>
                </div>

                {/* 6 — Komisi */}
                <div className="mt-2.5 lg:mt-0 lg:text-right">
                  <ListLabel>Komisi</ListLabel>
                  <span className="tabular">{rupiah(k.komisi)}</span>
                </div>

                {/* 7 — Tanggal generate */}
                <div className="mt-2.5 lg:mt-0">
                  <ListLabel>Tanggal Generate</ListLabel>
                  <span className="text-zinc-600">{tanggalWaktu(k.created_at)}</span>
                </div>

                {/* 8 — Status */}
                <div className="mt-2.5 lg:mt-0">
                  <ListLabel>Status</ListLabel>
                  <KeyStatusBadge status={k.status} />
                </div>

                {/* 9 — Aksi (target sentuh tetap 44px di HP) */}
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 lg:mt-0 lg:justify-end">
                  {aksiKey(k)}
                </div>
              </ListRow>
            ))}
          </ul>
        </ListShell>
      )}

      {/* Navigasi halaman — disembunyikan kalau hasilnya muat satu halaman. */}
      {keys.length > 0 && totalHalaman > 1 ? (
        <nav
          aria-label="Navigasi halaman key"
          className="mt-3 flex items-center justify-between gap-2 border-t border-zinc-100 pt-3"
        >
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || menunggu}
            onClick={() => navigasi({ page: page - 1 })}
          >
            Sebelumnya
          </Button>
          <span className="text-[12.5px] text-zinc-500">
            Halaman {page} dari {totalHalaman}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalHalaman || menunggu}
            onClick={() => navigasi({ page: page + 1 })}
          >
            Berikutnya
          </Button>
        </nav>
      ) : null}

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
                  Key <strong>{konfirmasi.serial_key}</strong> akan diblokir — tidak bisa dipakai di
                  komputer kasir, dan kunci perangkatnya tetap terpasang.
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
