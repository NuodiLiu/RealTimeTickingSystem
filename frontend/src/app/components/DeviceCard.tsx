"use client";

import { useEffect, useState, useRef } from "react";
import { 
  isDeviceAvailableForFeedback,
  canUseDeviceForFeedback,
} from "../lib/caseUtils";

interface DeviceCardProps {
  device: any;
  isSelected: boolean;
  onSelect?: (deviceId: string) => void;
  onUnpair?: (deviceId: string, deviceName: string) => void;
  onToggleMode?: (deviceId: string, deviceName: string, currentMode: string) => void;
  showSelectButton?: boolean;
}

export default function DeviceCard({ 
  device, 
  isSelected, 
  onSelect, 
  onUnpair, 
  onToggleMode, 
  showSelectButton = false 
}: DeviceCardProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isAvailable = showSelectButton ? isDeviceAvailableForFeedback(device) : true;
  const canBeUsed = showSelectButton ? canUseDeviceForFeedback(device) : true;
  const isClickable = showSelectButton && canBeUsed && onSelect;
  const deviceDisplayName = device.name || device.deviceLabel || "iPad Device";

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);
  
  return (
    <div
      className={`
        flex justify-between p-4 border rounded-md shadow-sm transition-all duration-200 ease-in-out
        ${isSelected ? 'border-[#ffd600] bg-white' : 'border-gray-200 bg-white'}
        ${isSelected ? 'ring-2 ring-[#ffd600]/30' : ''}
      `}
    >
      <div 
        onClick={() => isClickable && onSelect(device.deviceId)}
        className={`min-w-0 flex-1 ${isClickable ? 'cursor-pointer' : showSelectButton && !canBeUsed ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 truncate">
            {deviceDisplayName}
          </h3>
        </div>
        <p className="text-sm text-zinc-500 mt-1">
          Mode: <span className="font-medium">{device.mode}</span>
        </p>
        <div className="flex items-center mt-2">
          <div
            className={`w-2 h-2 rounded-full mr-2 ${
              device.isOnline ? "bg-green-500" : "bg-red-500"
            }`}
          />
          {device.status && (
            <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
              {device.status}
            </span>
          )}
        </div>
        {device.lastSeenAt && (
          <p className="text-xs text-zinc-400 mt-1">
            Last seen: {new Date(device.lastSeenAt).toLocaleTimeString()}
          </p>
        )}
        {showSelectButton && !canBeUsed && (
          <p className="text-xs text-[#D03E16] mt-1">
            {!device.isOnline 
              ? "Device is offline" 
              : "Device mode doesn't support feedback"}
          </p>
        )}
      </div>
      
      {/* Action dropdown */}
      <div className="flex-shrink-0 ml-3 relative" ref={dropdownRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowDropdown(!showDropdown);
          }}
          className="p-2 rounded-md hover:bg-gray-100 transition-colors"
          title="Device actions"
        >
          <svg className="w-4 h-4 text-gray-500 transform rotate-90" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>

        {showDropdown && (
          <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-md shadow-lg z-10 w-max">
            <div className="py-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDropdown(false);
                  if (onUnpair) {
                    onUnpair(device.deviceId, deviceDisplayName);
                  }
                }}
                className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 transition-colors whitespace-nowrap"
              >
                Unpair Device
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDropdown(false);
                  if (onToggleMode) {
                    onToggleMode(device.deviceId, deviceDisplayName, device.mode);
                  }
                }}
                className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 transition-colors whitespace-nowrap"
              >
                Switch to {device.mode === 'FEEDBACK' ? 'Registration' : 'Feedback'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
