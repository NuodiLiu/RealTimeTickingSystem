import { useState } from "react";
import type { DevicesListItem } from "../lib/api";

interface DeviceListProps {
  devices: DevicesListItem[];
  onModeChange?: (deviceId: string, newMode: string) => void;
}

const DEVICE_MODES = [
  { value: "dual", label: "Dual", color: "bg-blue-100 text-blue-800" },
  { value: "feedback", label: "Feedback", color: "bg-green-100 text-green-800" },
  { value: "registration", label: "Registration", color: "bg-purple-100 text-purple-800" }
];

function getStatusColor(online: boolean, mode: string) {
  if (!online) return "bg-red-100 text-red-800";
  
  // You can extend this logic based on whether device is busy/free
  return "bg-green-100 text-green-800";
}

function formatLastSeen(updatedAt: string) {
  const date = new Date(updatedAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function DeviceList({ devices, onModeChange }: DeviceListProps) {
  const [changingMode, setChangingMode] = useState<string | null>(null);

  async function handleModeChange(deviceId: string, newMode: string) {
    if (!onModeChange) return;
    
    try {
      setChangingMode(deviceId);
      await onModeChange(deviceId, newMode);
    } catch (error) {
      console.error("Failed to change mode:", error);
    } finally {
      setChangingMode(null);
    }
  }

  return (
    <div className="space-y-3">
      {devices.map((device) => (
        <div
          key={device.id}
          className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <div className="font-mono text-sm font-medium text-gray-900 truncate">
                  {device.id.split('-')[0]}...
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(
                    device.online,
                    device.mode
                  )}`}
                >
                  {device.online ? "Online" : "Offline"}
                </span>
              </div>
              
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500">Mode:</span>
                {onModeChange ? (
                  <select
                    value={device.mode}
                    onChange={(e) => handleModeChange(device.id, e.target.value)}
                    disabled={changingMode === device.id || !device.online}
                    className="text-xs border border-gray-200 rounded px-2 py-1 bg-white disabled:opacity-50"
                  >
                    {DEVICE_MODES.map((mode) => (
                      <option key={mode.value} value={mode.value}>
                        {mode.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span
                    className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium ${
                      DEVICE_MODES.find(m => m.value === device.mode)?.color || "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {DEVICE_MODES.find(m => m.value === device.mode)?.label || device.mode}
                  </span>
                )}
              </div>
              
              <div className="text-xs text-gray-500">
                Last seen: {formatLastSeen(device.updatedAt)}
              </div>
            </div>
            
            {changingMode === device.id && (
              <div className="ml-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}