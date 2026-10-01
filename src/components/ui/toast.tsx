'use client';

import * as React from 'react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';

type Tone = 'sukses' | 'gagal' | 'info';

interface Toast {
  id: number;
  tone: Tone;
  pesan: string;
}

const ToastContext = createContext<{
  sukses: (p: string) => void;
  gagal: (p: string) => void;
  info: (p: string) => void;
} | null>(null);

/**
 * Toast ringan: provider + hook `useToast()`.
 * Cukup untuk umpan balik aksi admin (top up, revoke, simpan).
 * Pesan hilang otomatis setelah 4 detik.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const seq = React.useRef(0);

  const tambah = useCallback((tone: Tone, pesan: string) => {
    seq.current += 1;
    const id = seq.current;
    setList((prev) => [...prev, { id, tone, pesan }]);
    window.setTimeout(() => {
      setList((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const value = useMemo(
    () => ({
      sukses: (p: string) => tambah('sukses', p),
      gagal: (p: string) => tambah('gagal', p),
      info: (p: string) => tambah('info', p),
    }),
    [tambah],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
        aria-live="polite"
        role="status"
      >
        {list.map((t) => {
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
                onClick={() => setList((prev) => prev.filter((x) => x.id !== t.id))}
                className="shrink-0 opacity-70 transition hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast harus dipakai di dalam <ToastProvider>');
  return ctx;
}
