'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { AlertBox } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { cekJumlahKey } from '@/lib/validasi';
import type { Store } from '@/types';

/**
 * Tombol "Isi Ulang Key" untuk halaman detail toko.
 *
 * Dipisah dari `StoreManager` supaya halaman detail (server component) tidak
 * perlu menarik seluruh logika tabel.
 */
export function TopupStoreButton({ store }: { store: Store }) {
  const router = useRouter();
  const toast = useToast();
  const [buka, setBuka] = React.useState(false);
  const [jumlah, setJumlah] = React.useState('5');
  const [catatan, setCatatan] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const n = Number(jumlah);
  const err = cekJumlahKey(n);
  const preview = Number.isFinite(n) ? Math.max(0, store.sisa_kuota + Math.trunc(n)) : store.sisa_kuota;

  async function submit() {
    if (busy) return;
    if (err) {
      setError(err);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: store.id, jumlah_key: Math.trunc(n), catatan }),
      });
      const data = (await res.json()) as { ok: boolean; message: string };
      if (!res.ok || !data.ok) {
        setError(data.message || 'Gagal top up.');
        return;
      }
      toast.sukses(data.message);
      setBuka(false);
      router.refresh();
    } catch {
      setError('Tidak bisa menghubungi server.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => setBuka(true)}>
        <KeyRound className="h-4 w-4" />
        Isi Ulang Key
      </Button>

      <Modal
        open={buka}
        onClose={() => setBuka(false)}
        title={`Isi Ulang Kuota — ${store.nama_toko}`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setBuka(false)} disabled={busy}>
              Batal
            </Button>
            <Button size="sm" onClick={submit} loading={busy} disabled={busy || !!err}>
              Simpan
            </Button>
          </div>
        }
      >
        <div className="space-y-3.5">
          {error ? <AlertBox>{error}</AlertBox> : null}

          <div className="rounded-xl bg-zinc-50 px-3 py-2.5 text-[13px]">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Sisa sekarang</span>
              <span className="tabular font-bold text-zinc-900">{store.sisa_kuota} key</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-zinc-500">Sisa setelah diubah</span>
              <span className="tabular font-bold text-zinc-900">{preview} key</span>
            </div>
          </div>

          <Field
            label="Jumlah Key"
            htmlFor="d-jumlah"
            required
            error={err}
            hint="Positif menambah, negatif mengurangi (untuk koreksi)."
          >
            <Input
              id="d-jumlah"
              type="number"
              inputMode="numeric"
              step={1}
              value={jumlah}
              onChange={(e) => setJumlah(e.target.value)}
              className={err ? 'input-invalid' : undefined}
            />
          </Field>

          <div className="flex flex-wrap gap-1.5">
            {[5, 10, 25, 50].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setJumlah(String(q))}
                className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[12px] font-semibold text-zinc-700 transition hover:border-zinc-300"
              >
                +{q}
              </button>
            ))}
          </div>

          <Field label="Catatan (opsional)" htmlFor="d-catatan">
            <Input
              id="d-catatan"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="mis. pembayaran transfer BCA"
              maxLength={140}
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}
