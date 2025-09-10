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
    case: { id: string; studentName: string; category: string; status: string };
    staffName: string;
    leaseExpireAt: Date;
  } | null;
};