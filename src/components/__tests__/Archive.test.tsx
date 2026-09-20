import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ArchiveView from "../Archive";
import { threadArchive, bigArchive } from "./fixtures";

function setup(archive = threadArchive()) {
  const onOpenReceipt = vi.fn();
  render(<ArchiveView archive={archive} focus={null} onOpenReceipt={onOpenReceipt} />);
  return { onOpenReceipt };
}

function rowButtons() {
  // Every receipt row is a button containing a time like "10:00 PM".
  return screen.getAllByRole("button").filter((b) => /\d{2}:\d{2} (AM|PM)/.test(b.textContent ?? ""));
}

describe("ArchiveView", () => {
  it("lists receipts and the match count", () => {
    setup();
    expect(rowButtons()).toHaveLength(8);
    expect(screen.getByText(/8 receipts match|receipts match/)).toBeInTheDocument();
  });

  it("search filters receipts via the precomputed index", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Search the traces"), { target: { value: "swiggy" } });
    expect(rowButtons()).toHaveLength(2);
    expect(screen.getAllByText("Swiggy")).toHaveLength(2);
  });

  it("clear search restores the full list", () => {
    setup();
    const input = screen.getByLabelText("Search the traces");
    fireEvent.change(input, { target: { value: "swiggy" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(rowButtons()).toHaveLength(8);
  });

  it("type filtering works", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Music" }));
    expect(rowButtons()).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: "Purchases" }));
    expect(rowButtons()).toHaveLength(3);
  });

  it("era filtering uses explicit coverage windows", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Ledger · 2015–2018" }));
    // The fixture lives in 2023 — the ledger era window is empty here.
    expect(screen.getByText(/Nothing in the archive matches/)).toBeInTheDocument();
  });

  it("day navigation filters to one date", () => {
    setup();
    const dayButtons = screen.getAllByRole("button", { name: /\d{2} [A-Z]{3}/ });
    fireEvent.click(dayButtons[0]); // latest day on record
    expect(screen.getByText(/TUESDAY|THURSDAY|THURSDAY|MONDAY|SATURDAY/)).toBeInTheDocument();
    expect(rowButtons().length).toBeLessThan(8);
  });

  it("pagination: Show more reveals the rest of a long archive", () => {
    render(<ArchiveView archive={bigArchive()} focus={null} onOpenReceipt={() => {}} />);
    expect(rowButtons()).toHaveLength(60);
    fireEvent.click(screen.getByRole("button", { name: /Show 10 more/ }));
    expect(rowButtons()).toHaveLength(70);
    expect(screen.queryByRole("button", { name: /Show .* more/ })).not.toBeInTheDocument();
  });

  it("selecting a receipt opens the thread panel", () => {
    setup();
    fireEvent.click(rowButtons()[0]);
    expect(screen.getByText("The thread")).toBeInTheDocument();
    // Connections render with strength labels and evidence reasons.
    expect(screen.getByText(/connections$/)).toBeInTheDocument();
    expect(screen.getAllByText(/^(Session|Temporal|Recurring|Contextual)$/).length).toBeGreaterThan(0);
  });

  it("shows an empty state when nothing matches", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Search the traces"), { target: { value: "zzzz" } });
    expect(screen.getByText(/Nothing in the archive matches/)).toBeInTheDocument();
  });

  it("keeps a search landmark and labelled controls", () => {
    setup();
    expect(screen.getByRole("search")).toBeInTheDocument();
    expect(screen.getByLabelText("Search the traces")).toBeInTheDocument();
  });
});
