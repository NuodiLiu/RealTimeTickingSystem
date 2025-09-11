"use client";

import { useEffect, useState, useCallback } from "react";
import QRCode from "qrcode";
import Header from "../components/Header";
import CaseCard from "../components/CaseCard";
import ActiveCaseRow from "../components/ActiveCaseRow";
import EmptyState from "../components/EmptyState";
import LoadingSkeleton from "../components/LoadingSkeleton";
import useAuth from "../hooks/useAuth";
import useQueue from "../hooks/useQueue";
import { DeviceAPI, FeedbackAPI, PairAPI, CasesAPI, HealthAPI } from "../lib/api";
import * as XLSX from 'xlsx';

export default function DashboardPage() {
  const { user, booting, logout } = useAuth();
  const { queued, myActive, loading, take, takeNext, resolve, reload } = useQueue(user?.id);

  // Devices state - separate for feedback and registration
  const [feedbackDevices, setFeedbackDevices] = useState<any[]>([]);
  const [registrationDevices, setRegistrationDevices] = useState<any[]>([]);
  const [deviceLoading, setDeviceLoading] = useState(true);
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
      setDeviceLoading(true);
      try {
        // Load all devices first
        const allDevicesRes = await DeviceAPI.list();
        const allDevices = allDevicesRes.items || [];
        
        // Filter devices by mode
        const feedbackDevs = allDevices.filter((device: any) => 
          device.mode === 'FEEDBACK' || device.mode === 'DUAL'
        );
        const registrationDevs = allDevices.filter((device: any) => 
          device.mode === 'REGISTRATION' || device.mode === 'DUAL'
        );
        
        setFeedbackDevices(feedbackDevs);
        setRegistrationDevices(registrationDevs);
        
        // If we have a saved selected device, verify it still exists and is available for feedback
        if (selectedDeviceId) {
          const selectedDevice = feedbackDevs.find((d: any) => d.deviceId === selectedDeviceId);
          if (!selectedDevice || !isDeviceAvailableForFeedback(selectedDevice)) {
            // Clear invalid selection
            setSelectedDeviceId(null);
            localStorage.removeItem('selected-feedback-device');
            console.log('Cleared invalid device selection:', selectedDeviceId);
          }
        }
      } catch (e) {
        console.error("Failed to load devices:", e);
      } finally {
        setDeviceLoading(false);
      }
    };
    loadDevices();
  }, [selectedDeviceId]);

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

  // Helper function to check if device is available for feedback
  const isDeviceAvailableForFeedback = (device: any) => {
    return (device.isOnline || device.online) && 
           (device.mode === 'FEEDBACK' || device.mode === 'DUAL');
  };

  // Handle device selection
  const handleSelectDevice = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    localStorage.setItem('selected-feedback-device', deviceId);
  };

  // Get selected device info
  const selectedDevice = feedbackDevices.find(d => d.deviceId === selectedDeviceId);

  // Check if feedback is available (has selected online device)
  const hasAvailableDevices = selectedDevice && isDeviceAvailableForFeedback(selectedDevice);

  // Send feedback request (uses selected device)
  async function sendFeedbackRequest(caseId: string) {
    if (!hasAvailableDevices || !selectedDevice) {
      alert("Please select an available device for feedback first.");
      return;
    }
    
    try {
      await FeedbackAPI.send({
        caseId: caseId,
        deviceId: selectedDevice.deviceId
      });
      // Reload queue data to reflect the status change
      reload();
    } catch (e: any) {
      alert(e?.message ?? "Failed to send feedback request.");
    }
  }

  // Unpair device function
  const handleUnpairDevice = async (deviceId: string, deviceName: string) => {
    const confirmed = window.confirm(`Are you sure you want to unpair the device "${deviceName}"? This action cannot be undone.`);
    
    if (!confirmed) return;

    try {
      await DeviceAPI.unpair(deviceId);
      
      // If this was the selected device, clear the selection
      if (selectedDeviceId === deviceId) {
        setSelectedDeviceId(null);
        localStorage.removeItem('selected-feedback-device');
      }
      
      // Reload devices to reflect the change
      const allDevicesRes = await DeviceAPI.list();
      const allDevices = allDevicesRes.items || [];
      
      const feedbackDevs = allDevices.filter((device: any) => 
        device.mode === 'FEEDBACK' || device.mode === 'DUAL'
      );
      const registrationDevs = allDevices.filter((device: any) => 
        device.mode === 'REGISTRATION' || device.mode === 'DUAL'
      );
      
      setFeedbackDevices(feedbackDevs);
      setRegistrationDevices(registrationDevs);
      
      alert(`Device "${deviceName}" has been successfully unpaired.`);
    } catch (e: any) {
      alert(e?.message ?? "Failed to unpair device.");
    }
  };

  // QR generation logic
  const [pairGenerating, setPairGenerating] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);
  const [pairQrDataUrl, setPairQrDataUrl] = useState<string | null>(null);

  async function handleGenerateQR(mode: string = "DUAL") {
    try {
      setPairError(null);
      setPairGenerating(true);

      // Fetch QR URL from backend
      const res = await PairAPI.generateQR({ mode });

      // Generate the QR code using the URL
      const dataUrl = await QRCode.toDataURL(res.qrUrl);
      setPairQrDataUrl(dataUrl);
    } catch (e: any) {
      setPairError(e?.message ?? "Failed to generate QR.");
    } finally {
      setPairGenerating(false);
    }
  }

  // Export to Excel functionality
  const handleExportToExcel = async () => {
    try {
      if (user?.role !== 'ADMIN') {
        alert('You do not have permission to export this data.');
        return;
      }
  
      const data = await CasesAPI.exportCases();
  
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Cases');
      XLSX.writeFile(wb, 'cases_export.xlsx');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('An error occurred while exporting the data.');
    }
  };

  // Modal control state
  const [pairOpen, setPairOpen] = useState(false);

  const openPairModal = useCallback(() => {
    setPairOpen(true);
  }, []);

  const closePairModal = useCallback(() => {
    setPairOpen(false);
  }, []);

  // Device card component to avoid duplication
  const DeviceCard = ({ device, isSelected, onSelect, onUnpair, showSelectButton = false }: {
    device: any;
    isSelected: boolean;
    onSelect?: (deviceId: string) => void;
    onUnpair?: (deviceId: string, deviceName: string) => void;
    showSelectButton?: boolean;
  }) => {
    const isAvailable = showSelectButton ? isDeviceAvailableForFeedback(device) : true;
    const isClickable = showSelectButton && isAvailable && onSelect;
    const deviceDisplayName = device.name || device.deviceLabel || "iPad Device";
    
    return (
      <div
        className={`
          flex justify-between p-4 border rounded-md shadow-sm transition-all
          ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}
          ${isSelected ? 'ring-2 ring-blue-200' : ''}
        `}
      >
        <div 
          onClick={() => isClickable && onSelect(device.deviceId)}
          className={`min-w-0 flex-1 ${isClickable ? 'cursor-pointer' : showSelectButton ? 'cursor-not-allowed opacity-60' : ''}`}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 truncate">
              {deviceDisplayName}
            </h3>
            {isSelected && showSelectButton && (
              <span className="px-2 py-1 text-xs font-medium text-blue-600 bg-blue-100 rounded-full">
                Selected
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-500 mt-1">
            Mode: <span className="font-medium">{device.mode}</span>
          </p>
          <div className="flex items-center mt-2">
            <div
              className={`w-2 h-2 rounded-full mr-2 ${
                device.isOnline ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span className="text-sm text-zinc-600">
              {device.isOnline ? "Online" : "Offline"}
            </span>
            {device.status && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                {device.status}
              </span>
            )}
          </div>
          {device.lastSeenAt && (
            <p className="text-xs text-zinc-400 mt-1">
              Last seen: {new Date(device.lastSeenAt).toLocaleTimeString()}
            </p>
          )}
          {showSelectButton && !isAvailable && (
            <p className="text-xs text-red-500 mt-1">
              {!device.isOnline ? "Device is offline" : "Device mode doesn't support feedback"}
            </p>
          )}
        </div>
        
        {/* Unpair button */}
        <div className="flex-shrink-0 ml-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onUnpair) {
                onUnpair(device.deviceId, deviceDisplayName);
              }
            }}
            className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 hover:border-red-300 transition-colors"
            title="Unpair this device"
          >
            Unpair
          </button>
        </div>
      </div>
    );
  };

  if (booting) {
    return (
      <main>
        <Header online={true} staffName="…" onLogout={() => {}} />
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
    <main className="min-h-screen flex flex-col">
      <Header online={online} staffName={user?.username ?? "Staff"} onLogout={logout} />

      <div className="flex-1 grid grid-cols-3 gap-6 p-4 overflow-hidden">
        {/* LEFT COLUMN: Queue */}
        <section className="flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Queue</h2>
            <button
              onClick={takeNext}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 flex-shrink-0"
            >
              TAKE NEXT
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-2" style={{ maxHeight: "calc(100vh - 100px)" }}>
            {loading && !queued ? (
              <LoadingSkeleton rows={3} />
            ) : queued && queued.length > 0 ? (
              <div className="space-y-3">
                {queued.map((c) => (
                  <CaseCard key={c.id} item={c} onTake={take} />
                ))}
              </div>
            ) : (
              <EmptyState label="No cases in queue." />
            )}
          </div>
        </section>

        {/* MIDDLE COLUMN: My Active Cases */}
        <section className="flex flex-col min-h-0">
          <div className="mb-4 min-h-[2rem] flex items-center">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              My Active Cases
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto pr-2" style={{ maxHeight: "calc(100vh - 100px)" }}>
            {loading && !myActive ? (
              <LoadingSkeleton rows={1} />
            ) : myActive && myActive.length > 0 ? (
              <div className="space-y-3">
                {myActive.map((c) => (
                  <ActiveCaseRow
                    key={c.id}
                    item={c}
                    onResolve={resolve}
                    onFeedback={sendFeedbackRequest}
                    feedbackDisabled={!hasAvailableDevices}
                    feedbackDisabledReason={
                      !selectedDevice 
                        ? 'Please select a device for feedback first'
                        : !selectedDevice.isOnline
                        ? 'Selected device is offline'
                        : 'No available devices for feedback'
                    }
                  />
                ))}
              </div>
            ) : (
              <EmptyState label="You have no active cases." />
            )}
          </div>
        </section>

        {/* RIGHT COLUMN: iPad Devices */}
        <section className="flex flex-col min-h-0">
          <div className="mb-4 min-h-[2rem] flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              iPad Devices
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  openPairModal();
                  handleGenerateQR("DUAL");
                }}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50"
              >
                Generate QR
              </button>
              <button
                onClick={handleExportToExcel}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50"
              >
                Export to Excel
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-6" style={{ maxHeight: "calc(100vh - 100px)" }}>
            {/* FEEDBACK DEVICES */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-3">
                Feedback Devices
              </h3>
              {deviceLoading ? (
                <LoadingSkeleton rows={2} />
              ) : feedbackDevices && feedbackDevices.length > 0 ? (
                <div className="space-y-3">
                  {feedbackDevices.map((device: any) => (
                    <DeviceCard
                      key={device.deviceId}
                      device={device}
                      isSelected={device.deviceId === selectedDeviceId}
                      onSelect={handleSelectDevice}
                      onUnpair={handleUnpairDevice}
                      showSelectButton={true}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState label="No feedback devices available." />
              )}
            </div>

            {/* REGISTRATION DEVICES */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-3">
                Registration Devices
              </h3>
              {deviceLoading ? (
                <LoadingSkeleton rows={2} />
              ) : registrationDevices && registrationDevices.length > 0 ? (
                <div className="space-y-3">
                  {registrationDevices.map((device: any) => (
                    <DeviceCard
                      key={`reg-${device.deviceId}`}
                      device={device}
                      isSelected={false}
                      onUnpair={handleUnpairDevice}
                      showSelectButton={false}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState label="No registration devices available." />
              )}
            </div>
          </div>
        </section>
      </div>

      {/* QR Generation Modal */}
      {pairOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closePairModal} />
          <div className="relative z-10 w-full max-w-lg rounded-xl bg-white shadow-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold">Pair iPad</h3>
              <button
                className="rounded-md border px-2 py-1 text-sm hover:bg-zinc-50"
                onClick={closePairModal}
              >
                Close
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-zinc-600">
                Generate a pairing QR that the iPad will scan to complete pairing.
              </p>
              <div className="flex items-center gap-2">
                <button
                  disabled={pairGenerating}
                  onClick={() => handleGenerateQR("DUAL")}
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50"
                >
                  {pairGenerating ? "Generating…" : "Generate QR"}
                </button>
              </div>

              {pairError && <p className="text-sm text-red-600">{pairError}</p>}

              {pairQrDataUrl && (
                <div className="mt-3 flex items-center justify-center">
                  <img
                    src={pairQrDataUrl}
                    alt="Pairing QR"
                    className="max-h-64 rounded-lg border p-2 bg-white"
                  />
                </div>
              )}

              {!pairQrDataUrl && !pairGenerating && (
                <div className="mt-2 rounded-md border p-3 text-sm text-zinc-500">
                  Press "Generate QR" to create a one-time pairing code. It expires in ~5 minutes.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}