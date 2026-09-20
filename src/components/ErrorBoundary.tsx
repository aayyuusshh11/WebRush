import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level safety net: a runtime failure in any section renders a readable
 * fallback instead of a blank page. The archive itself is unaffected —
 * load-time failures are already handled in App with a dedicated screen.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Console only — the project ships no analytics or logging backend.
    console.error("Unhandled render error:", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          role="alert"
          className="flex min-h-screen flex-col items-center justify-center bg-ink px-6 text-center"
        >
          <p className="label">The archive hit a snag</p>
          <p className="mt-6 font-display text-3xl text-paper sm:text-4xl">
            Something here could not be shown.
          </p>
          <p className="mt-3 max-w-sm text-sm text-mute">
            The rest of the archive is safe. Reloading usually resolves it.
          </p>
          {this.state.error.message && (
            <p className="mt-2 max-w-sm text-[11px] leading-relaxed text-mute/80">
              {this.state.error.message}
            </p>
          )}
          <button
            onClick={() => window.location.reload()}
            className="mt-8 border border-line px-5 py-2.5 text-xs uppercase tracking-[0.18em] text-faded transition-colors hover:border-accent hover:text-accent"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
