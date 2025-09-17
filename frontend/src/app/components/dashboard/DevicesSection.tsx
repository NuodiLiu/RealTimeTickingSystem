"use client";

import { useEffect, useState, useCallback } from "react";
import DeviceList from "../DeviceList";
import QRGeneratorModal from "../QRGeneratorModal";
import { DeviceAPI, FeedbackAPI, PairAPI } from "../../lib/api";
import { toast } from 'react-hot-toast';
import { showToastPromise, handleError } from "../../lib/toaster";
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
  const { feedbackDevices, registrationDevices, loading: deviceLoading, reload: reloadDevices } = useDevices();


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
      
      // Device list will update automatically via WebSocket
      if (reloadDevices) {
        reloadDevices();
      }
      
      // Notify parent about device update
      if (onDeviceUpdate) {
        onDeviceUpdate();
      }
    } catch (e: any) {
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
      
      if (reloadDevices) {
        reloadDevices(); 
      }
      
      if (onDeviceUpdate) {
        onDeviceUpdate();
      }
    } catch (e: any) {
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
      
      if (reloadDevices) {
        reloadDevices(); 
      }
      
      // Notify parent about device update
      if (onDeviceUpdate) {
        onDeviceUpdate();
      }
    } catch (e: any) {
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
      {/* DEVICES SECTION */}
      <section className="bg-white rounded-none lg:rounded-lg shadow-sm border border-gray-200 flex flex-col h-full min-h-0 overflow-hidden">
        {showHeader && (
          <div className="px-6 py-4 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">iPad Devices</h2>
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
          {/* FEEDBACK DEVICES */}
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

          {/* REGISTRATION DEVICES */}
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