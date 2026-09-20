import type { LifeReceipt } from "../engine/types";
import { TYPE_COLOR } from "./receiptMeta";
import { fmtAmount, fmtDuration, fmtTime } from "../engine/format";

interface Props {
  r: LifeReceipt;
  onOpen: (r: LifeReceipt) => void;
  selected: boolean;
}

/** One archive row: time, artifact, and the number it carries. */
export default function ReceiptRow({ r, onOpen, selected }: Props) {
  const secondary =
    r.source === "spotify"
      ? r.subtitle
      : r.source === "card"
        ? [r.city, r.state].filter(Boolean).join(", ")
        : r.subtitle;

  return (
    <li>
      <button
        onClick={() => onOpen(r)}
        aria-pressed={selected}
        className={`group grid w-full grid-cols-[74px_1fr_auto] items-baseline gap-3 border-b border-line/60 px-2 py-3 text-left transition-colors hover:bg-surface ${
          selected ? "bg-surface" : ""
        }`}
      >
        <span className="text-[10px] uppercase tracking-[0.14em] text-mute tabular-nums">
          {fmtTime(r.ts)}
        </span>
        <span className="min-w-0">
          <span className={`block truncate text-sm ${TYPE_COLOR[r.type]}`}>
            {r.title}
          </span>
          {secondary && (
            <span className="block truncate text-xs text-mute">
              {secondary}
              {r.category ? ` · ${r.category}` : ""}
            </span>
          )}
        </span>
        <span className="text-right text-[11px] tabular-nums text-mute">
          {r.source === "spotify"
            ? r.skipped
              ? "skipped"
              : fmtDuration(r.msPlayed ?? 0)
            : r.amount !== undefined
              ? `${r.type === "income" ? "+" : "−"}${fmtAmount(r.amount)}`
              : ""}
        </span>
      </button>
    </li>
  );
}
