import DeviceCard from "../DeviceCard";
import EmptyState from "../EmptyState";
import LoadingSkeleton from "../LoadingSkeleton";

interface DevicesSectionProps {
  feedbackDevices: any[];
  registrationDevices: any[];
  deviceLoading: boolean;
  selectedDeviceId: string | null;
  handleSelectDevice: (deviceId: string) => void;
  handleUnpairDevice: (deviceId: string) => void;
  openPairModal: () => void;
  handleGenerateQR: (mode: string) => void;
  handleExportToExcel: () => void;
  userRole?: string;
}

export default function DevicesSection({
  feedbackDevices,
  registrationDevices,
  deviceLoading,
  selectedDeviceId,
  handleSelectDevice,
  handleUnpairDevice,
  openPairModal,
  handleGenerateQR,
  handleExportToExcel,
  userRole
}: DevicesSectionProps) {
  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col">
      <div className="bg-purple-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">iPad Devices</h2>
            <p className="text-sm text-gray-600 mt-1">
              Device management & pairing
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                openPairModal();
                handleGenerateQR("DUAL");
              }}
              className="bg-purple-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-purple-700 transition-colors shadow-sm"
            >
              Generate QR
            </button>
            {userRole === 'ADMIN' && (
              <button
                onClick={handleExportToExcel}
                className="bg-gray-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition-colors shadow-sm"
              >
                Export to Excel
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto space-y-6">
        {/* FEEDBACK DEVICES SUBSECTION */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
            Feedback Devices
            <span className="ml-2 px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded-full">
              {feedbackDevices?.length || 0}
            </span>
          </h3>
          {deviceLoading ? (
            <LoadingSkeleton rows={2} />
          ) : feedbackDevices && feedbackDevices.length > 0 ? (
            <div className="space-y-3">
              {feedbackDevices.map((device: any) => (
                <DeviceCard
                  key={device.deviceId}
                  device={device}
                  isSelected={device.deviceId === selectedDeviceId}
                  onSelect={handleSelectDevice}
                  onUnpair={handleUnpairDevice}
                  showSelectButton={true}
                />
              ))}
            </div>
          ) : (
            <EmptyState label="No feedback devices available." />
          )}
        </div>

        {/* REGISTRATION DEVICES SUBSECTION */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
            <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
            Registration Devices
            <span className="ml-2 px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded-full">
              {registrationDevices?.length || 0}
            </span>
          </h3>
          {deviceLoading ? (
            <LoadingSkeleton rows={2} />
          ) : registrationDevices && registrationDevices.length > 0 ? (
            <div className="space-y-3">
              {registrationDevices.map((device: any) => (
                <DeviceCard
                  key={`reg-${device.deviceId}`}
                  device={device}
                  isSelected={false}
                  onUnpair={handleUnpairDevice}
                  showSelectButton={false}
                />
              ))}
            </div>
          ) : (
            <EmptyState label="No registration devices available." />
          )}
        </div>
      </div>
    </section>
  );
}
