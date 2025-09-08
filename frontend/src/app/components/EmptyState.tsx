export default function EmptyState({ label }: { label: string }) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-zinc-500">
        {label}
      </div>
    );
  }