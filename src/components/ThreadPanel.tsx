import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Archive } from "../data/dataset";
import type { LifeReceipt } from "../engine/types";
import { getThread } from "../engine/connections";
import { TYPE_COLOR, STRENGTH_CLASS, STRENGTH_LABEL } from "./receiptMeta";
import { fmtDate, fmtTime } from "../engine/format";

interface Props {
  receipt: LifeReceipt;
  archive: Archive;
  onClose: () => void;
  onOpenReceipt: (id: string) => void;
}

/**
 * The archive's side-panel thread: the selected receipt, its connections
 * ranked strongest first, every link labeled with its strength and reason.
 */
export default function ThreadPanel({ receipt, archive, onClose, onOpenReceipt }: Props) {
  const links = useMemo(() => getThread(archive, receipt), [archive, receipt]);
  const session = receipt.sessionId !== undefined ? archive.sessionById.get(receipt.sessionId) : undefined;

  return (
    <AnimatePresence>
      <motion.aside
        key="thread"
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 24 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        aria-label="Connected receipts"
        className="border border-accent/40 bg-surface-soft p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="label text-accent">The thread</p>
          <button
            onClick={onClose}
            className="text-[11px] uppercase tracking-[0.16em] text-mute transition-colors hover:text-paper"
          >
            Close
          </button>
        </div>

        <div className="mt-4 border-l-2 border-accent/60 pl-4">
          <p className={`text-sm ${TYPE_COLOR[receipt.type]}`}>{receipt.title}</p>
          <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-mute">
            {fmtTime(receipt.ts)} · {fmtDate(receipt.ts)}
          </p>
        </div>

        {session && receipt.source === "spotify" && (
          <p className="mt-4 text-xs leading-relaxed text-faded">
            Belongs to a listening session — {session.tracks} tracks,{" "}
            {session.artists.length} artists
            {session.dominantArtist ? `, most-played artist: ${session.dominantArtist}` : ""}.
            {session.lateNight && " It began after midnight."}
          </p>
        )}

        <p className="mt-5 label">
          {links.length > 0 ? `${links.length} connections` : "No strong connections"}
        </p>

        {links.length === 0 ? (
          <p className="mt-3 text-xs leading-relaxed text-mute">
            Nothing in the archive ties to this receipt strongly enough to draw.
            Some moments stand alone — that is a finding too.
          </p>
        ) : (
          <ol className="mt-3 space-y-0">
            {links.map((link, i) => (
              <li key={`${link.receipt.id}-${i}`}>
                <button
                  onClick={() => onOpenReceipt(link.receipt.id)}
                  className="group w-full border-b border-line/60 py-3 text-left transition-colors hover:bg-ink"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className={`truncate text-sm ${TYPE_COLOR[link.receipt.type]}`}>
                      {link.receipt.title}
                    </span>
                    <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-mute">
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
              </li>
            ))}
          </ol>
        )}

        <p className="mt-5 border-t border-line pt-4 text-[11px] leading-relaxed text-mute">
          Connections are computed, deterministic and explained. The archive shows
          what happened together — not why.
        </p>
      </motion.aside>
    </AnimatePresence>
  );
}
