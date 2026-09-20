import { useCallback, useEffect, useMemo, useState } from "react";
import { loadArchive, type Archive } from "./data/dataset";
import { buildPatterns } from "./engine/patterns";
import { buildChapters } from "./engine/chapters";
import type { Chapter, ReceiptType } from "./engine/types";
import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Record from "./components/Record";
import Patterns from "./components/Patterns";
import Chapters from "./components/Chapters";
import ArchiveView from "./components/Archive";
import ReceiptDetail from "./components/ReceiptDetail";
import Method, { Footer } from "./components/Method";
import { Loading, LoadError } from "./components/Loading";

export interface ArchiveFocus {
  dayKey?: string;
  types?: ReceiptType[];
  query?: string;
  nonce: number;
}

export default function App() {
  const [archive, setArchive] = useState<Archive | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [focus, setFocus] = useState<ArchiveFocus | null>(null);

  useEffect(() => {
    loadArchive().then(setArchive).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : "The archive failed to load.");
    });
  }, []);

  const patterns = useMemo(() => (archive ? buildPatterns(archive) : null), [archive]);
  const chapters = useMemo(
    () => (archive && patterns ? buildChapters(archive, patterns) : []),
    [archive, patterns],
  );

  const openReceipt = useCallback((id: string) => setReceiptId(id), []);
  const closeReceipt = useCallback(() => setReceiptId(null), []);

  const openArchiveFocus = useCallback((chapterFocus: Chapter["archiveFocus"]) => {
    if (!chapterFocus) return;
    setFocus({ ...chapterFocus, nonce: Date.now() });
    requestAnimationFrame(() => {
      document.getElementById("archive")?.scrollIntoView({ behavior: "smooth" });
    });
  }, []);

  const jumpToArchive = useCallback((opts: { dayKey?: string; types?: ReceiptType[]; query?: string }) => {
    setFocus({ ...opts, nonce: Date.now() });
    requestAnimationFrame(() => {
      document.getElementById("archive")?.scrollIntoView({ behavior: "smooth" });
    });
  }, []);

  // Scroll-spy: mark the active section and mirror it onto the nav links via
  // aria-current so screen-reader users get the same orientation as visual ones.
  useEffect(() => {
    if (!archive) return;
    const ids = ["record", "patterns", "chapters", "archive", "method"];
    const navLinks = () =>
      document.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Primary"] a[href^="#"]');
    const setActive = (id: string) => {
      for (const a of navLinks()) {
        if (a.getAttribute("href") === `#${id}`) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      }
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-active-section", "true");
            setActive(entry.target.id);
          } else {
            entry.target.removeAttribute("data-active-section");
          }
        }
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => {
      observer.disconnect();
      for (const a of navLinks()) a.removeAttribute("aria-current");
    };
  }, [archive]);

  if (error) return <LoadError message={error} />;
  if (!archive || !patterns) return <Loading />;

  const beginTrace = () => {
    document.getElementById("record")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
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
        <Record archive={archive} onEraJump={(era) => jumpToArchive(era === "ledger" ? { types: ["expense"] } : {})} />
        <Patterns patterns={patterns} meta={archive.meta} />
        <Chapters
          chapters={chapters}
          onOpenReceipt={openReceipt}
          onOpenArchive={openArchiveFocus}
        />
        <ArchiveView
          archive={archive}
          focus={focus}
          onOpenReceipt={openReceipt}
        />
        <Method />
      </main>
      <Footer />

      {receiptId && (
        <ReceiptDetail
          archive={archive}
          receiptId={receiptId}
          onClose={closeReceipt}
          onOpenReceipt={openReceipt}
          onOpenDay={(dayKey) => {
            closeReceipt();
            jumpToArchive({ dayKey });
          }}
        />
      )}
    </div>
  );
}
