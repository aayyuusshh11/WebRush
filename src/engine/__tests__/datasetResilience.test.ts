import { describe, expect, it, vi, afterEach } from "vitest";
import type { PlaysJson, CardJson, LedgerJson } from "../../data/dataset";

/**
 * The loader must survive malformed prepared data: invalid rows are skipped,
 * missing dictionaries become empty lookups, and a non-object payload is a
 * readable error — never a crash loop on a blank page.
 */

const validPlays: PlaysJson = {
  artists: ["Artist A"],
  tracks: ["Track T"],
  albums: [],
  platforms: ["windows"],
  monthly: { "2023-06": 1 },
  topArtistsAllTime: [["Artist A", 1]],
  topArtistsByYear: { "2023": [["Artist A", 1]] },
  nightShareByYear: { "2023": 0 },
  rows: [[1686432000, 0, 0, 0, 937, 0, 0]],
};

const validCard: CardJson = {
  merchants: ["Swiggy"],
  categories: ["food_dining"],
  cities: ["Mumbai"],
  states: ["Maharashtra"],
  rows: [[1686433000, 0, 0, 34000, 0, 0, 0]],
};

const validLedger: LedgerJson = {
  modes: ["Cash"],
  categories: ["transport"],
  subcategories: ["auto"],
  kinds: ["expense"],
  rows: [[1686434000, 0, 0, 0, "", 6000, 0]],
};

async function loadWith(plays: unknown, card: unknown = validCard, ledger: unknown = validLedger) {
  vi.resetModules(); // loadArchive caches per module instance — reset per scenario
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const name = String(input).split("/").pop();
      const body =
        name === "plays.json" ? plays : name === "card.json" ? card : ledger;
      return { ok: true, json: async () => body } as Response;
    }),
  );
  const { loadArchive } = await import("../../data/dataset");
  return loadArchive();
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("archive loading resilience", () => {
  it("loads a fully valid archive unchanged", async () => {
    const archive = await loadWith(validPlays);
    expect(archive.receipts).toHaveLength(3);
    expect(archive.receipts.map((r) => r.id).sort()).toEqual(["c-0", "l-0", "m-0"]);
  });

  it("skips malformed rows and missing dictionaries instead of crashing", async () => {
    const broken: PlaysJson = {
      artists: undefined as unknown as string[], // missing dictionary
      tracks: ["Track T"],
      albums: undefined as unknown as string[],
      platforms: [],
      monthly: {},
      topArtistsAllTime: [],
      topArtistsByYear: {},
      nightShareByYear: {},
      rows: [
        [1686432000, 0, 0, 0, 937, 0, 0], // valid
        "garbage",                        // not an array
        [null, 0, 0, 0, 0, 0, 0],         // no timestamp
        [1686432100, 99, 99, 0, 937, 0, 0], // dictionary miss → skipped (no track name)
        [1686432200, 0, 0],               // too short
      ] as unknown as PlaysJson["rows"],
    };
    const archive = await loadWith(broken);
    // 1 surviving music receipt + the valid card and ledger defaults.
    expect(archive.receipts).toHaveLength(3);
    expect(archive.receipts.filter((r) => r.source === "spotify")).toHaveLength(1);
    expect(archive.byId.get("m-0")!.title).toBe("Track T");
  });

  it("survives completely broken card and ledger payloads", async () => {
    const archive = await loadWith(
      validPlays,
      { rows: ["nope", null, [1, 2]] } as unknown as CardJson,
      { rows: undefined } as unknown as LedgerJson,
    );
    // Only the music receipt survives; nothing throws.
    expect(archive.receipts.map((r) => r.id)).toEqual(["m-0"]);
    expect(archive.sessions).toHaveLength(1);
  });

  it("rejects non-object payloads with a readable error", async () => {
    await expect(loadWith("not an object")).rejects.toThrow("not a valid archive");
  });
});
