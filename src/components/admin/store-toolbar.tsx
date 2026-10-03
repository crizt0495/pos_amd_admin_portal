'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Layers, Search, X } from 'lucide-react';

import { Button, IconButton } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { AlertBox, EmptyState } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { hapusPilih, usePilih } from '@/lib/pilih-store';
import { useDebounce } from '@/lib/useDebounce';
import { cekJumlahKey } from '@/lib/validasi';
import type { StoreRowData } from '@/types';

/**
 * =============================================================================
 *  TOOLBAR + PAGINASI + DIALOG MASSAL — CLIENT ISLAND
 * =============================================================================
 *
 * Ketiganya dipisah dari `StoreDaftar` (Server Component) dan sengaja TIDAK
 * digabung jadi satu island besar: kalau toolbar ikut jadi anak dari island
 * yang sama, daftar server-rendered harus jadi `children`-nya — dan
 * `children` yang dirender Client Component tetap ikut di-hydrate. Jadi masing-
 * masing dibiarkan sebagai island terpisah, dengan daftar sebagai SAUDAR (bukan
 * anak) di `page.tsx`.
 *
 * Konsekuensinya masing-masing punya state `menunggu` sendiri. Ini justru
 * benar: spinner di kotak pencarian hanya merespons pencarian yang sedang
 * berjalan, dan tombol paginasi hanya merespons navigasi halaman.
 */

/**
 * State navigasi bersama: bikin URL baru tanpa kehilangan kata kunci, dan
 * selalu kembali ke halaman 1. Tiap pemanggil mendapat `menunggu`-nya sendiri,
 * jadi tidak perlu di-drill ke bawah sebagai prop.
 */
function useNavigasiToko() {
  const router = useRouter();
  const sp = useSearchParams();
  const [menunggu, mulaiTransition] = React.useTransition();

  function navigasi(next: { q?: string; page?: number }) {
    const p = new URLSearchParams(sp.toString());
    if (next.q !== undefined) p.set('q', next.q);
    p.delete('page');
    if (next.page && next.page > 1) p.set('page', String(next.page));
    const qs = p.toString();
    mulaiTransition(() => router.replace(qs ? `/toko?${qs}` : '/toko', { scroll: false }));
  }

  return { navigasi, menunggu };
}

