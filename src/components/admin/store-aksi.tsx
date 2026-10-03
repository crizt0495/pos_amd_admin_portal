'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Ban, CheckCircle2, Eye, KeyRound, Pencil, Trash2, UserCog } from 'lucide-react';

import { Button, IconButton } from '@/components/ui/button';
import { Field, Input, InputTelepon, Textarea } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { AlertBox } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { pilihSemua, togglePilih, usePilih } from '@/lib/pilih-store';
import { cekJumlahKey } from '@/lib/validasi';
import { cn } from '@/lib/utils';
import type { StoreRowData } from '@/types';

/**
 * =============================================================================
 *  ISLAND AKSI PER BARIS TOKO
 * =============================================================================
 *
 * Dulu seluruh tabel dirender oleh satu Client Component besar (`StoreManager`),
 * jadi semua sel ikut hydrate — termasuk kolom yang isinya cuma teks statis —
 * dan objek `Store` utuh (15 field) melintas lewat payload RSC.
 *
 * Sekarang barisnya dirender Server Component (`StoreDaftar`) dan hanya bagian
 * yang benar-benar butuh interaksi yang jadi island. `StoreRowData` di
 * `@/types` hanya mengizinkan 8 dari 15 field menyeberang, jadi kalau nanti
 * ada kolom baru, TypeScript akan menolak build di sini alih-alih diam-diam
 * ikut ter-serialize.
 *
 * Island ini memuat dua hal yang terpisah secara logika tapi punya satu sumber
 * state (server-render baris -> checkbox + tombol aksi), supaya tidak ada
 * prop-drilling melewati Server Component:
 *   - `StorePilih`  : kotak centang (ssubscribe ke store modul `pilih-store`)
 *   - `StoreAksi`   : 4 tombol aksi + 3 dialog (top up / edit / hapus)
 *
 * Aksi aktif/nonaktif TIDAK lewat dialog (cukup satu klik, toast jadi umpan
 * baliknya) — sama seperti keputusan di `KeyAksi`.
 */

/** Checkbox centang satu baris. */
export function StorePilih({ data: s }: { data: StoreRowData }) {
  // Baca store modul supaya `checked` ikut berubah begitu ada baris lain yang
  // dicentang; tanpa ini centang hanya eervernya satu arah.
  const dipilih = usePilih();

  return (
    <label className="-m-2 grid h-11 w-11 cursor-pointer place-items-center">
      <input
        type="checkbox"
        checked={dipilih.has(s.id)}
        onChange={() => togglePilih(s)}
        aria-label={`Pilih ${s.nama_toko}`}
        className="h-5 w-5 rounded border-zinc-300 accent-zinc-900"
      />
    </label>
  );
}

/** Checkbox "pilih semua" di kepala tabel — hanya memilih baris di halaman ini. */
export function PilihSemua({ stores }: { stores: StoreRowData[] }) {
  const dipilih = usePilih();
  const semuaTerpilih = stores.length > 0 && stores.every((s) => dipilih.has(s.id));

  return (
    <label className="-mx-3 -my-2.5 grid h-11 w-11 cursor-pointer place-items-center">
      <input
        type="checkbox"
        checked={semuaTerpilih}
        onChange={() => pilihSemua(stores, !semuaTerpilih)}
        aria-label="Pilih semua toko di halaman ini"
        className="h-5 w-5 rounded border-zinc-300 accent-zinc-900"
      />
    </label>
  );
}

type Dialog = 'topup' | 'edit' | 'hapus' | null;

