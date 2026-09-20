/**
 * Decoding — raw prepared JSON rows become LifeReceipts.
 * Defensive: malformed prepared data must degrade to fewer receipts,
 * never crash the app. Valid data is unaffected.
 */

import type { LifeReceipt, ReceiptType } from "../engine/types";
import { timeKeysOf } from "./indexing";
import type { CardJson, LedgerJson, PlaysJson } from "./raw";

/** Dictionary lookup that cannot throw when a dictionary is missing. */
function dict(list: string[] | undefined, i: number): string {
  return Array.isArray(list) ? (list[i] ?? "") : "";
}

/** Accept only rows of the expected shape with a finite leading timestamp. */
function numericRow(row: unknown, width: number): number[] | null {
  return Array.isArray(row) && row.length >= width && Number.isFinite(row[0])
    ? (row as number[])
    : null;
}

function displayMerchant(raw: string): string {
  if (!raw) return "Unnamed merchant";
  return raw;
}

function displayCategory(raw: string): string {
  if (!raw) return "uncategorized";
  return raw.replace(/_/g, " ");
}

export function decodePlays(json: PlaysJson, out: LifeReceipt[]): void {
  const rows = Array.isArray(json.rows) ? json.rows : [];
  for (let i = 0; i < rows.length; i++) {
    const row = numericRow(rows[i], 7);
    if (!row) continue;
    const [ts, a, t, al, ms6, flags, p] = row;
    const track = dict(json.tracks, t);
    if (!track) continue; // dictionary miss — skip rather than render a blank receipt
    const receipt: LifeReceipt = {
      id: `m-${i}`,
      type: "music",
      source: "spotify",
      ts,
      title: track,
      subtitle: dict(json.artists, a) || undefined,
      album: dict(json.albums, al) || undefined,
      msPlayed: (Number(ms6) || 0) << 6,
      skipped: (Number(flags) & 1) === 1,
      shuffle: (Number(flags) & 2) === 2,
      platform: dict(json.platforms, p) || undefined,
      ...timeKeysOf(ts),
    };
    out.push(receipt);
  }
}

export function decodeCard(json: CardJson, out: LifeReceipt[]): void {
  const rows = Array.isArray(json.rows) ? json.rows : [];
  for (let i = 0; i < rows.length; i++) {
    const row = numericRow(rows[i], 7);
    if (!row) continue;
    const [ts, m, c, amtPaise, city, state, flagged] = row;
    const receipt: LifeReceipt = {
      id: `c-${i}`,
      type: "purchase",
      source: "card",
      ts,
      title: displayMerchant(dict(json.merchants, m)),
      subtitle: [dict(json.cities, city), dict(json.states, state)].filter(Boolean).join(", ") || undefined,
      category: displayCategory(dict(json.categories, c)),
      city: dict(json.cities, city) || undefined,
      state: dict(json.states, state) || undefined,
      amount: (Number(amtPaise) || 0) / 100,
      flagged: flagged === 1,
      ...timeKeysOf(ts),
    };
    out.push(receipt);
  }
}

export function decodeLedger(json: LedgerJson, out: LifeReceipt[]): void {
  const rows = Array.isArray(json.rows) ? json.rows : [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row) || row.length < 7 || !Number.isFinite(row[0])) continue;
    const [ts, mode, cat, sub, note, amtPaise, kind] = row as [number, number, number, number, string, number, number];
    const kindRaw = dict(json.kinds, kind) || "expense";
    const type: ReceiptType = kindRaw.startsWith("income")
      ? "income"
      : kindRaw.startsWith("transfer")
        ? "transfer"
        : "expense";
    const subcategory = dict(json.subcategories, sub) || undefined;
    const receipt: LifeReceipt = {
      id: `l-${i}`,
      type,
      source: "ledger",
      ts,
      title: subcategory ?? displayCategory(dict(json.categories, cat)),
      subtitle: typeof note === "string" && note ? note : undefined,
      category: displayCategory(dict(json.categories, cat)),
      subcategory,
      amount: (Number(amtPaise) || 0) / 100,
      platform: dict(json.modes, mode) || undefined,
      ...timeKeysOf(ts),
    };
    out.push(receipt);
  }
}
