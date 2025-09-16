import { useEffect, useState, useRef } from "react";
import { CaseItem } from "../lib/api";
import { getCategoryName, getTruncatedStudentName } from "../lib/categoryUtils";
import { isCasePendingFeedback } from "../lib/caseUtils";
import { useTextTruncation } from "../hooks/useTextTruncation";
import TooltipStyles from "./TooltipStyles";
import Tooltip from "./Tooltip";
import ZIDWithCopy from "./ZIDWithCopy";

const ESCALATION_DEPARTMENTS = [
  "None",
  "IT Support",
  "Academic Services", 
  "Student Services",
  "Financial Aid",
  "Admissions",
  "Registrar",
  "Housing",
  "Health Services",
  "Counseling",
  "Security"
];

export default function ActiveCaseRow({
  item,
  onResolve,
  onFeedback,
  onEscalate,
  feedbackDisabled = false,
  feedbackDisabledReason = 'No devices available for feedback',
}: {
  item: CaseItem;
  onResolve: (id: string) => void;
  onFeedback: (id: string) => void;
    onEscalate: (id: string, department: string | null, resolvedOnSite: boolean | null) => void;
  feedbackDisabled?: boolean;
  feedbackDisabledReason?: string;
}) {
  const [elapsedTime, setElapsedTime] = useState("");
  const [showEscalationDropdown, setShowEscalationDropdown] = useState(false);
  const [isEscalating, setIsEscalating] = useState(false);
  const [showPopAnimation, setShowPopAnimation] = useState(false);
  const [resolvedOnSite, setResolvedOnSite] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const student = item.studentName ?? "Student";
  const truncatedStudentName = getTruncatedStudentName(student);
  const categoryId = item.category ?? "other";
  const categoryName = getCategoryName(categoryId);
  const zID = item.zID ?? "";
  
  // Use text truncation hook
  const { truncatedText: truncatedCategory, isTruncated, elementRef: categoryRef } = useTextTruncation(categoryName);
  
  // Check if case is pending feedback review
  const isPendingFeedback = isCasePendingFeedback(item);
  
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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowEscalationDropdown(false);
      }
    };

    if (showEscalationDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEscalationDropdown]);

  const handleEscalateClick = (department: string) => {
    setShowEscalationDropdown(false);
    // Convert "None" to null for the state
    const departmentToSet = department === "None" ? null : department;
    setSelectedDepartment(departmentToSet);
    
    // Trigger animation when selecting a department (except "None")
    if (departmentToSet !== null) {
      setShowPopAnimation(true);
      setTimeout(() => setShowPopAnimation(false), 800);
    }
  };

  const handleEscalationIfNeeded = async (): Promise<boolean> => {
    // First escalate if department is selected or resolvedOnSite is checked
    if (selectedDepartment !== null || resolvedOnSite) {
      try {
        setIsEscalating(true);
        await onEscalate(item.id, selectedDepartment, resolvedOnSite);
        // Trigger smooth pop animation for the escalated badge
        setShowPopAnimation(true);
        setTimeout(() => setShowPopAnimation(false), 800);
        return true; // Escalation succeeded
      } catch (error) {
        console.error("Failed to escalate case:", error);
        return false; // Escalation failed
      } finally {
        setIsEscalating(false);
      }
    }
    return true; // No escalation needed, proceed
  };

  const handleResolveClick = async () => {
    const escalationSucceeded = await handleEscalationIfNeeded();
    if (!escalationSucceeded) {
      return; // Don't proceed to resolve if escalation fails
    }
    
    // Then resolve the case
    onResolve(item.id);
  };

  const handleFeedbackClick = async () => {
    const escalationSucceeded = await handleEscalationIfNeeded();
    if (!escalationSucceeded) {
      return; // Don't proceed to feedback if escalation fails
    }
    
    // Then proceed with feedback
    onFeedback(item.id);
  };

  return (
    <div className="rounded-md border border-gray-200 shadow-sm p-4 bg-white">
      <div className="mb-2 font-semibold text-gray-900 truncate">
        {truncatedStudentName}
      </div>
      <ZIDWithCopy zID={zID} />
      <div className="mb-3 space-y-1">
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
          Started {elapsedTime}
          {(selectedDepartment) && (
            <span 
              className={`ml-2 px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800 ${
                showPopAnimation 
                  ? 'animate-smooth-pop' 
                  : ''
              }`}
            >
              Escalated to {selectedDepartment}
            </span>
          )}
        </div>
        
        <TooltipStyles />
      </div>
      <div className="flex gap-2 flex-wrap">
        <button 
          onClick={handleResolveClick} 
          disabled={isEscalating}
          className="rounded-md bg-[#ffd600] px-3 py-1.5 text-sm text-black hover:bg-[#003366] hover:text-white transition-colors disabled:opacity-50"
        >
          {isEscalating ? 'PROCESSING...' : 'RESOLVE'}
        </button>
        <Tooltip content={feedbackDisabled ? feedbackDisabledReason : 'Send feedback form to iPad'}>
          <button 
            onClick={handleFeedbackClick} 
            disabled={feedbackDisabled || isEscalating}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              feedbackDisabled || isEscalating
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-300' 
                : isPendingFeedback
                ? 'border-yellow-500 bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                : 'border-[#003366] text-[#003366] hover:bg-[#003366] hover:text-white'
            } transition-colors`}
          >
            {isEscalating ? 'PROCESSING...' : (isPendingFeedback ? 'PENDING' : 'FEEDBACK')}
          </button>
        </Tooltip>
        
        {/* Escalate Button with Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowEscalationDropdown(!showEscalationDropdown)}
            className="rounded-md border border-[#003366] bg-[#003366]/10 px-3 py-1.5 text-sm text-[#003366] hover:bg-[#003366] hover:text-white transition-colors"
          >
            ESCALATE ▼
          </button>
          
          {showEscalationDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 min-w-48">
              <div>
                {ESCALATION_DEPARTMENTS.map((dept) => (
                  <button
                    key={dept}
                    onClick={() => handleEscalateClick(dept)}
                    className="block w-full px-4 py-2 text-left text-sm text-gray-900 hover:bg-[#ffd600] hover:text-black transition-colors"
                  >
                    {dept}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Resolved on Site Checkbox */}
        {selectedDepartment && (
          <div className="flex items-center">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={resolvedOnSite}
                onChange={(e) => setResolvedOnSite(e.target.checked)}
                className="w-4 h-4 text-[#003366] bg-gray-100 border-gray-300 rounded focus:ring-[#003366] focus:ring-2"
              />
              <span className="text-sm text-gray-700">Resolved on site</span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}