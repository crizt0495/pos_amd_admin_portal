'use client';

import * as React from 'react';

import type { StoreRowData } from '@/types';

/**
 * =============================================================================
 *  PEMILIH TOKO — store modul, BUKAN Context
 * =============================================================================
 *
 * Sama seperti `useToast()`, state seleksi disimpan di store modul, bukan di
 * Context, supaya tidak ada provider yang memaksa subtree ikut ter-hydrate.
 *
 * Dua pemanggil:
 *   1. `StoreAksi` (per baris) -> `togglePilih()` saat checkbox berubah.
 *   2. `PilihSemua` (di kepala tabel) -> `pilihSemua()` untuk centang semua.
 *
 * Toolbar (`StoreToolbar`) membaca snapshot-nya untuk menampikan "X dipilih"
 * dan baris aksi massal.
 */

let dipilih: Map<string, StoreRowData> = new Map();
const pendengar = new Set<() => void>();

function emit() {
  // Salinan baru tiap perubahan supaya `useSyncExternalStore` tahu datanya
  // berubah.
  dipilih = new Map(dipilih);
  for (const p of pendengar) p();
}

export function togglePilih(s: StoreRowData) {
  const next = new Map(dipilih);
  if (next.has(s.id)) next.delete(s.id);
  else next.set(s.id, s);
  dipilih = next;
  emit();
}

export function pilihSemua(stores: StoreRowData[], isi: boolean) {
  const next = new Map(dipilih);
  for (const s of stores) {
    if (isi) next.set(s.id, s);
    else next.delete(s.id);
  }
  dipilih = next;
  emit();
}

export function hapusPilih() {
  if (dipilih.size === 0) return;
  dipilih = new Map();
  emit();
}

/** For non-hook callers (like toolbar) */
export function gunakanPilih() {
  return { togglePilih, pilihSemua, hapusPilih };
}

/** Cek apakah satu baris sedang dipilih (untuk non-island / dev tool). */
export function isDipilih(id: string): boolean {
  return dipilih.has(id);
}

const subscribe = (cb: () => void) => {
  pendengar.add(cb);
  return () => {
    pendengar.delete(cb);
  };
};

const EMPTY = new Map<string, StoreRowData>();

const getSnapshot = () => dipilih;
const getServerSnapshot = () => EMPTY;

/** Snapshot `Map<string, StoreRowData>` dari baris yang sedang dipilih. */
export function usePilih(): Map<string, StoreRowData> {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
