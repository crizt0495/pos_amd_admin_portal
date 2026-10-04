'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Trash2 } from 'lucide-react';

import { Button, IconButton } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { AlertBox } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { produkError } from '@/lib/produk';

/**
 * ============================================================================
 *  ISLAND AKSI PRODUK
 * ============================================================================
 *
 * Dua komponen di sini, keduanya client:
 *   - `ProdukTambah` : tombol "Tambah Produk" + form tambah
 *   - `ProdukAksi`   : tombol ubah + hapus per baris
 *
 * Kenapa dialog, bukan halaman `/produk/baru` seperti pendaftaran toko:
 * katalog produk itu pendek (satu baris per jenis aplikasi yang dijual), jadi
 * memaksa pindah halaman untuk menambah satu baris hanya memperlambat. Form
 *nya juga cuma empat field, tidak seperti pendaftaran toko yang butuh halaman
 * penuh.
 *
 * Kolom `harga_*` DATANG DARI SERVER sebagai `number | null`, tapi yang dikirim
 * ke `fetch` adalah string. `rapikanProduk()` di sisi server yang mengubahnya
 * kembali jadi `number | null` — jadi "dikosongkan" (string kosong) dan "0"
 * tidak pernah tercampur: string kosong berarti belum diisi, 0 berarti gratis.
 */

/** Subset baris produk yang boleh menyeberang ke client. */
export interface ProdukAksiData {
  id: string;
  nama_apariksi: string;
  harga_sekali_bayar: number | null;
  harga_langganan_tahunan: number | null;
  deskripsi: string | null;
}

/** Nilai string untuk form; null menjadi string kosong. */
function keTeks(nilai: number | null): string {
  return nilai === null || nilai === undefined ? '' : String(nilai);
}

/**
 * Validasi sebelum ke server.
 *
 * PENTING: ini bukan pengganti `produkError()` di server, tapi pemanggilan
 * fungsi yang sama persis. Kalau ketiganya menulis aturan sendiri, aturan yang
 * berlaku di browser akan berbeda dari yang berlaku saat menyimpan.
 */
function cekForm(v: {
  nama: string;
  sekali: string;
  langganan: string;
}): string | null {
  const harga = (s: string): number | null => (s.trim() === '' ? null : Number(s));
  return produkError({
    nama_apariksi: v.nama,
    harga_sekali_bayar: harga(v.sekali),
    harga_langganan_tahunan: harga(v.langganan),
  });
}

/* ------------------------------------------------------------------ */
/* Tombol + form: Tambah Produk                                       */
/* ------------------------------------------------------------------ */

