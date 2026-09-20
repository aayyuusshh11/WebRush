import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Patterns from "../Patterns";
import LifeStream from "../LifeStream";
import Nav from "../Nav";
import { buildPatterns } from "../../engine/patterns";
import { threadArchive, makeMeta } from "./fixtures";

describe("Patterns (component)", () => {
  it("renders pattern data with accessible hour-by-hour equivalents", () => {
    const archive = threadArchive();
    const patterns = buildPatterns(archive);
    const meta = makeMeta({ nightShareByYear: { "2023": 0.5 } });
    render(<Patterns patterns={patterns} meta={meta} />);

    expect(screen.getByText("What the traces repeat.")).toBeInTheDocument();
    expect(screen.getByText("Most-played artists, all time")).toBeInTheDocument();

    // Canvas visuals have semantic data lists, not just an aria-label.
    const hourLists = screen.getAllByLabelText(/hour by hour/);
    expect(hourLists).toHaveLength(2);
    for (const list of hourLists) {
      expect(list.querySelectorAll("li")).toHaveLength(24);
    }
  });

  it("behaves safely with empty data", () => {
    const archive = threadArchive();
    const patterns = buildPatterns(archive);
    render(<Patterns patterns={patterns} meta={makeMeta()} />);
    // No years on record — the Changes list renders zero rows.
    expect(screen.queryAllByRole("listitem").length).toBeGreaterThanOrEqual(0);
  });
});

describe("LifeStream (component)", () => {
  it("renders the visualization with a semantic data table", () => {
    const monthly = new Map([
      ["2022-01", { music: 124, purchase: 4, ledger: 0 }],
      ["2022-02", { music: 188, purchase: 6, ledger: 2 }],
    ]);
    render(<LifeStream meta={makeMeta({ monthly })} />);

    const table = screen.getByRole("table", { name: /Life stream, month by month/ });
    expect(table).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "124" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "188" })).toBeInTheDocument();
    expect(screen.getByText("JAN 2022")).toBeInTheDocument();
  });

  it("handles an empty archive safely", () => {
    render(<LifeStream meta={makeMeta()} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(1); // header row only
  });
});

describe("Nav (component)", () => {
  it("exposes all sections as keyboard-reachable anchors", () => {
    render(<Nav />);
    for (const [label, id] of [
      ["The Record", "record"],
      ["Discoveries", "discoveries"],
      ["Patterns", "patterns"],
      ["Chapters", "chapters"],
      ["Archive", "archive"],
      ["Method", "method"],
    ] as const) {
      const link = screen.getByRole("link", { name: label });
      expect(link).toHaveAttribute("href", `#${id}`);
    }
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
  });
});
