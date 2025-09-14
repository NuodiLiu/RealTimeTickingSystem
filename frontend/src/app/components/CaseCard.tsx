import { useEffect, useState } from "react";
import { CaseItem } from "../lib/api";
import { getCategoryName, getTruncatedCategoryName, getTruncatedStudentName } from "../lib/categoryUtils";
import Tooltip from "./Tooltip";
import ZIDWithCopy from "./ZIDWithCopy";

export default function CaseCard({
  item,
  onTake,
}: {
  item: CaseItem;
  onTake: (id: string) => void;
}) {
  const [waitingTime, setWaitingTime] = useState("");

  const student = item.studentName ?? "Student";
  const truncatedStudentName = getTruncatedStudentName(student);
  const categoryId = item.category ?? "other";
  const categoryName = getCategoryName(categoryId);
  const truncatedCategoryName = getTruncatedCategoryName(categoryId);
  const zID = item.zID ?? "";
  
  // Use createdAt to calculate waiting time
  const createdTime = item.createdAt;

  useEffect(() => {
    if (!createdTime) {
      setWaitingTime("Just now");
      return;
    }

    const updateWaitingTime = () => {
      const now = Date.now();
      const created = new Date(createdTime).getTime();
      const diff = now - created;
      
      if (diff < 0) {
        setWaitingTime("Just now");
        return;
      }

      const minutes = Math.floor(diff / (1000 * 60));
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) {
        setWaitingTime(`${days}d ${hours % 24}h`);
      } else if (hours > 0) {
        setWaitingTime(`${hours}h ${minutes % 60}m`);
      } else if (minutes > 0) {
        setWaitingTime(`${minutes}m`);
      } else {
        setWaitingTime("Just now");
      }
    };

    // Update immediately
    updateWaitingTime();
    
    // Update every minute
    const interval = setInterval(updateWaitingTime, 60000);
    
    return () => clearInterval(interval);
  }, [createdTime]);

  return (
    <div className="flex items-start justify-between rounded-md border border-gray-200 shadow-sm p-4 bg-white">
      <div className="flex-1 min-w-0 pr-4">
          <div className="mb-2 font-semibold truncate">
            {truncatedStudentName}
          </div>
        
        {/* ZID section with copy functionality */}
        <ZIDWithCopy zID={zID} />
        
        <div className="mb-1 space-y-1">
          <div className="text-xs text-zinc-500">
            {truncatedCategoryName.includes('...') ? (
              <Tooltip content={categoryName}>
                <span>{truncatedCategoryName}</span>
              </Tooltip>
            ) : (
              <span>{truncatedCategoryName}</span>
            )}
          </div>
          <div className="text-xs text-zinc-500">
            Waiting: {waitingTime}
          </div>
        </div>
      </div>
      <button
        onClick={() => onTake(item.id)}
        className="flex-shrink-0 rounded-md bg-[#ffd600] px-3 py-1.5 text-sm text-black hover:bg-[#003366] hover:text-white transition-colors"
      >
        TAKE
      </button>
    </div>
  );
}