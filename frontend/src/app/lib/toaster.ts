import toast from "react-hot-toast";
import {
  AppError, TokenError, NetworkError, PermissionError, SessionError,
  HandshakeError, ApiRequestError, DeviceError, DeviceNotFoundError,
  DeviceOfflineError, DeviceUnpairError, DevicePairingError, DeviceModeSwitchError,
  CaseError, CaseNotFoundError, CaseTakeError, CaseResolveError, CaseEscalateError,
  FeedbackError, FeedbackSendError, FeedbackDeviceNotSelectedError, FeedbackSubmissionError,
  FieldError, ValidationError, DataLoadError, ExportError,
  QRGenerationError, PairingTimeoutError, WebSocketError, ConnectionLostError
} from "./errors";

type ToastContent<T> = string | ((data: T) => string);

type ToastMessages<T> = {
  loading?: string;
  success?: ToastContent<T>;
  error?: ToastContent<any>;
};

/**
 * Promise-based toast that automatically shows loading/success/error states
 * 
 * @param promise An async function that returns a promise
 * @param messages Object containing messages for each stage
 * 
 * @example
 * ```
 * await showToastPromise(DeviceAPI.unpair(deviceId), {
 *   loading: 'Unpairing device...',
 *   success: (res) => `Device "${deviceName}" unpaired successfully`,
 *   error: (err) => 'Failed to unpair device'
 * });
 * ```
 */
let toastQueue = Promise.resolve();
const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function showToastPromise<T>(
  promise: Promise<T>,
  messages: ToastMessages<T>
): Promise<T> {
  const queued = toastQueue.then(() =>
    toast.promise(
      promise,
      {
        loading: messages.loading ?? "Loading...",
        success: messages.success ?? "Operation completed successfully",
        error: (error: unknown) => {
          handleError(error);
          return "";
        },
      },
      { 
        duration: 3000,
        style: {
          borderRadius: '8px',
          background: '#fff',
          color: '#333',
        }
      }
    )
  );

  toastQueue = queued.catch(() => {}).then(() => delay(500));

  return promise;
}

/**
 * Centralized error handler that maps error types to user-friendly messages
 */
export function handleError(error: unknown): void {
  if (!error) {
    toast.error("An unexpected error occurred");
    return;
  }

  // Handle field validation errors with focus
  if (error instanceof FieldError) {
    const fieldElement = document.querySelector(
      `[name="${error.field}"]`
    ) as HTMLElement;
    fieldElement?.focus();
    toast.error(error.message);
    return;
  }

  // Authentication & Authorization
  if (error instanceof TokenError || error instanceof SessionError) {
    toast.error(error.message);
    // Optional: Redirect to login
    return;
  }

  if (error instanceof PermissionError) {
    toast.error(error.message);
    return;
  }

  // Network & Connectivity
  if (error instanceof NetworkError) {
    toast.error(error.message);
    return;
  }

  if (error instanceof HandshakeError) {
    toast.error(error.message);
    return;
  }

  if (error instanceof ConnectionLostError) {
    toast.error(error.message, {
      duration: 5000,
      icon: '🔄',
    });
    return;
  }

  // Device Management
  if (error instanceof DeviceUnpairError) {
    toast.error(error.message);
    return;
  }

  if (error instanceof DevicePairingError) {
    toast.error(error.message);
    return;
  }

  if (error instanceof DeviceModeSwitchError) {
    toast.error(error.message);
    return;
  }

  if (error instanceof DeviceOfflineError) {
    toast.error(error.message);
    return;
  }

  if (error instanceof DeviceNotFoundError) {
    toast.error(error.message);
    return;
  }

  // Case Management
  if (error instanceof CaseTakeError) {
    toast.error(error.message);
    return;
  }

  if (error instanceof CaseResolveError) {
    toast.error(error.message);
    return;
  }

  if (error instanceof CaseEscalateError) {
    toast.error(error.message);
    return;
  }

  if (error instanceof CaseNotFoundError) {
    toast.error(error.message);
    return;
  }

  // Feedback System
  if (error instanceof FeedbackDeviceNotSelectedError) {
    toast.error(error.message);
    return;
  }

  if (error instanceof FeedbackSendError) {
    toast.error(error.message);
    return;
  }

  if (error instanceof FeedbackSubmissionError) {
    toast.error(error.message);
    return;
  }

  // Data & Export
  if (error instanceof DataLoadError) {
    toast.error(error.message);
    return;
  }

  if (error instanceof ExportError) {
    toast.error(error.message);
    return;
  }

  // QR & Pairing
  if (error instanceof QRGenerationError) {
    toast.error(error.message);
    return;
  }

  if (error instanceof PairingTimeoutError) {
    toast.error(error.message);
    return;
  }

  // WebSocket
  if (error instanceof WebSocketError) {
    toast.error("Real-time updates unavailable. Some features may not work properly.", {
      duration: 5000,
      icon: '⚠️',
    });
    return;
  }

  // Generic error types
  if (error instanceof ValidationError) {
    toast.error(error.message);
    return;
  }

  if (error instanceof AppError) {
    toast.error(error.message);
    return;
  }

  // Handle string errors
  if (typeof error === "string") {
    toast.error(error);
    return;
  }

  // Handle generic Error objects
  if (error instanceof Error) {
    // Don't show raw backend errors to users
    console.error("Backend error:", error);
    toast.error(error.message);
    return;
  }

  // Last resort
  console.error("Unknown error:", error);
  toast.error("An unexpected error occurred. Please try again.");
}

/**
 * Quick success toast
 */
export function showSuccess(message: string): void {
  toast.success(message, {
    duration: 3000,
    style: {
      borderRadius: '8px',
      background: '#10B981',
      color: '#fff',
    }
  });
}

/**
 * Quick error toast
 */
export function showError(message: string): void {
  toast.error(message, {
    duration: 4000,
    style: {
      borderRadius: '8px',
      background: '#EF4444',
      color: '#fff',
    }
  });
}

/**
 * Quick info toast
 */
export function showInfo(message: string): void {
  toast(message, {
    duration: 3000,
    icon: 'ℹ️',
    style: {
      borderRadius: '8px',
      background: '#3B82F6',
      color: '#fff',
    }
  });
}

/**
 * Quick warning toast
 */
export function showWarning(message: string): void {
  toast(message, {
    duration: 4000,
    icon: '⚠️',
    style: {
      borderRadius: '8px',
      background: '#F59E0B',
      color: '#fff',
    }
  });
}
