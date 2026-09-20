/**
 * Relationship engine — deterministic, explainable links between receipts.
 *
 * Every link carries a strength class, a 0–1000 score, and a human reason.
 * The language is strictly observational: the data says "these happened 18
 * minutes apart", never "therefore you were probably…". Evidence, not
 * inference.
 *
 * Ranking hierarchy (documented tie-breaking, per the spec):
 *   1. same listening session + close temporal proximity   → session    (500)
 *   2. same day + close temporal proximity                 → temporal   (400)
 *   3. same exact entity (track / merchant / item)         → recurring  (300)
 *   5. same location + close temporal proximity            → contextual (200)
 *   6. same category + close temporal proximity            → contextual (100)
 *
 * Within a class, closer-in-time ranks higher. Final order is deterministic:
 * score desc → time gap asc → receipt id asc. A "contextual" link can never
 * outrank a "session" link, and the UI labels the difference.
 */

import type { Archive } from "../data/dataset";
import type { ConnectionStrength, ConnectionType, LifeReceipt, ThreadLink } from "./types";

const BASE_SCORE: Record<ConnectionType, number> = {
  session: 500,
  temporal: 400,
  recurrence: 300,
  location: 200,
  category: 100,
};

const STRENGTH_OF: Record<ConnectionType, ConnectionStrength> = {
  session: "session",
  temporal: "temporal",
  recurrence: "recurring",
  location: "contextual",
  category: "contextual",
};

/** Penalize distance so that "18 min apart" ranks above "23 h apart" in-class. */
function proximityPenalty(type: ConnectionType, gap: number): number {
  const minutes = gap / 60;
  const days = gap / 86400;
  switch (type) {
    case "session":
      return Math.min(99, Math.round(minutes));
    case "temporal":
      return Math.min(99, Math.floor(minutes / 15)); // saturates at ~24 h
    case "recurrence":
      return Math.min(99, Math.floor(days / 2));
    case "location":
    case "category":
      return Math.min(99, Math.floor(days));
  }
}

const MAX_SESSION = 4;
const MAX_ECHO = 2;
const MAX_TEMPORAL = 4;
const MAX_RECURRENCE = 3;
const MAX_LOCATION = 2;
const MAX_CATEGORY = 2;
const MAX_THREAD = 9;

