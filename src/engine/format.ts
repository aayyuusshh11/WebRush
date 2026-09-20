const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

const pad2 = (n: number) => String(n).padStart(2, "0");

/** "02:14 AM" — timestamps are shown exactly as recorded (UTC). */
export function fmtTime(ts: number): string {
  const d = new Date(ts * 1000);
  const h = d.getUTCHours();
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${pad2(h12)}:${pad2(d.getUTCMinutes())} ${suffix}`;
}

/** "14 NOV 2023" */
export function fmtDate(ts: number): string {
  const d = new Date(ts * 1000);
  return `${pad2(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "TUESDAY · 14 NOVEMBER 2023" */
export function fmtDayLong(ts: number): string {
  const d = new Date(ts * 1000);
  const monthsFull = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
  return `${DAYS[d.getUTCDay()]} · ${pad2(d.getUTCDate())} ${monthsFull[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "14 NOV" (short, for dense rows) */
export function fmtDateShort(ts: number): string {
  const d = new Date(ts * 1000);
  return `${pad2(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]}`;
}

export function fmtMonthKey(key: string): string {
  const [y, m] = key.split("-");
  return `${MONTHS[+m - 1]} ${y}`;
}

/** ₹12,340 — whole rupees, Indian grouping not required; keep simple western grouping. */
export function fmtAmount(rupees: number): string {
  return `₹${Math.round(rupees).toLocaleString("en-IN")}`;
}

/** "3 MIN" / "1 HR 12 MIN" */
export function fmtDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 60) return `${totalMin} MIN`;
  return `${Math.floor(totalMin / 60)} HR ${pad2(totalMin % 60)} MIN`;
}

/** Human gap between two epoch timestamps: "18 MINUTES APART", "2 DAYS APART". */
export function fmtGap(a: number, b: number): string {
  const d = Math.abs(a - b);
  if (d < 60) return "UNDER A MINUTE APART";
  if (d < 3600) return `${Math.round(d / 60)} MINUTES APART`;
  if (d < 86400) return `${Math.round(d / 3600)} HOURS APART`;
  const days = Math.round(d / 86400);
  return days === 1 ? "1 DAY APART" : `${days} DAYS APART`;
}

export function fmtCount(n: number): string {
  return n.toLocaleString("en-US");
}
