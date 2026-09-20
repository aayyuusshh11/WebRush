import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Unmount React trees between tests so queries never leak across cases.
afterEach(() => cleanup());

/* jsdom ships without the observers the app uses for scroll-spy, canvas
   redraws and reveal animations. Minimal stubs — no behavior asserted here. */

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin = "";
  readonly thresholds: ReadonlyArray<number> = [];
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}
if (typeof globalThis.IntersectionObserver === "undefined") {
  (globalThis as unknown as Record<string, unknown>).IntersectionObserver =
    MockIntersectionObserver;
}

class MockResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
if (typeof globalThis.ResizeObserver === "undefined") {
  (globalThis as unknown as Record<string, unknown>).ResizeObserver =
    MockResizeObserver;
}

// jsdom implements layout only — smooth scrolling is a no-op.
Element.prototype.scrollIntoView ??= vi.fn();
