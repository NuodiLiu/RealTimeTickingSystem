"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CaseItem, CasesAPI } from "../lib/api";
import { io, Socket } from "socket.io-client";

// Accept both the backend's raw array and the helper's {items: []}
function normalizeCases(res: unknown): CaseItem[] {
  const arr = Array.isArray(res) ? res : (res as any)?.items;
  if (!Array.isArray(arr)) return [];

  // Map backend StudentCase -> frontend CaseItem
  return arr.map((c: any) => {
    // backend returns status as 'QUEUED' | 'IN_PROGRESS' | 'RESOLVED_PENDING_FEEDBACK' | 'RESOLVED'
    const backendStatus = String(c.status || "").toLowerCase();
    let frontendStatus: CaseItem["status"];
    
    switch (backendStatus) {
      case "queued":
        frontendStatus = "queued";
        break;
      case "in_progress":
        frontendStatus = "in_progress";
        break;
      case "resolved_pending_feedback":
        frontendStatus = "resolved_pending_feedback";
        break;
      case "resolved":
        frontendStatus = "resolved";
        break;
      default:
        frontendStatus = "queued";
    }

    return {
      id: c.id,
      zID: c.zID,
      studentName: c.studentName,
      category: c.category,
      status: frontendStatus,
      createdAt: c.createdAt ?? new Date().toISOString(),
      updatedAt: c.updatedAt ?? c.createdAt ?? new Date().toISOString(),
      startedAt: c.startedAt, // Add this line - map startedAt from backend
      resolvedAt: c.resolvedAt, // Add this too for completeness
      escalatedTo: c.escalatedTo, // Add escalatedTo field
      deviceId: c.deviceId,
      staffId: c.staffId,
    } as CaseItem;
  });
}

export default function useQueue(userId?: string) {
  const [queued, setQueued] = useState<CaseItem[] | null>(null);
  const [inProgress, setInProgress] = useState<CaseItem[] | null>(null);
  const [pendingFeedback, setPendingFeedback] = useState<CaseItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Get raw responses
      const [qRaw, ipRaw, pfRaw] = await Promise.all([
        // @ts-ignore – we want the raw shape back to normalize ourselves
        CasesAPI.list("queued") as unknown as Promise<any>,
        // @ts-ignore
        CasesAPI.list("in_progress") as unknown as Promise<any>,
        // @ts-ignore
        CasesAPI.list("resolved_pending_feedback") as unknown as Promise<any>,
      ]);

      setQueued(normalizeCases(qRaw));
      setInProgress(normalizeCases(ipRaw));
      setPendingFeedback(normalizeCases(pfRaw));
    } catch (e: any) {
      console.error("Queue load failed:", e);
      setError(e?.message ?? "Failed to load queue");
      // keep previous data if any
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial load
    load();

    // Set up WebSocket connection for real-time updates
    const socket: Socket = io(process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001', {
      path: '/ws',
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      console.log('Socket connected for real-time updates');
    });

    socket.on('event', (event: { type: string; payload: any }) => {
      console.log('Real-time event received:', event);
      // Reload data on any case or device update to keep the UI in sync
      if (event.type.startsWith('case:') || event.type.startsWith('device:')) {
        console.log(`Relevant event [${event.type}] received, reloading queue data...`);
        load();
      }
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    socket.on('connect_error', (err: Error) => {
      console.error('Socket connection error:', err);
    });

    // Set up periodic refresh (reduced frequency since we have real-time updates)
    const intervalId = setInterval(load, 10000); // Every 10 seconds instead of 3

    return () => {
      console.log('Cleaning up socket and interval...');
      socket.disconnect();
      clearInterval(intervalId);
    };
  }, [load, userId]); // Include load and userId in dependencies

  const myActive = useMemo(() => {
    // Create a map to deduplicate cases by ID
    const activeCasesMap = new Map();
    
    // Add in_progress cases
    (inProgress ?? []).forEach(c => {
      if (!userId || c.staffId === userId) {
        activeCasesMap.set(c.id, c);
      }
    });
    
    // Add resolved_pending_feedback cases (will override if same ID)
    (pendingFeedback ?? []).forEach(c => {
      if (!userId || c.staffId === userId) {
        activeCasesMap.set(c.id, c);
      }
    });
    
    return Array.from(activeCasesMap.values());
  }, [inProgress, pendingFeedback, userId]);

  async function take(id: string) {
    try { 
      console.log('Taking case:', id);
      const result = await CasesAPI.take(id);
      console.log('Take API result:', result);
      await load(); 
    }
    catch (e: any) { 
      console.error('Take error:', e);
      setError(e?.message ?? "Failed to take case"); 
    }
  }

  async function takeNext() {
    try { 
      console.log('Taking next case');
      const result = await CasesAPI.takeNext();
      console.log('Take next API result:', result);
      await load(); 
    }
    catch (e: any) { 
      console.error('Take next error:', e);
      setError(e?.message ?? "Failed to take next case"); 
    }
  }

  async function resolve(id: string) {
    try { 
      await CasesAPI.resolve(id); 
      await load(); 
    }
    catch (e: any) { 
      setError(e?.message ?? "Failed to resolve case"); 
    }
  }

  async function escalate(id: string, department: string) {
    try { 
      await CasesAPI.escalate(id, department); 
      await load(); 
    }
    catch (e: any) { 
      setError(e?.message ?? "Failed to escalate case"); 
      throw e; // Re-throw so the component can handle the error
    }
  }

  return { queued, myActive, loading, error, take, takeNext, resolve, escalate, reload: load };
}