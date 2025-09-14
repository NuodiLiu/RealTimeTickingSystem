"use client";

import ActiveCaseRow from "../ActiveCaseRow";
import EmptyState from "../EmptyState";
import LoadingSkeleton from "../LoadingSkeleton";

interface ActiveCasesSectionProps {
  myActive: any[] | null;
  loading: boolean;
  resolve: (caseId: string) => void;
  sendFeedbackRequest: (caseId: string) => void;
  escalate: (id: string, department: string) => void;
  hasSelectedDevice: boolean;
  selectedDevice: any;
  isFeedbackDisabledForCase: (caseItem: any, hasSelectedDevice: boolean) => boolean;
  getFeedbackDisabledReason: (caseItem: any, selectedDevice: any) => string;
}

export default function ActiveCasesSection({ 
  myActive, 
  loading, 
  resolve, 
  sendFeedbackRequest, 
  escalate, 
  hasSelectedDevice,
  selectedDevice,
  isFeedbackDisabledForCase,
  getFeedbackDisabledReason
}: ActiveCasesSectionProps) {
  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col">
      <div className="px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">My Active Cases</h2>
          <p className="text-sm text-gray-600 mt-1">
            {myActive?.length || 0} cases in progress
          </p>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        {loading && !myActive ? (
          <LoadingSkeleton rows={1} />
        ) : myActive && myActive.length > 0 ? (
          <div className="space-y-4">
            {myActive.map((c) => (
              <ActiveCaseRow
                key={c.id}
                item={c}
                onResolve={resolve}
                onFeedback={sendFeedbackRequest}
                onEscalate={escalate}
                feedbackDisabled={isFeedbackDisabledForCase(c, hasSelectedDevice)}
                feedbackDisabledReason={getFeedbackDisabledReason(c, selectedDevice)}
              />
            ))}
          </div>
        ) : (
          <EmptyState label="You have no active cases." />
        )}
      </div>
    </section>
  );
}
