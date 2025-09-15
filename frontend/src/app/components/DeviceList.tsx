"use client";

import { useState } from "react";
import DeviceCard from "./DeviceCard";
import EmptyState from "./EmptyState";
import LoadingSkeleton from "./LoadingSkeleton";

interface DeviceListProps {
  title: string;
  devices: any[];
  loading: boolean;
  selectedDeviceId?: string | null;
  onSelect?: (deviceId: string) => void;
  onUnpair?: (deviceId: string, deviceName: string) => void;
  onToggleMode?: (deviceId: string, deviceName: string, currentMode: string) => void;
  onUpdateName?: (deviceId: string, newName: string) => void;
  showSelectButton?: boolean;
  collapsible?: boolean;
  initiallyExpanded?: boolean;
  emptyMessage?: string;
}

export default function DeviceList({
  title,
  devices,
  loading,
  selectedDeviceId,
  onSelect,
  onUnpair,
  onToggleMode,
  onUpdateName,
  showSelectButton = false,
  collapsible = false,
  initiallyExpanded = true,
  emptyMessage = "No devices available."
}: DeviceListProps) {
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);

  return (
    <div className="bg-white rounded-lg p-4 border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center">
          {title}
          <span className="ml-2 px-2 py-1 bg-white text-gray-600 text-xs rounded-full">
            {devices?.length || 0}
          </span>
        </h3>
        {collapsible && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
            title={isExpanded ? `Hide ${title.toLowerCase()}` : `Show ${title.toLowerCase()}`}
          >
            <svg 
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {isExpanded ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      
      {(!collapsible || isExpanded) && (
        <>
          {loading ? (
            <LoadingSkeleton rows={2} />
          ) : devices && devices.length > 0 ? (
            <div className="space-y-3">
              {devices.map((device: any) => (
                <DeviceCard
                  key={device.deviceId}
                  device={device}
                  isSelected={device.deviceId === selectedDeviceId}
                  onSelect={onSelect}
                  onUnpair={onUnpair}
                  onToggleMode={onToggleMode}
                  onUpdateName={onUpdateName}
                  showSelectButton={showSelectButton}
                />
              ))}
            </div>
          ) : (
            <EmptyState label={emptyMessage} />
          )}
        </>
      )}
    </div>
  );
}
