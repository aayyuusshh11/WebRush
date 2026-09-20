import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Archive } from "../data/dataset";
import { getThread } from "../engine/connections";
import {
  fmtAmount,
  fmtDate,
  fmtDayLong,
  fmtDuration,
  fmtGap,
  fmtTime,
} from "../engine/format";
import { TYPE_NAME } from "./receiptMeta";
import ThreadExplorer from "./ThreadExplorer";

interface Props {
  archive: Archive;
  /** Entry receipt for this drawer session (from App state). */
  receiptId: string;
  onClose: () => void;
  onOpenDay: (dayKey: string) => void;
}

export default function ReceiptDetail({
  archive,
  receiptId,
  onClose,
  onOpenDay,
}: Props) {
  /* Thread exploration context: the back stack holds the full path of
     receipts visited in this drawer session, so a reader can follow a
     thread across years and still find the way home. External navigation
     (chapters, archive rows) changes receiptId and resets the path. */
  const [stack, setStack] = useState<Array<string>>([receiptId]);
  useEffect(() => {
    setStack([receiptId]);
  }, [receiptId]);

  const focusId = stack[stack.length - 1];
  const receipt = archive.byId.get(focusId);
  const previousTitle =
    stack.length > 1 ? archive.byId.get(stack[stack.length - 2])?.title : undefined;

  const navigate = (id: string) => setStack((s) => [...s, id]);
  const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));

  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Focus management: move focus into the dialog when it opens, keep Tab
  // cycling inside it while it is up, and hand focus back on close.
  useEffect(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      const panel = panelRef.current;
      if (e.key !== "Tab" || !panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (!panel.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      restoreFocusRef.current?.focus();
    };
  }, [onClose]);

  const threadLinks = useMemo(
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
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Receipt: ${receipt.title}`}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-x-0 bottom-0 z-[71] max-h-[92vh] overflow-y-auto border-t border-accent/40 bg-surface-soft sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[520px] sm:border-l sm:border-t-0"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-4">
          <p className="label">{TYPE_NAME[receipt.type]}</p>
          <div className="flex items-center gap-3">
            {stack.length > 1 && (
              <button
                onClick={back}
                className="border border-line px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-faded transition-colors hover:border-accent hover:text-accent"
              >
                ← Back{previousTitle ? ` to ${previousTitle}` : ""}
              </button>
            )}
            <button
              onClick={onClose}
              className="border border-line px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-faded transition-colors hover:border-accent hover:text-accent"
            >
              Close · esc
            </button>
          </div>
        </div>

        <div className="px-6 py-7">
          <p className="text-[11px] uppercase tracking-[0.18em] text-mute">
            {fmtDayLong(receipt.ts)} · {fmtTime(receipt.ts)}
          </p>
          <h3 className={`mt-3 font-display text-4xl leading-tight sm:text-5xl ${receipt.source === "spotify" ? "text-music" : "text-paper"}`}>
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
              onClick={() => navigate(session.receiptIds.find((id) => id !== receipt.id) ?? session.receiptIds[0])}
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
          <ThreadExplorer
            archive={archive}
            receipt={receipt}
            onNavigate={navigate}
          />

          {stack.length > 1 && (
            <p className="mt-4 text-[10px] uppercase tracking-[0.14em] text-mute">
              Thread depth {stack.length - 1} · you can keep following, or go back
            </p>
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
            The nearest thread link sits {threadLinks[0] ? fmtGap(receipt.ts, threadLinks[0].receipt.ts).toLowerCase() : "further than the evidence allows"}.
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
