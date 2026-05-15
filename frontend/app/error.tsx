"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Hook for Sentry / Plausible in the future.
    console.error("[yai-excel] runtime error:", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-paper flex items-center justify-center px-4 py-16">
      <div className="text-center max-w-md">
        <div className="inline-block bg-danger text-snow border-[3px] border-ink px-4 py-1 shadow-neo-sm font-mono text-sm mb-6">
          ERROR
        </div>
        <h1 className="font-display text-5xl sm:text-7xl leading-none">SOMETHING BROKE.</h1>
        <p className="text-ink/70 mt-4 mb-2">It's not you. It's the build.</p>
        {error?.digest && (
          <p className="text-xs font-mono text-muted mb-6">ref · {error.digest}</p>
        )}
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary border-[3px] border-ink shadow-neo font-bold hover:translate-x-[-1px] hover:translate-y-[-1px] transition"
        >
          Try again →
        </button>
      </div>
    </main>
  );
}
