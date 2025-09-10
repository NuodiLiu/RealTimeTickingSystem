import { CaseItem } from "../lib/api";

export default function CaseCard({
  item,
  onTake,
}: {
  item: CaseItem;
  onTake: (id: string) => void;
}) {
  const student = item.payload?.studentName ?? (item as any).studentName ?? "Student";
  const category = item.payload?.category ?? (item as any).category ?? "General";

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div>
        <div className="font-medium">{student}</div>
        <div className="text-xs text-zinc-500">{category}</div>
      </div>
      <button
        onClick={() => onTake(item.id)}
        className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50"
      >
        TAKE
      </button>
    </div>
  );
}