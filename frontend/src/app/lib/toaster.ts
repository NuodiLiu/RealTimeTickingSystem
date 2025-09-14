import toast from "react-hot-toast";
import React from "react";
import {
  AppError, TokenError, NetworkError, PermissionError, SessionError,
  HandshakeError, ApiRequestError, DeviceError, DeviceNotFoundError,
  DeviceOfflineError, DeviceUnpairError, DevicePairingError, DeviceModeSwitchError,
  CaseError, CaseNotFoundError, CaseTakeError, CaseResolveError, CaseEscalateError,
  FeedbackError, FeedbackSendError, FeedbackDeviceNotSelectedError, FeedbackSubmissionError,
  FieldError, ValidationError, DataLoadError, ExportError,
  QRGenerationError, PairingTimeoutError, WebSocketError, ConnectionLostError
} from "./errors";
import { ApiError } from "./api";

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
          // Don't call handleError here to prevent duplicate toasts
          // Let the calling code handle errors if needed
          const message = typeof messages.error === 'function' 
            ? messages.error(error) 
            : messages.error ?? "Operation failed";
          return message;
        },
      },
      { 
        duration: 3000,
        style: {
          borderRadius: '8px',
          background: '#fff',
          color: '#111827',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
          fontSize: '14px',
          fontWeight: '400',
          padding: '12px 16px',
        },
        loading: {
          style: {
            borderRadius: '8px',
            background: '#fff',
            color: '#6b7280',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
            fontSize: '14px',
            fontWeight: '400',
            padding: '12px 16px',
          }
        },
        success: {
          style: {
            borderRadius: '8px',
            background: '#dcfce7',
            color: '#166534',
            border: '1px solid #bbf7d0',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
            fontSize: '14px',
            fontWeight: '500',
            padding: '12px 16px',
          }
        },
        error: {
          style: {
            borderRadius: '8px',
            background: '#fecaca',
            color: '#991b1b',
            border: '1px solid #f87171',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
            fontSize: '14px',
            fontWeight: '500',
            padding: '12px 16px',
          }
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
    showError("An unexpected error occurred");
    return;
  }

  // Handle network/connectivity issues first (most common when offline)
  if (error instanceof TypeError && error.message.includes('fetch')) {
    showError("Connection error. Please check your internet connection and try again.");
    return;
  }

  // Handle API errors from backend
  if (error instanceof ApiError) {
    // Network/connectivity issues
    if (error.status === 0 || error.status >= 500) {
      // Status 0 usually means network error, 500+ means server issues
      showError("Connection error. Please check your internet connection and try again.");
      return;
    }
    
    // Authentication issues
    if (error.status === 401) {
      showError("Your session has expired. Please log in again.");
      return;
    }
    
    // Permission issues
    if (error.status === 403) {
      showError("You don't have permission to perform this action.");
      return;
    }
    
    // Not found
    if (error.status === 404) {
      showError("The requested resource could not be found.");
      return;
    }
    
    // Client errors (400-499) - show the backend message but sanitize it
    if (error.status >= 400 && error.status < 500) {
      const message = typeof error.message === 'string' ? error.message : "Request failed. Please try again.";
      // Filter out technical database/internal messages
      if (message.toLowerCase().includes('database') || 
          message.toLowerCase().includes('connection') ||
          message.toLowerCase().includes('prisma') ||
          message.toLowerCase().includes('sql')) {
        showError("Service temporarily unavailable. Please try again in a moment.");
      } else {
        showError(message);
      }
      return;
    }
    
    // Fallback for other API errors
    showError("Service temporarily unavailable. Please try again in a moment.");
    return;
  }

  // Handle field validation errors with focus
  if (error instanceof FieldError) {
    const fieldElement = document.querySelector(
      `[name="${error.field}"]`
    ) as HTMLElement;
    fieldElement?.focus();
    showError(error.message);
    return;
  }

  // Authentication & Authorization
  if (error instanceof TokenError || error instanceof SessionError) {
    showError(error.message);
    return;
  }

  if (error instanceof PermissionError) {
    showError(error.message);
    return;
  }

  // Network & Connectivity
  if (error instanceof NetworkError) {
    showError("Connection error. Please check your internet connection and try again.");
    return;
  }

//   if (error instanceof HandshakeError) {
//     showError("Connection error. Please check your internet connection and try again.");
//     return;
//   }

  if (error instanceof ConnectionLostError) {
    createManagedToast(() => 
      toast.error("Connection lost. Please check your internet connection.", {
        duration: 5000,
        icon: '🔄',
        style: {
          borderRadius: '8px',
          background: '#fecaca',
          color: '#991b1b',
          border: '1px solid #f87171',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
          fontSize: '14px',
          fontWeight: '500',
          padding: '12px 16px',
        }
      })
    );
    return;
  }

  // Device Management
  if (error instanceof DeviceUnpairError) {
    showError(error.message);
    return;
  }

  if (error instanceof DevicePairingError) {
    showError(error.message);
    return;
  }

  if (error instanceof DeviceModeSwitchError) {
    showError(error.message);
    return;
  }

  if (error instanceof DeviceOfflineError) {
    showError(error.message);
    return;
  }

  if (error instanceof DeviceNotFoundError) {
    showError(error.message);
    return;
  }

  // Case Management
  if (error instanceof CaseTakeError) {
    showError(error.message);
    return;
  }

  if (error instanceof CaseResolveError) {
    showError(error.message);
    return;
  }

  if (error instanceof CaseEscalateError) {
    showError(error.message);
    return;
  }

  if (error instanceof CaseNotFoundError) {
    showError(error.message);
    return;
  }

  // Feedback System
  if (error instanceof FeedbackDeviceNotSelectedError) {
    showError(error.message);
    return;
  }

  if (error instanceof FeedbackSendError) {
    showError(error.message);
    return;
  }

  if (error instanceof FeedbackSubmissionError) {
    showError(error.message);
    return;
  }

  // Data & Export
  if (error instanceof DataLoadError) {
    showError(error.message);
    return;
  }

  if (error instanceof ExportError) {
    showError(error.message);
    return;
  }

  // QR & Pairing
  if (error instanceof QRGenerationError) {
    showError(error.message);
    return;
  }

  if (error instanceof PairingTimeoutError) {
    showError(error.message);
    return;
  }

  // WebSocket
  if (error instanceof WebSocketError) {
    createManagedToast(() => 
      toast.error("Real-time updates unavailable. Some features may not work properly.", {
        duration: 5000,
        icon: '⚠️',
        style: {
          borderRadius: '8px',
          background: '#fecaca',
          color: '#991b1b',
          border: '1px solid #f87171',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
          fontSize: '14px',
          fontWeight: '500',
          padding: '12px 16px',
        }
      })
    );
    return;
  }

  // Generic error types
  if (error instanceof ValidationError) {
    showError(error.message);
    return;
  }

  if (error instanceof AppError) {
    showError(error.message);
    return;
  }

  // Handle string errors
  if (typeof error === "string") {
    // Filter out technical database/internal error strings
    if (error.toLowerCase().includes('database') || 
        error.toLowerCase().includes('connection') ||
        error.toLowerCase().includes('prisma') ||
        error.toLowerCase().includes('sql') ||
        error.toLowerCase().includes('fetch')) {
      showError("Connection error. Please check your internet connection and try again.");
    } else {
      showError(error);
    }
    return;
  }

  // Handle generic Error objects
  if (error instanceof Error) {
    // Check for network-related error messages
    if (error.message.toLowerCase().includes('fetch') ||
        error.message.toLowerCase().includes('network') ||
        error.message.toLowerCase().includes('connection') ||
        error.message.toLowerCase().includes('timeout')) {
      showError("Connection error. Please check your internet connection and try again.");
      return;
    }
    
    // Filter out technical database/internal messages
    if (error.message.toLowerCase().includes('database') ||
        error.message.toLowerCase().includes('prisma') ||
        error.message.toLowerCase().includes('sql')) {
      showError("Service temporarily unavailable. Please try again in a moment.");
      return;
    }
    
    // Don't show raw backend errors to users
    console.error("Backend error:", error);
    showError("Something went wrong. Please try again.");
    return;
  }

  // Last resort
  console.error("Unknown error:", error);
  showError("Something went wrong. Please try again.");
}

