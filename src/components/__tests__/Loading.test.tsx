import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Loading, LoadError } from "../Loading";

describe("Loading", () => {
  it("shows the archive-opening state", () => {
    render(<Loading />);
    expect(screen.getByText("Opening the archive")).toBeInTheDocument();
    expect(screen.getByText(/receipts, being read/)).toBeInTheDocument();
    expect(screen.getByText(/nothing leaves\s+your browser/)).toBeInTheDocument();
  });
});

describe("LoadError", () => {
  it("surfaces the failure message and offers a retry", () => {
    render(<LoadError message="Could not open plays.json (404)" />);
    expect(screen.getByText("Could not open plays.json (404)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try again/ })).toBeInTheDocument();
    // jsdom cannot navigate; clicking must simply not throw.
    expect(() => fireEvent.click(screen.getByRole("button", { name: /Try again/ }))).not.toThrow();
  });
});
