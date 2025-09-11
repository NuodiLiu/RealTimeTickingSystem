// Utility functions for case management

export function isCasePendingFeedback(caseItem: any): boolean {
  return caseItem.status === 'resolved_pending_feedback';
}

export function isDeviceAvailableForFeedback(device: any): boolean {
  return device && 
         (device.mode === 'FEEDBACK') && 
         device.isOnline && 
         device.status !== 'BUSY';
}

export function getFeedbackDisabledReason(caseItem: any, selectedDevice: any): string {
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

export function isFeedbackDisabledForCase(caseItem: any, hasAvailableDevices: boolean): boolean {
  return isCasePendingFeedback(caseItem) || !hasAvailableDevices;
}
