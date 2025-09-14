"use client";

import { useEffect, useState, useCallback } from "react";
import DeviceList from "../DeviceList";
import QRGeneratorModal from "../QRGeneratorModal";
import { DeviceAPI, FeedbackAPI, PairAPI } from "../../lib/api";
import { toast } from 'react-hot-toast';
import { showToastPromise, handleError } from "../../lib/toaster";

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
        
        // Filter devices by mode and sort by name
        const feedbackDevs = allDevices
          .filter((device: any) => device.mode === 'FEEDBACK')
          .sort((a: any, b: any) => {
            const nameA = (a.name || a.deviceLabel || "iPad Device").toLowerCase();
            const nameB = (b.name || b.deviceLabel || "iPad Device").toLowerCase();
            return nameA.localeCompare(nameB);
          });
        
        const registrationDevs = allDevices
          .filter((device: any) => device.mode === 'REGISTRATION')
          .sort((a: any, b: any) => {
            const nameA = (a.name || a.deviceLabel || "iPad Device").toLowerCase();
            const nameB = (b.name || b.deviceLabel || "iPad Device").toLowerCase();
            return nameA.localeCompare(nameB);
          });
        
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
    try {
      await showToastPromise(
        DeviceAPI.unpair(deviceId),
        {
          loading: `Unpairing device "${deviceName}"...`,
          success: `Device "${deviceName}" has been successfully unpaired.`,
          error: `Failed to unpair device "${deviceName}".`
        }
      );
      
      // Reload devices to reflect the change
      const allDevicesRes = await DeviceAPI.list();
      const allDevices = allDevicesRes.items || [];
      
      const feedbackDevs = allDevices
        .filter((device: any) => device.mode === 'FEEDBACK')
        .sort((a: any, b: any) => {
          const nameA = (a.name || a.deviceLabel || "iPad Device").toLowerCase();
          const nameB = (b.name || b.deviceLabel || "iPad Device").toLowerCase();
          return nameA.localeCompare(nameB);
        });
      
      const registrationDevs = allDevices
        .filter((device: any) => device.mode === 'REGISTRATION')
        .sort((a: any, b: any) => {
          const nameA = (a.name || a.deviceLabel || "iPad Device").toLowerCase();
          const nameB = (b.name || b.deviceLabel || "iPad Device").toLowerCase();
          return nameA.localeCompare(nameB);
        });
      
      setFeedbackDevices(feedbackDevs);
      setRegistrationDevices(registrationDevs);
      
      // Notify parent about device update
      if (onDeviceUpdate) {
        onDeviceUpdate();
      }
    } catch (e: any) {
      // Don't call handleError here since showToastPromise already handled the error display
      console.error('Unpair device error:', e);
    }
  };

  // Toggle device mode function
  const handleToggleDeviceMode = async (deviceId: string, deviceName: string, currentMode: string) => {
    const newMode = currentMode === 'FEEDBACK' ? 'REGISTRATION' : 'FEEDBACK';

    try {
      await showToastPromise(
        DeviceAPI.changeMode(deviceId, newMode as "REGISTRATION" | "FEEDBACK"),
        {
          loading: `Switching "${deviceName}" to ${newMode} mode...`,
          success: `Device "${deviceName}" has been successfully switched to ${newMode} mode.`,
          error: `Failed to switch device "${deviceName}" to ${newMode} mode.`
        }
      );
      
      // Reload devices to reflect the change
      const allDevicesRes = await DeviceAPI.list();
      const allDevices = allDevicesRes.items || [];
      
      const feedbackDevs = allDevices
        .filter((device: any) => device.mode === 'FEEDBACK')
        .sort((a: any, b: any) => {
          const nameA = (a.name || a.deviceLabel || "iPad Device").toLowerCase();
          const nameB = (b.name || b.deviceLabel || "iPad Device").toLowerCase();
          return nameA.localeCompare(nameB);
        });
      
      const registrationDevs = allDevices
        .filter((device: any) => device.mode === 'REGISTRATION')
        .sort((a: any, b: any) => {
          const nameA = (a.name || a.deviceLabel || "iPad Device").toLowerCase();
          const nameB = (b.name || b.deviceLabel || "iPad Device").toLowerCase();
          return nameA.localeCompare(nameB);
        });
      
      setFeedbackDevices(feedbackDevs);
      setRegistrationDevices(registrationDevs);
      
      // Notify parent about device update
      if (onDeviceUpdate) {
        onDeviceUpdate();
      }
    } catch (e: any) {
      // Don't call handleError here since showToastPromise already handled the error display
      console.error('Toggle device mode error:', e);
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
  <section className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col h-full min-h-0 overflow-hidden">
        <div className="px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">iPad Devices</h2>
              {/* <p className="text-sm text-gray-600 mt-1">
                Device management & pairing
              </p> */}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={openPairModal}
                className="bg-[#ffd600] text-black px-3 py-2 rounded-md text-sm font-medium hover:bg-[#003366] hover:text-white transition-colors shadow-sm"
              >
                Pair Device
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto space-y-6 min-h-0">
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