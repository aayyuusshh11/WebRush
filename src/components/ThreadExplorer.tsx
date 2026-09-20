import { useMemo, useRef } from "react";
import { motion } from "framer-motion";
import type { Archive } from "../data/dataset";
import type { LifeReceipt } from "../engine/types";
import { getThread } from "../engine/connections";
import { TYPE_COLOR, STRENGTH_CLASS, STRENGTH_LABEL } from "./receiptMeta";

/** Connector dots inherit the strength color so link classes read at a glance. */
const STRENGTH_DOT: Record<string, string> = {
  session: "bg-music",
  temporal: "bg-paper",
  recurring: "bg-accent",
  contextual: "bg-mute",
};
import { fmtCount, fmtDate, fmtTime } from "../engine/format";

interface Props {
  archive: Archive;
  /** The receipt currently at the center of the thread. */
  receipt: LifeReceipt;
  /** Make a connected receipt the new center. */
  onNavigate: (id: string) => void;
}

/**
 * Pull the Thread, upgraded: the focused receipt sits at the center and its
 * connections radiate below it as explorable nodes. Every node states its
 * strength (Session / Temporal / Recurring / Contextual), its evidence
 * ("same day · 11 min apart"), and can itself become the new center.
 * Fully keyboard-operable: Tab / Enter on nodes, ArrowUp / ArrowDown to
 * move between them.
 */
export default function ThreadExplorer({ archive, receipt, onNavigate }: Props) {
  const links = useMemo(() => getThread(archive, receipt), [archive, receipt]);
  const nodeRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (links.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      nodeRefs.current[(index + 1) % links.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      nodeRefs.current[(index - 1 + links.length) % links.length]?.focus();
    }
  };

  return (
    <div role="region" aria-label="Pull the thread">
      <div className="flex items-baseline justify-between">
        <p className="label text-accent">
          {links.length > 0 ? "What connects to it" : "No strong connections"}
        </p>
        {links.length > 0 && (
          <p className="text-[10px] uppercase tracking-[0.14em] text-mute">
            {links.length} of {fmtCount(archive.receipts.length - 1)} others · strongest first
          </p>
        )}
      </div>

      {links.length === 0 ? (
        <p className="mt-4 text-sm leading-relaxed text-faded">
          Nothing in the archive is close enough in time, place or pattern to
          link. Some receipts stay alone.
        </p>
      ) : (
        <>
          {/* the center node — refocusing slides in the new focus */}
          <motion.div
            key={receipt.id}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="mt-4 border border-accent/50 bg-ink/60 p-4"
          >
            <p className={`text-sm ${TYPE_COLOR[receipt.type]}`}>{receipt.title}</p>
            <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-mute">
              {fmtDate(receipt.ts)} · {fmtTime(receipt.ts)}
            </p>
          </motion.div>

          {/* connection nodes, strongest first */}
          <ol className="mt-2" aria-label={`${links.length} connected receipts, ranked by strength`}>
            {links.map((link, i) => (
              <motion.li
                key={link.receipt.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: Math.min(0.3, i * 0.05), ease: [0.16, 1, 0.3, 1] }}
              >
                <button
                  ref={(el) => {
                    nodeRefs.current[i] = el;
                  }}
                  onClick={() => onNavigate(link.receipt.id)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                  className="group relative block w-full py-4 pl-8 text-left transition-colors hover:bg-surface/60"
                  aria-label={`Connected via ${STRENGTH_LABEL[link.strength]}: ${link.reason}. Open ${link.receipt.title}.`}
                >
                  <span
                    aria-hidden
                    className={`absolute left-[5px] top-6 h-2 w-2 rounded-full ${STRENGTH_DOT[link.strength]}`}
                  />
                  <span
                    aria-hidden
                    className="absolute left-[8px] top-0 h-full w-px bg-line"
                  />
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="mr-1 shrink-0 font-display text-sm italic text-mute">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className={`min-w-0 flex-1 truncate text-sm ${TYPE_COLOR[link.receipt.type]}`}>
                      {link.receipt.title}
                    </span>
                    <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-mute tabular-nums">
                      {fmtTime(link.receipt.ts)}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-mute">
                    <span className={STRENGTH_CLASS[link.strength]}>
                      {STRENGTH_LABEL[link.strength]}
                    </span>
                    {" · "}
                    {link.reason}
                  </p>
                </button>
              </motion.li>
            ))}
          </ol>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="mt-6 border-l-2 border-accent pl-4 font-display text-xl italic leading-snug text-paper"
          >
            One receipt, {links.length} connections —
            <br />
            each with its evidence attached.
          </motion.p>
        </>
      )}
    </div>
  );
}
