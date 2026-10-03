import { StoreListSkeleton } from '@/components/ui/skeleton';

/** Placeholder selagi server mengambil data /toko dari Supabase. */
export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-4 w-72 animate-pulse rounded bg-zinc-200/70" />
      <StoreListSkeleton rows={5} />
    </div>
  );
}
