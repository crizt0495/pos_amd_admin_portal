'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { KeyRound, Layers, Search, UserCog } from 'lucide-react';

import { Button, IconButton } from '@/components/ui/button';
import { KuotaBadge, StoreStatusBadge, TierBadge } from '@/components/ui/badge';
import { Field, Input } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import {
  AlertBox,
  EmptyState,
  ListCell,
  ListHead,
  ListHeadCell,
  ListRow,
  ListShell,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { cekJumlahKey, cekPassword } from '@/lib/validasi';
import { rupiah, sejak } from '@/lib/format';
import type { Store } from '@/types';

/**
 * ============================================================================
 *  MANAGER AKUN TOKO — daftar akun login + reset password + top up massal
 * ============================================================================
 *  Halaman /akun. Fokusnya sisi "akun" (bukan data operasional toko), makanya
 *  kolomnya email/username/kuota, dan aksi utamanya reset password & generate
 *  kuota massal. Edit profil & hapus toko tetap ada di /toko.
 * ============================================================================
 */

type Dialog =
  { kind: 'reset-pw'; store: Store } | { kind: 'topup'; store: Store } | { kind: 'bulk' } | null;

/**
 * Template kolom `lg:` untuk daftar akun — PERSIS sama antara `ListHead`
 * dan `ListRow` supaya judul kolom dan isi sejajar. Di bawah `lg` diabaikan:
 * tiap sel jadi blok bertumpuk dengan `ListLabel`.
 */
const GRID_AKUN =
  'lg:grid-cols-[34px_minmax(140px,1.2fr)_minmax(148px,1.2fr)_minmax(104px,.75fr)_minmax(80px,.55fr)_minmax(70px,.5fr)_minmax(96px,.65fr)_minmax(104px,.7fr)_minmax(96px,.65fr)_minmax(78px,auto)]';

export function AkunManager({ stores }: { stores: Store[] }) {
  const router = useRouter();
  const toast = useToast();

  const [cari, setCari] = React.useState('');
  const [dialog, setDialog] = React.useState<Dialog>(null);
  const [dipilih, setDipilih] = React.useState<Set<string>>(new Set());

  const denganAkun = React.useMemo(() => stores.filter((s) => !!s.user_id), [stores]);
  const tanpaAkun = React.useMemo(() => stores.filter((s) => !s.user_id), [stores]);

  const terfilter = React.useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (!q) return denganAkun;
    return denganAkun.filter((s) =>
      [s.nama_toko, s.email ?? '', s.username ?? ''].join(' ').toLowerCase().includes(q),
    );
  }, [denganAkun, cari]);

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
    setDipilih((prev) => (semuaTerpilih ? new Set() : new Set(terfilter.map((s) => s.id))));
  }

  /** Aksi akun toko — dipakai baris tabel (desktop) & kartu (HP). */
  function aksiAkun(s: Store) {
    return (
      <>
        <IconButton
          label={`Top up ${s.nama_toko}`}
          onClick={() => setDialog({ kind: 'topup', store: s })}
        >
          <KeyRound className="h-4 w-4" />
        </IconButton>
        <IconButton
          label={`Reset password ${s.nama_toko}`}
          onClick={() => setDialog({ kind: 'reset-pw', store: s })}
        >
          <UserCog className="h-4 w-4" />
        </IconButton>
      </>
    );
  }

  /**
   * Checkbox akun toko — area sentuh 44px lewat pembungkus `<label>`,
   * sementara kotak centangnya tetap 20px supaya tidak memenuhi kartu.
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
        aria-label="Pilih semua akun"
        className="h-5 w-5 rounded border-zinc-300 accent-zinc-900"
      />
    </label>
  );

  return (
    <>
      <div className="mb-3 flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari nama toko, email, username…"
            className="pl-9"
            aria-label="Cari akun toko"
          />
        </div>

        {dipilih.size > 0 ? (
          <>
            <span className="text-[12.5px] font-semibold text-zinc-600">
              {dipilih.size} dipilih
            </span>
            <Button variant="outline" size="sm" onClick={() => setDialog({ kind: 'bulk' })}>
              <Layers className="h-3.5 w-3.5" />
              Generate Kuota Massal
            </Button>
          </>
        ) : (
          <span className="text-[12.5px] text-zinc-500">{denganAkun.length} akun toko</span>
        )}
      </div>

      {terfilter.length === 0 ? (
        <EmptyState
          title={cari ? 'Tidak ada akun yang cocok' : 'Belum ada akun toko'}
          description={
            cari
              ? `Tidak ditemukan akun dengan kata kunci "${cari}".`
              : 'Daftarkan toko baru untuk membuat akun login pertamanya.'
          }
          action={
            <Link
              href="/toko/baru"
              className="inline-flex h-11 items-center rounded-lg bg-zinc-900 px-3 text-[13px] font-semibold text-white lg:h-9"
            >
              Daftar Toko Baru
            </Link>
          }
        />
      ) : (
        /*
         * SATU markup untuk HP & desktop — pola yang sama dengan /keys dan
         * /toko. Sebelumnya <TableWrap> (tabel, `hidden` di bawah `lg`) DAN
         * `TableCards` (kartu, `lg:hidden`) dirender bersamaan; `display:none`
         * tidak menghentikan React merender + hydrate, jadi tiap akun
         * ter-render DUA kali. Ini halaman dengan TBT tertinggi (576 ms).
         */
        <ListShell>
          <ListHead gridClass={GRID_AKUN}>
            <span className="flex items-center">{checkboxSemua}</span>
            <ListHeadCell>Nama Toko</ListHeadCell>
            <ListHeadCell>Email Login</ListHeadCell>
            <ListHeadCell>Username</ListHeadCell>
            <ListHeadCell>Tier</ListHeadCell>
            <ListHeadCell className="text-right">Terjual</ListHeadCell>
            <ListHeadCell className="text-right">Sisa Kuota</ListHeadCell>
            <ListHeadCell>Komisi</ListHeadCell>
            <ListHeadCell>Status</ListHeadCell>
            <ListHeadCell className="text-right">Aksi</ListHeadCell>
          </ListHead>

          <ul className="divide-y divide-zinc-100">
            {terfilter.map((s) => (
              <ListRow key={s.id} gridClass={GRID_AKUN}>
                {/* 1 — centang */}
                <div className="flex items-center">{checkbox(s)}</div>

                {/* 2 — Nama toko + tanggal daftar */}
                <ListCell label="Nama Toko">
                  <Link
                    href={`/toko/${s.id}`}
                    className="font-semibold text-zinc-900 underline-offset-2 hover:underline"
                  >
                    {s.nama_toko}
                  </Link>
                  <p className="text-[11px] text-zinc-500">daftar {sejak(s.created_at)}</p>
                </ListCell>

                {/* 3 — Email login */}
                <ListCell label="Email Login">
                  <span className="text-zinc-600">{s.email ?? '-'}</span>
                </ListCell>

                {/* 4 — Username */}
                <ListCell label="Username">
                  <span className="text-zinc-600">{s.username ?? '-'}</span>
                </ListCell>

                {/* 5 — Tier */}
                <ListCell label="Tier">
                  <TierBadge tier={s.tier} />
                </ListCell>

                {/* 6 — Terjual */}
                <ListCell label="Terjual" className="tabular lg:text-right">
                  <span>{s.total_terjual}</span>
                </ListCell>

                {/* 7 — Sisa kuota */}
                <ListCell label="Sisa Kuota" className="lg:text-right">
                  <KuotaBadge sisa={s.sisa_kuota} />
                </ListCell>

                {/* 8 — Komisi */}
                <ListCell label="Komisi" className="tabular text-zinc-600">
                  <span>{rupiah(s.komisi_total)}</span>
                </ListCell>

                {/* 9 — Status */}
                <ListCell label="Status">
                  <StoreStatusBadge aktif={s.is_active} />
                </ListCell>

                {/* 10 — Aksi */}
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 lg:mt-0 lg:justify-end">
                  {aksiAkun(s)}
                </div>
              </ListRow>
            ))}
          </ul>
        </ListShell>
      )}

      {/* Warning: toko tanpa akun auth */}
      {tanpaAkun.length > 0 ? (
        <div className="mt-3">
          <AlertBox tone="warn">
            {tanpaAkun.length} baris toko tidak terhubung ke akun Supabase Auth sehingga tidak bisa
            login & tidak bisa reset password dari sini:{' '}
            <strong>{tanpaAkun.map((s) => s.nama_toko).join(', ')}</strong>. Perbaiki manual di
            Supabase Dashboard.
          </AlertBox>
        </div>
      ) : null}

      {dialog?.kind === 'reset-pw' ? (
        <ResetPasswordDialog
          store={dialog.store}
          onClose={() => setDialog(null)}
          onDone={() => router.refresh()}
        />
      ) : null}

      {dialog?.kind === 'topup' ? (
        <BulkKuotaDialog
          stores={[dialog.store]}
          onClose={() => setDialog(null)}
          onDone={() => router.refresh()}
        />
      ) : null}

      {dialog?.kind === 'bulk' ? (
        <BulkKuotaDialog
          stores={stores.filter((s) => dipilih.has(s.id))}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDipilih(new Set());
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Dialog: reset password                                             */
/* ------------------------------------------------------------------ */
function ResetPasswordDialog({
  store,
  onClose,
  onDone,
}: {
  store: Store;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const err = password ? cekPassword(password, true) : '';
  const valid = password.length > 0 && err === '';

  async function submit() {
    if (busy || !valid) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/akun/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: store.id, password_baru: password }),
      });
      const data = (await res.json()) as { ok: boolean; message: string };
      if (!res.ok || !data.ok) {
        setError(data.message || 'Gagal reset password.');
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
      title={`Reset Password — ${store.nama_toko}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button size="sm" onClick={submit} loading={busy} disabled={busy || !valid}>
            Reset Password
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5">
        {error ? <AlertBox>{error}</AlertBox> : null}

        <div className="rounded-xl bg-zinc-50 px-3 py-2.5 text-[13px]">
          <p className="font-semibold text-zinc-800">{store.email ?? store.nama_toko}</p>
          <p className="text-[12px] text-zinc-500">username: {store.username ?? '-'}</p>
        </div>

        <Field
          label="Password Baru"
          htmlFor="rp-pw"
          required
          error={err}
          hint="Min. 8 karakter, ada huruf & angka. Tidak dikirim via email — sampaikan manual ke toko."
        >
          <Input
            id="rp-pw"
            type="text"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="mis. toko12345"
            className={err ? 'input-invalid' : undefined}
          />
        </Field>

        <p className="text-[12px] text-zinc-500">
          Password lama tidak pernah disimpan di mana pun, jadi tidak bisa ditampilkan lagi.
        </p>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Dialog: generate kuota massal                                     */
/* ------------------------------------------------------------------ */
function BulkKuotaDialog({
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
      title={`Generate Kuota Massal — ${stores.length} toko`}
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
            disabled={busy || !!err || stores.length === 0}
          >
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
                <span className="text-zinc-500">
                  (sisa {s.sisa_kuota} → {Math.max(0, s.sisa_kuota + Math.trunc(n || 0))})
                </span>
              </li>
            ))}
          </ul>
        </div>

        <Field
          label="Jumlah Key per toko"
          htmlFor="bk-jumlah"
          required
          error={err}
          hint="Diterapkan sama ke semua toko terpilih."
        >
          <Input
            id="bk-jumlah"
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

        <Field label="Catatan (opsional)" htmlFor="bk-catatan">
          <Input
            id="bk-catatan"
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
