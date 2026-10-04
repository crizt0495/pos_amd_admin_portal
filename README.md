# KasirPro Admin Portal

Panel super-admin untuk mengelola **toko, kuota key global, dan komisi** pada
database Supabase yang **SAMA** dengan portal toko.

> Penting: aplikasi ini tidak memakai database baru. Semua toko, akun, dan serial
> key yang ada di portal toko akan langsung terlihat di sini, dan setiap topup
> yang dilakukan di sini langsung memengaruhi kuota di portal toko.

- Deploy: <https://pos-amd-admin-portal.vercel.app>
- Sumber data: tabel `partners` + `licenses` (dibaca lewat view `admin_stores` dan
  `admin_keys`), ditambah tabel katalog `produk` dan tabel audit `topup_history`.

---

## 1. Yang perlu disiapkan

| Kebutuhan | Kenapa |
| --- | --- |
| Project Supabase yang **sama** dengan portal toko | Kuota yang diubah di sini harus kuota yang dipakai portal. |
| `service_role` / `sb_secret_` key | Admin harus melihat & mengubah semua toko; RLS menutupi anon/publishable key. |
| Satu email untuk login super admin | Dipakai `ADMIN_EMAIL` dan/atau `app_metadata.role = super_admin`. |

---

## 2. Setup (jalankan berurutan)

