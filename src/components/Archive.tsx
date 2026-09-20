import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import SectionHeader from "./SectionHeader";
import type { Archive } from "../data/dataset";
import type { LifeReceipt, ReceiptType } from "../engine/types";
import type { ThreadLink } from "../engine/types";
import { getThread } from "../engine/connections";
import { fmtAmount, fmtCount, fmtDate, fmtDateShort, fmtDayLong, fmtDuration, fmtTime } from "../engine/format";

/* ------------------------------------------------------------------ */
/* receipt row                                                         */
/* ------------------------------------------------------------------ */

const TYPE_COLOR: Record<ReceiptType, string> = {
  music: "text-music",
  purchase: "text-purchase",
  expense: "text-expense",
  income: "text-income",
  transfer: "text-transfer",
};

function ReceiptRow({
  r,
  onOpen,
  selected,
}: {
  r: LifeReceipt;
  onOpen: (r: LifeReceipt) => void;
  selected: boolean;
}) {
  const secondary =
    r.source === "spotify"
      ? r.subtitle
      : r.source === "card"
        ? [r.city, r.state].filter(Boolean).join(", ")
        : r.subtitle;

  return (
    <li>
      <button
        onClick={() => onOpen(r)}
        aria-pressed={selected}
        className={`group grid w-full grid-cols-[74px_1fr_auto] items-baseline gap-3 border-b border-line/60 px-2 py-3 text-left transition-colors hover:bg-surface ${
          selected ? "bg-surface" : ""
        }`}
      >
        <span className="text-[10px] uppercase tracking-[0.14em] text-mute tabular-nums">
          {fmtTime(r.ts)}
        </span>
        <span className="min-w-0">
          <span className={`block truncate text-sm ${TYPE_COLOR[r.type]}`}>
            {r.title}
          </span>
          {secondary && (
            <span className="block truncate text-xs text-mute">
              {secondary}
              {r.category ? ` · ${r.category}` : ""}
            </span>
          )}
        </span>
        <span className="text-right text-[11px] tabular-nums text-mute">
          {r.source === "spotify"
            ? r.skipped
              ? "skipped"
              : fmtDuration(r.msPlayed ?? 0)
            : r.amount !== undefined
              ? `${r.type === "income" ? "+" : "−"}${fmtAmount(r.amount)}`
              : ""}
        </span>
      </button>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* thread panel                                                        */
/* ------------------------------------------------------------------ */

const THREAD_STYLE: Record<ThreadLink["type"], { label: string; className: string }> = {
  temporal: { label: "same day", className: "text-paper" },
  session: { label: "session", className: "text-music" },
  recurrence: { label: "repeats", className: "text-accent" },
  location: { label: "same place", className: "text-purchase" },
  category: { label: "same kind", className: "text-income" },
};

function ThreadPanel({
  receipt,
  archive,
  onClose,
  onOpenReceipt,
}: {
  receipt: LifeReceipt;
  archive: Archive;
  onClose: () => void;
  onOpenReceipt: (id: string) => void;
}) {
  const links = useMemo(() => getThread(archive, receipt), [archive, receipt]);
  const session = receipt.sessionId !== undefined ? archive.sessionById.get(receipt.sessionId) : undefined;

  return (
    <AnimatePresence>
      <motion.aside
        key="thread"
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 24 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        aria-label="Connected receipts"
        className="border border-accent/40 bg-surface-soft p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="label text-accent">The thread</p>
          <button
            onClick={onClose}
            className="text-[11px] uppercase tracking-[0.16em] text-mute transition-colors hover:text-paper"
          >
            Close
          </button>
        </div>

        <div className="mt-4 border-l-2 border-accent/60 pl-4">
          <p className={`text-sm ${TYPE_COLOR[receipt.type]}`}>{receipt.title}</p>
          <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-mute">
            {fmtTime(receipt.ts)} · {fmtDate(receipt.ts)}
          </p>
        </div>

        {session && receipt.source === "spotify" && (
          <p className="mt-4 text-xs leading-relaxed text-faded">
            Belongs to a listening session — {session.tracks} tracks,{" "}
            {session.artists.length} artists
            {session.dominantArtist ? `, circling ${session.dominantArtist}` : ""}.
            {session.lateNight && " It began after midnight."}
          </p>
        )}

        <p className="mt-5 label">
          {links.length > 0 ? `${links.length} connections` : "No strong connections"}
        </p>

        {links.length === 0 ? (
          <p className="mt-3 text-xs leading-relaxed text-mute">
            Nothing in the archive ties to this receipt strongly enough to draw.
            Some moments stand alone — that is a finding too.
          </p>
        ) : (
          <ol className="mt-3 space-y-0">
            {links.map((link, i) => (
              <li key={`${link.receipt.id}-${i}`}>
                <button
                  onClick={() => onOpenReceipt(link.receipt.id)}
                  className="group w-full border-b border-line/60 py-3 text-left transition-colors hover:bg-ink"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className={`truncate text-sm ${TYPE_COLOR[link.receipt.type]}`}>
                      {link.receipt.title}
                    </span>
                    <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-mute">
                      {fmtTime(link.receipt.ts)}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-mute">
                    <span className={THREAD_STYLE[link.type].className}>
                      {THREAD_STYLE[link.type].label}
                    </span>
                    {" · "}
                    {link.reason}
                  </p>
                </button>
              </li>
            ))}
          </ol>
        )}

        <p className="mt-5 border-t border-line pt-4 text-[11px] leading-relaxed text-mute">
          Connections are computed, deterministic and explained. The archive shows
          what happened together — not why.
        </p>
      </motion.aside>
    </AnimatePresence>
  );
}

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const eraStart = era === "ledger" ? 0 : Date.UTC(2022, 0, 1) / 1000;
    const eraEnd = era === "ledger" ? Date.UTC(2019, 0, 1) / 1000 : Infinity;

    return archive.receipts.filter((r) => {
      if (era === "ledger" && (r.ts < eraStart || r.ts >= eraEnd)) return false;
      if (type !== "all" && r.type !== type) return false;
      if (dayKey && r.dayKey !== dayKey) return false;
      if (q) {
        const haystack = `${r.title} ${r.subtitle ?? ""} ${r.category ?? ""} ${r.subcategory ?? ""} ${r.city ?? ""} ${r.album ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [archive, era, type, query, dayKey]);

  const visible = filtered.slice(0, limit);

  const pickDay = (key: string | null) => {
    setDayKey(key);
    setLimit(PAGE);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const counts = useMemo(() => {
    const c = { music: 0, purchase: 0, expense: 0, income: 0, transfer: 0 };
    for (const r of filtered) c[r.type]++;
    return c;
  }, [filtered]);

  return (
    <section id="archive" aria-labelledby="archive-title" className="scroll-mt-16 border-t border-line bg-surface/40 py-24 sm:py-32">
      <SectionHeader
        eyebrow="Archive"
        title={<span id="archive-title">Read every receipt.</span>}
        lede="Search by artist, merchant, item, city or category. Filter by kind, jump to a day, and pull any thread you find."
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
                {e === "all" ? "All years" : e === "ledger" ? "Ledger era" : "Detail era"}
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
                    onOpen={(rcpt) => { setSelected(rcpt); onOpenReceipt(rcpt.id); }}
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
