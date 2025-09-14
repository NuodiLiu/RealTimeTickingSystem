"use client";

import CaseCard from "../CaseCard";
import EmptyState from "../EmptyState";
import LoadingSkeleton from "../LoadingSkeleton";

interface QueueSectionProps {
  queued: any[] | null;
  loading: boolean;
  takeNext: () => void;
  take: (caseId: string) => void;
}

export default function QueueSection({ 
  queued, 
  loading, 
  takeNext, 
  take 
}: QueueSectionProps) {
  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Queue</h2>
            <p className="text-sm text-gray-600 mt-1">
              {queued?.length || 0} cases waiting
            </p>
          </div>
          <button
            onClick={takeNext}
            className="bg-[#ffd600] text-black px-4 py-2 rounded-md text-sm font-medium hover:bg-[#003366] hover:text-white transition-colors shadow-sm"
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
