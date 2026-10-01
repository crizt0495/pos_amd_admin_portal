'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Ban,
  CheckCircle2,
  Eye,
  KeyRound,
  Layers,
  Pencil,
  Search,
  Trash2,
  UserCog,
  X,
} from 'lucide-react';

import { Button, IconButton } from '@/components/ui/button';
import { KuotaBadge, StoreStatusBadge, TierBadge } from '@/components/ui/badge';
import { Field, Input, InputTelepon, Textarea } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import {
  AlertBox,
  CardActions,
  CardBadges,
  CardField,
  CardHeader,
  CardItem,
  EmptyState,
  TableCards,
  TableWrap,
  Td,
  Th,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { sejak } from '@/lib/format';
import { cekJumlahKey } from '@/lib/validasi';
import { cn } from '@/lib/utils';
import type { Store } from '@/types';

/**
 * ============================================================================
 *  MANAGER TOKO — tabel + semua aksi (top up, edit, aktif/nonaktif, hapus)
 * ============================================================================
 *  Dipakai di halaman /toko. Semua perubahan lewat fetch ke /api/stores/* dan
 *  /api/topup, lalu `router.refresh()` supaya angka di server ikut terbarui.
 * ============================================================================
 */

type Dialog =
  | { kind: 'topup'; store: Store }
  | { kind: 'edit'; store: Store }
  | { kind: 'hapus'; store: Store }
  | { kind: 'bulk' }
  | null;

export function StoreManager({ stores }: { stores: Store[] }) {
  const router = useRouter();
  const toast = useToast();

  const [cari, setCari] = React.useState('');
  const [dialog, setDialog] = React.useState<Dialog>(null);
  const [dipilih, setDipilih] = React.useState<Set<string>>(new Set());

  const terfilter = React.useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter((s) =>
      [s.nama_toko, s.email ?? '', s.no_hp ?? '', s.alamat ?? '', s.tier]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [stores, cari]);

  const semuaTerpilih = terfilter.length > 0 && terfilter.every((s) => dipilih.has(s.id));

  function togglePilih(id: string) {
    setDipilih((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSemua() {
    setDipilih((prev) => {
      if (semuaTerpilih) {
        // buang semua yang sedang terpilih (bukan cuma yang terlihat)
        return new Set();
      }
      return new Set(terfilter.map((s) => s.id));
    });
  }

  function tutup() {
    setDialog(null);
  }

  /**
   * Deretan aksi untuk satu toko. Dipakai dua kali — di baris tabel (desktop)
   * dan di kartu (HP) — supaya tidak ada kode aksi yang dobel.
   */
  function aksiToko(s: Store) {
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
          onClick={() => setDialog({ kind: 'topup', store: s })}
        >
          <KeyRound className="h-4 w-4" />
        </IconButton>
        <IconButton label={`Edit ${s.nama_toko}`} onClick={() => setDialog({ kind: 'edit', store: s })}>
          <Pencil className="h-4 w-4" />
        </IconButton>
        <IconButton
          label={`${s.is_active ? 'Nonaktifkan' : 'Aktifkan'} ${s.nama_toko}`}
          onClick={() => setAktifkan(s, !s.is_active)}
          disabled={s.is_active}
          className={cn(!s.is_active && 'border-emerald-200 text-emerald-700')}
        >
          {s.is_active ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
        </IconButton>
        <IconButton
          label={`Hapus ${s.nama_toko}`}
          onClick={() => setDialog({ kind: 'hapus', store: s })}
          className="border-red-200 text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </IconButton>
      </>
    );
  }

  /**
   * Checkbox pilihan toko.
   *
   * Kotaknya sengaja hanya 20px (biar tidak memenuhi kartu), tapi dibungkus
   * `<label>` 44px supaya area sentuhnya mencapai target minimum di HP —
   * mengetik label membuat area kosong di sekelilingnya ikut memindahkan centang.
   */
  const checkbox = (s: Store) => (
    <label className="-m-2 grid h-11 w-11 cursor-pointer place-items-center">
      <input
        type="checkbox"
        checked={dipilih.has(s.id)}
        onChange={() => togglePilih(s.id)}
        aria-label={`Pilih ${s.nama_toko}`}
        className="h-5 w-5 rounded border-zinc-300 accent-zinc-900"
      />
    </label>
  );

  /** Checkbox "pilih semua" di header tabel. */
  const checkboxSemua = (
    <label className="-mx-3 -my-2.5 grid h-11 w-11 cursor-pointer place-items-center">
      <input
        type="checkbox"
        checked={semuaTerpilih}
        onChange={toggleSemua}
        aria-label="Pilih semua toko"
        className="h-5 w-5 rounded border-zinc-300 accent-zinc-900"
      />
    </label>
  );

  return (
    <>
      {/* Toolbar: cari + bulk */}
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
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {dipilih.size > 0 ? (
            <>
              <span className="text-[12.5px] font-semibold text-zinc-600">
                {dipilih.size} dipilih
              </span>
              <Button variant="outline" size="sm" onClick={() => setDialog({ kind: 'bulk' })}>
                <Layers className="h-3.5 w-3.5" />
                Top Up Massal
              </Button>
              <IconButton label="Batalkan pilihan" onClick={() => setDipilih(new Set())}>
                <X className="h-4 w-4" />
              </IconButton>
            </>
          ) : (
            <span className="text-[12.5px] text-zinc-500">
              {stores.length} toko · centang untuk top up massal
            </span>
          )}
        </div>
      </div>

      {terfilter.length === 0 ? (
        <EmptyState
          title={cari ? 'Tidak ada toko yang cocok' : 'Belum ada toko terdaftar'}
          description={
            cari
              ? `Tidak ditemukan toko dengan kata kunci "${cari}".`
              : 'Daftarkan toko pertama untuk mulai mengelola kuota & key.'
          }
          action={
            cari ? (
              <Button variant="outline" size="sm" onClick={() => setCari('')}>
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
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th className="w-9">{checkboxSemua}</Th>
              <Th>Nama Toko</Th>
              <Th>Email Akun</Th>
              <Th>No HP</Th>
              <Th>Alamat</Th>
              <Th>Tier</Th>
              <Th className="text-right">Terjual</Th>
              <Th className="text-right">Sisa Kuota</Th>
              <Th>Status</Th>
              <Th className="text-right">Aksi</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {terfilter.map((s) => (
              <tr key={s.id} className="transition hover:bg-zinc-50/70">
                <Td>{checkbox(s)}</Td>
                <Td>
                  <Link
                    href={`/toko/${s.id}`}
                    className="font-semibold text-zinc-900 underline-offset-2 hover:underline"
                  >
                    {s.nama_toko}
                  </Link>
                  <p className="text-[11px] text-zinc-400">daftar {sejak(s.created_at)}</p>
                </Td>
                <Td className="text-zinc-600">{s.email ?? '-'}</Td>
                <Td className="tabular text-zinc-600">{s.no_hp ?? '-'}</Td>
                <Td className="max-w-[200px] truncate text-zinc-600" title={s.alamat ?? ''}>
                  {s.alamat ?? '-'}
                </Td>
                <Td>
                  <TierBadge tier={s.tier} />
                </Td>
                <Td className="tabular text-right">{s.total_terjual}</Td>
                <Td className="text-right">
                  <KuotaBadge sisa={s.sisa_kuota} />
                </Td>
                <Td>
                  <StoreStatusBadge aktif={s.is_active} />
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-1">{aksiToko(s)}</div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      {/* Tampilan HP: kartu satu per toko — tanpa scroll horizontal.
          Render ulang karena tabel disembunyikan di bawah `lg`. */}
      {terfilter.length > 0 ? (
        <TableCards>
          {terfilter.map((s) => (
            <CardItem key={s.id}>
              <CardHeader
                right={checkbox(s)}
                title={
                  <Link
                    href={`/toko/${s.id}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {s.nama_toko}
                  </Link>
                }
                subtitle={`daftar ${sejak(s.created_at)}`}
              />
              <div className="mt-2.5 space-y-1">
                <CardField label="Email">{s.email ?? '-'}</CardField>
                <CardField label="No HP">
                  <span className="tabular">{s.no_hp ?? '-'}</span>
                </CardField>
                <CardField label="Alamat">{s.alamat ?? '-'}</CardField>
                <CardField label="Terjual">
                  <span className="tabular">{s.total_terjual}</span>
                </CardField>
                <CardField label="Sisa kuota">
                  <KuotaBadge sisa={s.sisa_kuota} />
                </CardField>
              </div>
              <CardBadges>
                <TierBadge tier={s.tier} />
                <StoreStatusBadge aktif={s.is_active} />
              </CardBadges>
              <CardActions>{aksiToko(s)}</CardActions>
            </CardItem>
          ))}
        </TableCards>
      ) : null}

      {/* ================= Dialog: Top Up ================= */}
      {dialog?.kind === 'topup' ? (
        <TopupDialog store={dialog.store} onClose={tutup} onDone={refresh} />
      ) : null}

      {/* ================= Dialog: Bulk Top Up ================= */}
      {dialog?.kind === 'bulk' ? (
        <BulkTopupDialog
          stores={stores.filter((s) => dipilih.has(s.id))}
          onClose={tutup}
          onDone={() => {
            setDipilih(new Set());
            refresh();
          }}
        />
      ) : null}

      {/* ================= Dialog: Edit ================= */}
      {dialog?.kind === 'edit' ? (
        <EditDialog store={dialog.store} onClose={tutup} onDone={refresh} />
      ) : null}

      {/* ================= Dialog: Hapus ================= */}
      {dialog?.kind === 'hapus' ? (
        <HapusDialog store={dialog.store} onClose={tutup} onDone={refresh} />
      ) : null}
    </>
  );

  function refresh() {
    router.refresh();
  }

  async function setAktifkan(store: Store, aktif: boolean) {
    try {
      const res = await fetch(`/api/stores/${store.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: aktif ? 'active' : 'suspended' }),
      });
      const data = (await res.json()) as { ok: boolean; message: string };
      if (!res.ok || !data.ok) {
        toast.gagal(data.message || 'Gagal mengubah status.');
        return;
      }
      toast.sukses(`${store.nama_toko} ${aktif ? 'diaktifkan' : 'dinonaktifkan'}.`);
      refresh();
    } catch {
      toast.gagal('Tidak bisa menghubungi server.');
    }
  }
}

/* ------------------------------------------------------------------ */
/* Dialog: Top up 1 toko                                              */
/* ------------------------------------------------------------------ */
function TopupDialog({
  store,
  onClose,
  onDone,
}: {
  store: Store;
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
  const hasilPreview = Number.isFinite(n) ? Math.max(0, store.sisa_kuota + Math.trunc(n)) : store.sisa_kuota;

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
      title={`Isi Ulang Kuota — ${store.nama_toko}`}
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
            <span className="tabular font-bold text-zinc-900">{store.sisa_kuota} key</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-zinc-500">Sisa setelah diubah</span>
            <span className="tabular font-bold text-zinc-900">{hasilPreview} key</span>
          </div>
        </div>

        <Field
          label="Jumlah Key"
          htmlFor="jumlah"
          required
          error={err}
          hint="Angka positif menambah (mis. 5 = +5 key). Angka negatif mengurangi untuk koreksi."
        >
          <Input
            id="jumlah"
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

        <Field label="Catatan (opsional)" htmlFor="catatan">
          <Input
            id="catatan"
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
/* Dialog: Top up massal                                              */
/* ------------------------------------------------------------------ */
function BulkTopupDialog({
  stores,
  onClose,
  onDone,
}: {
  stores: Store[];
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
          store_ids: stores.map((s) => s.id),
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
      title={`Top Up Massal — ${stores.length} toko`}
      wide
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button size="sm" onClick={submit} loading={busy} disabled={busy || !!err || stores.length === 0}>
            <Layers className="h-3.5 w-3.5" />
            Terapkan ke {stores.length} toko
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5">
        {error ? <AlertBox>{error}</AlertBox> : null}

        <div className="rounded-xl bg-zinc-50 px-3 py-2.5 text-[13px]">
          <p className="font-semibold text-zinc-700">Toko yang dipilih:</p>
          <ul className="mt-1.5 max-h-32 space-y-0.5 overflow-y-auto text-[12.5px] text-zinc-600">
            {stores.map((s) => (
              <li key={s.id} className="truncate">
                • {s.nama_toko}{' '}
                <span className="text-zinc-400">(sisa {s.sisa_kuota} → {Math.max(0, s.sisa_kuota + Math.trunc(n || 0))})</span>
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

/* ------------------------------------------------------------------ */
/* Dialog: Edit toko (+ reset password)                               */
/* ------------------------------------------------------------------ */
function EditDialog({
  store,
  onClose,
  onDone,
}: {
  store: Store;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [nama, setNama] = React.useState(store.nama_toko);
  const [noHp, setNoHp] = React.useState(store.no_hp ?? '');
  const [alamat, setAlamat] = React.useState(store.alamat ?? '');
  const [email, setEmail] = React.useState(store.email ?? '');
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

    const body: Record<string, unknown> = {
      nama_toko: nama,
      no_hp: noHp,
      alamat,
      email,
    };
    if (resetPw && passwordBaru) body.password_baru = passwordBaru;

    try {
      const res = await fetch(`/api/stores/${store.id}`, {
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
      title={`Edit Toko — ${store.nama_toko}`}
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

        <Field label="Nama Toko" htmlFor="e-nama" required error={fieldErrors.nama_toko}>
          <Input
            id="e-nama"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            className={fieldErrors.nama_toko ? 'input-invalid' : undefined}
          />
        </Field>

        <Field label="No HP" htmlFor="e-hp" error={fieldErrors.no_hp} hint="Hanya angka, diawali 08">
          <InputTelepon
            id="e-hp"
            value={noHp}
            onChange={(e) => setNoHp(e.target.value)}
            className={fieldErrors.no_hp ? 'input-invalid' : undefined}
          />
        </Field>

        <Field label="Alamat" htmlFor="e-alamat" error={fieldErrors.alamat}>
          <Textarea
            id="e-alamat"
            value={alamat}
            onChange={(e) => setAlamat(e.target.value)}
            rows={2}
            className={fieldErrors.alamat ? 'input-invalid' : undefined}
          />
        </Field>

        <Field
          label="Email Akun"
          htmlFor="e-email"
          required
          error={fieldErrors.email}
          hint="Mengubah email juga mengubah email login di Supabase."
        >
          <Input
            id="e-email"
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
                htmlFor="e-pw"
                required
                error={fieldErrors.password_baru}
                hint="Min. 8 karakter, ada huruf & angka. Sampaikan ke pemilik toko."
              >
                <Input
                  id="e-pw"
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
function HapusDialog({
  store,
  onClose,
  onDone,
}: {
  store: Store;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [konfirmasi, setKonfirmasi] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const cocok = konfirmasi.trim() === store.nama_toko;

  async function submit() {
    if (busy || !cocok) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/stores/${store.id}`, { method: 'DELETE' });
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
          Menghapus <strong>{store.nama_toko}</strong> akan ikut menghapus akun login-nya dan{' '}
          <strong>{store.total_terjual} key</strong> yang pernah dibuat. Tindakan ini{' '}
          <strong>tidak bisa dibatalkan</strong>. Kalau hanya ingin menonaktifkan, gunakan tombol
          Nonaktifkan.
        </AlertBox>

        <Field label={`Ketik "${store.nama_toko}" untuk konfirmasi`} htmlFor="konfirmasi">
          <Input
            id="konfirmasi"
            value={konfirmasi}
            onChange={(e) => setKonfirmasi(e.target.value)}
            placeholder={store.nama_toko}
            autoComplete="off"
          />
        </Field>
      </div>
    </Modal>
  );
}
