import { useEffect, useState } from "react";
import { loadArchive, type Archive } from "../data/dataset";

export interface UseArchiveResult {
  archive: Archive | null;
  /** Readable load failure message, or null while loading / on success. */
  error: string | null;
}

/**
 * Owns archive loading. One fetch per app lifetime (loadArchive memoizes);
 * this hook only mirrors the result into render state.
 */
export function useArchive(): UseArchiveResult {
  const [archive, setArchive] = useState<Archive | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadArchive()
      .then((a) => {
        if (!cancelled) setArchive(a);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "The archive failed to load.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { archive, error };
}
