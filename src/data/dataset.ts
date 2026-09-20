/**
 * Archive loader — the single place raw prepared JSON becomes LifeReceipts.
 * Everything is decoded, sorted and indexed exactly once, then shared.
 */

import type { ArchiveMeta, LifeReceipt, ListeningSession, SourceId } from "../engine/types";

/* ---------- raw shapes (see scripts/prepare-data.mjs for schemas) ---------- */

interface PlaysJson {
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

interface CardJson {
  merchants: string[];
  categories: string[];
  cities: string[];
  states: string[];
  rows: Array<[number, number, number, number, number, number, number]>;
}

interface LedgerJson {
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
  /** track name → sorted play timestamps (echo detection). */
  playsByTrack: Map<string, number[]>;
  /** merchant → sorted purchase timestamps (recurrence). */
  purchasesByMerchant: Map<string, number[]>;
  /** subcategory → sorted ledger timestamps (rituals). */
  ledgerBySubcategory: Map<string, number[]>;
  meta: ArchiveMeta;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

function keysOf(ts: number) {
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
  return (await res.json()) as T;
}

function decodePlays(json: PlaysJson, out: LifeReceipt[]): void {
  for (let i = 0; i < json.rows.length; i++) {
    const [ts, a, t, al, ms6, flags, p] = json.rows[i];
    const track = json.tracks[t];
    const receipt: LifeReceipt = {
      id: `m-${i}`,
      type: "music",
      source: "spotify",
      ts,
      title: track,
      subtitle: json.artists[a],
      album: json.albums[al] || undefined,
      msPlayed: ms6 << 6,
      skipped: (flags & 1) === 1,
      shuffle: (flags & 2) === 2,
      platform: json.platforms[p],
      ...keysOf(ts),
    };
    out.push(receipt);
  }
}

function decodeCard(json: CardJson, out: LifeReceipt[]): void {
  for (let i = 0; i < json.rows.length; i++) {
    const [ts, m, c, amtPaise, city, state, flagged] = json.rows[i];
    const receipt: LifeReceipt = {
      id: `c-${i}`,
      type: "purchase",
      source: "card",
      ts,
      title: displayMerchant(json.merchants[m]),
      subtitle: [json.cities[city], json.states[state]].filter(Boolean).join(", ") || undefined,
      category: displayCategory(json.categories[c]),
      city: json.cities[city] || undefined,
      state: json.states[state] || undefined,
      amount: amtPaise / 100,
      flagged: flagged === 1,
      ...keysOf(ts),
    };
    out.push(receipt);
  }
}

function decodeLedger(json: LedgerJson, out: LifeReceipt[]): void {
  for (let i = 0; i < json.rows.length; i++) {
    const [ts, mode, cat, sub, note, amtPaise, kind] = json.rows[i];
    const kindRaw = json.kinds[kind] ?? "expense";
    const type = kindRaw.startsWith("income") ? "income" : kindRaw.startsWith("transfer") ? "transfer" : "expense";
    const subcategory = json.subcategories[sub] || undefined;
    const receipt: LifeReceipt = {
      id: `l-${i}`,
      type,
      source: "ledger",
      ts,
      title: subcategory ?? displayCategory(json.categories[cat]),
      subtitle: note || undefined,
      category: displayCategory(json.categories[cat]),
      subcategory,
      amount: amtPaise / 100,
      platform: json.modes[mode] || undefined,
      ...keysOf(ts),
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

function groupTs<V>(items: V[], keyOf: (v: V) => string, tsOf: (v: V) => number): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const v of items) {
    const k = keyOf(v);
    const arr = map.get(k);
    if (arr) arr.push(tsOf(v));
    else map.set(k, [tsOf(v)]);
  }
  for (const arr of map.values()) arr.sort((a, b) => a - b);
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
  for (const [k, n] of Object.entries(plays.monthly)) touch(k).music += n;
  for (const r of receipts) {
    const m = touch(r.monthKey);
    if (r.source === "card") m.purchase += 1;
    else if (r.source === "ledger") m.ledger += 1;
  }
  const tsArr = receipts.map((r) => r.ts);
  return {
    monthly,
    musicPlays: Object.values(plays.monthly).reduce((a, b) => a + b, 0),
    purchases: receipts.reduce((a, r) => a + (r.source === "card" ? 1 : 0), 0),
    ledgerEntries: receipts.reduce((a, r) => a + (r.source === "ledger" ? 1 : 0), 0),
    firstTs: Math.min(...tsArr),
    lastTs: Math.max(...tsArr),
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

    return {
      receipts,
      byId,
      byDay,
      sessions: buildSessions(music),
      sessionById: new Map(),
      playsByTrack: groupTs(music, (r) => r.title, (r) => r.ts),
      purchasesByMerchant: groupTs(purchases, (r) => r.title, (r) => r.ts),
      ledgerBySubcategory: groupTs(ledgerRows, (r) => r.title, (r) => r.ts),
      meta: buildMeta(plays, receipts),
    } satisfies Archive;
  })();

  archivePromise.then((a) => {
    for (const s of a.sessions) a.sessionById.set(s.id, s);
  });

  return archivePromise;
}

export const SOURCE_LABEL: Record<SourceId, string> = {
  spotify: "Streaming archive",
  card: "Card statement",
  ledger: "Household ledger",
};
