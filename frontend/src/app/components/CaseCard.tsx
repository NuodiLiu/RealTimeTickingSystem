import { useEffect, useState } from "react";
import { CaseItem } from "../lib/api";

export default function CaseCard({
  item,
  onTake,
}: {
  item: CaseItem;
  onTake: (id: string) => void;
}) {
  const [waitingTime, setWaitingTime] = useState("");

  const student = item.studentName ?? "Student";
  const category = item.category ?? "General";
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
        setWaitingTime(`${days}d ${hours % 24}h ago`);
      } else if (hours > 0) {
        setWaitingTime(`${hours}h ${minutes % 60}m ago`);
      } else if (minutes > 0) {
        setWaitingTime(`${minutes}m ago`);
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
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div>
        <div className="font-medium">{student}</div>
        <div className="text-xs text-zinc-500">
          zID: {zID} • {category} • Waiting {waitingTime}
        </div>
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