/**
 * Quick success toast
 */
export function showSuccess(message: string): void {
  // Success toasts don't enforce limits as they're less intrusive
  toast.success(message, {
    duration: 3000,
    style: {
      borderRadius: '8px',
      background: '#dcfce7',
      color: '#166534',
      border: '1px solid #bbf7d0',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      fontSize: '14px',
      fontWeight: '500',
      padding: '12px 16px',
    }
  });
}

/**
 * Quick error toast
 */
export function showError(message: string): void {
  createManagedToast(() => 
    toast.error(message, {
      duration: 4000,
      style: {
        borderRadius: '8px',
        background: '#fecaca',
        color: '#991b1b',
        border: '1px solid #f87171',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        fontSize: '14px',
        fontWeight: '500',
        padding: '12px 16px',
      }
    })
  );
}

/**
 * Quick info toast
 */
export function showInfo(message: string): void {
  createManagedToast(() => 
    toast(message, {
      duration: 3000,
      icon: 'ℹ️',
      style: {
        borderRadius: '8px',
        background: '#bfdbfe',
        color: '#1e40af',
        border: '1px solid #93c5fd',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        fontSize: '14px',
        fontWeight: '500',
        padding: '12px 16px',
      }
    })
  );
}

/**
 * Quick warning toast
 */
