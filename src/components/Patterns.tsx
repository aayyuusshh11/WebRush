import { useEffect, useRef } from "react";
import SectionHeader from "./SectionHeader";
import type { Patterns as PatternsData } from "../engine/patterns";
import type { ArchiveMeta } from "../engine/types";
import { fmtAmount, fmtCount, fmtDate } from "../engine/format";

/* ---------- hour histogram (canvas, drawn once) ---------- */

function HourCanvas({
  bins,
  peak,
  color,
  ariaLabel,
}: {
  bins: number[];
  peak: number;
  color: string;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const max = Math.max(1, ...bins);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const n = bins.length;
      const gap = 3;
      const barW = Math.max(2, (w - gap * (n - 1)) / n);
      for (let i = 0; i < n; i++) {
        const bh = Math.max(1, (bins[i] / max) * (h - 14));
        const x = i * (barW + gap);
        ctx.fillStyle = i === peak ? `rgba(${color}, 0.95)` : `rgba(${color}, 0.35)`;
        ctx.fillRect(x, h - bh, barW, bh);
      }
      ctx.fillStyle = "rgba(101, 99, 106, 0.9)";
      ctx.font = "9px Inter, sans-serif";
      ctx.textAlign = "center";
      for (const hr of [0, 6, 12, 18]) {
        const x = hr * (barW + gap) + barW / 2;
        ctx.fillText(String(hr).padStart(2, "0"), x, h - 2);
      }
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [bins, peak, max, color]);

  return <canvas ref={ref} className="h-28 w-full" role="img" aria-label={ariaLabel} />;
}

/* ---------- typographic bar list ---------- */

function BarList({
  rows,
  unit,
  formatValue,
  ariaLabel,
}: {
  rows: Array<[string, number]>;
  unit?: string;
  formatValue?: (v: number) => string;
  ariaLabel: string;
}) {
  const max = Math.max(1, ...rows.map(([, v]) => v));
  return (
    <ul className="space-y-3" aria-label={ariaLabel}>
      {rows.map(([label, value], i) => (
        <li key={label} className="group">
          <div className="flex items-baseline justify-between gap-4">
            <span className="truncate text-sm text-paper">
              <span className="mr-2 font-display text-base italic text-mute">{String(i + 1).padStart(2, "0")}</span>
              {label}
            </span>
            <span className="shrink-0 text-[11px] uppercase tracking-[0.14em] text-mute">
              {formatValue ? formatValue(value) : `${fmtCount(value)}${unit ? ` ${unit}` : ""}`}
            </span>
          </div>
          <div className="mt-1.5 h-px w-full bg-line">
            <div
              className="h-px bg-accent/60 transition-all duration-700"
              style={{ width: `${(value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ---------- section ---------- */

interface Props {
  patterns: PatternsData;
  meta: ArchiveMeta;
}

export default function Patterns({ patterns: p, meta }: Props) {
  const nightYears = Object.entries(meta.nightShareByYear).sort(([a], [b]) => a.localeCompare(b));
  const maxNight = Math.max(0.01, ...nightYears.map(([, v]) => v));

  return (
    <section id="patterns" aria-labelledby="patterns-title" className="scroll-mt-16 border-t border-line bg-surface/40 py-24 sm:py-32">
      <SectionHeader
        eyebrow="Patterns"
        title={<span id="patterns-title">What the traces repeat.</span>}
        lede="Counted, not guessed. Each observation below is a measurement over the full archive — hover the streams, read the numbers."
      />

      <div className="mx-auto mt-16 grid w-full max-w-6xl gap-14 px-5 sm:px-8 lg:grid-cols-2 lg:gap-x-16">
        {/* WHEN */}
        <div>
          <h3 className="label">When</h3>
          <div className="mt-6 space-y-8">
            <div>
              <p className="text-sm text-paper">
                Plays cluster after midnight —{" "}
                <span className="text-accent">
                  {String(p.peakHour).padStart(2, "0")}:00
                </span>{" "}
                is the busiest hour.
              </p>
              <div className="mt-4">
                <HourCanvas
                  bins={p.musicHours}
                  peak={p.peakHour}
                  color="215, 167, 101"
                  ariaLabel={`Plays by hour of day, peak at hour ${p.peakHour}`}
                />
              </div>
            </div>
            <div>
              <p className="text-sm text-paper">
                Payments keep office hours — the card wakes up later than the music.
              </p>
              <div className="mt-4">
                <HourCanvas
                  bins={p.purchaseHours}
                  peak={p.purchaseHours.indexOf(Math.max(...p.purchaseHours))}
                  color="124, 152, 133"
                  ariaLabel="Card payments by hour of day"
                />
              </div>
            </div>
          </div>
        </div>

        {/* WHAT */}
        <div>
          <h3 className="label">What</h3>
          <div className="mt-6 space-y-9">
            <div>
              <p className="mb-4 text-sm text-paper">Most-played artists, all time</p>
              <BarList
                rows={meta.topArtistsAllTime.slice(0, 6)}
                unit="plays"
                ariaLabel="Most played artists of all time"
              />
            </div>
            <div>
              <p className="mb-4 text-sm text-paper">Where the card went</p>
              <BarList
                rows={p.spendByCategory.slice(0, 5).map((c) => [c.category, c.total] as [string, number])}
                formatValue={(v) => fmtAmount(v)}
                ariaLabel="Card spending by category"
              />
            </div>
          </div>
        </div>

        {/* REPEATS */}
        <div>
          <h3 className="label">Repeats</h3>
          <dl className="mt-6 space-y-5">
            <div className="rule pt-4">
              <dt className="text-sm text-faded">Longest daily listening streak</dt>
              <dd className="mt-1 font-display text-2xl text-paper">
                {p.streak.length} days
                <span className="ml-3 align-middle text-[11px] uppercase tracking-[0.14em] text-mute">
                  from {p.streak.startTs ? fmtDate(p.streak.startTs) : "—"}
                </span>
              </dd>
            </div>
            {p.rituals.slice(0, 4).map((r) => (
              <div key={r.label} className="rule pt-4">
                <dt className="text-sm text-faded">{r.label}</dt>
                <dd className="mt-1 font-display text-2xl text-paper">
                  {r.count}×
                  <span className="ml-3 align-middle text-[11px] uppercase tracking-[0.14em] text-mute">
                    {r.medianAmount !== undefined ? `~${fmtAmount(r.medianAmount)} each` : ""}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* CHANGES */}
        <div>
          <h3 className="label">Changes</h3>
          <p className="mt-6 text-sm leading-relaxed text-faded">
            Share of all plays that happened between midnight and 6 AM, by year.
            The night never quite lets go.
          </p>
          <ul className="mt-6 space-y-2.5" aria-label="Late-night listening share by year">
            {nightYears.map(([year, share]) => (
              <li key={year} className="flex items-center gap-3">
                <span className="w-10 shrink-0 text-[11px] tabular-nums tracking-[0.14em] text-mute">
                  {year}
                </span>
                <div className="h-2.5 flex-1 bg-line/60">
                  <div
                    className="h-2.5 bg-income/50"
                    style={{ width: `${(share / maxNight) * 100}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-faded">
                  {Math.round(share * 100)}%
                </span>
              </li>
            ))}
          </ul>
          {p.daysWithBoth > 0 && (
            <p className="mt-8 rule pt-5 text-sm leading-relaxed text-faded">
              From 2022 the archives overlap —{" "}
              <span className="text-paper">{fmtCount(p.daysWithBoth)} days</span> carry
              both music and money.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
