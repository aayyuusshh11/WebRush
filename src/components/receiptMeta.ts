import type { ConnectionStrength, LifeReceipt, ReceiptType } from "../engine/types";

/** Shared receipt presentation metadata — one vocabulary across the UI. */

export const TYPE_COLOR: Record<ReceiptType, string> = {
  music: "text-music",
  purchase: "text-purchase",
  expense: "text-expense",
  income: "text-income",
  transfer: "text-transfer",
};

export const TYPE_NAME: Record<LifeReceipt["type"], string> = {
  music: "A song",
  purchase: "A purchase",
  expense: "An expense",
  income: "Income",
  transfer: "A transfer",
};

/** Strength labels — how directly two receipts are related. */
export const STRENGTH_LABEL: Record<ConnectionStrength, string> = {
  session: "Session",
  temporal: "Temporal",
  recurring: "Recurring",
  contextual: "Contextual",
};

/** Weak relationships must not render as if they were strong ones. */
export const STRENGTH_CLASS: Record<ConnectionStrength, string> = {
  session: "text-music",
  temporal: "text-paper",
  recurring: "text-accent",
  contextual: "text-mute",
};
