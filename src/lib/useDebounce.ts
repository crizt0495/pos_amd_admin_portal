'use client';

import * as React from 'react';

/**
 * Tunda nilai sampai `delay` ms berlalu tanpa perubahan.
 *
 * Dipakai untuk kotak pencarian: mengetik tidak langsung menembak API, tapi
 * query tetap jalan begitu user berhenti ngetik — bukan pas komponen dilepas.
 *
 * Catatan: hook ini hanya menunda. Efek samping (mis. `router.push`) tetap
 * harus dipasang di efek terpisah yang bergantung pada nilai hasil debounce.
 */
export function useDebounce<T>(nilai: T, delay = 500): T {
  const [tertunda, setTertunda] = React.useState(nilai);

  React.useEffect(() => {
    const t = setTimeout(() => setTertunda(nilai), delay);
    // Bersihkan timer kalau nilai berubah lagi sebelum delay habis — itu yang
    // bikin "berhenti ngetik" bekerja, bukan "delay sejak ketikan pertama".
    return () => clearTimeout(t);
  }, [nilai, delay]);

  return tertunda;
}
