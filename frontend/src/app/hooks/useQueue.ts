"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CaseItem, CasesAPI } from "../lib/api";
import { io, Socket } from "socket.io-client";
import { showToastPromise, handleError } from "../lib/toaster";
import { toast } from 'react-hot-toast';

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
    const socket: Socket = io(process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000', {
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
      
      switch (event.type) {
        case 'case:created':
          console.log('New case created, reloading queue...');
          load();
          break;
          
        case 'case:updated':
          console.log('Case updated, reloading queue...');
          load();
          break;
          
        case 'case:feedback_ready':
          console.log('Case feedback ready, reloading queue...');
          load();
          break;
          
        case 'device:updated':
          console.log('📱 useQueue: Device status updated, reloading queue...', event.payload);
          load();
          break;
          
        case 'device:feedback_progress':
          console.log('Feedback progress update, reloading queue...');
          load();
          break;
          
        case 'device:feedback_submitted':
          console.log('Feedback submitted, reloading queue...');
          load();
          break;
          
        case 'device:paired':
          console.log('New device paired successfully');
          break;
          
        case 'device:unpaired':
          console.log('Device unpaired');
          break;
          
        case 'device:mode_changed':
          // Device mode changed notification - silently handled
          console.log(`Device mode changed to ${event.payload?.mode || 'new mode'}`);
          break;
          
        default:
          // For any other case or device related events, reload as fallback
          if (event.type.startsWith('case:') || event.type.startsWith('device:')) {
            console.log(`Other relevant event [${event.type}] received, reloading queue data...`);
            load();
          }
          break;
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
    
    // Convert to array and sort by startedAt to preserve original order
    // regardless of status change (in_progress -> resolved_pending_feedback)
    return Array.from(activeCasesMap.values()).sort((a, b) => {
      const aStarted = a.startedAt ? new Date(a.startedAt).getTime() : 0;
      const bStarted = b.startedAt ? new Date(b.startedAt).getTime() : 0;
      return aStarted - bStarted; // ascending order (oldest first)
    });
  }, [inProgress, pendingFeedback, userId]);

  async function take(id: string) {
    try { 
      console.log('Taking case:', id);
      await showToastPromise(
        CasesAPI.take(id),
        {
          loading: 'Taking case...',
          success: 'Case taken successfully.',
          error: 'Failed to take case.'
        }
      );
      await load(); 
    }
    catch (e: any) { 
      console.error('Take error:', e);
      // Don't call handleError here since showToastPromise already handled it
    }
  }

  async function takeNext() {
    try { 
      console.log('Taking next case');
      await showToastPromise(
        CasesAPI.takeNext(),
        {
          loading: 'Taking next case...',
          success: 'Case taken successfully.',
          error: 'Failed to take next case.'
        }
      );
      await load(); 
    }
    catch (e: any) { 
      console.error('Take next error:', e);
      // Don't call handleError here since showToastPromise already handled it
    }
  }

  async function resolve(id: string) {
    try { 
      await CasesAPI.resolve(id);
      await load(); 
    }
    catch (e: any) { 
      handleError(e);
    }
  }

  async function escalate(id: string, department: string) {
    try { 
      await showToastPromise(
        CasesAPI.escalate(id, department),
        {
          loading: `Escalating case to ${department}...`,
          success: `Case escalated to ${department} successfully.`,
          error: `Failed to escalate case to ${department}.`
        }
      );
      await load(); 
    }
    catch (e: any) { 
      // Don't call handleError here since showToastPromise already handled it
      console.error('Escalate error:', e);
      throw e; // Re-throw so the component can handle the error if needed
    }
  }

  return { queued, myActive, loading, error, take, takeNext, resolve, escalate, reload: load };
}