# Testing & Deployment

## Stack

Vitest + jsdom + Testing Library. No other test dependencies.

```bash
npm run typecheck   # tsc --noEmit (strict)
npm test            # vitest run
npm run build       # typecheck + vite build → dist/
npm run preview     # serve the production build locally
```

## Strategy — 79 tests across four levels

| Level | Location | What it proves |
| --- | --- | --- |
| Engine units | `src/engine/__tests__/` | session grouping (35-min rule), thread ranking (strength order, proximity penalties, determinism, caps), pattern math, discovery + chapter **evidence gating**, formatting |
| Data resilience | `src/engine/__tests__/datasetResilience.test.ts` | malformed rows, missing dictionaries, dictionary misses and non-object payloads degrade gracefully — the app never crashes on bad data |
| Security gate | `src/security/__tests__/` | shipped JSON contains no PII keys, no card-number-length digit runs, and nothing beyond the documented schema |
| Components | `src/components/__tests__/` | archive (search, filters, dated eras, day nav, pagination, selection, empty states), thread explorer (ranking, strength labels, arrow-key navigation), receipt drawer (dialog semantics, focus trap, focus restore, Escape, back stack), chapters, discoveries, patterns, life stream, nav |
| Integration | `src/__tests__/integration.test.tsx` | the full core flow: load → search → open receipt → pull the thread → follow a connection → inspect → back → close |

jsdom lacks `IntersectionObserver`/`ResizeObserver`; `vitest.setup.ts` stubs
them and neutralizes `scrollIntoView`.

## Principles

- Tests verify **behavior**, not implementation details (roles, labels, text).
- Evidence gating is enforced by tests: *no evidence, no chapter — no
  evidence, no discovery* is a tested invariant, not prose.
- Fixtures build archives through the real `assembleArchive()` pipeline, so
  tests exercise the production indexing path.

## Build & deployment

`npm run build` emits a static `dist/` with relative asset paths (`base:
"./"`), deployable to any static host (Netlify, Vercel, GitHub Pages, plain
file server). `public/data/*.json` ships inside `dist/`; the raw `data/*.csv`
sources do not. Runtime needs no server — everything is computed in the
browser from the shipped archive.
