/**
 * Archive loader — the single place raw prepared JSON becomes LifeReceipts.
 * Everything is decoded, sorted and indexed exactly once, then shared.
 */

import type { ArchiveMeta, LifeReceipt, ListeningSession } from "../engine/types";

/* ---------- raw shapes (see scripts/prepare-data.mjs for schemas) ---------- */

export interface PlaysJson {
  artists: string[];
  tracks: string[];
  albums: string[];
  platforms: string[];
  monthly: Record<string, number>;
  topArtistsAllTime: Array<[string, number]>;
  topArtistsByYear: Record<string, Array<[string, number]>>;
  nightShareByYear: Record<string, number>;
  rows: Array<[number, number, number, number, number, number, number]>;
}

export interface CardJson {
  merchants: string[];
  categories: string[];
  cities: string[];
  states: string[];
  rows: Array<[number, number, number, number, number, number, number]>;
}

export interface LedgerJson {
  modes: string[];
  categories: string[];
  subcategories: string[];
  kinds: string[];
  rows: Array<[number, number, number, number, string, number, number]>;
}

/* ---------- derived archive ---------- */

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

export const pad2 = (n: number) => String(n).padStart(2, "0");

/* -------------------------------------------------------------------------- */
/* Defensive parsing helpers — malformed prepared data must degrade to fewer  */
/* receipts, never crash the app. Valid data is unaffected.                    */
/* -------------------------------------------------------------------------- */

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

function displayMerchant(raw: string): string {
  if (!raw) return "Unnamed merchant";
  return raw;
}

function displayCategory(raw: string): string {
  if (!raw) return "uncategorized";
  return raw.replace(/_/g, " ");
}

async function fetchJson<T>(name: string): Promise<T> {
  const res = await fetch(`data/${name}`);
  if (!res.ok) throw new Error(`Could not open ${name} (${res.status})`);
  const data: unknown = await res.json();
  if (data === null || typeof data !== "object") {
    throw new Error(`${name} is not a valid archive`);
  }
  return data as T;
}

function decodePlays(json: PlaysJson, out: LifeReceipt[]): void {
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

function decodeCard(json: CardJson, out: LifeReceipt[]): void {
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

function decodeLedger(json: LedgerJson, out: LifeReceipt[]): void {
  const rows = Array.isArray(json.rows) ? json.rows : [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row) || row.length < 7 || !Number.isFinite(row[0])) continue;
    const [ts, mode, cat, sub, note, amtPaise, kind] = row as [number, number, number, number, string, number, number];
    const kindRaw = dict(json.kinds, kind) || "expense";
    const type = kindRaw.startsWith("income") ? "income" : kindRaw.startsWith("transfer") ? "transfer" : "expense";
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

function buildMeta(
  plays: PlaysJson,
  receipts: LifeReceipt[],
): ArchiveMeta {
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
    musicPlays: Object.values(plays.monthly).reduce((a, b) => a + b, 0),
    purchases: receipts.reduce((a, r) => a + (r.source === "card" ? 1 : 0), 0),
    ledgerEntries: receipts.reduce((a, r) => a + (r.source === "ledger" ? 1 : 0), 0),
    firstTs,
    lastTs,
    topArtistsAllTime: plays.topArtistsAllTime,
    topArtistsByYear: plays.topArtistsByYear,
    nightShareByYear: plays.nightShareByYear,
  };
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


