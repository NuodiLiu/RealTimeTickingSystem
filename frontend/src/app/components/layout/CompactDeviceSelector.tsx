"use client";

import { Smartphone } from "lucide-react";

interface CompactDeviceSelectorProps {
  selectedDevice?: any;
  className?: string;
  showStatus?: boolean;
}

export default function CompactDeviceSelector({ 
  selectedDevice, 
  className = "",
  showStatus = true 
}: CompactDeviceSelectorProps) {
  if (!selectedDevice) {
    return (
      <div className={`flex items-center text-xs sm:text-sm text-gray-500 ${className}`}>
        <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
        <span>No device selected</span>
      </div>
    );
  }

  const deviceName = selectedDevice.name || selectedDevice.deviceLabel || "iPad Device";
  const isOnline = selectedDevice.isOnline;
  
  // 获取图标颜色
  const getIconColor = () => {
    if (!isOnline) return "text-gray-400"; // offline: gray
    if (selectedDevice.status === 'BUSY') return "text-yellow-500"; // busy: yellow
    return "text-green-500"; // idle: green
  };

  return (
    <div className={`flex items-center text-xs sm:text-sm ${className}`}>
      {/* 设备图标 - 表示设备状态 */}
      <Smartphone className={`w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 ${getIconColor()}`} />
      
      {/* 设备名称 */}
      <span className="font-medium text-gray-700 truncate flex-1" title={deviceName}>
        {deviceName}
      </span>
    </div>
  );
}
