import * as React from 'react';

import { cn } from '@/lib/utils';
import { STATUS_BADGE, STATUS_LABEL, tierRule } from '@/lib/tier';
import type { LicenseStatus, TierName } from '@/types';

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-bold',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function TierBadge({ tier }: { tier: TierName | string | null | undefined }) {
  const rule = tierRule(tier);
  return <Badge className={rule.badgeBg}>{rule.name}</Badge>;
}

export function KeyStatusBadge({ status }: { status: LicenseStatus }) {
  return (
    <Badge className={cn(STATUS_BADGE[status] ?? 'bg-zinc-100 text-zinc-600')}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

export function StoreStatusBadge({ aktif }: { aktif: boolean }) {
  return aktif ? (
    <Badge className="bg-emerald-50 text-emerald-700">Aktif</Badge>
  ) : (
    <Badge className="bg-zinc-100 text-zinc-600">Nonaktif</Badge>
  );
}

/** Badge sisa kuota — warna menarik perhatian saat menipis. */
export function KuotaBadge({ sisa }: { sisa: number }) {
  if (sisa <= 0) return <Badge className="bg-red-50 text-red-700">Habis</Badge>;
  if (sisa <= 2) return <Badge className="bg-amber-50 text-amber-800">{sisa} key</Badge>;
  return <Badge className="bg-zinc-100 text-zinc-700">{sisa} key</Badge>;
}
