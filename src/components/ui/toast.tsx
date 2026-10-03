'use client';

import * as React from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';

type Tone = 'sukses' | 'gagal' | 'info';

interface Toast {
  id: number;
  tone: Tone;
  pesan: string;
}

/**
 * ============================================================================
 *  TOAST — store modul, BUKAN React Context
 * ============================================================================
 *
 * Sebelumnya ini `ToastProvider` (Client Component) yang membungkus seluruh
 * subtree halaman:
 *
 *     <ToastProvider><AppShell>{children}</AppShell></ToastProvider>
 *
 * Dan itulah jebakan performa yang paling mahal di aplikasi ini: begitu
 * `children` jadi anak dari Client Component mana pun, React akan
 * me-hydrate SELURUH isi halaman itu — termasuk seluruh HTML yang sudah
 * dikirim dari server. `children` yang sudah dirender server TIDAK otomatis
 * bebas dari hydrasi; hanya kalau tidak ada Client Component di atasnya.
 *
 * Bukti: `/keys` dengan 0 baris data pun masih TBT 442 ms, sementara
 * `/login` (tanpa provider) 200 ms.
 *
 * Karena itu provider-nya dihapus. `useToast()` sekarang baca dari store
 * modul, dan tampilan toast-nya jadi island `<Toaster />` yang dipasang
 * sebagai SAUDAR konten, bukan pembungkusnya.
 *
 * Semua pemanggil `useToast()` tidak berubah sama sekali — API-nya
 * (`sukses`/`gagal`/`info`) sama persis.
 */

let list: Toast[] = [];
let seq = 0;
const pendengar = new Set<() => void>();

function emit() {
  // Salinan baru setiap perubahan supaya `useSyncExternalStore` tahu datanya berubah.
  list = [...list];
  for (const p of pendengar) p();
}

function buang(id: number) {
  if (!list.some((t) => t.id === id)) return;
  list = list.filter((t) => t.id !== id);
  emit();
}

function tambah(tone: Tone, pesan: string) {
  seq += 1;
  const id = seq;
  list = [...list, { id, tone, pesan }];
  emit();
  window.setTimeout(() => buang(id), 4000);
}

/**
 * Akses toast untuk Client Component mana pun.
 *
 * Sengaja tidak memakai Context: Context harus-provided dari atas, dan
 * provider itulah yang memaksa seluruh subtree ikut ter-hydrate.
 */
export function useToast() {
  return React.useMemo(
    () => ({
      sukses: (p: string) => tambah('sukses', p),
      gagal: (p: string) => tambah('gagal', p),
      info: (p: string) => tambah('info', p),
    }),
    [],
  );
}

const subscribe = (cb: () => void) => {
  pendengar.add(cb);
  return () => {
    pendengar.delete(cb);
  };
};

const EMPTY: Toast[] = [];

const getSnapshot = () => list;
const getServerSnapshot = (): Toast[] => EMPTY;

/**
 * Island tampilan toast. Dipasang sebagai saudara konten di layout, jadi
 * tidak membungkus apa pun dan tidak menarik apa pun untuk di-hydrate.
 */
export function Toaster() {
  const toasts = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
      aria-live="polite"
      role="status"
    >
      {toasts.map((t) => {
        const Icon = t.tone === 'sukses' ? CheckCircle2 : t.tone === 'gagal' ? XCircle : Info;
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-full max-w-md animate-fade-in items-start gap-2 rounded-xl px-3.5 py-3 text-[13px] font-medium shadow-lg ${
              t.tone === 'sukses'
                ? 'bg-zinc-900 text-white'
                : t.tone === 'gagal'
                  ? 'bg-red-600 text-white'
                  : 'bg-zinc-800 text-white'
            }`}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1">{t.pesan}</span>
            <button
              type="button"
              aria-label="Tutup notifikasi"
              onClick={() => buang(t.id)}
              className="shrink-0 opacity-70 transition hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
