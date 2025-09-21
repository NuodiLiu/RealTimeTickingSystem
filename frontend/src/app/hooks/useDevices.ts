// Real-time device updates hook with SignalR functionality
"use client";

import { useCallback, useEffect, useState } from "react";
import { DeviceAPI } from "../lib/api";
import { getDashboardSignalR, SignalREvent } from "../lib/signalr";

export interface Device {
  deviceId: string;
  name?: string;
  deviceLabel?: string;
  mode: 'FEEDBACK' | 'REGISTRATION';
  isOnline: boolean;
  status: 'OFFLINE' | 'IDLE' | 'BUSY';
  lastSeenAt: string;
  currentLock?: {
    id: string;
    version: number;
    case: {
      studentName: string;
      zID: string | null;
    };
  } | null;
}

export default function useDevices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load devices from API
  const loadDevices = useCallback(async () => {
    try {
      setError(null);
      const allDevicesRes = await DeviceAPI.list();
      const allDevices = (allDevicesRes.items || []) as Device[];
      setDevices(allDevices);
    } catch (e: any) {
      console.error("Failed to load devices:", e);
      setError(e?.message ?? "Failed to load devices");
    } finally {
      setLoading(false);
    }
  }, []);

  // Update a specific device in the state
  const updateDevice = useCallback((deviceId: string, updates: Partial<Device>) => {
    setDevices(currentDevices => 
      currentDevices.map(device => 
        device.deviceId === deviceId 
          ? { ...device, ...updates }
          : device
      )
    );
  }, []);

  // Get devices filtered by mode 
  const getDevicesByMode = useCallback((mode: 'FEEDBACK' | 'REGISTRATION') => {
    return devices
      .filter(device => device.mode === mode)
      .sort((a, b) => {
        const nameA = (a.name || a.deviceLabel || "iPad Device").toLowerCase();
        const nameB = (b.name || b.deviceLabel || "iPad Device").toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }, [devices]);

  useEffect(() => {
    loadDevices();

    // Set up SignalR connection for real-time device updates
    const signalR = getDashboardSignalR();
    
    const handleDeviceEvent = (event: SignalREvent) => {
      console.log('useDevices: Device event received:', event);

      switch (event.type) {
        case 'device:updated':
          {
            const { id, isBusy, isOnline, currentLock } = event.payload;
            if (id) {
              console.log(`useDevices: Real-time device update: ${id} -> busy: ${isBusy}, online: ${isOnline}`);
              
              // Only include fields that are actually provided
              const updates: Partial<Device> = {
                status: isBusy ? 'BUSY' : 'IDLE'
              };
              
              if (isOnline !== undefined) {
                updates.isOnline = isOnline;
              }
              
              if (currentLock !== undefined) {
                updates.currentLock = currentLock;
              }
              
              updateDevice(id, updates);
            } else {
              console.warn('useDevices: Received device:updated event without id:', event);
            }
          }
          break;
        
        case 'device:status_changed':
          {
            const { deviceId, status, isOnline, currentLock } = event.payload;
            if (deviceId) {
              console.log(`Real-time device status change: ${deviceId} -> ${status}`);
              updateDevice(deviceId, {
                status: status,
                isOnline: isOnline !== undefined ? isOnline : undefined,
                currentLock: currentLock !== undefined ? currentLock : undefined,
              });
            }
          }
          break;

        case 'device:online_status_changed':
          {
            const { deviceId, isOnline } = event.payload;
            if (deviceId) {
              console.log(`Real-time device online status: ${deviceId} -> ${isOnline}`);
              updateDevice(deviceId, { 
                isOnline,
                status: isOnline ? 'IDLE' : 'OFFLINE'
              });
            }
          }
          break;

        case 'device:paired':
        case 'device:unpaired':
        case 'device:mode_changed':
          console.log(`🔄 Device structural change [${event.type}], reloading devices...`, event.payload);
          loadDevices();
          break;

        default:
          if (event.type.startsWith('device:')) {
            console.log(`Unknown device event [${event.type}], reloading devices...`);
            loadDevices();
          }
          break;
      }
    };

    // Subscribe to device events
    const unsubscribeDevice = signalR.on('device:updated', handleDeviceEvent);
    const unsubscribeStatus = signalR.on('device:status_changed', handleDeviceEvent);
    const unsubscribeOnline = signalR.on('device:online_status_changed', handleDeviceEvent);
    const unsubscribePaired = signalR.on('device:paired', handleDeviceEvent);
    const unsubscribeUnpaired = signalR.on('device:unpaired', handleDeviceEvent);
    const unsubscribeModeChanged = signalR.on('device:mode_changed', handleDeviceEvent);

    // Connect to SignalR
    signalR.connect().then(() => {
      console.log('✅ useDevices: SignalR connected for device updates');
    }).catch((error) => {
      console.error('❌ useDevices: SignalR connection error:', error);
      console.log('🔍 useDevices: Current JWT:', localStorage.getItem('appJwt') ? 'Present' : 'Missing');
      console.log('🔍 useDevices: Will rely on manual refresh until SignalR is fixed');
    });

    return () => {
      console.log('Cleaning up device SignalR subscriptions...');
      unsubscribeDevice();
      unsubscribeStatus();
      unsubscribeOnline();
      unsubscribePaired();
      unsubscribeUnpaired();
      unsubscribeModeChanged();
      // Note: We don't disconnect SignalR here as it's a singleton
    };
  }, [loadDevices, updateDevice]);

  return {
    devices,
    feedbackDevices: getDevicesByMode('FEEDBACK'),
    registrationDevices: getDevicesByMode('REGISTRATION'),
    loading,
    error,
    reload: loadDevices,
    updateDevice,
  };
}
