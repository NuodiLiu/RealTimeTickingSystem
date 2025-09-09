"use client";

import { useEffect, useState } from "react";
import Header from "../components/Header";
import CaseCard from "../components/CaseCard";
import ActiveCaseRow from "../components/ActiveCaseRow";
import EmptyState from "../components/EmptyState";
import LoadingSkeleton from "../components/LoadingSkeleton";
import useAuth from "../hooks/useAuth";
import useQueue from "../hooks/useQueue";
import { DeviceAPI, FeedbackAPI } from "../lib/api";  // Import DeviceAPI to fetch device data

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
        const res = await DeviceAPI.list();  // Fetch devices from backend
        setDevices(res.items || []);
      } catch (e) {
        console.error("Failed to load devices:", e);
      } finally {
        setDeviceLoading(false);
      }
    };

    loadDevices();
  }, []);

  // simple health ping → online dot
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

  // redirect unauthenticated users
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
        <div className="grid grid-cols-1 gap-6 p-4 md:grid-cols-2">
          <section className="space-y-3">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">Queue</h2>
            <LoadingSkeleton rows={3} />
          </section>
          <section className="space-y-3">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">My Active Cases</h2>
            <LoadingSkeleton rows={1} />
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <Header online={online} staffName={user?.username ?? "Staff"} onLogout={logout} />

      <div className="grid grid-cols-1 gap-6 p-4 md:grid-cols-2">
        {/* LEFT: Queue */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Queue</h2>
            <button
              onClick={takeNext}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50"
            >
              TAKE NEXT
            </button>
          </div>

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
        </section>

        {/* RIGHT: My Active Cases */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            My Active Cases
          </h2>
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
        </section>

        {/* RIGHT MOST: Devices List */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            iPad Devices
          </h2>
          {deviceLoading ? (
            <LoadingSkeleton rows={3} />
          ) : devices && devices.length > 0 ? (
            <div className="space-y-3">
              {devices.map((device: any) => (
                <div key={device.id} className="flex justify-between p-4 border rounded-md">
                  <div>
                    <h3 className="font-semibold">{device.deviceLabel || "iPad"}</h3>
                    <p className="text-sm text-zinc-500">Mode: {device.mode}</p>
                    <p className="text-sm text-zinc-500">Status: {device.online ? "Online" : "Offline"}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState label="No devices available." />
          )}
        </section>
      </div>
    </main>
  );
}