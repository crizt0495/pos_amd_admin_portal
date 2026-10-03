/**
 * =============================================================================
 *  HALAMAN LOGIN — HTML mandiri, TANPA React
 * =============================================================================
 *
 * Dasar: `/login` adalah satu-satunya halaman aplikasi ini yang TIDAK
 * butuh React sama sekali — form-nya `<form method="post">` ke
 * `/api/auth/login`, lalu redirect 303. Tidak ada `useState`, `onChange`,
 * validasi live, atau apa pun yang membutuhkan JS.
 *
 * Tapi selama halaman ini dirender lewat App Router, browser tetap wajib
 * mengunduh + mengeksekusi react-dom (53,6 kB) dan Next runtime (31,7 kB),
 * lalu me-hydrate pohon RSC. Diukur di produksi dengan throttle 4x + Slow 4G:
 *
 *     task 237 ms  ->  hidrasi App Router (inline flight script)
 *     226 ms       ->  evaluasi modul react-dom
 *     ---------------------------------------------
 *     ~460 ms CPU  untuk halaman yang butuh 0 ms
 *
 * Karena itu halamannya sekarang-disajikan sebagai dokumen HTML statis yang
 * dikirim middleware. Konsekuensinya:
 *
 *     1 request   (tidak ada chunk JS, tidak ada file CSS terpisah)
 *     0 hydration (TBT -> ~0)
 *     TTB page    ~40 ms dari edge, bukan ~310 ms lewat serverless function
 *
 * CSS ditulis inline di `<style>` supaya TIDAK ada permintaan render-blocking
 * kedua. Nilainya disalin dari `app/globals.css` (`card-soft`, `field-input`,
 * `field-label`, `btn-primary`) memakai palet zinc Tailwind yang sama, jadi
 * tampilannya identik dengan halaman lain.
 *
 * Yang tetap dipertahankan:
 *   - Redirect user yang sudah login  -> `middleware.ts` (lihat di bawah)
 *   - Form tetap berfungsi tanpa JS    -> `next` default `/dashboard`
 *   - `?error=` dipasang lewat `textContent`, jadi teks dari URL tidak pernah
 *     diperlakukan sebagai HTML (tidak ada permukaan XSS)
 *   - `noindex` ditulis sebagai `<meta>`, karena tidak lagi lewat `metadata`
 */

/** Escape untuk disisipkan ke dalam teks HTML / atribut. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface LoginHtmlOptions {
  appName: string;
  /** Sama persis dengan `metadata.description` di root layout, supaya audit SEO
   *  `meta-description` tetap lolos seperti sebelumnya. */
  description: string;
  demo: boolean;
  demoUser: string;
  demoPass: string;
}

/**
 * Script kecil: isi `?next=` ke field hidden, tampilkan `?error=`.
 *
 * IIFE biasa (bukan modul) supaya jalan begitu HTML selesai di-parse, dan
 * diletakkan DI AKHIR `<body>` — di titik itu semua elemen yang diubah sudah
 * ada. Semua input dibaca dari `location.search` di sisi browser; tidak ada
 * satu pun nilai pengguna yang di-embed ke dalam string di sisi server.
 */
const SCRIPT = `(function(){try{
var q=new URLSearchParams(location.search);
var n=q.get('next');
if(n&&n.charAt(0)==='/'&&n.charAt(1)!=='/'){var f=document.getElementById('next');if(f)f.value=n;}
var e=q.get('error');
if(e){var b=document.getElementById('err');var t=document.getElementById('err-text');
if(t)t.textContent=e;if(b)b.removeAttribute('hidden');}
}catch(_){}})();`;

