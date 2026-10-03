/**
 * Env accessor. Sengaja lazy supaya `next build` tidak gagal ketika variabel
 * Supabase belum diisi (mis. saat setup awal / CI).
 */

function clean(v: string | undefined): string {
  return (v ?? '').trim().replace(/\/+$/, '');
}

export const env = {
  /**
   * URL project Supabase.
   * Alias yang didukung: NEXT_PUBLIC_SUPABASE_URL (utama) atau SUPABASE_URL.
   */
  get supabaseUrl() {
    return (
      clean(process.env.NEXT_PUBLIC_SUPABASE_URL) ||
      clean(process.env.SUPABASE_URL) ||
      'http://127.0.0.1:54321'
    );
  },
  /**
   * Kunci publik. Mendukung dua gaya:
   *  - gaya baru (recommended): NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = sb_publishable_...
   *  - gaya lama              : NEXT_PUBLIC_SUPABASE_ANON_KEY      = eyJ...
   */
  get supabaseAnonKey() {
    return (
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      ''
    );
  },
  /**
   * Kunci server-only. WAJIB service role (bukan anon/publishable) karena
   * admin portal butuh melihat & mengubah seluruh toko & key.
   *  - SERVICE_KEY               = sb_secret_...   (gaya baru)
   *  - SUPABASE_SECRET_KEY       = sb_secret_...   (gaya baru)
   *  - SUPABASE_SERVICE_ROLE_KEY = eyJ...          (gaya lama)
   */
  get serviceRoleKey() {
    return (
      process.env.SERVICE_KEY ||
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      ''
    );
  },

  /**
   * Email super admin. Dipisah koma bila ada lebih dari satu, mis.
   * ADMIN_EMAIL="satu@email.com,dua@email.com"
   *
   * Ini lapisan PERTAMA; lapis kedua adalah `app_metadata.role` di
   * Supabase Auth. Login ditolak bila email tidak ada di daftar ini DAN
   * role-nya bukan `super_admin`.
   */
  get adminEmails() {
    return (process.env.ADMIN_EMAIL ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  },

  get appName() {
    return process.env.NEXT_PUBLIC_APP_NAME || 'KasirPro Admin';
  },
  /**
   * Deskripsi situs untuk `<meta name="description">`.
   *
   * Disimpan di sini, bukan ditulis literal di dua tempat, karena `/login`
   * sekarang disajikan sebagai HTML mandiri oleh middleware — bukan lewat
   * `metadata` root layout. Dengan begitu kedua halaman tidak bisa berbeda.
   */
  get description() {
    return (
      process.env.NEXT_PUBLIC_APP_DESCRIPTION ||
      'Panel super admin KasirPro: kelola toko, kuota key, serial key global, dan komisi.'
    );
  },
};

/** True bila env Supabase dasar terisi (belum cek kunci service role). */
export function isSupabaseConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey && !env.supabaseUrl.includes('xxxx'));
}

/** Pesan yang sama persis di semua tempat — biar mudah dicari di log. */
export const PESAN_ENV_BELUM_DIISI =
  'Supabase belum dikonfigurasi di server ini. Isi NEXT_PUBLIC_SUPABASE_URL, ' +
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, dan SUPABASE_SECRET_KEY (service role).';

/**
 * True hanya bila env Supabase LENGKAP: URL + kunci publik + service role.
 *
 * Dipakai sebagai preflight supaya kegagalan konfigurasi dilaporkan sebagai
 * "belum dikonfigurasi" (503) — bukan disamarkan jadi "email/password salah",
 * yang akan membuat admin mengira kredensialnya bermasalah padahal server-nya
 * yang belum diisi.
 */
export function isSupabaseFullyConfigured(): boolean {
  return (
    isSupabaseConfigured() && Boolean(env.serviceRoleKey) && !env.serviceRoleKey.includes('xxxx')
  );
}
