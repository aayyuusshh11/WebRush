import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { ArchiveMeta } from "../engine/types";
import { fmtCount, fmtMonthKey } from "../engine/format";

interface Props {
  meta: ArchiveMeta;
  onBegin: () => void;
}

/**
 * The trace field: every point is a real month of the archive.
 * x = time (2013 → 2024), height = activity, brightness = density.
 * Decorative only (aria-hidden); the same data is shown readably below.
 */
function TraceField({ meta }: { meta: ArchiveMeta }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const months = [...meta.monthly.entries()].sort(([a], [b]) => a.localeCompare(b));
    if (months.length === 0) return;
    const maxCount = Math.max(...months.map(([, c]) => c.music + c.purchase + c.ledger));
    const first = Date.parse(`${months[0][0]}-01T00:00:00Z`);
    const last = Date.parse(`${months[months.length - 1][0]}-28T00:00:00Z`);
    const span = Math.max(1, last - first);

    let raf = 0;
    let running = true;
    // Only animate while the hero is on screen — saves CPU/battery when the
    // reader has scrolled into the archive.
    let inView = true;
    const io = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        if (inView && !reduced) {
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(draw);
        }
      },
      { threshold: 0 },
    );
    io.observe(canvas);

    const draw = (t: number) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      months.forEach(([key, c], i) => {
        const count = c.music + c.purchase + c.ledger;
        const x = ((Date.parse(`${key}-01T00:00:00Z`) - first) / span) * w;
        const seed = Math.sin(i * 12.9898) * 43758.5453;
        const jitter = (seed - Math.floor(seed) - 0.5) * 0.7;
        const drift = reduced ? 0 : Math.sin(t / 4000 + i) * 1.5;
        const y = h * (0.82 - Math.pow(count / maxCount, 0.8) * 0.62) + jitter * h * 0.12 + drift;
        const alpha = 0.12 + (count / maxCount) * 0.55;
        const r = 0.8 + (count / maxCount) * 1.7;

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(215, 167, 101, ${alpha.toFixed(3)})`;
        ctx.fill();

        // faint reflection toward the baseline
        ctx.beginPath();
        ctx.arc(x, h - (y - h * 0.18), r * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(215, 167, 101, ${(alpha * 0.25).toFixed(3)})`;
        ctx.fill();
      });

      if (running && !reduced && inView) raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    const onResize = () => { if (reduced) draw(0); };
    window.addEventListener("resize", onResize);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [meta, reduced]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="absolute inset-x-0 bottom-0 h-[46vh] w-full opacity-90"
    />
  );
}

const line = {
  hidden: { opacity: 0, y: 26 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.25 + i * 0.22, duration: 0.9, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

export default function Hero({ meta, onBegin }: Props) {
  const busiest = [...meta.monthly.entries()].sort(
    (a, b) => b[1].music + b[1].purchase + b[1].ledger - (a[1].music + a[1].purchase + a[1].ledger),
  )[0];

  return (
    <header id="top" className="heartglow relative flex min-h-screen flex-col overflow-hidden">
      <TraceField meta={meta} />

      <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 pt-24 sm:px-8">
        <motion.p custom={0} variants={line} initial="hidden" animate="show" className="label">
          An interactive archive · 2013 — 2024
        </motion.p>

        <h1 className="mt-8 font-display leading-[0.98]">
          <motion.span custom={1} variants={line} initial="hidden" animate="show" className="block text-[15vw] text-paper sm:text-7xl md:text-8xl">
            A life leaves
          </motion.span>
          <motion.span custom={2} variants={line} initial="hidden" animate="show" className="block text-[15vw] italic text-accent sm:text-7xl md:text-8xl">
            traces.
          </motion.span>
        </h1>

        <motion.p custom={3} variants={line} initial="hidden" animate="show" className="mt-8 max-w-xl text-sm leading-relaxed text-faded sm:text-base">
          {fmtCount(meta.musicPlays)} songs. {fmtCount(meta.purchases)} card payments.
          {fmtCount(meta.ledgerEntries)} ledger entries. Individually, ordinary.
          Together — a story that has not been read yet.
        </motion.p>

        <motion.div custom={4} variants={line} initial="hidden" animate="show" className="mt-12 flex flex-wrap items-center gap-6">
          <button
            onClick={onBegin}
            className="group border border-accent/70 px-7 py-3.5 text-xs uppercase tracking-[0.22em] text-accent transition-colors hover:bg-accent hover:text-ink"
          >
            Begin trace
            <span aria-hidden className="ml-3 inline-block transition-transform group-hover:translate-x-1">
              ↓
            </span>
          </button>
          {busiest && (
            <p className="text-[11px] uppercase tracking-[0.16em] text-mute">
              Busiest month on record · {fmtMonthKey(busiest[0])}
            </p>
          )}
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 1 }}
        className="relative mx-auto w-full max-w-6xl px-5 pb-8 sm:px-8"
      >
        <p className="text-[11px] uppercase tracking-[0.16em] text-mute">
          Scroll — the receipts are already here.
        </p>
      </motion.div>
    </header>
  );
}
