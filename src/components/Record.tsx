import SectionHeader from "./SectionHeader";
import LifeStream from "./LifeStream";
import type { Archive } from "../data/dataset";
import { fmtCount } from "../engine/format";

interface Props {
  archive: Archive;
  onEraJump: (era: "ledger" | "detail") => void;
}

const firstMonthOf = (archive: Archive, source: string) => {
  for (const [key, c] of [...archive.meta.monthly.entries()].sort()) {
    if ((source === "ledger" && c.ledger > 0) || (source === "card" && c.purchase > 0)) return key;
  }
  return "";
};

const lastMonthOf = (archive: Archive, source: string) => {
  for (const [key, c] of [...archive.meta.monthly.entries()].sort().reverse()) {
    if ((source === "ledger" && c.ledger > 0) || (source === "card" && c.purchase > 0)) return key;
  }
  return "";
};

export default function Record({ archive, onEraJump }: Props) {
  const meta = archive.meta;
  const ledgerSpan = `${firstMonthOf(archive, "ledger").replace("-", "/")} — ${lastMonthOf(archive, "ledger").replace("-", "/")}`;
  const cardSpan = `${firstMonthOf(archive, "card").replace("-", "/")} — ${lastMonthOf(archive, "card").replace("-", "/")}`;

  const panels = [
    {
      name: "Streaming archive",
      figure: fmtCount(meta.musicPlays),
      unit: "plays",
      span: "2013 — 2024",
      note: "Track, artist, album, platform, skips. Detail-level rows from 2022.",
      onClick: () => onEraJump("detail"),
      tint: "text-music",
    },
    {
      name: "Card statement",
      figure: fmtCount(meta.purchases),
      unit: "transactions",
      span: cardSpan,
      note: "Merchant, category, amount, city. Personal fields removed.",
      onClick: () => onEraJump("detail"),
      tint: "text-purchase",
    },
    {
      name: "Household ledger",
      figure: fmtCount(meta.ledgerEntries),
      unit: "entries",
      span: ledgerSpan,
      note: "Income and expense, INR, written by hand and by habit.",
      onClick: () => onEraJump("ledger"),
      tint: "text-income",
    },
  ];

  return (
    <section id="record" aria-labelledby="record-title" className="scroll-mt-16 py-24 sm:py-32">
      <SectionHeader
        eyebrow="The record"
        title={
          <span id="record-title">
            Three archives.
            <br />
            <span className="italic text-accent">One decade.</span>
          </span>
        }
        lede="The receipts survived in three separate places: a streaming history, a card statement, and a household ledger. Read alone, each is a log. Read together, they overlap into eras."
      />

      <div className="mx-auto mt-14 w-full max-w-6xl px-5 sm:px-8">
        <div className="rule grid gap-px bg-line sm:grid-cols-3">
          {panels.map((p) => (
            <button
              key={p.name}
              onClick={p.onClick}
              className="group bg-ink p-6 text-left transition-colors hover:bg-surface sm:p-7"
            >
              <p className="label">{p.name}</p>
              <p className={`mt-5 font-display text-4xl sm:text-5xl ${p.tint}`}>
                {p.figure}
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-mute">
                {p.unit} · {p.span}
              </p>
              <p className="mt-4 text-sm leading-relaxed text-faded">{p.note}</p>
              <p className="mt-5 text-[11px] uppercase tracking-[0.18em] text-mute transition-colors group-hover:text-accent">
                Open in archive →
              </p>
            </button>
          ))}
        </div>

        <div className="mt-16">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-2xl text-paper">The life stream</h3>
            <p className="text-[11px] uppercase tracking-[0.16em] text-mute">
              Every column is a month · density is activity
            </p>
          </div>
          <div className="rule mt-5 pt-8">
            <LifeStream meta={meta} />
          </div>
        </div>
      </div>
    </section>
  );
}
