# Data Pipeline

## Build time — `scripts/prepare-data.mjs`

Reads three source CSVs from `data/` and writes sanitized,
dictionary-encoded JSON to `public/data/`:

| Source | Output | Coverage |
| --- | --- | --- |
| `spotify_history.csv` | `plays.json` | monthly aggregates 2013–2021 · per-play rows 2022–2024 |
| `Augmented_IndiaTransactMultiFacet2024.csv` | `card.json` | 9,417 usable transactions, 2022–2024 |
| `Daily Household Transactions.csv` | `ledger.json` | 2,461 entries, 2015–2018 |

The script uses a dependency-free RFC-4180 CSV reader. Rows without valid
dates are counted and dropped (850 card transactions) — never fabricated.
Timestamps are encoded as UTC epoch seconds for determinism.

## Runtime — decode → index → analyze

1. **Decode** (`src/data/decode.ts`): each positional row becomes one typed
   `LifeReceipt`. Defensive guards skip malformed rows and dictionary misses.
2. **Index** (`src/data/indexing.ts`): `assembleArchive()` sorts once and
   builds every lookup map (id, day, sessions, track, merchant, ledger item,
   city+month, category+month).
3. **Analyze** (`src/engine/`): pure engines compute the story layer.

## Engine algorithms

- **Sessions** (`indexing.ts`): consecutive plays ≤ 35 minutes apart share a
  listening session; the session tracks dominant artist, skip count, and
  late-night start.
- **Connections** (`connections.ts`): every link = class weight
  (session 500 / temporal 400 / recurrence 300 / location 200 / category 100)
  minus a proximity penalty, ranked deterministically (score → time gap → id)
  and labeled Session / Temporal / Recurring / Contextual. Capped at 9 links.
- **Patterns** (`patterns.ts`): hour histograms, streaks, rituals (ledger
  items ≥ 20 occurrences), spending by category, convergence days.
- **Discoveries** (`discoveries.ts`): five observation types, each gated on a
  threshold (e.g. a day needs ≥ 3 plays **and** ≥ 1 purchase, both after
  midnight, to become the late-night overlap).
- **Chapters** (`chapters.ts`): six story movements, each gated the same way —
  *no evidence, no chapter*. Every number shown is computed from the archive.

## Honest coverage

The UI labels aggregation boundaries explicitly: "Ledger · 2015–2018",
"Detail · 2022–2024", "Monthly aggregates 2013–2021". Pre-2022 listening
exists only as monthly aggregates and is never presented as per-play detail.
