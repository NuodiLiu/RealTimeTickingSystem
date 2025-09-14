"use client";

import { useEffect, useState } from "react";
import Header from "../components/Header";
import CaseCard from "../components/CaseCard";
import LoadingSkeleton from "../components/LoadingSkeleton";
import DevicesSection from "../components/dashboard/DevicesSection";
import QueueSection from "../components/dashboard/QueueSection";
import ActiveCasesSection from "../components/dashboard/ActiveCasesSection";
import useAuth from "../hooks/useAuth";
import useQueue from "../hooks/useQueue";
import { DeviceAPI, FeedbackAPI, HealthAPI } from "../lib/api";
import { 
  isCasePendingFeedback,
  canUseDeviceForFeedback,
  getFeedbackDisabledReason,
  isFeedbackDisabledForCase
} from "../lib/caseUtils";
import { toast, Toaster } from 'react-hot-toast'

export default function DashboardPage() {
  const { user, booting, logout } = useAuth();
  const { queued, myActive, loading, take, takeNext, resolve, escalate, reload } = useQueue(user?.id);

  // Devices state for feedback functionality
  const [feedbackDevices, setFeedbackDevices] = useState<any[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  // Load selected device from localStorage on mount
  useEffect(() => {
    const savedDeviceId = localStorage.getItem('selected-feedback-device');
    if (savedDeviceId) {
      setSelectedDeviceId(savedDeviceId);
    }
  }, []);

  useEffect(() => {
    const loadDevices = async () => {
      try {
        // Load all devices first
        const allDevicesRes = await DeviceAPI.list();
        const allDevices = allDevicesRes.items || [];
        
        // Filter devices by mode
        const feedbackDevs = allDevices.filter((device: any) => 
          device.mode === 'FEEDBACK'
        );
        
        setFeedbackDevices(feedbackDevs);
      } catch (e) {
        console.error("Failed to load devices:", e);
      }
    };
    loadDevices();
  }, []);

  // Separate effect to validate selected device when devices or selection changes
  useEffect(() => {
    if (selectedDeviceId && feedbackDevices.length > 0) {
      const selectedDevice = feedbackDevices.find((d: any) => d.deviceId === selectedDeviceId);
      if (!selectedDevice || !canUseDeviceForFeedback(selectedDevice)) {
        // Clear invalid selection
        setSelectedDeviceId(null);
        localStorage.removeItem('selected-feedback-device');
        console.log('Cleared invalid device selection:', selectedDeviceId);
      }
    }
  }, [selectedDeviceId, feedbackDevices]);

    // Health ping
  const [online, setOnline] = useState<boolean>(true);
  useEffect(() => {
    let timer: any;
    const ping = async () => {
      const isOnline = await HealthAPI.check();
      setOnline(isOnline);
    };
    ping();
    timer = setInterval(ping, 5000);
    return () => clearInterval(timer);
  }, []);

  // Redirect if unauth
  useEffect(() => {
    if (!booting && !user) window.location.href = "/login";
  }, [booting, user]);

  // Handle device selection
  const handleSelectDevice = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    localStorage.setItem('selected-feedback-device', deviceId);
  };

  // Get selected device info
  const selectedDevice = feedbackDevices.find(d => d.deviceId === selectedDeviceId);

  // Check if feedback is available (has selected online device that supports feedback)
  const hasSelectedDevice = selectedDevice && canUseDeviceForFeedback(selectedDevice);
  const isSelectedDeviceBusy = selectedDevice && selectedDevice.status === 'BUSY';

  // Export to Excel functionality
  const handleExportToExcel = async () => {
    try {
      if (user?.role !== 'ADMIN') {
        toast.error('You do not have permission to export this data.');
        return;
      }
  
      const { CasesAPI } = await import("../lib/api");
      const XLSX = await import('xlsx');
      
      const data = await CasesAPI.exportCases();
  
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Cases');
      XLSX.writeFile(wb, 'cases_export.xlsx');

      toast.success('Records exported to Excel successfully.');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('An error occurred while exporting the data.');
    }
  };

  // Send feedback request (uses selected device, with override if busy)
  async function sendFeedbackRequest(caseId: string) {
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
    
    try {
      if (isSelectedDeviceBusy && selectedDevice.currentLock) {
        // Device is busy, use override API
        const confirmed = window.confirm(
          `The selected device is currently busy with case "${selectedDevice.currentLock.case.studentName}" (zID: ${selectedDevice.currentLock.case.zID}, ${selectedDevice.currentLock.case.category}). ` +
          `Do you want to override and send your feedback request to this device?`
        );
        
        if (!confirmed) return;
        
        await FeedbackAPI.override({
          caseId: caseId,
          deviceId: selectedDevice.deviceId,
          expectedLockId: selectedDevice.currentLock.id,
          expectedVersion: selectedDevice.currentLock.version
        });
      } else {
        // Device is available, use normal send API
        await FeedbackAPI.send({
          caseId: caseId,
          deviceId: selectedDevice.deviceId
        });
      }
      
      // Reload queue data to reflect the status change
      reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to send feedback request.");
    }
  }

  if (booting) {
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
    <main className="min-h-screen flex flex-col bg-white">
      <Header 
        staffName={user?.username ?? "Staff"} 
        onLogout={logout}
        showExportButton={user?.role === 'ADMIN'}
        onExportToExcel={handleExportToExcel}
      />

      <div className="flex-1 p-6 overflow-hidden">
        <div className="h-full grid grid-cols-3 gap-6">
          
          {/* QUEUE SECTION - Dynamic Content */}
          <QueueSection 
            queued={queued}
            loading={loading}
            takeNext={takeNext}
            take={take}
          />

          {/* ACTIVE CASES SECTION - Dynamic Content */}
          <ActiveCasesSection 
            myActive={myActive}
            loading={loading}
            resolve={resolve}
            sendFeedbackRequest={sendFeedbackRequest}
            escalate={escalate}
            hasSelectedDevice={hasSelectedDevice}
            selectedDevice={selectedDevice}
            isFeedbackDisabledForCase={isFeedbackDisabledForCase}
            getFeedbackDisabledReason={getFeedbackDisabledReason}
          />

          {/* DEVICES SECTION */}
          <DevicesSection 
            user={user}
            selectedDeviceId={selectedDeviceId}
            onSelectDevice={handleSelectDevice}
            onDeviceUpdate={() => {
              // Reload devices when they are updated
              const loadDevices = async () => {
                try {
                  const allDevicesRes = await DeviceAPI.list();
                  const allDevices = allDevicesRes.items || [];
                  
                  const feedbackDevs = allDevices
                    .filter((device: any) => device.mode === 'FEEDBACK')
                    .sort((a: any, b: any) => {
                      const nameA = (a.name || a.deviceLabel || "iPad Device").toLowerCase();
                      const nameB = (b.name || b.deviceLabel || "iPad Device").toLowerCase();
                      return nameA.localeCompare(nameB);
                    });
                  
                  setFeedbackDevices(feedbackDevs);
                } catch (e) {
                  console.error("Failed to reload devices:", e);
                }
              };
              loadDevices();
            }}
          />
        </div>
      </div>
      <Toaster />
    </main>
  );
}