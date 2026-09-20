/**
 * Archive indexing — builds the queryable Archive from decoded receipts.
 * Pure functions, no React, no fetching.
 */

import type { ArchiveMeta, LifeReceipt, ListeningSession } from "../engine/types";

export const pad2 = (n: number) => String(n).padStart(2, "0");

/** Precomputed time keys, derived once per receipt at decode. */
export function timeKeysOf(ts: number) {
  const d = new Date(ts * 1000);
  return {
    hour: d.getUTCHours(),
    dow: d.getUTCDay(),
    dayKey: `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`,
    monthKey: `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`,
  };
}

/** The queryable archive every engine and component reads from. */
export interface Archive {
  receipts: LifeReceipt[];
  byId: Map<string, LifeReceipt>;
  byDay: Map<string, LifeReceipt[]>;
  sessions: ListeningSession[];
  sessionById: Map<number, ListeningSession>;
  /** track name → plays sorted by time (echo detection). */
  playsByTrack: Map<string, LifeReceipt[]>;
  /** merchant → purchases sorted by time (recurrence). */
  purchasesByMerchant: Map<string, LifeReceipt[]>;
  /** subcategory → ledger entries sorted by time (rituals). */
  ledgerBySubcategory: Map<string, LifeReceipt[]>;
  /** "city|monthKey" → card receipts (same-place connections). */
  cardByCityMonth: Map<string, LifeReceipt[]>;
  /** "category|monthKey" → card receipts (same-kind connections). */
  cardByCategoryMonth: Map<string, LifeReceipt[]>;
  meta: ArchiveMeta;
}

/** Listening sessions: consecutive plays ≤ 35 min apart belong together. */
export function buildSessions(music: LifeReceipt[]): ListeningSession[] {
  const GAP = 35 * 60;
  const sessions: ListeningSession[] = [];
  let current: LifeReceipt[] = [];

  const flush = () => {
    if (current.length === 0) return;
    const start = current[0].ts;
    const end = current[current.length - 1].ts;
    const artistCounts = new Map<string, number>();
    let skipped = 0;
    for (const r of current) {
      if (r.subtitle) artistCounts.set(r.subtitle, (artistCounts.get(r.subtitle) ?? 0) + 1);
      if (r.skipped) skipped++;
    }
    const dominant = [...artistCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const id = sessions.length;
    const session: ListeningSession = {
      id,
      start,
      end,
      receiptIds: current.map((r) => r.id),
      artists: [...artistCounts.keys()],
      dominantArtist: dominant,
      tracks: current.length,
      skipped,
      lateNight: new Date(start * 1000).getUTCHours() < 6,
    };
    for (const r of current) r.sessionId = id;
    sessions.push(session);
    current = [];
  };

  for (const r of music) {
    if (current.length > 0 && r.ts - current[current.length - 1].ts > GAP) flush();
    current.push(r);
  }
  flush();
  return sessions;
}

function groupTs(items: LifeReceipt[], keyOf: (r: LifeReceipt) => string): Map<string, LifeReceipt[]> {
  const map = new Map<string, LifeReceipt[]>();
  for (const r of items) {
    const k = keyOf(r);
    const arr = map.get(k);
    if (arr) arr.push(r);
    else map.set(k, [r]);
  }
  return map;
}

/**
 * Index a decoded receipt list into the shared Archive: one sort, one pass
 * over the data for every lookup the app will ever need. Pure — tests build
 * archives directly through this instead of fetching.
 */
export function assembleArchive(receipts: LifeReceipt[], meta: ArchiveMeta): Archive {
  receipts.sort((a, b) => a.ts - b.ts);

  const byId = new Map(receipts.map((r) => [r.id, r]));
  const byDay = new Map<string, LifeReceipt[]>();
  for (const r of receipts) {
    const arr = byDay.get(r.dayKey);
    if (arr) arr.push(r);
    else byDay.set(r.dayKey, [r]);
  }

  const music = receipts.filter((r) => r.source === "spotify");
  const purchases = receipts.filter((r) => r.source === "card");
  const ledgerRows = receipts.filter((r) => r.source === "ledger");
  const sessions = buildSessions(music);
  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  return {
    receipts,
    byId,
    byDay,
    sessions,
    sessionById,
    playsByTrack: groupTs(music, (r) => r.title),
    purchasesByMerchant: groupTs(purchases, (r) => r.title),
    ledgerBySubcategory: groupTs(ledgerRows, (r) => r.title),
    cardByCityMonth: groupTs(purchases, (r) => `${r.city ?? ""}|${r.monthKey}`),
    cardByCategoryMonth: groupTs(purchases, (r) => `${r.category ?? ""}|${r.monthKey}`),
    meta,
  };
}
