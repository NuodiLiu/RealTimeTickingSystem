"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold">Something went wrong.</h2>
      <p className="mt-2 text-sm text-zinc-600">{error.message}</p>
      <button className="mt-4 rounded border px-3 py-1.5 text-sm" onClick={() => reset()}>
        Try again
      </button>
    </div>
  );
}