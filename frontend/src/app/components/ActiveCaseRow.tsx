import { useEffect, useState, useRef } from "react";
import { CaseItem } from "../lib/api";
import ConfirmationModal from "./ConfirmationModal";
import { getCategoryName, getTruncatedCategoryName, getTruncatedStudentName } from "../lib/categoryUtils";

const ESCALATION_DEPARTMENTS = [
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
  onEscalate: (id: string, department: string) => void;
  feedbackDisabled?: boolean;
  feedbackDisabledReason?: string;
}) {
  const [elapsedTime, setElapsedTime] = useState("");
  const [showEscalationDropdown, setShowEscalationDropdown] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [isEscalating, setIsEscalating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const student = item.studentName ?? "Student";
  const truncatedStudentName = getTruncatedStudentName(student);
  const categoryId = item.category ?? "other";
  const categoryName = getCategoryName(categoryId);
  const truncatedCategoryName = getTruncatedCategoryName(categoryId);
  const zID = item.zID ?? "";
  
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
    setSelectedDepartment(department);
    setShowEscalationDropdown(false);
    setShowConfirmation(true);
  };

  const handleConfirmEscalation = async () => {
    setIsEscalating(true);
    try {
      await onEscalate(item.id, selectedDepartment);
      setShowConfirmation(false);
      setSelectedDepartment("");
    } catch (error) {
      console.error("Failed to escalate case:", error);
    } finally {
      setIsEscalating(false);
    }
  };

  const handleCancelEscalation = () => {
    setShowConfirmation(false);
    setSelectedDepartment("");
  };

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-2 font-medium truncate cursor-help" title={student}>
        {truncatedStudentName}
      </div>
      <div className="text-xs text-gray-500 font-normal mb-3">{zID}</div>
      <div className="mb-3 space-y-1">
        <div className="text-xs text-zinc-500">
          <span 
            title={categoryName}
            className="cursor-help"
          >
            {truncatedCategoryName}
          </span>
        </div>
        <div className="text-xs text-zinc-500">
          Started {elapsedTime}
          {item.escalatedTo && (
            <span className="ml-2 px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs">
              Escalated to {item.escalatedTo}
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
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
          title={feedbackDisabled ? feedbackDisabledReason : 'Send feedback request'}
        >
          FEEDBACK
        </button>
        
        {/* Escalate Button with Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowEscalationDropdown(!showEscalationDropdown)}
            className="rounded-md border border-orange-300 bg-orange-50 px-3 py-1.5 text-sm text-orange-700 hover:bg-orange-100"
          >
            ESCALATE ▼
          </button>
          
          {showEscalationDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 min-w-48">
              <div className="py-1">
                {ESCALATION_DEPARTMENTS.map((dept) => (
                  <button
                    key={dept}
                    onClick={() => handleEscalateClick(dept)}
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                  >
                    {dept}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={handleCancelEscalation}
        onConfirm={handleConfirmEscalation}
        title="Confirm Escalation"
        message={
          <div>
            Are you sure you want to escalate this case to <strong>{selectedDepartment}</strong>?
            <br />
            <br />
            <em>Student:</em> {student}
            <br />
            <em>Category:</em> {categoryName}
          </div>
        }
        confirmText="Escalate"
        isLoading={isEscalating}
      />
    </div>
  );
}