export function StoreAksi({ data: s }: { data: StoreRowData }) {
  const router = useRouter();
  const toast = useToast();

  const [dialog, setDialog] = React.useState<Dialog>(null);
  const [busy, setBusy] = React.useState(false);

  const tutup = React.useCallback(() => {
    setDialog(null);
    setBusy(false);
  }, []);

  /**
   * Aksi status satu toko: aktifkan / nonaktifkan. Tanpa modal — seperti
   * "Aktifkan kembali" di `KeyAksi`, hasilnya dilaporkan lewat toast supaya
   * tidak perlu state `AlertBox` yang hanya hidup selama dialog terbuka.
   */
  async function setAktifkan(aktif: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/stores/${s.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: aktif ? 'active' : 'suspended' }),
      });
      const data = (await res.json()) as { ok: boolean; message: string };
      if (!res.ok || !data.ok) {
        toast.gagal(data.message || 'Gagal mengubah status.');
        return;
      }
      toast.sukses(`${s.nama_toko} ${aktif ? 'diaktifkan' : 'dinonaktifkan'}.`);
      router.refresh();
    } catch {
      toast.gagal('Tidak bisa menghubungi server.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Tautan, bukan button — supaya bisa klik-kanan "buka di tab baru".
          Kelasnya disamakan dengan IconButton agar terlihat sama. */}
      <Link
        href={`/toko/${s.id}`}
        aria-label={`Lihat detail ${s.nama_toko}`}
        title={`Lihat detail ${s.nama_toko}`}
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 lg:h-9 lg:w-9"
      >
        <Eye className="h-4 w-4" />
      </Link>

      <IconButton
        label={`Top up ${s.nama_toko}`}
        onClick={() => setDialog('topup')}
        disabled={busy}
      >
        <KeyRound className="h-4 w-4" />
      </IconButton>

      <IconButton label={`Edit ${s.nama_toko}`} onClick={() => setDialog('edit')} disabled={busy}>
        <Pencil className="h-4 w-4" />
      </IconButton>

      <IconButton
        label={`${s.is_active ? 'Nonaktifkan' : 'Aktifkan'} ${s.nama_toko}`}
        onClick={() => setAktifkan(!s.is_active)}
        disabled={busy}
        className={cn(!s.is_active && 'border-emerald-200 text-emerald-700')}
      >
        {s.is_active ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
      </IconButton>

      <IconButton
        label={`Hapus ${s.nama_toko}`}
        onClick={() => setDialog('hapus')}
        disabled={busy}
        className="border-red-200 text-red-600"
      >
        <Trash2 className="h-4 w-4" />
      </IconButton>

      {/* `Modal` mengembalikan null saat tertutup, jadi 20 island yang membawa
          3 modal ini tidak menambah satu pun node DOM sampai benar-benar dibuka. */}
      {dialog === 'topup' ? (
        <StoreTopupDialog data={s} onClose={tutup} onDone={router.refresh} />
      ) : null}
      {dialog === 'edit' ? (
        <StoreEditDialog data={s} onClose={tutup} onDone={router.refresh} />
      ) : null}
      {dialog === 'hapus' ? (
        <StoreHapusDialog data={s} onClose={tutup} onDone={router.refresh} />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Dialog: Top up 1 toko                                              */
/* ------------------------------------------------------------------ */
function StoreTopupDialog({
  data: s,
  onClose,
  onDone,
}: {
  data: StoreRowData;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [jumlah, setJumlah] = React.useState('5');
  const [catatan, setCatatan] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const n = Number(jumlah);
  const err = cekJumlahKey(n);
  const hasilPreview = Number.isFinite(n)
    ? Math.max(0, s.sisa_kuota + Math.trunc(n))
    : s.sisa_kuota;

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
        body: JSON.stringify({ store_id: s.id, jumlah_key: Math.trunc(n), catatan }),
      });
      const data = (await res.json()) as { ok: boolean; message: string };
      if (!res.ok || !data.ok) {
        setError(data.message || 'Gagal top up.');
        return;
      }
      toast.sukses(data.message);
      onDone();
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
      title={`Isi Ulang Kuota — ${s.nama_toko}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button size="sm" onClick={submit} loading={busy} disabled={busy || !!err}>
            <KeyRound className="h-3.5 w-3.5" />
            Simpan
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5">
        {error ? <AlertBox>{error}</AlertBox> : null}

        <div className="rounded-xl bg-zinc-50 px-3 py-2.5 text-[13px]">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Sisa kuota sekarang</span>
            <span className="tabular font-bold text-zinc-900">{s.sisa_kuota} key</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-zinc-500">Sisa setelah diubah</span>
            <span className="tabular font-bold text-zinc-900">{hasilPreview} key</span>
          </div>
        </div>

        <Field
          label="Jumlah Key"
          htmlFor={`jumlah-${s.id}`}
          required
          error={err}
          hint="Angka positif menambah (mis. 5 = +5 key). Angka negatif mengurangi untuk koreksi."
        >
          <Input
            id={`jumlah-${s.id}`}
            type="number"
            inputMode="numeric"
            step={1}
            value={jumlah}
            onChange={(e) => setJumlah(e.target.value)}
            className={err ? 'input-invalid' : undefined}
          />
        </Field>

        {/* Pintasan cepat */}
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

        <Field label="Catatan (opsional)" htmlFor={`catatan-${s.id}`}>
          <Input
            id={`catatan-${s.id}`}
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="mis. pembayaran transfer BCA"
            maxLength={140}
          />
        </Field>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Dialog: Edit toko (+ reset password)                               */
/* ------------------------------------------------------------------ */
function StoreEditDialog({
  data: s,
  onClose,
  onDone,
}: {
  data: StoreRowData;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [nama, setNama] = React.useState(s.nama_toko);
  const [noHp, setNoHp] = React.useState(s.no_hp ?? '');
  const [alamat, setAlamat] = React.useState(s.alamat ?? '');
  const [email, setEmail] = React.useState(s.email ?? '');
  const [passwordBaru, setPasswordBaru] = React.useState('');
  const [resetPw, setResetPw] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setFieldErrors({});

    const body: Record<string, unknown> = { nama_toko: nama, no_hp: noHp, alamat, email };
    if (resetPw && passwordBaru) body.password_baru = passwordBaru;

    try {
      const res = await fetch(`/api/stores/${s.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        ok: boolean;
        message: string;
        errors?: Record<string, string>;
      };
      if (!res.ok || !data.ok) {
        setError(data.message || 'Gagal menyimpan.');
        if (data.errors) setFieldErrors(data.errors);
        return;
      }
      toast.sukses(data.message);
      onDone();
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
      title={`Edit Toko — ${s.nama_toko}`}
      wide
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button size="sm" onClick={submit} loading={busy} disabled={busy}>
            Simpan
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5">
        {error ? <AlertBox>{error}</AlertBox> : null}

        <Field label="Nama Toko" htmlFor={`e-nama-${s.id}`} required error={fieldErrors.nama_toko}>
          <Input
            id={`e-nama-${s.id}`}
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            className={fieldErrors.nama_toko ? 'input-invalid' : undefined}
          />
        </Field>

        <Field
          label="No HP"
          htmlFor={`e-hp-${s.id}`}
          error={fieldErrors.no_hp}
          hint="Hanya angka, diawali 08"
        >
          <InputTelepon
            id={`e-hp-${s.id}`}
            value={noHp}
            onChange={(e) => setNoHp(e.target.value)}
            className={fieldErrors.no_hp ? 'input-invalid' : undefined}
          />
        </Field>

        <Field label="Alamat" htmlFor={`e-alamat-${s.id}`} error={fieldErrors.alamat}>
          <Textarea
            id={`e-alamat-${s.id}`}
            value={alamat}
            onChange={(e) => setAlamat(e.target.value)}
            rows={2}
            className={fieldErrors.alamat ? 'input-invalid' : undefined}
          />
        </Field>

        <Field
          label="Email Akun"
          htmlFor={`e-email-${s.id}`}
          required
          error={fieldErrors.email}
          hint="Mengubah email juga mengubah email login di Supabase."
        >
          <Input
            id={`e-email-${s.id}`}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={fieldErrors.email ? 'input-invalid' : undefined}
          />
        </Field>

        {/* Reset password (opsional) */}
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5">
          <label className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-zinc-800">
            <input
              type="checkbox"
              checked={resetPw}
              onChange={(e) => setResetPw(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 accent-zinc-900"
            />
            <UserCog className="h-4 w-4 text-zinc-500" />
            Reset password akun toko
          </label>
          {resetPw ? (
            <div className="mt-2.5">
              <Field
                label="Password Baru"
                htmlFor={`e-pw-${s.id}`}
                required
                error={fieldErrors.password_baru}
                hint="Min. 8 karakter, ada huruf & angka. Sampaikan ke pemilik toko."
              >
                <Input
                  id={`e-pw-${s.id}`}
                  type="text"
                  autoComplete="new-password"
                  value={passwordBaru}
                  onChange={(e) => setPasswordBaru(e.target.value)}
                  className={fieldErrors.password_baru ? 'input-invalid' : undefined}
                />
              </Field>
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Dialog: Hapus toko (dengan konfirmasi ketik nama)                 */
/* ------------------------------------------------------------------ */
function StoreHapusDialog({
  data: s,
  onClose,
  onDone,
}: {
  data: StoreRowData;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [konfirmasi, setKonfirmasi] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const cocok = konfirmasi.trim() === s.nama_toko;

  async function submit() {
    if (busy || !cocok) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/stores/${s.id}`, { method: 'DELETE' });
      const data = (await res.json()) as { ok: boolean; message: string };
      if (!res.ok || !data.ok) {
        setError(data.message || 'Gagal menghapus.');
        return;
      }
      toast.sukses(data.message);
      onDone();
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
      title="Hapus Toko"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={submit}
            loading={busy}
            disabled={busy || !cocok}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Hapus permanen
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {error ? <AlertBox>{error}</AlertBox> : null}

        <AlertBox tone="warn">
          Menghapus <strong>{s.nama_toko}</strong> akan ikut menghapus akun login-nya dan{' '}
          <strong>{s.total_terjual} key</strong> yang pernah dibuat. Tindakan ini{' '}
          <strong>tidak bisa dibatalkan</strong>. Kalau hanya ingin menonaktifkan, gunakan tombol
          Nonaktifkan.
        </AlertBox>

        <Field label={`Ketik "${s.nama_toko}" untuk konfirmasi`} htmlFor={`konfirmasi-${s.id}`}>
          <Input
            id={`konfirmasi-${s.id}`}
            value={konfirmasi}
            onChange={(e) => setKonfirmasi(e.target.value)}
            placeholder={s.nama_toko}
            autoComplete="off"
          />
        </Field>
      </div>
    </Modal>
  );
}
