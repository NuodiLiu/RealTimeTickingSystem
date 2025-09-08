"use client";
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  console.error("Dashboard error:", error);
  return (
    <div style={{ padding: 16 }}>
      <h2>Dashboard failed to load.</h2>
      <p>{error.message}</p>
      <button onClick={() => reset()}>Retry</button>
    </div>
  );
}
