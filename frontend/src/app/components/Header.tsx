"use client";

import Image from "next/image";
import { useState, useRef, useEffect } from "react";

export default function Header({
  staffName = "Staff",
  onLogout,
  showExportButton = false,
  onExportToExcel,
}: {
  staffName?: string;
  onLogout: () => void;
  showExportButton?: boolean;
  onExportToExcel?: () => void;
}) {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };

    if (showUserDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserDropdown]);

  return (
    <header className="flex items-center justify-between border-b px-4 py-3">
      <div className="flex items-center gap-3">
        <Image 
          src="/img/unswcollege.png" 
          alt="UNSW College Logo" 
          width={128}
          height={128}
          className="rounded-lg object-cover"
        />
      </div>
      <div className="flex items-center gap-3">
        {/* User Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-1 px-3 py-2 rounded-md text-sm hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <span className="text-gray-900">Hello, <b>{staffName}</b></span>
            <svg 
              className={`w-4 h-4 text-gray-500 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showUserDropdown && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-md shadow-lg z-10 w-max overflow-hidden border border-gray-200">
              <button
                onClick={() => {
                  setShowUserDropdown(false);
                  onLogout();
                }}
                className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 transition-colors whitespace-nowrap"
              >
                Logout
              </button>
            </div>
          )}
        </div>

        {showExportButton && onExportToExcel && (
          <>
            <div className="w-px h-6 bg-gray-300" />
            <button
              onClick={onExportToExcel}
              className="bg-[#ffd600] text-black px-3 py-2 rounded-md text-sm font-medium hover:bg-[#003366] hover:text-white transition-colors shadow-sm"
            >
              Export to Excel
            </button>
          </>
        )}
      </div>
    </header>
  );
}