export function ProdukTambah() {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} className="shrink-0">
        <Plus className="h-4 w-4" />
        Tambah Produk
      </Button>

      {open ? <ProdukFormDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Tombol aksi per baris                                              */
/* ------------------------------------------------------------------ */

export function ProdukAksi({ produk }: { produk: ProdukAksiData }) {
  const [dialog, setDialog] = React.useState<'edit' | 'hapus' | null>(null);

  return (
    <>
      <div className="flex items-center justify-end gap-1.5">
        <IconButton
          label={`Ubah ${produk.nama_apariksi}`}
          onClick={() => setDialog('edit')}
          className="h-11 w-11 lg:h-9 lg:w-9"
        >
          <Pencil className="h-4 w-4" />
        </IconButton>

        <IconButton
          label={`Hapus ${produk.nama_apariksi}`}
          onClick={() => setDialog('hapus')}
          className="h-11 w-11 border-red-200 text-red-600 lg:h-9 lg:w-9"
        >
          <Trash2 className="h-4 w-4" />
        </IconButton>
      </div>

      {dialog === 'edit' ? (
        <ProdukFormDialog produk={produk} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === 'hapus' ? (
        <ProdukHapusDialog produk={produk} onClose={() => setDialog(null)} />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Form: tambah / ubah                                                */
/* ------------------------------------------------------------------ */

function ProdukFormDialog({
  produk,
  onClose,
}: {
  produk?: ProdukAksiData;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const ubah = produk !== undefined;

  const [nama, setNama] = React.useState(produk?.nama_apariksi ?? '');
  const [sekali, setSekali] = React.useState(keTeks(produk?.harga_sekali_bayar ?? null));
  const [langganan, setLangganan] = React.useState(
    keTeks(produk?.harga_langganan_tahunan ?? null),
  );
  const [deskripsi, setDeskripsi] = React.useState(produk?.deskripsi ?? '');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    const err = cekForm({ nama, sekali, langganan });
    if (err) {
      setError(err);
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const res = await fetch(ubah ? `/api/produk/${produk.id}` : '/api/produk', {
        method: ubah ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama_apariksi: nama, harga_sekali_bayar: sekali, harga_langganan_tahunan: langganan, deskripsi }),
      });

      const data = (await res.json()) as { ok: boolean; message: string };
      if (!res.ok || !data.ok) {
        setError(data.message || 'Gagal menyimpan produk.');
        return;
      }

      toast.sukses(data.message);
      onClose();
      router.refresh();
    } catch {
      setError('Tidak bisa menghubungi server.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={busy ? undefined : onClose}
      title={ubah ? 'Ubah Produk' : 'Tambah Produk'}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button type="submit" form="form-produk" disabled={busy}>
            {busy ? 'Menyimpan...' : ubah ? 'Simpan Perubahan' : 'Simpan Produk'}
          </Button>
        </>
      }
    >
      <form id="form-produk" onSubmit={submit} className="space-y-3.5">
        {error ? <AlertBox>{error}</AlertBox> : null}

        <Field
          label="Nama Aplikasi"
          htmlFor="p-nama"
          required
          hint="Nama yang muncul di daftar produk, mis. POS AMD."
        >
          <Input
            id="p-nama"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            maxLength={100}
            required
            autoComplete="off"
            placeholder="POS AMD"
          />
        </Field>

        <Field
          label="Sekali Bayar (Rp)"
          htmlFor="p-sekali"
          hint="Kosongkan kalau produk ini tidak dijual sekali bayar."
        >
          <Input
            id="p-sekali"
            className="tabular"
            inputMode="numeric"
            value={sekali}
            onChange={(e) => setSekali(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="500000"
          />
        </Field>

        <Field
          label="Langganan/Tahun (Rp)"
          htmlFor="p-langganan"
          hint="Kosongkan kalau produk ini tidak dijual langganan."
        >
          <Input
            id="p-langganan"
            className="tabular"
            inputMode="numeric"
            value={langganan}
            onChange={(e) => setLangganan(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="250000"
          />
        </Field>

        <Field
          label="Deskripsi"
          htmlFor="p-deskripsi"
          hint="Opsional. Tampil di bawah nama aplikasi."
        >
          <Textarea
            id="p-deskripsi"
            rows={3}
            value={deskripsi}
            onChange={(e) => setDeskripsi(e.target.value)}
            placeholder="Aplikasi kasir untuk UMKM."
          />
        </Field>

        {/*
         * Harga itu acuan komisi, jadi disampaikan di tempat admin sedang
         * mengetik angkanya — bukan hanya di judul kolom yang jauh di atas.
         */}
        <p className="text-[12px] leading-relaxed text-zinc-500">
          Harga di form ini dipakai sebagai acuan estimasi komisi di dashboard (20% dari harga untuk
          key yang sudah aktif). Harga boleh dikosongkan, tapi akan membuat key untuk jenis tersebut
          tidak ikut dihitung.
        </p>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Dialog hapus                                                        */
/* ------------------------------------------------------------------ */

function ProdukHapusDialog({ produk, onClose }: { produk: ProdukAksiData; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function hapus() {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch(`/api/produk/${produk.id}`, { method: 'DELETE' });
      const data = (await res.json()) as { ok: boolean; message: string };

      if (!res.ok || !data.ok) {
        setError(data.message || 'Gagal menghapus produk.');
        return;
      }

      toast.sukses(data.message);
      onClose();
      router.refresh();
    } catch {
      setError('Tidak bisa menghubungi server.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={busy ? undefined : onClose}
      title="Hapus Produk"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button type="button" variant="danger" onClick={hapus} disabled={busy}>
            {busy ? 'Menghapus...' : 'Hapus'}
          </Button>
        </>
      }
    >
      {error ? (
        <div className="mb-3">
          <AlertBox>{error}</AlertBox>
        </div>
      ) : null}

      <p className="text-[14px] leading-relaxed text-zinc-700">
        Hapus <strong>{produk.nama_apariksi}</strong> dari katalog?
      </p>

      {/*
       * Konsekuensinya disampaikan eksplisit: key yang sudah terjual tidak ikut
       * terhapus, tapi acuan harganya hilang. Kalau ini disembunyikan, admin bisa
       * menghapus satu produk dan tidak sadar angka komisi di dashboard ikut
       * turun.
       */}
      <div className="mt-3">
        <AlertBox tone="warn">
          Key yang sudah terjual tidak ikut terhapus, tapi kehilangan acuan harga sehingga tidak lagi
          dihitung di estimasi komisi.
        </AlertBox>
      </div>
    </Modal>
  );
}
