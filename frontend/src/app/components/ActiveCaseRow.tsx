import { CaseItem } from "../lib/api";

export default function ActiveCaseRow({
  item,
  onResolve,
  onFeedback,
}: {
  item: CaseItem;
  onResolve: (id: string) => void;
  onFeedback: (id: string) => void;
}) {
  const student = item.payload?.studentName ?? (item as any).studentName ?? "Student";
  const category = item.payload?.category ?? (item as any).category ?? "General";
  const started = new Date(item.updatedAt).toLocaleTimeString();

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-2 font-medium">{student}</div>
      <div className="mb-3 text-xs text-zinc-500">
        {category} • Started {started}
      </div>
      <div className="flex gap-2">
        <button onClick={() => onResolve(item.id)} className="rounded-md bg-black px-3 py-1.5 text-sm text-white">
          RESOLVE
        </button>
        <button onClick={() => onFeedback(item.id)} className="rounded-md border px-3 py-1.5 text-sm">
          FEEDBACK
        </button>
      </div>
    </div>
  );
}