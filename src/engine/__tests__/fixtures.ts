/**
 * Shared test fixtures — small, hand-built archives for the engine tests.
 * Everything goes through the same assembleArchive path the app uses,
 * so the tests exercise the real indexing pipeline.
 */

import type { ArchiveMeta, LifeReceipt, ReceiptType, SourceId } from "../types";
import { assembleArchive, timeKeysOf } from "../../data/dataset";
import type { Archive } from "../../data/dataset";

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

/**
 * An archive engineered to clear every discovery gate: a late-night
 * overlap day, a track on 6 distinct days, a 21× ledger item, a merchant
 * with 5 visits, and a 50-minute after-midnight session.
 */
export function discoveryArchive(): Archive {
  const receipts: LifeReceipt[] = [];

  const overlapDay = at(2023, 6, 12, 1);
  receipts.push(
    music({ id: "m-o1", ts: overlapDay, title: "Night Song", subtitle: "Artist A" }),
    music({ id: "m-o2", ts: overlapDay + 600, title: "Night Song 2", subtitle: "Artist A" }),
    music({ id: "m-o3", ts: overlapDay + 1200, title: "Night Song 3", subtitle: "Artist B" }),
    music({ id: "m-o4", ts: overlapDay + 1800, title: "Night Song", subtitle: "Artist A" }),
    purchase({ id: "c-o1", ts: overlapDay + 2400, title: "Swiggy", category: "food_dining", city: "Mumbai", amount: 300 }),
    purchase({ id: "c-o2", ts: overlapDay + 3000, title: "Swiggy", category: "food_dining", city: "Mumbai", amount: 250 }),
  );

  for (let d = 0; d < 6; d++) {
    receipts.push(music({ id: `m-t${d}`, ts: at(2023, 5, 1 + d * 2, 9), title: "Echo Track", subtitle: "Artist A" }));
  }

  for (let i = 0; i < 21; i++) {
    receipts.push(
      ledger({ id: `l-m${i}`, ts: at(2016, 1, 1 + (i % 28), 8), title: "Milk", subcategory: "milk", amount: 30 }),
    );
  }

  for (let d = 0; d < 3; d++) {
    receipts.push(
      purchase({ id: `c-s${d}`, ts: at(2023, 7, 1 + d * 3, 13), title: "Swiggy", category: "food_dining", city: "Mumbai", amount: 200 }),
    );
  }

  const night = at(2022, 3, 4, 1);
  receipts.push(
    music({ id: "m-n1", ts: night, title: "Deep Track", subtitle: "Artist C" }),
    music({ id: "m-n2", ts: night + 25 * 60, title: "Deep Track 2", subtitle: "Artist C" }),
    music({ id: "m-n3", ts: night + 50 * 60, title: "Deep Track 3", subtitle: "Artist C" }),
  );

  return assembleArchive(receipts, makeMeta());
}

export { assembleArchive };