export function showWarning(message: string): void {
  createManagedToast(() => 
    toast(message, {
      duration: 4000,
      icon: '⚠️',
      style: {
        borderRadius: '8px',
        background: '#fde68a',
        color: '#92400e',
        border: '1px solid #fbbf24',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        fontSize: '14px',
        fontWeight: '500',
        padding: '12px 16px',
      }
    })
  );
}

// Track active confirmation dialogs to prevent stacking
let activeConfirmationId: string | null = null;

// Track active toasts to enforce limits
let activeToasts: Set<string> = new Set();
const MAX_TOASTS = 3;

// Helper function to enforce toast limits
function enforceToastLimit(): void {
  if (activeToasts.size >= MAX_TOASTS) {
    // Get the oldest toast and dismiss it
    const oldestToastId = Array.from(activeToasts)[0];
    toast.dismiss(oldestToastId);
    activeToasts.delete(oldestToastId);
  }
}

// Helper function to track and manage toast lifecycle
function createManagedToast(
  toastFunction: () => string,
  shouldEnforceLimit: boolean = true
): string {
  if (shouldEnforceLimit) {
    enforceToastLimit();
  }
  
  const toastId = toastFunction();
  
  if (shouldEnforceLimit) {
    activeToasts.add(toastId);
    
    // Clean up when toast is dismissed
    const cleanup = () => {
      activeToasts.delete(toastId);
    };
    
    // Set a timeout to clean up in case the toast auto-dismisses
    setTimeout(() => {
      cleanup();
    }, 5000); // Adjust based on your toast durations
  }
  
  return toastId;
}

/**
 * Confirmation toast with promise return for async handling
 * Returns a promise that resolves to true if confirmed, false if cancelled
 */
export function showConfirmation(
  message: string,
  options?: {
    confirmText?: string;
    cancelText?: string;
    destructive?: boolean;
  }
): Promise<boolean> {
  const { confirmText = 'Confirm', cancelText = 'Cancel', destructive = false } = options || {};
  
  // If there's already an active confirmation, dismiss it first
  if (activeConfirmationId) {
    toast.dismiss(activeConfirmationId);
    activeConfirmationId = null;
  }
  
  // Parse message for bold formatting (**text**)
  const parseMessage = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const boldText = part.slice(2, -2);
        return React.createElement('span', {
          key: index,
          className: 'font-semibold text-zinc-900'
        }, boldText);
      }
      return part;
    });
  };
  
  return new Promise((resolve) => {
    const toastId = toast(
      (t) => {
        // Store the toast ID as the active confirmation
        activeConfirmationId = t.id;
        
        return React.createElement('div', {
          className: 'flex flex-col gap-4'
        }, [
          React.createElement('div', {
            key: 'message',
            className: 'text-sm leading-relaxed text-zinc-700',
            style: { lineHeight: '1.5', whiteSpace: 'pre-line' }
          }, parseMessage(message)),
          React.createElement('div', {
            key: 'buttons',
            className: 'flex gap-3 justify-end'
          }, [
            React.createElement('button', {
              key: 'cancel',
              className: 'px-4 py-2 text-sm font-medium text-zinc-600 bg-white hover:bg-zinc-50 border border-zinc-300 rounded-md transition-all duration-200 hover:shadow-sm',
              onClick: () => {
                toast.dismiss(t.id);
                activeConfirmationId = null;
                resolve(false);
              }
            }, cancelText),
            React.createElement('button', {
              key: 'confirm',
              className: destructive
                ? 'px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-all duration-200 hover:shadow-sm'
                : 'px-4 py-2 text-sm font-medium text-zinc-900 bg-[#ffd600] hover:bg-[#003366] hover:text-white rounded-md transition-all duration-200 hover:shadow-sm',
              onClick: () => {
                toast.dismiss(t.id);
                activeConfirmationId = null;
                resolve(true);
              }
            }, confirmText)
          ])
        ]);
      },
      {
        duration: Infinity,
        style: {
          borderRadius: '8px',
          background: '#ffffff',
          border: '1px solid #e4e4e7',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          padding: '20px',
          minWidth: '400px',
          maxWidth: '500px',
          fontSize: '14px',
        },
      }
    );
  });
}
