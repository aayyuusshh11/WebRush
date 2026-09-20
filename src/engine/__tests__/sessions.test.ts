import { describe, expect, it } from "vitest";
import { buildSessions } from "../../data/dataset";
import { at, music } from "./fixtures";

/** 35-minute gap rule: consecutive plays ≤ 35 min apart share a session. */
describe("buildSessions", () => {
  it("groups plays within the gap and splits across it", () => {
    const base = at(2023, 5, 1, 1);
    const receipts = [
      music({ id: "m-1", ts: base, title: "Track A", subtitle: "Artist X" }),
      music({ id: "m-2", ts: base + 20 * 60, title: "Track B", subtitle: "Artist X" }),
      music({ id: "m-3", ts: base + 40 * 60, title: "Track C", subtitle: "Artist Y" }),
      // 30 min later — still within 35 of the previous play, same session.
      music({ id: "m-4", ts: base + 70 * 60, title: "Track D", subtitle: "Artist Z" }),
      // 2 hours later — new session.
      music({ id: "m-5", ts: base + 70 * 60 + 2 * 3600, title: "Track E", subtitle: "Artist Z" }),
    ];

    const sessions = buildSessions(receipts);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].receiptIds).toEqual(["m-1", "m-2", "m-3", "m-4"]);
    expect(sessions[1].receiptIds).toEqual(["m-5"]);

    // Session membership is stamped back onto the receipts.
    expect(receipts[0].sessionId).toBe(0);
    expect(receipts[4].sessionId).toBe(1);
  });

  it("derives dominant artist, skip count and late-night flag", () => {
    const base = at(2023, 5, 1, 2); // 02:00 — after midnight
    const receipts = [
      music({ id: "m-1", ts: base, title: "A", subtitle: "Repeat Artist", skipped: false }),
      music({ id: "m-2", ts: base + 60, title: "B", subtitle: "Repeat Artist", skipped: true }),
      music({ id: "m-3", ts: base + 120, title: "C", subtitle: "Other", skipped: false }),
    ];

    const [session] = buildSessions(receipts);
    expect(session.dominantArtist).toBe("Repeat Artist");
    expect(session.tracks).toBe(3);
    expect(session.skipped).toBe(1);
    expect(session.lateNight).toBe(true);
    expect(session.artists).toEqual(["Repeat Artist", "Other"]);
  });

  it("does not flag daytime sessions as late night", () => {
    const [session] = buildSessions([music({ id: "m-1", ts: at(2023, 5, 1, 15) })]);
    expect(session.lateNight).toBe(false);
  });
});
