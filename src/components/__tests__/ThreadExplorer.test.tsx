import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ThreadExplorer from "../ThreadExplorer";
import { threadArchive, at, makeMeta, music, assembleArchive } from "./fixtures";

describe("ThreadExplorer", () => {
  const archive = threadArchive();

  it("renders connections ranked strongest first with strength labels and evidence", () => {
    const onNavigate = vi.fn();
    render(
      <ThreadExplorer
        archive={archive}
        receipt={archive.byId.get("m-0")!}
        onNavigate={onNavigate}
      />,
    );

    // Session links (score 500-class) outrank same-day temporal (400-class)
    // and track recurrence (300-class). First node must be a session link.
    const nodes = screen.getAllByRole("button", { name: /Connected via/ });
    expect(nodes.length).toBeGreaterThanOrEqual(4);
    expect(nodes[0]).toHaveAttribute("aria-label", expect.stringContaining("Connected via Session"));
    expect(nodes[0]).toHaveAttribute("aria-label", expect.stringContaining("same listening session"));

    // Every strength class present in the fixture is labeled, and evidence
    // reasons are rendered as text — never a bare "Connected".
    const labels = screen.getAllByText(/^(Session|Temporal|Recurring|Contextual)$/);
    expect(labels.length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText(/30 min apart/)).toBeInTheDocument();
    expect(screen.getByText(/same track · 5 days apart/)).toBeInTheDocument();
  });

  it("clicking a node makes it the new focus", () => {
    const onNavigate = vi.fn();
    render(
      <ThreadExplorer
        archive={archive}
        receipt={archive.byId.get("m-0")!}
        onNavigate={onNavigate}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: /Connected via/ })[0]);
    expect(onNavigate).toHaveBeenCalledWith("m-1");
  });

  it("supports ArrowUp / ArrowDown navigation between nodes", () => {
    const onNavigate = vi.fn();
    render(
      <ThreadExplorer
        archive={archive}
        receipt={archive.byId.get("m-0")!}
        onNavigate={onNavigate}
      />,
    );
    const nodes = screen.getAllByRole("button", { name: /Connected via/ });
    nodes[0].focus();
    fireEvent.keyDown(nodes[0], { key: "ArrowDown" });
    expect(nodes[1]).toHaveFocus();
    fireEvent.keyDown(nodes[1], { key: "ArrowUp" });
    expect(nodes[0]).toHaveFocus();
  });

  it("shows the standalone state when nothing connects", () => {
    const isolated = assembleArchive(
      [music({ id: "m-x", ts: at(1999, 1, 1, 12), title: "One-off", subtitle: "Nobody" })],
      makeMeta(),
    );
    render(
      <ThreadExplorer
        archive={isolated}
        receipt={isolated.byId.get("m-x")!}
        onNavigate={() => {}}
      />,
    );
    expect(screen.getByText("No strong connections")).toBeInTheDocument();
  });
});
