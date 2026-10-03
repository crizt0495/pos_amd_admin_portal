/**
 * Placeholder saat data sedang dimuat.
 *
 * Dipakai sebagai `loading.tsx` di App Router. Sengaja pakai blok abu-abu
 * dengan `animate-pulse`, bukan spinner: bentuknya sudah menyerupai tabel
 * yang akan muncul, jadi tidak ada "lompatan" tata letak setelah loading
 * selesai.
 */

function Bar({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-zinc-200/70 ${className}`} />;
}

/** Kerangka tabel untuk layar lebar. */
export function TableSkeleton({
  rows = 5,
  cols = 6,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div
      className="table-wrap rounded-2xl border border-zinc-200/80 bg-white"
      aria-busy="true"
      aria-live="polite"
      aria-label="Memuat data"
    >
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr>
            {Array.from({ length: cols }, (_, i) => (
              <th key={i} className="table-head">
                <Bar className="h-2.5 w-16" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }, (_, c) => (
                <td key={c} className="table-cell">
                  {/* Kolom kedua dibuat lebih lebar — di situ nama/alamat pembeli. */}
                  <Bar className={`h-3 ${c === 1 ? 'w-40' : 'w-20'}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Kerangka daftar kartu untuk layar HP — pasangan `TableSkeleton`. */
export function CardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <ul className="card-list" aria-busy="true" aria-live="polite" aria-label="Memuat data">
      {Array.from({ length: rows }, (_, r) => (
        <li key={r} className="card-soft space-y-2 p-3.5">
          <Bar className="h-3.5 w-32" />
          <Bar className="h-3 w-full" />
          <Bar className="h-3 w-2/3" />
        </li>
      ))}
    </ul>
  );
}

/** Rangka daftar key untuk halaman /keys: tabel di atas, kartu di bawah. */
export function KeyListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <>
      <TableSkeleton rows={rows} />
      <div className="mt-2.5">
        <CardSkeleton rows={3} />
      </div>
    </>
  );
}

/** Kerangka daftar toko untuk halaman /toko. */
export function StoreListSkeleton({ rows = 5 }: { rows?: number }) {
  return <TableSkeleton rows={rows} cols={10} />;
}
