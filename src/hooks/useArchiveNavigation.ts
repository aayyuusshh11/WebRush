import { useCallback, useState } from "react";
import type { Chapter, ReceiptType } from "../engine/types";

/** Deep-link into the archive view (chapter and discovery cards use it). */
export interface ArchiveFocus {
  dayKey?: string;
  types?: ReceiptType[];
  query?: string;
  nonce: number;
}

function scrollToSection(id: string): void {
  requestAnimationFrame(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  });
}

export interface UseArchiveNavigationResult {
  /** Receipt currently open in the drawer, or null. */
  receiptId: string | null;
  openReceipt: (id: string) => void;
  closeReceipt: () => void;
  /** Pending archive deep-link, consumed by the Archive section. */
  focus: ArchiveFocus | null;
  openArchiveFocus: (chapterFocus: Chapter["archiveFocus"]) => void;
  jumpToArchive: (opts: { dayKey?: string; types?: ReceiptType[]; query?: string }) => void;
}

/**
 * Owns the two navigation concerns of the experience: which receipt the
 * drawer is open on, and which filtered view the archive was asked to show.
 */
export function useArchiveNavigation(): UseArchiveNavigationResult {
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [focus, setFocus] = useState<ArchiveFocus | null>(null);

  const openReceipt = useCallback((id: string) => setReceiptId(id), []);
  const closeReceipt = useCallback(() => setReceiptId(null), []);

  const openArchiveFocus = useCallback((chapterFocus: Chapter["archiveFocus"]) => {
    if (!chapterFocus) return;
    setFocus({ ...chapterFocus, nonce: Date.now() });
    scrollToSection("archive");
  }, []);

  const jumpToArchive = useCallback(
    (opts: { dayKey?: string; types?: ReceiptType[]; query?: string }) => {
      setFocus({ ...opts, nonce: Date.now() });
      scrollToSection("archive");
    },
    [],
  );

  return { receiptId, openReceipt, closeReceipt, focus, openArchiveFocus, jumpToArchive };
}
