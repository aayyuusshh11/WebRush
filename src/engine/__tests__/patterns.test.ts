import { describe, expect, it } from "vitest";
import { buildPatterns } from "../patterns";
import { assembleArchive, at, makeMeta, music, purchase, ledger } from "./fixtures";
import type { LifeReceipt } from "../types";

describe("buildPatterns", () => {
  it("counts hour histograms and finds the peak hour", () => {
    const archive = assembleArchive(
      [
        music({ id: "m-1", ts: at(2023, 5, 1, 2) }),
        music({ id: "m-2", ts: at(2023, 5, 2, 2) }),
        music({ id: "m-3", ts: at(2023, 5, 3, 2) }),
        music({ id: "m-4", ts: at(2023, 5, 4, 14) }),
      ],
      makeMeta(),
    );
    const p = buildPatterns(archive);
    expect(p.musicHours[2]).toBe(3);
    expect(p.musicHours[14]).toBe(1);
    expect(p.peakHour).toBe(2);
  });

  it("computes the longest streak of consecutive listening days", () => {
    const archive = assembleArchive(
      [
        // May 1, 2, 3 — a 3-day streak.
        music({ id: "m-1", ts: at(2023, 5, 1) }),
        music({ id: "m-2", ts: at(2023, 5, 2) }),
        music({ id: "m-3", ts: at(2023, 5, 3) }),
        // A gap, then a single day (May 6).
        music({ id: "m-4", ts: at(2023, 5, 6) }),
      ],
      makeMeta(),
    );
    const p = buildPatterns(archive);
    expect(p.streak.length).toBe(3);
    expect(p.streak.startTs).toBe(at(2023, 5, 1));
  });

  it("detects ledger rituals above the 20× threshold only", () => {
    const receipts: LifeReceipt[] = [];
    for (let i = 0; i < 21; i++) {
      receipts.push(
        ledger({
          id: `l-milk-${i}`,
          ts: at(2016, 1, 1 + (i % 28), 8),
          title: "Milk",
          subcategory: "milk",
          amount: 30,
        }),
      );
    }
    for (let i = 0; i < 5; i++) {
      receipts.push(
        ledger({ id: `l-news-${i}`, ts: at(2016, 2, 1 + i), title: "Newspaper", subcategory: "newspaper", amount: 5 }),
      );
    }
    const archive = assembleArchive(receipts, makeMeta());
    const p = buildPatterns(archive);
    const milk = p.rituals.find((r) => r.label === "milk");
    expect(milk).toBeDefined();
    expect(milk!.count).toBe(21);
    expect(milk!.medianAmount).toBe(30);
    // Below threshold — not a ritual.
    expect(p.rituals.find((r) => r.label === "newspaper")).toBeUndefined();
  });

  it("totals spending, categories and convergence days", () => {
    const archive = assembleArchive(
      [
        music({ id: "m-1", ts: at(2023, 5, 1, 22) }),
        purchase({ id: "c-1", ts: at(2023, 5, 1, 22, 30), title: "Swiggy", category: "food_dining", amount: 340 }),
        purchase({ id: "c-2", ts: at(2023, 5, 2), title: "Swiggy", category: "food_dining", amount: 660 }),
        purchase({ id: "c-3", ts: at(2023, 5, 3), title: "Metro", category: "transport", amount: 50 }),
      ],
      makeMeta(),
    );
    const p = buildPatterns(archive);
    expect(p.totalSpend).toBe(1050);
    expect(p.medianPurchase).toBe(340);
    expect(p.spendByCategory[0].category).toBe("food_dining");
    expect(p.spendByCategory[0].total).toBe(1000);
    expect(p.daysWithBoth).toBe(1); // only May 1 has both music and money
    expect(p.topMerchants[0]).toEqual(["Swiggy", 2]);
  });
});
