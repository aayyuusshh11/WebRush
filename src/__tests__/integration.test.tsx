import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import App from "../App";
import { discoveryArchive } from "../engine/__tests__/fixtures";
import type { Archive } from "../data/dataset";

/**
 * The core user flow, end to end against a real (fixture) archive:
 *   load → search → open receipt → pull the thread → follow a connection
 *   → inspect → go back → close.
 *
 * App fetches data/*.json on mount, so the loader is mocked to return the
 * fixture archive directly.
 */

let archive: Archive;

vi.mock("../data/dataset", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../data/dataset")>();
  return {
    ...actual,
    loadArchive: vi.fn(() => Promise.resolve(archive)),
  };
});

beforeEach(() => {
  archive = discoveryArchive();
  vi.clearAllMocks();
});

describe("core user flow", () => {
  it("loads, searches, opens a receipt, follows the thread, and returns", async () => {
    render(<App />);

    // 1 — the archive loads and the page renders.
    await waitFor(() => screen.getByText("A life leaves"));
    expect(await screen.findByText("Things you might have missed.")).toBeInTheDocument();

    // 2 — search the archive.
    const search = await screen.findByLabelText("Search the traces");
    fireEvent.change(search, { target: { value: "Echo Track" } });

    // 3 — open a matching receipt row (first result).
    const row = screen
      .getAllByRole("button")
      .find((b) => (b.textContent ?? "").includes("Echo Track"));
    expect(row).toBeDefined();
    fireEvent.click(row!);

    // 4 — the drawer opens as a dialog with the thread explorer.
    const dialog = await screen.findByRole("dialog", { name: "Receipt: Echo Track" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByText(/What connects to it/)).toBeInTheDocument();

    // 5 — follow the strongest connection to a new focus.
    const nodes = within(dialog).getAllByRole("button", { name: /Connected via/ });
    expect(nodes.length).toBeGreaterThan(0);
    fireEvent.click(nodes[0]);

    // 6 — the new receipt is in focus with its own evidence, and a way back.
    await waitFor(() => screen.getByRole("dialog", { name: /^Receipt: / }));
    const back = screen.getByRole("button", { name: /← Back to/ });
    expect(back).toBeInTheDocument();

    // 7 — go back to the entry receipt.
    fireEvent.click(back);
    expect(screen.getByRole("dialog", { name: "Receipt: Echo Track" })).toBeInTheDocument();

    // 8 — close the drawer.
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
