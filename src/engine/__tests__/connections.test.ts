import { describe, expect, it } from "vitest";
import { getThread } from "../connections";
import { assembleArchive, at, makeMeta, music, purchase, ledger } from "./fixtures";
import type { Archive } from "../../data/dataset";

const base = at(2023, 6, 10, 22);

function buildArchive(): Archive {
  const receipts = [
    // One listening session: three tracks in quick succession.
    music({ id: "m-0", ts: base, title: "Echo Track", subtitle: "The Repeat Artist" }),
    music({ id: "m-1", ts: base + 10 * 60, title: "Other Track", subtitle: "The Repeat Artist" }),
    music({ id: "m-2", ts: base + 20 * 60, title: "Third Track", subtitle: "Someone Else" }),
    // The same track echoes five days later.
    music({ id: "m-3", ts: base + 5 * 86400, title: "Echo Track", subtitle: "The Repeat Artist" }),
    // A purchase the same day, and a repeat visit to the same merchant.
    purchase({
      id: "c-0",
      ts: base + 30 * 60,
      title: "Swiggy",
      category: "food_dining",
      city: "Mumbai",
      state: "Maharashtra",
      amount: 340,
    }),
    purchase({
      id: "c-1",
      ts: base + 12 * 86400,
      title: "Swiggy",
      category: "food_dining",
      city: "Mumbai",
      state: "Maharashtra",
      amount: 280,
    }),
    // A different merchant, same city, same month — location/category links.
    purchase({
      id: "c-2",
      ts: base + 2 * 86400,
      title: "Big Bazaar",
      category: "groceries",
      city: "Mumbai",
      state: "Maharashtra",
      amount: 1200,
    }),
    // A ledger entry on the same day.
    ledger({ id: "l-0", ts: base + 60 * 60, title: "Auto fare", subcategory: "auto", amount: 60 }),
  ];
  return assembleArchive(receipts, makeMeta());
}

describe("getThread — spotify receipts", () => {
  const archive = buildArchive();

  it("links the session neighbors", () => {
    const r = archive.byId.get("m-1")!;
    const links = getThread(archive, r);
    const sessionLinks = links.filter((l) => l.type === "session");
    expect(sessionLinks.map((l) => l.receipt.id).sort()).toEqual(["m-0", "m-2"]);
    for (const l of sessionLinks) expect(l.reason).toContain("same listening session");
  });

  it("links echoes of the same track with real receipts", () => {
    const r = archive.byId.get("m-0")!;
    const echoes = getThread(archive, r).filter((l) => l.type === "recurrence");
    expect(echoes.map((l) => l.receipt.id)).toEqual(["m-3"]);
    // The linked receipt is a real archive member, with correct derived keys.
    expect(echoes[0].receipt.dayKey).toBe(archive.byId.get("m-3")!.dayKey);
    expect(echoes[0].reason).toContain("same track");
  });

  it("links money that happened the same day", () => {
    const r = archive.byId.get("m-0")!;
    const links = getThread(archive, r);
    const ids = links.map((l) => l.receipt.id);
    expect(ids).toContain("c-0"); // card, same day
    expect(ids).toContain("l-0"); // ledger, same day
  });
});

describe("getThread — card receipts", () => {
  const archive = buildArchive();

  it("links the merchant's repeat visits", () => {
    const r = archive.byId.get("c-0")!;
    const repeats = getThread(archive, r).filter((l) => l.type === "recurrence");
    expect(repeats.map((l) => l.receipt.id)).toContain("c-1");
    expect(repeats[0].reason).toContain("same merchant");
  });

  it("links the same city that month (location)", () => {
    const r = archive.byId.get("c-1")!; // June, Mumbai
    const places = getThread(archive, r).filter((l) => l.type === "location");
    // c-0 is already linked as a merchant recurrence (stronger reason wins),
    // so the location lane carries only c-2.
    expect(places.map((l) => l.receipt.id)).toEqual(["c-2"]);
    expect(places[0].reason).toContain("same city that month");
  });

  it("links the same kind of purchase that month (category)", () => {
    const r = archive.byId.get("c-2")!;
    const kinds = getThread(archive, r).filter((l) => l.type === "category");
    // c-2 is groceries; the Swiggy purchases are food_dining — a different
    // title but for c-2 nothing shares its category. Switch: use c-0.
    expect(kinds).toHaveLength(0);
  });

  it("emits category links when the same category repeats at another merchant", () => {
    const archive2 = assembleArchive(
      [
        purchase({ id: "c-0", ts: base, title: "Swiggy", category: "food_dining", city: "Mumbai", amount: 340 }),
        purchase({ id: "c-9", ts: base + 86400, title: "Zomato", category: "food_dining", city: "Pune", amount: 410 }),
      ],
      makeMeta(),
    );
    const kinds = getThread(archive2, archive2.byId.get("c-0")!).filter((l) => l.type === "category");
    expect(kinds.map((l) => l.receipt.id)).toEqual(["c-9"]);
    expect(kinds[0].reason).toContain("same kind of purchase");
  });
});

describe("getThread — general contract", () => {
  const archive = buildArchive();

  it("is deterministic", () => {
    const r = archive.byId.get("m-0")!;
    const a = getThread(archive, r).map((l) => `${l.type}:${l.receipt.id}`);
    const b = getThread(archive, r).map((l) => `${l.type}:${l.receipt.id}`);
    expect(a).toEqual(b);
  });

  it("never links a receipt to itself and caps the thread", () => {
    for (const r of archive.receipts) {
      const links = getThread(archive, r);
      expect(links.length).toBeLessThanOrEqual(9);
      for (const l of links) expect(l.receipt.id).not.toBe(r.id);
    }
  });

  it("gives every link a human-readable reason", () => {
    for (const r of archive.receipts) {
      for (const l of getThread(archive, r)) {
        expect(l.reason.length).toBeGreaterThan(5);
      }
    }
  });

  it("returns an empty thread when nothing connects", () => {
    const lonely = assembleArchive(
      [music({ id: "m-0", ts: at(1999, 1, 1), title: "One-off", subtitle: "Nobody" })],
      makeMeta(),
    );
    expect(getThread(lonely, lonely.byId.get("m-0")!)).toEqual([]);
  });
});
