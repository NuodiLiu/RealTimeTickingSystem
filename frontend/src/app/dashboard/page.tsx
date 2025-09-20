"use client";

import { useEffect, useState } from "react";
import Header from "../components/Header";
import LoadingSkeleton from "../components/LoadingSkeleton";
import DevicesSection from "../components/dashboard/DevicesSection";
import QueueSection from "../components/dashboard/QueueSection";
import ActiveCasesSection from "../components/dashboard/ActiveCasesSection";
import ResponsiveLayout from "../components/layout/ResponsiveLayout";
import QRGeneratorModal from "../components/QRGeneratorModal";
import ExcelExportModal from "../components/ExcelExport/ExcelExportModal";
import { useAuthStore } from "../stores/authStore";
import useQueue from "../hooks/useQueue";
import useDevices from "../hooks/useDevices";
import { FeedbackAPI, HealthAPI } from "../lib/api";
import { 
  isCasePendingFeedback,
  getFeedbackDisabledReason,
  isFeedbackDisabledForCase
} from "../lib/caseUtils";
import { toast, Toaster } from 'react-hot-toast'
import { showConfirmation, showToastPromise } from "../lib/toaster";
import { AuthGuard } from "../components/AuthGuard";

function DashboardContent() {
  console.log('[DashboardPage] Dashboard page loading...');
  const { user, isLoading, logout } = useAuthStore();
  console.log('[DashboardPage] Auth state:', { user: !!user, isLoading, userId: user?.id });
  
  const { queued, myActive, loading, take, takeNext, resolve, escalate, reload } = useQueue(user?.id);
  const { feedbackDevices, reload: reloadDevices } = useDevices();

  // Device selection state
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [pairModalOpen, setPairModalOpen] = useState<boolean>(false);
  const [excelModalOpen, setExcelModalOpen] = useState<boolean>(false);

  // Load selected device from localStorage on mount
  useEffect(() => {
    const savedDeviceId = localStorage.getItem('selected-feedback-device');
    if (savedDeviceId) {
      setSelectedDeviceId(savedDeviceId);
    }
  }, []);

  // Auth check - redirect to login if not authenticated
  useEffect(() => {
    console.log('[DashboardPage] Auth check effect:', { isLoading, user: !!user });
    if (!isLoading && !user) {
      console.log('[DashboardPage] No user found, redirecting to login');
      window.location.href = '/login';
    }
  }, [isLoading, user]);

  // Separate effect to validate selected device when devices or selection changes
  useEffect(() => {
    if (selectedDeviceId && feedbackDevices.length > 0) {
      const selectedDevice = feedbackDevices.find((d: any) => d.deviceId === selectedDeviceId);
      if (!selectedDevice || selectedDevice.mode !== 'FEEDBACK') {
        setSelectedDeviceId(null);
        localStorage.removeItem('selected-feedback-device');
        console.log('Cleared invalid device selection:', selectedDeviceId);
      }
    }
  }, [selectedDeviceId, feedbackDevices]);

  // Note: Removed frontend health check polling as it was not used in the UI
  // Device status monitoring is handled via real-time WebSocket connections

  // global error handlers to prevent unhandled promise rejections
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.log('Caught unhandled promise rejection:', event.reason);
      
      // Check if network/database related error
      const errorMessage = event.reason?.message || String(event.reason || '').toLowerCase();
      const isNetworkError = errorMessage.includes('database') ||
                           errorMessage.includes('network') ||
                           errorMessage.includes('connection') ||
                           errorMessage.includes('fetch') ||
                           errorMessage.includes('timeout') ||
                           errorMessage.includes('offline') ||
                           errorMessage.includes('unavailable') ||
                           errorMessage.includes('prisma') ||
                           errorMessage.includes('sql') ||
                           errorMessage.includes('econnrefused') ||
                           errorMessage.includes('etimedout');
      
      if (isNetworkError) {
        event.preventDefault();
        
        // Show toast 
        setTimeout(() => {
          toast.error('Unable to connect to server. Please check your internet connection and try again.');
        }, 100);
      }
    };

    const handleError = (event: ErrorEvent) => {
      console.log('Caught global error:', event.error);
      
      const errorMessage = event.error?.message || String(event.error || '').toLowerCase();
      const isNetworkError = errorMessage.includes('database') ||
                           errorMessage.includes('network') ||
                           errorMessage.includes('connection') ||
                           errorMessage.includes('fetch') ||
                           errorMessage.includes('timeout') ||
                           errorMessage.includes('offline') ||
                           errorMessage.includes('unavailable') ||
                           errorMessage.includes('prisma') ||
                           errorMessage.includes('sql') ||
                           errorMessage.includes('econnrefused') ||
                           errorMessage.includes('etimedout');
      
      if (isNetworkError) {
        event.preventDefault();
        
        // Show toast 
        setTimeout(() => {
          toast.error('Unable to connect to server. Please check your internet connection and try again.');
        }, 100);
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  // Redirect if unauth
  useEffect(() => {
    if (!isLoading && !user) window.location.href = "/login";
  }, [isLoading, user]);

  // Handle device selection
  const handleSelectDevice = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    localStorage.setItem('selected-feedback-device', deviceId);
  };

  // Handle opening pair device modal
  const handleOpenPairModal = () => {
    setPairModalOpen(true);
  };

  // Handle closing pair device modal
  const handleClosePairModal = () => {
    setPairModalOpen(false);
  };

  // Get selected device info
  const selectedDevice = feedbackDevices.find(d => d.deviceId === selectedDeviceId);

  // Check if feedback is available (has selected device that supports feedback)
  const hasSelectedDevice = Boolean(selectedDevice && selectedDevice.mode === 'FEEDBACK');
  const isSelectedDeviceOnline = Boolean(selectedDevice && selectedDevice.isOnline);
  const isSelectedDeviceBusy = Boolean(selectedDevice && selectedDevice.status === 'BUSY');

  // Export to Excel functionality
  const handleExportToExcel = async () => {
    if (user?.role !== 'ADMIN') {
      toast.error('You do not have permission to export this data.');
      return;
    }
    
    setExcelModalOpen(true);
  };

  // Send feedback request (uses selected device, with override if busy)
  const [isProcessingFeedback, setIsProcessingFeedback] = useState(false);
  
  async function sendFeedbackRequest(caseId: string) {
    if (isProcessingFeedback) {
      return;
    }
    
    // Find the case to check its status
    const caseItem = myActive?.find(c => c.id === caseId);
    
    if (caseItem && isCasePendingFeedback(caseItem)) {
      toast.error("This case is already pending feedback review.")
      return;
    }
    
    if (!hasSelectedDevice || !selectedDevice) {
      toast.error("Please select an available device for feedback first.");
      return;
    }
    
    if (!isSelectedDeviceOnline) {
      toast.error("The selected device is currently offline. Please select an online device or wait for it to come back online.");
      return;
    }
    
    try {
      setIsProcessingFeedback(true);
      
      if (isSelectedDeviceBusy && selectedDevice.currentLock) {
        const confirmed = await showConfirmation(
          `The selected device is currently busy with **${selectedDevice.currentLock.case.studentName}** (**${selectedDevice.currentLock.case.zID || 'N/A'}**). \nOverride and send feedback request to this device?`,
          {
            confirmText: 'Override Device',
            cancelText: 'Cancel',
            destructive: true
          }
        );
        
        if (!confirmed) {
          setIsProcessingFeedback(false);
          return;
        }
        
        await showToastPromise(
          FeedbackAPI.override({
            caseId: caseId,
            deviceId: selectedDevice.deviceId,
            expectedLockId: selectedDevice.currentLock.id,
            expectedVersion: selectedDevice.currentLock.version
          }),
          {
            loading: 'Overriding device and sending feedback request...',
            success: 'Feedback request sent successfully.',
            error: 'Failed to send feedback request.'
          }
        );
      } else {
        await showToastPromise(
          FeedbackAPI.send({
            caseId: caseId,
            deviceId: selectedDevice.deviceId
          }),
          {
            loading: 'Sending feedback request...',
            success: 'Feedback request sent successfully.',
            error: 'Failed to send feedback request.'
          }
        );
      }
      
      // Reload queue data to reflect the status change
      reload();
    } catch (e: any) {
      console.error('Feedback request error:', e);
    } finally {
      setIsProcessingFeedback(false);
    }
  }

  if (isLoading) {
    return (
      <main>
        <Header staffName="…" onLogout={() => {}} />
        <div className="h-screen flex flex-col">
          <div className="flex-1 grid grid-cols-3 gap-6 p-4 overflow-hidden">
            <section className="flex flex-col min-h-0">
              <div className="mb-4 min-h-[2rem] flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Queue</h2>
                <div className="flex-shrink-0" />
              </div>
              <div className="flex-1 overflow-hidden">
                <LoadingSkeleton rows={3} />
              </div>
            </section>
            <section className="flex flex-col min-h-0">
              <div className="mb-4 min-h-[2rem] flex items-center">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">My Active Cases</h2>
              </div>
              <div className="flex-1 overflow-hidden">
                <LoadingSkeleton rows={1} />
              </div>
            </section>
            <section className="flex flex-col min-h-0">
              <div className="mb-4 min-h-[2rem] flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">iPad Devices</h2>
                <div className="flex items-center gap-2">
                  <button className="rounded-md border px-3 py-1.5 text-sm text-zinc-400" disabled>
                    Pair iPad
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <LoadingSkeleton rows={3} />
              </div>
            </section>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen flex flex-col bg-white overflow-hidden">
      <Header 
        staffName={user?.username ?? "Staff"} 
        onLogout={logout}
        showExportButton={user?.role === 'ADMIN'}
        onExportToExcel={handleExportToExcel}
      />

      <div className="flex-1 p-6 min-h-0">
        <ResponsiveLayout
          selectedDevice={selectedDevice}
          onPairDevice={handleOpenPairModal}
          queueSection={
            <QueueSection 
              queued={queued}
              loading={loading}
              takeNext={takeNext}
              take={take}
            />
          }
          activeCasesSection={
            <ActiveCasesSection 
              myActive={myActive}
              loading={loading}
              resolve={resolve}
              sendFeedbackRequest={sendFeedbackRequest}
              escalate={escalate}
              hasSelectedDevice={hasSelectedDevice}
              selectedDevice={selectedDevice}
              isSelectedDeviceOnline={isSelectedDeviceOnline}
              isFeedbackDisabledForCase={isFeedbackDisabledForCase}
              getFeedbackDisabledReason={getFeedbackDisabledReason}
            />
          }
          devicesSection={
            <DevicesSection 
              user={user}
              selectedDeviceId={selectedDeviceId}
              onSelectDevice={handleSelectDevice}
              onDeviceUpdate={reloadDevices}
            />
          }
        />
      </div>
      <Toaster />
      
      {/* QR Generator for Pair Device */}
      <QRGeneratorModal 
        isOpen={pairModalOpen}
        onClose={handleClosePairModal}
        defaultMode="DUAL"
      />

      {/* Excel Export */}
      <ExcelExportModal
        isOpen={excelModalOpen}
        onClose={() => setExcelModalOpen(false)}
        userRole={user?.role || 'STAFF'}
      />
    </main>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard requireAuth={true}>
      <DashboardContent />
    </AuthGuard>
  );
}