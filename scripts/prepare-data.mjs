/**
 * TRACE — data preparation (build-time only, Node).
 *
 * Reads the supplied source CSVs, sanitizes personally-identifying fields,
 * dictionary-encodes repeated strings, and emits compact JSON archives that
 * the frontend loads at runtime. No raw CSV is ever shipped to the browser.
 *
 *   data/spotify_history.csv                     → public/data/plays.json
 *   data/Augmented_IndiaTransactMultiFacet2024   → public/data/card.json
 *   data/Daily Household Transactions.csv        → public/data/ledger.json
 *
 * Sanitization (per the brief): cc_num, names, gender, street, dob, job,
 * customer_id, and raw coordinates are dropped and never leave this script.
 *
 * Usage: npm run prepare:data
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const DATA = join(ROOT, "data");
const OUT = join(ROOT, "public", "data");

/* ------------------------------------------------------------------ */
/* Minimal, dependency-free CSV reader                                 */
/* ------------------------------------------------------------------ */

/** Parse CSV text into rows of fields (RFC-4180 quotes, CRLF, BOM). */
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); field = "";
      rows.push(row); row = [];
    } else if (c === "\r") {
      /* skip — handled by \n */
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

/** Split a CSV file into header + objects keyed by column name. */
function readTable(file) {
  const rows = parseCsv(readFileSync(join(DATA, file), "utf8"));
  const header = rows[0].map((h) => h.trim());
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length === 1 && r[0] === "") continue;
    const obj = {};
    for (let c = 0; c < header.length; c++) obj[header[c]] = r[c] ?? "";
    out.push(obj);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** "2013-07-08 02:44:34" (UTC) → epoch seconds. */
function tsUtc(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s.trim());
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)) / 1000;
}

/** "12/26/2023 0:55[:ss][ AM/PM]" (naive, treated as UTC for determinism) → epoch seconds. */
function tsUs(s) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(s.trim());
  if (!m) return NaN;
  let h = +m[4];
  if (m[7]) {
    if (m[7].toUpperCase() === "PM" && h < 12) h += 12;
    if (m[7].toUpperCase() === "AM" && h === 12) h = 0;
  }
  return Date.UTC(+m[3], +m[1] - 1, +m[2], h, +m[5], +(m[6] ?? 0)) / 1000;
}

/** "20/09/2018 12:04:08" (naive, treated as UTC) → epoch seconds. */
function tsEu(s) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(s.trim());
  if (!m) return NaN;
  return Date.UTC(+m[3], +m[2] - 1, +m[1], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0)) / 1000;
}

