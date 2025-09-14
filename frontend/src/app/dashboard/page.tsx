"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import QRCode from "qrcode";
import Header from "../components/Header";
import CaseCard from "../components/CaseCard";
import ActiveCaseRow from "../components/ActiveCaseRow";
import EmptyState from "../components/EmptyState";
import LoadingSkeleton from "../components/LoadingSkeleton";
import useAuth from "../hooks/useAuth";
import useQueue from "../hooks/useQueue";
import { DeviceAPI, FeedbackAPI, PairAPI, CasesAPI, HealthAPI } from "../lib/api";
import { 
  isCasePendingFeedback,
  isDeviceAvailableForFeedback,
  canUseDeviceForFeedback,
  getFeedbackDisabledReason,
  isFeedbackDisabledForCase
} from "../lib/caseUtils";
import * as XLSX from 'xlsx';
import { Toaster, toast } from 'react-hot-toast'

export default function DashboardPage() {
  const { user, booting, logout } = useAuth();
  const { queued, myActive, loading, take, takeNext, resolve, escalate, reload } = useQueue(user?.id);

  // Devices state - separate for feedback and registration
  const [feedbackDevices, setFeedbackDevices] = useState<any[]>([]);
  const [registrationDevices, setRegistrationDevices] = useState<any[]>([]);
  const [deviceLoading, setDeviceLoading] = useState(true);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [showRegistrationDevices, setShowRegistrationDevices] = useState(true);

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
          device.mode === 'FEEDBACK'
        );
        const registrationDevs = allDevices.filter((device: any) => 
          device.mode === 'REGISTRATION'
        );
        
        setFeedbackDevices(feedbackDevs);
        setRegistrationDevices(registrationDevs);
      } catch (e) {
        console.error("Failed to load devices:", e);
      } finally {
        setDeviceLoading(false);
      }
    };
    loadDevices();
  }, []); // Remove selectedDeviceId dependency

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
        device.mode === 'FEEDBACK'
      );
      const registrationDevs = allDevices.filter((device: any) => 
        device.mode === 'REGISTRATION'
      );
      
      setFeedbackDevices(feedbackDevs);
      setRegistrationDevices(registrationDevs);
      
      toast.success(`Device "${deviceName}" has been successfully unpaired.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to unpair device.");
    }
  };

  // Toggle device mode function
  const handleToggleDeviceMode = async (deviceId: string, deviceName: string, currentMode: string) => {
    const newMode = currentMode === 'FEEDBACK' ? 'REGISTRATION' : 'FEEDBACK';
    const confirmed = window.confirm(`Are you sure you want to switch "${deviceName}" from ${currentMode} mode to ${newMode} mode?`);
    
    if (!confirmed) return;

    try {
      await DeviceAPI.changeMode(deviceId, newMode as "REGISTRATION" | "FEEDBACK");
      
      // If this was the selected feedback device and we're switching it away from feedback mode, clear selection
      if (selectedDeviceId === deviceId && newMode !== 'FEEDBACK') {
        setSelectedDeviceId(null);
        localStorage.removeItem('selected-feedback-device');
      }
      
      // Reload devices to reflect the change
      const allDevicesRes = await DeviceAPI.list();
      const allDevices = allDevicesRes.items || [];
      
      const feedbackDevs = allDevices.filter((device: any) => 
        device.mode === 'FEEDBACK'
      );
      const registrationDevs = allDevices.filter((device: any) => 
        device.mode === 'REGISTRATION'
      );
      
      setFeedbackDevices(feedbackDevs);
      setRegistrationDevices(registrationDevs);

      toast.success(`Device "${deviceName}" has been successfully switched to ${newMode} mode.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to toggle device mode.");
    }
  };

  // QR generation logic
  const [pairGenerating, setPairGenerating] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);
  const [pairQrDataUrl, setPairQrDataUrl] = useState<string | null>(null);

  async function handleGenerateQR(mode: string = "REGISTRATION") {
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
        toast.error('You do not have permission to export this data.');
        return;
      }
  
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

  // Modal control state
  const [pairOpen, setPairOpen] = useState(false);

  const openPairModal = useCallback(() => {
    setPairOpen(true);
  }, []);

  const closePairModal = useCallback(() => {
    setPairOpen(false);
  }, []);

  // Device card component to avoid duplication
  const DeviceCard = ({ device, isSelected, onSelect, onUnpair, onToggleMode, showSelectButton = false }: {
    device: any;
    isSelected: boolean;
    onSelect?: (deviceId: string) => void;
    onUnpair?: (deviceId: string, deviceName: string) => void;
    onToggleMode?: (deviceId: string, deviceName: string, currentMode: string) => void;
    showSelectButton?: boolean;
  }) => {
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const isAvailable = showSelectButton ? isDeviceAvailableForFeedback(device) : true;
    const canBeUsed = showSelectButton ? canUseDeviceForFeedback(device) : true;
    const isClickable = showSelectButton && canBeUsed && onSelect;
    const deviceDisplayName = device.name || device.deviceLabel || "iPad Device";

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setShowDropdown(false);
        }
      };

      if (showDropdown) {
        document.addEventListener('mousedown', handleClickOutside);
      }

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [showDropdown]);
    
    return (
      <div
        className={`
          flex justify-between p-4 border rounded-md shadow-sm transition-all duration-200 ease-in-out
          ${isSelected ? 'border-[#ffd600] bg-white' : 'border-gray-200 bg-white'}
          ${isSelected ? 'ring-2 ring-[#ffd600]/30' : ''}
        `}
      >
        <div 
          onClick={() => isClickable && onSelect(device.deviceId)}
          className={`min-w-0 flex-1 ${isClickable ? 'cursor-pointer' : showSelectButton && !canBeUsed ? 'cursor-not-allowed opacity-60' : ''}`}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 truncate">
              {deviceDisplayName}
            </h3>
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
            {device.status && (
              <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                {device.status}
              </span>
            )}
          </div>
          {device.lastSeenAt && (
            <p className="text-xs text-zinc-400 mt-1">
              Last seen: {new Date(device.lastSeenAt).toLocaleTimeString()}
            </p>
          )}
          {showSelectButton && !canBeUsed && (
            <p className="text-xs text-[#D03E16] mt-1">
              {!device.isOnline 
                ? "Device is offline" 
                : "Device mode doesn't support feedback"}
            </p>
          )}
        </div>
        
        {/* Action dropdown */}
        <div className="flex-shrink-0 ml-3 relative" ref={dropdownRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDropdown(!showDropdown);
            }}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
            title="Device actions"
          >
            <svg className="w-4 h-4 text-gray-500 transform rotate-90" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-md shadow-lg z-10 w-max">
              <div className="py-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDropdown(false);
                    if (onUnpair) {
                      onUnpair(device.deviceId, deviceDisplayName);
                    }
                  }}
                  className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 transition-colors whitespace-nowrap"
                >
                  Unpair Device
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDropdown(false);
                    if (onToggleMode) {
                      onToggleMode(device.deviceId, deviceDisplayName, device.mode);
                    }
                  }}
                  className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 transition-colors whitespace-nowrap"
                >
                  Switch to {device.mode === 'FEEDBACK' ? 'Registration' : 'Feedback'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

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
      <Header staffName={user?.username ?? "Staff"} onLogout={logout} />

      <div className="flex-1 p-6 overflow-hidden">
        <div className="h-full grid grid-cols-3 gap-6">
          
          {/* QUEUE SECTION - Dynamic Content */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Queue</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {queued?.length || 0} cases waiting
                  </p>
                </div>
                <button
                  onClick={takeNext}
                  className="bg-[#ffd600] text-black px-4 py-2 rounded-md text-sm font-medium hover:bg-[#003366] hover:text-white transition-colors shadow-sm"
                >
                  TAKE NEXT
                </button>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto">
              {loading && !queued ? (
                <LoadingSkeleton rows={3} />
              ) : queued && queued.length > 0 ? (
                <div className="space-y-4">
                  {queued.map((c) => (
                    <CaseCard key={c.id} item={c} onTake={take} />
                  ))}
                </div>
              ) : (
                <EmptyState label="No cases in queue." />
              )}
            </div>
          </section>

          {/* ACTIVE CASES SECTION - Dynamic Content */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col">
            <div className="px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">My Active Cases</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {myActive?.length || 0} cases in progress
                </p>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto">
              {loading && !myActive ? (
                <LoadingSkeleton rows={1} />
              ) : myActive && myActive.length > 0 ? (
                <div className="space-y-4">
                  {myActive.map((c) => (
                    <ActiveCaseRow
                      key={c.id}
                      item={c}
                      onResolve={resolve}
                      onFeedback={sendFeedbackRequest}
                      onEscalate={escalate}
                      feedbackDisabled={isFeedbackDisabledForCase(c, hasSelectedDevice)}
                      feedbackDisabledReason={getFeedbackDisabledReason(c, selectedDevice)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState label="You have no active cases." />
              )}
            </div>
          </section>

          {/* DEVICES SECTION - Mixed Static/Dynamic Content */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">iPad Devices</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Device management & pairing
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      openPairModal();
                      handleGenerateQR("DUAL");
                    }}
                    className="bg-[#ffd600] text-black px-3 py-2 rounded-md text-sm font-medium hover:bg-[#003366] hover:text-white transition-colors shadow-sm"
                  >
                    Pair Device
                  </button>
                  {user?.role === 'ADMIN' && (
                    <button
                      onClick={handleExportToExcel}
                      className="bg-[#ffd600] text-black px-3 py-2 rounded-md text-sm font-medium hover:bg-[#003366] hover:text-white transition-colors shadow-sm"
                    >
                      Export to Excel
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              {/* FEEDBACK DEVICES SUBSECTION */}
              <div className="bg-white rounded-lg p-4 border border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                    Feedback Devices
                    <span className="ml-2 px-2 py-1 bg-white text-gray-600 text-xs rounded-full">
                      {feedbackDevices?.length || 0}
                    </span>
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
                          onToggleMode={handleToggleDeviceMode}
                          showSelectButton={true}
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState label="No feedback devices available." />
                  )}
                </div>

                {/* REGISTRATION DEVICES SUBSECTION */}
                <div className="bg-white rounded-lg p-4 border border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700 flex items-center">
                      Registration Devices
                      <span className="ml-2 px-2 py-1 bg-white text-gray-600 text-xs rounded-full">
                        {registrationDevices?.length || 0}
                      </span>
                    </h3>
                    <button
                      onClick={() => setShowRegistrationDevices(!showRegistrationDevices)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                      title={showRegistrationDevices ? "Hide registration devices" : "Show registration devices"}
                    >
                      <svg 
                        className={`w-4 h-4 transition-transform ${showRegistrationDevices ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      {showRegistrationDevices ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  
                  {showRegistrationDevices && (
                    <>
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
                              onToggleMode={handleToggleDeviceMode}
                              showSelectButton={false}
                            />
                          ))}
                        </div>
                      ) : (
                        <EmptyState label="No registration devices available." />
                      )}
                    </>
                  )}
                </div>


            </div>
          </section>
        </div>
      </div>

      {/* QR Generation Modal */}
      {pairOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closePairModal} />
          <div className="relative z-10 w-full max-w-lg rounded-xl bg-white shadow-2xl p-6">
            <div className="flex justify-end mb-4">
              <button
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50"
                onClick={closePairModal}
              >
                Close
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-zinc-600 text-center">
                Scan this code on the iPad to pair
              </p>

              {pairError && (
                <p className="text-sm text-[#D03E16] text-center">{pairError}</p>
              )}

              {pairQrDataUrl ? (
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative">
                    <img
                      src={pairQrDataUrl}
                      alt="Pairing QR"
                      className="max-h-64 rounded-lg border p-2 bg-white"
                    />
                  </div>
                  
                  {/* Refresh button centered below QR */}
                  <button
                    disabled={pairGenerating}
                    onClick={() => handleGenerateQR("REGISTRATION")}
                    className="p-2 rounded-full hover:bg-zinc-100 disabled:opacity-50 transition-colors"
                    title="Generate new QR code"
                  >
                    {pairGenerating ? (
                      <svg className="w-5 h-5 animate-spin text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-64 h-64 border-2 border-dashed border-zinc-300 rounded-lg flex items-center justify-center">
                    <button
                      disabled={pairGenerating}
                      onClick={() => handleGenerateQR("REGISTRATION")}
                      className="p-4 rounded-full hover:bg-zinc-100 disabled:opacity-50 transition-colors"
                      title="Generate QR code"
                    >
                      {pairGenerating ? (
                        <svg className="w-8 h-8 animate-spin text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      ) : (
                        <svg className="w-8 h-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-zinc-500 text-center">
                    Click the refresh icon to generate a pairing code
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}