import { rupiahRingkas } from '@/lib/format';
import type { SalesPoint } from '@/types';

/**
 * Chart penjualan 7 hari terakhir — SVG murni, tanpa library chart.
 *
 * Kenapa tulis sendiri? (1) bobotnya ~0, (2) tidak menarik dependensi
 * 100kb+ hanya untuk 7 batang, (3) tampilan putih-hitam minimalistik
 * gampang dijaga konsisten dengan sisa panel.
 *
 * Bar = jumlah key yang di-generate per hari. Garis putus-putus =
 * komisi yang terkumpul per hari (skala kanan, tidak perlu sumbu kedua
 * karena hanya ornamentasi).
 */
export function SalesChart({ data }: { data: SalesPoint[] }) {
  const W = 640;
  const H = 200;
  const PADX = 28;
  const PAD_TOP = 12;
  const PAD_BOTTOM = 30;
  const tinggiPlot = H - PAD_TOP - PAD_BOTTOM;

  const maksJumlah = Math.max(1, ...data.map((d) => d.jumlah));
  const maksKomisi = Math.max(1, ...data.map((d) => d.komisi));

  const lebarSlot = (W - PADX * 2) / Math.max(1, data.length);
  const lebarBatang = Math.min(38, lebarSlot * 0.52);

  // Garis komisi (polyline) antar titik tengah batang.
  const titikKomisi = data.map((d, i) => {
    const cx = PADX + lebarSlot * i + lebarSlot / 2;
    const cy = PAD_TOP + tinggiPlot - (d.komisi / maksKomisi) * tinggiPlot * 0.8;
    return `${cx},${cy.toFixed(1)}`;
  });

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="Grafik penjualan 7 hari terakhir"
      >
        {/* garis bantu horizontal */}
        {[0, 0.5, 1].map((f) => {
          const y = PAD_TOP + tinggiPlot - tinggiPlot * f;
          return (
            <g key={f}>
              <line
                x1={PADX}
                y1={y}
                x2={W - PADX}
                y2={y}
                stroke="#e4e4e7"
                strokeWidth={1}
                strokeDasharray={f === 0 ? undefined : '3 3'}
              />
              <text
                x={PADX - 6}
                y={y + 3.5}
                textAnchor="end"
                fontSize={9}
                fill="#a1a1aa"
              >
                {Math.round(maksJumlah * f)}
              </text>
            </g>
          );
        })}

        {/* batang + label */}
        {data.map((d, i) => {
          const h = (d.jumlah / maksJumlah) * tinggiPlot;
          const x = PADX + lebarSlot * i + (lebarSlot - lebarBatang) / 2;
          const y = PAD_TOP + tinggiPlot - h;
          const cx = PADX + lebarSlot * i + lebarSlot / 2;

          return (
            <g key={d.tanggal}>
              <rect
                x={x}
                y={y}
                width={lebarBatang}
                height={Math.max(h, d.jumlah > 0 ? 2 : 0)}
                rx={4}
                fill={d.jumlah > 0 ? '#18181b' : '#e4e4e7'}
              />
              {d.jumlah > 0 ? (
                <text
                  x={cx}
                  y={y - 5}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={700}
                  fill="#18181b"
                >
                  {d.jumlah}
                </text>
              ) : null}
              <text
                x={cx}
                y={H - 10}
                textAnchor="middle"
                fontSize={10}
                fill="#71717a"
              >
                {d.label}
              </text>
            </g>
          );
        })}

        {/* garis komisi */}
        {data.some((d) => d.komisi > 0) ? (
          <>
            <polyline
              points={titikKomisi.join(' ')}
              fill="none"
              stroke="#a1a1aa"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
            {titikKomisi.map((pt, i) => {
              const [cx, cy] = pt.split(',');
              return (
                <circle
                  key={i}
                  cx={Number(cx)}
                  cy={Number(cy)}
                  r={2.5}
                  fill="#71717a"
                  stroke="#fff"
                  strokeWidth={1}
                />
              );
            })}
          </>
        ) : null}
      </svg>

      {/* legenda */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11.5px] text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-zinc-900" />
          Key terjual
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-zinc-400" />
          Komisi per hari ({rupiahRingkas(data.reduce((s, d) => s + d.komisi, 0))} total)
        </span>
      </div>
    </div>
  );
}
