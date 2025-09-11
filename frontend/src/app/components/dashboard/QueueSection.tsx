import CaseCard from "../CaseCard";
import EmptyState from "../EmptyState";
import LoadingSkeleton from "../LoadingSkeleton";

interface QueueSectionProps {
  queued: any[] | null;
  loading: boolean;
  take: (id: string) => void;
  takeNext: () => void;
}

export default function QueueSection({ queued, loading, take, takeNext }: QueueSectionProps) {
  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col">
      <div className="bg-blue-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Queue</h2>
            <p className="text-sm text-gray-600 mt-1">
              {queued?.length || 0} cases waiting
            </p>
          </div>
          <button
            onClick={takeNext}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            TAKE NEXT
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        {loading && !queued ? (
          <LoadingSkeleton rows={3} />
        ) : queued && queued.length > 0 ? (
          <div className="space-y-4">
            {queued.map((c) => (
              <CaseCard key={c.id} item={c} onTake={take} />
            ))}
          </div>
        ) : (
          <EmptyState label="No cases in queue." />
        )}
      </div>
    </section>
  );
}
