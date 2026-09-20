export function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink px-6 text-center">
      <p className="label animate-pulse">Opening the archive</p>
      <p className="mt-6 font-display text-3xl text-paper sm:text-4xl">
        49,000 receipts, being read.
      </p>
      <p className="mt-3 max-w-sm text-sm text-mute">
        Streaming history, card statements and a household ledger — nothing leaves
        your browser.
      </p>
    </div>
  );
}

export function LoadError({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink px-6 text-center">
      <p className="label">The archive is closed</p>
      <p className="mt-6 font-display text-3xl text-paper sm:text-4xl">
        The receipts could not be opened.
      </p>
      <p className="mt-3 max-w-sm text-sm text-mute">{message}</p>
      <button
        onClick={() => window.location.reload()}
        className="mt-8 border border-line px-5 py-2.5 text-xs uppercase tracking-[0.18em] text-faded transition-colors hover:border-accent hover:text-accent"
      >
        Try again
      </button>
    </div>
  );
}