function toNum(s) {
  const n = Number(String(s).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : NaN;
}

/** Single-pass string dictionary: assigns integer ids in first-seen order. */
function makeAutoDict() {
  const ids = new Map();
  const list = [];
  return {
    id(v) {
      let i = ids.get(v);
      if (i === undefined) { i = list.length; ids.set(v, i); list.push(v); }
      return i;
    },
    list: () => list,
  };
}

function monthKeyOf(epochSec) {
  const d = new Date(epochSec * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* 1. Spotify listening history                                        */
/* ------------------------------------------------------------------ */

function prepareSpotify() {
  const rows = readTable("spotify_history.csv");
  const artists = makeAutoDict(), tracks = makeAutoDict(), albums = makeAutoDict(), platforms = makeAutoDict();

  const monthly = new Map();               // all years, for the life stream
  const yearly = new Map();                // year → {plays, night, artistCounts}
  const allTimeArtists = new Map();
  const detail = [];                       // 2022+ only (the convergence era)
  const CUT = Date.UTC(2022, 0, 1) / 1000;

  let skipped = 0;
  for (const r of rows) {
    const ts = tsUtc(r.ts);
    const track = r.track_name.trim();
    const artist = r.artist_name.trim();
    if (!Number.isFinite(ts) || !track || !artist) { skipped++; continue; }

    const album = r.album_name.trim();
    const platform = r.platform.trim().toLowerCase() || "unknown";
    const ms = Math.max(0, Math.round(toNum(r.ms_played) || 0));
    const skipFlag = /true/i.test(r.skipped) ? 1 : 0;
    const shuffleFlag = /true/i.test(r.shuffle) ? 2 : 0;

    const a = artists.id(artist), t = tracks.id(track), al = albums.id(album), p = platforms.id(platform);

    const mk = monthKeyOf(ts);
    monthly.set(mk, (monthly.get(mk) ?? 0) + 1);

    const y = String(new Date(ts * 1000).getUTCFullYear());
    let yr = yearly.get(y);
    if (!yr) { yr = { plays: 0, night: 0, artists: new Map() }; yearly.set(y, yr); }
    yr.plays++;
    const hour = new Date(ts * 1000).getUTCHours();
    if (hour < 6) yr.night++;
    yr.artists.set(artist, (yr.artists.get(artist) ?? 0) + 1);
    allTimeArtists.set(artist, (allTimeArtists.get(artist) ?? 0) + 1);

    if (ts >= CUT) {
      // Column layout: [ts, artistIdx, trackIdx, albumIdx, msPlayed>>6, flags, platformIdx]
      detail.push([ts, a, t, al, ms >> 6, skipFlag | shuffleFlag, p]);
    }
  }

  const topArtistsAllTime = [...allTimeArtists.entries()]
    .sort((x, y) => y[1] - x[1]).slice(0, 24);

  const topArtistsByYear = {};
  const nightShareByYear = {};
  for (const [y, { plays, night, artists: am }] of [...yearly.entries()].sort((a, b) => a[0] - b[0])) {
    topArtistsByYear[y] = [...am.entries()].sort((x, z) => z[1] - x[1]).slice(0, 3);
    nightShareByYear[y] = +(night / plays).toFixed(3);
  }

  const out = {
    schema: "trace.spotify.v1",
    rowsFrom: "2022-01-01",
    note: "Detail rows cover 2022 onward; earlier years are aggregated to monthly counts. Timestamps are UTC.",
    artists: artists.list(),
    tracks: tracks.list(),
    albums: albums.list(),
    platforms: platforms.list(),
    monthly: Object.fromEntries([...monthly.entries()].sort()),
    topArtistsAllTime,
    topArtistsByYear,
    nightShareByYear,
    rows: detail.sort((a, b) => a[0] - b[0]),
  };

  writeFileSync(join(OUT, "plays.json"), JSON.stringify(out));
  console.log(`spotify: ${detail.length} detail rows (2022+), ${rows.length - skipped} parsed, ${skipped} skipped, ${monthly.size} months, ${artists.list().length} artists`);
  return out;
}

/* ------------------------------------------------------------------ */
/* 2. Card transactions (sanitized)                                    */
/* ------------------------------------------------------------------ */

function prepareCard() {
  const rows = readTable("Augmented_IndiaTransactMultiFacet2024.csv");
  const merchants = makeAutoDict(), categories = makeAutoDict(), cities = makeAutoDict(), states = makeAutoDict();

  const out = [];
  let dropped = 0;
  let fraud = 0;
  const catCounts = new Map();
  const cityCounts = new Map();

  for (const r of rows) {
    const ts = tsUs(r.trans_date_trans_time);
    if (!Number.isFinite(ts)) { dropped++; continue; }

    // Merchant names ship with a synthetic "fraud_" prefix — strip for display.
    const merchant = r.merchant.trim().replace(/^fraud_/i, "");
    const category = r.category.trim().toLowerCase();
    const amt = Math.round((toNum(r.amt) || 0) * 100);          // integer paise
    const city = r.city.trim();
    const state = r.state.trim();
    const flagged = String(r.is_fraud).trim() === "1" ? 1 : 0;

    if (flagged) fraud++;
    if (category) catCounts.set(category, (catCounts.get(category) ?? 0) + 1);
    if (city) cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1);

    // Column layout: [ts, merchantIdx, catIdx, amtPaise, cityIdx, stateIdx, flagged]
    out.push([
      ts,
      merchants.id(merchant),
      categories.id(category),
      amt,
      cities.id(city),
      states.id(state),
      flagged,
    ]);
  }

  const result = {
    schema: "trace.card.v1",
    note: "Sanitized: card numbers, names, addresses, dates of birth, jobs, customer ids and raw coordinates are removed. Timestamps are naive-local, encoded as UTC.",
    merchants: merchants.list(),
    categories: categories.list(),
    cities: cities.list(),
    states: states.list(),
    rows: out.sort((a, b) => a[0] - b[0]),
    dropped,
  };

  writeFileSync(join(OUT, "card.json"), JSON.stringify(result));
  console.log(`card: ${out.length} transactions, ${dropped} dropped (no date), ${fraud} flagged, ${merchants.list().length} merchants, ${categories.list().length} categories`);
  console.log("  top categories:", [...catCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8));
  console.log("  top cities:", [...cityCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8));
  return result;
}

/* ------------------------------------------------------------------ */
/* 3. Household ledger                                                 */
/* ------------------------------------------------------------------ */

function prepareLedger() {
  const rows = readTable("Daily Household Transactions.csv");
  const modes = makeAutoDict(), categories = makeAutoDict(), subcategories = makeAutoDict(), kinds = makeAutoDict();

  const out = [];
  let dropped = 0;
  const kindCounts = new Map();
  const subCounts = new Map();

  for (const r of rows) {
    const ts = tsEu(r.Date);
    if (!Number.isFinite(ts)) { dropped++; continue; }
    const mode = r.Mode.trim();
    const category = r.Category.trim().toLowerCase();
    const sub = r.Subcategory.trim();
    const note = r.Note.trim();
    const amt = Math.round((toNum(r.Amount) || 0) * 100);
    const kind = (r["Income/Expense"] || "expense").trim().toLowerCase();

    kindCounts.set(kind, (kindCounts.get(kind) ?? 0) + 1);
    if (sub) subCounts.set(sub, (subCounts.get(sub) ?? 0) + 1);

    // Column layout: [ts, modeIdx, catIdx, subIdx, note, amtPaise, kindIdx]
    out.push([ts, modes.id(mode), categories.id(category), subcategories.id(sub), note, amt, kinds.id(kind)]);
  }

  const result = {
    schema: "trace.ledger.v1",
    note: "Personal household ledger, 2015–2018. Amounts in INR paise.",
    modes: modes.list(),
    categories: categories.list(),
    subcategories: subcategories.list(),
    kinds: kinds.list(),
    rows: out.sort((a, b) => a[0] - b[0]),
    dropped,
  };

  writeFileSync(join(OUT, "ledger.json"), JSON.stringify(result));
  console.log(`ledger: ${out.length} entries, ${dropped} dropped (no date)`);
  console.log("  kinds:", [...kindCounts.entries()]);
  console.log("  top subcategories:", [...subCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12));
  return result;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

mkdirSync(OUT, { recursive: true });
const spotify = prepareSpotify();
prepareCard();
prepareLedger();

console.log("\n— evidence check —");
console.log("night share by year:", spotify.nightShareByYear);
console.log("all-time top artists:", spotify.topArtistsAllTime.slice(0, 8));
console.log("writes complete → public/data/{plays,card,ledger}.json");
