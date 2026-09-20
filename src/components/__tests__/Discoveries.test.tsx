import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Discoveries from "../Discoveries";
import { buildPatterns } from "../../engine/patterns";
import { buildDiscoveries } from "../../engine/discoveries";
import { discoveryArchive } from "../../engine/__tests__/fixtures";

describe("Discoveries", () => {
  it("renders nothing when the archive yields no discoveries", () => {
    const { container } = render(
      <Discoveries discoveries={[]} onOpenReceipt={() => {}} onOpenArchive={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders each discovery with its evidence and wired actions", () => {
    const archive = discoveryArchive();
    const discoveries = buildDiscoveries(archive, buildPatterns(archive));
    expect(discoveries.length).toBeGreaterThan(0);

    const onOpenReceipt = vi.fn();
    const onOpenArchive = vi.fn();
    render(
      <Discoveries
        discoveries={discoveries}
        onOpenReceipt={onOpenReceipt}
        onOpenArchive={onOpenArchive}
      />,
    );

    expect(screen.getByText("Things you might have missed.")).toBeInTheDocument();
    // Every card exposes its evidence chain inline.
    expect(screen.getAllByText(/Explore the thread/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByText(/Explore the thread/)[0]);
    expect(onOpenReceipt).toHaveBeenCalledWith(discoveries[0].receiptIds[0]);

    // Cards with a deep-link open the archive filtered — one button each.
    const withFocus = discoveries.filter(
      (d) => d.archiveFocus && Object.keys(d.archiveFocus).length > 0,
    );
    const focusButtons = screen.getAllByRole("button", { name: "Open in archive" });
    expect(focusButtons).toHaveLength(withFocus.length);
    fireEvent.click(focusButtons[0]);
    expect(onOpenArchive).toHaveBeenCalledWith(withFocus[0].archiveFocus);
  });
});
