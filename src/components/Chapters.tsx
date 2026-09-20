import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import SectionHeader from "./SectionHeader";
import type { Chapter } from "../engine/types";

interface Props {
  chapters: Chapter[];
  onOpenReceipt: (id: string) => void;
  onOpenArchive: (focus: Chapter["archiveFocus"]) => void;
}

function ChapterCard({
  chapter,
  open,
  onToggle,
  onOpenReceipt,
  onOpenArchive,
}: {
  chapter: Chapter;
  open: boolean;
  onToggle: () => void;
  onOpenReceipt: Props["onOpenReceipt"];
  onOpenArchive: Props["onOpenArchive"];
}) {
  return (
    <article className="rule">
      <button
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`chapter-body-${chapter.id}`}
        className="group grid w-full grid-cols-[auto_1fr_auto] items-baseline gap-4 py-8 text-left sm:gap-8 sm:py-10"
      >
        <span className="font-display text-3xl italic text-mute transition-colors group-hover:text-accent sm:text-4xl">
          {chapter.numeral}
        </span>
        <span>
          <span className="block font-display text-3xl leading-tight text-paper transition-colors group-hover:text-accent sm:text-5xl">
            {chapter.title}
          </span>
          <span className="mt-3 block max-w-xl text-sm leading-relaxed text-faded">
            {chapter.observation[0]}
          </span>
        </span>
        <span
          aria-hidden
          className={`text-mute transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        >
          ↓
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            id={`chapter-body-${chapter.id}`}
            role="region"
            aria-label={`${chapter.title} — evidence and connections`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="grid gap-10 pb-10 pl-0 sm:pl-12 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
              <div>
                {chapter.observation.slice(1).map((para) => (
                  <p key={para} className="mb-4 max-w-xl text-sm leading-relaxed text-faded">
                    {para}
                  </p>
                ))}

                <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-2">
                  {chapter.evidence.map((e) => (
                    <div key={e.label} className="border-l border-line pl-4">
                      <dt className="label">{e.label}</dt>
                      <dd className="mt-1 text-sm text-paper">{e.value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-8 flex flex-wrap gap-3">
                  {chapter.receiptIds.length > 0 && (
                    <button
                      onClick={() => onOpenReceipt(chapter.receiptIds[0])}
                      className="border border-accent/70 px-5 py-2.5 text-[11px] uppercase tracking-[0.18em] text-accent transition-colors hover:bg-accent hover:text-ink"
                    >
                      Pull the thread →
                    </button>
                  )}
                  {chapter.archiveFocus && Object.keys(chapter.archiveFocus).length > 0 && (
                    <button
                      onClick={() => onOpenArchive(chapter.archiveFocus)}
                      className="border border-line px-5 py-2.5 text-[11px] uppercase tracking-[0.18em] text-faded transition-colors hover:border-accent hover:text-accent"
                    >
                      Open in archive
                    </button>
                  )}
                </div>
              </div>

              <aside className="self-start border border-line bg-surface/60 p-5">
                <p className="label">Evidence</p>
                <ul className="mt-4 space-y-3">
                  {chapter.evidence.map((e) => (
                    <li key={e.label} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-faded">{e.label}</span>
                      <span className="text-right text-paper">{e.value}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-5 border-t border-line pt-4 text-[11px] leading-relaxed text-mute">
                  Every figure is computed in your browser from the archive. If the
                  evidence did not exist, the chapter would not.
                </p>
              </aside>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}

export default function Chapters({ chapters, onOpenReceipt, onOpenArchive }: Props) {
  const [openId, setOpenId] = useState<string | null>(chapters[0]?.id ?? null);

  return (
    <section id="chapters" aria-labelledby="chapters-title" className="scroll-mt-16 py-24 sm:py-32">
      <SectionHeader
        eyebrow="Chapters"
        title={<span id="chapters-title">The story the receipts tell.</span>}
        lede="Generated from the evidence, in order of the life they describe. Open a chapter, then pull its thread back into the archive."
      />

      <div className="mx-auto mt-12 w-full max-w-6xl px-5 sm:px-8">
        {chapters.map((chapter) => (
          <ChapterCard
            key={chapter.id}
            chapter={chapter}
            open={openId === chapter.id}
            onToggle={() => setOpenId(openId === chapter.id ? null : chapter.id)}
            onOpenReceipt={onOpenReceipt}
            onOpenArchive={onOpenArchive}
          />
        ))}
      </div>
    </section>
  );
}