/** Binary-search the nearest receipts by timestamp, excluding `ref` itself. */
function nearestReceipts(
  sorted: readonly LifeReceipt[],
  ref: LifeReceipt,
  n: number,
): LifeReceipt[] {
  const out: LifeReceipt[] = [];
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid].ts < ref.ts) lo = mid + 1;
    else hi = mid;
  }
  let a = lo - 1;
  let b = lo;
  while (out.length < n && (a >= 0 || b < sorted.length)) {
    const da = a >= 0 ? Math.abs(sorted[a].ts - ref.ts) : Infinity;
    const db = b < sorted.length ? Math.abs(sorted[b].ts - ref.ts) : Infinity;
    if (db <= da) {
      if (sorted[b].id !== ref.id) out.push(sorted[b]);
      b++;
    } else {
      if (sorted[a].id !== ref.id) out.push(sorted[a]);
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

interface Candidate {
  receipt: LifeReceipt;
  type: ConnectionType;
  reason: string;
  gap: number;
}

/**
 * Pull the thread: find the receipts connected to `r`, strongest first.
 * Pure function of the archive — same input always yields the same thread.
 */
export function getThread(archive: Archive, r: LifeReceipt): ThreadLink[] {
  const candidates: Candidate[] = [];
  const add = (receipt: LifeReceipt, type: ConnectionType, reason: string) => {
    if (receipt.id === r.id) return;
    candidates.push({ receipt, type, reason, gap: Math.abs(receipt.ts - r.ts) });
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
          add(n, "session", `same listening session · ${session.tracks} tracks, ${gapLabel(session.start, session.end)} long`);
        }
      }
    }

    /* 2 — echoes of the same track */
    const plays = archive.playsByTrack.get(r.title);
    if (plays && plays.length > 1) {
      for (const other of nearestReceipts(plays, r, MAX_ECHO)) {
        add(other, "recurrence", `same track · ${gapLabel(r.ts, other.ts)}`);
      }
    }

    /* 3 — money on the same day */
    for (const p of sameDayOthers(archive, r, "card", MAX_TEMPORAL)) {
      add(p, "temporal", `same day · ${gapLabel(r.ts, p.ts)}`);
    }
    for (const l of sameDayOthers(archive, r, "ledger", 2)) {
      add(l, "temporal", `same day · ${gapLabel(r.ts, l.ts)}`);
    }
  }

  if (r.source === "card") {
    /* 1 — music around the same moment */
    for (const m of sameDayOthers(archive, r, "spotify", MAX_TEMPORAL)) {
      add(m, "temporal", `same day · ${gapLabel(r.ts, m.ts)}`);
    }
    for (const l of sameDayOthers(archive, r, "ledger", 2)) {
      add(l, "temporal", `same day · ${gapLabel(r.ts, l.ts)}`);
    }

    /* 2 — the merchant repeats */
    const visits = archive.purchasesByMerchant.get(r.title);
    if (visits && visits.length > 1 && !r.title.startsWith("Unnamed")) {
      for (const other of nearestReceipts(visits, r, MAX_RECURRENCE)) {
        add(
          other,
          "recurrence",
          `same merchant · visit #${visits.indexOf(other) + 1} of ${visits.length}`,
        );
      }
    }

    /* 3 — same city, same month (contextual, labeled as such) */
    if (r.city) {
      const sameCityMonth = (archive.cardByCityMonth.get(`${r.city}|${r.monthKey}`) ?? [])
        .filter((x) => x.id !== r.id);
      for (const c of nearestReceipts(sameCityMonth, r, MAX_LOCATION)) {
        add(c, "location", `same city that month · ${c.title}`);
      }
    }

    /* 4 — the same kind of purchase, that month (contextual) */
    if (r.category) {
      const sameKindMonth = (archive.cardByCategoryMonth.get(`${r.category}|${r.monthKey}`) ?? [])
        .filter((x) => x.id !== r.id && x.title !== r.title);
      for (const c of nearestReceipts(sameKindMonth, r, MAX_CATEGORY)) {
        add(c, "category", `same kind of purchase · ${r.category}, that month`);
      }
    }
  }

  if (r.source === "ledger") {
    /* 1 — the ritual repeats */
    const occurrences = archive.ledgerBySubcategory.get(r.title);
    if (occurrences && occurrences.length > 1) {
      for (const other of nearestReceipts(occurrences, r, 2)) {
        add(
          other,
          "recurrence",
          `same item · occurrence #${occurrences.indexOf(other) + 1} of ${occurrences.length}`,
        );
      }
    }

    /* 2 — whatever else the day held */
    for (const m of sameDayOthers(archive, r, "spotify", 3)) {
      add(m, "temporal", `same day · ${gapLabel(r.ts, m.ts)}`);
    }
    for (const p of sameDayOthers(archive, r, "card", 3)) {
      add(p, "temporal", `same day · ${gapLabel(r.ts, p.ts)}`);
    }
  }

  /* Rank deterministically: score desc → gap asc → id asc, then dedupe. */
  const ranked = candidates
    .map((c) => ({ ...c, score: BASE_SCORE[c.type] - proximityPenalty(c.type, c.gap) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.gap - b.gap ||
        a.receipt.id.localeCompare(b.receipt.id),
    );

  const links: ThreadLink[] = [];
  const seen = new Set<string>();
  for (const c of ranked) {
    if (seen.has(c.receipt.id)) continue;
    seen.add(c.receipt.id);
    links.push({
      receipt: c.receipt,
      type: c.type,
      strength: STRENGTH_OF[c.type],
      score: c.score,
      reason: c.reason,
    });
    if (links.length >= MAX_THREAD) break;
  }
  return links;
}
