import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ArrowLeft,
  History,
  KeyRound,
  MapPin,
  Phone,
  Store as StoreIcon,
  Wallet,
} from 'lucide-react';

import { KeyStatusBadge, KuotaBadge, StoreStatusBadge, TierBadge } from '@/components/ui/badge';
import {
  EmptyState,
  ListCell,
  ListHead,
  ListHeadCell,
  ListRow,
  ListShell,
} from '@/components/ui/table';
import { TopupStoreButton } from '@/components/admin/topup-store-button';
import { getStoreDetail } from '@/lib/data';
import { angka, rupiah, sejak, tanggalWaktu } from '@/lib/format';
import { LICENSE_TYPE_LABEL, PAKET_LABEL, tierRangeLabel, tierRule } from '@/lib/tier';
import { requireAdmin } from '@/lib/supabase/guard';

/**
 * Template kolom `lg:` untuk daftar key milik toko ini — PERSIS sama antara
 * `ListHead` dan `ListRow` supaya judul kolom dan isi sejajar. Di bawah `lg`
 * diabaikan: tiap sel jadi blok bertumpuk dengan `ListLabel`.
 */
const GRID_KEY_TOKO =
  'lg:grid-cols-[minmax(120px,1fr)_minmax(150px,1.3fr)_minmax(104px,.75fr)_minmax(90px,.6fr)_minmax(90px,.6fr)_minmax(100px,.7fr)_minmax(120px,.8fr)_minmax(96px,.65fr)]';

export const metadata: Metadata = { title: 'Detail Toko' };
export const dynamic = 'force-dynamic';

