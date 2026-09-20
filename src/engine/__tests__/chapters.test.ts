import { describe, expect, it } from "vitest";
import { buildPatterns } from "../patterns";
import { buildChapters } from "../chapters";
import { assembleArchive, at, makeMeta, music, ledger } from "./fixtures";
import type { Archive } from "../../data/dataset";
import type { LifeReceipt } from "../types";

/** A small archive that clears the Night Shift gate (30% after midnight). */
function nightArchive(night: number, day: number): Archive {
  const receipts: LifeReceipt[] = [];
  let i = 0;
  for (let n = 0; n < night; n++) {
    receipts.push(music({ id: `m-n${i++}`, ts: at(2023, 6, 1 + (n % 5), 2), title: `Night ${n}`, subtitle: "Artist" }));
  }
  for (let d = 0; d < day; d++) {
    receipts.push(music({ id: `m-d${i++}`, ts: at(2023, 6, 10 + (d % 5), 14), title: `Day ${d}`, subtitle: "Artist" }));
  }
  return assembleArchive(receipts, makeMeta());
}

describe("buildChapters — evidence gating", () => {
  it("produces no chapters from empty evidence", () => {
    const archive = assembleArchive([music({ id: "m-1", ts: at(2023, 6, 1, 14) })], makeMeta());
    const chapters = buildChapters(archive, buildPatterns(archive));
    expect(chapters).toEqual([]);
  });

  it("opens the night shift only when the share clears 30%", () => {
    // 3 of 10 plays at night = 30% → gate met (>= 0.3).
    const strong = buildChapters(nightArchive(3, 7), buildPatterns(nightArchive(3, 7)));
    expect(strong.map((c) => c.id)).toContain("night-shift");

    // 2 of 10 = 20% → no chapter, no drama.
    const weak = buildChapters(nightArchive(2, 8), buildPatterns(nightArchive(2, 8)));
    expect(weak.map((c) => c.id)).not.toContain("night-shift");
  });

  it("numbers chapters sequentially as evidence allows", () => {
    const archive = nightArchive(4, 6);
    const chapters = buildChapters(archive, buildPatterns(archive));
    expect(chapters[0].numeral).toBe("01");
    for (let i = 0; i < chapters.length; i++) {
      expect(chapters[i].numeral).toBe(String(i + 1).padStart(2, "0"));
    }
  });

  it("carries computed evidence, not hardcoded numbers", () => {
    const archive = nightArchive(3, 7);
    const [chapter] = buildChapters(archive, buildPatterns(archive));
    const nightPlays = chapter.evidence.find((e) => e.label === "Plays after midnight");
    expect(nightPlays!.value).toBe("3 of 10");
  });

  it("builds the ledger years chapter from a 12-month ledger era", () => {
    const receipts: LifeReceipt[] = [];
    for (let m = 1; m <= 12; m++) {
      receipts.push(
        ledger({ id: `l-${m}`, ts: at(2016, m, 5), title: "Milk", subcategory: "milk", amount: 30 }),
        ledger({ id: `li-${m}`, ts: at(2016, m, 1), type: "income", title: "Salary", subcategory: "salary", amount: 30000 }),
      );
    }
    const archive = assembleArchive(receipts, makeMeta({ ledgerEntries: receipts.length }));
    const chapters = buildChapters(archive, buildPatterns(archive));
    const ledgerChapter = chapters.find((c) => c.id === "ledger-years");
    expect(ledgerChapter).toBeDefined();
    expect(ledgerChapter!.observation.join(" ")).toContain("2016 / 01");
    expect(ledgerChapter!.evidence.some((e) => e.label === "Ledger entries")).toBe(true);
  });
});
