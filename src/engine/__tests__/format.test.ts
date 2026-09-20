import { describe, expect, it } from "vitest";
import {
  fmtAmount,
  fmtCount,
  fmtDate,
  fmtDayLong,
  fmtDuration,
  fmtGap,
  fmtMonthKey,
  fmtTime,
} from "../format";
import { at } from "./fixtures";

describe("fmtTime", () => {
  it("formats midnight and noon correctly", () => {
    expect(fmtTime(at(2023, 11, 14, 0, 7))).toBe("12:07 AM");
    expect(fmtTime(at(2023, 11, 14, 12, 0))).toBe("12:00 PM");
    expect(fmtTime(at(2023, 11, 14, 13, 5))).toBe("01:05 PM");
    expect(fmtTime(at(2023, 11, 14, 23, 59))).toBe("11:59 PM");
  });
});

describe("fmtDate / fmtDayLong / fmtMonthKey", () => {
  it("formats archive dates", () => {
    expect(fmtDate(at(2023, 11, 14))).toBe("14 NOV 2023");
    expect(fmtDayLong(at(2023, 11, 14))).toBe("TUESDAY · 14 NOVEMBER 2023");
    expect(fmtMonthKey("2013-07")).toBe("JUL 2013");
  });
});

describe("fmtDuration", () => {
  it("renders minutes and hours", () => {
    expect(fmtDuration(0)).toBe("0 MIN");
    expect(fmtDuration(3 * 60_000)).toBe("3 MIN");
    expect(fmtDuration(72 * 60_000)).toBe("1 HR 12 MIN");
  });
});

describe("fmtGap", () => {
  it("describes human gaps", () => {
    const t = at(2023, 1, 1, 12);
    expect(fmtGap(t, t + 30)).toBe("UNDER A MINUTE APART");
    expect(fmtGap(t, t + 18 * 60)).toBe("18 MINUTES APART");
    expect(fmtGap(t, t + 3 * 3600)).toBe("3 HOURS APART");
    expect(fmtGap(t, t + 86400)).toBe("1 DAY APART");
    expect(fmtGap(t, t + 5 * 86400)).toBe("5 DAYS APART");
    // Symmetric — order does not matter.
    expect(fmtGap(t, t - 18 * 60)).toBe("18 MINUTES APART");
  });
});

describe("fmtAmount / fmtCount", () => {
  it("formats rupees and counts", () => {
    expect(fmtAmount(12340.4)).toBe("₹12,340");
    expect(fmtAmount(0)).toBe("₹0");
    expect(fmtCount(13621)).toBe("13,621");
  });
});
