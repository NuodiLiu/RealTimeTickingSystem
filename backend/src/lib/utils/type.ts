export type ListFilters = {
  mode?: DeviceMode;                        
  status?: DeviceStatus | 'ONLINE' | 'OFFLINE';
  thresholdMinutes?: number;
};

export type DeviceMode = 'REGISTRATION' | 'FEEDBACK';
export type DeviceStatus = 'OFFLINE' | 'IDLE' | 'BUSY';

export type DeviceWithStatus = {
  deviceId: string;
  name: string;
  mode: DeviceMode;
  status: DeviceStatus;
  isOnline: boolean;
  lastSeenAt: Date;
  currentLock: {
    id: string;
    status: string;
    version: number;
    case: { id: string; zID: string; studentName: string; category: string; status: string };
    staffName: string;
    leaseExpireAt: Date;
  } | null;
};