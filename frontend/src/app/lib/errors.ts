// Base error class
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

// Authentication & Authorization Errors
export class TokenError extends AppError {
  constructor(message: string = "Authentication token is invalid or expired") {
    super(message);
  }
}

export class PermissionError extends AppError {
  constructor(message: string = "You don't have permission to perform this action") {
    super(message);
  }
}

export class SessionError extends AppError {
  constructor(message: string = "Your session has expired. Please log in again") {
    super(message);
  }
}

// Network & Connectivity Errors
export class NetworkError extends AppError {
  constructor(message: string = "Network connection failed. Please check your internet connection") {
    super(message);
  }
}

export class HandshakeError extends AppError {
  constructor(message: string = "Failed to establish connection with the server") {
    super(message);
  }
}

export class ApiRequestError extends AppError {
  constructor(message: string = "Request failed. Please try again") {
    super(message);
  }
}

// Device Management Errors
export class DeviceError extends AppError {
  constructor(message: string = "Device operation failed") {
    super(message);
  }
}

export class DeviceNotFoundError extends DeviceError {
  constructor(message: string = "Device not found or no longer available") {
    super(message);
  }
}

export class DeviceOfflineError extends DeviceError {
  constructor(message: string = "Device is currently offline") {
    super(message);
  }
}

export class DeviceUnpairError extends DeviceError {
  constructor(message: string = "Failed to unpair device. Please try again") {
    super(message);
  }
}

export class DevicePairingError extends DeviceError {
  constructor(message: string = "Device pairing failed. Please try again") {
    super(message);
  }
}

export class DeviceModeSwitchError extends DeviceError {
  constructor(message: string = "Failed to switch device mode. Please try again") {
    super(message);
  }
}

// Case Management Errors
export class CaseError extends AppError {
  constructor(message: string = "Case operation failed") {
    super(message);
  }
}

export class CaseNotFoundError extends CaseError {
  constructor(message: string = "Case not found") {
    super(message);
  }
}

export class CaseTakeError extends CaseError {
  constructor(message: string = "Failed to take case. It may have been taken by another staff member") {
    super(message);
  }
}

export class CaseResolveError extends CaseError {
  constructor(message: string = "Failed to resolve case. Please try again") {
    super(message);
  }
}

export class CaseEscalateError extends CaseError {
  constructor(message: string = "Failed to escalate case. Please try again") {
    super(message);
  }
}

// Feedback System Errors
export class FeedbackError extends AppError {
  constructor(message: string = "Feedback operation failed") {
    super(message);
  }
}

export class FeedbackSendError extends FeedbackError {
  constructor(message: string = "Failed to send feedback request. Please select an available device") {
    super(message);
  }
}

export class FeedbackDeviceNotSelectedError extends FeedbackError {
  constructor(message: string = "Please select an available device for feedback first") {
    super(message);
  }
}

export class FeedbackSubmissionError extends FeedbackError {
  constructor(message: string = "Failed to submit feedback. Please try again") {
    super(message);
  }
}

// Data & Validation Errors
export class FieldError extends AppError {
  public field: string;
  
  constructor(field: string, message: string = "Invalid field value") {
    super(message);
    this.field = field;
  }
}

export class ValidationError extends AppError {
  constructor(message: string = "Please check all fields and try again") {
    super(message);
  }
}

export class DataLoadError extends AppError {
  constructor(message: string = "Failed to load data. Please refresh the page") {
    super(message);
  }
}

export class ExportError extends AppError {
  constructor(message: string = "Failed to export data. Please try again") {
    super(message);
  }
}

// QR & Pairing Errors
export class QRGenerationError extends AppError {
  constructor(message: string = "Failed to generate QR code. Please try again") {
    super(message);
  }
}

export class PairingTimeoutError extends AppError {
  constructor(message: string = "Pairing code has expired. Please generate a new one") {
    super(message);
  }
}

// WebSocket & Real-time Errors
export class WebSocketError extends AppError {
  constructor(message: string = "Real-time connection lost. Some features may not work properly") {
    super(message);
  }
}

export class ConnectionLostError extends AppError {
  constructor(message: string = "Connection to server lost. Attempting to reconnect...") {
    super(message);
  }
}
