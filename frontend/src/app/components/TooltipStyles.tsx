"use client";

export default function TooltipStyles() {
  return (
    <style jsx global>{`
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
      
      .animate-smooth-pop {
        animation: smooth-pop 0.8s ease-out;
      }
      
      /* Fast tooltip implementation - smaller, single-line */
      .fast-tooltip {
        position: relative;
        overflow: visible;
      }
      
      .fast-tooltip:hover::after {
        content: attr(data-tooltip);
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        margin-top: 6px;
        padding: 4px 8px;
        background: #1f2937;
        color: white;
        font-size: 12px;
        border-radius: 4px;
        z-index: 99999;
        opacity: 0;
        animation: tooltip-appear 0.15s ease-out 0.5s forwards;
        pointer-events: none;
        border: 1px solid #374151;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        white-space: nowrap;
      }
      
      .fast-tooltip:hover::before {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        margin-top: 0px;
        border: 4px solid transparent;
        border-bottom-color: #1f2937;
        z-index: 99999;
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
  );
}
