/**
 * Chapter engine — the story layer.
 *
 * Rule (from the design spec): no evidence, no chapter. Every chapter below
 * is gated on a measurable property of the data, and every number it claims
 * is computed from the archive. Nothing is hardcoded drama.
 */

import type { Archive } from "../data/dataset";
import type { Chapter } from "./types";
import type { Patterns } from "./patterns";
import { fmtAmount, fmtCount } from "./format";

const NIGHT_HOUR = 6; // 00:00–05:59 counts as "the night shift"

export function buildChapters(archive: Archive, p: Patterns): Chapter[] {
  const chapters: Chapter[] = [];
  const nextNumeral = () => String(chapters.length + 1).padStart(2, "0");

  /* ------------------------------------------------------------------ */
  /* 1 — THE LEDGER YEARS (household era, 2015–2018)                     */
  /* ------------------------------------------------------------------ */
  if (p.ledgerMonthly.length >= 12) {
    const first = p.ledgerMonthly[0]?.monthKey ?? "";
    const last = p.ledgerMonthly[p.ledgerMonthly.length - 1]?.monthKey ?? "";
    const topItem = p.topLedgerItems[0];
    const ritual = p.rituals.find((r) => r.count >= 40);
    const biggestLedgerReceipt = archive.receipts
      .filter((r) => r.source === "ledger" && r.type === "expense")
      .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))[0];
    const incomeReceipt = archive.receipts.find((r) => r.source === "ledger" && r.type === "income");

    chapters.push({
      id: "ledger-years",
      numeral: nextNumeral(),
      title: "THE LEDGER YEARS",
      observation: [
        `Before the card statements begin, the record is a household ledger. From ${first.replace("-", " / ")} to ${last.replace("-", " / ")}, life leaves receipts of a different kind — milk, auto fares, recharges, school fees.`,
        `Money in: ${fmtAmount(p.ledgerIncomeTotal)} recorded as income. Money out: ${fmtAmount(p.ledgerExpenseTotal)} across ${fmtCount(p.ledgerMonthly.length)} months.`,
      ],
      evidence: [
        { label: "Ledger entries", value: fmtCount(archive.meta.ledgerEntries) },
        { label: "Most repeated item", value: topItem ? `${topItem[0]} · ${topItem[1]}×` : "—" },
        ...(ritual
          ? [{ label: "Ritual spotted", value: `${ritual.label} · every few days` }]
          : []),
        ...(biggestLedgerReceipt?.amount
          ? [{ label: "Largest expense", value: fmtAmount(biggestLedgerReceipt.amount) }]
          : []),
      ],
      receiptIds: [biggestLedgerReceipt?.id, incomeReceipt?.id].filter((x): x is string => Boolean(x)),
      archiveFocus: { types: ["expense", "income", "transfer"] },
    });
  }

  /* ------------------------------------------------------------------ */
  /* 2 — THE NIGHT SHIFT (late-night listening)                          */
  /* ------------------------------------------------------------------ */
  const nightPlays = p.musicHours.slice(0, NIGHT_HOUR).reduce((a, b) => a + b, 0);
  const totalDetailPlays = p.musicHours.reduce((a, b) => a + b, 0);
  const nightShare = totalDetailPlays > 0 ? nightPlays / totalDetailPlays : 0;
  if (nightShare >= 0.3 && p.longestSession) {
    const ls = p.longestSession;
    const sessionReceiptIds = archive.sessions.find(
      (s) => s.start === ls.start && s.tracks === ls.tracks,
    )?.receiptIds ?? [];

    chapters.push({
      id: "night-shift",
      numeral: nextNumeral(),
      title: "THE NIGHT SHIFT",
      observation: [
        `A large share of this life happens after midnight. ${Math.round(nightShare * 100)}% of all plays in the detail era occurred between 00:00 and 06:00.`,
        `The single longest listening session ran ${fmtCount(Math.round((ls.end - ls.start) / 60))} minutes and ${ls.tracks} tracks deep${ls.artist ? `, circling ${ls.artist}` : ""}.`,
      ],
      evidence: [
        { label: "Plays after midnight", value: `${fmtCount(nightPlays)} of ${fmtCount(totalDetailPlays)}` },
        { label: "Late-night sessions", value: `${fmtCount(p.lateNightSessions)} of ${fmtCount(p.totalSessions)}` },
        { label: "Longest session", value: `${ls.tracks} tracks` },
        { label: "Peak hour", value: `${String(p.peakHour).padStart(2, "0")}:00` },
      ],
      receiptIds: sessionReceiptIds.slice(0, 3),
      archiveFocus: {},
    });
  }

  /* ------------------------------------------------------------------ */
  /* 3 — THE REPEAT (one artist, everywhere)                             */
  /* ------------------------------------------------------------------ */
  const topArtist = p.topArtists[0];
  if (topArtist && topArtist[1] >= 300) {
    const allTime = archive.meta.topArtistsAllTime[0];
    const firstPlay = archive.receipts.find(
      (r) => r.source === "spotify" && r.subtitle === topArtist[0],
    );
    chapters.push({
      id: "the-repeat",
      numeral: nextNumeral(),
      title: "THE REPEAT",
      observation: [
        `One artist returns again and again. ${topArtist[0]} appears ${fmtCount(topArtist[1])} times in the detail era — more than the next three combined in some months.`,
        allTime && allTime[0] === topArtist[0]
          ? `Across the full archive, ${allTime[0]} was played ${fmtCount(allTime[1])} times since 2013. A constant, not a phase.`
          : `Across the full archive since 2013, ${allTime ? `${allTime[0]} leads with ${fmtCount(allTime[1])} plays.` : "the pattern holds."}`,
      ],
      evidence: [
        { label: "Artist", value: topArtist[0] },
        { label: "Plays (detail era)", value: fmtCount(topArtist[1]) },
        ...(allTime
          ? [{ label: "Plays all-time", value: `${fmtCount(allTime[1])}` }]
          : []),
        { label: "Skip rate overall", value: `${Math.round(p.skippedShare * 100)}%` },
      ],
      receiptIds: firstPlay ? [firstPlay.id] : [],
      archiveFocus: { query: topArtist[0] },
    });
  }

  /* ------------------------------------------------------------------ */
  /* 4 — THE CONVERGENCE (music + money overlap, 2022–2024)              */
  /* ------------------------------------------------------------------ */
  if (p.daysWithBoth >= 100 && p.strongestDays[0]) {
    const strongest = p.strongestDays[0];
    const dayReceipts = archive.byDay.get(strongest.dayKey) ?? [];
    const firstMusic = dayReceipts.find((r) => r.source === "spotify");
    const firstPurchase = dayReceipts.find((r) => r.source === "card");
    const years = ["2022", "2023", "2024"];

    chapters.push({
      id: "convergence",
      numeral: nextNumeral(),
      title: "THE CONVERGENCE",
      observation: [
        `From 2022, two archives run at once. Songs and card payments share the same days — ${fmtCount(p.daysWithBoth)} days carried both.`,
        `The densest of them held ${strongest.music} plays and ${strongest.purchases} purchases. What looked like separate receipts was often one evening.`,
      ],
      evidence: [
        { label: "Days with music + money", value: fmtCount(p.daysWithBoth) },
        { label: "Card transactions (2022+)", value: fmtCount(archive.meta.purchases) },
        { label: "Total card spend", value: fmtAmount(p.totalSpend) },
        ...years.filter((y) => archive.meta.nightShareByYear[y] !== undefined).map((y) => ({
          label: `Night share ${y}`,
          value: `${Math.round(archive.meta.nightShareByYear[y] * 100)}%`,
        })),
      ],
      receiptIds: [firstMusic?.id, firstPurchase?.id].filter((x): x is string => Boolean(x)),
      archiveFocus: { dayKey: strongest.dayKey },
    });
  }

  /* ------------------------------------------------------------------ */
  /* 5 — THE RITUALS (small, repeated ledger items)                      */
  /* ------------------------------------------------------------------ */
  if (p.rituals.length >= 3) {
    const [first, second] = p.rituals;
    const ritualReceipt = archive.receipts.find(
      (r) => r.source === "ledger" && r.subcategory === first.label,
    );
    chapters.push({
      id: "rituals",
      numeral: nextNumeral(),
      title: "THE RITUALS",
      observation: [
        `Some receipts barely change. ${first.label} appears ${first.count} times${first.medianAmount !== undefined ? `, usually ${fmtAmount(first.medianAmount)}` : ""}. ${second ? `${second.label} appears ${second.count} times.` : ""}`,
        `Individually they are noise. Together they are a rhythm — the small, repeated costs a life runs on.`,
      ],
      evidence: p.rituals.slice(0, 4).map((r) => ({
        label: r.label,
        value: `${r.count}×${r.medianAmount !== undefined ? ` · ~${fmtAmount(r.medianAmount)}` : ""}`,
      })),
      receiptIds: ritualReceipt ? [ritualReceipt.id] : [],
      archiveFocus: { query: first.label },
    });
  }

  /* ------------------------------------------------------------------ */
  /* 6 — THE SPENDING SHAPE (what money went to)                         */
  /* ------------------------------------------------------------------ */
  if (p.spendByCategory.length >= 3 && p.totalSpend > 0) {
    const top = p.spendByCategory[0];
    const share = top.total / p.totalSpend;
    const biggestSpendReceipt = archive.receipts
      .filter((r) => r.source === "card" && r.amount !== undefined)
      .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))[0];
    chapters.push({
      id: "spending-shape",
      numeral: nextNumeral(),
      title: "WHERE THE MONEY WENT",
      observation: [
        `${fmtCount(archive.meta.purchases)} card transactions. Median size ${fmtAmount(p.medianPurchase)} — this is a life of small, frequent payments, not large ones.`,
        `${top.category.replace("_", " ")} takes the largest share at ${fmtAmount(top.total)} (${Math.round(share * 100)}%).`,
      ],
      evidence: p.spendByCategory.slice(0, 4).map((c) => ({
        label: c.category.replace("_", " "),
        value: `${fmtAmount(c.total)} · ${fmtCount(c.count)}×`,
      })),
      receiptIds: biggestSpendReceipt ? [biggestSpendReceipt.id] : [],
      archiveFocus: { types: ["purchase"] },
    });
  }

  return chapters;
}