> **Mau langsung coba tanpa Supabase?** Loncat ke [bagian 7](#7-mode-demo-opsional).

### 2.1 Terapkan SQL

Buka **Supabase Dashboard → SQL Editor**, pastikan project yang dipilih adalah
project portal toko, lalu tempel seluruh isi `supabase/admin-schema.sql` dan
tekan **Run**.

File tersebut menambahkan:

- tabel `topup_history` (audit trail setiap topup)
- view `admin_stores` dan `admin_keys`
- fungsi `admin_topup`, `admin_topup_bulk`, `admin_revoke_key`
- tabel `produk` + kolom `licenses.produk_id` + penyesuaian view `admin_keys`
  (bagian 11 — **wajib dijalankan ulang** kalau script sudah pernah dijalankan
  sebelumnya, karena `idempotent` berarti "tidak salah", bukan "sudah ada")

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
(centang **Auto Confirm User**), lalu naikkan rolenya dan daftarkan username:

```bash
npm run bootstrap:admin -- admin@email.com superadmin
```

Argumen kedua (`superadmin`) adalah **username** untuk login. Aturannya: huruf
kecil, angka, `.`, `_`, `-`, panjang 3–32 karakter — sama persis dengan CHECK
constraint di database.

Script itu dua hal: menulis `app_metadata.role = 'super_admin'`, dan menyimpan
pemetaan `username → email` ke tabel `admin_accounts`.

Admin bisa login dengan **username** maupun email. `ADMIN_EMAIL` jadi opsional
karena role `super_admin` sudah cukup — env itu cuma daftar email tambahan.

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
- Login menerima **username atau email**. Supabase Auth tidak punya kolom
  username, jadi `POST /api/auth/login` me-resolve `username → email` lewat tabel
  `admin_accounts` memakai service role **di server** — tidak ada objek yang
  bisa dibaca anon, sehingga tidak ada permukaan email-enumeration. Resolusi
  dilakukan sebelum `signInWithPassword`, sehingga Supabase Auth tetap managing
  password (tidak ada hashing atau session buatan sendiri).
- Login diterima bila email hasil resolusi ada di `ADMIN_EMAIL` **atau**
  `app_metadata.role === 'super_admin'`. `user_metadata` sengaja tidak dipakai
  karena nilainya bisa diubah sendiri oleh user.
- Kegagalan diklasifikasi dengan jujur: env belum terisi → `503` dengan pesan
  konfigurasi; server Supabase tidak bisa dihubungi → `503`; kredensial salah →
  `401`; bukan admin → `403`. Env kosong **tidak** disamarkan jadi "password
  salah", karena itu membuat admin salah menyalahkan kredensialnya sendiri.
- `src/middleware.ts` hanya memeriksa **keberadaan session** lalu mengarahkan ke
  `/login`. Anime ini tidak mengecek role: cookie `@supabase/ssr` di Edge bukan
  JWT payload yang bisa dibaca. Role tetap diverifikasi ulang di server.
- Halaman dan API memakai **service role**, jadi beware: ini aplikasi
  server-side yang memegang kunci penuh. Jangan pernah memakai prefix
  `NEXT_PUBLIC_` untuk service role.

---

## 5. Struktur

```
src/app/(admin)/          dashboard, toko, toko/baru, toko/[id], keys, produk,
                          akun
src/app/api/              auth/login, auth/logout, stores, stores/[id],
                          topup, topup/bulk, keys/[id], produk, produk/[id],
                          akun/reset-password
src/components/admin/     app-nav, stat-card, sales-chart, store-daftar,
                          key-daftar, akun-daftar, produk-daftar,
                          hardware-id-sel
src/lib/data.ts           semua query admin (selalu lewat wajibAdmin())
src/lib/api-guard.ts      wajibAdmin(), jsonOk(), jsonGagal(), bacaJson()
src/lib/hardware.ts       aturan Hardware ID (dipakai portal dan POS AMD)
src/lib/produk.ts         aturan produk + 20% estimasi komisi
supabase/admin-schema.sql DDL yang wajib dijalankan (termasuk tabel
                          admin_accounts untuk login username)
scripts/                  bootstrap-admin.mjs, check-supabase.mjs, gen-css.mjs,
                          test-csp.mjs, test-ringan.mjs
```

Tier toko tidak disimpan di database — dihitung dari `total_terjual` lewat fungsi
SQL `tier_name_of()` pada portal, sehingga tidak bisa tidak sinkron.

### Halaman tanpa JavaScript

`/dashboard` dan `/akun` disajikan **tanpa satu baris pun JavaScript**. Cara
kerja Middleware `src/middleware.ts`: halaman dirender App Router seperti biasa,
lalu markup-nya dibersihkan — semua `<script>` dibuang dan CSS aplikasi
di-inline-kan ke `<style>` yang sudah disaring per halaman (`src/lib/html-ringan.ts`,
`src/lib/css-scope.ts`).

Konsekuensinya, interaksi di kedua halaman harus bisa jalan tanpa JS: pencarian
jadi `<form method="get">`, top up dan reset password jadi `<details>` +
`<form method="post">` yang dibalas Route Handler dengan 303 ke halaman asal
beserta pesan di `?ok=` / `?err=`.

Menambah halaman baru ke daftar `HALAMAN_RINGAN` berarti menulis ulang interaksi
halaman itu dalam HTML native lebih dulu — **bukan** sekadar menambahkan nama.
`npm run test:ringan` ikut menjaga dua hal yang tidak terlihat kalau rusak
diam-diam: nol `'use client'` di seluruh graf import halaman, dan CSS yang
disaring masih sama secara computed style dengan CSS penuh.

---

## 6. Hardware ID

Hardware ID adalah UUID v4 yang mengunci satu serial key ke satu komputer kasir.
Aturan lengkapnya hidup di `src/lib/hardware.ts` — bukan di README — supaya
portal dan aplikasi POS AMD memakai satu implementasi yang sama dan bisa diuji
(`npm run test:ringan`, bagian G).

### Yang dibaca dari WMI

Urutan penyusunan, dari yang pertama berhasil dipakai:

| # | Bahan | WMI |
| --- | --- | --- |
| a | UUID mesin | `SELECT UUID FROM Win32_ComputerSystemProduct` |
| b | UUID mesin + nomor seri motherboard | `SELECT SerialNumber FROM Win32_BaseBoard` |
| c | UUID mesin + nama komputer + id instalasi Windows | `Win32_ComputerSystem.Name`, `Win32_OperatingSystem.SerialNumber` |

Hasil (a) dipakai langsung. Hasil (b) dan (c) di-SHA-256, 32 byte-nya dipotong
jadi 16, lalu bit versi dan varian dipaksa jadi UUID v4 — jadi bentuknya sama
persis dengan (a) dan tidak pernah berbeda antar-komputer.

### Yang dilarang keras

**JANGAN PERNAH** menyusun Hardware ID dari `Win32_ComputerSystem.Manufacturer`,
`Win32_ComputerSystem.Model`, `Win32_OperatingSystem.Caption`, nama proses, atau
nama produk apa pun. Ribuan komputer punya nilai yang sama persis di kolom
kolom itu, jadi key akan ikut terbuka di komputer lain yang modelnya sama.

Nomor seri motherboard juga **wajib diperiksa dulu**: sebagian besar motherboard
konsumen mengisinya dengan `Default string` atau string kosong. Kalau nilai itu
dipakai apa adanya, semua komputer tanpa nomor seri motherboard akan mengunci ke
HWID yang sama. Buang nilai kosong dan `Default string`, lalu turun ke (c).

Kalau (a), (b), dan (c) semuanya gagal, perangkat **tidak bisa** diafinisikan.
Tampilkan pesan error yang jelas. Fallback ke pengenal produk lebih berbahaya
daripada tidak bisa dipakai sama sekali.

### Di portal

Nilai HWID tampil penuh di `/keys` dan `/toko/[id]` — tidak dipotong, tidak jadi
`title` yang hanya muncul saat hover. Nilai yang tidak berbentuk UUID v4 diberi
penanda `bukan UUID v4`, karena itu sinyal versi aplikasi POS AMD yang perlu
diperiksa.

---

## 7. Mode demo (opsional)

Supaya aplikasi bisa dibuka dan dicoba **tanpa Supabase sama sekali**:

```bash
cp .env.example .env.local
# isi satu baris saja:
echo 'DEMO_MODE=1' >> .env.local

npm run dev        # http://localhost:3100
```

| | |
| --- | --- |
| username | `demo` |
| password | `demo1234` |

Kredensial ini juga ditampilkan langsung di halaman `/login` selama mode demo
aktif, jadi tidak perlu dicatat.

Yang terjadi di mode demo:

- 8 toko + ~95 serial key palsu dibuat di memory (`src/lib/demo/data.ts`).
  Tier & komisi dihitung pakai `tierOf()` yang sama dengan aslinya.
- Semua halaman & API tetap bekerja: top up, ubah status key, edit/hapus toko,
  top up massal, buat toko.
- Perubahan **benar-benar mengubah angka** (sisa kuota, komisi pending, chart),
  jadi perilakunya sama dengan produksi — hanya bertahan di memory dan hilang
  saat `npm run dev` di-restart. `src/lib/demo/data.ts` punya `demoReset()`
  kalau perlu mengembalikan data ke awal.
- Balasan API diberi awalan `[DEMO]` supaya tidak pernah tertukar dengan
  hasil sungguhan.

Yang **tidak** terjadi: tidak ada akun Supabase Auth yang dibuat, tidak ada
password yang di-reset, dan tidak ada satu pun request yang keluar ke Supabase.

### Pengamanannya

- `src/lib/demo/config.ts` **membuang dirinya** (throw) begitu `DEMO_MODE=1`
  bertemu env Supabase yang terisi. Kombinasi itulah satu-satunya yang
  berbahaya: aplikasi yang kredensial demo-nya aktif tapi masih bisa menyentuh
  database asli. Efeknya `npm run build` **gagal dengan pesan jelas** — bukan
  diam-diam ter-deploy dengan kredensial demo.
  Catatan: aturan ini bukan "larang di production". Yang berbahaya adalah demo
  hidup berdampingan dengan database, bukan nama environment-nya. Itu membuat
  mode demo bisa di-deploy ke project Vercel terpisah (tanpa env Supabase) untuk
  melihat-lihat tanpa menyentuh domain production.
- Sesi demo memakai cookie sendiri (`kp_demo_admin`), tidak pernah cookie sesi
  Supabase, jadi tidak ada jalur whereby sesi demo bisa dianggap sesi admin
  sungguhan.
- Di dalam aplikasi selalu ada badge "Mode demo" di sidebar supaya tidak ada
  yang mengira datanya asli.
- `DEMO_MODE` tidak boleh diisi bersamaan dengan env Supabase di project yang
  sama. Untuk production, isikan env Supabase dan biarkan `DEMO_MODE` kosong.