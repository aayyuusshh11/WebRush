# Security & Data Sanitization

Frontend-only, so the attack surface is small: shipped JSON, no user input
persistence, no backend. The rules below keep it that way.

## Sanitization at build time

`scripts/prepare-data.mjs` strips all identity fields from the transaction
source before anything is written to `public/data/`:

```
cc_num · names · gender · street · dob · job · customer_id · raw coordinates
```

The browser receives only receipt-grade fields: merchant, category, amount,
city, state, timestamp, fraud flag. Merchant names ship with a synthetic
`fraud_` prefix that is also stripped.

## Defense in depth at runtime

- **Decode guards** (`src/data/decode.ts`): every row is shape-checked
  (`numericRow`, dictionary `dict()` lookups). Malformed data degrades to
  fewer receipts — it cannot crash the app or inject unexpected fields.
- **Payload check** (`fetchJson`): a non-object archive is rejected with a
  readable error before any component renders it.
- **ErrorBoundary**: a runtime failure renders an isolated fallback, never a
  blank page.

## Rendering guarantees

- No `dangerouslySetInnerHTML` anywhere in the codebase — React's escaping is
  the only rendering path, so archive strings (artist, merchant, note) are
  inert text.
- No `eval`, no dynamic script injection, no external requests at runtime
  beyond Google Fonts stylesheets.

## Verification

`src/security/__tests__/sanitization.test.ts` hard-gates the shipped JSON:

1. no personal-identifier keys (`cc_num`, `dob`, `street`, `customer_id`, …);
2. no card-number-length digit runs (13–19 digits) anywhere in the payloads;
3. exact field inventory per archive — nothing beyond the documented schema
   (a `dropped` count and a `note` are the only extras).

Any regression fails `npm test` before it can ship. The raw source CSVs stay
in the repository for judging but are never copied into `dist/`; the deployed
artifact contains only the sanitized JSON.

## Privacy assumptions

The datasets are fictional hackathon data. Sanitization exists so the pipeline
would be safe for real data too: nothing that could identify a person reaches
the browser, and no analytics or trackers observe the reader.
