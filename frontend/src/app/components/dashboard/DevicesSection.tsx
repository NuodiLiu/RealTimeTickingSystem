"use client";

import { useEffect, useState, useCallback } from "react";
import DeviceList from "../DeviceList";
import QRGeneratorModal from "../QRGeneratorModal";
import { DeviceAPI, FeedbackAPI, PairAPI } from "../../lib/api";
import { toast } from 'react-hot-toast';
import { showToastPromise, handleError } from "../../lib/toaster";
// Real-time device updates hook - enabled for real-time updates
import useDevices from "../../hooks/useDevices";

interface DevicesSectionProps {
  user: any;
  selectedDeviceId: string | null;
  onSelectDevice: (deviceId: string) => void;
  onDeviceUpdate?: () => void;
  showPairButton?: boolean;
  onPairDevice?: () => void;
  showHeader?: boolean;
}

export default function DevicesSection({ 
  user, 
  selectedDeviceId, 
  onSelectDevice, 
  onDeviceUpdate,
  showPairButton = true,
  onPairDevice,
  showHeader = true
}: DevicesSectionProps) {
  // Real-time implementation - WebSocket updates enabled
  const { feedbackDevices, registrationDevices, loading: deviceLoading, reload: reloadDevices } = useDevices();

  /* 
  // Legacy implementation - commented out in favor of real-time updates
  // Current implementation - devices state managed locally
  // Devices state - separate for feedback and registration
  const [feedbackDevices, setFeedbackDevices] = useState<any[]>([]);
  const [registrationDevices, setRegistrationDevices] = useState<any[]>([]);
  const [deviceLoading, setDeviceLoading] = useState(true);
  */

  /* 
  // Legacy device loading - replaced by real-time hook
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
  */

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
      
      // Real-time implementation: Device list will update automatically via WebSocket
      // Optionally trigger a manual reload if needed
      if (reloadDevices) {
        reloadDevices();
      }
      
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
      
      // Real-time implementation: Device mode changes update automatically via WebSocket
      if (reloadDevices) {
        reloadDevices(); // Manual reload for mode changes
      }
      
      // Notify parent about device update
      if (onDeviceUpdate) {
        onDeviceUpdate();
      }
    } catch (e: any) {
      // Don't call handleError here since showToastPromise already handled the error display
      console.error('Toggle device mode error:', e);
    }
  };

  // Update device name function
  const handleUpdateDeviceName = async (deviceId: string, newName: string) => {
    try {
      await showToastPromise(
        DeviceAPI.updateName(deviceId, newName),
        {
          loading: `Updating device name...`,
          success: `Device name updated successfully.`,
          error: `Failed to update device name.`
        }
      );
      
      // Real-time implementation: Device name changes update automatically via WebSocket
      if (reloadDevices) {
        reloadDevices(); // Manual reload for name changes
      }
      
      // Notify parent about device update
      if (onDeviceUpdate) {
        onDeviceUpdate();
      }
    } catch (e: any) {
      // Don't call handleError here since showToastPromise already handled the error display
      console.error('Update device name error:', e);
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
      <section className="bg-white rounded-none lg:rounded-lg shadow-sm border border-gray-200 flex flex-col h-full min-h-0 overflow-hidden">
        {showHeader && (
          <div className="px-6 py-4 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">iPad Devices</h2>
                {/* <p className="text-sm text-gray-600 mt-1">
                  Device management & pairing
                </p> */}
              </div>
              {showPairButton && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={onPairDevice || openPairModal}
                    className="bg-[#ffd600] text-black px-3 py-2 rounded-md text-sm font-medium hover:bg-[#003366] hover:text-white transition-colors shadow-sm"
                  >
                    Pair Device
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

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
            onUpdateName={handleUpdateDeviceName}
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
            onUpdateName={handleUpdateDeviceName}
            showSelectButton={false}
            collapsible={true}
            initiallyExpanded={true}
            emptyMessage="No registration devices available."
          />
        </div>
      </section>

      {showPairButton && (
        <QRGeneratorModal 
          isOpen={pairOpen}
          onClose={closePairModal}
          defaultMode="DUAL"
        />
      )}
    </>
  );
}