const CSS = `*,::before,::after{box-sizing:border-box;border:0 solid #e4e4e7}
html{-webkit-tap-highlight-color:transparent}
body{margin:0;background:#fafafa;color:#18181b;
  -webkit-font-smoothing:antialiased;
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  font-feature-settings:'cv11','ss01'}
main{display:flex;min-height:100dvh;align-items:center;justify-content:center;padding:40px 16px}
.wrap{width:100%;max-width:384px}
.head{margin-bottom:24px;display:flex;flex-direction:column;align-items:center;text-align:center}
.mark{display:grid;height:48px;width:48px;place-items:center;border-radius:16px;background:#18181b;color:#fff}
h1{margin:12px 0 0;font-size:19px;line-height:1.4;font-weight:700;color:#18181b}
.lede{margin:4px 0 0;font-size:13px;line-height:1.5;color:#52525b}
.lede+.lede{margin-top:4px}
.card{border-radius:16px;border:1px solid rgba(228,228,231,.8);background:#fff;
  box-shadow:0 1px 2px rgba(0,0,0,.04);padding:20px}
.note{margin-bottom:16px;border-radius:12px;border:1px solid #fde68a;background:#fffbeb;
  padding:10px 12px;font-size:13px;line-height:1.5;color:#78350f}
.note b{display:block;font-weight:600}
.note dl{margin:6px 0 0;display:grid;grid-template-columns:auto 1fr;column-gap:12px;row-gap:4px}
.note dt{color:#b45309}
.note code,.foot code{border-radius:4px;background:#fff;padding:1px 4px;font-weight:600;font-size:13px;
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.err{display:flex;align-items:flex-start;gap:8px;margin-bottom:16px;border-radius:12px;
  background:#fef2f2;padding:10px 12px;font-size:13px;line-height:1.5;font-weight:500;color:#b91c1c}
.err[hidden]{display:none}
.err svg{flex-shrink:0;margin-top:2px}
form{display:grid;gap:14px}
label{display:block;margin-bottom:6px;font-size:13px;line-height:1.4;font-weight:500;color:#3f3f46}
input[type=text],input[type=password]{display:block;height:44px;width:100%;border-radius:12px;
  border:1px solid #e4e4e7;background:#fff;padding:0 14px;font-size:16px;color:#18181b;
  outline:none;transition:border-color .15s,box-shadow .15s;font-family:inherit}
input::placeholder{color:#a1a1aa}
input:focus{border-color:#18181b;box-shadow:0 0 0 2px rgba(24,24,27,.1)}
input:focus-visible,button:focus-visible{outline:2px solid rgba(24,24,27,.45);outline-offset:2px}
button{display:inline-flex;height:44px;width:100%;align-items:center;justify-content:center;gap:8px;
  border-radius:12px;background:#18181b;padding:0 16px;font-size:14px;font-weight:600;color:#fff;
  cursor:pointer;transition:transform .1s;font-family:inherit}
button:active{transform:scale(.99)}
.foot{margin-top:20px;text-align:center;font-size:12px;line-height:1.6;color:#52525b}
.foot code{background:#f4f4f5;color:#52525b}
.foot+.foot{margin-top:8px}`;

/** Ikon inline (stroke-based, sama seperti lucide) supaya tidak ada request gambar. */
const ICON_SHIELD = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>`;
const ICON_LOGIN = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/></svg>`;
const ICON_ALERT = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`;

export function loginHtml(o: LoginHtmlOptions): string {
  const app = esc(o.appName);

  const demoBox = o.demo
    ? `<div class="note" role="note"><b>Mode demo &mdash; data palsu, tanpa database.</b>
<dl><dt>username</dt><dd><code>${esc(o.demoUser)}</code></dd>
<dt>password</dt><dd><code>${esc(o.demoPass)}</code></dd></dl></div>`
    : '';

  const catatan = o.demo
    ? `Data di bawah ini <strong>palsu</strong> dan kembali ke awal setiap
       <code>npm run dev</code> di-restart. Tidak ada yang tersimpan ke database.`
    : `Hanya akun dengan username terdaftar di <code>admin_accounts</code>,
       email di <code>ADMIN_EMAIL</code>, atau role <code>super_admin</code> yang bisa masuk.`;

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<meta name="description" content="${esc(o.description)}">
<meta name="theme-color" content="#18181b">
<meta name="application-name" content="${app}">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<title>Masuk &middot; ${app}</title>
<style>${CSS}</style>
</head>
<body>
<main>
<div class="wrap">
<div class="head">
<span class="mark">${ICON_SHIELD}</span>
<h1>Admin Portal</h1>
<p class="lede">Masuk sebagai super admin untuk mengelola toko &amp; key.</p>
<p class="lede">username atau email super admin</p>
</div>
<div class="card">
${demoBox}<div class="err" id="err" role="alert" hidden>${ICON_ALERT}<span id="err-text"></span></div>
<form method="post" action="/api/auth/login">
<input type="hidden" id="next" name="next" value="/dashboard">
<div>
<label for="identifier">Username</label>
<input id="identifier" name="identifier" type="text" required autocomplete="username"
 autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="superadmin">
</div>
<div>
<label for="password">Password</label>
<input id="password" name="password" type="password" required autocomplete="current-password" placeholder="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;">
</div>
<button type="submit">${ICON_LOGIN}Masuk</button>
</form>
</div>
<p class="foot">${catatan}</p>
<p class="foot">${app}</p>
</div>
</main>
<script>${SCRIPT}</script>
</body>
</html>`;
}
