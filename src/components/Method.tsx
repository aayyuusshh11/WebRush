import SectionHeader from "./SectionHeader";

const PIPELINE = [
  ["Source files", "Two CSVs and a ledger, exactly as supplied"],
  ["Parser", "RFC-4180 reader, no external dependencies"],
  ["Normalizer", "Every row becomes one typed LifeReceipt"],
  ["Sanitizer", "Identity fields removed before anything ships"],
  ["Derived metrics", "Sessions, streaks, rituals, era statistics"],
  ["Relationship engine", "Scored, explainable, deterministic links"],
  ["Story engine", "Chapters generated only when evidence clears a threshold"],
];

const REMOVED = [
  "card numbers",
  "full names",
  "street addresses",
  "dates of birth",
  "customer ids",
  "raw coordinates",
];

export default function Method() {
  return (
    <section id="method" aria-labelledby="method-title" className="scroll-mt-16 border-t border-line py-24 sm:py-32">
      <SectionHeader
        eyebrow="Method"
        title={<span id="method-title">How this was built.</span>}
        lede="A frontend-only experience: no server, no database, no tracking. The archive is prepared once at build time and read entirely in your browser."
      />

      <div className="mx-auto mt-14 grid w-full max-w-6xl gap-14 px-5 sm:px-8 lg:grid-cols-2 lg:gap-x-16">
        <div>
          <h3 className="label">The pipeline</h3>
          <ol className="mt-6 space-y-0">
            {PIPELINE.map(([step, note], i) => (
              <li key={step} className="grid grid-cols-[36px_1fr] gap-4 border-b border-line/60 py-4">
                <span className="font-display text-xl italic text-mute">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="text-sm text-paper">{step}</p>
                  <p className="mt-1 text-xs leading-relaxed text-mute">{note}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="space-y-10">
          <div>
            <h3 className="label">Privacy</h3>
            <p className="mt-4 text-sm leading-relaxed text-faded">
              The transaction file contains personal fields. They are stripped
              during preparation and never reach the browser. The interface only
              ever sees what a receipt needs:
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {REMOVED.map((item) => (
                <li
                  key={item}
                  className="border border-line px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-mute line-through decoration-expense/70"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="label">Evidence, not inference</h3>
            <p className="mt-4 text-sm leading-relaxed text-faded">
              Every claim in this experience is a count, a share, a gap, or a
              repeat measured in the data. Chapters carry their evidence beside
              them. Threads explain each link. Where the data is silent — about
              motive, mood, or meaning — the interface stays silent too.
            </p>
          </div>

          <div>
            <h3 className="label">Honest coverage</h3>
            <p className="mt-4 text-sm leading-relaxed text-faded">
              Detail-level listening rows exist from 2022 onward; earlier years
              are shown as monthly aggregates rather than invented rows. Some
              transactions shipped without dates — they are counted as lost, not
              fabricated. Timestamps are shown as recorded.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line py-10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-baseline justify-between gap-4 px-5 sm:px-8">
        <p className="font-display text-lg text-paper">
          TRACE <span className="italic text-mute">— your life, in receipts</span>
        </p>
        <p className="text-[11px] uppercase tracking-[0.16em] text-mute">
          Frontend-only · data processed locally · no trackers
        </p>
      </div>
    </footer>
  );
}
