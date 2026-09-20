/**
 * Relationship engine — deterministic, explainable links between receipts.
 *
 * Every link carries a score and a human reason. The language is strictly
 * observational: the data says "these happened 18 minutes apart", never
 * "therefore you were probably…". Evidence, not inference.
 */

import type { Archive } from "../data/dataset";
import type { LifeReceipt, ThreadLink } from "./types";

const SCORE = { temporal: 5, session: 4, recurrence: 3, location: 2, category: 2 } as const;

const MAX_SESSION = 4;
const MAX_ECHO = 2;
const MAX_TEMPORAL = 4;
const MAX_RECURRENCE = 3;
const MAX_LOCATION = 2;
const MAX_THREAD = 9;

/** Binary-search the nearest timestamps around `ts`, excluding ts itself. */
function nearestTimestamps(sorted: number[], ts: number, n: number): Array<{ ts: number; index: number }> {
  const out: Array<{ ts: number; index: number }> = [];
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < ts) lo = mid + 1;
    else hi = mid;
  }
  let a = lo - 1;
  let b = lo;
  while (out.length < n && (a >= 0 || b < sorted.length)) {
    const da = a >= 0 ? Math.abs(sorted[a] - ts) : Infinity;
    const db = b < sorted.length ? Math.abs(sorted[b] - ts) : Infinity;
    if (db <= da) {
      if (sorted[b] !== ts) out.push({ ts: sorted[b], index: b });
      b++;
    } else {
      if (sorted[a] !== ts) out.push({ ts: sorted[a], index: a });
      a--;
    }
  }
  return out;
}

function sameDayOthers(archive: Archive, r: LifeReceipt, source: LifeReceipt["source"], n: number): LifeReceipt[] {
  const day = archive.byDay.get(r.dayKey);
  if (!day) return [];
  const others = day.filter((x) => x.source === source && x.id !== r.id);
  others.sort((a, b) => Math.abs(a.ts - r.ts) - Math.abs(b.ts - r.ts));
  return others.slice(0, n);
}

function gapLabel(a: number, b: number): string {
  const d = Math.abs(a - b);
  if (d < 60) return "moments apart";
  if (d < 3600) return `${Math.round(d / 60)} min apart`;
  if (d < 86400) return `${Math.round(d / 3600)} h apart`;
  const days = Math.round(d / 86400);
  return days === 1 ? "1 day apart" : `${days} days apart`;
}

/**
 * Pull the thread: find the receipts connected to `r`, strongest first.
 * Pure function of the archive — same input always yields the same thread.
 */
export function getThread(archive: Archive, r: LifeReceipt): ThreadLink[] {
  const links: ThreadLink[] = [];
  const push = (receipt: LifeReceipt, type: keyof typeof SCORE, reason: string) => {
    if (links.length >= MAX_THREAD) return;
    if (links.some((l) => l.receipt.id === receipt.id)) return;
    links.push({ receipt, type, score: SCORE[type], reason });
  };

  if (r.source === "spotify") {
    /* 1 — the session it belongs to */
    if (r.sessionId !== undefined) {
      const session = archive.sessionById.get(r.sessionId);
      if (session) {
        const neighbors = session.receiptIds
          .filter((id) => id !== r.id)
          .map((id) => archive.byId.get(id))
          .filter((x): x is LifeReceipt => Boolean(x))
          .sort((a, b) => Math.abs(a.ts - r.ts) - Math.abs(b.ts - r.ts))
          .slice(0, MAX_SESSION);
        for (const n of neighbors) {
          push(n, "session", `same listening session · ${session.tracks} tracks, ${gapLabel(session.start, session.end)} long`);
        }
      }
    }

    /* 2 — echoes of the same track */
    const plays = archive.playsByTrack.get(r.title);
    if (plays && plays.length > 1) {
      for (const { ts, index } of nearestTimestamps(plays, r.ts, MAX_ECHO)) {
        push(
          { ...r, id: `m-${index}`, ts },
          "recurrence",
          `same track · ${gapLabel(r.ts, ts)}`,
        );
      }
    }

    /* 3 — money on the same day */
    for (const p of sameDayOthers(archive, r, "card", MAX_TEMPORAL)) {
      push(p, "temporal", `same day · ${gapLabel(r.ts, p.ts)}`);
    }
    for (const l of sameDayOthers(archive, r, "ledger", 2)) {
      push(l, "temporal", `same day · ${gapLabel(r.ts, l.ts)}`);
    }
  }

  if (r.source === "card") {
    /* 1 — music around the same moment */
    for (const m of sameDayOthers(archive, r, "spotify", MAX_TEMPORAL)) {
      push(m, "temporal", `same day · ${gapLabel(r.ts, m.ts)}`);
    }
    for (const l of sameDayOthers(archive, r, "ledger", 2)) {
      push(l, "temporal", `same day · ${gapLabel(r.ts, l.ts)}`);
    }

    /* 2 — the merchant repeats */
    const visits = archive.purchasesByMerchant.get(r.title);
    if (visits && visits.length > 1 && !r.title.startsWith("Unnamed")) {
      for (const { ts, index } of nearestTimestamps(visits, r.ts, MAX_RECURRENCE)) {
        push(
          { ...r, id: `c-${index}`, ts },
          "recurrence",
          `same merchant · visit #${index + 1} of ${visits.length}`,
        );
      }
    }

    /* 3 — same city, same month */
    if (r.city && r.city !== "") {
      const monthPrefix = r.monthKey;
      const candidates = archive.receipts.filter(
        (x) =>
          x.source === "card" &&
          x.id !== r.id &&
          x.city === r.city &&
          x.monthKey === monthPrefix,
      );
      candidates.sort((a, b) => Math.abs(a.ts - r.ts) - Math.abs(b.ts - r.ts));
      for (const c of candidates.slice(0, MAX_LOCATION)) {
        push(c, "location", `same city that month · ${c.title}`);
      }
    }
  }

  if (r.source === "ledger") {
    /* 1 — the ritual repeats */
    const occurrences = archive.ledgerBySubcategory.get(r.title);
    if (occurrences && occurrences.length > 1) {
      for (const { ts, index } of nearestTimestamps(occurrences, r.ts, 2)) {
        push(
          { ...r, id: `l-${index}`, ts },
          "recurrence",
          `same item · occurrence #${index + 1} of ${occurrences.length}`,
        );
      }
    }

    /* 2 — whatever else the day held */
    for (const m of sameDayOthers(archive, r, "spotify", 3)) {
      push(m, "temporal", `same day · ${gapLabel(r.ts, m.ts)}`);
    }
    for (const p of sameDayOthers(archive, r, "card", 3)) {
      push(p, "temporal", `same day · ${gapLabel(r.ts, p.ts)}`);
    }
  }

  return links;
}
