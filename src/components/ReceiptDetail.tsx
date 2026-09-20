import { useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Archive } from "../data/dataset";
import type { LifeReceipt, ThreadLink } from "../engine/types";
import { getThread } from "../engine/connections";
import {
  fmtAmount,
  fmtCount,
  fmtDate,
  fmtDayLong,
  fmtDuration,
  fmtGap,
  fmtTime,
} from "../engine/format";

const TYPE_COLOR: Record<LifeReceipt["type"], string> = {
  music: "text-music",
  purchase: "text-purchase",
  expense: "text-expense",
  income: "text-income",
  transfer: "text-transfer",
};

const TYPE_NAME: Record<LifeReceipt["type"], string> = {
  music: "A song",
  purchase: "A purchase",
  expense: "An expense",
  income: "Income",
  transfer: "A transfer",
};

function ThreadNode({
  link,
  onOpen,
}: {
  link: ThreadLink;
  onOpen: (id: string) => void;
}) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <button
        onClick={() => onOpen(link.receipt.id)}
        className="group relative block w-full py-4 pl-8 text-left transition-colors hover:bg-surface/60"
      >
        <span
          aria-hidden
          className="absolute left-[5px] top-6 h-2 w-2 rounded-full bg-accent"
        />
        <span
          aria-hidden
          className="absolute left-[8px] top-0 h-full w-px bg-line"
        />
        <div className="flex items-baseline justify-between gap-3">
          <span className={`text-sm ${TYPE_COLOR[link.receipt.type]}`}>
            {link.receipt.title}
          </span>
          <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-mute tabular-nums">
            {fmtTime(link.receipt.ts)}
          </span>
        </div>
        <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-mute">
          {link.reason}
        </p>
      </button>
    </motion.li>
  );
}

interface Props {
  archive: Archive;
  receiptId: string;
  onClose: () => void;
  onOpenReceipt: (id: string) => void;
  onOpenDay: (dayKey: string) => void;
}

export default function ReceiptDetail({
  archive,
  receiptId,
  onClose,
  onOpenReceipt,
  onOpenDay,
}: Props) {
  const receipt = archive.byId.get(receiptId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const links = useMemo(
    () => (receipt ? getThread(archive, receipt) : []),
    [archive, receipt],
  );

  if (!receipt) return null;

  const session =
    receipt.sessionId !== undefined ? archive.sessionById.get(receipt.sessionId) : undefined;

  const details: Array<[string, string]> = [];
  if (receipt.source === "spotify") {
    if (receipt.subtitle) details.push(["Artist", receipt.subtitle]);
    if (receipt.album) details.push(["Album", receipt.album]);
    if (receipt.msPlayed !== undefined) details.push(["Played", fmtDuration(receipt.msPlayed)]);
    details.push(["Ended as", receipt.skipped ? "skipped" : "played through"]);
    if (receipt.platform) details.push(["Platform", receipt.platform]);
  } else if (receipt.source === "card") {
    if (receipt.amount !== undefined) details.push(["Amount", fmtAmount(receipt.amount)]);
    if (receipt.category) details.push(["Category", receipt.category]);
    if (receipt.city || receipt.state)
      details.push(["Place", [receipt.city, receipt.state].filter(Boolean).join(", ")]);
  } else {
    if (receipt.amount !== undefined) details.push(["Amount", fmtAmount(receipt.amount)]);
    if (receipt.category) details.push(["Category", receipt.category]);
    if (receipt.platform) details.push(["Mode", receipt.platform]);
    if (receipt.subtitle) details.push(["Note", receipt.subtitle]);
  }

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        onClick={onClose}
        className="fixed inset-0 z-[70] bg-ink/80 backdrop-blur-sm"
        aria-hidden
      />
      <motion.div
        key="panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Receipt: ${receipt.title}`}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-x-0 bottom-0 z-[71] max-h-[92vh] overflow-y-auto border-t border-accent/40 bg-surface-soft sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[520px] sm:border-l sm:border-t-0"
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <p className="label">{TYPE_NAME[receipt.type]}</p>
          <button
            onClick={onClose}
            className="border border-line px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-faded transition-colors hover:border-accent hover:text-accent"
          >
            Close · esc
          </button>
        </div>

        <div className="px-6 py-7">
          <p className="text-[11px] uppercase tracking-[0.18em] text-mute">
            {fmtDayLong(receipt.ts)} · {fmtTime(receipt.ts)}
          </p>
          <h3 className={`mt-3 font-display text-4xl leading-tight sm:text-5xl ${TYPE_COLOR[receipt.type]}`}>
            {receipt.title}
          </h3>
          {receipt.subtitle && receipt.source === "spotify" && (
            <p className="mt-2 font-display text-2xl italic text-faded">{receipt.subtitle}</p>
          )}

          <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-4">
            {details.map(([k, v]) => (
              <div key={k}>
                <dt className="label">{k}</dt>
                <dd className="mt-1 text-sm text-paper">{v}</dd>
              </div>
            ))}
          </dl>

          {session && (
            <button
              onClick={() => onOpenReceipt(session.receiptIds[0])}
              className="mt-6 block w-full border border-line bg-ink/60 p-4 text-left transition-colors hover:border-accent"
            >
              <p className="label">Part of session #{session.id + 1}</p>
              <p className="mt-1.5 text-sm text-faded">
                {session.tracks} tracks · {session.artists.length} artists ·{" "}
                {fmtTime(session.start)} — {fmtTime(session.end)}
                {session.lateNight && <span className="text-music"> · after midnight</span>}
              </p>
            </button>
          )}
        </div>

        <div className="border-t border-line px-6 py-7">
          <div className="flex items-baseline justify-between">
            <p className="label text-accent">
              {links.length > 0 ? "What connects to it" : "No strong connections"}
            </p>
            {links.length > 0 && (
              <p className="text-[10px] uppercase tracking-[0.14em] text-mute">
                {links.length} of {fmtCount(archive.receipts.length - 1)} others
              </p>
            )}
          </div>

          {links.length === 0 ? (
            <p className="mt-4 text-sm leading-relaxed text-faded">
              Nothing in the archive is close enough in time, place or pattern to
              link. Some receipts stay alone.
            </p>
          ) : (
            <ol className="mt-2">
              {links.map((link) => (
                <ThreadNode key={link.receipt.id + link.reason} link={link} onOpen={onOpenReceipt} />
              ))}
            </ol>
          )}

          {links.length >= 3 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="mt-6 border-l-2 border-accent pl-4 font-display text-xl italic leading-snug text-paper"
            >
              What looked like {links.length} separate receipts
              <br />
              was one stretch of a life.
            </motion.p>
          )}
        </div>

        <div className="border-t border-line px-6 py-6">
          <button
            onClick={() => onOpenDay(receipt.dayKey)}
            className="border border-accent/70 px-5 py-3 text-[11px] uppercase tracking-[0.18em] text-accent transition-colors hover:bg-accent hover:text-ink"
          >
            Open {fmtDate(receipt.ts)} in the archive →
          </button>
          <p className="mt-4 text-[11px] leading-relaxed text-mute">
            The nearest thread link sits {links[0] ? fmtGap(receipt.ts, links[0].receipt.ts).toLowerCase() : "further than the evidence allows"}.
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