export default async function TokoDetailPage({ params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) redirect('/login');

  const { store, keys, topups } = await getStoreDetail(params.id);
  if (!store) notFound();

  const tier = tierRule(store.tier);
  const komisiTerpakai = keys.reduce((s, k) => s + (k.komisi ?? 0), 0);

  return (
    <div className="space-y-4">
      <header>
        <Link
          href="/toko"
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-zinc-600 transition hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke daftar toko
        </Link>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-[20px] font-bold text-zinc-900">
              <StoreIcon className="h-5 w-5 text-zinc-500" />
              {store.nama_toko}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <TierBadge tier={store.tier} />
              <StoreStatusBadge aktif={store.is_active} />
              <span className="text-[12px] text-zinc-500">
                {tier.rate * 100}% komisi · {tierRangeLabel(tier)}
              </span>
            </div>
          </div>
          <TopupStoreButton store={store} />
        </div>
      </header>

      {/* Kartu info */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card-soft p-4">
          <p className="text-[12px] font-semibold text-zinc-500">Sisa Kuota</p>
          <p className="tabular mt-1.5 text-[20px] font-bold leading-none text-zinc-900">
            {store.sisa_kuota} key
          </p>
          {store.sisa_kuota <= 0 ? (
            <p className="mt-1.5 text-[11.5px] font-semibold text-red-600">
              Habis — toko tidak bisa generate key
            </p>
          ) : null}
        </div>
        <div className="card-soft p-4">
          <p className="text-[12px] font-semibold text-zinc-500">Total Terjual</p>
          <p className="tabular mt-1.5 text-[20px] font-bold leading-none text-zinc-900">
            {angka(store.total_terjual)} key
          </p>
        </div>
        <div className="card-soft p-4">
          <p className="text-[12px] font-semibold text-zinc-500">Komisi Terakumulasi</p>
          <p className="tabular mt-1.5 text-[20px] font-bold leading-none text-zinc-900">
            {rupiah(store.komisi_total)}
          </p>
        </div>
        <div className="card-soft p-4">
          <p className="text-[12px] font-semibold text-zinc-500">Kontak</p>
          <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-zinc-700">
            <Phone className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
            <span className="tabular">{store.no_hp ?? '-'}</span>
          </p>
          <p className="mt-0.5 truncate text-[12.5px] text-zinc-700" title={store.email ?? ''}>
            {store.email ?? '-'}
          </p>
        </div>
      </div>

      {/* Alamat */}
      {store.alamat ? (
        <div className="card-soft flex items-start gap-2 p-3.5">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
          <p className="text-[13px] leading-relaxed text-zinc-700">{store.alamat}</p>
        </div>
      ) : null}

      {/* Riwayat generate key */}
      <section className="card-soft overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3.5 sm:px-5">
          <div>
            <h2 className="flex items-center gap-2 text-[15px] font-bold">
              <KeyRound className="h-4 w-4 text-zinc-500" />
              Riwayat Generate Key
            </h2>
            <p className="text-[12px] text-zinc-500">
              {keys.length} key · komisi tercatat {rupiah(komisiTerpakai)}
            </p>
          </div>
        </div>

        {keys.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="Belum ada key"
              description={`${store.nama_toko} belum pernah generate serial key.`}
            />
          </div>
        ) : (
          <>
            <>
              {/*
               * SATU markup untuk HP & desktop — pola yang sama dengan /keys,
               * /toko, dan /akun. Sebelumnya tabel + kartu dirender bersamaan
               * lalu disembunyikan lewat CSS; `display:none` tidak menghentikan
               * React merender + hydrate, jadi tiap key ter-render DUA kali.
               */}
              <ListShell>
                <ListHead gridClass={GRID_KEY_TOKO}>
                  <ListHeadCell>Serial Key</ListHeadCell>
                  <ListHeadCell>Pembeli</ListHeadCell>
                  <ListHeadCell>Telepon</ListHeadCell>
                  <ListHeadCell>Paket</ListHeadCell>
                  <ListHeadCell>Pilihan</ListHeadCell>
                  <ListHeadCell className="text-right">Komisi</ListHeadCell>
                  <ListHeadCell>Tanggal</ListHeadCell>
                  <ListHeadCell>Status</ListHeadCell>
                </ListHead>

                <ul className="divide-y divide-zinc-100">
                  {keys.map((k) => (
                    <ListRow key={k.id} gridClass={GRID_KEY_TOKO}>
                      {/* 1 — Serial key */}
                      <ListCell
                        label="Serial Key"
                        className="font-mono text-[12px] font-semibold text-zinc-900"
                      >
                        {k.serial_key}
                      </ListCell>

                      {/* 2 — Pembeli */}
                      <ListCell label="Pembeli">
                        <span>{k.nama_pembeli}</span>
                      </ListCell>

                      {/* 3 — Telepon */}
                      <ListCell label="Telepon">
                        <span className="tabular text-zinc-600">{k.telepon ?? '-'}</span>
                      </ListCell>

                      {/* 4 — Paket */}
                      <ListCell label="Paket">
                        <span>{PAKET_LABEL[k.paket]}</span>
                      </ListCell>

                      {/* 5 — Pilihan */}
                      <ListCell label="Pilihan">
                        <span>{LICENSE_TYPE_LABEL[k.pilihan]}</span>
                      </ListCell>

                      {/* 6 — Komisi */}
                      <ListCell label="Komisi" className="tabular lg:text-right">
                        <span>{rupiah(k.komisi)}</span>
                      </ListCell>

                      {/* 7 — Tanggal */}
                      <ListCell label="Tanggal">
                        <span className="text-zinc-600">{tanggalWaktu(k.created_at)}</span>
                      </ListCell>

                      {/* 8 — Status */}
                      <ListCell label="Status">
                        <KeyStatusBadge status={k.status} />
                      </ListCell>
                    </ListRow>
                  ))}
                </ul>
              </ListShell>
            </>
          </>
        )}
      </section>

      {/* Riwayat top up */}
      <section className="card-soft overflow-hidden">
        <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3.5 sm:px-5">
          <History className="h-4 w-4 text-zinc-500" />
          <div>
            <h2 className="text-[15px] font-bold">Riwayat Top Up Kuota</h2>
            <p className="text-[12px] text-zinc-500">Jejak audit penambahan kuota oleh admin</p>
          </div>
        </div>

        {topups.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px] text-zinc-500">
            Belum ada riwayat top up. Kuota awal {store.sisa_kuota} key.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {topups.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <Wallet
                  className={`h-4 w-4 shrink-0 ${t.jumlah >= 0 ? 'text-emerald-600' : 'text-red-500'}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-zinc-800">
                    {t.jumlah >= 0 ? '+' : ''}
                    {angka(t.jumlah)} key → sisa {angka(t.sisa_quota)}
                  </p>
                  <p className="truncate text-[11.5px] text-zinc-500">
                    {t.admin_by ?? 'admin'} · {sejak(t.created_at)}
                    {t.catatan ? ` · ${t.catatan}` : ''}
                  </p>
                </div>
                <KuotaBadge sisa={t.sisa_quota} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
