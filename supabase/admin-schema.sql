-- ===========================================================================
--  KASIRPRO ADMIN PORTAL — Supabase PostgreSQL Schema (Tambahan)
--  Jalankan seluruh file ini di: Supabase Dashboard > SQL Editor > New Query
--  Aman dijalankan berulang (idempotent).
--
--  PENTING: file ini BUKAN pengganti schema.sql milik Portal Toko. Portal toko
--  memakai tabel `partners` & `licenses` yang sudah live. Admin portal
--  membaca/menulis tabel yang SAMA supaya top up kuota di panel admin benar-
--  benar Impacts kuota di portal toko — bukan tabel bayangan.
--
--  Yang ditambahkan di sini:
--    1. Tabel `topup_history`     — riwayat isi ulang kuota oleh admin
--    2. Tabel `admin_accounts`    — peta username -> email untuk login admin
--    3. View  `admin_stores`      — partners  -> nama kolom "stores"
--    4. View  `admin_keys`        — nama kolom "keys"
--    5. RPC   `admin_topup`       — top up 1 toko (atomik + audit)
--    6. RPC   `admin_topup_bulk`  — top up banyak toko sekaligus
--    7. RPC   `admin_revoke_key`  — revoke / hidupkan kembali serial key
--    8. Grant + RLS untuk objek baru
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Tabel: topup_history  (riwayat penambahan kuota key oleh admin)
-- ---------------------------------------------------------------------------
create table if not exists public.topup_history (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid        not null references public.partners(id) on delete cascade,
  -- `jumlah` SENGAJA tidak dibatasi tanda: nilai negatif = koreksi admin.
  -- Ditolak/dijepit di dalam RPC admin_topup(), bukan di sini — kalau check
  -- `jumlah > 0` dipasang, satu koreksi negatif akan menggagalkan seluruh
  -- transaksi (insert audit ikut gagal), jadi top up koreksi tidak bisa dipakai.
  jumlah      integer     not null,
  -- sisa kuota SESUDAH penambahan (snapshot, memudahkan audit)
  sisa_quota  integer     not null default 0 check (sisa_quota >= 0),
  admin_by    text,
  catatan     text,
  created_at  timestamptz not null default now()
);

-- migrasi aman untuk database lama
alter table public.topup_history add column if not exists store_id uuid references public.partners(id) on delete cascade;
alter table public.topup_history add column if not exists jumlah integer;
-- lepaskan check `jumlah > 0` dari versi schema lama kalau pernah terpasang
alter table public.topup_history drop constraint if exists topup_history_jumlah_check;
alter table public.topup_history add column if not exists sisa_quota integer not null default 0;
alter table public.topup_history add column if not exists admin_by text;
alter table public.topup_history add column if not exists catatan text;