/** Kotak pencarian + baris aksi massal. */
export function StoreToolbar({ q, total }: { q: string; total: number }) {
  const { navigasi, menunggu } = useNavigasiToko();
  const dipilih = usePilih();
  const [bulkBuka, setBulkBuka] = React.useState(false);

  // Teks di kotak pencarian sengaja dipisah dari `q` (yang sudah hasil filter
  // server). Kalau tidak, tiap selesai debounce teks ketikan ikut terkirim ke
  // server dan kursor-nya melompat-lompat.
  const [cari, setCari] = React.useState(q);
  const cariDebounce = useDebounce(cari, 500);

  // Ikuti URL kalau user Back/Forward atau menekan tombol filter.
  React.useEffect(() => setCari(q), [q]);

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

  return (
    <>
      <div className="mb-3 flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari nama toko, email, HP, alamat…"
            className="pl-9"
            aria-label="Cari toko"
          />
          {/* Spinner kecil hanya selama query baru dijalankan — teks tetap bisa diketik. */}
          {menunggu ? (
            <span
              aria-hidden
              className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700"
            />
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {dipilih.size > 0 ? (
            <>
              <span className="text-[12.5px] font-semibold text-zinc-600">
                {dipilih.size} dipilih
              </span>
              <Button variant="outline" size="sm" onClick={() => setBulkBuka(true)}>
                <Layers className="h-3.5 w-3.5" />
                Top Up Massal
              </Button>
              <IconButton label="Batalkan pilihan" onClick={hapusPilih}>
                <X className="h-4 w-4" />
              </IconButton>
            </>
          ) : (
            <span className="text-[12.5px] text-zinc-500">
              {total} toko · centang untuk top up massal
            </span>
          )}
        </div>
      </div>

      {bulkBuka ? <BulkTopupDialog onClose={() => setBulkBuka(false)} /> : null}
    </>
  );
}

/** Navigasi halaman — disembunyikan kalau hasilnya muat satu halaman. */
export function StorePaginasi({
  page,
  totalHalaman,
  jumlah,
}: {
  page: number;
  totalHalaman: number;
  jumlah: number;
}) {
  const { navigasi, menunggu } = useNavigasiToko();
  if (jumlah === 0 || totalHalaman <= 1) return null;

  return (
    <nav
      aria-label="Navigasi halaman toko"
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
  );
}

/** Placeholder saat hasil filter kosong. */
export function StoreKosong({ adaFilter }: { adaFilter: boolean }) {
  const { navigasi } = useNavigasiToko();

  return (
    <EmptyState
      title={adaFilter ? 'Tidak ada toko yang cocok' : 'Belum ada toko terdaftar'}
      description={
        adaFilter
          ? 'Coba ubah kata kunci pencarian.'
          : 'Daftarkan toko pertama untuk mulai mengelola kuota & key.'
      }
      action={
        adaFilter ? (
          <Button variant="outline" size="sm" onClick={() => navigasi({ q: '' })}>
            Bersihkan pencarian
          </Button>
        ) : (
          <Link
            href="/toko/baru"
            className="inline-flex h-11 items-center rounded-lg bg-zinc-900 px-3 text-[13px] font-semibold text-white lg:h-9"
          >
            Daftar Toko Baru
          </Link>
        )
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/* Dialog: Top up massal                                              */
/* ------------------------------------------------------------------ */

/**
 * Dialog ini hidup di dalam `StoreToolbar`, bukan di baris mana pun, karena
 * sumber datanya adalah hasil SELEKSI (store modul) — bukan satu toko.
 * Daftar tokonya dibaca dari snapshot store, jadi tetap sinkron dengan centang
 * di baris mana pun tanpa perlu prop-drilling melewati Server Component.
 */
function BulkTopupDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const dipilih = usePilih();

  const [jumlah, setJumlah] = React.useState('5');
  const [catatan, setCatatan] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const n = Number(jumlah);
  const err = cekJumlahKey(n);

  async function submit() {
    if (busy) return;
    if (err) {
      setError(err);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/topup/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_ids: Array.from(dipilih.keys()),
          jumlah_key: Math.trunc(n),
          catatan,
        }),
      });
      const data = (await res.json()) as { ok: boolean; message: string };
      if (!res.ok || !data.ok) {
        setError(data.message || 'Gagal top up massal.');
        return;
      }
      toast.sukses(data.message);
      hapusPilih();
      router.refresh();
      onClose();
    } catch {
      setError('Tidak bisa menghubungi server.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Top Up Massal — ${dipilih.size} toko`}
      wide
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button
            size="sm"
            onClick={submit}
            loading={busy}
            disabled={busy || !!err || dipilih.size === 0}
          >
            <Layers className="h-3.5 w-3.5" />
            Terapkan ke {dipilih.size} toko
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5">
        {error ? <AlertBox>{error}</AlertBox> : null}

        <div className="rounded-xl bg-zinc-50 px-3 py-2.5 text-[13px]">
          <p className="font-semibold text-zinc-700">Toko yang dipilih:</p>
          <ul className="mt-1.5 max-h-32 space-y-0.5 overflow-y-auto text-[12.5px] text-zinc-600">
            {Array.from(dipilih.values()).map((s: StoreRowData) => (
              <li key={s.id} className="truncate">
                • {s.nama_toko}{' '}
                <span className="text-zinc-500">
                  (sisa {s.sisa_kuota} → {Math.max(0, s.sisa_kuota + Math.trunc(n || 0))})
                </span>
              </li>
            ))}
          </ul>
        </div>

        <Field
          label="Jumlah Key per toko"
          htmlFor="jumlah-bulk"
          required
          error={err}
          hint="Diterapkan sama ke semua toko terpilih."
        >
          <Input
            id="jumlah-bulk"
            type="number"
            inputMode="numeric"
            step={1}
            value={jumlah}
            onChange={(e) => setJumlah(e.target.value)}
            className={err ? 'input-invalid' : undefined}
          />
        </Field>

        <div className="flex flex-wrap gap-1.5">
          {[5, 10, 25, 50].map((nQuick) => (
            <button
              key={nQuick}
              type="button"
              onClick={() => setJumlah(String(nQuick))}
              className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[12px] font-semibold text-zinc-700 transition hover:border-zinc-300"
            >
              +{nQuick}
            </button>
          ))}
        </div>

        <Field label="Catatan (opsional)" htmlFor="catatan-bulk">
          <Input
            id="catatan-bulk"
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="mis. bonus_campaign_Oktober"
            maxLength={140}
          />
        </Field>
      </div>
    </Modal>
  );
}
