/**
 * Shared test fixtures — small, hand-built archives for the engine tests.
 * Everything goes through the same assembleArchive path the app uses,
 * so the tests exercise the real indexing pipeline.
 */

import type { ArchiveMeta, LifeReceipt, ReceiptType, SourceId } from "../types";
import { assembleArchive, timeKeysOf } from "../../data/dataset";

/** A UTC timestamp for a given day/hour — keeps tests readable. */
export function at(year: number, month: number, day: number, hour = 0, minute = 0): number {
  return Date.UTC(year, month - 1, day, hour, minute) / 1000;
}

interface Overrides {
  id?: string;
  type?: ReceiptType;
  source?: SourceId;
  ts: number;
  title?: string;
  subtitle?: string;
  category?: string;
  subcategory?: string;
  city?: string;
  state?: string;
  amount?: number;
  msPlayed?: number;
  skipped?: boolean;
  shuffle?: boolean;
  platform?: string;
  flagged?: boolean;
}

/** Build a LifeReceipt with derived time keys filled in automatically. */
export function receipt(o: Overrides): LifeReceipt {
  const type = o.type ?? (o.source === "spotify" ? "music" : o.source === "card" ? "purchase" : "expense");
  return {
    id: o.id ?? `${o.source === "spotify" ? "m" : o.source === "card" ? "c" : "l"}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    source: o.source ?? "spotify",
    ts: o.ts,
    title: o.title ?? "Untitled",
    subtitle: o.subtitle,
    category: o.category,
    subcategory: o.subcategory,
    city: o.city,
    state: o.state,
    amount: o.amount,
    msPlayed: o.msPlayed,
    skipped: o.skipped,
    shuffle: o.shuffle,
    platform: o.platform,
    flagged: o.flagged,
    ...timeKeysOf(o.ts),
  };
}

export function music(o: Overrides & { ts: number }): LifeReceipt {
  return receipt({ source: "spotify", type: "music", ...o });
}

export function purchase(o: Overrides & { ts: number }): LifeReceipt {
  return receipt({ source: "card", type: "purchase", ...o });
}

export function ledger(o: Overrides & { ts: number; type?: ReceiptType }): LifeReceipt {
  return receipt({ source: "ledger", ...o });
}

/** Minimal ArchiveMeta for fixture archives. */
export function makeMeta(overrides: Partial<ArchiveMeta> = {}): ArchiveMeta {
  return {
    monthly: new Map(),
    musicPlays: 0,
    purchases: 0,
    ledgerEntries: 0,
    firstTs: 0,
    lastTs: 1,
    topArtistsAllTime: [],
    topArtistsByYear: {},
    nightShareByYear: {},
    ...overrides,
  };
}

export { assembleArchive };
