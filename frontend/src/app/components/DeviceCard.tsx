"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { isDeviceAvailableForFeedback } from "../lib/caseUtils";

interface DeviceCardProps {
  device: any;
  isSelected: boolean;
  onSelect?: (deviceId: string) => void;
  onUnpair?: (deviceId: string, deviceName: string) => void;
  onToggleMode?: (deviceId: string, deviceName: string, currentMode: string) => void;
  onUpdateName?: (deviceId: string, newName: string) => void;
  showSelectButton?: boolean;
}

export default function DeviceCard({ 
  device, 
  isSelected, 
  onSelect, 
  onUnpair, 
  onToggleMode, 
  onUpdateName,
  showSelectButton = false 
}: DeviceCardProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [pendingName, setPendingName] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isAvailable = showSelectButton ? isDeviceAvailableForFeedback(device) : true;
  const canBeSelected = showSelectButton ? (device && device.mode === 'FEEDBACK') : true;
  const isClickable = showSelectButton && canBeSelected && onSelect;
  const deviceDisplayName = (isUpdating && pendingName) ? pendingName : (device.name || device.deviceLabel || "iPad Device");

  // Handle name editing
  const handleStartEdit = () => {
    setEditingName(deviceDisplayName);
    setIsEditingName(true);
    setShowDropdown(false);
  };

  const handleSaveName = useCallback(() => {
    const trimmedName = editingName.trim();
    const originalDeviceName = device.name || device.deviceLabel || "iPad Device";
    
    if (trimmedName && trimmedName !== originalDeviceName && onUpdateName) {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      
      // set to pending
      setIsUpdating(true);
      setPendingName(trimmedName);
      setIsEditingName(false);
      
      onUpdateName(device.deviceId, trimmedName);
      
      updateTimeoutRef.current = setTimeout(() => {
        setPendingName("");
        setIsUpdating(false);
        updateTimeoutRef.current = null;
      }, 1500);
    } else {
      setIsEditingName(false);
    }
  }, [editingName, device.deviceId, device.name, device.deviceLabel, onUpdateName]);

  const handleCancelEdit = useCallback(() => {
    setIsEditingName(false);
    setEditingName("");
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveName();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  }, [handleSaveName, handleCancelEdit]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

  // Clear pending state when device name actually updates
  useEffect(() => {
    if (isUpdating && pendingName && device.name === pendingName) {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }
      setPendingName("");
      setIsUpdating(false);
    }
  }, [device.name, pendingName, isUpdating]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

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

  // Handle clicking outside when editing name
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isEditingName && inputRef.current && !inputRef.current.contains(event.target as Node)) {
        handleSaveName();
      }
    };

    if (isEditingName) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditingName, handleSaveName]);
  
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
        className={`min-w-0 flex-1 ${isClickable ? 'cursor-pointer' : showSelectButton && !canBeSelected ? 'cursor-not-allowed' : ''} ${!device.isOnline ? 'opacity-60' : ''}`}
      >
        <div className="flex items-center justify-between">
          {isEditingName ? (
            <input
              ref={inputRef}
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="font-semibold text-gray-900 bg-transparent border-b border-blue-400 focus:border-blue-600 focus:outline-none flex-1 min-w-0 transition-colors duration-200"
              placeholder="Enter device name"
            />
          ) : (
            <h3 className="font-semibold text-gray-900 truncate">
              {deviceDisplayName}
            </h3>
          )}
        </div>
        <div className="flex items-center mt-2">
          <div
            className={`w-2 h-2 rounded-full mr-2 ${
              !device.isOnline 
                ? "bg-red-500" 
                : device.status === 'BUSY' 
                  ? "bg-yellow-500" 
                  : "bg-green-500"
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
          <div className="absolute right-0 top-8 bg-white rounded-md shadow-xl border border-gray-200 z-10 w-max overflow-hidden">
            {onUpdateName && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartEdit();
                }}
                className="block w-full px-4 py-2 text-left text-xs text-gray-700 hover:bg-gray-100 transition-colors whitespace-nowrap"
              >
                Edit Name
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDropdown(false);
                if (onToggleMode) {
                  onToggleMode(device.deviceId, deviceDisplayName, device.mode);
                }
              }}
              className="block w-full px-4 py-2 text-left text-xs text-gray-700 hover:bg-gray-100 transition-colors whitespace-nowrap"
            >
              Switch to {device.mode === 'FEEDBACK' ? 'Registration' : 'Feedback'}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDropdown(false);
                if (onUnpair) {
                  onUnpair(device.deviceId, deviceDisplayName);
                }
              }}
              className="block w-full px-4 py-2 text-left text-xs text-gray-700 hover:bg-gray-100 transition-colors whitespace-nowrap"
            >
              Unpair Device
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
