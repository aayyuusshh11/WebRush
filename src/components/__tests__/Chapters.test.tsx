import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import Chapters from "../Chapters";
import type { Chapter } from "../../engine/types";

const chapter: Chapter = {
  id: "night-shift",
  numeral: "01",
  title: "THE NIGHT SHIFT",
  observation: [
    "A large share of this life happens after midnight.",
    "38% of all plays occurred between 00:00 and 06:00.",
  ],
  evidence: [
    { label: "Plays after midnight", value: "3 of 10" },
    { label: "Peak hour", value: "02:00" },
  ],
  receiptIds: ["m-0"],
  archiveFocus: { types: ["music"] },
};

function setup(chapters: Chapter[] = [chapter]) {
  const onOpenReceipt = vi.fn();
  const onOpenArchive = vi.fn();
  render(
    <Chapters chapters={chapters} onOpenReceipt={onOpenReceipt} onOpenArchive={onOpenArchive} />,
  );
  return { onOpenReceipt, onOpenArchive };
}

describe("Chapters", () => {
  it("renders the chapter title and opening observation", () => {
    setup();
    expect(screen.getByText("THE NIGHT SHIFT")).toBeInTheDocument();
    expect(screen.getByText(/A large share of this life happens after midnight/)).toBeInTheDocument();
  });

  it("starts with the first chapter expanded and exposes ARIA state", () => {
    setup();
    const toggle = screen.getByRole("button", { name: /THE NIGHT SHIFT/ });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAttribute("aria-controls", "chapter-body-night-shift");
    expect(screen.getByRole("region", { name: /THE NIGHT SHIFT — evidence/ })).toBeInTheDocument();
  });

  it("collapses and re-expands on click", () => {
    setup();
    const toggle = screen.getByRole("button", { name: /THE NIGHT SHIFT/ });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("wires the evidence actions to their callbacks", () => {
    const { onOpenReceipt, onOpenArchive } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Pull the thread/ }));
    expect(onOpenReceipt).toHaveBeenCalledWith("m-0");
    fireEvent.click(screen.getByRole("button", { name: "Open in archive" }));
    expect(onOpenArchive).toHaveBeenCalledWith(chapter.archiveFocus);
  });

  it("renders nothing destructive when a chapter has no receiptIds", () => {
    setup([{ ...chapter, id: "empty", receiptIds: [], archiveFocus: undefined }]);
    expect(screen.queryByRole("button", { name: /Pull the thread/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open in archive" })).not.toBeInTheDocument();
  });
});
