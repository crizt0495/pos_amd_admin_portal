import { KeyListSkeleton } from '@/components/ui/skeleton';

/** Placeholder selagi server mengambil data /keys dari Supabase. */
export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-4 w-72 animate-pulse rounded bg-zinc-200/70" />
      <KeyListSkeleton rows={5} />
    </div>
  );
}
