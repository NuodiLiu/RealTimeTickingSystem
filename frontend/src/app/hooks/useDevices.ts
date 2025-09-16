// Real-time device updates hook with WebSocket functionality
"use client";

import { useCallback, useEffect, useState } from "react";
import { DeviceAPI } from "../lib/api";
import { io, Socket } from "socket.io-client";

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

  // Get devices filtered by mode with proper sorting
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
    // Initial load
    loadDevices();

    // Set up WebSocket connection for real-time device updates
    const socket: Socket = io(process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000', {
      path: '/ws',
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      console.log('🔌 useDevices: Device WebSocket connected');
    });

    socket.on('event', (event: { type: string; payload: any }) => {
      console.log('📱 useDevices: Device event received:', event);
      
      switch (event.type) {
        case 'device:updated':
          {
            const { id, isBusy, isOnline, currentLock } = event.payload;
            if (id) {
              console.log(`🔄 useDevices: Real-time device update: ${id} -> busy: ${isBusy}, online: ${isOnline}`);
              
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
              console.warn('⚠️ useDevices: Received device:updated event without id:', event);
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
          // For these events, we should reload the entire device list
          // as they affect the structure/existence of devices
          console.log(`Device structural change [${event.type}], reloading devices...`);
          loadDevices();
          break;

        default:
          // For any other device-related events, do a partial reload if needed
          if (event.type.startsWith('device:')) {
            console.log(`Unknown device event [${event.type}], reloading devices...`);
            loadDevices();
          }
          break;
      }
    });

    socket.on('disconnect', () => {
      console.log('Device WebSocket disconnected');
    });

    socket.on('connect_error', (err: Error) => {
      console.error('Device WebSocket connection error:', err);
    });

    // Set up periodic refresh as fallback (less frequent since we have real-time updates)
    const intervalId = setInterval(loadDevices, 30000); // Every 30 seconds

    return () => {
      console.log('Cleaning up device WebSocket and interval...');
      socket.disconnect();
      clearInterval(intervalId);
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
