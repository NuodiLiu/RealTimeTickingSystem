import { useEffect, useState, useRef } from "react";
import { CaseItem } from "../lib/api";
import { getCategoryName, getTruncatedStudentName } from "../lib/categoryUtils";
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
  const [truncatedCategory, setTruncatedCategory] = useState("");
  const [isTruncated, setIsTruncated] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);

  const student = item.studentName ?? "Student";
  const truncatedStudentName = getTruncatedStudentName(student);
  const categoryId = item.category ?? "other";
  const categoryName = getCategoryName(categoryId);
  const zID = item.zID ?? "";
  
  // Use createdAt to calculate waiting time
  const createdTime = item.createdAt;

  // Function to truncate text by whole words
  const truncateByWords = (text: string, maxWidth: number) => {
    if (!categoryRef.current) return { text, isTruncated: false };
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return { text, isTruncated: false };
    
    // Get computed styles from the element
    const styles = window.getComputedStyle(categoryRef.current);
    context.font = `${styles.fontSize} ${styles.fontFamily}`;
    
    // Check if full text fits
    if (context.measureText(text).width <= maxWidth) {
      return { text, isTruncated: false };
    }
    
    const words = text.split(' ');
    let truncated = '';
    
    for (let i = 0; i < words.length; i++) {
      const testText = truncated + (truncated ? ' ' : '') + words[i];
      const testWithEllipsis = testText + '...';
      
      if (context.measureText(testWithEllipsis).width > maxWidth) {
        return { 
          text: truncated + (truncated ? '...' : ''), 
          isTruncated: true 
        };
      }
      
      truncated = testText;
    }
    
    return { text: truncated, isTruncated: false };
  };

  // Update truncated category when component mounts or categoryName changes
  useEffect(() => {
    const updateTruncation = () => {
      if (categoryRef.current && categoryName) {
        // Get the actual available width for text (excluding padding)
        const containerWidth = categoryRef.current.clientWidth;
        if (containerWidth > 0) { // Ensure the element is rendered
          const result = truncateByWords(categoryName, containerWidth);
          setTruncatedCategory(result.text);
          setIsTruncated(result.isTruncated);
        }
      }
    };

    // Use a small delay to ensure the element is fully rendered
    const timeoutId = setTimeout(updateTruncation, 0);
    return () => clearTimeout(timeoutId);
  }, [categoryName]);

  // Handle resize events
  useEffect(() => {
    const handleResize = () => {
      if (categoryRef.current && categoryName) {
        // Get the actual available width for text (excluding padding)
        const containerWidth = categoryRef.current.clientWidth;
        if (containerWidth > 0) {
          const result = truncateByWords(categoryName, containerWidth);
          setTruncatedCategory(result.text);
          setIsTruncated(result.isTruncated);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [categoryName]);

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
          <div className="mb-2 font-semibold text-gray-900 truncate">
            {truncatedStudentName}
          </div>
        
        {/* ZID section with copy functionality */}
        <ZIDWithCopy zID={zID} />
        
        <div className="mb-1 space-y-1">
          <div ref={categoryRef} className="text-xs text-zinc-500 w-[78%]">
            {isTruncated ? (
              <Tooltip content={categoryName}>
                <span className="block">{truncatedCategory}</span>
              </Tooltip>
            ) : (
              <span className="block">{truncatedCategory || categoryName}</span>
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