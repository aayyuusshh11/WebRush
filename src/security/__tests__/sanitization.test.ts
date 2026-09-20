import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Security gate: whatever ships in public/data must be clean.
 *
 * prepare-data.mjs is responsible for stripping cc_num, names, street, dob,
 * job, gender, customer_id and raw coordinates. These tests fail the build
 * pipeline if any of that ever leaks into the browser-facing JSON.
 */

const DATA_DIR = join(process.cwd(), "public", "data");

const FORBIDDEN_KEYS = [
  "cc_num",
  "trans_num",
  "customer_id",
  "first",
  "last",
  "gender",
  "street",
  "dob",
  "job",
  "lat",
  "long",
  "merch_lat",
  "merch_long",
];

function shippedJsonFiles(): string[] {
  return readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
}

describe("sanitization of shipped data", () => {
  it("ships the three expected archives", () => {
    expect(shippedJsonFiles().sort()).toEqual(["card.json", "ledger.json", "plays.json"]);
  });

  it("contains no personal-identifier keys in any archive", () => {
    for (const file of shippedJsonFiles()) {
      const text = readFileSync(join(DATA_DIR, file), "utf8");
      for (const key of FORBIDDEN_KEYS) {
        expect(text, `${file} must not contain the key "${key}"`).not.toContain(`"${key}"`);
      }
    }
  });

  it("contains no card-number-length digit runs in any archive", () => {
    for (const file of shippedJsonFiles()) {
      const text = readFileSync(join(DATA_DIR, file), "utf8");
      // Real PANs are 13–19 digits. Epoch seconds are ≤11 digits and amounts
      // are smaller still, so any 13+ digit run means a leaked identifier.
      const runs = text.match(/\d{13,19}/g);
      expect(runs, `${file} contains digit runs that look like card numbers`).toBeNull();
    }
  });

  it("keeps only receipt-grade fields in the card archive", () => {
    const card = JSON.parse(readFileSync(join(DATA_DIR, "card.json"), "utf8")) as {
      merchants: string[];
      categories: string[];
      cities: string[];
      states: string[];
      rows: unknown[][];
    };
    expect(Object.keys(card).sort()).toEqual(
      ["categories", "cities", "dropped", "merchants", "note", "rows", "schema", "states"],
    );
    for (const row of card.rows) {
      expect(row).toHaveLength(7); // ts, merchant, category, amount, city, state, flagged
      for (const cell of row) expect(typeof cell).not.toBe("object");
    }
  });
});
