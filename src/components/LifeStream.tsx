import { useEffect, useMemo, useRef, useState } from "react";
import type { ArchiveMeta } from "../engine/types";
import { fmtCount, fmtMonthKey } from "../engine/format";

const COLORS = {
  music: "215, 167, 101",
  purchase: "124, 152, 133",
  ledger: "122, 147, 168",
};

interface Hover {
  x: number;
  monthKey: string;
  music: number;
  purchase: number;
  ledger: number;
}

/**
 * The digital journey as an activity field: one column per month,
 * three lanes (music / card / ledger). Dense periods read as texture.
 */
export default function LifeStream({ meta }: { meta: ArchiveMeta }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Hover | null>(null);

  const months = useMemo(
    () => [...meta.monthly.entries()].sort(([a], [b]) => a.localeCompare(b)),
    [meta],
  );
  const maxMusic = Math.max(1, ...months.map(([, c]) => c.music));
  const maxPurchase = Math.max(1, ...months.map(([, c]) => c.purchase));
  const maxLedger = Math.max(1, ...months.map(([, c]) => c.ledger));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx || months.length === 0) return;

    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const padL = 2;
      const colW = (w - padL) / months.length;

      // year gridlines
      ctx.strokeStyle = "rgba(242, 239, 232, 0.06)";
      ctx.lineWidth = 1;
      for (let year = 2013; year <= 2024; year++) {
        const x = padL + ((year - 2013) / 12) * w;
        if (year > 2013) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
      }

      const musicBottom = h * 0.58;
      const purchaseBottom = h * 0.78;
      const ledgerBottom = h * 0.98;

      months.forEach(([, c], i) => {
        const x = padL + i * colW;
        const barW = Math.max(1.25, colW * 0.62);

        if (c.music > 0) {
          const bh = Math.max(1, (c.music / maxMusic) * (musicBottom - 8));
          ctx.fillStyle = `rgba(${COLORS.music}, 0.55)`;
          ctx.fillRect(x, musicBottom - bh, barW, bh);
        }
        if (c.purchase > 0) {
          const bh = Math.max(1, (c.purchase / maxPurchase) * (purchaseBottom - musicBottom - 6));
          ctx.fillStyle = `rgba(${COLORS.purchase}, 0.6)`;
          ctx.fillRect(x, purchaseBottom - bh, barW, bh);
        }
        if (c.ledger > 0) {
          const bh = Math.max(1, (c.ledger / maxLedger) * (ledgerBottom - purchaseBottom - 6));
          ctx.fillStyle = `rgba(${COLORS.ledger}, 0.6)`;
          ctx.fillRect(x, ledgerBottom - bh, barW, bh);
        }
      });
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [months, maxMusic, maxPurchase, maxLedger]);

  const onMove = (e: React.MouseEvent) => {
    const wrap = wrapRef.current;
    if (!wrap || months.length === 0) return;
    const rect = wrap.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const idx = Math.min(months.length - 1, Math.floor(ratio * months.length));
    const [monthKey, c] = months[idx];
    setHover({ x: ratio * rect.width, monthKey, ...c });
  };

  const hoverCount = hover ? hover.music + hover.purchase + hover.ledger : 0;

  return (
    <div className="relative">
      <div
        ref={wrapRef}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        className="relative h-52 w-full cursor-crosshair sm:h-64"
      >
        <canvas ref={canvasRef} className="h-full w-full" aria-hidden />
        {hover && (
          <div
            className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 whitespace-nowrap border border-line bg-surface px-3 py-2 text-left"
            style={{
              // Clamp inside the chart so the tooltip never overflows on narrow screens.
              left: `${Math.min(92, Math.max(8, (hover.x / (wrapRef.current?.clientWidth ?? 1)) * 100))}%`,
            }}
          >
            <p className="text-[10px] uppercase tracking-[0.18em] text-mute">
              {fmtMonthKey(hover.monthKey)}
            </p>
            <p className="mt-1 text-xs text-paper">
              {fmtCount(hoverCount)} receipts
              {hover.music > 0 && <span className="text-music"> · {fmtCount(hover.music)} plays</span>}
              {hover.purchase > 0 && <span className="text-purchase"> · {hover.purchase} paid</span>}
              {hover.ledger > 0 && <span className="text-income"> · {hover.ledger} ledger</span>}
            </p>
          </div>
        )}
      </div>

      {/* year scale */}
      <div className="relative mt-2 h-4" aria-hidden>
        {[2013, 2016, 2019, 2022, 2024].map((y) => (
          <span
            key={y}
            className="absolute -translate-x-1/2 text-[10px] tracking-[0.18em] text-mute"
            style={{ left: `${((y - 2013) / 12) * 100}%` }}
          >
            {y}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        {(
          [
            ["music", "Streaming"],
            ["purchase", "Card payments"],
            ["ledger", "Household ledger"],
          ] as const
        ).map(([color, label]) => (
          <span key={color} className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-mute">
            <span
              aria-hidden
              className="inline-block h-2 w-2"
              style={{ backgroundColor: `rgba(${COLORS[color]}, 0.85)` }}
            />
            {label}
          </span>
        ))}
      </div>

      {/* Semantic equivalent for screen readers — the actual data, not a
          description of a chart. Months without detail rows are aggregates. */}
      <table className="sr-only">
        <caption>
          Life stream, month by month from 2013 to 2024: music plays, card
          payments and household ledger entries. Music before 2022 is a monthly
          aggregate; 2022–2024 and all card and ledger rows are detailed.
        </caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Music</th>
            <th scope="col">Purchases</th>
            <th scope="col">Ledger</th>
          </tr>
        </thead>
        <tbody>
          {months.map(([key, c]) => (
            <tr key={key}>
              <th scope="row">{fmtMonthKey(key)}</th>
              <td>{c.music}</td>
              <td>{c.purchase}</td>
              <td>{c.ledger}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
