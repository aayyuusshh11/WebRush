/**
 * The normalized model every raw source decodes into.
 * The UI never sees CSV columns — only LifeReceipt artifacts.
 */

export type ReceiptType = "music" | "purchase" | "expense" | "income" | "transfer";

export type SourceId = "spotify" | "card" | "ledger";

export interface LifeReceipt {
  /** Stable id, e.g. "m-004183". */
  id: string;
  type: ReceiptType;
  source: SourceId;
  /** Epoch seconds, UTC (naive source timestamps encoded as UTC for determinism). */
  ts: number;
  /** Primary artifact line — track name, merchant, or note. */
  title: string;
  /** Secondary line — artist, or place. */
  subtitle?: string;
  album?: string;
  category?: string;
  subcategory?: string;
  city?: string;
  state?: string;
  /** INR, whole rupees. */
  amount?: number;
  msPlayed?: number;
  skipped?: boolean;
  shuffle?: boolean;
  platform?: string;
  flagged?: boolean;
  /** Listening-session membership (music only). */
  sessionId?: number;
  /** Derived time keys — precomputed once at decode. */
  hour: number;
  dow: number;
  dayKey: string;
  monthKey: string;
}

export interface ListeningSession {
  id: number;
  start: number;
  end: number;
  receiptIds: string[];
  artists: string[];
  dominantArtist?: string;
  tracks: number;
  skipped: number;
  /** Starts between 00:00–05:59. */
  lateNight: boolean;
}

/** A typed, scored, explainable relationship between two receipts. */
export type ConnectionType =
  | "temporal"
  | "session"
  | "recurrence"
  | "location"
  | "category";

/**
 * How directly two receipts are related. Strength is the UI vocabulary:
 * a "session" link must never render with the same weight as a
 * "contextual" one. Label text lives in components/receiptMeta.
 */
export type ConnectionStrength = "session" | "temporal" | "recurring" | "contextual";

export interface ThreadLink {
  receipt: LifeReceipt;
  type: ConnectionType;
  strength: ConnectionStrength;
  /**
   * 0–1000, higher = stronger. Type weight × temporal proximity, ranked
   * deterministically: score desc, then time gap asc, then receipt id.
   */
  score: number;
  /** Human, observational explanation — always shown next to the link. */
  reason: string;
}

export interface EvidenceRow {
  label: string;
  value: string;
}

/**
 * A discovery: one evidence-backed observation the reader might have
 * missed. Generated only when the data clears a threshold — never authored.
 */
export interface Discovery {
  id: string;
  numeral: string;
  title: string;
  /** One-sentence factual summary — what the archive shows. */
  lead: string;
  evidence: EvidenceRow[];
  /** Representative receipts the reader can pull the thread from. */
  receiptIds: string[];
  /** Optional archive deep-link. */
  archiveFocus?: { dayKey?: string; types?: ReceiptType[]; query?: string };
}

export interface Chapter {
  id: string;
  numeral: string;
  title: string;
  /** Observational summary — what the data shows, no psychology. */
  observation: string[];
  evidence: EvidenceRow[];
  /** Representative receipts the reader can pull the thread from. */
  receiptIds: string[];
  /** Optional archive deep-link (e.g. focus one day). */
  archiveFocus?: { dayKey?: string; types?: ReceiptType[]; query?: string };
}

export interface ArchiveMeta {
  /** Month ("2013-07") → per-source counts. */
  monthly: Map<string, { music: number; purchase: number; ledger: number }>;
  musicPlays: number;
  purchases: number;
  ledgerEntries: number;
  firstTs: number;
  lastTs: number;
  topArtistsAllTime: Array<[string, number]>;
  topArtistsByYear: Record<string, Array<[string, number]>>;
  nightShareByYear: Record<string, number>;
}
