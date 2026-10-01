import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, History, KeyRound, MapPin, Phone, Store as StoreIcon, Wallet } from 'lucide-react';

import { KeyStatusBadge, KuotaBadge, StoreStatusBadge, TierBadge } from '@/components/ui/badge';
import { EmptyState, TableCards, TableWrap, CardBadges, CardField, CardHeader, CardItem, Td, Th } from '@/components/ui/table';
import { TopupStoreButton } from '@/components/admin/topup-store-button';
import { getStoreDetail } from '@/lib/data';
import { angka, rupiah, sejak, tanggalWaktu } from '@/lib/format';
import { LICENSE_TYPE_LABEL, PAKET_LABEL, tierRangeLabel, tierRule } from '@/lib/tier';
import { requireAdmin } from '@/lib/supabase/guard';

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
            {/* Desktop: tabel penuh */}
            <TableWrap>
              <thead>
                <tr>
                  <Th>Serial Key</Th>
                  <Th>Pembeli</Th>
                  <Th>Telepon</Th>
                  <Th>Paket</Th>
                  <Th>Pilihan</Th>
                  <Th className="text-right">Komisi</Th>
                  <Th>Tanggal</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {keys.map((k) => (
                  <tr key={k.id} className="transition hover:bg-zinc-50/70">
                    <Td className="font-mono text-[12px] font-semibold text-zinc-900">
                      {k.serial_key}
                    </Td>
                    <Td>{k.nama_pembeli}</Td>
                    <Td className="tabular text-zinc-600">{k.telepon ?? '-'}</Td>
                    <Td>{PAKET_LABEL[k.paket]}</Td>
                    <Td>{LICENSE_TYPE_LABEL[k.pilihan]}</Td>
                    <Td className="tabular text-right">{rupiah(k.komisi)}</Td>
                    <Td className="text-zinc-600">{tanggalWaktu(k.created_at)}</Td>
                    <Td>
                      <KeyStatusBadge status={k.status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>

            {/* HP: kartu satu per key */}
            <TableCards>
              {keys.map((k) => (
                <CardItem key={k.id}>
                  <CardHeader
                    title={<span className="font-mono">{k.serial_key}</span>}
                    subtitle={tanggalWaktu(k.created_at)}
                  />
                  <div className="mt-2.5 space-y-1">
                    <CardField label="Pembeli">{k.nama_pembeli}</CardField>
                    <CardField label="Telepon">
                      <span className="tabular">{k.telepon ?? '-'}</span>
                    </CardField>
                    <CardField label="Paket">{PAKET_LABEL[k.paket]}</CardField>
                    <CardField label="Pilihan">{LICENSE_TYPE_LABEL[k.pilihan]}</CardField>
                    <CardField label="Komisi">
                      <span className="tabular">{rupiah(k.komisi)}</span>
                    </CardField>
                  </div>
                  <CardBadges>
                    <KeyStatusBadge status={k.status} />
                  </CardBadges>
                </CardItem>
              ))}
            </TableCards>
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
