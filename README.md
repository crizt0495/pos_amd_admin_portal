# KasirPro Admin Portal

Panel super-admin untuk mengelola **toko, kuota key global, dan komisi** pada
database Supabase yang **SAMA** dengan portal toko.

> Penting: aplikasi ini tidak memakai database baru. Semua toko, akun, dan serial
> key yang ada di portal toko akan langsung terlihat di sini, dan setiap topup
> yang dilakukan di sini langsung memengaruhi kuota di portal toko.

- Deploy: <https://pos-amd-admin-portal.vercel.app>
- Sumber data: tabel `partners` + `licenses` (dibaca lewat view `admin_stores` dan
  `admin_keys`), ditambah tabel audit `topup_history`.

---

## 1. Yang perlu disiapkan

| Kebutuhan | Kenapa |
| --- | --- |
| Project Supabase yang **sama** dengan portal toko | Kuota yang diubah di sini harus kuota yang dipakai portal. |
| `service_role` / `sb_secret_` key | Admin harus melihat & mengubah semua toko; RLS menutupi anon/publishable key. |
| Satu email untuk login super admin | Dipakai `ADMIN_EMAIL` dan/atau `app_metadata.role = super_admin`. |

---

## 2. Setup (jalankan berurutan)

### 2.1 Terapkan SQL

Buka **Supabase Dashboard → SQL Editor**, pastikan project yang dipilih adalah
project portal toko, lalu tempel seluruh isi `supabase/admin-schema.sql` dan
tekan **Run**.

File tersebut menambahkan:

- tabel `topup_history` (audit trail setiap topup)
- view `admin_stores` dan `admin_keys`
- fungsi `admin_topup`, `admin_topup_bulk`, `admin_revoke_key`

Sifatnya idempotent (`if not exists` / `create or replace`), jadi aman
dijalankan ulang.

### 2.2 Environment variables

```bash
cp .env.example .env.local
```

Isi `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
ADMIN_EMAIL=admin@email.com
NEXT_PUBLIC_APP_NAME=KasirPro Admin
```

`SUPABASE_SECRET_KEY` **wajib** service role. Cara memastikan benar:
Supabase Dashboard → Project Settings → API Keys → baris `service_role`
(-prefix `sb_secret_` pada proyek baru, `eyJ...` pada proyek lama).

Cek kesiapan:

```bash
npm run check:supabase
```

Script ini memastikan env lengkap, memverifikasi keenam objek database ada, lalu
menampilkan jumlah toko & key.

### 2.3 Buat akun super admin

Buat user di **Supabase Dashboard → Authentication → Users → Add user**
(centang **Auto Confirm User**), lalu naikkan rolenya:

```bash
npm run bootstrap:admin -- admin@email.com
```

Alternatifnya, `ADMIN_EMAIL` di `.env.local` sudah cukup sebagai daftar email
yang boleh login — `app_metadata.role` hanya lapisan kedua.

### 2.4 Jalankan lokal

```bash
npm install
npm run dev      # http://localhost:3100
```

---

## 3. Deploy

Repo sudah terhubung ke Vercel (project `pos-amd-admin-portal`,
`productionBranch: main`, root directory = root repo). Push ke `main` otomatis
deploy ke production.

Environment variables harus diisi di **Vercel → Settings → Environment
Variables** (Production + Preview), nilainya sama dengan `.env.local`.

---

## 4. Model keamanan

- `src/lib/supabase/guard.ts` → `requireAdmin()` adalah **satu-satunya** gerbang
  keamanan. Semua page (`src/app/(admin)/*`) dan semua Route Handler
  (`src/app/api/*`) memanggilnya lebih dulu.
- Login diterima bila email ada di `ADMIN_EMAIL` **atau**
  `app_metadata.role === 'super_admin'`. `user_metadata` sengaja tidak dipakai
  karena nilainya bisa diubah sendiri oleh user.
- `src/middleware.ts` hanya memeriksa **keberadaan session** lalu mengarahkan ke
  `/login`. Anime ini tidak mengecek role: cookie `@supabase/ssr` di Edge bukan
  JWT payload yang bisa dibaca. Role tetap diverifikasi ulang di server.
- Halaman dan API memakai **service role**, jadi beware: ini aplikasi
  server-side yang memegang kunci penuh. Jangan pernah memakai prefix
  `NEXT_PUBLIC_` untuk service role.

---

## 5. Struktur

```
src/app/(admin)/          dashboard, toko, toko/baru, toko/[id], keys, akun
src/app/api/              auth/login, auth/logout, stores, stores/[id],
                          topup, topup/bulk, keys/[id], akun/reset-password
src/components/admin/     sidebar, stat-card, sales-chart, store-manager,
                          key-manager, akun-manager, create-store-form
src/lib/data.ts           semua query admin (selalu lewat wajibAdmin())
src/lib/api-guard.ts      wajibAdmin(), jsonOk(), jsonGagal(), bacaJson()
supabase/admin-schema.sql DDL yang wajib dijalankan sekali
scripts/                  bootstrap-admin.mjs, check-supabase.mjs
```

Tier toko tidak disimpan di database — dihitung dari `total_terjual` lewat fungsi
SQL `tier_name_of()` pada portal, sehingga tidak bisa tidak sinkron.