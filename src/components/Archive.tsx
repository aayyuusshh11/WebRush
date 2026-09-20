import { useCallback, useMemo, useRef, useState } from "react";
import SectionHeader from "./SectionHeader";
import ReceiptRow from "./ReceiptRow";
import ThreadPanel from "./ThreadPanel";
import type { Archive } from "../data/dataset";
import type { LifeReceipt, ReceiptType } from "../engine/types";
import { fmtCount, fmtDateShort, fmtDayLong } from "../engine/format";

/* ------------------------------------------------------------------ */
/* archive                                                             */
/* ------------------------------------------------------------------ */

type EraFilter = "all" | "ledger" | "detail";
type TypeFilter = "all" | ReceiptType;

interface Props {
  archive: Archive;
  focus: { dayKey?: string; types?: ReceiptType[]; query?: string; nonce: number } | null;
  onOpenReceipt: (id: string) => void;
}

const PAGE = 60;

export default function ArchiveView({ archive, focus, onOpenReceipt }: Props) {
  const [era, setEra] = useState<EraFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [query, setQuery] = useState("");
  const [dayKey, setDayKey] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<LifeReceipt | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Apply chapter deep-links when they arrive (state adjustment during render).
  const appliedFocus = useRef(0);
  if (focus && focus.nonce !== appliedFocus.current) {
    appliedFocus.current = focus.nonce;
    if (focus.dayKey) setDayKey(focus.dayKey);
    if (focus.types && focus.types.length > 0) setType(focus.types[0]);
    if (focus.query !== undefined) setQuery(focus.query);
    if (focus.dayKey || focus.types || focus.query) setEra("all");
    setLimit(PAGE);
  }

  const days = useMemo(() => [...archive.byDay.keys()].sort().reverse(), [archive]);

  // Search index: normalize each receipt's searchable text exactly once per
  // archive load instead of rebuilding haystack strings on every keystroke.
  const searchIndex = useMemo(() => {
    const index = new Map<string, string>();
    for (const r of archive.receipts) {
      index.set(
        r.id,
        `${r.title} ${r.subtitle ?? ""} ${r.category ?? ""} ${r.subcategory ?? ""} ${r.city ?? ""} ${r.album ?? ""}`.toLowerCase(),
      );
    }
    return index;
  }, [archive]);

  // Filter and count in one traversal over the archive.
  const { filtered, counts } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const eraStart = era === "ledger" ? 0 : Date.UTC(2022, 0, 1) / 1000;
    const eraEnd = era === "ledger" ? Date.UTC(2019, 0, 1) / 1000 : Infinity;
    const c = { music: 0, purchase: 0, expense: 0, income: 0, transfer: 0 };
    const out: LifeReceipt[] = [];
    for (const r of archive.receipts) {
      if (era === "ledger" && (r.ts < eraStart || r.ts >= eraEnd)) continue;
      if (type !== "all" && r.type !== type) continue;
      if (dayKey && r.dayKey !== dayKey) continue;
      if (q && !(searchIndex.get(r.id) ?? "").includes(q)) continue;
      out.push(r);
      c[r.type]++;
    }
    return { filtered: out, counts: c };
  }, [archive, era, type, query, dayKey, searchIndex]);

  const visible = filtered.slice(0, limit);

  // Stable callback so memoized rows do not re-render on unrelated renders.
  const handleOpen = useCallback(
    (rcpt: LifeReceipt) => {
      setSelected(rcpt);
      onOpenReceipt(rcpt.id);
    },
    [onOpenReceipt],
  );

  const pickDay = (key: string | null) => {
    setDayKey(key);
    setLimit(PAGE);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section id="archive" aria-labelledby="archive-title" className="scroll-mt-16 border-t border-line bg-surface/40 py-24 sm:py-32">
      <SectionHeader
        eyebrow="Archive"
        title={<span id="archive-title">Read every receipt.</span>}
        lede="Search by artist, merchant, item, city or category. Filter by kind and coverage window, jump to a day, and pull any thread you find."
      />

      <div ref={topRef} className="mx-auto mt-12 w-full max-w-6xl px-5 sm:px-8">
        {/* controls */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div
            role="search"
            className="flex items-center gap-3 border border-line bg-ink px-4 py-3 lg:w-96"
          >
            <span aria-hidden className="text-mute">⌕</span>
            <label htmlFor="archive-search" className="sr-only">
              Search the traces
            </label>
            <input
              id="archive-search"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }}
              placeholder="the beatles, swiggy, milk…"
              className="w-full bg-transparent text-sm text-paper placeholder:text-mute focus:outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="text-mute transition-colors hover:text-paper"
              >
                ×
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(["all", "ledger", "detail"] as const).map((e) => (
              <button
                key={e}
                onClick={() => { setEra(e); setDayKey(null); setLimit(PAGE); }}
                aria-pressed={era === e}
                className={`border px-3.5 py-2 text-[11px] uppercase tracking-[0.16em] transition-colors ${
                  era === e
                    ? "border-accent text-accent"
                    : "border-line text-mute hover:border-faded hover:text-faded"
                }`}
              >
                {e === "all" ? "All years" : e === "ledger" ? "Ledger · 2015–2018" : "Detail · 2022–2024"}
              </button>
            ))}
            <span aria-hidden className="mx-1 hidden h-4 w-px bg-line sm:block" />
            {(
              [
                ["all", "All"],
                ["music", "Music"],
                ["purchase", "Purchases"],
                ["expense", "Expenses"],
                ["income", "Income"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => { setType(value); setLimit(PAGE); }}
                aria-pressed={type === value}
                className={`border px-3.5 py-2 text-[11px] uppercase tracking-[0.16em] transition-colors ${
                  type === value
                    ? "border-accent text-accent"
                    : "border-line text-mute hover:border-faded hover:text-faded"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* day navigation */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button
            onClick={() => pickDay(null)}
            aria-pressed={dayKey === null}
            className={`border px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] transition-colors ${
              dayKey === null ? "border-accent text-accent" : "border-line text-mute hover:text-faded"
            }`}
          >
            Every day
          </button>
          <div className="flex max-w-full flex-wrap gap-1.5">
            {days.slice(0, 14).map((key) => {
              const d = new Date(`${key}T00:00:00Z`);
              return (
                <button
                  key={key}
                  onClick={() => pickDay(key)}
                  aria-pressed={dayKey === key}
                  className={`border px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em] transition-colors ${
                    dayKey === key ? "border-accent text-accent" : "border-line text-mute hover:text-faded"
                  }`}
                >
                  {fmtDateShort(d.getTime() / 1000)}
                </button>
              );
            })}
            <span className="self-center px-1 text-[10px] uppercase tracking-[0.14em] text-mute">
              {fmtCount(days.length)} days on record · latest shown
            </span>
          </div>
        </div>

        {/* results */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
              <p className="text-sm text-faded">
                <span className="font-display text-xl italic text-accent">{fmtCount(filtered.length)}</span>{" "}
                receipts match
              </p>
              <p className="text-[11px] uppercase tracking-[0.14em] text-mute">
                {counts.music > 0 && `${fmtCount(counts.music)} music · `}
                {counts.purchase > 0 && `${fmtCount(counts.purchase)} purchases · `}
                {counts.expense + counts.income + counts.transfer > 0 &&
                  `${fmtCount(counts.expense + counts.income + counts.transfer)} ledger`}
              </p>
            </div>

            {dayKey && (
              <p className="mt-5 font-display text-2xl text-paper">
                {fmtDayLong(new Date(`${dayKey}T00:00:00Z`).getTime() / 1000)}
              </p>
            )}

            {filtered.length === 0 ? (
              <p className="mt-10 text-sm text-mute">
                Nothing in the archive matches. Try a different word — or a different era.
              </p>
            ) : (
              <ul className="mt-2">
                {visible.map((r) => (
                  <ReceiptRow
                    key={r.id}
                    r={r}
                    selected={selected?.id === r.id}
                    onOpen={handleOpen}
                  />
                ))}
              </ul>
            )}

            {visible.length < filtered.length && (
              <div className="mt-8 text-center">
                <button
                  onClick={() => setLimit((l) => l + PAGE)}
                  className="border border-line px-6 py-3 text-[11px] uppercase tracking-[0.18em] text-faded transition-colors hover:border-accent hover:text-accent"
                >
                  Show {Math.min(PAGE, filtered.length - visible.length)} more
                </button>
              </div>
            )}
          </div>

          {/* thread panel */}
          <div className="lg:sticky lg:top-20 lg:self-start">
            {selected ? (
              <ThreadPanel
                receipt={selected}
                archive={archive}
                onClose={() => setSelected(null)}
                onOpenReceipt={(id) => {
                  const r = archive.byId.get(id);
                  if (r) setSelected(r);
                }}
              />
            ) : (
              <aside className="border border-line bg-surface-soft/50 p-5">
                <p className="label">Pull the thread</p>
                <p className="mt-4 text-sm leading-relaxed text-faded">
                  Select any receipt and the archive will draw its connections —
                  the session it belonged to, the track that echoed, the merchant
                  that repeats, the payment that happened the same day.
                </p>
                <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-mute">
                  {fmtCount(archive.receipts.length)} receipts · every link explained
                </p>
              </aside>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
