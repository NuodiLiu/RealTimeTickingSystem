"use client";

import { useEffect, useState, useCallback } from "react";
import DeviceList from "../DeviceList";
import QRGeneratorModal from "../QRGeneratorModal";
import { DeviceAPI, FeedbackAPI, PairAPI } from "../../lib/api";
import { toast } from 'react-hot-toast';

interface DevicesSectionProps {
  user: any;
  selectedDeviceId: string | null;
  onSelectDevice: (deviceId: string) => void;
  onDeviceUpdate?: () => void;
}

export default function DevicesSection({ 
  user, 
  selectedDeviceId, 
  onSelectDevice, 
  onDeviceUpdate 
}: DevicesSectionProps) {
  // Devices state - separate for feedback and registration
  const [feedbackDevices, setFeedbackDevices] = useState<any[]>([]);
  const [registrationDevices, setRegistrationDevices] = useState<any[]>([]);
  const [deviceLoading, setDeviceLoading] = useState(true);

  useEffect(() => {
    const loadDevices = async () => {
      setDeviceLoading(true);
      try {
        // Load all devices first
        const allDevicesRes = await DeviceAPI.list();
        const allDevices = allDevicesRes.items || [];
        
        // Filter devices by mode
        const feedbackDevs = allDevices.filter((device: any) => 
          device.mode === 'FEEDBACK'
        );
        const registrationDevs = allDevices.filter((device: any) => 
          device.mode === 'REGISTRATION'
        );
        
        setFeedbackDevices(feedbackDevs);
        setRegistrationDevices(registrationDevs);
      } catch (e) {
        console.error("Failed to load devices:", e);
      } finally {
        setDeviceLoading(false);
      }
    };
    loadDevices();
  }, []);

  // Unpair device function
  const handleUnpairDevice = async (deviceId: string, deviceName: string) => {
    const confirmed = window.confirm(`Are you sure you want to unpair the device "${deviceName}"? This action cannot be undone.`);
    
    if (!confirmed) return;

    try {
      await DeviceAPI.unpair(deviceId);
      
      // Reload devices to reflect the change
      const allDevicesRes = await DeviceAPI.list();
      const allDevices = allDevicesRes.items || [];
      
      const feedbackDevs = allDevices.filter((device: any) => 
        device.mode === 'FEEDBACK'
      );
      const registrationDevs = allDevices.filter((device: any) => 
        device.mode === 'REGISTRATION'
      );
      
      setFeedbackDevices(feedbackDevs);
      setRegistrationDevices(registrationDevs);
      
      toast.success(`Device "${deviceName}" has been successfully unpaired.`);
      
      // Notify parent about device update
      if (onDeviceUpdate) {
        onDeviceUpdate();
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to unpair device.");
    }
  };

  // Toggle device mode function
  const handleToggleDeviceMode = async (deviceId: string, deviceName: string, currentMode: string) => {
    const newMode = currentMode === 'FEEDBACK' ? 'REGISTRATION' : 'FEEDBACK';
    const confirmed = window.confirm(`Are you sure you want to switch "${deviceName}" from ${currentMode} mode to ${newMode} mode?`);
    
    if (!confirmed) return;

    try {
      await DeviceAPI.changeMode(deviceId, newMode as "REGISTRATION" | "FEEDBACK");
      
      // Reload devices to reflect the change
      const allDevicesRes = await DeviceAPI.list();
      const allDevices = allDevicesRes.items || [];
      
      const feedbackDevs = allDevices.filter((device: any) => 
        device.mode === 'FEEDBACK'
      );
      const registrationDevs = allDevices.filter((device: any) => 
        device.mode === 'REGISTRATION'
      );
      
      setFeedbackDevices(feedbackDevs);
      setRegistrationDevices(registrationDevs);

      toast.success(`Device "${deviceName}" has been successfully switched to ${newMode} mode.`);
      
      // Notify parent about device update
      if (onDeviceUpdate) {
        onDeviceUpdate();
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to toggle device mode.");
    }
  };

  // Export to Excel functionality
  const handleExportToExcel = async () => {
    try {
      if (user?.role !== 'ADMIN') {
        toast.error('You do not have permission to export this data.');
        return;
      }
  
      const { CasesAPI } = await import("../../lib/api");
      const XLSX = await import('xlsx');
      
      const data = await CasesAPI.exportCases();
  
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Cases');
      XLSX.writeFile(wb, 'cases_export.xlsx');

      toast.success('Records exported to Excel successfully.');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('An error occurred while exporting the data.');
    }
  };

  // Modal control state
  const [pairOpen, setPairOpen] = useState(false);

  const openPairModal = useCallback(() => {
    setPairOpen(true);
  }, []);

  const closePairModal = useCallback(() => {
    setPairOpen(false);
  }, []);

  return (
    <>
      {/* DEVICES SECTION - Mixed Static/Dynamic Content */}
      <section className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">iPad Devices</h2>
              <p className="text-sm text-gray-600 mt-1">
                Device management & pairing
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={openPairModal}
                className="bg-[#ffd600] text-black px-3 py-2 rounded-md text-sm font-medium hover:bg-[#003366] hover:text-white transition-colors shadow-sm"
              >
                Pair Device
              </button>
              {user?.role === 'ADMIN' && (
                <button
                  onClick={handleExportToExcel}
                  className="bg-[#ffd600] text-black px-3 py-2 rounded-md text-sm font-medium hover:bg-[#003366] hover:text-white transition-colors shadow-sm"
                >
                  Export to Excel
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {/* FEEDBACK DEVICES SUBSECTION */}
          <DeviceList
            title="Feedback Devices"
            devices={feedbackDevices}
            loading={deviceLoading}
            selectedDeviceId={selectedDeviceId}
            onSelect={onSelectDevice}
            onUnpair={handleUnpairDevice}
            onToggleMode={handleToggleDeviceMode}
            showSelectButton={true}
            emptyMessage="No feedback devices available."
          />

          {/* REGISTRATION DEVICES SUBSECTION */}
          <DeviceList
            title="Registration Devices"
            devices={registrationDevices}
            loading={deviceLoading}
            onUnpair={handleUnpairDevice}
            onToggleMode={handleToggleDeviceMode}
            showSelectButton={false}
            collapsible={true}
            initiallyExpanded={true}
            emptyMessage="No registration devices available."
          />
        </div>
      </section>

      <QRGeneratorModal 
        isOpen={pairOpen}
        onClose={closePairModal}
        defaultMode="DUAL"
      />
    </>
  );
}