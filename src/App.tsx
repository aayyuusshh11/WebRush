import { useMemo } from "react";
import { MotionConfig } from "framer-motion";
import { useArchive } from "./hooks/useArchive";
import { useArchiveNavigation } from "./hooks/useArchiveNavigation";
import { useScrollSpy } from "./hooks/useScrollSpy";
import { buildPatterns } from "./engine/patterns";
import { buildChapters } from "./engine/chapters";
import { buildDiscoveries } from "./engine/discoveries";
import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Record from "./components/Record";
import Discoveries from "./components/Discoveries";
import Patterns from "./components/Patterns";
import Chapters from "./components/Chapters";
import ArchiveView from "./components/Archive";
import ReceiptDetail from "./components/ReceiptDetail";
import Method, { Footer } from "./components/Method";
import { Loading, LoadError } from "./components/Loading";

const SECTION_IDS = ["record", "discoveries", "patterns", "chapters", "archive", "method"] as const;

/**
 * Orchestration only: data comes from useArchive, navigation from
 * useArchiveNavigation, active-section tracking from useScrollSpy, and all
 * analysis from the engine. Rendering is the only concern left here.
 */
export default function App() {
  const { archive, error } = useArchive();
  const {
    receiptId,
    openReceipt,
    closeReceipt,
    focus,
    openArchiveFocus,
    jumpToArchive,
  } = useArchiveNavigation();

  useScrollSpy(SECTION_IDS, Boolean(archive));

  const patterns = useMemo(() => (archive ? buildPatterns(archive) : null), [archive]);
  const chapters = useMemo(
    () => (archive && patterns ? buildChapters(archive, patterns) : []),
    [archive, patterns],
  );
  const discoveries = useMemo(
    () => (archive && patterns ? buildDiscoveries(archive, patterns) : []),
    [archive, patterns],
  );

  if (error) return <LoadError message={error} />;
  if (!archive || !patterns) return <Loading />;

  const beginTrace = () => {
    document.getElementById("record")?.scrollIntoView({ behavior: "smooth" });
  };

  // reducedMotion="user" makes every Framer transform/opacity animation honor
  // the OS reduced-motion setting — the CSS media rule alone cannot reach them.
  return (
    <MotionConfig reducedMotion="user">
      <div className="grain min-h-screen bg-ink text-paper">
        <a
          href="#record"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:border focus:border-accent focus:bg-ink focus:px-4 focus:py-2.5 focus:text-[11px] focus:uppercase focus:tracking-[0.18em] focus:text-accent"
        >
          Skip to the record
        </a>
        <Nav />
        <main>
          <Hero meta={archive.meta} onBegin={beginTrace} />
          <Record
            archive={archive}
            onEraJump={(era) => jumpToArchive(era === "ledger" ? { types: ["expense"] } : {})}
          />
          <Discoveries
            discoveries={discoveries}
            onOpenReceipt={openReceipt}
            onOpenArchive={openArchiveFocus}
          />
          <Patterns patterns={patterns} meta={archive.meta} />
          <Chapters
            chapters={chapters}
            onOpenReceipt={openReceipt}
            onOpenArchive={openArchiveFocus}
          />
          <ArchiveView archive={archive} focus={focus} onOpenReceipt={openReceipt} />
          <Method />
        </main>
        <Footer />

        {receiptId && (
          <ReceiptDetail
            archive={archive}
            receiptId={receiptId}
            onClose={closeReceipt}
            onOpenDay={(dayKey) => {
              closeReceipt();
              jumpToArchive({ dayKey });
            }}
          />
        )}
      </div>
    </MotionConfig>
  );
}
