// Utility functions for case management
import { CaseItem, DevicesListItem } from './api';

export function isCasePendingFeedback(caseItem: CaseItem): boolean {
  return caseItem.status === 'RESOLVED_PENDING_FEEDBACK';
}

export function isDeviceAvailableForFeedback(device: DevicesListItem): boolean {
  return device && 
         (device.mode === 'FEEDBACK') && 
         device.isOnline && 
         device.status !== 'BUSY';
}

// New function to check if device can be used for feedback (including busy devices for override)
export function canUseDeviceForFeedback(device: DevicesListItem): boolean {
  return device && 
         (device.mode === 'FEEDBACK') && 
         device.isOnline;
}

export function getFeedbackDisabledReason(caseItem: CaseItem, selectedDevice: DevicesListItem | null): string {
  if (isCasePendingFeedback(caseItem)) {
    return 'Case is already pending feedback review';
  }
  
  if (!selectedDevice) {
    return 'Please select a device for feedback first';
  }
  
  if (!selectedDevice.isOnline) {
    return 'Selected device is offline';
  }
  
  return 'No available devices for feedback';
}

export function isFeedbackDisabledForCase(caseItem: CaseItem, hasAvailableDevices: boolean): boolean {
  // Disable if case is already pending feedback
  if (isCasePendingFeedback(caseItem)) {
    return true;
  }
  
  // Disable if no available devices
  return !hasAvailableDevices;
}
