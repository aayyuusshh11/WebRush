/**
 * Pattern engine — turns ~49k receipts into a handful of evidence-backed
 * observations. Everything here is deterministic and computed client-side.
 */

import type { Archive } from "../data/dataset";
import type { LifeReceipt } from "./types";

export interface Ritual {
  label: string;
  count: number;
  medianAmount?: number;
  firstTs: number;
  lastTs: number;
}

export interface DayIntensity {
  dayKey: string;
  music: number;
  purchases: number;
  ledger: number;
  total: number;
}

export interface Patterns {
  /** 24 bins of music plays by hour (detail era, 2022+). */
  musicHours: number[];
  peakHour: number;
  purchaseHours: number[];
  topArtists: Array<[string, number]>;
  topTracks: Array<[string, number]>;
  topMerchants: Array<[string, number]>;
  spendByCategory: Array<{ category: string; total: number; count: number }>;
  platformBreakdown: Array<[string, number]>;
  skippedShare: number;
  shuffleShare: number;
  /** Longest run of consecutive days with at least one play (detail era). */
  streak: { length: number; startTs: number };
  biggestMusicDay?: DayIntensity;
  biggestSpendDay?: DayIntensity;
  lateNightSessions: number;
  totalSessions: number;
  longestSession?: { start: number; end: number; tracks: number; artist?: string };
  rituals: Ritual[];
  /** Days where music and purchases both happened (detail era). */
  daysWithBoth: number;
  strongestDays: DayIntensity[];
  ledgerIncomeTotal: number;
  ledgerExpenseTotal: number;
  ledgerMonthly: Array<{ monthKey: string; income: number; expense: number }>;
  topLedgerItems: Array<[string, number]>;
  totalSpend: number;
  medianPurchase: number;
}

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function topCounts(counter: Map<string, number>, n: number): Array<[string, number]> {
  return [...counter.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

export function buildPatterns(archive: Archive): Patterns {
  const music = archive.receipts.filter((r) => r.source === "spotify");
  const purchases = archive.receipts.filter((r) => r.source === "card");
  const ledger = archive.receipts.filter((r) => r.source === "ledger");

  /* ---- hour histograms ---- */
  const musicHours = new Array<number>(24).fill(0);
  const purchaseHours = new Array<number>(24).fill(0);
  for (const r of music) musicHours[r.hour]++;
  for (const r of purchases) purchaseHours[r.hour]++;
  const peakHour = musicHours.indexOf(Math.max(...musicHours));

  /* ---- what ---- */
  const artistCounter = new Map<string, number>();
  const trackCounter = new Map<string, number>();
  const platformCounter = new Map<string, number>();
  let skipped = 0;
  let shuffled = 0;
  for (const r of music) {
    if (r.subtitle) artistCounter.set(r.subtitle, (artistCounter.get(r.subtitle) ?? 0) + 1);
    trackCounter.set(r.title, (trackCounter.get(r.title) ?? 0) + 1);
    if (r.platform) platformCounter.set(r.platform, (platformCounter.get(r.platform) ?? 0) + 1);
    if (r.skipped) skipped++;
    if (r.shuffle) shuffled++;
  }
  const merchantCounter = new Map<string, number>();
  const categorySpend = new Map<string, { total: number; count: number }>();
  let totalSpend = 0;
  const purchaseAmounts: number[] = [];
  for (const r of purchases) {
    merchantCounter.set(r.title, (merchantCounter.get(r.title) ?? 0) + 1);
    if (r.category && r.amount !== undefined) {
      const c = categorySpend.get(r.category) ?? { total: 0, count: 0 };
      c.total += r.amount;
      c.count += 1;
      categorySpend.set(r.category, c);
    }
    if (r.amount !== undefined) {
      totalSpend += r.amount;
      purchaseAmounts.push(r.amount);
    }
  }

  /* ---- streak: consecutive days with ≥1 play ---- */
  const musicDays = [...new Set(music.map((r) => r.dayKey))].sort();
  let streakLength = 0;
  let streakStartTs = 0;
  let run = 0;
  let prevTs = 0;
  for (const dayKey of musicDays) {
    const ts = Date.parse(`${dayKey}T00:00:00Z`) / 1000;
    if (prevTs !== 0 && ts - prevTs === 86400) run++;
    else run = 1;
    if (run > streakLength) { streakLength = run; streakStartTs = ts - (run - 1) * 86400; }
    prevTs = ts;
  }

  /* ---- biggest days ---- */
  const dayTotals = new Map<string, DayIntensity>();
  const bump = (r: LifeReceipt, field: "music" | "purchases" | "ledger") => {
    let d = dayTotals.get(r.dayKey);
    if (!d) { d = { dayKey: r.dayKey, music: 0, purchases: 0, ledger: 0, total: 0 }; dayTotals.set(r.dayKey, d); }
    d[field] += 1;
    d.total += 1;
  };
  for (const r of music) bump(r, "music");
  for (const r of purchases) bump(r, "purchases");
  for (const r of ledger) bump(r, "ledger");
  const byMusic = [...dayTotals.values()].sort((a, b) => b.music - a.music);
  const bySpend = [...dayTotals.values()]
    .filter((d) => d.purchases > 0)
    .sort((a, b) => b.purchases - a.purchases || b.total - a.total);

  /* ---- sessions ---- */
  const sessions = archive.sessions;
  let longest: Patterns["longestSession"];
  for (const s of sessions) {
    if (!longest || s.end - s.start > longest.end - longest.start) {
      longest = { start: s.start, end: s.end, tracks: s.tracks, artist: s.dominantArtist };
    }
  }

  /* ---- rituals: recurring ledger items ---- */
  const ritualCounter = new Map<string, { count: number; amounts: number[]; first: number; last: number }>();
  for (const r of ledger) {
    if (!r.subcategory) continue;
    const e = ritualCounter.get(r.subcategory);
    if (e) {
      e.count++;
      if (r.amount !== undefined) e.amounts.push(r.amount);
      e.last = Math.max(e.last, r.ts);
    } else {
      ritualCounter.set(r.subcategory, { count: 1, amounts: r.amount !== undefined ? [r.amount] : [], first: r.ts, last: r.ts });
    }
  }
  const rituals: Ritual[] = [...ritualCounter.entries()]
    .filter(([, e]) => e.count >= 20)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(([label, e]) => ({ label, count: e.count, medianAmount: median(e.amounts), firstTs: e.first, lastTs: e.last }));

  /* ---- convergence days ---- */
  const strongestDays = [...dayTotals.values()]
    .filter((d) => d.music >= 3 && d.purchases >= 2)
    .sort((a, b) => Math.min(b.music, b.purchases * 3) - Math.min(a.music, a.purchases * 3))
    .slice(0, 3);
  let daysWithBoth = 0;
  for (const d of dayTotals.values()) if (d.music > 0 && d.purchases > 0) daysWithBoth++;

  /* ---- ledger era ---- */
  let ledgerIncomeTotal = 0;
  let ledgerExpenseTotal = 0;
  const ledgerMonthlyMap = new Map<string, { income: number; expense: number }>();
  const ledgerItemCounter = new Map<string, number>();
  for (const r of ledger) {
    const m = ledgerMonthlyMap.get(r.monthKey) ?? { income: 0, expense: 0 };
    const amt = r.amount ?? 0;
    if (r.type === "income") { m.income += amt; ledgerIncomeTotal += amt; }
    else { m.expense += amt; ledgerExpenseTotal += amt; }
    ledgerMonthlyMap.set(r.monthKey, m);
    ledgerItemCounter.set(r.title, (ledgerItemCounter.get(r.title) ?? 0) + 1);
  }
  const ledgerMonthly = [...ledgerMonthlyMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([monthKey, v]) => ({ monthKey, ...v }));

  return {
    musicHours,
    peakHour,
    purchaseHours,
    topArtists: topCounts(artistCounter, 8),
    topTracks: topCounts(trackCounter, 8),
    topMerchants: topCounts(merchantCounter, 8),
    spendByCategory: [...categorySpend.entries()]
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.total - a.total),
    platformBreakdown: topCounts(platformCounter, 6),
    skippedShare: music.length > 0 ? skipped / music.length : 0,
    shuffleShare: music.length > 0 ? shuffled / music.length : 0,
    streak: { length: streakLength, startTs: streakStartTs },
    biggestMusicDay: byMusic[0],
    biggestSpendDay: bySpend[0],
    lateNightSessions: sessions.filter((s) => s.lateNight).length,
    totalSessions: sessions.length,
    longestSession: longest,
    rituals,
    daysWithBoth,
    strongestDays,
    ledgerIncomeTotal,
    ledgerExpenseTotal,
    ledgerMonthly,
    topLedgerItems: topCounts(ledgerItemCounter, 8),
    totalSpend,
    medianPurchase: median(purchaseAmounts) ?? 0,
  };
}
