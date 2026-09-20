/**
 * Archive loading — the single fetch point. Decoding lives in decode.ts,
 * indexing in indexing.ts, raw shapes in raw.ts. This facade keeps the
 * public API stable for every existing importer.
 */

import type { ArchiveMeta, LifeReceipt } from "../engine/types";
import { decodeCard, decodeLedger, decodePlays } from "./decode";
import { assembleArchive, type Archive } from "./indexing";
import type { CardJson, LedgerJson, PlaysJson } from "./raw";

/* Stable public API — existing components and tests import from here. */
export type { Archive } from "./indexing";
export { assembleArchive, buildSessions, timeKeysOf, pad2 } from "./indexing";
export type { PlaysJson, CardJson, LedgerJson } from "./raw";

async function fetchJson<T>(name: string): Promise<T> {
  const res = await fetch(`data/${name}`);
  if (!res.ok) throw new Error(`Could not open ${name} (${res.status})`);
  const data: unknown = await res.json();
  if (data === null || typeof data !== "object") {
    throw new Error(`${name} is not a valid archive`);
  }
  return data as T;
}

function buildMeta(plays: PlaysJson, receipts: LifeReceipt[]): ArchiveMeta {
  const monthly = new Map<string, { music: number; purchase: number; ledger: number }>();
  const touch = (k: string) => {
    let m = monthly.get(k);
    if (!m) { m = { music: 0, purchase: 0, ledger: 0 }; monthly.set(k, m); }
    return m;
  };
  for (const [k, n] of Object.entries(plays.monthly ?? {})) touch(k).music += n;
  for (const r of receipts) {
    const m = touch(r.monthKey);
    if (r.source === "card") m.purchase += 1;
    else if (r.source === "ledger") m.ledger += 1;
  }
  // Loop instead of Math.min(...tsArr) — ~50k spread args can overflow the stack.
  let firstTs = Number.POSITIVE_INFINITY;
  let lastTs = Number.NEGATIVE_INFINITY;
  for (const r of receipts) {
    if (r.ts < firstTs) firstTs = r.ts;
    if (r.ts > lastTs) lastTs = r.ts;
  }
  return {
    monthly,
    musicPlays: Object.values(plays.monthly ?? {}).reduce((a, b) => a + b, 0),
    purchases: receipts.reduce((a, r) => a + (r.source === "card" ? 1 : 0), 0),
    ledgerEntries: receipts.reduce((a, r) => a + (r.source === "ledger" ? 1 : 0), 0),
    firstTs,
    lastTs,
    topArtistsAllTime: plays.topArtistsAllTime,
    topArtistsByYear: plays.topArtistsByYear,
    nightShareByYear: plays.nightShareByYear,
  };
}

let archivePromise: Promise<Archive> | null = null;

/** Load once per app lifetime; later calls share the same archive. */
export function loadArchive(): Promise<Archive> {
  if (archivePromise) return archivePromise;
  archivePromise = (async () => {
    const [plays, card, ledger] = await Promise.all([
      fetchJson<PlaysJson>("plays.json"),
      fetchJson<CardJson>("card.json"),
      fetchJson<LedgerJson>("ledger.json"),
    ]);

    const receipts: LifeReceipt[] = [];
    decodePlays(plays, receipts);
    decodeCard(card, receipts);
    decodeLedger(ledger, receipts);

    return assembleArchive(receipts, buildMeta(plays, receipts));
  })();

  return archivePromise;
}
