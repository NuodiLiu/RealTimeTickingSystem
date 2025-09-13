interface DeviceCardProps {
  device: any;
  isSelected: boolean;
  onSelect?: (deviceId: string) => void;
  onUnpair?: (deviceId: string, deviceName: string) => void;
  showSelectButton?: boolean;
}

export default function DeviceCard({ 
  device, 
  isSelected, 
  onSelect, 
  onUnpair, 
  showSelectButton = false 
}: DeviceCardProps) {
  const isDeviceAvailableForFeedback = (device: any) => {
    return device.isOnline && device.mode !== "REGISTRATION_ONLY";
  };

  const isAvailable = showSelectButton ? isDeviceAvailableForFeedback(device) : true;
  const isClickable = showSelectButton && isAvailable && onSelect;
  const deviceDisplayName = device.name || device.deviceLabel || "iPad Device";
  
  return (
    <div
      className={`
        flex justify-between p-4 border rounded-md shadow-sm transition-all
        ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}
        ${isSelected ? 'ring-2 ring-blue-200' : ''}
      `}
    >
      <div 
        onClick={() => isClickable && onSelect(device.deviceId)}
        className={`min-w-0 flex-1 ${isClickable ? 'cursor-pointer' : showSelectButton ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 truncate">
            {deviceDisplayName}
          </h3>
          {isSelected && showSelectButton && (
            <span className="px-2 py-1 text-xs font-medium text-blue-600 bg-blue-100 rounded-full">
              Selected
            </span>
          )}
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
          <span className="text-sm text-zinc-600">
            {device.isOnline ? "Online" : "Offline"}
          </span>
          {device.status && (
            <span className="ml-2 px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
              {device.status}
            </span>
          )}
        </div>
        {device.lastSeenAt && (
          <p className="text-xs text-zinc-400 mt-1">
            Last seen: {new Date(device.lastSeenAt).toLocaleTimeString()}
          </p>
        )}
        {showSelectButton && !isAvailable && (
          <p className="text-xs text-[#D03E16] mt-1">
            {!device.isOnline ? "Device is offline" : "Device mode doesn't support feedback"}
          </p>
        )}
      </div>
      
      {/* Unpair button */}
      <div className="flex-shrink-0 ml-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onUnpair) {
              onUnpair(device.deviceId, deviceDisplayName);
            }
          }}
          className="px-2 py-1 text-xs text-white bg-[#D03E16] border border-[#D03E16] rounded hover:bg-[#D03E16]/80 transition-colors"
          title="Unpair this device"
        >
          Unpair
        </button>
      </div>
    </div>
  );
}
