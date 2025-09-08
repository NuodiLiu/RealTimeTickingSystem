export default function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
    return (
      <div className="animate-pulse space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-zinc-200/60" />
        ))}
      </div>
    );
  }