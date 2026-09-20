import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ErrorBoundary from "../ErrorBoundary";

function Bomb({ message }: { message: string }): never {
  throw new Error(message);
}

describe("ErrorBoundary", () => {
  it("renders children normally when nothing throws", () => {
    render(
      <ErrorBoundary>
        <p data-testid="child">all good</p>
      </ErrorBoundary>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("shows an accessible fallback instead of a blank page on failure", () => {
    // React logs the caught error; silence it for this test.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Bomb message="cannot read receipts of undefined" />
      </ErrorBoundary>,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    // React may prefix the message in dev — match loosely.
    expect(screen.getByText(/cannot read receipts of undefined/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try again/ })).toBeInTheDocument();
    expect(spy).toHaveBeenCalled();
  });

  it("the fallback reload affordance is clickable without error", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Bomb message="boom" />
      </ErrorBoundary>,
    );
    // jsdom cannot navigate; the click must simply not throw.
    expect(() => fireEvent.click(screen.getByRole("button", { name: /Try again/ }))).not.toThrow();
  });

  it("holds the fallback until unmounted, per React semantics", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(
      <ErrorBoundary>
        <Bomb message="first failure" />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    rerender(
      <ErrorBoundary>
        <p data-testid="recovered">recovered</p>
      </ErrorBoundary>,
    );
    // The boundary intentionally stays in the fallback state.
    expect(screen.queryByTestId("recovered")).not.toBeInTheDocument();
  });
});
