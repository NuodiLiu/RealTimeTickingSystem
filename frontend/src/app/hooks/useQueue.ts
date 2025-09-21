"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CaseItem, CasesAPI } from "../lib/api";
import { getDashboardSignalR, SignalREvent } from "../lib/signalr";
import { showToastPromise, handleError } from "../lib/toaster";
import toast from 'react-hot-toast';

function normalizeCases(res: unknown): CaseItem[] {
  const arr = Array.isArray(res) ? res : (res as any)?.items;
  if (!Array.isArray(arr)) return [];

  // Map backend StudentCase -> frontend CaseItem
  return arr.map((c: any) => {
    const backendStatus = String(c.status || "").toUpperCase();
    let frontendStatus: CaseItem["status"];
    
    switch (backendStatus) {
      case "QUEUED":
        frontendStatus = "QUEUED";
        break;
      case "IN_PROGRESS":
        frontendStatus = "IN_PROGRESS";
        break;
      case "RESOLVED_PENDING_FEEDBACK":
        frontendStatus = "RESOLVED_PENDING_FEEDBACK";
        break;
      case "RESOLVED":
        frontendStatus = "RESOLVED";
        break;
      default:
        frontendStatus = "QUEUED";
    }

    return {
      id: c.id,
      zID: c.zID,
      studentName: c.studentName,
      category: c.category,
      status: frontendStatus,
      createdAt: c.createdAt ?? new Date().toISOString(),
      updatedAt: c.updatedAt ?? c.createdAt ?? new Date().toISOString(),
      startedAt: c.startedAt,
      resolvedAt: c.resolvedAt,
      escalatedTo: c.escalatedTo,
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
      const [qRaw, ipRaw, pfRaw] = await Promise.all([
        // @ts-ignore 
        CasesAPI.list("QUEUED") as unknown as Promise<any>,
        // @ts-ignore
        CasesAPI.list("IN_PROGRESS") as unknown as Promise<any>,
        // @ts-ignore
        CasesAPI.list("RESOLVED_PENDING_FEEDBACK") as unknown as Promise<any>,
      ]);

      setQueued(normalizeCases(qRaw));
      setInProgress(normalizeCases(ipRaw));
      setPendingFeedback(normalizeCases(pfRaw));
    } catch (e: any) {
      console.error("Queue load failed:", e);
      setError(e?.message ?? "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      return;
    }

    load();

    // Set up SignalR connection for real-time updates
    const signalR = getDashboardSignalR();
    
    const handleSignalREvent = (event: SignalREvent) => {
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
          console.log('useQueue: Device status updated, reloading queue...', event.payload);
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
          console.log(`Device mode changed to ${event.payload?.mode || 'new mode'}`);
          break;
          
        default:
          if (event.type.startsWith('case:') || event.type.startsWith('device:')) {
            console.log(`Other relevant event [${event.type}] received, reloading queue data...`);
            load();
          }
          break;
      }
    };

    // Subscribe to all events for real-time updates
    const unsubscribe = signalR.on('*', handleSignalREvent);

    // Connect to SignalR
    signalR.connect(userId).then(() => {
      console.log('✅ useQueue: SignalR connected for real-time updates');
    }).catch((error) => {
      console.error('❌ useQueue: SignalR connection error:', error);
      console.log('🔍 useQueue: Current JWT:', localStorage.getItem('appJwt') ? 'Present' : 'Missing');
      console.log('🔍 useQueue: Will rely on manual refresh until SignalR is fixed');
    });

    return () => {
      console.log('Cleaning up SignalR subscriptions...');
      unsubscribe();
      // Note: We don't disconnect SignalR here as it's a singleton
      // and might be used by other components
    };
  }, [load, userId]); 

  const myActive = useMemo(() => {
    const activeCasesMap = new Map();
    
    // Add in_progress cases
    (inProgress ?? []).forEach(c => {
      if (!userId || c.staffId === userId) {
        activeCasesMap.set(c.id, c);
      }
    });
    
    (pendingFeedback ?? []).forEach(c => {
      if (!userId || c.staffId === userId) {
        activeCasesMap.set(c.id, c);
      }
    });
    
    // Convert to array and sort by startedAt to preserve original order
    return Array.from(activeCasesMap.values()).sort((a, b) => {
      const aStarted = a.startedAt ? new Date(a.startedAt).getTime() : 0;
      const bStarted = b.startedAt ? new Date(b.startedAt).getTime() : 0;
      return aStarted - bStarted; // ascending order (oldest first)
    });
  }, [inProgress, pendingFeedback, userId]);

  async function take(id: string) {
    try { 
      console.log('Taking case:', id);
      const result = await showToastPromise(
        CasesAPI.take(id),
        {
          loading: 'Taking case...',
          success: (res) => res.message || 'Case taken successfully.',
          error: 'Failed to take case.'
        }
      );
      if (result.case) {
        await load(); 
      }
    }
    catch (e: any) { 
      console.error('Take error:', e);
    }
  }

  async function takeNext() {
    try { 
      console.log('Taking next case');
      const result = await CasesAPI.takeNext();
      
      if (result.case) {
        // Case was successfully taken
        toast.success(result.message || 'Case taken successfully.', {
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
        await load(); 
      }
    }
    catch (e: any) { 
      console.error('Take next error:', e);
      handleError(e);
    }
  }

  async function resolve(id: string) {
    try { 
      await showToastPromise(
        CasesAPI.resolve(id),
        {
          loading: 'Resolving case...',
          success: 'Case resolved successfully.',
          error: 'Failed to resolve case.'
        }
      );
      await load(); 
    }
    catch (e: any) { 
      console.error('Resolve error:', e);
    }
  }

  async function escalate(id: string, department: string | null, resolvedOnSite: boolean | null = null) {
    try { 
      await showToastPromise(
        CasesAPI.escalate(id, department, resolvedOnSite),
        {
          loading: `Escalating case to ${department}...`,
          success: `Case escalated to ${department} successfully.`,
          error: `Failed to escalate case to ${department}.`
        }
      );
      await load(); 
    }
    catch (e: any) { 
      console.error('Escalate error:', e);
    }
  }

  return { queued, myActive, loading, error, take, takeNext, resolve, escalate, reload: load };
}