create index if not exists idx_topup_history_store on public.topup_history (store_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Tabel: admin_accounts  (peta username -> email untuk LOGIN ADMIN)
--
--    Supabase Auth tidak punya kolom "username" — identifier-nya selalu email.
--    Supaya admin tetap bisa login dengan USERNAME, tabel ini yang menyimpan
--    pemetaannya.
--
--    Kenapa tabel, bukan RPC yang bisa dipanggil anon?
--    Karena Route Handler /api/auth/login me-resolve username -> email DI SERVER
--    memakai service role. Tidak ada objek yang bisa dibaca anon, jadi tidak ada
--    permukaan email-enumeration lewat API publik.
--
--    Satu email hanya boleh punya satu username (idx_admin_accounts_email).
-- ---------------------------------------------------------------------------
create table if not exists public.admin_accounts (
  username    text primary key
              check (
                username = lower(username)
                and username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'
              ),
  email       text        not null,
  dibuat_pada timestamptz not null default now()
);

-- migrasi aman untuk database lama
alter table public.admin_accounts add column if not exists email text;

create unique index if not exists idx_admin_accounts_email
  on public.admin_accounts (lower(email));

-- ---------------------------------------------------------------------------
-- 4. View: admin_stores
--    Memetakan `partners` ke nama kolom sesuai spec admin portal:
--      nama_toko, email, no_hp, alamat, tier, total_terjual, sisa_kuota,
--      komisi_total, is_active, created_at, username
--
--    Catatan: `tier` TIDAK disimpan sebagai kolom (sama seperti di portal) —
--    dihitung dari total_terjual lewat fungsi tier_name_of, jadi tidak bisa
--    "basi" ketika toko naik tier.
-- ---------------------------------------------------------------------------
create or replace view public.admin_stores as
  select
    p.id,
    p.user_id,
    p.nama_toko,
    p.email,
    p.username,
    p.no_hp,
    p.alamat,
    public.tier_name_of(p.total_terjual)::text        as tier,
    p.total_terjual,
    p.license_quota                                   as sisa_kuota,
    p.komisi_total,
    (p.status = 'active')                             as is_active,
    p.status,
    p.created_at,
    p.updated_at
  from public.partners p;

-- ---------------------------------------------------------------------------
-- 5. View: admin_keys
--    Memetakan `licenses` + join nama toko penjual.
-- ---------------------------------------------------------------------------
create or replace view public.admin_keys as
  select
    l.id,
    l.serial_key,
    l.partner_id         as store_id,
    p.nama_toko          as nama_toko,
    l.pembeli_nama       as nama_pembeli,
    l.pembeli_hp         as telepon,
    l.alamat             as alamat_pembeli,
    l.paket_type         as paket,
    l.license_type       as pilihan,
    l.komisi_amount      as komisi,
    l.tier,
    l.tier_rate,
    l.status,
    l.hwid_locked,
    l.device_name,
    l.activated_at,
    l.expires_at,
    l.created_at
  from public.licenses l
  left join public.partners p on p.id = l.partner_id;

-- ---------------------------------------------------------------------------
-- 6. RPC: admin_topup  (tambah/berkurangi kuota 1 toko, atomik + audit)
--
--    `p_jumlah` boleh negatif (koreksi admin). Sisa kuota dijaga >= 0, dan
--    `jumlah_diterapkan` melaporkan perubahan BENAR yang terjadi — jadi -10
--    pada toko yang sisa 3 akan tercatat sbg -3, bukan -10.
--
--    `p_admin_by` diisi Route Handler dari sesi admin (bukan auth.jwt(),
--    karena service role JWT tidak punya klaim `email`).
-- ---------------------------------------------------------------------------
create or replace function public.admin_topup(
  p_store_id  uuid,
  p_jumlah    integer,
  p_catatan   text default null,
  p_admin_by  text default null
)
returns table (sisa_kuota integer, jumlah_diterapkan integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lama     integer;
  v_baru     integer;
  v_diterapkan integer;
begin
  if p_store_id is null then
    raise exception 'store_id wajib diisi';
  end if;
  if p_jumlah is null or p_jumlah = 0 then
    raise exception 'jumlah tidak boleh 0';
  end if;

  -- kunci baris supaya 2 admin top up bersamaan tidak saling menimpa
  -- (alias tabel wajib: OUT `sisa_kuota` & kolom bermirip bisa jadi ambigu)
  select p.license_quota into v_lama
    from public.partners p
   where p.id = p_store_id
     for update;

  if not found then
    raise exception 'Toko tidak ditemukan';
  end if;

  v_lama      := coalesce(v_lama, 0);
  v_baru      := greatest(0, v_lama + p_jumlah);
  v_diterapkan := v_baru - v_lama;

  update public.partners p
     set license_quota = v_baru
   where p.id = p_store_id;

  -- audit tetap dicatat walau pengurangan lebih besar dari kuota (v_diterapkan 0/negatif)
  insert into public.topup_history (store_id, jumlah, sisa_quota, admin_by, catatan)
  values (
    p_store_id,
    -- Catat perubahan YANG BENAR di audit (tidak mengarang agar "positif").
    v_diterapkan,
    v_baru,
    p_admin_by,
    p_catatan
  );

  return query select v_baru, v_diterapkan;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. RPC: admin_topup_bulk  (top up beberapa toko dalam 1 transaksi)
--    Toko yang tidak ditemukan dilaporkan per-baris, tidak membatalkan sisanya.
-- ---------------------------------------------------------------------------
create or replace function public.admin_topup_bulk(
  p_store_ids uuid[],
  p_jumlah    integer,
  p_catatan   text default null,
  p_admin_by  text default null
)
returns table (store_id uuid, nama_toko text, sisa_kuota integer, ok boolean, pesan text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lama integer;
  v_baru integer;
  v_nama text;
  v_berhasil integer := 0;
  v_id uuid;
  v_ids uuid[];
begin
  if p_jumlah is null or p_jumlah = 0 then
    raise exception 'jumlah tidak boleh 0';
  end if;
  if p_store_ids is null or cardinality(p_store_ids) = 0 then
    raise exception 'Pilih minimal satu toko';
  end if;

  v_ids := p_store_ids;

  foreach v_id in array v_ids loop
    -- Kolom WAJIB diberi alias tabel: parameter OUT `nama_toko` bernama sama
    -- dengan kolomnya, dan default plpgsql raise error saat ambigu.
    select p.license_quota, p.nama_toko into v_lama, v_nama
      from public.partners p
     where p.id = v_id
       for update;

    if found then
      v_baru := greatest(0, coalesce(v_lama, 0) + p_jumlah);

      update public.partners p
         set license_quota = v_baru
       where p.id = v_id;

      insert into public.topup_history (store_id, jumlah, sisa_quota, admin_by, catatan)
      values (v_id, p_jumlah, v_baru, p_admin_by, p_catatan);

      v_berhasil := v_berhasil + 1;
      return query select v_id, v_nama, v_baru, true, 'ok'::text;
    else
      return query select v_id, null::text, 0, false, 'Toko tidak ditemukan'::text;
    end if;
  end loop;

  if v_berhasil = 0 then
    raise exception 'Tidak ada toko yang cocok';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. RPC: admin_revoke_key  (revoke / aktifkan kembali serial key)
--    Saat dicabut, kunci perangkat dilepas supaya key bisa di-generate ulang
--    atau dipakai lagi tanpa sisa hwid lama.
-- ---------------------------------------------------------------------------
create or replace function public.admin_revoke_key(
  p_key_id uuid,
  p_status text default 'revoked'
)
returns table (serial_key text, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  if p_status not in ('unused', 'active', 'blocked', 'revoked') then
    raise exception 'Status tidak valid';
  end if;

  -- Kolom WAJIB diberi alias tabel: OUT `serial_key`/`status` bernama sama
  -- dengan kolom tabel, dan default plpgsql raise error saat ambigu.
  select l.serial_key into v_key
    from public.licenses l
   where l.id = p_key_id
     for update;

  if not found then
    raise exception 'Key tidak ditemukan';
  end if;

  update public.licenses l
     set status = p_status,
         hwid_locked    = case when p_status = 'revoked' then null else l.hwid_locked end,
         hwid_locked_at = case when p_status = 'revoked' then null else l.hwid_locked_at end,
         activated_at   = case when p_status = 'revoked' then null else l.activated_at end
   where l.id = p_key_id;

  return query select v_key, p_status;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. RLS & Grants
--    Semua akses admin lewat SERVICE ROLE key dari Route Handler, jadi objek
--    baru di bawah TIDAK diberi policy untuk anon/authenticated — RLS aktif
--    tanpa policy = tolak semua (paling aman kalau kunci service role bocor).
-- ---------------------------------------------------------------------------
alter table public.topup_history enable row level security;
alter table public.admin_accounts enable row level security;

drop policy if exists "topup_history_admin_all" on public.topup_history;
drop policy if exists "admin_accounts_admin_all" on public.admin_accounts;

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on public.topup_history to service_role;
grant select, insert, update, delete on public.admin_accounts to service_role;
grant usage, select on all sequences in schema public to service_role;

-- View dieksekusi dengan hak PEMAKAI yang memanggil, jadi grant eksplisit wajib.
grant select on public.admin_stores to service_role;
grant select on public.admin_keys   to service_role;

grant execute on function public.admin_topup(uuid, integer, text, text)      to service_role;
grant execute on function public.admin_topup_bulk(uuid[], integer, text, text) to service_role;
grant execute on function public.admin_revoke_key(uuid, text)                to service_role;

-- ---------------------------------------------------------------------------
-- 10. SETUP ADMIN
--     1. Buat akun admin di Supabase Dashboard > Authentication > Users > Add user
--        (centang "Auto Confirm User", email = email super admin kamu).
--     2. Pasang role super_admin + daftarkan username:
--          npm run bootstrap:admin -- admin@email.com superadmin
--        (script ini menulis app_metadata.role = 'super_admin' dan mengisi
--         tabel admin_accounts dengan username -> email)
--        Argumen username OPSIONAL — kalau diisi, admin bisa login memakai
--        username. Kalau tidak, login tetap memakai email.
--     3. Isi ADMIN_EMAIL di environment project Vercel pos-amd-admin-portal
--        (opsional bila sudah pakai app_metadata.role = 'super_admin').
--     4. Login di /login dengan USERNAME (atau email). Akun yang username-nya
--        tidak terdaftar di admin_accounts, email-nya tidak ada di ADMIN_EMAIL,
--        dan tidak punya app_metadata.role = 'super_admin' akan ditolak.
-- ---------------------------------------------------------------------------
