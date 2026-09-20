import { describe, expect, it } from "vitest";
import { buildPatterns } from "../patterns";
import { buildDiscoveries } from "../discoveries";
import { assembleArchive, at, makeMeta, music, discoveryArchive } from "./fixtures";

describe("buildDiscoveries", () => {
  it("generates gated, evidence-backed discoveries", () => {
    const archive = discoveryArchive();
    const discoveries = buildDiscoveries(archive, buildPatterns(archive));
    const ids = discoveries.map((d) => d.id);
    expect(ids).toContain("late-night-overlap");
    expect(ids).toContain("repeating-track");
    expect(ids).toContain("repeating-purchase");
    expect(ids).toContain("repeating-merchant");
    expect(ids).toContain("longest-night");
  });

  it("numbers discoveries sequentially and cites real numbers", () => {
    const archive = discoveryArchive();
    const discoveries = buildDiscoveries(archive, buildPatterns(archive));
    discoveries.forEach((d, i) => {
      expect(d.numeral).toBe(String(i + 1).padStart(2, "0"));
    });

    const track = discoveries.find((d) => d.id === "repeating-track")!;
    expect(track.lead).toContain('"Echo Track" was played 6 times across 6 different days');

    const ritual = discoveries.find((d) => d.id === "repeating-purchase")!;
    expect(ritual.lead).toContain('"milk" appears 21 times');
    expect(ritual.evidence.some((e) => e.label === "Typical amount" && e.value === "₹30")).toBe(true);
  });

  it("links representative receipts and archive deep-links", () => {
    const archive = discoveryArchive();
    const discoveries = buildDiscoveries(archive, buildPatterns(archive));
    const overlap = discoveries.find((d) => d.id === "late-night-overlap")!;
    expect(overlap.receiptIds.length).toBeGreaterThan(0);
    expect(overlap.archiveFocus?.dayKey).toBe("2023-06-12");
  });

  it("produces nothing from empty evidence", () => {
    const archive = assembleArchive(
      [music({ id: "m-1", ts: at(2023, 6, 1, 14) })],
      makeMeta(),
    );
    expect(buildDiscoveries(archive, buildPatterns(archive))).toEqual([]);
  });
});
