"use client";

export default function GlobalError({
  error,
  reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  console.error("Global error:", error);
  return (
    <html>
      <body style={{ padding: 16, fontFamily: "system-ui" }}>
        <h1>App crashed</h1>
        <p>{error.message}</p>
        <button onClick={() => reset()}>Reload</button>
      </body>
    </html>
  );
}