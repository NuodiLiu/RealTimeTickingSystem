import { useEffect, useState } from "react";
import { CaseItem } from "../lib/api";

export default function ActiveCaseRow({
  item,
  onResolve,
  onFeedback,
  feedbackDisabled = false,
}: {
  item: CaseItem;
  onResolve: (id: string) => void;
  onFeedback: (id: string) => void;
  feedbackDisabled?: boolean;
}) {
  const [elapsedTime, setElapsedTime] = useState("");

  const student = item.payload?.studentName ?? (item as any).studentName ?? "Student";
  const category = item.payload?.category ?? (item as any).category ?? "General";
  
  // Only use startedAt if it exists, otherwise show "Just started"
  const startTime = item.startedAt;

  useEffect(() => {
    if (!startTime) {
      setElapsedTime("Just started");
      return;
    }

    const updateElapsedTime = () => {
      const now = Date.now();
      const started = new Date(startTime).getTime();
      const diff = now - started;
      
      if (diff < 0) {
        setElapsedTime("Just started");
        return;
      }

      const minutes = Math.floor(diff / (1000 * 60));
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) {
        setElapsedTime(`${days}d ${hours % 24}h ago`);
      } else if (hours > 0) {
        setElapsedTime(`${hours}h ${minutes % 60}m ago`);
      } else if (minutes > 0) {
        setElapsedTime(`${minutes}m ago`);
      } else {
        setElapsedTime("Just started");
      }
    };

    // Update immediately
    updateElapsedTime();
    
    // Update every minute
    const interval = setInterval(updateElapsedTime, 60000);
    
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-2 font-medium">{student}</div>
      <div className="mb-3 text-xs text-zinc-500">
        {category} • Started {elapsedTime}
      </div>
      <div className="flex gap-2">
        <button 
          onClick={() => onResolve(item.id)} 
          className="rounded-md bg-black px-3 py-1.5 text-sm text-white hover:bg-gray-800"
        >
          RESOLVE
        </button>
        <button 
          onClick={() => onFeedback(item.id)} 
          disabled={feedbackDisabled}
          className={`rounded-md border px-3 py-1.5 text-sm ${
            feedbackDisabled 
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
              : 'hover:bg-gray-50'
          }`}
          title={feedbackDisabled ? 'No devices available for feedback' : 'Send feedback request'}
        >
          FEEDBACK
        </button>
      </div>
    </div>
  );
}