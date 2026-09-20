import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ReceiptDetail from "../ReceiptDetail";
import { threadArchive } from "./fixtures";

const archive = threadArchive();

function Harness({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      <button data-testid="trigger">Open receipt</button>
      {open && (
        <ReceiptDetail
          archive={archive}
          receiptId="m-0"
          onClose={onClose}
          onOpenDay={() => {}}
        />
      )}
    </>
  );
}

describe("ReceiptDetail", () => {
  it("renders a modal dialog with the receipt and its thread", () => {
    render(<ReceiptDetail archive={archive} receiptId="m-0" onClose={() => {}} onOpenDay={() => {}} />);

    const dialog = screen.getByRole("dialog", { name: "Receipt: Echo Track" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("A song")).toBeInTheDocument();
    expect(screen.getByText("What connects to it")).toBeInTheDocument();
    // Connection evidence is visible.
    expect(screen.getAllByText(/same listening session/).length).toBeGreaterThan(0);
  });

  it("moves focus into the dialog on open", () => {
    render(<ReceiptDetail archive={archive} receiptId="m-0" onClose={() => {}} onOpenDay={() => {}} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveFocus();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<ReceiptDetail archive={archive} receiptId="m-0" onClose={onClose} onOpenDay={() => {}} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("traps Tab inside the dialog", () => {
    render(<ReceiptDetail archive={archive} receiptId="m-0" onClose={() => {}} onOpenDay={() => {}} />);
    const dialog = screen.getByRole("dialog");
    const focusables = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    expect(focusables.length).toBeGreaterThan(1);
    focusables[focusables.length - 1].focus();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: false });
    expect(focusables[0]).toHaveFocus();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(focusables[focusables.length - 1]).toHaveFocus();
  });

  it("restores focus to the trigger after close", () => {
    const { rerender } = render(<Harness open={false} onClose={() => {}} />);
    const trigger = screen.getByTestId("trigger");
    trigger.focus(); // jsdom does not focus on programmatic click
    expect(trigger).toHaveFocus();
    rerender(<Harness open onClose={() => {}} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    rerender(<Harness open={false} onClose={() => {}} />); // unmount → cleanup restores
    expect(trigger).toHaveFocus();
  });

  it("navigates the thread and returns via the back button", () => {
    render(<ReceiptDetail archive={archive} receiptId="m-0" onClose={() => {}} onOpenDay={() => {}} />);

    // Follow the strongest connection.
    fireEvent.click(screen.getAllByRole("button", { name: /Connected via/ })[0]);
    const dialog = screen.getByRole("dialog", { name: "Receipt: Other Track" });
    expect(dialog).toBeInTheDocument();

    // Back stack offers the way home.
    const back = screen.getByRole("button", { name: /← Back to Echo Track/ });
    fireEvent.click(back);
    expect(screen.getByRole("dialog", { name: "Receipt: Echo Track" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /← Back to/ })).not.toBeInTheDocument();
  });
});
