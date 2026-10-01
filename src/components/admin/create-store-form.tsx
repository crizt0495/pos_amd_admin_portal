'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Plus, UserPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field, Input, InputTelepon, Textarea } from '@/components/ui/form';
import { AlertBox } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { cekAlamat, cekEmail, cekPassword, cekTelepon, hanyaDigit, namaValid } from '@/lib/validasi';
import { tierOf } from '@/lib/tier';

const KUOTA_DEFAULT = 5;

export function CreateStoreForm() {
  const router = useRouter();
  const toast = useToast();

  const [nama, setNama] = React.useState('');
  const [noHp, setNoHp] = React.useState('');
  const [alamat, setAlamat] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [kuota, setKuota] = React.useState(String(KUOTA_DEFAULT));
  const [catatan, setCatatan] = React.useState('');

  const [sentuh, setSentuh] = React.useState<Record<string, boolean>>({});
  const [busy, setBusy] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  // Validasi client (feedback cepat) — server tetap validasi ulang.
  const errNama = sentuh.nama ? (namaValid(nama) ? '' : 'Nama toko minimal 3 karakter.') : '';
  const errHp = sentuh.noHp ? cekTelepon(noHp, true) : '';
  const errAlamat = sentuh.alamat ? cekAlamat(alamat, 10, true) : '';
  const errEmail = sentuh.email ? cekEmail(email, true) : '';
  const errPassword = sentuh.password ? cekPassword(password, true) : '';
  const errKuota = sentuh.kuota
    ? (() => {
        const n = Number(kuota);
        if (!Number.isInteger(n) || n < 0 || n > 10_000) return 'Kuota awal 0 - 10.000.';
        return '';
      })()
    : '';

  const semuaValid =
    namaValid(nama) &&
    cekTelepon(noHp, true) === '' &&
    cekAlamat(alamat, 10, true) === '' &&
    cekEmail(email, true) === '' &&
    cekPassword(password, true) === '' &&
    (() => {
      const n = Number(kuota);
      return Number.isInteger(n) && n >= 0 && n <= 10_000;
    })();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    setSentuh({
      nama: true,
      noHp: true,
      alamat: true,
      email: true,
      password: true,
      kuota: true,
    });
    if (!semuaValid) {
      setServerError('Masih ada data yang belum benar. Perbaiki tanda merah dulu.');
      return;
    }

    setBusy(true);
    setServerError(null);
    setFieldErrors({});

    try {
      const res = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama_toko: nama.trim(),
          no_hp: hanyaDigit(noHp),
          alamat: alamat.trim(),
          email: email.trim().toLowerCase(),
          password,
          kuota_awal: Number(kuota),
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        message: string;
        errors?: Record<string, string>;
      };

      if (!res.ok || !data.ok) {
        setServerError(data.message || 'Gagal menyimpan toko.');
        if (data.errors) setFieldErrors(data.errors);
        return;
      }

      toast.sukses(data.message);
      router.push('/toko');
      router.refresh();
    } catch {
      setServerError('Tidak bisa menghubungi server. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  const tierBaru = tierOf(0); // toko baru selalu Bronze

  return (
    <form onSubmit={submit} className="space-y-5">
      {serverError ? <AlertBox>{serverError}</AlertBox> : null}

      <section className="card-soft p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-zinc-500" />
          <h2 className="text-[15px] font-bold">Data Toko</h2>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field
            label="Nama Toko"
            htmlFor="nama"
            required
            error={fieldErrors.nama_toko ?? errNama}
            className="sm:col-span-2"
          >
            <Input
              id="nama"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              onBlur={() => setSentuh((s) => ({ ...s, nama: true }))}
              placeholder="Toko Komputer Maju"
              maxLength={80}
              className={errNama || fieldErrors.nama_toko ? 'input-invalid' : undefined}
            />
          </Field>

          <Field
            label="No HP"
            htmlFor="no_hp"
            required
            error={fieldErrors.no_hp ?? errHp}
            hint="Hanya angka, diawali 08 (mis. 081234567890)"
          >
            <InputTelepon
              id="no_hp"
              value={noHp}
              onChange={(e) => setNoHp(e.target.value)}
              onBlur={() => setSentuh((s) => ({ ...s, noHp: true }))}
              placeholder="081234567890"
              maxLength={13}
              className={errHp || fieldErrors.no_hp ? 'input-invalid' : undefined}
            />
          </Field>

          <Field
            label="Alamat"
            htmlFor="alamat"
            required
            error={fieldErrors.alamat ?? errAlamat}
            className="sm:col-span-2"
          >
            <Textarea
              id="alamat"
              value={alamat}
              onChange={(e) => setAlamat(e.target.value)}
              onBlur={() => setSentuh((s) => ({ ...s, alamat: true }))}
              placeholder="Jl. Merdeka No. 10, Jakarta"
              rows={2}
              maxLength={300}
              className={errAlamat || fieldErrors.alamat ? 'input-invalid' : undefined}
            />
          </Field>
        </div>
      </section>

      <section className="card-soft p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-zinc-500" />
          <h2 className="text-[15px] font-bold">Akun Login Toko</h2>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field
            label="Email Akun"
            htmlFor="email"
            required
            error={fieldErrors.email ?? errEmail}
            hint="Dipakai toko untuk login di portal"
          >
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setSentuh((s) => ({ ...s, email: true }))}
              placeholder="toko@email.com"
              maxLength={120}
              className={errEmail || fieldErrors.email ? 'input-invalid' : undefined}
            />
          </Field>

          <Field
            label="Password Akun"
            htmlFor="password"
            required
            error={fieldErrors.password ?? errPassword}
            hint="Min. 8 karakter, ada huruf & angka"
          >
            <Input
              id="password"
              type="text"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setSentuh((s) => ({ ...s, password: true }))}
              placeholder="mis. toko12345"
              className={errPassword || fieldErrors.password ? 'input-invalid' : undefined}
            />
          </Field>

          <Field
            label="Kuota Awal (key)"
            htmlFor="kuota"
            required
            error={fieldErrors.kuota_awal ?? errKuota}
            hint={`Bisa diubah nanti lewat menu Top Up. Default ${KUOTA_DEFAULT}.`}
          >
            <Input
              id="kuota"
              type="number"
              inputMode="numeric"
              min={0}
              max={10000}
              step={1}
              value={kuota}
              onChange={(e) => setKuota(e.target.value)}
              onBlur={() => setSentuh((s) => ({ ...s, kuota: true }))}
              className={errKuota || fieldErrors.kuota_awal ? 'input-invalid' : undefined}
            />
          </Field>

          <Field
            label="Tier Awal"
            htmlFor="tier"
            hint="Otomatis, tidak bisa diubah manual"
          >
            <Input
              id="tier"
              value={`${tierBaru.name} (${tierBaru.rate * 100}% komisi)`}
              disabled
              readOnly
              className="bg-zinc-50 text-zinc-500"
            />
          </Field>

          <Field
            label="Catatan Admin (opsional)"
            htmlFor="catatan"
            className="sm:col-span-2"
            hint="Tersimpan di riwayat top up sebagai jejak awal"
          >
            <Input
              id="catatan"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="mis. daftar via WA 12 Okt"
              maxLength={140}
            />
          </Field>
        </div>
      </section>

      <AlertBox tone="info">
        Tier toko <strong>dihitung otomatis</strong> dari jumlah key terjual (Bronze 1-5, Silver 6-10,
        Gold 11-30, Platinum 30+). Jadi field Tier Awal tidak bisa diisi manual — toko baru selalu
        Bronze.
      </AlertBox>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/toko')}
          disabled={busy}
        >
          Batal
        </Button>
        <Button type="submit" loading={busy} disabled={busy}>
          <Plus className="h-4 w-4" />
          Daftarkan Toko
        </Button>
      </div>
    </form>
  );
}
