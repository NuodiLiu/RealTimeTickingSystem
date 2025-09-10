"use client";

import { useEffect, useState } from "react";
import Header from "../components/Header";
import CaseCard from "../components/CaseCard";
import ActiveCaseRow from "../components/ActiveCaseRow";
import EmptyState from "../components/EmptyState";
import LoadingSkeleton from "../components/LoadingSkeleton";
import useAuth from "../hooks/useAuth";
import useQueue from "../hooks/useQueue";
import { DeviceAPI, FeedbackAPI } from "../lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

export default function DashboardPage() {
  const { user, booting, logout } = useAuth();
  const { queued, myActive, loading, take, takeNext, resolve } = useQueue(user?.id);

  // Fetch devices status
  const [devices, setDevices] = useState<any[]>([]);
  const [deviceLoading, setDeviceLoading] = useState(true);

  useEffect(() => {
    const loadDevices = async () => {
      setDeviceLoading(true);
      try {
        const res = await DeviceAPI.list();
        setDevices(res.items || []);
      } catch (e) {
        console.error("Failed to load devices:", e);
      } finally {
        setDeviceLoading(false);
      }
    };

    loadDevices();
  }, []);

  // Simple health ping → online dot
  const [online, setOnline] = useState<boolean>(true);
  useEffect(() => {
    let timer: any;
    const ping = async () => {
      try {
        const res = await fetch(`${API_BASE.replace(/\/$/, "")}/health`, { credentials: "include" });
        setOnline(res.ok);
      } catch {
        setOnline(false);
      }
    };
    ping();
    timer = setInterval(ping, 5000);
    return () => clearInterval(timer);
  }, []);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!booting && !user) window.location.href = "/login";
  }, [booting, user]);

  async function sendFeedbackRequest(caseId: string) {
    try {
      await FeedbackAPI.send({ caseId, deviceId: "" as any });
      alert("Feedback request sent.");
    } catch (e: any) {
      alert(e?.message ?? "Failed to send feedback request.");
    }
  }

  if (booting) {
    return (
      <main>
        <Header online={true} staffName="…" onLogout={() => {}} />
        <div className="h-screen flex flex-col">
          <div className="flex-1 grid grid-cols-3 gap-6 p-4 overflow-hidden">
            <section className="flex flex-col min-h-0">
              <div className="mb-4 min-h-[2rem] flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Queue</h2>
                <div className="flex-shrink-0"></div>
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
              <div className="mb-4 min-h-[2rem] flex items-center">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">iPad Devices</h2>
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

          <div className="flex-1 overflow-y-auto pr-2" style={{ maxHeight: 'calc(100vh - 100px)' }}>
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
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            My Active Cases
          </h2>

          <div className="flex-1 overflow-y-auto pr-2" style={{ maxHeight: 'calc(100vh - 100px)' }}>
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
          <div className="mb-4 min-h-[2rem] flex items-center">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              iPad Devices
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto pr-2" style={{ maxHeight: 'calc(100vh - 100px)' }}>
            {deviceLoading ? (
              <LoadingSkeleton rows={3} />
            ) : devices && devices.length > 0 ? (
              <div className="space-y-3">
                {devices.map((device: any) => (
                  <div key={device.id} className="flex justify-between p-4 border rounded-md bg-white shadow-sm">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {device.name || device.deviceLabel || "iPad Device"}
                      </h3>
                      <p className="text-sm text-zinc-500 mt-1">
                        Mode: <span className="font-medium">{device.mode}</span>
                      </p>
                      <div className="flex items-center mt-2">
                        <div className={`w-2 h-2 rounded-full mr-2 ${
                          device.online || device.isOnline 
                            ? 'bg-green-500' 
                            : 'bg-red-500'
                        }`} />
                        <span className="text-sm text-zinc-600">
                          {device.online || device.isOnline ? "Online" : "Offline"}
                        </span>
                      </div>
                      {device.lastSeenAt && (
                        <p className="text-xs text-zinc-400 mt-1">
                          Last seen: {new Date(device.lastSeenAt).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState label="No devices available." />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}