import { useEffect } from "react";

/**
 * Scroll-spy: marks the section currently in view (data attribute) and
 * mirrors it onto the primary nav links via aria-current, so screen-reader
 * users get the same orientation as visual ones. Passive — owns no state.
 */
export function useScrollSpy(sectionIds: readonly string[], enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

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

    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => {
      observer.disconnect();
      for (const a of navLinks()) a.removeAttribute("aria-current");
    };
    // sectionIds is a stable module-level constant at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sectionIds.join("|")]);
}
