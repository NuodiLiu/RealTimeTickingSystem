import ActiveCaseRow from "../ActiveCaseRow";
import EmptyState from "../EmptyState";
import LoadingSkeleton from "../LoadingSkeleton";
import { 
  getFeedbackDisabledReason,
  isFeedbackDisabledForCase
} from "../../lib/caseUtils";

interface ActiveCasesSectionProps {
  myActive: any[] | null;
  loading: boolean;
  resolve: (id: string) => void;
  sendFeedbackRequest: (id: string) => void;
  escalate: (id: string, department: string) => void;
  hasAvailableDevices: boolean;
  selectedDevice: any;
}

export default function ActiveCasesSection({ 
  myActive, 
  loading, 
  resolve, 
  sendFeedbackRequest, 
  escalate, 
  hasAvailableDevices, 
  selectedDevice 
}: ActiveCasesSectionProps) {
  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col">
      <div className="bg-green-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
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
                feedbackDisabled={isFeedbackDisabledForCase(c, hasAvailableDevices)}
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
