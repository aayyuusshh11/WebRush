/**
 * Discovery engine — the "things you might have missed" layer.
 *
 * Every discovery is generated from the archive when the evidence clears a
 * threshold, and every number it claims is computed from the data. Nothing is
 * hardcoded drama; if the evidence does not exist, the discovery does not.
 */

import type { Archive } from "../data/dataset";
import type { Discovery } from "./types";
import type { Patterns } from "./patterns";
import { fmtAmount, fmtCount, fmtDate } from "./format";

export function buildDiscoveries(archive: Archive, p: Patterns): Discovery[] {
  const out: Discovery[] = [];
  const numeral = () => String(out.length + 1).padStart(2, "0");

  /* ------------------------------------------------------------------ */
  /* 1 — THE LATE-NIGHT OVERLAP                                          */
  /* The densest day where at least one play AND one payment both fell   */
  /* after midnight. Computed by walking the by-day index once.          */
  /* ------------------------------------------------------------------ */
  let overlap: { dayKey: string; music: number; purchases: number; firstMusicId?: string; firstPurchaseId?: string } | null = null;
  for (const [dayKey, day] of archive.byDay) {
    const music = day.filter((r) => r.source === "spotify");
    const purchases = day.filter((r) => r.source === "card");
    if (music.length < 3 || purchases.length < 1) continue;
    if (!music.some((r) => r.hour < 6) || !purchases.some((r) => r.hour < 6)) continue;
    if (!overlap || music.length > overlap.music) {
      overlap = {
        dayKey,
        music: music.length,
        purchases: purchases.length,
        firstMusicId: music[0]?.id,
        firstPurchaseId: purchases[0]?.id,
      };
    }
  }
  if (overlap) {
    out.push({
      id: "late-night-overlap",
      numeral: numeral(),
      title: "THE LATE-NIGHT OVERLAP",
      lead: `On ${fmtDate(Date.parse(`${overlap.dayKey}T00:00:00Z`) / 1000)}, ${fmtCount(overlap.music)} plays and ${fmtCount(overlap.purchases)} card payments share the same date — at least one of each after midnight.`,
      evidence: [
        { label: "Plays that day", value: fmtCount(overlap.music) },
        { label: "Purchases that day", value: fmtCount(overlap.purchases) },
        { label: "Window", value: "00:00 – 05:59 local clock" },
        { label: "Days like this", value: `${fmtCount(p.daysWithBoth)} carry music + money` },
      ],
      receiptIds: [overlap.firstMusicId, overlap.firstPurchaseId].filter((x): x is string => Boolean(x)),
      archiveFocus: { dayKey: overlap.dayKey },
    });
  }

  /* ------------------------------------------------------------------ */
  /* 2 — THE REPEATING TRACK                                             */
  /* The track played across the most distinct days.                     */
  /* ------------------------------------------------------------------ */
  let track: { title: string; plays: number; days: number; firstId?: string; lastTs?: number } | null = null;
  for (const [title, plays] of archive.playsByTrack) {
    const days = new Set(plays.map((r) => r.dayKey)).size;
    if (!track || days > track.days || (days === track.days && plays.length > track.plays)) {
      track = { title, plays: plays.length, days, firstId: plays[0]?.id, lastTs: plays[plays.length - 1]?.ts };
    }
  }
  if (track && track.days >= 5) {
    out.push({
      id: "repeating-track",
      numeral: numeral(),
      title: "THE REPEATING TRACK",
      lead: `"${track.title}" was played ${fmtCount(track.plays)} times across ${fmtCount(track.days)} different days.`,
      evidence: [
        { label: "Track", value: track.title },
        { label: "Total plays", value: fmtCount(track.plays) },
        { label: "Distinct days", value: fmtCount(track.days) },
        ...(track.lastTs !== undefined ? [{ label: "Last played", value: fmtDate(track.lastTs) }] : []),
      ],
      receiptIds: track.firstId ? [track.firstId] : [],
      archiveFocus: { query: track.title },
    });
  }

  /* ------------------------------------------------------------------ */
  /* 3 — THE REPEATING PURCHASE                                          */
  /* The ledger item with the highest repeat count (the pattern engine   */
  /* has already gated rituals at 20+ occurrences).                      */
  /* ------------------------------------------------------------------ */
  const ritual = p.rituals[0];
  if (ritual) {
    const receipt = archive.receipts.find(
      (r) => r.source === "ledger" && r.subcategory === ritual.label,
    );
    out.push({
      id: "repeating-purchase",
      numeral: numeral(),
      title: "THE REPEATING PURCHASE",
      lead: `"${ritual.label}" appears ${fmtCount(ritual.count)} times in the ledger${ritual.medianAmount !== undefined ? `, usually ${fmtAmount(ritual.medianAmount)}` : ""}.`,
      evidence: [
        { label: "Item", value: ritual.label },
        { label: "Occurrences", value: `${fmtCount(ritual.count)}×` },
        ...(ritual.medianAmount !== undefined ? [{ label: "Typical amount", value: fmtAmount(ritual.medianAmount) }] : []),
        { label: "First recorded", value: fmtDate(ritual.firstTs) },
        { label: "Last recorded", value: fmtDate(ritual.lastTs) },
      ],
      receiptIds: receipt ? [receipt.id] : [],
      archiveFocus: { query: ritual.label },
    });
  }

  /* ------------------------------------------------------------------ */
  /* 4 — THE REPEATING MERCHANT                                          */
  /* ------------------------------------------------------------------ */
  const [merchant, visits] = p.topMerchants[0] ?? [null, 0];
  if (merchant && visits >= 5) {
    const group = archive.purchasesByMerchant.get(merchant);
    const days = group ? new Set(group.map((r) => r.dayKey)).size : 0;
    const receipt = group?.[0];
    out.push({
      id: "repeating-merchant",
      numeral: numeral(),
      title: "THE REPEATING MERCHANT",
      lead: `"${merchant}" appears ${fmtCount(visits)} times on the card statement, across ${fmtCount(days)} distinct days.`,
      evidence: [
        { label: "Merchant", value: merchant },
        { label: "Transactions", value: fmtCount(visits) },
        { label: "Distinct days", value: fmtCount(days) },
        ...(receipt ? [{ label: "First visit", value: fmtDate(receipt.ts) }] : []),
      ],
      receiptIds: receipt ? [receipt.id] : [],
      archiveFocus: { query: merchant },
    });
  }

  /* ------------------------------------------------------------------ */
  /* 5 — THE LONGEST NIGHT                                               */
  /* The longest listening session that began after midnight.            */
  /* ------------------------------------------------------------------ */
  let longestNight: (typeof archive.sessions)[number] | null = null;
  for (const s of archive.sessions) {
    if (!s.lateNight || s.end - s.start < 45 * 60) continue;
    if (!longestNight || s.end - s.start > longestNight.end - longestNight.start) longestNight = s;
  }
  if (longestNight) {
    out.push({
      id: "longest-night",
      numeral: numeral(),
      title: "THE LONGEST NIGHT",
      lead: `The longest listening session on record began after midnight and ran ${fmtCount(Math.round((longestNight.end - longestNight.start) / 60))} minutes, ${fmtCount(longestNight.tracks)} tracks deep.`,
      evidence: [
        { label: "Duration", value: `${fmtCount(Math.round((longestNight.end - longestNight.start) / 60))} min` },
        { label: "Tracks", value: fmtCount(longestNight.tracks) },
        { label: "Artists", value: fmtCount(longestNight.artists.length) },
        ...(longestNight.dominantArtist ? [{ label: "Most-played artist in it", value: longestNight.dominantArtist }] : []),
      ],
      receiptIds: [longestNight.receiptIds[0]].filter(Boolean),
      archiveFocus: {},
    });
  }

  return out;
}
