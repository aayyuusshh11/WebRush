# TRACE — Your Life, In Receipts

**A life leaves traces.** 149,860 songs, 9,417 card payments and 2,461 ledger
entries — one fictional decade (2013–2024) of digital life, transformed into an
interactive, evidence-driven story.

TRACE is a **frontend-only** data experience. There is no backend, no database
and no tracking: the archive is prepared once at build time and read entirely
in the browser.

---

## Quick start

```bash
npm install          # dependencies
npm run prepare:data # parse + sanitize the source CSVs → public/data/*.json
npm run dev          # local development
npm run build        # typecheck + production build → dist/
npm run preview      # serve the production build locally
```

The `data/` folder ships with the project; `public/data/` is regenerated from
it and safe to delete.

---

## The experience

The page unfolds in six movements, each answering one question:

| Movement | Question it answers |
| --- | --- |
| **Hero** | Why am I here? — a trace field drawn from real monthly activity |
| **The Record** | What happened? — three archives, one life stream, 2013–2024 |
| **Patterns** | What repeats? — hours, rituals, streaks, night share by year |
| **Chapters** | What story emerges? — six evidence-generated chapters |
| **Archive** | What connects? — search, filter, and *Pull the Thread* |
| **Method** | Can I trust it? — pipeline, privacy, honesty disclosures |

### Pull the Thread (the signature interaction)

Select any receipt — a song, a payment, a ledger entry — and the engine draws
its connections: the **listening session** it belonged to, the **track that
echoed** months later, the **merchant that repeats**, the **purchase that
happened the same day**. Every link carries its reason in plain language, and
each link is itself pullable, so a thread can be followed across years.

### Chapters, not charts

Chapters are generated at runtime, only when the evidence clears a threshold:

- **The Ledger Years** — the handwritten era, 2015–2018
- **The Night Shift** — 38% of plays happen after midnight
- **The Repeat** — one artist, 13,621 times since 2013
- **The Convergence** — from 2022, music and money share days
- **The Rituals** — milk ×162, recharges ×66: the rhythm of small costs
- **Where the Money Went** — the shape of a decade of spending

No evidence, no chapter. Every figure shown is computed from the data, in the
browser, at load time.

---

## Data & privacy

Source datasets (in `data/`):

| File | Rows | Era |
| --- | --- | --- |
| `spotify_history.csv` | 149,860 plays | 2013–2024 |
| `Augmented_IndiaTransactMultiFacet2024.csv` | 9,417 usable transactions | 2022–2024 |
| `Daily Household Transactions.csv` | 2,461 entries | 2015–2018 |

**Sanitization.** The transaction file contains personal fields — card numbers,
names, addresses, dates of birth, jobs, customer ids, raw coordinates. All are
stripped in `scripts/prepare-data.mjs` and never leave the build. The browser
only ever receives merchant, category, amount, city and state.

**Honest coverage.** Detail-level listening rows exist from 2022 onward;
earlier years appear as monthly aggregates rather than invented rows. 850
transactions shipped without dates and are counted as lost, not fabricated.
No photos, messages, or notes existed in the data, so none were invented.

---

## Architecture

```
data/*.csv ──prepare-data.mjs──▶ public/data/*.json (dictionary-encoded)
                                       │
                     fetch + decode ──▶ LifeReceipt[]  (normalized model)
                                       │
        ┌──────────────────────────────┼──────────────────┐
   engine/patterns.ts          engine/connections.ts   engine/chapters.ts
   hours · streaks · rituals   scored thread links     evidence-gated stories
        └──────────────────────────────┴──────────────────┘
                                       │
                              React components (UI only)
```

- **`src/engine/`** — pure functions: normalization, sessions (≤35 min gap),
  patterns, connections, chapters. No React, fully testable.
- **`src/data/dataset.ts`** — single fetch + decode + index pass, shared app-wide.
- **`src/components/`** — presentation only; all analysis happens in the engine.
- **Performance** — ~49k receipts decode in one pass; the archive list renders
  60 rows per page; dense visuals are canvas; everything else is memoized.

## Stack

React 18 · TypeScript (strict) · Vite 6 · Tailwind CSS 4 · Framer Motion ·
Lucide · Instrument Serif + Inter. No backend, no database, no analytics.

## Accessibility

Semantic landmarks and headings · visible focus rings · `aria-pressed` filter
state · `prefers-reduced-motion` honored (canvas drift and reveals stop) ·
screen-reader equivalents for every canvas · Escape closes the drawer ·
keyboard-operable throughout.

## Deployment

`npm run build` produces a static `dist/` (relative asset paths) deployable to
any static host — Netlify, Vercel, GitHub Pages, or a plain file server.
