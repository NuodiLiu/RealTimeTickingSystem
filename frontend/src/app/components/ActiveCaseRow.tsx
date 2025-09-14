import { useEffect, useState, useRef } from "react";
import { CaseItem } from "../lib/api";
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
  const [isEscalating, setIsEscalating] = useState(false);
  const [showPopAnimation, setShowPopAnimation] = useState(false);
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

  const handleEscalateClick = async (department: string) => {
    setShowEscalationDropdown(false);
    setIsEscalating(true);
    
    try {
      await onEscalate(item.id, department);
      // Trigger smooth pop animation for the escalated badge
      setShowPopAnimation(true);
      setTimeout(() => setShowPopAnimation(false), 800);
    } catch (error) {
      console.error("Failed to escalate case:", error);
    } finally {
      setIsEscalating(false);
    }
  };

  return (
    <div className="rounded-md border border-gray-200 shadow-sm p-4 bg-white">
      <div className="mb-2 font-semibold truncate">
        {truncatedStudentName}
      </div>
      <div className="text-xs text-gray-500 font-normal mb-3">{zID}</div>
      <div className="mb-3 space-y-1">
        <div className="text-xs text-zinc-500">
          <span 
            data-tooltip={categoryName}
            className={truncatedCategoryName.includes('...') ? 'cursor-help fast-tooltip' : ''}
          >
            {truncatedCategoryName}
          </span>
        </div>
        <div className="text-xs text-zinc-500">
          Started {elapsedTime}
          {item.escalatedTo && (
            <span 
              className={`ml-2 px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800 ${
                showPopAnimation 
                  ? 'animate-pulse-smooth' 
                  : ''
              }`}
              style={{
                animation: showPopAnimation ? 'smooth-pop 0.8s ease-out' : undefined
              }}
            >
              Escalated to {item.escalatedTo}
            </span>
          )}
        </div>
        
        <style jsx>{`
          @keyframes smooth-pop {
            0% {
              transform: scale(1);
              background-color: rgb(254 215 170);
              color: rgb(154 52 18);
              box-shadow: 0 0 0 rgba(0,0,0,0);
            }
            50% {
              transform: scale(1.15);
              background-color: rgb(253 186 116);
              color: rgb(124 45 18);
              box-shadow: 0 8px 25px rgba(0,0,0,0.15);
            }
            100% {
              transform: scale(1);
              background-color: rgb(254 215 170);
              color: rgb(154 52 18);
              box-shadow: 0 0 0 rgba(0,0,0,0);
            }
          }
          
          /* Fast tooltip implementation - smaller, single-line */
          .fast-tooltip {
            position: relative;
          }
          
          .fast-tooltip:hover::after {
            content: attr(data-tooltip);
            position: absolute;
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            margin-top: 6px;
            padding: 3px 6px;
            background: #6b7280;
            color: white;
            font-size: 11px;
            border-radius: 3px;
            white-space: nowrap;
            z-index: 1000;
            opacity: 0;
            animation: tooltip-appear 0.15s ease-out 0.5s forwards;
            pointer-events: none;
            border: 1px solid #4b5563;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
          }
          
          .fast-tooltip:hover::before {
            content: '';
            position: absolute;
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            margin-top: 0px;
            border: 3px solid transparent;
            border-bottom-color: #6b7280;
            z-index: 1000;
            opacity: 0;
            animation: tooltip-appear 0.15s ease-out 0.5s forwards;
          }
          
          @keyframes tooltip-appear {
            from {
              opacity: 0;
              transform: translateX(-50%) translateY(2px);
            }
            to {
              opacity: 1;
              transform: translateX(-50%) translateY(0);
            }
          }
        `}</style>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button 
          onClick={() => onResolve(item.id)} 
          className="rounded-md bg-[#ffd600] px-3 py-1.5 text-sm text-black hover:bg-[#003366] hover:text-white transition-colors"
        >
          RESOLVE
        </button>
        <button 
          onClick={() => onFeedback(item.id)} 
          disabled={feedbackDisabled}
          className={`rounded-md border px-3 py-1.5 text-sm fast-tooltip ${
            feedbackDisabled 
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
              : 'border-[#003366] text-[#003366] hover:bg-[#003366] hover:text-white'
          } transition-colors`}
          data-tooltip={feedbackDisabled ? feedbackDisabledReason : 'Send feedback form to iPad'}
        >
          FEEDBACK
        </button>
        
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
              <div className="py-1">
                {ESCALATION_DEPARTMENTS.map((dept) => (
                  <button
                    key={dept}
                    onClick={() => handleEscalateClick(dept)}
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-[#ffd600] hover:text-black transition-colors"
                  >
                    {dept}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}