# Architecture

Frontend-only React + TypeScript + Vite application. No backend, no database,
no authentication, no analytics: the archive is prepared once at build time and
read entirely in the browser.

```
data/*.csv ──scripts/prepare-data.mjs──▶ public/data/*.json
                                              │
              src/data/dataset.ts (fetch → decode → index → cache)
                                              │
        ┌─────────────────────┬───────────────┴──────────────┐
   src/engine/*          src/hooks/*                   src/components/*
   pure analysis    loading / navigation / spy      presentation only
```

## Layer rules

| Layer | Responsibility | May import |
| --- | --- | --- |
| `src/data/` | fetch, decode, index raw archives | `src/engine/types` |
| `src/engine/` | pure analysis: patterns, connections, discoveries, chapters, formatting | `src/data` (types only) |
| `src/hooks/` | React state for loading, navigation, scroll-spy | `src/data`, `src/engine` |
| `src/components/` | presentation only; no analysis logic | all layers |

Nothing in `engine/` imports React. Every analysis function is pure and
deterministic, which is what makes the engine testable without a DOM.

## Module responsibilities

- **`src/data/raw.ts`** — TypeScript shapes of the prepared JSON archives.
- **`src/data/decode.ts`** — defensive decoders: raw rows → `LifeReceipt[]`.
  Malformed rows are skipped; valid data is unaffected.
- **`src/data/indexing.ts`** — `assembleArchive()`: one sort + one pass builds
  every lookup the app needs (by id, by day, sessions, track/merchant/ledger
  indexes, city+month and category+month indexes).
- **`src/data/dataset.ts`** — fetch facade + `loadArchive()` (memoized once per
  page load). Re-exports the stable public API for all existing importers.
- **`src/engine/`** — see [DATA_PIPELINE.md](./DATA_PIPELINE.md) for how data
  reaches it, and below for what each module computes.
- **`src/hooks/`** — `useArchive` (load state), `useArchiveNavigation` (drawer
  + archive deep-links), `useScrollSpy` (active-section + `aria-current`).
- **`src/App.tsx`** — orchestration only: hooks + rendering. No business logic.

## Analysis pipeline (runtime)

```
Archive → buildPatterns()   → Patterns  (hours, streaks, rituals, spending)
        → buildDiscoveries()→ Discovery[] (evidence-gated observations)
        → buildChapters()   → Chapter[]  (evidence-gated story movements)
        → getThread()       → ThreadLink[] (strength-graded connections)
```

All four engines are pure: same archive in, same result out, every load.

## Performance decisions

- ~49k receipts decode and index in one pass at startup; engines reuse the
  precomputed indexes instead of rescanning.
- Search uses a precomputed lowercase index; archive filtering + counting is a
  single traversal; rows are memoized so pagination stays cheap.
- Dense visuals are canvas (DPR-capped), the archive paginates at 60 rows, and
  the hero animation pauses when offscreen.

See [TESTING.md](./TESTING.md) for how this is verified and
[SECURITY.md](./SECURITY.md) for the sanitization guarantees.
