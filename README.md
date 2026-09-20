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
npm run test         # 71 engine, component, integration and security tests (vitest)
```

The `data/` folder ships with the project; `public/data/` is regenerated from
it and safe to delete.

---

## The experience

The page unfolds in seven movements, each answering one question:

| Movement | Question it answers |
| --- | --- |
| **Hero** | Why am I here? — a trace field drawn from real monthly activity |
| **The Record** | What happened? — three archives, one life stream, 2013–2024 |
| **Discoveries** | What might I have missed? — generated, evidence-backed observations |
| **Patterns** | What repeats? — hours, rituals, streaks, night share by year |
| **Chapters** | What story emerges? — six evidence-generated chapters |
| **Archive** | What connects? — search, filter, and *Pull the Thread* |
| **Method** | Can I trust it? — pipeline, privacy, honesty disclosures |

### Pull the Thread (the signature interaction)

Select any receipt — a song, a payment, a ledger entry — and the engine draws
its connections, **ranked by graded strength**: same listening session first,
then same-day temporal links, then exact-entity repeats (track, merchant,
item), then weaker contextual links (same city that month, same kind of
purchase). Every link carries its strength label — Session · Temporal ·
Recurring · Contextual — and its evidence in plain language ("same day · 11
min apart"). Each connection is itself pullable: the reader follows the thread
to a new focus, and a back stack always offers the way home. Fully
keyboard-operable (Tab, Enter, Arrow keys, Escape).

### Discoveries — things you might have missed

A generated layer between the Record and the Patterns: the densest late-night
overlap day, the track spanning the most distinct days, the most repeated
ledger item, the most-visited merchant, the longest after-midnight session.
Each discovery exists only if the evidence clears a threshold, shows its
evidence inline, and links straight into the thread or a filtered archive.
Nothing is authored; if the data is silent, the card does not exist.

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
  strength-graded connections, patterns, discoveries, chapters. No React,
  fully testable.
- **`src/data/dataset.ts`** — single fetch + decode + index pass, shared app-wide.
- **`src/components/`** — presentation only; all analysis happens in the engine.
- **Performance** — ~49k receipts decode in one pass; the archive list renders
  60 rows per page; search runs against a precomputed lowercase index (built
  once per load) and filtering + counting happen in a single traversal; dense
  visuals are canvas; everything else is memoized. The hero animation pauses
  when scrolled offscreen; the thread engine reads precomputed indexes instead
  of scanning the archive.

## Verification

The project ships with a test suite (`npm run test`, vitest + Testing
Library):

- **Engine tests** — session grouping (35-minute rule), thread ranking
  (strength ordering, proximity penalties, determinism, self-link ban,
  9-link cap), pattern math (streaks, rituals, spending), discovery gating
  and evidence math, and chapter evidence gating: *no evidence, no chapter —
  no evidence, no discovery* is enforced by tests, not just prose.
- **Component tests** — the archive (search, filters, dated era windows, day
  navigation, pagination, selection, empty states), the thread explorer
  (ranking order, strength labels, keyboard arrows), the receipt drawer
  (dialog semantics, focus trap, focus restore, Escape, back stack),
  chapters, discoveries, patterns, life stream, and navigation.
- **Integration test** — the full core flow: load → search → open receipt →
  pull the thread → follow a connection → inspect → go back → close.
- **Security tests** — a hard gate over `public/data/*.json`: no PII keys
  (`cc_num`, names, addresses, dob, coordinates…), no card-number-length digit
  runs, and no unexpected fields in the shipped archives. If sanitization ever
  regresses, the suite fails before anything ships.

## Stack

React 18 · TypeScript (strict) · Vite 6 · Tailwind CSS 4 · Framer Motion ·
Lucide · Instrument Serif + Inter. No backend, no database, no analytics.

## Accessibility

Semantic landmarks and headings · skip link to the main content · visible focus
rings · `aria-pressed` filter state · `aria-current` scroll-spy on the nav ·
`aria-expanded`/`aria-controls` accordions · modal drawer traps focus, labels
itself with `role="dialog" aria-modal`, and returns focus on close ·
thread nodes operable by keyboard (Tab / Enter / ArrowUp / ArrowDown / Escape)
with visible focus rings · `prefers-reduced-motion` honored (canvas drift and
reveals stop) · every canvas visualization ships a semantic alternative — the
life stream is a full month-by-month data table, the hour histograms are
hour-by-hour lists, not just labels · Escape closes the drawer ·
keyboard-operable throughout.

## Deployment

`npm run build` produces a static `dist/` (relative asset paths) deployable to
any static host — Netlify, Vercel, GitHub Pages, or a plain file server.
