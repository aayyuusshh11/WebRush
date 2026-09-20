/**
 * Raw shapes of the prepared JSON archives produced by scripts/prepare-data.mjs.
 * Rows are positional (dictionary-encoded) — see docs/DATA_PIPELINE.md.
 */

export interface PlaysJson {
  artists: string[];
  tracks: string[];
  albums: string[];
  platforms: string[];
  monthly: Record<string, number>;
  topArtistsAllTime: Array<[string, number]>;
  topArtistsByYear: Record<string, Array<[string, number]>>;
  nightShareByYear: Record<string, number>;
  rows: Array<[number, number, number, number, number, number, number]>;
}

export interface CardJson {
  merchants: string[];
  categories: string[];
  cities: string[];
  states: string[];
  rows: Array<[number, number, number, number, number, number, number]>;
}

export interface LedgerJson {
  modes: string[];
  categories: string[];
  subcategories: string[];
  kinds: string[];
  rows: Array<[number, number, number, number, string, number, number]>;
}
